import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../utils/env.js';
import { unauthorized, forbidden } from './error-handler.js';
import type { UserRole } from '@mowaslaty/shared';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export function signToken(user: AuthUser): string {
  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('Missing bearer token'));
  }
  try {
    const decoded = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtPayload;
    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

const ADMIN_ROLES: UserRole[] = ['DATA_ADMIN', 'MODERATOR', 'SUPER_ADMIN'];

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (!ADMIN_ROLES.includes(req.user.role)) {
    return next(forbidden('Insufficient permissions'));
  }
  next();
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'SUPER_ADMIN') {
    return next(forbidden('Super admin only'));
  }
  next();
}
