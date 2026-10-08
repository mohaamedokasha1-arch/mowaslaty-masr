/**
 * @mowaslaty/shared — types, enums and Arabic/English labels shared between
 * the backend API, the public web app and the admin dashboard.
 */

// ============= Enums =============

export const USER_ROLES = ['USER', 'DATA_ADMIN', 'MODERATOR', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const STOP_TYPES = [
  'BUS',
  'MINIBUS',
  'TRAIN',
  'METRO',
  'TRAM',
  'BRT',
  'SHARED',
  'TAXI',
] as const;
export type StopType = (typeof STOP_TYPES)[number];

export const ROUTE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNDER_REVIEW', 'DRAFT'] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const FARE_TYPES = ['FIXED', 'DISTANCE_BASED', 'STAGE_BASED', 'ZONE_BASED'] as const;
export type FareType = (typeof FARE_TYPES)[number];

export const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const REPORT_TYPES = [
  'FARE_INCORRECT',
  'ROUTE_CLOSED',
  'ROUTE_CHANGED',
  'STOP_LOCATION_WRONG',
  'STOP_NAME_WRONG',
  'PICKUP_POINT_WRONG',
  'DROPOFF_POINT_WRONG',
  'OPERATING_HOURS_WRONG',
  'VEHICLE_NOT_AVAILABLE',
  'SAFETY_ISSUE',
  'OTHER',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_STATUSES = ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'RESOLVED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ReportPriority = (typeof REPORT_PRIORITIES)[number];

export const SEARCH_MODES = ['FASTEST', 'CHEAPEST', 'FEWEST_TRANSFERS', 'LEAST_WALKING'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export const CHANGE_TYPES = [
  'FARE_CHANGED',
  'HOURS_CHANGED',
  'STOPS_CHANGED',
  'ROUTE_CREATED',
  'ROUTE_DELETED',
  'ROUTE_MODIFIED',
  'STATUS_CHANGED',
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

// ============= Core entities (serialized DTOs) =============

export interface TransportModeDto {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  color: string;
  description?: string | null;
}

export interface CityDto {
  id: string;
  name: string;
  nameAr: string;
  nameEn?: string | null;
  latitude: number;
  longitude: number;
  description?: string | null;
  _count?: { routes: number; stops: number; areas: number };
}

export interface AreaDto {
  id: string;
  name: string;
  nameAr: string;
  nameEn?: string | null;
  cityId: string;
}

export interface StopDto {
  id: string;
  name: string;
  nameAr: string;
  nameEn?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  type: StopType;
  cityId: string;
  areaId?: string | null;
  verified: boolean;
  verifiedAt?: string | null;
  /** External id (e.g. GTFS stop_id) used for idempotent imports. */
  externalId?: string | null;
  city?: CityDto;
  area?: AreaDto | null;
  distanceM?: number;
}

export interface RouteStopDto {
  id: string;
  routeId: string;
  stopId: string;
  order: number;
  stop?: StopDto;
}

export interface RouteDto {
  id: string;
  name: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  transportModeId: string;
  cityId: string;
  fare: number | null;
  fareType: FareType;
  fareCurrency: string;
  fareUpdatedAt?: string | null;
  fareSource?: string | null;
  status: RouteStatus;
  operatingHours?: string | null;
  lastVerifiedAt?: string | null;
  confidenceLevel: ConfidenceLevel;
  dataSource?: string | null;
  dataSourceUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  /** External id (e.g. GTFS route_id) used for idempotent imports. */
  externalId?: string | null;
  transportMode?: TransportModeDto;
  city?: CityDto;
  stops?: RouteStopDto[];
}

export interface ReportDto {
  id: string;
  userId?: string | null;
  reportType: ReportType;
  routeId?: string | null;
  stopId?: string | null;
  description: string;
  status: ReportStatus;
  priority: ReportPriority;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt?: string;
  route?: RouteDto | null;
  stop?: StopDto | null;
  user?: { id: string; name?: string | null; email?: string } | null;
}

export interface DataUpdateDto {
  id: string;
  routeId: string;
  changeType: ChangeType;
  description: string;
  createdAt: string;
  route?: { id: string; nameAr: string } | null;
}

// ============= Data import (GTFS etc.) =============

export const DATA_SOURCE_TYPES = [
  'GOVERNMENT',
  'TRANSIT_COMPANY',
  'OSM',
  'GTFS',
  'MANUAL',
  'COMMUNITY',
  'EXTERNAL_API',
] as const;
export type DataSourceType = (typeof DATA_SOURCE_TYPES)[number];

export interface ImportSummary {
  sourceName: string;
  stopsCreated: number;
  stopsLinked: number;
  routesCreated: number;
  routesUpdated: number;
  skippedRoutes: number;
  warnings: string[];
}

export interface Pagination {
  skip: number;
  take: number;
  total: number;
  pages: number;
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

// ============= Trip planning =============

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ResolvedPlace {
  name: string;
  nameAr: string;
  lat: number;
  lng: number;
  kind: 'city' | 'area' | 'stop' | 'geocoded';
}

export interface WalkLeg {
  type: 'WALK';
  fromName: string;
  toName: string;
  from: GeoPoint;
  to: GeoPoint;
  durationMin: number;
  distanceKm: number;
}

export interface RideLeg {
  type: 'RIDE';
  routeId: string;
  routeName: string;
  routeNameAr: string;
  modeName: string;
  modeNameAr: string;
  modeIcon: string;
  modeColor: string;
  fromStopId: string;
  fromName: string;
  toStopId: string;
  toName: string;
  /** Boarding/alighting coordinates (for map rendering). */
  from: GeoPoint;
  to: GeoPoint;
  stopsCount: number;
  durationMin: number;
  distanceKm: number;
  fare: number;
  confidence: ConfidenceLevel;
}

export type TripLeg = WalkLeg | RideLeg;

export interface Trip {
  id: string;
  mode: SearchMode;
  legs: TripLeg[];
  totalDurationMin: number;
  totalFare: number;
  transfers: number;
  walkDistanceKm: number;
  confidence: ConfidenceLevel;
}

export interface TripPlanRequest {
  fromText?: string;
  toText?: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  mode: SearchMode;
}

export interface TripPlanResult {
  ok: boolean;
  mode: SearchMode;
  resolvedFrom?: ResolvedPlace;
  resolvedTo?: ResolvedPlace;
  trips: Trip[];
  message?: string;
  messageAr?: string;
  suggestions?: string[];
}

// ============= Labels (Arabic-first) =============

export const SEARCH_MODE_LABELS: Record<SearchMode, { ar: string; en: string; icon: string }> = {
  FASTEST: { ar: 'الأسرع', en: 'Fastest', icon: '⚡' },
  CHEAPEST: { ar: 'الأرخص', en: 'Cheapest', icon: '💰' },
  FEWEST_TRANSFERS: { ar: 'أقل تبديلات', en: 'Fewest transfers', icon: '🔁' },
  LEAST_WALKING: { ar: 'أقل مشي', en: 'Least walking', icon: '🚶' },
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, { ar: string; en: string }> = {
  HIGH: { ar: 'معلومات موثوقة', en: 'High confidence' },
  MEDIUM: { ar: 'تم التحقق', en: 'Verified' },
  LOW: { ar: 'بحاجة لمراجعة', en: 'Needs review' },
  UNVERIFIED: { ar: 'غير مؤكد', en: 'Unverified' },
};

export const ROUTE_STATUS_LABELS: Record<RouteStatus, { ar: string; en: string }> = {
  ACTIVE: { ar: 'نشط', en: 'Active' },
  INACTIVE: { ar: 'غير نشط', en: 'Inactive' },
  SUSPENDED: { ar: 'متوقف مؤقتًا', en: 'Suspended' },
  UNDER_REVIEW: { ar: 'قيد المراجعة', en: 'Under review' },
  DRAFT: { ar: 'مسودة', en: 'Draft' },
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  FARE_INCORRECT: 'الأجرة غير صحيحة',
  ROUTE_CLOSED: 'الخط متوقف / ملغي',
  ROUTE_CHANGED: 'مسار الخط تغيّر',
  STOP_LOCATION_WRONG: 'موقع المحطة غير صحيح',
  STOP_NAME_WRONG: 'اسم المحطة غير صحيح',
  PICKUP_POINT_WRONG: 'نقطة الركوب غير صحيحة',
  DROPOFF_POINT_WRONG: 'نقطة النزول غير صحيحة',
  OPERATING_HOURS_WRONG: 'مواعيد التشغيل غير صحيحة',
  VEHICLE_NOT_AVAILABLE: 'المركبة غير متوفرة',
  SAFETY_ISSUE: 'مشكلة أمان',
  OTHER: 'أخرى',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'قيد الانتظار',
  REVIEWING: 'قيد المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
  RESOLVED: 'تم الحل',
};

// ============= Helpers =============

/** Average speed (km/h) per transport mode, used by the routing engine. */
export const MODE_SPEED_KMH: Record<string, number> = {
  BUS: 16,
  MINIBUS: 20,
  TRAIN: 55,
  METRO: 32,
  TRAM: 14,
  BRT: 22,
  SHARED: 20,
  TAXI: 24,
  WALKING: 4.5,
};

export const WALKING_SPEED_KMH = 4.5;

/** Haversine distance in meters. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatFare(fare: number | null | undefined, currency = 'EGP'): string {
  if (fare == null) return 'غير محددة';
  return `${fare} ${currency === 'EGP' ? 'ج.م' : currency}`;
}

export function formatDuration(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} دقيقة`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} ساعة` : `${h} ساعة و ${rest} دقيقة`;
}
