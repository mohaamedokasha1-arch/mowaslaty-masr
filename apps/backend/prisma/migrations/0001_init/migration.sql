-- Mowaslaty Egypt — initial schema (PostgreSQL)
-- Fixed version of the hand-written init migration:
--   * RouteStop.variantId added (variants relation)
--   * Favorite.stopId / Favorite.routeId foreign keys corrected
--   * SearchHistory.routeId foreign key corrected
--   * duplicate TransportMode_nameAr index removed

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'DATA_ADMIN', 'MODERATOR', 'SUPER_ADMIN');
CREATE TYPE "StopType" AS ENUM ('BUS', 'MINIBUS', 'TRAIN', 'METRO', 'TRAM', 'BRT', 'SHARED', 'TAXI');
CREATE TYPE "RouteStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNDER_REVIEW', 'DRAFT');
CREATE TYPE "FareType" AS ENUM ('FIXED', 'DISTANCE_BASED', 'STAGE_BASED', 'ZONE_BASED');
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED');
CREATE TYPE "DataSourceType" AS ENUM ('GOVERNMENT', 'TRANSIT_COMPANY', 'OSM', 'GTFS', 'MANUAL', 'COMMUNITY', 'EXTERNAL_API');
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'SYNCING', 'SUCCESS', 'FAILED');
CREATE TYPE "ChangeType" AS ENUM ('FARE_CHANGED', 'HOURS_CHANGED', 'STOPS_CHANGED', 'ROUTE_CREATED', 'ROUTE_DELETED', 'ROUTE_MODIFIED', 'STATUS_CHANGED');
CREATE TYPE "ReportType" AS ENUM ('FARE_INCORRECT', 'ROUTE_CLOSED', 'ROUTE_CHANGED', 'STOP_LOCATION_WRONG', 'STOP_NAME_WRONG', 'PICKUP_POINT_WRONG', 'DROPOFF_POINT_WRONG', 'OPERATING_HOURS_WRONG', 'VEHICLE_NOT_AVAILABLE', 'SAFETY_ISSUE', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'RESOLVED');
CREATE TYPE "ReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "FavoriteType" AS ENUM ('STOP', 'ROUTE', 'LOCATION');
CREATE TYPE "SearchMode" AS ENUM ('FASTEST', 'CHEAPEST', 'FEWEST_TRANSFERS', 'LEAST_WALKING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportMode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "TransportMode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "type" "StopType" NOT NULL DEFAULT 'BUS',
    "cityId" TEXT NOT NULL,
    "areaId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "transportModeId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "fare" DOUBLE PRECISION,
    "fareType" "FareType" NOT NULL DEFAULT 'FIXED',
    "fareCurrency" TEXT NOT NULL DEFAULT 'EGP',
    "fareUpdatedAt" TIMESTAMP(3),
    "fareSource" TEXT,
    "status" "RouteStatus" NOT NULL DEFAULT 'ACTIVE',
    "operatingHours" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "confidenceLevel" "ConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "dataSource" TEXT,
    "dataSourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "variantId" TEXT,
    "arrivalTime" TEXT,
    "departureTime" TEXT,
    "waitTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteVariant" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" "DataSourceType" NOT NULL,
    "url" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataUpdate" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "sourceId" TEXT,
    "changeType" "ChangeType" NOT NULL,
    "description" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransitReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "reportType" "ReportType" NOT NULL,
    "routeId" TEXT,
    "stopId" TEXT,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ReportPriority" NOT NULL DEFAULT 'MEDIUM',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransitReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FavoriteType" NOT NULL,
    "stopId" TEXT,
    "routeId" TEXT,
    "label" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "fromLat" DOUBLE PRECISION,
    "fromLng" DOUBLE PRECISION,
    "fromAddress" TEXT,
    "toLat" DOUBLE PRECISION,
    "toLng" DOUBLE PRECISION,
    "toAddress" TEXT,
    "routeId" TEXT,
    "searchMode" "SearchMode" NOT NULL DEFAULT 'FASTEST',
    "resultCount" INTEGER NOT NULL,
    "userSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "changes" JSONB,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemHealth" (
    "id" TEXT NOT NULL,
    "routingService" BOOLEAN NOT NULL DEFAULT true,
    "database" BOOLEAN NOT NULL DEFAULT true,
    "geocoding" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");

CREATE UNIQUE INDEX "City_name_key" ON "City"("name");
CREATE UNIQUE INDEX "City_nameAr_key" ON "City"("nameAr");
CREATE INDEX "City_name_idx" ON "City"("name");
CREATE INDEX "City_nameAr_idx" ON "City"("nameAr");

CREATE UNIQUE INDEX "Area_cityId_name_key" ON "Area"("cityId", "name");
CREATE INDEX "Area_cityId_idx" ON "Area"("cityId");
CREATE INDEX "Area_name_idx" ON "Area"("name");

CREATE UNIQUE INDEX "TransportMode_name_key" ON "TransportMode"("name");
CREATE UNIQUE INDEX "TransportMode_nameAr_key" ON "TransportMode"("nameAr");
CREATE INDEX "TransportMode_name_idx" ON "TransportMode"("name");

CREATE INDEX "Stop_cityId_idx" ON "Stop"("cityId");
CREATE INDEX "Stop_areaId_idx" ON "Stop"("areaId");
CREATE INDEX "Stop_latitude_longitude_idx" ON "Stop"("latitude", "longitude");

CREATE INDEX "Route_cityId_idx" ON "Route"("cityId");
CREATE INDEX "Route_transportModeId_idx" ON "Route"("transportModeId");
CREATE INDEX "Route_status_idx" ON "Route"("status");
CREATE INDEX "Route_lastVerifiedAt_idx" ON "Route"("lastVerifiedAt");

CREATE UNIQUE INDEX "RouteStop_routeId_stopId_order_key" ON "RouteStop"("routeId", "stopId", "order");
CREATE INDEX "RouteStop_routeId_idx" ON "RouteStop"("routeId");
CREATE INDEX "RouteStop_stopId_idx" ON "RouteStop"("stopId");

CREATE INDEX "RouteVariant_routeId_idx" ON "RouteVariant"("routeId");

CREATE UNIQUE INDEX "DataSource_name_key" ON "DataSource"("name");

CREATE INDEX "DataUpdate_routeId_idx" ON "DataUpdate"("routeId");
CREATE INDEX "DataUpdate_sourceId_idx" ON "DataUpdate"("sourceId");
CREATE INDEX "DataUpdate_createdAt_idx" ON "DataUpdate"("createdAt");

CREATE INDEX "TransitReport_userId_idx" ON "TransitReport"("userId");
CREATE INDEX "TransitReport_routeId_idx" ON "TransitReport"("routeId");
CREATE INDEX "TransitReport_stopId_idx" ON "TransitReport"("stopId");
CREATE INDEX "TransitReport_status_idx" ON "TransitReport"("status");
CREATE INDEX "TransitReport_createdAt_idx" ON "TransitReport"("createdAt");

CREATE UNIQUE INDEX "Favorite_userId_type_label_key" ON "Favorite"("userId", "type", "label");
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

CREATE INDEX "SearchHistory_userId_idx" ON "SearchHistory"("userId");
CREATE INDEX "SearchHistory_createdAt_idx" ON "SearchHistory"("createdAt");

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_resourceType_idx" ON "AuditLog"("resourceType");

CREATE INDEX "SystemHealth_createdAt_idx" ON "SystemHealth"("createdAt");

-- Full-text search support (PostgreSQL GIN expression indexes)
CREATE INDEX "Stop_name_nameAr_idx" ON "Stop" USING GIN (to_tsvector('simple', "name" || ' ' || "nameAr"));
CREATE INDEX "Route_name_nameAr_idx" ON "Route" USING GIN (to_tsvector('simple', "name" || ' ' || "nameAr"));

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Stop" ADD CONSTRAINT "Stop_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stop" ADD CONSTRAINT "Stop_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Route" ADD CONSTRAINT "Route_transportModeId_fkey" FOREIGN KEY ("transportModeId") REFERENCES "TransportMode"("id") ON UPDATE CASCADE;
ALTER TABLE "Route" ADD CONSTRAINT "Route_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "RouteVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RouteVariant" ADD CONSTRAINT "RouteVariant_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DataUpdate" ADD CONSTRAINT "DataUpdate_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataUpdate" ADD CONSTRAINT "DataUpdate_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransitReport" ADD CONSTRAINT "TransitReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransitReport" ADD CONSTRAINT "TransitReport_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransitReport" ADD CONSTRAINT "TransitReport_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
