import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Router } from 'express';
import { toSafeUser } from '../access.ts';
import { applySessionCookiePolicy, getSessionSecret, isHttpsRequest } from '../app.ts';
import { db } from '../db.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';
import type { UserRow } from '../types.ts';
import { loginSchema } from '../validation.ts';

export const authRouter = Router();

function signSessionId(sid: string): string {
  const mac = crypto
    .createHmac('sha256', getSessionSecret())
    .update(sid)
    .digest('base64')
    .replace(/=+$/, '');
  return `s:${sid}.${mac}`;
}

authRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email or password' });
    return;
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const row = db
    .prepare('SELECT id, name, email, password_hash, role, specialization, skills FROM users WHERE lower(email) = ?')
    .get(normalizedEmail) as UserRow | undefined;

  if (!row || !bcrypt.compareSync(parsed.data.password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  req.session.regenerate((regenErr) => {
    if (regenErr) {
      res.status(500).json({ error: 'Failed to create session' });
      return;
    }

    applySessionCookiePolicy(req);
    req.session.userId = row.id;
    req.session.save((saveErr) => {
      if (saveErr) {
        res.status(500).json({ error: 'Failed to save session' });
        return;
      }
      res.json({
        user: toSafeUser(row),
        sessionToken: signSessionId(req.sessionID),
      });
    });
  });
});

authRouter.post('/logout', (req, res) => {
  const https = isHttpsRequest(req);
  req.session.destroy((err) => {
    res.clearCookie('novaworks.sid', {
      path: '/',
      httpOnly: true,
      sameSite: https ? 'none' : 'lax',
      secure: https,
    });
    if (err) {
      res.status(500).json({ error: 'Failed to log out' });
      return;
    }
    res.json({ ok: true });
  });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});
