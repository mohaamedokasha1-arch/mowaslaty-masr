import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import { MemoryDatabase } from './memory-db.js';
import type { Database } from './types.js';

export type { Database } from './types.js';

/**
 * Chooses the database driver:
 *  - "prisma" when DB_DRIVER=prisma (or DATABASE_URL is set), using PostgreSQL
 *  - "memory" otherwise: a fully-seeded in-memory store (zero-config)
 */
export async function createDatabase(): Promise<Database> {
  const wantsPrisma =
    env.DB_DRIVER === 'prisma' || (env.DB_DRIVER !== 'memory' && Boolean(env.DATABASE_URL));

  if (wantsPrisma) {
    try {
      const { PrismaDatabase } = await import('./prisma-db.js');
      const db = await PrismaDatabase.connect();
      logger.info('🗄️  Database: PostgreSQL via Prisma');
      return db;
    } catch (err) {
      if (env.DB_DRIVER === 'prisma') throw err;
      logger.warn(
        { err: err instanceof Error ? err.message : err },
        '⚠️  Prisma unavailable — falling back to the in-memory database',
      );
    }
  }

  logger.info('🗄️  Database: in-memory (seeded demo data)');
  return new MemoryDatabase();
}
