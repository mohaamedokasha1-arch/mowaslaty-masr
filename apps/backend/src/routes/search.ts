import { Router } from 'express';
import { z } from 'zod';
import type { Database } from '../db/types.js';

const searchSchema = z.object({
  query: z.string().min(1),
  type: z.enum(['all', 'routes', 'stops', 'cities']).default('all'),
  limit: z.coerce.number().int().positive().max(25).default(10),
});

export function searchRouter(db: Database): Router {
  const router = Router();

  // GET /api/search?query=...&type=all|routes|stops|cities
  router.get('/', async (req, res, next) => {
    try {
      const { query, type, limit } = searchSchema.parse(req.query);
      const results: {
        routes?: unknown[];
        stops?: unknown[];
        cities?: unknown[];
      } = {};

      const [routesRes, stopsRes, citiesRes] = await Promise.all([
        ['all', 'routes'].includes(type)
          ? db.routes.list({ search: query, take: limit })
          : Promise.resolve(null),
        ['all', 'stops'].includes(type)
          ? db.stops.list({ search: query, take: limit })
          : Promise.resolve(null),
        ['all', 'cities'].includes(type)
          ? db.cities.list({ search: query, take: limit })
          : Promise.resolve(null),
      ]);

      if (routesRes)
        results.routes = routesRes.data.map((r) => ({
          id: r.id,
          name: r.name,
          nameAr: r.nameAr,
          fare: r.fare,
          status: r.status,
          city: r.city?.nameAr,
          mode: r.transportMode ? { nameAr: r.transportMode.nameAr, icon: r.transportMode.icon } : null,
        }));
      if (stopsRes)
        results.stops = stopsRes.data.map((s) => ({
          id: s.id,
          name: s.name,
          nameAr: s.nameAr,
          address: s.address,
          city: s.city?.nameAr,
          latitude: s.latitude,
          longitude: s.longitude,
        }));
      if (citiesRes)
        results.cities = citiesRes.data.map((c) => ({
          id: c.id,
          name: c.name,
          nameAr: c.nameAr,
        }));

      res.json({ query, results });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
