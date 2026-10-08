import { Router } from 'express';
import { z } from 'zod';
import { REPORT_TYPES } from '@mowaslaty/shared';
import type { Database } from '../db/types.js';
import { notFound } from '../middleware/error-handler.js';

const createSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  routeId: z.string().optional(),
  stopId: z.string().optional(),
  description: z.string().min(10, 'الوصف يجب ألا يقل عن 10 أحرف'),
  details: z.record(z.unknown()).optional(),
});

export function reportsRouter(db: Database): Router {
  const router = Router();

  // POST /api/reports — submit a community report (anonymous allowed)
  router.post('/', async (req, res, next) => {
    try {
      const data = createSchema.parse(req.body);
      // Validate referenced route/stop when provided.
      if (data.routeId && !(await db.routes.byId(data.routeId))) {
        throw notFound('Route not found');
      }
      if (data.stopId && !(await db.stops.byId(data.stopId))) {
        throw notFound('Stop not found');
      }
      const report = await db.reports.create({
        userId: req.user?.id ?? null,
        reportType: data.reportType,
        routeId: data.routeId,
        stopId: data.stopId,
        description: data.description,
        details: data.details,
      });
      res.status(201).json(report);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/reports/:id — report status lookup
  router.get('/:id', async (req, res, next) => {
    try {
      const report = await db.reports.byId(req.params.id);
      if (!report) throw notFound('Report not found');
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
