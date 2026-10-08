/**
 * Prisma (PostgreSQL) implementation of the Database interface.
 *
 * This module is loaded lazily, only when DB_DRIVER=prisma (or DATABASE_URL is
 * set). It requires `npx prisma generate` to have been run (which needs access
 * to Prisma's engine CDN), so it is deliberately kept out of the default
 * in-memory path used for local development and CI.
 */
import { v4 as uuidv4 } from 'uuid';
import type {
  CityDto,
  DataUpdateDto,
  ReportDto,
  ReportStatus,
  RouteDto,
  StopDto,
  TransportModeDto,
} from '@mowaslaty/shared';
import type {
  AuditLogRow,
  DashboardStats,
  Database,
  DataSourceRow,
  PageOpts,
  RouteListOpts,
  StopWithRoutes,
  UserRow,
} from './types.js';

/* The Prisma client must be generated (`npx prisma generate`) before use.
 * We type it loosely here so this module compiles in environments where the
 * client has not been generated yet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export class PrismaDatabase implements Database {
  readonly kind = 'prisma' as const;

  constructor(private prisma: AnyClient) {}

  static async connect(): Promise<PrismaDatabase> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('@prisma/client');
    const prisma = new mod.PrismaClient();
    await prisma.$connect();
    return new PrismaDatabase(prisma);
  }

  async ping(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private mapCity(c: AnyClient): CityDto {
    return {
      id: c.id,
      name: c.name,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      latitude: c.latitude,
      longitude: c.longitude,
      description: c.description,
    };
  }

  private mapMode(m: AnyClient): TransportModeDto {
    return { id: m.id, name: m.name, nameAr: m.nameAr, icon: m.icon, color: m.color, description: m.description };
  }

  private mapStop(s: AnyClient): StopDto {
    return {
      id: s.id,
      name: s.name,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      latitude: s.latitude,
      longitude: s.longitude,
      address: s.address,
      type: s.type,
      cityId: s.cityId,
      areaId: s.areaId,
      verified: s.verified,
      verifiedAt: iso(s.verifiedAt),
      ...(s.city ? { city: this.mapCity(s.city) } : {}),
      ...(s.area ? { area: { id: s.area.id, name: s.area.name, nameAr: s.area.nameAr, cityId: s.area.cityId } } : {}),
    };
  }

  private mapRoute(r: AnyClient): RouteDto {
    return {
      id: r.id,
      name: r.name,
      nameAr: r.nameAr,
      nameEn: r.nameEn,
      description: r.description,
      transportModeId: r.transportModeId,
      cityId: r.cityId,
      fare: r.fare,
      fareType: r.fareType,
      fareCurrency: r.fareCurrency,
      fareUpdatedAt: iso(r.fareUpdatedAt),
      fareSource: r.fareSource,
      status: r.status,
      operatingHours: r.operatingHours,
      lastVerifiedAt: iso(r.lastVerifiedAt),
      confidenceLevel: r.confidenceLevel,
      dataSource: r.dataSource,
      dataSourceUrl: r.dataSourceUrl,
      createdAt: iso(r.createdAt) ?? undefined,
      updatedAt: iso(r.updatedAt) ?? undefined,
      ...(r.transportMode ? { transportMode: this.mapMode(r.transportMode) } : {}),
      ...(r.city ? { city: this.mapCity(r.city) } : {}),
      ...(r.stops
        ? {
            stops: [...r.stops]
              .sort((a: AnyClient, b: AnyClient) => a.order - b.order)
              .map((rs: AnyClient) => ({
                id: rs.id,
                routeId: rs.routeId,
                stopId: rs.stopId,
                order: rs.order,
                ...(rs.stop ? { stop: this.mapStop(rs.stop) } : {}),
              })),
          }
        : {}),
    };
  }

  private mapReport(r: AnyClient): ReportDto {
    return {
      id: r.id,
      userId: r.userId,
      reportType: r.reportType,
      routeId: r.routeId,
      stopId: r.stopId,
      description: r.description,
      status: r.status,
      priority: r.priority,
      reviewNotes: r.reviewNotes,
      createdAt: iso(r.createdAt) ?? '',
      updatedAt: iso(r.updatedAt) ?? undefined,
      route: r.route ? this.mapRoute(r.route) : null,
      stop: r.stop ? this.mapStop(r.stop) : null,
      user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email } : null,
    };
  }

  cities: Database['cities'] = {
    list: async (opts: PageOpts = {}) => {
      const where = opts.search
        ? { OR: [{ name: { contains: opts.search, mode: 'insensitive' } }, { nameAr: { contains: opts.search } }] }
        : {};
      const [rows, total] = await Promise.all([
        this.prisma.city.findMany({
          where,
          include: { _count: { select: { routes: true, stops: true, areas: true } } },
          skip: opts.skip ?? 0,
          take: opts.take ?? 20,
          orderBy: { name: 'asc' },
        }),
        this.prisma.city.count({ where }),
      ]);
      return { data: rows.map((c: AnyClient) => this.mapCity(c)) as CityDto[], total };
    },
    byId: async (id: string) => {
      const c = await this.prisma.city.findUnique({
        where: { id },
        include: { _count: { select: { routes: true, stops: true, areas: true } } },
      });
      return c ? this.mapCity(c) : null;
    },
  };

  areas: Database['areas'] = {
    byCity: async (cityId: string) => {
      const rows = await this.prisma.area.findMany({ where: { cityId } });
      return rows.map((a: AnyClient) => ({ id: a.id, name: a.name, nameAr: a.nameAr, cityId: a.cityId }));
    },
  };

  modes: Database['modes'] = {
    list: async () => (await this.prisma.transportMode.findMany()).map((m: AnyClient) => this.mapMode(m)),
    byId: async (id: string) => {
      const m = await this.prisma.transportMode.findUnique({ where: { id } });
      return m ? this.mapMode(m) : null;
    },
  };

  stops: Database['stops'] = {
    list: async (opts: PageOpts & { cityId?: string } = {}) => {
      const where: AnyClient = {};
      if (opts.cityId) where.cityId = opts.cityId;
      if (opts.search)
        where.OR = [
          { name: { contains: opts.search, mode: 'insensitive' } },
          { nameAr: { contains: opts.search } },
          { address: { contains: opts.search, mode: 'insensitive' } },
        ];
      const [rows, total] = await Promise.all([
        this.prisma.stop.findMany({
          where,
          include: { city: true },
          skip: opts.skip ?? 0,
          take: opts.take ?? 20,
        }),
        this.prisma.stop.count({ where }),
      ]);
      return { data: rows.map((s: AnyClient) => this.mapStop(s)), total };
    },

    byId: async (id: string): Promise<StopWithRoutes | null> => {
      const s = await this.prisma.stop.findUnique({
        where: { id },
        include: { city: true, area: true, routeStops: { include: { route: { include: { transportMode: true } } } } },
      });
      if (!s) return null;
      const base = this.mapStop(s);
      return {
        ...base,
        routes: s.routeStops.map((rs: AnyClient) => ({
          id: rs.route.id,
          name: rs.route.name,
          nameAr: rs.route.nameAr,
          fare: rs.route.fare,
          status: rs.route.status,
          transportMode: rs.route.transportMode ? this.mapMode(rs.route.transportMode) : undefined,
        })),
      };
    },

    nearby: async (lat: number, lng: number, radiusM: number, limit = 20) => {
      // Bounding-box pre-filter in SQL, exact haversine in JS.
      const dLat = radiusM / 111_320;
      const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
      const rows = await this.prisma.stop.findMany({
        where: {
          latitude: { gte: lat - dLat, lte: lat + dLat },
          longitude: { gte: lng - dLng, lte: lng + dLng },
        },
      });
      const withDist = rows
        .map((s: AnyClient) => {
          const stop = this.mapStop(s);
          const dist =
            6371000 *
            2 *
            Math.asin(
              Math.sqrt(
                Math.sin(((stop.latitude - lat) * Math.PI) / 360) ** 2 +
                  Math.cos((lat * Math.PI) / 180) *
                    Math.cos((stop.latitude * Math.PI) / 180) *
                    Math.sin(((stop.longitude - lng) * Math.PI) / 360) ** 2,
              ),
            );
          return { ...stop, distanceM: dist };
        })
        .filter((s: StopDto & { distanceM: number }) => s.distanceM <= radiusM)
        .sort((a: { distanceM: number }, b: { distanceM: number }) => a.distanceM - b.distanceM);
      return withDist.slice(0, limit);
    },

    all: async () => (await this.prisma.stop.findMany()).map((s: AnyClient) => this.mapStop(s)),

    create: async (input) => {
      const created = await this.prisma.stop.create({
        data: {
          name: input.name,
          nameAr: input.nameAr,
          nameEn: input.nameEn ?? null,
          latitude: input.latitude,
          longitude: input.longitude,
          address: input.address ?? null,
          type: input.type,
          cityId: input.cityId,
          areaId: input.areaId ?? null,
          verified: input.verified ?? false,
        },
      });
      return this.mapStop(created);
    },

    update: async (id, patch) => {
      const data: AnyClient = { ...patch };
      if (patch.verified === true) data.verifiedAt = new Date();
      const updated = await this.prisma.stop.update({ where: { id }, data });
      return this.mapStop(updated);
    },
  };

  routes: Database['routes'] = {
    list: async (opts: RouteListOpts = {}) => {
      const where: AnyClient = {};
      if (opts.status && opts.status !== 'ALL') where.status = opts.status;
      if (!opts.status) where.status = 'ACTIVE';
      if (opts.cityId) where.cityId = opts.cityId;
      if (opts.modeName)
        where.transportMode = { OR: [{ name: opts.modeName }, { nameAr: opts.modeName }] };
      if (opts.search)
        where.OR = [
          { name: { contains: opts.search, mode: 'insensitive' } },
          { nameAr: { contains: opts.search } },
        ];
      const include = {
        transportMode: true,
        city: true,
        stops: { include: { stop: true }, orderBy: { order: 'asc' } },
      };
      const [rows, total] = await Promise.all([
        this.prisma.route.findMany({
          where,
          include,
          skip: opts.skip ?? 0,
          take: opts.take ?? 20,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.route.count({ where }),
      ]);
      return { data: rows.map((r: AnyClient) => this.mapRoute(r)), total };
    },

    byId: async (id: string) => {
      const r = await this.prisma.route.findUnique({
        where: { id },
        include: {
          transportMode: true,
          city: true,
          stops: { include: { stop: true }, orderBy: { order: 'asc' } },
        },
      });
      return r ? this.mapRoute(r) : null;
    },

    activeDetailed: async () => {
      const rows = await this.prisma.route.findMany({
        where: { status: 'ACTIVE' },
        include: {
          transportMode: true,
          city: true,
          stops: { include: { stop: true }, orderBy: { order: 'asc' } },
        },
      });
      return rows.map((r: AnyClient) => this.mapRoute(r));
    },

    count: async () => this.prisma.route.count(),

    update: async (id, patch) => {
      const data: AnyClient = { ...patch };
      if (patch.fare !== undefined) data.fareUpdatedAt = new Date();
      const updated = await this.prisma.route.update({ where: { id }, data });
      return this.mapRoute(updated);
    },
  };

  reports: Database['reports'] = {
    create: async (input) => {
      const created = await this.prisma.transitReport.create({
        data: {
          userId: input.userId ?? null,
          reportType: input.reportType,
          routeId: input.routeId ?? null,
          stopId: input.stopId ?? null,
          description: input.description,
          details: (input.details ?? undefined) as AnyClient,
        },
        include: { route: true, stop: true },
      });
      return this.mapReport(created);
    },

    byId: async (id: string) => {
      const r = await this.prisma.transitReport.findUnique({
        where: { id },
        include: { route: true, stop: true, user: { select: { id: true, name: true, email: true } } },
      });
      return r ? this.mapReport(r) : null;
    },

    list: async (opts = {}) => {
      const rows = await this.prisma.transitReport.findMany({
        where: opts.status ? { status: opts.status } : {},
        include: { route: true, stop: true, user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: opts.skip ?? 0,
        take: opts.take ?? 50,
      });
      return rows.map((r: AnyClient) => this.mapReport(r));
    },

    update: async (id, patch) => {
      const updated = await this.prisma.transitReport.update({
        where: { id },
        data: {
          ...patch,
          reviewedAt: patch.status ? new Date() : undefined,
        },
        include: { route: true, stop: true },
      });
      return this.mapReport(updated);
    },

    count: async (status?: ReportStatus) =>
      this.prisma.transitReport.count(status ? { where: { status } } : undefined),
  };

  dataUpdates: Database['dataUpdates'] = {
    recent: async (take = 10) => {
      const rows = await this.prisma.dataUpdate.findMany({
        include: { route: { select: { id: true, nameAr: true } } },
        orderBy: { createdAt: 'desc' },
        take,
      });
      return rows.map(
        (u: AnyClient): DataUpdateDto => ({
          id: u.id,
          routeId: u.routeId,
          changeType: u.changeType,
          description: u.description,
          createdAt: iso(u.createdAt) ?? '',
          route: u.route ? { id: u.route.id, nameAr: u.route.nameAr } : null,
        }),
      );
    },

    create: async (input) => {
      const created = await this.prisma.dataUpdate.create({
        data: {
          routeId: input.routeId,
          changeType: input.changeType,
          description: input.description,
        },
        include: { route: { select: { id: true, nameAr: true } } },
      });
      return {
        id: created.id,
        routeId: created.routeId,
        changeType: created.changeType,
        description: created.description,
        createdAt: iso(created.createdAt) ?? '',
        route: created.route ? { id: created.route.id, nameAr: created.route.nameAr } : null,
      };
    },

    count: async () => this.prisma.dataUpdate.count(),
  };

  dataSources: Database['dataSources'] = {
    list: async (): Promise<DataSourceRow[]> => {
      const rows = await this.prisma.dataSource.findMany();
      return rows.map((d: AnyClient) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        sourceType: d.sourceType,
        url: d.url,
        lastSyncedAt: iso(d.lastSyncedAt),
        syncStatus: d.syncStatus,
      }));
    },
  };

  users: Database['users'] = {
    byEmail: async (email: string): Promise<UserRow | null> => {
      const u = await this.prisma.user.findUnique({ where: { email } });
      if (!u) return null;
      return { id: u.id, email: u.email, password: u.password, name: u.name, role: u.role, createdAt: iso(u.createdAt) ?? '' };
    },
    create: async (input): Promise<UserRow> => {
      const u = await this.prisma.user.create({
        data: { email: input.email, password: input.password, name: input.name, role: input.role },
      });
      return { id: u.id, email: u.email, password: u.password, name: u.name, role: u.role, createdAt: iso(u.createdAt) ?? '' };
    },
  };

  audit: Database['audit'] = {
    create: async (entry: Omit<AuditLogRow, 'id' | 'createdAt'>) => {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          changes: (entry.changes ?? undefined) as AnyClient,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    },
    recent: async (take = 20): Promise<AuditLogRow[]> => {
      const rows = await this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        include: { user: { select: { email: true } } },
      });
      return rows.map((a: AnyClient) => ({
        id: a.id,
        userId: a.userId,
        userEmail: a.user?.email ?? null,
        action: a.action,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        changes: a.changes,
        ipAddress: a.ipAddress,
        userAgent: a.userAgent,
        createdAt: iso(a.createdAt) ?? '',
      }));
    },
  };

  searchHistory: Database['searchHistory'] = {
    record: async (entry) => {
      await this.prisma.searchHistory.create({
        data: {
          fromAddress: entry.fromAddress ?? null,
          toAddress: entry.toAddress ?? null,
          fromLat: entry.fromLat ?? null,
          fromLng: entry.fromLng ?? null,
          toLat: entry.toLat ?? null,
          toLng: entry.toLng ?? null,
          searchMode: entry.searchMode,
          resultCount: entry.resultCount,
        },
      });
    },
    count: async () => this.prisma.searchHistory.count(),
  };

  stats: Database['stats'] = {
    dashboard: async (): Promise<DashboardStats> => {
      const [routes, activeRoutes, stops, verifiedStops, cities, reports, pendingReports, dataUpdates, searches] =
        await Promise.all([
          this.prisma.route.count(),
          this.prisma.route.count({ where: { status: 'ACTIVE' } }),
          this.prisma.stop.count(),
          this.prisma.stop.count({ where: { verified: true } }),
          this.prisma.city.count(),
          this.prisma.transitReport.count(),
          this.prisma.transitReport.count({ where: { status: 'PENDING' } }),
          this.prisma.dataUpdate.count(),
          this.prisma.searchHistory.count(),
        ]);
      return { routes, activeRoutes, stops, verifiedStops, cities, reports, pendingReports, dataUpdates, searches };
    },
  };
}

export { uuidv4 };
