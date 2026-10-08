/**
 * Place resolution (geocoding) for trip planning.
 *
 * Resolution order:
 *  1. Local gazetteer built from the database (cities, areas, stops) — fast,
 *     offline, and understands Arabic normalization.
 *  2. OpenStreetMap Nominatim as an optional online fallback (can be disabled
 *     with GEOCODING_ENABLED=false).
 */
import axios from 'axios';
import type { ResolvedPlace } from '@mowaslaty/shared';
import { env } from '../utils/env.js';
import { normalizeArabic } from '../db/memory-db.js';
import type { Database } from '../db/types.js';

export interface GazetteerEntry {
  name: string;
  nameAr: string;
  lat: number;
  lng: number;
  kind: 'city' | 'area' | 'stop';
  cityAr?: string;
}

export async function buildGazetteer(db: Database): Promise<GazetteerEntry[]> {
  const [cities, stops] = await Promise.all([db.cities.list({ take: 100 }), db.stops.all()]);
  const entries: GazetteerEntry[] = [];

  for (const city of cities.data) {
    entries.push({
      name: city.name,
      nameAr: city.nameAr,
      lat: city.latitude,
      lng: city.longitude,
      kind: 'city',
      cityAr: city.nameAr,
    });
    const areas = await db.areas.byCity(city.id);
    for (const area of areas) {
      // Areas have no stored coordinates; anchor them at their city center.
      entries.push({
        name: area.name,
        nameAr: area.nameAr,
        lat: city.latitude + 0.001,
        lng: city.longitude + 0.001,
        kind: 'area',
        cityAr: city.nameAr,
      });
    }
  }

  for (const stop of stops) {
    entries.push({
      name: stop.name,
      nameAr: stop.nameAr,
      lat: stop.latitude,
      lng: stop.longitude,
      kind: 'stop',
      cityAr: stop.city?.nameAr,
    });
  }

  return entries;
}

function score(entry: GazetteerEntry, queryNorm: string): number {
  const candidates = [entry.name, entry.nameAr].map((c) => normalizeArabic(c ?? ''));
  let best = 0;
  for (const c of candidates) {
    if (!c) continue;
    if (c === queryNorm) best = Math.max(best, 100);
    else if (c.startsWith(queryNorm)) best = Math.max(best, 60);
    else if (c.includes(queryNorm)) best = Math.max(best, 40);
  }
  // A compound query matching "name (city)" style labels
  const full = normalizeArabic(`${entry.nameAr} ${entry.cityAr ?? ''}`);
  if (full.includes(queryNorm)) best = Math.max(best, 30);
  return best;
}

export async function findInGazetteer(
  entries: GazetteerEntry[],
  query: string,
): Promise<GazetteerEntry | null> {
  const q = normalizeArabic(query);
  if (!q) return null;
  let best: { entry: GazetteerEntry; s: number } | null = null;
  for (const entry of entries) {
    const s = score(entry, q);
    if (s > 0 && (!best || s > best.s)) best = { entry, s };
  }
  return best?.entry ?? null;
}

async function nominatimSearch(query: string): Promise<ResolvedPlace | null> {
  if (env.GEOCODING_ENABLED === 'false') return null;
  try {
    const res = await axios.get(`${env.OPENSTREETMAP_API_URL}/search`, {
      params: { q: query, format: 'json', limit: 1, countrycodes: 'eg' },
      headers: { 'User-Agent': 'MowaslatyEgypt/1.0 (transit platform)' },
      timeout: 2500,
    });
    const first = res.data?.[0];
    if (!first) return null;
    return {
      name: first.display_name as string,
      nameAr: query,
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      kind: 'geocoded',
    };
  } catch {
    return null;
  }
}

export interface ResolutionResult {
  place: ResolvedPlace | null;
  suggestions: string[];
}

export async function resolvePlace(
  db: Database,
  query: string,
  entries?: GazetteerEntry[],
): Promise<ResolutionResult> {
  const gazetteer = entries ?? (await buildGazetteer(db));
  const suggestions = gazetteer.slice(0, 12).map((e) => e.nameAr);

  const hit = await findInGazetteer(gazetteer, query);
  if (hit) {
    return {
      place: {
        name: hit.name,
        nameAr: hit.nameAr + (hit.cityAr && hit.kind !== 'city' ? `، ${hit.cityAr}` : ''),
        lat: hit.lat,
        lng: hit.lng,
        kind: hit.kind,
      },
      suggestions,
    };
  }

  const online = await nominatimSearch(query);
  if (online) return { place: online, suggestions };

  return { place: null, suggestions };
}
