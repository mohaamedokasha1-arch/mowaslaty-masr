/**
 * Prisma seed script (PostgreSQL).
 * Maps the shared seed dataset (src/database/seed-data.ts) into the database.
 *
 * Usage: DATABASE_URL=... npm run db:seed
 *
 * The in-memory driver used in development is seeded from the same dataset
 * automatically — this script is only needed for PostgreSQL deployments.
 */
/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import {
  areas as seedAreas,
  cities as seedCities,
  dataSources as seedDataSources,
  dataUpdates as seedDataUpdates,
  modes as seedModes,
  routes as seedRoutes,
  sampleReports,
  stops as seedStops,
} from './seed-data.js';

async function main() {
  // Imported lazily so environments without a generated Prisma client can
  // still load the rest of the codebase.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('@prisma/client');
  const prisma = new mod.PrismaClient();

  try {
    console.log('🌱 Starting database seeding...');

    const dayMs = 86_400_000;
    const now = Date.now();

    // ============= Transport modes =============
    for (const m of seedModes) {
      await prisma.transportMode.upsert({
        where: { name: m.name },
        update: {},
        create: { name: m.name, nameAr: m.nameAr, icon: m.icon, color: m.color, description: m.description },
      });
    }
    console.log(`✅ Ensured ${seedModes.length} transport modes`);

    // ============= Cities & areas =============
    const cityIds = new Map<string, string>();
    for (const c of seedCities) {
      const city = await prisma.city.upsert({
        where: { name: c.name },
        update: {},
        create: {
          name: c.name,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          latitude: c.latitude,
          longitude: c.longitude,
          description: c.description,
        },
      });
      cityIds.set(c.ref, city.id);
    }
    console.log(`✅ Ensured ${seedCities.length} cities`);

    const areaIds = new Map<string, string>();
    for (const a of seedAreas) {
      const cityId = cityIds.get(a.cityRef)!;
      const area = await prisma.area.upsert({
        where: { cityId_name: { cityId, name: a.name } },
        update: {},
        create: { name: a.name, nameAr: a.nameAr, cityId },
      });
      areaIds.set(a.ref, area.id);
    }
    console.log(`✅ Ensured ${seedAreas.length} areas`);

    // ============= Stops =============
    const stopIds = new Map<string, string>();
    for (const s of seedStops) {
      const existing = await prisma.stop.findFirst({
        where: { name: s.name, cityId: cityIds.get(s.cityRef)! },
      });
      const data = {
        name: s.name,
        nameAr: s.nameAr,
        latitude: s.latitude,
        longitude: s.longitude,
        address: s.address ?? null,
        type: s.type,
        cityId: cityIds.get(s.cityRef)!,
        areaId: s.areaRef ? areaIds.get(s.areaRef) ?? null : null,
        verified: s.verified ?? false,
        verifiedAt: s.verified ? new Date(now - 60 * dayMs) : null,
      };
      const stop = existing
        ? await prisma.stop.update({ where: { id: existing.id }, data })
        : await prisma.stop.create({ data });
      stopIds.set(s.ref, stop.id);
    }
    console.log(`✅ Ensured ${seedStops.length} stops`);

    // ============= Routes =============
    const modeByName = new Map<string, string>();
    for (const m of seedModes) {
      const row = await prisma.transportMode.findUnique({ where: { name: m.name } });
      if (row) modeByName.set(m.ref, row.id);
    }

    const routeIds = new Map<string, string>();
    for (const [i, r] of seedRoutes.entries()) {
      const cityId = cityIds.get(r.cityRef)!;
      const transportModeId = modeByName.get(r.modeRef)!;
      const existing = await prisma.route.findFirst({ where: { name: r.name, cityId } });
      const data = {
        name: r.name,
        nameAr: r.nameAr,
        description: r.description ?? null,
        transportModeId,
        cityId,
        fare: r.fare,
        fareType: r.fareType,
        operatingHours: r.operatingHours ?? null,
        status: r.status,
        confidenceLevel: r.confidence,
        dataSource: r.dataSource,
        fareUpdatedAt: new Date(now - 20 * dayMs),
        lastVerifiedAt: r.confidence === 'HIGH' || r.confidence === 'MEDIUM' ? new Date(now - 10 * dayMs) : null,
        publishedAt: new Date(now - (90 - i) * dayMs),
      };
      const route = existing
        ? await prisma.route.update({ where: { id: existing.id }, data })
        : await prisma.route.create({ data });
      routeIds.set(r.ref, route.id);

      // Stops ordering (replace existing)
      await prisma.routeStop.deleteMany({ where: { routeId: route.id } });
      for (const [order, ref] of r.stopRefs.entries()) {
        await prisma.routeStop.create({
          data: { routeId: route.id, stopId: stopIds.get(ref)!, order: order + 1 },
        });
      }
    }
    console.log(`✅ Ensured ${seedRoutes.length} routes with stops`);

    // ============= Data sources =============
    for (const d of seedDataSources) {
      await prisma.dataSource.upsert({
        where: { name: d.name },
        update: {},
        create: {
          name: d.name,
          sourceType: d.sourceType,
          url: 'url' in d ? d.url ?? null : null,
          description: d.description,
        },
      });
    }
    console.log('✅ Ensured data sources');

    // ============= Data updates (change log) =============
    const updateCount = await prisma.dataUpdate.count();
    if (updateCount === 0) {
      for (const u of seedDataUpdates) {
        await prisma.dataUpdate.create({
          data: {
            routeId: routeIds.get(u.routeRef)!,
            changeType: u.changeType,
            description: u.description,
            createdAt: new Date(now - u.daysAgo * dayMs),
          },
        });
      }
      console.log(`✅ Created ${seedDataUpdates.length} data updates`);
    }

    // ============= Sample reports =============
    const reportCount = await prisma.transitReport.count();
    if (reportCount === 0) {
      for (const r of sampleReports) {
        await prisma.transitReport.create({
          data: {
            reportType: r.reportType,
            routeId: r.routeRef ? routeIds.get(r.routeRef) ?? null : null,
            stopId: r.stopRef ? stopIds.get(r.stopRef) ?? null : null,
            description: r.description,
            status: r.status,
            createdAt: new Date(now - r.daysAgo * dayMs),
          },
        });
      }
      console.log(`✅ Created ${sampleReports.length} sample reports`);
    }

    // ============= Admin users =============
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mowaslaty.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        password: bcrypt.hashSync(adminPassword, 10),
        name: 'مدير النظام',
        role: 'SUPER_ADMIN',
      },
    });
    await prisma.user.upsert({
      where: { email: 'editor@mowaslaty.com' },
      update: {},
      create: {
        email: 'editor@mowaslaty.com',
        password: bcrypt.hashSync('editor123', 10),
        name: 'مسؤول البيانات',
        role: 'DATA_ADMIN',
      },
    });
    console.log('✅ Ensured admin users');

    console.log('🎉 Database seeding completed successfully!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Seeding failed:', e);
  process.exit(1);
});
