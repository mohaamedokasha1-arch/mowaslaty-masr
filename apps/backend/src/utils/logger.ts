import pino from 'pino';
import { env } from './env.js';

const isTest = env.NODE_ENV === 'test';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  ...(isTest
    ? {}
    : env.NODE_ENV === 'production'
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss' },
          },
        }),
});
