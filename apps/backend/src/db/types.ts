/**
 * Repository interfaces for Mowaslaty's data layer.
 *
 * Two implementations exist:
 *  - MemoryDatabase  (zero-config, seeded; default for development/testing)
 *  - PrismaDatabase  (PostgreSQL via Prisma; production)
 */
import type {
  AreaDto,
  CityDto,
  ConfidenceLevel,
  DataUpdateDto,
  FareType,
  ReportDto,
  ReportStatus,
  ReportType,
  RouteDto,
  RouteStatus,
  StopDto,
  StopType,
  TransportModeDto,
  UserRole,
} from '@mowaslaty/shared';

export interface UserRow {
  id: string;
  email: string;
  password: string | null;
  name?: string | null;
  avatar?: string | null;
  role: UserRole;
  createdAt: string;
}

export interface DataSourceRow {
  id: string;
  name: string;
  description?: string | null;
  sourceType: string;
  url?: string | null;
  lastSyncedAt?: string | null;
  syncStatus: string;
}

export interface AuditLogRow {
  id: string;
  userId: string;
  userEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface DashboardStats {
  routes: number;
  activeRoutes: number;
  stops: number;
  verifiedStops: number;
  cities: number;
  reports: number;
  pendingReports: number;
  dataUpdates: number;
  searches: number;
}

export interface PageOpts {
  skip?: number;
  take?: number;
  search?: string;
}

export interface RouteListOpts extends PageOpts {
  cityId?: string;
  modeName?: string;
  status?: RouteStatus | 'ALL';
}

export interface StopWithRoutes extends StopDto {
  routes: Array<Pick<RouteDto, 'id' | 'name' | 'nameAr' | 'fare' | 'status'> & {
    transportMode?: TransportModeDto;
  }>;
}

export interface Database {
  readonly kind: 'memory' | 'prisma';
  ping(): Promise<boolean>;

  cities: {
    list(opts?: PageOpts): Promise<{ data: CityDto[]; total: number }>;
    byId(id: string): Promise<CityDto | null>;
  };

  areas: {
    byCity(cityId: string): Promise<AreaDto[]>;
  };

  modes: {
    list(): Promise<TransportModeDto[]>;
    byId(id: string): Promise<TransportModeDto | null>;
  };

  stops: {
    list(opts?: PageOpts & { cityId?: string }): Promise<{ data: StopDto[]; total: number }>;
    byId(id: string): Promise<StopWithRoutes | null>;
    nearby(lat: number, lng: number, radiusM: number, limit?: number): Promise<StopDto[]>;
    all(): Promise<StopDto[]>;
    create(
      input: Omit<StopDto, 'id' | 'verified' | 'city' | 'area'> & { verified?: boolean },
    ): Promise<StopDto>;
    update(
      id: string,
      patch: Partial<
        Pick<StopDto, 'name' | 'nameAr' | 'latitude' | 'longitude' | 'address' | 'type' | 'verified'>
      >,
    ): Promise<StopDto | null>;
  };

  routes: {
    list(opts?: RouteListOpts): Promise<{ data: RouteDto[]; total: number }>;
    byId(id: string): Promise<RouteDto | null>;
    activeDetailed(): Promise<RouteDto[]>;
    count(): Promise<number>;
    update(
      id: string,
      patch: Partial<
        Pick<
          RouteDto,
          'status' | 'fare' | 'fareType' | 'operatingHours' | 'confidenceLevel' | 'description'
        >
      >,
    ): Promise<RouteDto | null>;
  };

  reports: {
    create(input: {
      userId?: string | null;
      reportType: ReportType;
      routeId?: string | null;
      stopId?: string | null;
      description: string;
      details?: unknown;
    }): Promise<ReportDto>;
    byId(id: string): Promise<ReportDto | null>;
    list(opts?: { status?: ReportStatus; skip?: number; take?: number }): Promise<ReportDto[]>;
    update(
      id: string,
      patch: Partial<Pick<ReportDto, 'status' | 'priority' | 'reviewNotes'>>,
    ): Promise<ReportDto | null>;
    count(status?: ReportStatus): Promise<number>;
  };

  dataUpdates: {
    recent(take?: number): Promise<DataUpdateDto[]>;
    create(input: {
      routeId: string;
      changeType: DataUpdateDto['changeType'];
      description: string;
    }): Promise<DataUpdateDto>;
    count(): Promise<number>;
  };

  dataSources: {
    list(): Promise<DataSourceRow[]>;
  };

  users: {
    byEmail(email: string): Promise<UserRow | null>;
    create(input: { email: string; password: string | null; name?: string; role: UserRole }): Promise<UserRow>;
  };

  audit: {
    create(entry: Omit<AuditLogRow, 'id' | 'createdAt'>): Promise<void>;
    recent(take?: number): Promise<AuditLogRow[]>;
  };

  searchHistory: {
    record(entry: {
      fromAddress?: string;
      toAddress?: string;
      fromLat?: number;
      fromLng?: number;
      toLat?: number;
      toLng?: number;
      searchMode: string;
      resultCount: number;
    }): Promise<void>;
    count(): Promise<number>;
  };

  stats: {
    dashboard(): Promise<DashboardStats>;
  };
}

export type { ConfidenceLevel, FareType, RouteStatus, StopType };
