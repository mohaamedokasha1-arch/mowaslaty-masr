import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (message = 'Not found') => new ApiError(404, message);
export const badRequest = (message = 'Bad request', details?: unknown) =>
  new ApiError(400, message, details);
export const unauthorized = (message = 'Unauthorized') => new ApiError(401, message);
export const forbidden = (message = 'Forbidden') => new ApiError(403, message);
export const unprocessable = (message: string, details?: unknown) =>
  new ApiError(422, message, details);

export const errorHandler = (
  err: Error | ApiError | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) logger.error(err);
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  logger.error(err);

  if (err instanceof Error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: env_expose(err.message),
    });
  }

  res.status(500).json({ error: 'Unknown Error' });
};

function env_expose(message: string) {
  return process.env.NODE_ENV === 'production' ? undefined : message;
}

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
};
