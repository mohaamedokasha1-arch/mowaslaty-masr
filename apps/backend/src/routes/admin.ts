import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  CONFIDENCE_LEVELS,
  FARE_TYPES,
  REPORT_STATUSES,
  ROUTE_STATUSES,
  STOP_TYPES,
} from '@mowaslaty/shared';
import type { Database } from '../db/types.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../middleware/error-handler.js';

const reportStatusSchema = z.object({
  status: z.enum(REPORT_STATUSES),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  reviewNotes: z.string().max(2000).optional(),
});

const routePatchSchema = z.object({
  status: z.enum(ROUTE_STATUSES).optional(),
  fare: z.number().nonnegative().nullable().optional(),
  fareType: z.enum(FARE_TYPES).optional(),
  operatingHours: z.string().max(120).nullable().optional(),
  confidenceLevel: z.enum(CONFIDENCE_LEVELS).optional(),
  description: z.string().max(2000).nullable().optional(),
});

const stopPatchSchema = z.object({
  verified: z.boolean().optional(),
  name: z.string().min(1).optional(),
  nameAr: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  type: z.enum(STOP_TYPES).optional(),
});

const stopCreateSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  type: z.enum(STOP_TYPES).default('BUS'),
  cityId: z.string().min(1),
  address: z.string().optional(),
});

export function adminRouter(db: Database): Router {
  const router = Router();

  // Every admin endpoint requires a valid JWT issued to an admin role.
  router.use(requireAuth, requireAdmin);

  const audit = (
    req: Request,
    action: string,
    resourceType: string,
    resourceId: string,
    changes?: unknown,
  ) =>
    db.audit
      .create({
        userId: req.user!.id,
        userEmail: req.user!.email,
        action,
        resourceType,
        resourceId,
        changes,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
      .catch(() => undefined);

  // GET /api/admin/dashboard — aggregate stats + recent activity
  router.get('/dashboard', async (req, res, next) => {
    try {
      const [stats, recentUpdates, recentReports, dataSources] = await Promise.all([
        db.stats.dashboard(),
        db.dataUpdates.recent(10),
        db.reports.list({ take: 5 }),
        db.dataSources.list(),
      ]);
      res.json({ stats, recentUpdates, recentReports, dataSources });
      void req;
    } catch (error) {
      next(error);
    }
  });

  // ---------- Reports moderation ----------

  router.get('/reports', async (req, res, next) => {
    try {
      const status = req.query.status ? z.enum(REPORT_STATUSES).parse(req.query.status) : undefined;
      const reports = await db.reports.list({ status, take: 50 });
      const pending = await db.reports.count('PENDING');
      res.json({ data: reports, pending });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/reports/:id', async (req, res, next) => {
    try {
      const patch = reportStatusSchema.parse(req.body);
      const existing = await db.reports.byId(req.params.id);
      if (!existing) throw notFound('Report not found');
      const updated = await db.reports.update(req.params.id, patch);
      await audit(req, 'report.update', 'report', req.params.id, patch);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // ---------- Routes management ----------

  router.get('/routes', async (req, res, next) => {
    try {
      const status = req.query.status
        ? z.enum([...ROUTE_STATUSES, 'ALL'] as [string, ...string[]]).parse(req.query.status)
        : 'ALL';
      const { data, total } = await db.routes.list({
        status: status as never,
        take: 100,
        search: typeof req.query.searchQuery === 'string' ? req.query.searchQuery : undefined,
      });
      res.json({ data, total });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/routes/:id', async (req, res, next) => {
    try {
      const patch = routePatchSchema.parse(req.body);
      if (Object.keys(patch).length === 0) throw badRequest('No fields to update');
      const existing = await db.routes.byId(req.params.id);
      if (!existing) throw notFound('Route not found');

      const updated = await db.routes.update(req.params.id, patch);

      // Record the change in the data-updates log.
      let changeType: 'FARE_CHANGED' | 'HOURS_CHANGED' | 'STATUS_CHANGED' | 'ROUTE_MODIFIED' =
        'ROUTE_MODIFIED';
      if (patch.fare !== undefined || patch.fareType !== undefined) changeType = 'FARE_CHANGED';
      else if (patch.operatingHours !== undefined) changeType = 'HOURS_CHANGED';
      else if (patch.status !== undefined) changeType = 'STATUS_CHANGED';

      const description =
        patch.fare !== undefined
          ? `تحديث أجرة الخط "${existing.nameAr}" إلى ${patch.fare ?? 'غير محددة'} جنيه`
          : `تعديل بيانات الخط "${existing.nameAr}"`;

      await Promise.all([
        db.dataUpdates.create({ routeId: req.params.id, changeType, description }),
        audit(req, 'route.update', 'route', req.params.id, patch),
      ]);

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // ---------- Stops management ----------

  router.get('/stops', async (req, res, next) => {
    try {
      const { data, total } = await db.stops.list({
        cityId: typeof req.query.cityId === 'string' ? req.query.cityId : undefined,
        search: typeof req.query.searchQuery === 'string' ? req.query.searchQuery : undefined,
        take: 100,
      });
      res.json({ data, total });
    } catch (error) {
      next(error);
    }
  });

  router.post('/stops', async (req, res, next) => {
    try {
      const input = stopCreateSchema.parse(req.body);
      const city = await db.cities.byId(input.cityId);
      if (!city) throw notFound('City not found');
      const stop = await db.stops.create({ ...input, address: input.address ?? null, verified: false });
      await audit(req, 'stop.create', 'stop', stop.id, input);
      res.status(201).json(stop);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/stops/:id', async (req, res, next) => {
    try {
      const patch = stopPatchSchema.parse(req.body);
      if (Object.keys(patch).length === 0) throw badRequest('No fields to update');
      const existing = await db.stops.byId(req.params.id);
      if (!existing) throw notFound('Stop not found');
      const updated = await db.stops.update(req.params.id, patch);
      await audit(req, patch.verified !== undefined ? 'stop.verify' : 'stop.update', 'stop', req.params.id, patch);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // ---------- Reference data ----------

  router.get('/sources', async (_req, res, next) => {
    try {
      res.json({ data: await db.dataSources.list() });
    } catch (error) {
      next(error);
    }
  });

  router.get('/audit', async (req, res, next) => {
    try {
      const take = z.coerce.number().int().positive().max(100).default(20).parse(req.query.take ?? 20);
      res.json({ data: await db.audit.recent(take) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/cities', async (_req, res, next) => {
    try {
      const { data } = await db.cities.list({ take: 100 });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
