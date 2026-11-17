import type { NextFunction, Request, Response } from 'express';
import { db } from '../db.ts';
import { toSafeUser } from '../access.ts';
import type { SafeUser, UserRow } from '../types.ts';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const row = db
    .prepare('SELECT id, name, email, password_hash, role, specialization, skills FROM users WHERE id = ?')
    .get(userId) as UserRow | undefined;

  if (!row) {
    req.session.destroy(() => {});
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  req.user = toSafeUser(row);
  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Administrator access required' });
    return;
  }
  next();
}
