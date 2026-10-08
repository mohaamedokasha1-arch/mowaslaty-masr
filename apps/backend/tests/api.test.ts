import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { MemoryDatabase } from '../src/db/memory-db.js';

let app: Express;

beforeAll(() => {
  app = createApp(new MemoryDatabase());
});

describe('basic endpoints', () => {
  it('GET /ping returns ok', async () => {
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.driver).toBe('memory');
  });

  it('GET /api/health reports healthy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.checks.database).toBe('ok');
  });

  it('unknown endpoints return 404 JSON', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('cities & modes', () => {
  it('GET /api/cities lists 4 cities with counts', async () => {
    const res = await request(app).get('/api/cities');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.pagination.total).toBe(4);
    const zagazig = res.body.data.find((c: { name: string }) => c.name === 'Zagazig');
    expect(zagazig._count.stops).toBeGreaterThanOrEqual(10);
    expect(zagazig._count.routes).toBeGreaterThanOrEqual(4);
  });

  it('GET /api/cities supports Arabic search', async () => {
    const res = await request(app).get('/api/cities?searchQuery=القاهرة');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nameAr).toBe('القاهرة');
  });

  it('GET /api/cities/:id includes areas', async () => {
    const res = await request(app).get('/api/cities/city-zagazig');
    expect(res.status).toBe(200);
    expect(res.body.areas.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /api/cities/:id 404 for unknown city', async () => {
    const res = await request(app).get('/api/cities/city-atlantis');
    expect(res.status).toBe(404);
  });

  it('GET /api/modes lists all transport modes', async () => {
    const res = await request(app).get('/api/modes');
    expect(res.body.data.length).toBe(7);
    expect(res.body.data.map((m: { nameAr: string }) => m.nameAr)).toContain('ميكروباص');
  });
});

