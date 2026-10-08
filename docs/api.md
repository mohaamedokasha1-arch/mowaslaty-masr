# API Reference — مواصلاتي مصر

Base URL: `http://localhost:3001/api` (or the relative `/api` path behind the web/admin proxies).

All list endpoints return `{ data, pagination: { skip, take, total, pages } }`.
Errors return `{ error, details? }` with appropriate HTTP status codes
(400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 422 unresolvable place).

## Trip planning

### `GET /api/trips/plan`

| Param | Type | Notes |
| --- | --- | --- |
| `fromText` / `toText` | string | Place name (Arabic or English), resolved via gazetteer + geocoder |
| `fromLat/fromLng`, `toLat/toLng` | number | Alternative to text |
| `mode` | `FASTEST` \| `CHEAPEST` \| `FEWEST_TRANSFERS` \| `LEAST_WALKING` | default `FASTEST` |

Response `200`:

```jsonc
{
  "ok": true,
  "mode": "FASTEST",
  "resolvedFrom": { "nameAr": "ميدان التحرير", "lat": 30.58, "lng": 31.94, "kind": "stop" },
  "resolvedTo":   { "nameAr": "جامعة الزقازيق، الزقازيق", "lat": 30.59, "lng": 31.95, "kind": "stop" },
  "trips": [
    {
      "id": "trip-fastest-1",
      "totalDurationMin": 14.2,
      "totalFare": 5,
      "transfers": 0,
      "walkDistanceKm": 0.35,
      "confidence": "HIGH",
      "legs": [
        { "type": "WALK", "fromName": "…", "toName": "…", "durationMin": 4, "distanceKm": 0.35, "from": {"lat":0,"lng":0}, "to": {"lat":0,"lng":0} },
        { "type": "RIDE", "routeId": "route-zg-01", "routeNameAr": "خط المحطة – الجامعة",
          "modeIcon": "🚐", "modeColor": "#e74c3c", "fromStopId": "ZG-TAHRIR", "toStopId": "ZG-UNIV",
          "stopsCount": 6, "fare": 5, "confidence": "HIGH", "from": {"lat":0,"lng":0}, "to": {"lat":0,"lng":0} }
      ]
    }
  ]
}
```

If a place cannot be resolved, the API returns `422` with `ok:false`, `messageAr`, and a list of
`suggestions` (known place names) to help the user retry.

## Routes

| Endpoint | Notes |
| --- | --- |
| `GET /api/routes` | Filters: `cityId`, `transportMode` (name or nameAr), `status` (+`ALL`), `searchQuery`, `skip`, `take` (≤100). Default: only `ACTIVE`. |
| `GET /api/routes/:id` | Full route: mode, city, ordered `stops[]` with stop objects. |

## Stops

| Endpoint | Notes |
| --- | --- |
| `GET /api/stops` | Filters: `cityId`, `searchQuery`, pagination — **or** geo mode `lat&lng&radius` (meters) returning stops sorted by `distanceM`. |
| `GET /api/stops/:id` | Stop details + `routes` passing through it. |

## Reference data

| Endpoint | Notes |
| --- | --- |
| `GET /api/cities` | With `_count { routes, stops, areas }`. |
| `GET /api/cities/:id` | City + `areas[]`. |
| `GET /api/modes` | Transport modes (icon, color, Arabic name). |
| `GET /api/search?query&type=all\|routes\|stops\|cities&limit` | Unified search. |

## Community reports

### `POST /api/reports`

```json
{ "reportType": "FARE_INCORRECT", "routeId": "route-zg-01", "description": "… (≥10 chars)" }
```

Anonymous submissions are allowed. Returns `201` with the created report (`status: "PENDING"`).

`GET /api/reports/:id` — look up a report's current status.

## Admin (JWT required)

Authenticate: `POST /api/admin/auth/login` with `{ email, password }` → `{ token, user }`.
Send `Authorization: Bearer <token>` on all `/api/admin/*` endpoints. Admin roles only
(`DATA_ADMIN`, `MODERATOR`, `SUPER_ADMIN`).

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/admin/dashboard` | GET | Stats + recent updates/reports + data sources |
| `/api/admin/reports?status=` | GET | Moderation queue |
| `/api/admin/reports/:id` | PATCH | `{ status, priority?, reviewNotes? }` |
| `/api/admin/routes?status=ALL` | GET | All routes regardless of status |
| `/api/admin/routes/:id` | PATCH | `{ status?, fare?, fareType?, operatingHours?, confidenceLevel?, description? }` — auto-records a `DataUpdate` |
| `/api/admin/stops` | GET | Searchable stop list |
| `/api/admin/stops` | POST | Create stop `{ name, nameAr, latitude, longitude, cityId, type?, address? }` |
| `/api/admin/stops/:id` | PATCH | `{ verified?, name?, latitude?, longitude?, … }` |
| `/api/admin/sources` | GET | Data sources |
| `/api/admin/audit?take=` | GET | Audit log |
| `/api/admin/cities` | GET | City list (for forms) |

## Health

- `GET /api/health` → `{ status, driver, checks: { database, api } }` (503 when DB is down)
- `GET /ping` → liveness probe
