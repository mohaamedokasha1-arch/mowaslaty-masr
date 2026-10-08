import { createApp } from './app.js';
import { createDatabase } from './db/index.js';
import { importBundledFeeds } from './database/bundles.js';
import { env } from './utils/env.js';
import { logger } from './utils/logger.js';

async function main() {
  const db = await createDatabase();
  await importBundledFeeds(db);
  const app = createApp(db);

  const port = parseInt(env.PORT, 10);
  const server = app.listen(port, env.HOST, () => {
    logger.info(`🚀 Mowaslaty Egypt API running at http://${env.HOST}:${port}`);
    logger.info(`📊 Environment: ${env.NODE_ENV} | DB driver: ${db.kind}`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, starting graceful shutdown...`);
    server.close(() => {
      logger.info('✅ Server shut down gracefully');
      process.exit(0);
    });
    // Force-exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
