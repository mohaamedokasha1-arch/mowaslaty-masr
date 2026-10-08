import { Router } from 'express';
import { z } from 'zod';
import type { Database } from '../db/types.js';
import { notFound } from '../middleware/error-handler.js';

const listSchema = z.object({
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(20),
  searchQuery: z.string().optional(),
});

export function citiesRouter(db: Database): Router {
  const router = Router();

  // GET /api/cities — list cities with route/stop/area counts
  router.get('/', async (req, res, next) => {
    try {
      const params = listSchema.parse(req.query);
      const { data, total } = await db.cities.list({
        skip: params.skip,
        take: params.take,
        search: params.searchQuery,
      });
      res.json({
        data,
        pagination: {
          skip: params.skip,
          take: params.take,
          total,
          pages: Math.ceil(total / params.take),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/cities/:id — city details + areas
  router.get('/:id', async (req, res, next) => {
    try {
      const city = await db.cities.byId(req.params.id);
      if (!city) throw notFound('City not found');
      const areas = await db.areas.byCity(city.id);
      res.json({ ...city, areas });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
