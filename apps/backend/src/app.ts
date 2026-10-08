import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './utils/env.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import type { Database } from './db/types.js';

import { authRouter } from './routes/auth.js';
import { citiesRouter } from './routes/cities.js';
import { healthRouter } from './routes/health.js';
import { modesRouter } from './routes/modes.js';
import { reportsRouter } from './routes/reports.js';
import { routesRouter } from './routes/routes.js';
import { searchRouter } from './routes/search.js';
import { stopsRouter } from './routes/stops.js';
import { tripsRouter } from './routes/trips.js';
import { adminRouter } from './routes/admin.js';

export function createApp(db: Database): express.Express {
  const app = express();

  // ============= Middleware =============
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
      credentials: true,
    }),
  );

  if (env.NODE_ENV !== 'test') {
    app.use(
      rateLimit({
        windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        max: parseInt(env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests from this IP, please try again later.' },
      }),
    );
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  }

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ============= Routes =============
  app.use('/api/routes', routesRouter(db));
  app.use('/api/stops', stopsRouter(db));
  app.use('/api/cities', citiesRouter(db));
  app.use('/api/modes', modesRouter(db));
  app.use('/api/search', searchRouter(db));
  app.use('/api/trips', tripsRouter(db));
  app.use('/api/reports', reportsRouter(db));
  app.use('/api/health', healthRouter(db));
  app.use('/api/admin/auth', authRouter(db));
  app.use('/api/admin', adminRouter(db));

  app.get('/ping', (_req, res) => {
    res.json({ status: 'ok', driver: db.kind, timestamp: new Date().toISOString() });
  });

  // ============= Error handling =============
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
