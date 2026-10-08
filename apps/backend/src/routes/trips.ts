import { Router } from 'express';
import { z } from 'zod';
import { SEARCH_MODES } from '@mowaslaty/shared';
import type { Database } from '../db/types.js';
import { planTrip } from '../services/trip-planner.js';

const planSchema = z
  .object({
    fromText: z.string().min(1).optional(),
    toText: z.string().min(1).optional(),
    fromLat: z.coerce.number().min(-90).max(90).optional(),
    fromLng: z.coerce.number().min(-180).max(180).optional(),
    toLat: z.coerce.number().min(-90).max(90).optional(),
    toLng: z.coerce.number().min(-180).max(180).optional(),
    mode: z.enum(SEARCH_MODES).default('FASTEST'),
  })
  .refine((v) => v.fromText || (v.fromLat != null && v.fromLng != null), {
    message: 'fromText or fromLat+fromLng is required',
    path: ['fromText'],
  })
  .refine((v) => v.toText || (v.toLat != null && v.toLng != null), {
    message: 'toText or toLat+toLng is required',
    path: ['toText'],
  });

export function tripsRouter(db: Database): Router {
  const router = Router();

  // GET /api/trips/plan — multimodal trip planning
  router.get('/plan', async (req, res, next) => {
    try {
      const input = planSchema.parse(req.query);
      const result = await planTrip(db, input);
      res.status(result.ok || result.trips.length > 0 ? 200 : result.resolvedFrom && result.resolvedTo ? 200 : 422).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
