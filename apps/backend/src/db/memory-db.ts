/**
 * Zero-config in-memory implementation of the Database interface.
 * Seeded from src/database/seed-data.ts — perfect for development, demos,
 * and integration tests where PostgreSQL is not available.
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { haversineMeters, SEARCH_MODES } from '@mowaslaty/shared';
import type {
  AreaDto,
  CityDto,
  DataUpdateDto,
  ReportDto,
  ReportStatus,
  RouteDto,
  RouteStopDto,
  StopDto,
  TransportModeDto,
} from '@mowaslaty/shared';
import {
  areas as seedAreas,
  cities as seedCities,
  dataSources as seedDataSources,
  dataUpdates as seedDataUpdates,
  modes as seedModes,
  routes as seedRoutes,
  sampleReports,
  stops as seedStops,
} from '../database/seed-data.js';
import { env } from '../utils/env.js';
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
import type { ImportPayload } from './types.js';
import type { ImportSummary } from '@mowaslaty/shared';

const clone = <T>(value: T): T => structuredClone(value);

const daysAgo = (days: number, extraMinutes = 0) =>
  new Date(Date.now() - days * 86400_000 - extraMinutes * 60_000).toISOString();

/** Normalize Arabic text for tolerant search (strip diacritics, unify alef/ya). */
export function normalizeArabic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '') // diacritics + tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة$/g, 'ه')
    .trim();
}

const matches = (query: string | undefined, ...fields: Array<string | null | undefined>) => {
  if (!query) return true;
  const q = normalizeArabic(query);
  return fields.some((f) => f && normalizeArabic(f).includes(q));
};

const paginate = <T>(items: T[], opts: PageOpts = {}) => {
  const skip = opts.skip ?? 0;
  const take = opts.take ?? 20;
  return { page: items.slice(skip, skip + take), total: items.length };
};

export class MemoryDatabase implements Database {
  readonly kind = 'memory' as const;

  private _modes: TransportModeDto[] = [];
  private _cities: CityDto[] = [];
  private _areas: AreaDto[] = [];
  private _stops: StopDto[] = [];
  private _routes: RouteDto[] = [];
  private _reports: ReportDto[] = [];
  private _dataUpdates: DataUpdateDto[] = [];
  private _dataSources: DataSourceRow[] = [];
  private _users: UserRow[] = [];
  private _auditLogs: AuditLogRow[] = [];
  private _searchCount = 0;

  constructor() {
    this.seed();
  }

  async ping(): Promise<boolean> {
    return true;
  }

