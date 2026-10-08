import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Database } from '../db/types.js';
import { unauthorized } from '../middleware/error-handler.js';
import { signToken } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function authRouter(db: Database): Router {
  const router = Router();

  // POST /api/admin/auth/login
  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await db.users.byEmail(email);
      if (!user || !user.password) throw unauthorized('بيانات الدخول غير صحيحة');

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw unauthorized('بيانات الدخول غير صحيحة');

      const token = signToken({ id: user.id, email: user.email, role: user.role });
      await db.audit.create({
        userId: user.id,
        userEmail: user.email,
        action: 'auth.login',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
