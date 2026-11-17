import express from 'express';
import session from 'express-session';
import { SqliteSessionStore } from './db.ts';
import { authRouter } from './routes/auth.ts';
import { projectsRouter } from './routes/projects.ts';
import { tasksRouter } from './routes/tasks.ts';
import { transcriptsRouter } from './routes/transcripts.ts';
import { usersRouter } from './routes/users.ts';
import { ensureDemoUsersSeeded } from './seed.ts';

export function isHttpsRequest(req: express.Request): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  return (
    req.secure ||
    (typeof forwardedProto === 'string' &&
      forwardedProto.split(',')[0].trim().toLowerCase() === 'https')
  );
}

export function applySessionCookiePolicy(req: express.Request): void {
  if (!req.session?.cookie) return;
  const https = isHttpsRequest(req);
  req.session.cookie.httpOnly = true;
  req.session.cookie.secure = https;
  req.session.cookie.sameSite = https ? 'none' : 'lax';
}

export function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    'novaworks-dev-session-secret-change-in-production'
  );
}

export function createApiApp(): express.Express {
  ensureDemoUsersSeeded();

  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '1mb' }));

  // Fallback for cross-site iframe contexts (e.g. embedded previews) where browsers block third-party cookies:
  // If no novaworks.sid cookie is present, forward the signed opaque session token from X-Session-Token
  // so express-session still verifies the HMAC signature and resolves the user strictly from SQLite.
  app.use((req, _res, next) => {
    const hasSidCookie =
      typeof req.headers.cookie === 'string' &&
      req.headers.cookie.split(';').some((part) => part.trim().startsWith('novaworks.sid='));
    const headerToken = req.headers['x-session-token'];
    if (!hasSidCookie && typeof headerToken === 'string' && headerToken.startsWith('s:')) {
      const encoded = encodeURIComponent(headerToken);
      req.headers.cookie = req.headers.cookie
        ? `${req.headers.cookie}; novaworks.sid=${encoded}`
        : `novaworks.sid=${encoded}`;
    }
    next();
  });

  const sessionSecret = getSessionSecret();

  app.use(
    session({
      name: 'novaworks.sid',
      secret: sessionSecret,
      store: new SqliteSessionStore(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use((req, _res, next) => {
    applySessionCookiePolicy(req);
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/my-tasks', tasksRouter);
  app.use('/api/transcripts', transcriptsRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  return app;
}
