/**
 * Bundled real-world feeds.
 *
 * Real open datasets are vendored under apps/backend/feeds/<name>/ and are
 * imported automatically at server startup (idempotent). Each feed has a
 * meta.json (source name/type/URL, license, Arabic route-name overrides) and
 * a gtfs/ directory with the original files + SOURCE.md attribution.
 *
 * Current feeds (both CC BY-NC 4.0 — attribution required, non-commercial):
 *  - portsaid-city-bus : 13 bus/minibus/ferry lines, 678 stops (Port Said)
 *  - cairo-metro-2016  : Cairo Metro lines 1–3 (Transport for Cairo, 2016)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from '../db/types.js';
import type { ImportSummary } from '@mowaslaty/shared';
import { logger } from '../utils/logger.js';
import { normalizeGtfsToImport, parseGtfsFiles, readGtfsDir } from '../services/gtfs.js';

const FEEDS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'feeds');

interface FeedMeta {
  sourceName: string;
  sourceType: string;
  sourceUrl?: string;
  license?: string;
  routeNameAr?: Record<string, string>;
}

export interface BundleResult extends ImportSummary {
  ok: boolean;
}

/** Import every bundled feed. Never throws — a broken feed must not stop the server. */
export async function importBundledFeeds(db: Database): Promise<BundleResult[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(FEEDS_DIR);
  } catch {
    logger.debug('No bundled feeds directory found — skipping');
    return [];
  }

  const results: BundleResult[] = [];

  for (const entry of entries.sort()) {
    const feedDir = path.join(FEEDS_DIR, entry);
    const metaPath = path.join(feedDir, 'meta.json');
    try {
      const stat = await fs.stat(feedDir);
      if (!stat.isDirectory()) continue;

      const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8')) as FeedMeta;
      const files = await readGtfsDir(path.join(feedDir, 'gtfs'));
      const raw = parseGtfsFiles(files);
      const { data: cities } = await db.cities.list({ take: 100 });
      const payload = normalizeGtfsToImport(raw, cities, {
        sourceName: meta.sourceName,
        sourceType: meta.sourceType,
        sourceUrl: meta.sourceUrl,
      });

      // Apply curated Arabic route names when provided.
      if (meta.routeNameAr) {
        for (const r of payload.routes) {
          const nameAr = meta.routeNameAr[r.externalId];
          if (nameAr) {
            r.nameAr = nameAr;
            r.name = nameAr;
          }
        }
      }

      const summary = await db.importData(payload);
      results.push({ ...summary, ok: true });
      logger.info(
        `📦 Feed "${meta.sourceName}": +${summary.stopsCreated} محطة، ربط ${summary.stopsLinked}، +${summary.routesCreated} خط، تحديث ${summary.routesUpdated}`,
      );
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : err },
        `⚠️  Bundled feed "${entry}" failed to import — continuing`,
      );
      results.push({
        ok: false,
        sourceName: entry,
        stopsCreated: 0,
        stopsLinked: 0,
        routesCreated: 0,
        routesUpdated: 0,
        skippedRoutes: 0,
        warnings: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  return results;
}