  private seed() {
    this._modes = seedModes.map((m) => ({
      id: `mode-${m.ref}`,
      name: m.name,
      nameAr: m.nameAr,
      icon: m.icon,
      color: m.color,
      description: m.description,
    }));

    this._cities = seedCities.map((c) => ({
      id: `city-${c.ref}`,
      name: c.name,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      latitude: c.latitude,
      longitude: c.longitude,
      description: c.description,
    }));

    this._areas = seedAreas.map((a) => ({
      id: `area-${a.ref}`,
      name: a.name,
      nameAr: a.nameAr,
      cityId: `city-${a.cityRef}`,
    }));

    this._stops = seedStops.map((s) => ({
      id: s.ref,
      name: s.name,
      nameAr: s.nameAr,
      latitude: s.latitude,
      longitude: s.longitude,
      type: s.type,
      cityId: `city-${s.cityRef}`,
      areaId: s.areaRef ? `area-${s.areaRef}` : null,
      address: s.address ?? null,
      verified: s.verified ?? false,
      verifiedAt: s.verified ? daysAgo(60) : null,
    }));

    this._routes = seedRoutes.map((r, i) => ({
      id: r.ref,
      name: r.name,
      nameAr: r.nameAr,
      description: r.description ?? null,
      transportModeId: `mode-${r.modeRef}`,
      cityId: `city-${r.cityRef}`,
      fare: r.fare,
      fareType: r.fareType,
      fareCurrency: 'EGP',
      fareUpdatedAt: daysAgo(20),
      fareSource: r.dataSource,
      status: r.status,
      operatingHours: r.operatingHours ?? null,
      lastVerifiedAt: r.confidence === 'HIGH' || r.confidence === 'MEDIUM' ? daysAgo(10) : null,
      confidenceLevel: r.confidence,
      dataSource: r.dataSource,
      dataSourceUrl: null,
      createdAt: daysAgo(90 - i),
      updatedAt: daysAgo(i),
      publishedAt: daysAgo(90 - i),
      transportMode: this._modes.find((m) => m.id === `mode-${r.modeRef}`)!,
      city: this._cities.find((c) => c.id === `city-${r.cityRef}`)!,
      stops: r.stopRefs.map(
        (ref, order): RouteStopDto => ({
          id: `${r.ref}::${ref}`,
          routeId: r.ref,
          stopId: ref,
          order: order + 1,
          stop: this._stops.find((s) => s.id === ref)!,
        }),
      ),
    }));

    this._dataSources = seedDataSources.map((d) => ({
      id: `source-${d.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: d.name,
      description: d.description ?? null,
      sourceType: d.sourceType,
      url: 'url' in d ? (d.url ?? null) : null,
      lastSyncedAt: null,
      syncStatus: 'IDLE',
    }));

    this._dataUpdates = seedDataUpdates.map((u, i) => ({
      id: `update-${i + 1}`,
      routeId: u.routeRef,
      changeType: u.changeType,
      description: u.description,
      createdAt: daysAgo(u.daysAgo),
      route: { id: u.routeRef, nameAr: this._routes.find((r) => r.id === u.routeRef)?.nameAr ?? '' },
    }));

    this._reports = sampleReports.map((r, i) => ({
      id: `report-${i + 1}`,
      userId: null,
      reportType: r.reportType,
      routeId: r.routeRef ?? null,
      stopId: r.stopRef ?? null,
      description: r.description,
      status: r.status as ReportStatus,
      priority: 'MEDIUM' as const,
      createdAt: daysAgo(r.daysAgo),
      updatedAt: daysAgo(r.daysAgo),
      route: r.routeRef ? this.routeSummary(r.routeRef) : null,
      stop: r.stopRef ? this._stops.find((s) => s.id === r.stopRef) ?? null : null,
    }));

    const adminPassword = env.ADMIN_PASSWORD || 'admin123';
    this._users = [
      {
        id: 'user-admin',
        email: env.ADMIN_EMAIL || 'admin@mowaslaty.com',
        password: bcrypt.hashSync(adminPassword, 10),
        name: 'مدير النظام',
        role: 'SUPER_ADMIN',
        createdAt: daysAgo(120),
      },
      {
        id: 'user-editor',
        email: 'editor@mowaslaty.com',
        password: bcrypt.hashSync('editor123', 10),
        name: 'مسؤول البيانات',
        role: 'DATA_ADMIN',
        createdAt: daysAgo(100),
      },
    ];
  }

  private routeSummary(id: string) {
    const r = this._routes.find((x) => x.id === id);
    if (!r) return null;
    const summary = clone(r);
    delete summary.stops;
    return summary;
  }

  private cityOf(cityId: string): CityDto | undefined {
    return this._cities.find((c) => c.id === cityId);
  }

  // ============= Cities =============
  cities: Database['cities'] = {
    list: async (opts: PageOpts = {}) => {
      const filtered = this._cities.filter((c) => matches(opts.search, c.name, c.nameAr, c.nameEn));
      const withCounts = filtered.map((c) => ({
        ...clone(c),
        _count: {
          routes: this._routes.filter((r) => r.cityId === c.id).length,
          stops: this._stops.filter((s) => s.cityId === c.id).length,
          areas: this._areas.filter((a) => a.cityId === c.id).length,
        },
      }));
      const { page, total } = paginate(withCounts, opts);
      return { data: page, total };
    },
    byId: async (id: string) => {
      const city = this._cities.find((c) => c.id === id);
      if (!city) return null;
      return {
        ...clone(city),
        _count: {
          routes: this._routes.filter((r) => r.cityId === id).length,
          stops: this._stops.filter((s) => s.cityId === id).length,
          areas: this._areas.filter((a) => a.cityId === id).length,
        },
      };
    },
  };

  // ============= Areas =============
  areas: Database['areas'] = {
    byCity: async (cityId: string) => clone(this._areas.filter((a) => a.cityId === cityId)),
  };

  // ============= Transport modes =============
  modes: Database['modes'] = {
    list: async () => clone(this._modes),
    byId: async (id: string) => clone(this._modes.find((m) => m.id === id) ?? null),
  };

  // ============= Stops =============
  stops: Database['stops'] = {
    list: async (opts: PageOpts & { cityId?: string } = {}) => {
      const filtered = this._stops.filter(
        (s) =>
          (!opts.cityId || s.cityId === opts.cityId) &&
          matches(opts.search, s.name, s.nameAr, s.nameEn, s.address),
      );
      const { page, total } = paginate(filtered, opts);
      return { data: page.map((s) => clone({ ...s, city: this.cityOf(s.cityId) })), total };
    },

    byId: async (id: string) => {
      const stop = this._stops.find((s) => s.id === id);
      if (!stop) return null;
      const passing = this._routes
        .filter((r) => r.status === 'ACTIVE' && (r.stops ?? []).some((rs) => rs.stopId === id))
        .map((r) => ({
          id: r.id,
          name: r.name,
          nameAr: r.nameAr,
          fare: r.fare,
          status: r.status,
          transportMode: r.transportMode,
        }));
      const result: StopWithRoutes = {
        ...clone(stop),
        city: this.cityOf(stop.cityId),
        area: this._areas.find((a) => a.id === stop.areaId) ?? null,
        routes: passing,
      };
      return result;
    },

    nearby: async (lat: number, lng: number, radiusM: number, limit = 20) =>
      this._stops
        .map((s) => ({
          ...clone(s),
          city: this.cityOf(s.cityId),
          distanceM: haversineMeters({ lat, lng }, { lat: s.latitude, lng: s.longitude }),
        }))
        .filter((s) => s.distanceM <= radiusM)
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, limit),

    all: async () => clone(this._stops),

    create: async (input) => {
      const stop: StopDto = {
        id: uuidv4(),
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
        verifiedAt: null,
      };
      this._stops.push(stop);
      return clone(stop);
    },

    update: async (id, patch) => {
      const stop = this._stops.find((s) => s.id === id);
      if (!stop) return null;
      Object.assign(stop, patch);
      if (patch.verified === true) stop.verifiedAt = new Date().toISOString();
      return clone(stop);
    },
  };

  // ============= Routes =============
  routes: Database['routes'] = {
    list: async (opts: RouteListOpts = {}) => {
      const filtered = this._routes.filter((r) => {
        if (opts.status && opts.status !== 'ALL' && r.status !== opts.status) return false;
        if (!opts.status && r.status !== 'ACTIVE') return false; // default: public listing
        if (opts.cityId && r.cityId !== opts.cityId) return false;
        if (
          opts.modeName &&
          r.transportMode?.name !== opts.modeName &&
          r.transportMode?.nameAr !== opts.modeName
        )
          return false;
        return matches(opts.search, r.name, r.nameAr, r.nameEn, r.description);
      });
      const sorted = [...filtered].sort(
        (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
      );
      const { page, total } = paginate(sorted, opts);
      return { data: clone(page), total };
    },

    byId: async (id: string) => {
      const route = this._routes.find((r) => r.id === id);
      return route ? clone(route) : null;
    },

    activeDetailed: async () => clone(this._routes.filter((r) => r.status === 'ACTIVE')),

    count: async () => this._routes.length,

    update: async (id, patch) => {
      const route = this._routes.find((r) => r.id === id);
      if (!route) return null;
      Object.assign(route, patch);
      if (patch.fare !== undefined) route.fareUpdatedAt = new Date().toISOString();
      route.updatedAt = new Date().toISOString();
      return clone(route);
    },
  };

  // ============= Reports =============
  reports: Database['reports'] = {
    create: async (input) => {
      const report: ReportDto = {
        id: uuidv4(),
        userId: input.userId ?? null,
        reportType: input.reportType,
        routeId: input.routeId ?? null,
        stopId: input.stopId ?? null,
        description: input.description,
        status: 'PENDING',
        priority: 'MEDIUM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        route: input.routeId ? this.routeSummary(input.routeId) : null,
        stop: input.stopId ? this._stops.find((s) => s.id === input.stopId) ?? null : null,
      };
      this._reports.unshift(report);
      return clone(report);
    },

    byId: async (id: string) => {
      const report = this._reports.find((r) => r.id === id);
      return report ? clone(report) : null;
    },

    list: async (opts = {}) => {
      const filtered = this._reports
        .filter((r) => !opts.status || r.status === opts.status)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const skip = opts.skip ?? 0;
      const take = opts.take ?? 50;
      return clone(filtered.slice(skip, skip + take));
    },

    update: async (id, patch) => {
      const report = this._reports.find((r) => r.id === id);
      if (!report) return null;
      Object.assign(report, patch, { updatedAt: new Date().toISOString() });
      if (patch.status && patch.status !== 'PENDING') {
        report.reviewNotes = patch.reviewNotes ?? report.reviewNotes ?? null;
      }
      return clone(report);
    },

    count: async (status?: ReportStatus) =>
      this._reports.filter((r) => !status || r.status === status).length,
  };

  // ============= Data updates =============
  dataUpdates: Database['dataUpdates'] = {
    recent: async (take = 10) =>
      clone(
        [...this._dataUpdates]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, take),
      ),

    create: async (input) => {
      const update: DataUpdateDto = {
        id: uuidv4(),
        routeId: input.routeId,
        changeType: input.changeType,
        description: input.description,
        createdAt: new Date().toISOString(),
        route: {
          id: input.routeId,
          nameAr: this._routes.find((r) => r.id === input.routeId)?.nameAr ?? '',
        },
      };
      this._dataUpdates.unshift(update);
      return clone(update);
    },

    count: async () => this._dataUpdates.length,
  };

  // ============= Data sources =============
  dataSources: Database['dataSources'] = {
    list: async () => clone(this._dataSources),
  };

  // ============= Users =============
  users: Database['users'] = {
    byEmail: async (email: string) => {
      const user = this._users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      return user ? clone(user) : null;
    },
    create: async (input) => {
      const user: UserRow = {
        id: uuidv4(),
        email: input.email,
        password: input.password,
        name: input.name ?? null,
        role: input.role,
        createdAt: new Date().toISOString(),
      };
      this._users.push(user);
      return clone(user);
    },
  };

  // ============= Audit =============
  audit: Database['audit'] = {
    create: async (entry) => {
      this._auditLogs.unshift({
        ...entry,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
      });
    },
    recent: async (take = 20) => clone(this._auditLogs.slice(0, take)),
  };

  // ============= Search history =============
  searchHistory: Database['searchHistory'] = {
    record: async (entry) => {
      if (SEARCH_MODES.includes(entry.searchMode as (typeof SEARCH_MODES)[number])) {
        this._searchCount += 1;
      }
    },
    count: async () => this._searchCount,
  };

  // ============= Stats =============
  stats: Database['stats'] = {
    dashboard: async (): Promise<DashboardStats> => ({
      routes: this._routes.length,
      activeRoutes: this._routes.filter((r) => r.status === 'ACTIVE').length,
      stops: this._stops.length,
      verifiedStops: this._stops.filter((s) => s.verified).length,
      cities: this._cities.length,
      reports: this._reports.length,
      pendingReports: this._reports.filter((r) => r.status === 'PENDING').length,
      dataUpdates: this._dataUpdates.length,
      searches: this._searchCount,
    }),
  };

  // ============= Bulk import (GTFS & structured feeds) =============
  importData = async (payload: ImportPayload): Promise<ImportSummary> => {
    const summary: ImportSummary = {
      sourceName: payload.sourceName,
      stopsCreated: 0,
      stopsLinked: 0,
      routesCreated: 0,
      routesUpdated: 0,
      skippedRoutes: 0,
      warnings: [...payload.warnings],
    };

    // Upsert the data source record.
    let source = this._dataSources.find((s) => s.name === payload.sourceName);
    if (!source) {
      source = {
        id: `source-${payload.sourceName.toLowerCase().replace(/\s+/g, '-')}`,
        name: payload.sourceName,
        description: 'استيراد آلي',
        sourceType: payload.sourceType,
        url: payload.sourceUrl ?? null,
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'SUCCESS',
      };
      this._dataSources.push(source);
    } else {
      source.lastSyncedAt = new Date().toISOString();
      source.syncStatus = 'SUCCESS';
      if (payload.sourceUrl) source.url = payload.sourceUrl;
    }

    // ---- Stops: match by externalId, then by normalized Arabic name ----
    const extToStopId = new Map<string, string>();
    for (const s of payload.stops) {
      let existing = this._stops.find((x) => x.externalId === s.externalId);
      if (!existing) {
        const nameNorm = normalizeArabic(s.nameAr);
        existing = this._stops.find((x) => normalizeArabic(x.nameAr) === nameNorm);
      }
      if (existing) {
        if (!existing.externalId) existing.externalId = s.externalId;
        extToStopId.set(s.externalId, existing.id);
        summary.stopsLinked += 1;
        continue;
      }
      if (!s.cityId) {
        summary.warnings.push(`المحطة "${s.nameAr}" خارج نطاق المدن المعروفة — تم تجاوزها`);
        continue;
      }
      const stop: StopDto = {
        id: uuidv4(),
        name: s.name,
        nameAr: s.nameAr,
        latitude: s.lat,
        longitude: s.lng,
        address: s.address ?? null,
        type: 'BUS',
        cityId: s.cityId,
        areaId: null,
        verified: false,
        verifiedAt: null,
        externalId: s.externalId,
      };
      this._stops.push(stop);
      extToStopId.set(s.externalId, stop.id);
      summary.stopsCreated += 1;
    }

    // ---- Routes: replace when externalId exists, otherwise create ----
    for (const r of payload.routes) {
      const stopIds = r.stopSequence
        .map((ext) => extToStopId.get(ext))
        .filter((id): id is string => Boolean(id));
      if (stopIds.length < 2) {
        summary.skippedRoutes += 1;
        summary.warnings.push(`الخط "${r.nameAr}" لا يملك محطتين صالحين على الأقل — تم تجاوزه`);
        continue;
      }

      const mode =
        this._modes.find((m) => m.name === r.modeName) ?? this._modes.find((m) => m.name === 'Bus')!;
      const firstStop = this._stops.find((s) => s.id === stopIds[0])!;
      const routeStops: RouteStopDto[] = stopIds.map((stopId, i) => ({
        id: `${r.externalId}::${stopId}`,
        routeId: '', // filled below
        stopId,
        order: i + 1,
        stop: this._stops.find((s) => s.id === stopId)!,
      }));

      const existing = this._routes.find((x) => x.externalId === r.externalId);
      if (existing) {
        existing.name = r.name;
        existing.nameAr = r.nameAr;
        existing.description = r.description ?? existing.description;
        existing.transportModeId = mode.id;
        existing.transportMode = mode;
        existing.fare = r.fare;
        existing.fareUpdatedAt = new Date().toISOString();
        existing.fareSource = payload.sourceName;
        existing.operatingHours = r.operatingHours ?? existing.operatingHours;
        existing.dataSource = payload.sourceName;
        existing.stops = routeStops.map((rs) => ({ ...rs, routeId: existing.id }));
        existing.updatedAt = new Date().toISOString();
        summary.routesUpdated += 1;
        this._dataUpdates.unshift({
          id: uuidv4(),
          routeId: existing.id,
          changeType: 'ROUTE_MODIFIED',
          description: `تحديث الخط "${existing.nameAr}" من المصدر ${payload.sourceName}`,
          createdAt: new Date().toISOString(),
          route: { id: existing.id, nameAr: existing.nameAr },
        });
      } else {
        const id = `route-ext-${r.externalId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const route: RouteDto = {
          id,
          name: r.name,
          nameAr: r.nameAr,
          description: r.description ?? null,
          transportModeId: mode.id,
          cityId: firstStop.cityId,
          fare: r.fare,
          fareType: 'FIXED',
          fareCurrency: 'EGP',
          fareUpdatedAt: new Date().toISOString(),
          fareSource: payload.sourceName,
          status: 'ACTIVE',
          operatingHours: r.operatingHours ?? null,
          lastVerifiedAt: new Date().toISOString(),
          confidenceLevel: 'HIGH',
          dataSource: payload.sourceName,
          dataSourceUrl: payload.sourceUrl ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
          externalId: r.externalId,
          transportMode: mode,
          city: this._cities.find((c) => c.id === firstStop.cityId) ?? undefined,
          stops: routeStops.map((rs) => ({ ...rs, routeId: id })),
        };
        this._routes.push(route);
        summary.routesCreated += 1;
        this._dataUpdates.unshift({
          id: uuidv4(),
          routeId: id,
          changeType: 'ROUTE_CREATED',
          description: `إضافة الخط "${r.nameAr}" من المصدر ${payload.sourceName}`,
          createdAt: new Date().toISOString(),
          route: { id, nameAr: r.nameAr },
        });
      }
    }

    return summary;
  };
}
