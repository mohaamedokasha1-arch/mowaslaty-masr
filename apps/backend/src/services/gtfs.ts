/**
 * GTFS (General Transit Feed Specification) import.
 *
 * Pipeline:
 *   GTFS text files → parseCsv → normalizeGtfsToImport(db-aware city mapping)
 *   → Database.importData (idempotent by externalId / Arabic name)
 *
 * A GTFS feed is a zip of CSV files; unzip it first and pass the directory
 * (CLI) or the file contents (admin dashboard upload).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CityDto } from '@mowaslaty/shared';
import { haversineMeters } from '@mowaslaty/shared';
import type { ImportPayload } from '../db/types.js';

export type GtfsFiles = Record<string, string>;

const REQUIRED_FILES = ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'];

/** Minimal RFC-4180 CSV parser (quotes, embedded commas/newlines, CRLF, BOM). */
export function parseCsv(text: string): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] !== '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const clean = rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  if (clean.length === 0) return [];
  const headers = clean[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
  return clean.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim();
    });
    return obj;
  });
}

/** Read all *.txt files of an unzipped GTFS directory. */
export async function readGtfsDir(dir: string): Promise<GtfsFiles> {
  const entries = await fs.readdir(dir);
  const files: GtfsFiles = {};
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.txt')) continue;
    files[entry.toLowerCase()] = await fs.readFile(path.join(dir, entry), 'utf-8');
  }
  return files;
}

/** GTFS route_type → our TransportMode.name */
const ROUTE_TYPE_TO_MODE: Record<string, string> = {
  '0': 'Tram', // Tram, Light rail
  '1': 'Metro', // Subway
  '2': 'Train', // Rail
  '3': 'Bus',
  '5': 'Tram', // Cable tram
  '11': 'Bus', // Trolleybus
  '12': 'Metro', // Monorail
};

interface RawGtfs {
  stops: Record<string, string>[];
  routes: Record<string, string>[];
  trips: Record<string, string>[];
  stopTimes: Record<string, string>[];
  fareAttributes: Record<string, string>[];
  fareRules: Record<string, string>[];
}

export function parseGtfsFiles(files: GtfsFiles): RawGtfs {
  const missing = REQUIRED_FILES.filter((f) => !files[f]);
  if (missing.length > 0) {
    throw new Error(`Missing required GTFS files: ${missing.join(', ')}`);
  }
  return {
    stops: parseCsv(files['stops.txt']),
    routes: parseCsv(files['routes.txt']),
    trips: parseCsv(files['trips.txt']),
    stopTimes: parseCsv(files['stop_times.txt']),
    fareAttributes: files['fare_attributes.txt'] ? parseCsv(files['fare_attributes.txt']) : [],
    fareRules: files['fare_rules.txt'] ? parseCsv(files['fare_rules.txt']) : [],
  };
}

function nearestCityId(cities: CityDto[], lat: number, lng: number): string | null {
  if (cities.length === 0) return null;
  let best: { id: string; d: number } | null = null;
  for (const c of cities) {
    const d = haversineMeters({ lat, lng }, { lat: c.latitude, lng: c.longitude });
    if (!best || d < best.d) best = { id: c.id, d };
  }
  // Only assign a city when reasonably close (≤ 60 km from its center).
  return best && best.d <= 60_000 ? best.id : null;
}

function formatGtfsTime(t: string): string {
  const parts = t.split(':');
  if (parts.length < 2) return t;
  const h = Math.min(23, parseInt(parts[0], 10) % 24);
  return `${String(h).padStart(2, '0')}:${parts[1]}`;
}

/**
 * Convert parsed GTFS tables into a normalized ImportPayload.
 * Cities are assigned to stops by proximity to known city centers.
 */
