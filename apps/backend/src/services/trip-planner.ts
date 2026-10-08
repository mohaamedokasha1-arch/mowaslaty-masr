/**
 * Trip planning orchestration: resolves origin/destination texts to
 * coordinates, builds the transit graph and runs the routing engine.
 */
import type { ResolvedPlace, TripPlanRequest, TripPlanResult } from '@mowaslaty/shared';
import { haversineMeters } from '@mowaslaty/shared';
import type { Database } from '../db/types.js';
import { buildGazetteer, resolvePlace } from './geocoder.js';
import { buildGraph, planTrips } from './routing-engine.js';
import { logger } from '../utils/logger.js';

export async function planTrip(db: Database, req: TripPlanRequest): Promise<TripPlanResult> {
  const gazetteer = await buildGazetteer(db);

  // ---- Resolve origin ----
  let from: ResolvedPlace | null =
    req.fromLat != null && req.fromLng != null
      ? { name: 'نقطة البداية', nameAr: 'نقطة البداية', lat: req.fromLat, lng: req.fromLng, kind: 'geocoded' }
      : null;
  if (!from && req.fromText) {
    const res = await resolvePlace(db, req.fromText, gazetteer);
    if (!res.place) {
      return {
        ok: false,
        mode: req.mode,
        trips: [],
        message: `Could not find origin "${req.fromText}"`,
        messageAr: `لم نتمكن من العثور على "${req.fromText}" كنقطة بداية. جرّب أحد الأماكن المعروفة:`,
        suggestions: res.suggestions,
      };
    }
    from = res.place;
  }

  // ---- Resolve destination ----
  let to: ResolvedPlace | null =
    req.toLat != null && req.toLng != null
      ? { name: 'الوجهة', nameAr: 'الوجهة', lat: req.toLat, lng: req.toLng, kind: 'geocoded' }
      : null;
  if (!to && req.toText) {
    const res = await resolvePlace(db, req.toText, gazetteer);
    if (!res.place) {
      return {
        ok: false,
        mode: req.mode,
        resolvedFrom: from ?? undefined,
        trips: [],
        message: `Could not find destination "${req.toText}"`,
        messageAr: `لم نتمكن من العثور على "${req.toText}" كوجهة. جرّب أحد الأماكن المعروفة:`,
        suggestions: res.suggestions,
      };
    }
    to = res.place;
  }

  if (!from || !to) {
    return {
      ok: false,
      mode: req.mode,
      trips: [],
      message: 'Origin and destination are required',
      messageAr: 'من فضلك حدد نقطة البداية والوجهة',
      suggestions: gazetteer.slice(0, 12).map((e) => e.nameAr),
    };
  }

  const direct = haversineMeters(from, to);
  if (direct < 50) {
    return {
      ok: false,
      mode: req.mode,
      resolvedFrom: from,
      resolvedTo: to,
      trips: [],
      message: 'Origin and destination are the same location',
      messageAr: 'نقطة البداية والوجهة متطابقتان',
    };
  }

  // ---- Build graph & plan ----
  const [stops, routes] = await Promise.all([db.stops.all(), db.routes.activeDetailed()]);
  const graph = buildGraph(stops, routes);
  const trips = planTrips(graph, {
    from: { lat: from.lat, lng: from.lng },
    to: { lat: to.lat, lng: to.lng },
    fromName: from.nameAr,
    toName: to.nameAr,
    mode: req.mode,
  });

  // Record the search for analytics (never block the response on it).
  db.searchHistory
    .record({
      fromAddress: from.nameAr,
      toAddress: to.nameAr,
      fromLat: from.lat,
      fromLng: from.lng,
      toLat: to.lat,
      toLng: to.lng,
      searchMode: req.mode,
      resultCount: trips.length,
    })
    .catch((err) => logger.warn({ err }, 'failed to record search history'));

  return {
    ok: trips.length > 0,
    mode: req.mode,
    resolvedFrom: from,
    resolvedTo: to,
    trips,
    ...(trips.length === 0
      ? {
          message: 'No trips found between these locations',
          messageAr:
            'لم نجد رحلات بين هذين المكانين. جرّب محطة أقرب أو ابحث عن خط مباشر بين المدينتين.',
        }
      : {}),
  };
}
