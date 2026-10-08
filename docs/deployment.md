# Deployment Guide — مواصلاتي مصر

## Environments

| | Development | Production |
| --- | --- | --- |
| DB driver | `memory` (automatic when no `DATABASE_URL`) | `prisma` + PostgreSQL |
| Seed | automatic (in-memory) | `npm run db:seed` after migrations |
| Geocoding | gazetteer + optional Nominatim | same |

## 1. Docker Compose (recommended)

```bash
# from the repository root
JWT_SECRET="$(openssl rand -hex 32)" \
ADMIN_EMAIL=admin@yourdomain.com \
ADMIN_PASSWORD='strong-password' \
docker compose up --build -d
```

- Backend waits for PostgreSQL's healthcheck, runs `prisma migrate deploy`, seeds, then starts.
- Web/admin receive `BACKEND_URL=http://backend:3001` and proxy `/api/*` to it.

## 2. Manual (bare Node)

```bash
cd apps/backend
cp .env.example .env        # set DATABASE_URL, DB_DRIVER=prisma, JWT_SECRET, ADMIN_*
npm install
npx prisma migrate deploy   # applies prisma/migrations/0001_init
npm run db:seed
npm run start               # or run behind pm2/systemd
```

Build the frontends with `npm run build --workspace @mowaslaty/web` (and admin), then serve with
`next start` or export behind any Node-capable host.

## Environment variables (backend)

| Var | Default | Description |
| --- | --- | --- |
| `PORT` / `HOST` | `3001` / `0.0.0.0` | Bind address |
| `DATABASE_URL` | – | PostgreSQL connection string (enables Prisma driver) |
| `DB_DRIVER` | auto | Force `memory` or `prisma` |
| `JWT_SECRET` | dev fallback | **Must be set in production** |
| `JWT_EXPIRY` | `7d` | Token lifetime |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@mowaslaty.com` / `admin123` | Bootstrap admin credentials |
| `GEOCODING_ENABLED` | `true` | Set `false` for fully offline geocoding |
| `OPENSTREETMAP_API_URL` | nominatim | Geocoding endpoint |
| `CORS_ORIGIN` | `*` (dev) | Comma-separated origins |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | `900000` / `100` | Rate limiting |

## Production checklist

- [ ] Strong `JWT_SECRET`, non-default `ADMIN_PASSWORD`
- [ ] `CORS_ORIGIN` locked to your real domains
- [ ] HTTPS termination (reverse proxy) in front of Next.js/API
- [ ] PostgreSQL backups (`pg_dump` cron)
- [ ] Monitor `GET /api/health` (503 ⇒ DB down)
- [ ] Review `/api/admin/audit` regularly

## Rebuilding seed data

Edit `apps/backend/src/database/seed-data.ts` (single source of truth). The in-memory driver
picks changes up immediately; for PostgreSQL re-run `npm run db:seed` (idempotent upserts).
