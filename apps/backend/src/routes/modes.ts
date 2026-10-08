import { Router } from 'express';
import type { Database } from '../db/types.js';

export function modesRouter(db: Database): Router {
  const router = Router();

  // GET /api/modes — transport modes
  router.get('/', async (_req, res, next) => {
    try {
      res.json({ data: await db.modes.list() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
