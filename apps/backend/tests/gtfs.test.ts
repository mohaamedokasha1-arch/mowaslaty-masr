import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { MemoryDatabase } from '../src/db/memory-db.js';
import { normalizeGtfsToImport, parseCsv, parseGtfsFiles, readGtfsDir } from '../src/services/gtfs.js';

const sampleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sample-gtfs');

describe('parseCsv', () => {
  it('handles quoted commas, CRLF and BOM', () => {
    const rows = parseCsv('\uFEFFa,b,c\r\n1,"x,y",3\r\n"he said ""hi""",5,6');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ a: '1', b: 'x,y', c: '3' });
    expect(rows[1].a).toBe('he said "hi"');
  });

  it('returns empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('normalizeGtfsToImport (sample feed)', () => {
  it('normalizes stops, route, fare and operating hours', async () => {
    const files = await readGtfsDir(sampleDir);
    const raw = parseGtfsFiles(files);
    expect(raw.stops).toHaveLength(4);

    const db = new MemoryDatabase();
    const { data: cities } = await db.cities.list({ take: 100 });
    const payload = normalizeGtfsToImport(raw, cities, { sourceName: 'GTFS تجريبي' });

    expect(payload.stops).toHaveLength(4);
    for (const s of payload.stops) {
      expect(s.cityId).toBe('city-zagazig'); // all sample stops are inside Zagazig
    }

    expect(payload.routes).toHaveLength(1);
    const route = payload.routes[0];
    expect(route.externalId).toBe('R10');
    expect(route.nameAr).toBe('خط الأحرار');
    expect(route.modeName).toBe('Bus');
    expect(route.fare).toBe(4.5);
    expect(route.operatingHours).toBe('06:30-22:38');
    expect(route.stopSequence).toEqual(['GW-S1', 'GW-S2', 'GW-S3', 'GW-S4']);
  });

  it('rejects feeds missing required files', () => {
    expect(() => parseGtfsFiles({ 'stops.txt': 'stop_id\n' })).toThrow(/Missing required GTFS files/);
  });
});

describe('Database.importData', () => {
  let db: MemoryDatabase;

  beforeAll(async () => {
    db = new MemoryDatabase();
    const files = await readGtfsDir(sampleDir);
    const raw = parseGtfsFiles(files);
    const { data: cities } = await db.cities.list({ take: 100 });
    const payload = normalizeGtfsToImport(raw, cities, { sourceName: 'GTFS تجريبي' });
    const summary = await db.importData(payload);
    expect(summary.stopsCreated).toBe(3); // سوق الجملة، مستشفى الحميات، منطقة الأحرار
    expect(summary.stopsLinked).toBe(1); // الموقف العمومي موجود بالفعل
    expect(summary.routesCreated).toBe(1);
  });

  it('adds the imported route to the public listing with relations', async () => {
    const { data, total } = await db.routes.list({});
    expect(total).toBe(10);
    const imported = data.find((r) => r.externalId === 'R10');
    expect(imported).toBeDefined();
    expect(imported!.nameAr).toBe('خط الأحرار');
    expect(imported!.fare).toBe(4.5);
    expect(imported!.stops).toHaveLength(4);
    // First stop is linked to the existing seeded stop (not duplicated).
    expect(imported!.stops![0].stopId).toBe('ZG-MAWQIF');
  });

  it('includes the imported route in trip planning', async () => {
    const [stops, routes] = await Promise.all([db.stops.all(), db.routes.activeDetailed()]);
    expect(stops.length).toBe(24); // 21 seeded + 3 new
    expect(routes.some((r) => r.id === 'route-ext-r10')).toBe(true);
  });

  it('is idempotent when re-imported', async () => {
    const files = await readGtfsDir(sampleDir);
    const raw = parseGtfsFiles(files);
    const { data: cities } = await db.cities.list({ take: 100 });
    const summary = await db.importData(normalizeGtfsToImport(raw, cities, { sourceName: 'GTFS تجريبي' }));

    expect(summary.stopsCreated).toBe(0);
    expect(summary.stopsLinked).toBe(4);
    expect(summary.routesCreated).toBe(0);
    expect(summary.routesUpdated).toBe(1);

    const { total } = await db.routes.list({});
    expect(total).toBe(10); // no duplicates
  });

  it('records the data source and change log', async () => {
    const sources = await db.dataSources.list();
    const src = sources.find((s) => s.name === 'GTFS تجريبي');
    expect(src).toBeDefined();
    expect(src!.syncStatus).toBe('SUCCESS');

    const updates = await db.dataUpdates.recent(5);
    expect(updates.some((u) => u.changeType === 'ROUTE_CREATED' && u.route?.nameAr === 'خط الأحرار')).toBe(
      true,
    );
  });
});

describe('POST /api/admin/import/gtfs', () => {
  let app: Express;
  let token = '';
  let files: Record<string, string>;

  beforeAll(async () => {
    app = createApp(new MemoryDatabase());
    const login = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@mowaslaty.com', password: 'admin123' });
    token = login.body.token;

    const names = ['agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'fare_attributes.txt', 'fare_rules.txt'];
    files = {};
    for (const n of names) {
      files[n] = await fs.readFile(path.join(sampleDir, n), 'utf-8');
    }
  });

  it('requires auth', async () => {
    const res = await request(app).post('/api/admin/import/gtfs').send({ sourceName: 'x' });
    expect(res.status).toBe(401);
  });

  it('imports the uploaded feed', async () => {
    const res = await request(app)
      .post('/api/admin/import/gtfs')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceName: 'GTFS تجريبي', sourceType: 'GTFS', files });
    expect(res.status).toBe(200);
    expect(res.body.stopsCreated).toBe(3);
    expect(res.body.stopsLinked).toBe(1);
    expect(res.body.routesCreated).toBe(1);

    const listing = await request(app).get('/api/routes?searchQuery=الأحرار');
    expect(listing.body.data).toHaveLength(1);
    expect(listing.body.data[0].nameAr).toBe('خط الأحرار');
  });

  it('validates required files', async () => {
    const res = await request(app)
      .post('/api/admin/import/gtfs')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceName: 'ناقص', files: { 'stops.txt': files['stops.txt'] } });
    expect(res.status).toBe(400);
  });
});
