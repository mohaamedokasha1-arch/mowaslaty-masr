import { beforeAll, describe, expect, it } from 'vitest';
import { MemoryDatabase } from '../src/db/memory-db.js';
import type { Database } from '../src/db/types.js';
import { importBundledFeeds } from '../src/database/bundles.js';
import { buildGraph, planTrips } from '../src/services/routing-engine.js';

let db: Database;

beforeAll(async () => {
  db = new MemoryDatabase();
  const results = await importBundledFeeds(db);
  expect(results).toHaveLength(2);
  for (const r of results) expect(r.ok).toBe(true);
}, 60_000);

describe('bundled real feeds', () => {
  it('imports the Port Said bus network (13 lines, Arabic names applied)', async () => {
    const { data, total } = await db.routes.list({ cityId: 'city-portsaid', take: 50 });
    expect(total).toBe(13);
    const names = data.map((r) => r.nameAr);
    expect(names).toContain('خط الاستثمار');
    expect(names).toContain('خط الأمين');
    expect(names).toContain('معدية بورفؤاد – بورسعيد');
    for (const r of data) {
      expect(r.dataSource).toBe('شبكة أتوبيسات بورسعيد (PortSaid-GTFS)');
      expect((r.stops ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('imports the Cairo Metro lines from Transport for Cairo', async () => {
    const { data } = await db.routes.list({ search: 'مترو الخط', take: 20 });
    expect(data.length).toBe(3);
    const line1 = data.find((r) => r.externalId === 'L1');
    expect(line1).toBeDefined();
    // Helwan → El Marg full line has many stations.
    expect((line1!.stops ?? []).length).toBeGreaterThan(25);
    expect(line1!.transportMode?.name).toBe('Metro');
  });

  it('assigns imported stops to the nearest known city', async () => {
    const stops = await db.stops.list({ cityId: 'city-portsaid', take: 1 });
    expect(stops.total).toBeGreaterThan(500);
    const cairo = await db.stops.list({ cityId: 'city-cairo', take: 1 });
    // Seeded Cairo stops + metro stations (same-name platform entrances merge).
    expect(cairo.total).toBeGreaterThan(60);
  });

  it('plans a real trip inside Port Said', async () => {
    const { data } = await db.routes.list({ cityId: 'city-portsaid', take: 50 });
    const route = data.find((r) => r.nameAr === 'خط الاستثمار')!;
    const ordered = [...(route.stops ?? [])].sort((a, b) => a.order - b.order);
    // The line is a loop (first ≈ last stop), so ride from the start to the
    // middle of the sequence instead.
    const first = ordered[0].stop!;
    const middle = ordered[Math.floor(ordered.length / 2)].stop!;

    const [stops, routes] = await Promise.all([db.stops.all(), db.routes.activeDetailed()]);
    const graph = buildGraph(stops, routes);
    const trips = planTrips(graph, {
      from: { lat: first.latitude, lng: first.longitude },
      to: { lat: middle.latitude, lng: middle.longitude },
      fromName: first.nameAr,
      toName: middle.nameAr,
      mode: 'FASTEST',
    });
    expect(trips.length).toBeGreaterThan(0);
    expect(trips[0].legs.some((l) => l.type === 'RIDE')).toBe(true);
  });

  it('is idempotent on re-import (server restart safety)', async () => {
    const before = await db.routes.count();
    const results = await importBundledFeeds(db);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.every((r) => r.routesCreated === 0)).toBe(true);
    expect(await db.routes.count()).toBe(before);
  });
});
