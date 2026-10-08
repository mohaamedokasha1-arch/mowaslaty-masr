import { beforeAll, describe, expect, it } from 'vitest';
import type { RideLeg, Trip } from '@mowaslaty/shared';
import { MemoryDatabase } from '../src/db/memory-db.js';
import type { Database } from '../src/db/types.js';
import { buildGraph, planTrips, type EngineGraph } from '../src/services/routing-engine.js';

let db: Database;
let graph: EngineGraph;

const stopPoint = (id: string) => {
  const stop = graph.stops.get(id);
  if (!stop) throw new Error(`unknown stop ${id}`);
  return { lat: stop.lat, lng: stop.lng };
};

beforeAll(async () => {
  db = new MemoryDatabase();
  const [stops, routes] = await Promise.all([db.stops.all(), db.routes.activeDetailed()]);
  graph = buildGraph(stops, routes);
});

const rides = (trip: Trip) => trip.legs.filter((l): l is RideLeg => l.type === 'RIDE');

describe('graph construction', () => {
  it('indexes all seeded stops and active routes', () => {
    expect(graph.stops.size).toBeGreaterThanOrEqual(20);
    expect(graph.routes.length).toBe(9);
    expect(graph.routeIndex.get('ZG-STATION')?.length).toBeGreaterThanOrEqual(3);
  });

  it('computes walking neighbours within 700m', () => {
    const neighbors = graph.walkNeighbors.get('ZG-TAHRIR') ?? [];
    const ids = neighbors.map((n) => n.stopId);
    expect(ids).toContain('ZG-SAGHA'); // ~250m away
    expect(ids).not.toContain('ZG-UNIV'); // ~2km away
  });
});

describe('FASTEST mode', () => {
  it('finds a direct minibus trip from Tahrir Sq. to Zagazig University', () => {
    const trips = planTrips(graph, {
      from: stopPoint('ZG-TAHRIR'),
      to: stopPoint('ZG-UNIV'),
      fromName: 'ميدان التحرير',
      toName: 'جامعة الزقازيق',
      mode: 'FASTEST',
    });
    expect(trips.length).toBeGreaterThan(0);
    const best = trips[0];
    expect(best.transfers).toBe(0);
    const ride = rides(best)[0];
    expect(ride).toBeDefined();
    // Either direction of the شارع الجامعة corridor is a valid direct trip.
    expect(['route-zg-01', 'route-zg-02']).toContain(ride.routeId);
    expect(best.totalFare).toBe(5);
    expect(best.totalDurationMin).toBeLessThan(60);
  });

  it('ranks the fastest option first (faster than the cheap bus detour)', () => {
    const trips = planTrips(graph, {
      from: stopPoint('ZG-STATION'),
      to: stopPoint('ZG-UNIV'),
      fromName: 'ميدان المحطة',
      toName: 'جامعة الزقازيق',
      mode: 'FASTEST',
    });
    const best = trips[0];
    expect(rides(best)[0].routeId).toBe('route-zg-01');
  });
});

describe('CHEAPEST mode', () => {
  it('prefers the 3-EGP city bus over the 5-EGP minibus', () => {
    const trips = planTrips(graph, {
      from: stopPoint('ZG-TAHRIR'),
      to: stopPoint('ZG-UNIV'),
      fromName: 'ميدان التحرير',
      toName: 'جامعة الزقازيق',
      mode: 'CHEAPEST',
    });
    const best = trips[0];
    expect(best.totalFare).toBeLessThanOrEqual(3);
    expect(rides(best).some((r) => r.routeId === 'route-zg-03')).toBe(true);
  });
});

