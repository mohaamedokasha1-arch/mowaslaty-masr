import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '3001',
  HOST: process.env.HOST || '0.0.0.0',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  /** Force a driver: "memory" (zero-config, seeded) or "prisma" (PostgreSQL). */
  DB_DRIVER: process.env.DB_DRIVER as 'memory' | 'prisma' | undefined,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '7d',

  // Admin bootstrap
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@mowaslaty.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',

  // External services
  OPENSTREETMAP_API_URL:
    process.env.OPENSTREETMAP_API_URL || 'https://nominatim.openstreetmap.org',
  GEOCODING_ENABLED: process.env.GEOCODING_ENABLED ?? 'true',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN,

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
} as const;

// Validate required env vars in production only.
const requiredEnvVars: Array<keyof typeof env> = ['DATABASE_URL'];
const missing = requiredEnvVars.filter((key) => !env[key]);

if (missing.length > 0 && env.NODE_ENV === 'production' && env.DB_DRIVER !== 'memory') {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}
