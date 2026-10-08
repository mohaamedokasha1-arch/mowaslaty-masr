import { Router } from 'express';
import { z } from 'zod';
import { ROUTE_STATUSES } from '@mowaslaty/shared';
import type { Database } from '../db/types.js';
import { notFound } from '../middleware/error-handler.js';

const listSchema = z.object({
  cityId: z.string().optional(),
  transportMode: z.string().optional(),
  status: z.enum([...ROUTE_STATUSES, 'ALL']).optional(),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(20),
  searchQuery: z.string().optional(),
});

export function routesRouter(db: Database): Router {
  const router = Router();

  // GET /api/routes — list routes (filters: cityId, transportMode, status, searchQuery)
  router.get('/', async (req, res, next) => {
    try {
      const params = listSchema.parse(req.query);
      const { data, total } = await db.routes.list({
        cityId: params.cityId,
        modeName: params.transportMode,
        status: params.status,
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

  // GET /api/routes/:id — route details with ordered stops
  router.get('/:id', async (req, res, next) => {
    try {
      const route = await db.routes.byId(req.params.id);
      if (!route) throw notFound('Route not found');
      res.json(route);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