describe('FEWEST_TRANSFERS mode', () => {
  it('uses the direct Qawmya–University line without transfers', () => {
    const trips = planTrips(graph, {
      from: stopPoint('ZG-QAWMEYA'),
      to: stopPoint('ZG-UNIV'),
      fromName: 'القومية',
      toName: 'جامعة الزقازيق',
      mode: 'FEWEST_TRANSFERS',
    });
    const best = trips[0];
    expect(best.transfers).toBe(0);
    expect(rides(best)[0].routeId).toBe('route-zg-02');
  });
});

describe('intercity trips with transfers', () => {
  it('plans Zagazig central → Hay El-Salam (Ismailia) with one transfer', () => {
    const trips = planTrips(graph, {
      from: stopPoint('ZG-MAWQIF'),
      to: stopPoint('IS-SALAM'),
      fromName: 'موقف الزقازيق العمومي',
      toName: 'حي السلام',
      mode: 'FASTEST',
    });
    expect(trips.length).toBeGreaterThan(0);
    const best = trips[0];
    const routeIds = rides(best).map((r) => r.routeId);
    expect(routeIds).toContain('route-zg-ism');
    expect(routeIds).toContain('route-is-01');
    expect(best.transfers).toBe(1);
    expect(best.totalFare).toBe(29); // 25 intercity + 4 local
  });

  it('plans cross-city Cairo Tahrir → Zagazig University (multimodal)', () => {
    const trips = planTrips(graph, {
      from: stopPoint('CA-TAHRIR'),
      to: stopPoint('ZG-UNIV'),
      fromName: 'ميدان التحرير (القاهرة)',
      toName: 'جامعة الزقازيق',
      mode: 'FASTEST',
    });
    expect(trips.length).toBeGreaterThan(0);
    const best = trips[0];
    const routeIds = rides(best).map((r) => r.routeId);
    // The sensible journey uses the Cairo–Zagazig train.
    expect(routeIds).toContain('route-ca-zg');
    expect(best.totalFare).toBeGreaterThanOrEqual(20);
  });
});

describe('walking behaviour', () => {
  it('offers a direct walking trip for very short distances', () => {
    const trips = planTrips(graph, {
      from: stopPoint('ZG-TAHRIR'),
      to: stopPoint('ZG-SAGHA'),
      fromName: 'ميدان التحرير',
      toName: 'الصاغة',
      mode: 'FASTEST',
    });
    const walkOnly = trips.find((t) => t.legs.length === 1 && t.legs[0].type === 'WALK');
    expect(walkOnly).toBeDefined();
    expect(walkOnly!.totalFare).toBe(0);
  });

  it('LEAST_WALKING avoids walking transfers where possible', () => {
    const trips = planTrips(graph, {
      from: stopPoint('ZG-MAWQIF'),
      to: stopPoint('ZG-UNIV'),
      fromName: 'الموقف العمومي',
      toName: 'الجامعة',
      mode: 'LEAST_WALKING',
    });
    const best = trips[0];
    expect(best.walkDistanceKm).toBeLessThan(0.8);
  });
});

describe('edge cases', () => {
  it('returns no trips for a remote point beyond walking reach', () => {
    const trips = planTrips(graph, {
      from: { lat: 29.0, lng: 30.0 }, // desert, >1.5km from any stop
      to: { lat: 29.01, lng: 30.02 }, // also far, and >3km apart handled separately
      fromName: 'نقطة نائية',
      toName: 'نقطة نائية ٢',
      mode: 'FASTEST',
    });
    expect(trips).toHaveLength(0);
  });

  it('produces alternatives with different primary routes when available', () => {
    const trips = planTrips(graph, {
      from: stopPoint('ZG-MAWQIF'),
      to: stopPoint('ZG-UNIV'),
      fromName: 'الموقف العمومي',
      toName: 'الجامعة',
      mode: 'FASTEST',
    });
    expect(trips.length).toBeGreaterThanOrEqual(2);
    const signatures = new Set(
      trips.map((t) => rides(t).map((r) => r.routeId).join('>')),
    );
    expect(signatures.size).toBeGreaterThanOrEqual(2);
  });
});
