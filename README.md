# 🚌 مواصلاتي مصر — Mowaslaty Egypt

**المنصة الشاملة لمواصلات مصر** — خطط رحلتك بالأتوبيس والميكروباص والمترو والقطار، وقارن بين
الأسرع والأرخص وأقل تبديلات، مع أسعار ومواعيد محدّثة وبيانات مجتمعية موثّقة.

A production-ready, full-stack transit platform for Egypt: multimodal trip planning, route/stop
browsing, community reporting, and a moderation admin dashboard — Arabic-first (RTL) UIs with SEO.

---

## 🧱 البنية — Architecture

```
mowaslaty-masr/
├── apps/
│   ├── backend/    # Express + TypeScript API, routing engine, Prisma (PostgreSQL) + in-memory DB
│   ├── web/        # Next.js public website (Arabic RTL, Leaflet maps, SEO)
│   └── admin/      # Next.js admin dashboard (JWT auth, moderation tools)
├── packages/
│   └── shared/     # Shared TypeScript types, enums, Arabic labels, geo utils
├── docs/           # architecture, API reference, deployment guides
└── docker-compose.yml  # full stack: PostgreSQL + backend + web + admin
```

| الطبقة | التقنيات |
| --- | --- |
| الواجهة العامة | Next.js 14 (App Router) · React 18 · Leaflet · RTL/Arabic |
| لوحة التحكم | Next.js 14 · JWT auth · مراجعة البلاغات وإدارة الخطوط والمحطات |
| الـ API | Express · Zod validation · Helmet · Rate limiting · Pino logging |
| محرك الرحلات | Dijkstra متعدد الوسائط (مشي + ركوب + تبديلات) بأربعة أوضاع مفاضلة |
| قاعدة البيانات | PostgreSQL via Prisma (production) · In-memory seeded DB (dev/CI) |
| الاختبارات | Vitest + Supertest — 54 اختبارًا (محرك الرحلات، الـ API، الترميز الجغرافي) |

**ملاحظة معمارية مهمة:** طبقة الوصول إلى البيانات (`apps/backend/src/db`) معرفة كواجهة
مستقلة (`Database`) لها تنفيذان: `PrismaDatabase` (PostgreSQL في الإنتاج) و`MemoryDatabase`
(بيانات تجريبية كاملة، صفر إعداد). الـ API والاختبارات تعمل بالكامل على أي منهما.

## 🚀 التشغيل السريع — Quick start (zero-config)

المتطلبات: Node.js ≥ 20. لا حاجة لأي قاعدة بيانات خارجية — الـ API يعمل تلقائيًا على قاعدة
الذاكرة المزروعة ببيانات حقيقية (القاهرة، الزقازيق، الإسماعيلية).

```bash
npm install

# في ثلاث نوافذ طرفية (أو استخدم سكربتات الجذر):
npm run dev:backend   # API          → http://localhost:3001
npm run dev:web       # الموقع العام  → http://localhost:3000
npm run dev:admin     # لوحة التحكم  → http://localhost:3002
```

### جرّب هذه الرحلات
- `ميدان التحرير` → `جامعة الزقازيق` (مباشر بالميكروباص، أو أرخص بالأتوبيس)
- `موقف الزقازيق العمومي` → `حي السلام` (رحلتان: خط المحافظات ثم ميكروباص الإسماعيلية)
- `ميدان التحرير (القاهرة)` → `جامعة الزقازيق` (مترو + مشي + قطار + ميكروباص!)

### حسابات الإدارة (للتطوير)
- `admin@mowaslaty.com` / `admin123` (SUPER_ADMIN)
- `editor@mowaslaty.com` / `editor123` (DATA_ADMIN)

> غيّر كلمة المرور عبر `ADMIN_PASSWORD` في أي نشر حقيقي.

## 🐳 التشغيل الكامل مع PostgreSQL

```bash
docker compose up --build
# db → 5432 · backend → 3001 · web → 3000 · admin → 3002
```

أو يدويًا مع قاعدة موجودة:

```bash
cd apps/backend
cp .env.example .env     # ضع DATABASE_URL و DB_DRIVER=prisma
npm run db:push          # أو: npx prisma migrate deploy
npm run db:seed          # يزرع نفس البيانات التجريبية في PostgreSQL
npm run dev
```

## 🧪 الاختبارات والجودة

```bash
npm test                 # 54 اختبارًا (محرك الرحلات + الـ API كاملًا + الجيوكودر)
npm run type-check       # TypeScript strict
npm run lint             # ESLint
```

## 📡 نظرة على الـ API

| Endpoint | الوصف |
| --- | --- |
| `GET /api/trips/plan?fromText&toText&mode` | تخطيط رحلة (الأسرع/الأرخص/أقل تبديلات/أقل مشي) |
| `GET /api/routes` | الخطوط (فلترة: مدينة، وسيلة، حالة، بحث) |
| `GET /api/routes/:id` | تفاصيل خط بالمحطات مرتبة |
| `GET /api/stops?lat&lng&radius` | محطات قريبة جغرافيًا |
| `GET /api/cities`, `/api/modes` | المدن ووسائل النقل |
| `GET /api/search?query` | بحث موحد (خطوط/محطات/مدن) |
| `POST /api/reports` | بلاغ مجتمعي (مجهول مسموح) |
| `POST /api/admin/auth/login` | دخول إداري (JWT) |
| `GET/PATCH /api/admin/...` | لوحة التحكم: تقارير، خطوط، محطات، سجل تدقيق |
| `GET /api/health`, `/ping` | فحوصات الصحة |

التفاصيل الكاملة في [`docs/api.md`](docs/api.md).

## ➕ إضافة بيانات حقيقية (GTFS وغيرها)

المنصة تتضمن **مستورد GTFS كامل** — الصيغة القياسية العالمية لبيانات النقل:

- **من لوحة التحكم**: صفحة «استيراد GTFS» → ارفع ملفات `.txt` من أي ملف تغذية بعد فك ضغطه
- **من سطر الأوامر**: `npm run import:gtfs -- --dir ./feed --source "اسم المصدر"`
- **مثال جاهز للتجربة**: `apps/backend/sample-gtfs/` — شغّل الاستيراد وشاهد «خط الأحرار»
  يظهر فورًا في الموقع ومحرك الرحلات
- الاستيراد تكراري (بدون تكرار بيانات)، يربط المحطات المتطابقة بالاسم، ويسجل كل شيء في
  سجل التحديثات ومصادر البيانات

التفاصيل الكاملة ومصادر الملفات الحقيقية: [`docs/data-sources.md`](docs/data-sources.md)

## 📚 وثائق إضافية

- [البنية وقرارات التصميم — docs/architecture.md](docs/architecture.md)
- [مرجع الـ API — docs/api.md](docs/api.md)
- [النشر والإعداد — docs/deployment.md](docs/deployment.md)

## 🗺️ البيانات التجريبية المزروعة

- **الزقازيق:** 11 محطة، 4 خطوط ميكروباص/أتوبيس + خط المحافظات للإسماعيلية
- **الإسماعيلية:** 3 محطات وخط داخلي
- **القاهرة:** 7 محطات — مترو الخط الأول، أتوبيس رمسيس–الجيزة، وقطار القاهرة–الزقازيق
- سجل تحديثات، بلاغات نموذجية، ومصادر بيانات (يدوي / OSM / مجتمع)

## 📄 الترخيص

لأغراض العرض والتطوير. بيانات المحطات والأسعار استرشادية.