describe('routes API', () => {
  it('GET /api/routes lists active routes with relations', async () => {
    const res = await request(app).get('/api/routes');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(9);
    const first = res.body.data[0];
    expect(first.transportMode).toBeDefined();
    expect(first.city).toBeDefined();
    expect(Array.isArray(first.stops)).toBe(true);
  });

  it('filters by cityId', async () => {
    const res = await request(app).get('/api/routes?cityId=city-zagazig');
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    for (const r of res.body.data) expect(r.cityId).toBe('city-zagazig');
  });

  it('filters by transportMode nameAr', async () => {
    const res = await request(app).get('/api/routes?transportMode=قطار');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('route-ca-zg');
  });

  it('searches by Arabic query', async () => {
    const res = await request(app).get('/api/routes?searchQuery=الإسماعيلية');
    const ids = res.body.data.map((r: { id: string }) => r.id);
    expect(ids).toContain('route-zg-ism');
  });

  it('GET /api/routes/:id returns ordered stops', async () => {
    const res = await request(app).get('/api/routes/route-zg-01');
    expect(res.status).toBe(200);
    expect(res.body.fare).toBe(5);
    expect(res.body.stops.map((s: { stopId: string }) => s.stopId)[0]).toBe('ZG-STATION');
    const orders = res.body.stops.map((s: { order: number }) => s.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('rejects invalid pagination params', async () => {
    const res = await request(app).get('/api/routes?take=-5');
    expect(res.status).toBe(400);
  });
});

describe('stops API', () => {
  it('GET /api/stops/:id returns stop with passing routes', async () => {
    const res = await request(app).get('/api/stops/ZG-STATION');
    expect(res.status).toBe(200);
    expect(res.body.nameAr).toBe('ميدان المحطة (القطار)');
    expect(res.body.routes.length).toBeGreaterThanOrEqual(3);
  });

  it('supports geolocation radius search', async () => {
    const res = await request(app).get(
      '/api/stops?lat=30.5815&lng=31.9455&radius=600',
    );
    const ids = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain('ZG-TAHRIR');
    expect(ids).toContain('ZG-SAGHA');
    expect(ids).not.toContain('ZG-UNIV');
    // sorted by distance
    const distances = res.body.data.map((s: { distanceM: number }) => s.distanceM);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });
});

describe('search API', () => {
  it('searches across routes, stops and cities', async () => {
    const res = await request(app).get('/api/search?query=جامعة');
    expect(res.status).toBe(200);
    expect(res.body.results.routes.length).toBeGreaterThan(0);
    expect(res.body.results.stops.length).toBeGreaterThan(0);
  });

  it('validates query param', async () => {
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(400);
  });
});

describe('trip planning API', () => {
  it('plans a trip by place names', async () => {
    const res = await request(app).get(
      '/api/trips/plan?fromText=ميدان التحرير&toText=جامعة الزقازيق&mode=FASTEST',
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.trips.length).toBeGreaterThan(0);
    expect(res.body.resolvedFrom.nameAr).toContain('التحرير');
    expect(res.body.resolvedTo.nameAr).toContain('جامعة الزقازيق');
  });

  it('plans a trip by coordinates', async () => {
    const res = await request(app).get(
      '/api/trips/plan?fromLat=30.578&fromLng=31.939&toLat=30.5945&toLng=31.9585&mode=CHEAPEST',
    );
    expect(res.status).toBe(200);
    expect(res.body.trips.length).toBeGreaterThan(0);
  });

  it('returns suggestions for unknown places', async () => {
    const res = await request(app).get(
      '/api/trips/plan?fromText=مدينة الأشباح&toText=جامعة الزقازيق',
    );
    expect(res.status).toBe(422);
    expect(res.body.ok).toBe(false);
    expect(res.body.messageAr).toBeDefined();
    expect(res.body.suggestions.length).toBeGreaterThan(0);
  });

  it('rejects missing endpoints', async () => {
    const res = await request(app).get('/api/trips/plan?toText=الزقازيق');
    expect(res.status).toBe(400);
  });
});

describe('community reports', () => {
  it('creates a report (anonymous)', async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({
        reportType: 'FARE_INCORRECT',
        routeId: 'route-zg-01',
        description: 'الأجرة الفعلية أعلى من المسجلة في التطبيق',
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.id).toBeDefined();
  });

  it('rejects short descriptions', async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({ reportType: 'OTHER', description: 'قصير' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown report types', async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({ reportType: 'NOT_A_TYPE', description: 'وصف طويل كفاية للاختبار' });
    expect(res.status).toBe(400);
  });

  it('fetches a created report by id', async () => {
    const created = await request(app)
      .post('/api/reports')
      .send({ reportType: 'OTHER', description: 'بلاغ تجريبي لاختبار الجلب بالمعرف' });
    const res = await request(app).get(`/api/reports/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('بلاغ تجريبي لاختبار الجلب بالمعرف');
  });
});

describe('admin API & auth', () => {
  let token = '';

  it('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@mowaslaty.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in with seeded admin credentials', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@mowaslaty.com', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('SUPER_ADMIN');
    token = res.body.token;
  });

  it('protects admin endpoints without token', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns dashboard stats with token', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.routes).toBe(9);
    expect(res.body.stats.cities).toBe(4);
    expect(res.body.stats.pendingReports).toBeGreaterThanOrEqual(2);
    expect(res.body.recentUpdates.length).toBeGreaterThan(0);
  });

  it('moderates a report', async () => {
    const res = await request(app)
      .patch('/api/admin/reports/report-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'APPROVED', reviewNotes: 'تم التحقق ميدانيًا' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');

    const list = await request(app)
      .get('/api/admin/reports?status=PENDING')
      .set('Authorization', `Bearer ${token}`);
    const ids = list.body.data.map((r: { id: string }) => r.id);
    expect(ids).not.toContain('report-1');
  });

  it('updates a route fare and records a data update', async () => {
    const res = await request(app)
      .patch('/api/admin/routes/route-zg-04')
      .set('Authorization', `Bearer ${token}`)
      .send({ fare: 6, confidenceLevel: 'MEDIUM' });
    expect(res.status).toBe(200);
    expect(res.body.fare).toBe(6);

    const dash = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);
    const latest = dash.body.recentUpdates[0];
    expect(latest.routeId).toBe('route-zg-04');
    expect(latest.changeType).toBe('FARE_CHANGED');
  });

  it('verifies a stop', async () => {
    const res = await request(app)
      .patch('/api/admin/stops/ZG-QAWMEYA')
      .set('Authorization', `Bearer ${token}`)
      .send({ verified: true });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.verifiedAt).toBeTruthy();
  });

  it('creates a stop', async () => {
    const res = await request(app)
      .post('/api/admin/stops')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Test Stop',
        nameAr: 'محطة تجريبية جديدة',
        latitude: 30.58,
        longitude: 31.94,
        cityId: 'city-zagazig',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('records audit log entries', async () => {
    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const actions = res.body.data.map((a: { action: string }) => a.action);
    expect(actions).toContain('report.update');
    expect(actions).toContain('route.update');
    expect(actions).toContain('auth.login');
  });
});