export function normalizeGtfsToImport(
  raw: RawGtfs,
  cities: CityDto[],
  opts: { sourceName: string; sourceType?: string; sourceUrl?: string },
): ImportPayload {
  const warnings: string[] = [];

  // ---- Stops ----
  const stops = raw.stops
    .filter((s) => s.stop_id && s.stop_lat && s.stop_lon)
    .map((s) => {
      const lat = parseFloat(s.stop_lat);
      const lng = parseFloat(s.stop_lon);
      return {
        externalId: s.stop_id,
        name: s.stop_name ?? s.stop_id,
        nameAr: s.stop_name ?? s.stop_id,
        lat,
        lng,
        cityId: nearestCityId(cities, lat, lng),
        address: s.stop_desc || undefined,
      };
    });

  // ---- Trips & stop sequences ----
  const tripsByRoute = new Map<string, string[]>();
  for (const t of raw.trips) {
    if (!t.route_id || !t.trip_id) continue;
    const list = tripsByRoute.get(t.route_id) ?? [];
    list.push(t.trip_id);
    tripsByRoute.set(t.route_id, list);
  }

  const stopTimesByTrip = new Map<string, Record<string, string>[]>();
  for (const st of raw.stopTimes) {
    if (!st.trip_id) continue;
    const list = stopTimesByTrip.get(st.trip_id) ?? [];
    list.push(st);
    stopTimesByTrip.set(st.trip_id, list);
  }

  // ---- Fares ----
  const fareById = new Map(raw.fareAttributes.map((f) => [f.fare_id, parseFloat(f.price)]));
  const fareByRoute = new Map<string, number>();
  for (const rule of raw.fareRules) {
    if (rule.route_id && fareById.has(rule.fare_id)) {
      fareByRoute.set(rule.route_id, fareById.get(rule.fare_id)!);
    }
  }
  const singleFare =
    fareByRoute.size === 0 && raw.fareAttributes.length === 1
      ? parseFloat(raw.fareAttributes[0].price)
      : null;

  // ---- Routes ----
  const routes = [];
  for (const r of raw.routes) {
    if (!r.route_id) continue;
    const modeName = ROUTE_TYPE_TO_MODE[r.route_type ?? '3'] ?? 'Bus';
    if (!(r.route_type in ROUTE_TYPE_TO_MODE)) {
      warnings.push(`الخط "${r.route_long_name ?? r.route_id}": نوع غير معتاد (${r.route_type}) — اعتُبر أتوبيسًا`);
    }

    // Pick the trip with the longest stop sequence as the canonical path.
    const tripIds = tripsByRoute.get(r.route_id) ?? [];
    let bestTrip: { id: string; times: Record<string, string>[] } | null = null;
    for (const tripId of tripIds) {
      const times = (stopTimesByTrip.get(tripId) ?? []).sort(
        (a, b) => (parseInt(a.stop_sequence, 10) || 0) - (parseInt(b.stop_sequence, 10) || 0),
      );
      if (times.length > (bestTrip?.times.length ?? 0)) bestTrip = { id: tripId, times };
    }
    if (!bestTrip || bestTrip.times.length < 2) {
      warnings.push(`الخط "${r.route_long_name ?? r.route_id}" بلا تسلسل محطات صالح — تم تجاوزه`);
      continue;
    }

    // Operating window across all trips of this route.
    const allTimes = tripIds.flatMap((tid) => stopTimesByTrip.get(tid) ?? []);
    const departures = allTimes
      .map((st) => st.departure_time)
      .filter(Boolean)
      .sort();
    const operatingHours =
      departures.length >= 2
        ? `${formatGtfsTime(departures[0])}-${formatGtfsTime(departures[departures.length - 1])}`
        : undefined;

    const fare = fareByRoute.get(r.route_id) ?? singleFare ?? null;
    const name = r.route_long_name || r.route_short_name || r.route_id;

    routes.push({
      externalId: r.route_id,
      name,
      nameAr: name,
      description: r.route_desc || undefined,
      modeName,
      fare,
      operatingHours,
      stopSequence: bestTrip.times.map((st) => st.stop_id),
    });
  }

  return {
    sourceName: opts.sourceName,
    sourceType: opts.sourceType ?? 'GTFS',
    sourceUrl: opts.sourceUrl,
    stops,
    routes,
    warnings,
  };
}
