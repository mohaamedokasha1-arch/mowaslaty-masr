/**
 * CLI GTFS importer.
 *
 *   # unzip your feed first (a GTFS file is just a zip of CSVs):
 *   unzip feed.zip -d ./my-feed
 *
 *   DATABASE_URL=... DB_DRIVER=prisma \
 *     npx tsx src/database/import-gtfs.ts --dir ./my-feed --source "Cairo GTFS" [--type GTFS] [--url https://...]
 *
 * Notes:
 *  - With the Prisma driver the import persists in PostgreSQL.
 *  - With the in-memory driver the import lives only for that process
 *    (useful for dry runs; the API must stay running to keep the data).
 */
/* eslint-disable no-console */
import { createDatabase } from '../db/index.js';
import { normalizeGtfsToImport, parseGtfsFiles, readGtfsDir } from '../services/gtfs.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dir = arg('dir');
  const source = arg('source') ?? 'GTFS Import';
  const type = arg('type') ?? 'GTFS';
  const url = arg('url');

  if (!dir) {
    console.error('Usage: tsx src/database/import-gtfs.ts --dir <gtfs-folder> --source <name> [--type GTFS] [--url <feed-url>]');
    process.exit(1);
  }

  const db = await createDatabase();
  if (db.kind === 'memory') {
    console.warn('⚠️  DB driver is "memory" — the import will NOT persist across restarts.');
    console.warn('   Set DATABASE_URL (and DB_DRIVER=prisma) to import into PostgreSQL.\n');
  }

  console.log(`📂 Reading GTFS files from ${dir} …`);
  const files = await readGtfsDir(dir);
  const raw = parseGtfsFiles(files);
  console.log(
    `   ${raw.stops.length} stops · ${raw.routes.length} routes · ${raw.trips.length} trips`,
  );

  const { data: cities } = await db.cities.list({ take: 100 });
  const payload = normalizeGtfsToImport(raw, cities, {
    sourceName: source,
    sourceType: type,
    sourceUrl: url,
  });

  console.log('📥 Importing …');
  const summary = await db.importData(payload);

  console.log('\n✅ Import summary:');
  console.log(`   Stops  — created: ${summary.stopsCreated}, linked to existing: ${summary.stopsLinked}`);
  console.log(`   Routes — created: ${summary.routesCreated}, updated: ${summary.routesUpdated}, skipped: ${summary.skippedRoutes}`);
  if (summary.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const w of summary.warnings) console.log(`   - ${w}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Import failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
