import { Router } from 'express';
import type { Database } from '../db/types.js';

export function healthRouter(db: Database): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const database = await db.ping();
    const healthy = database;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'unhealthy',
      driver: db.kind,
      timestamp: new Date().toISOString(),
      checks: {
        database: database ? 'ok' : 'unreachable',
        api: 'ok',
      },
    });
  });

  return router;
}
