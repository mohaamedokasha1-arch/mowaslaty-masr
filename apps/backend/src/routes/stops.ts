import { Router } from 'express';
import { z } from 'zod';
import type { Database } from '../db/types.js';
import { notFound } from '../middleware/error-handler.js';

const listSchema = z.object({
  cityId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(50_000).default(2000),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(20),
  searchQuery: z.string().optional(),
});

export function stopsRouter(db: Database): Router {
  const router = Router();

  // GET /api/stops — list stops; supports geolocation radius search
  router.get('/', async (req, res, next) => {
    try {
      const params = listSchema.parse(req.query);

      if (params.lat != null && params.lng != null) {
        const data = await db.stops.nearby(params.lat, params.lng, params.radius, params.take);
        return res.json({
          data,
          pagination: { skip: 0, take: params.take, total: data.length, pages: 1 },
        });
      }

      const { data, total } = await db.stops.list({
        cityId: params.cityId,
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

  // GET /api/stops/:id — stop details + routes passing through it
  router.get('/:id', async (req, res, next) => {
    try {
      const stop = await db.stops.byId(req.params.id);
      if (!stop) throw notFound('Stop not found');
      res.json(stop);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
