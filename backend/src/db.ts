import Database from 'better-sqlite3';
import session from 'express-session';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from current working directory or repository root
const cwdEnv = path.resolve(process.cwd(), '.env');
const rootEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(cwdEnv)) {
  dotenv.config({ path: cwdEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured && !configured.startsWith('sk-') && !configured.startsWith('Bearer ')) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  if (configured && (configured.startsWith('sk-') || configured.startsWith('Bearer '))) {
    console.warn(
      'Warning: DATABASE_PATH appears to contain an API key rather than a file path. Using default ./data/crm.db instead.'
    );
  }
  return path.resolve(__dirname, '../../data/crm.db');
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MANAGER', 'AGENT')),
      specialization TEXT,
      skills TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      description TEXT,
      manager_id TEXT NOT NULL REFERENCES users(id),
      deadline TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      assignee_id TEXT NOT NULL REFERENCES users(id),
      deadline TEXT NOT NULL,
      estimated_hours REAL NOT NULL CHECK(estimated_hours > 0)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
}

initSchema();

export class SqliteSessionStore extends session.Store {
  private getStmt = db.prepare('SELECT sess, expires_at FROM sessions WHERE sid = ?');
  private setStmt = db.prepare(
    'INSERT INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at'
  );
  private destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
  private pruneStmt = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

  get(sid: string, callback: (err?: unknown, session?: session.SessionData | null) => void): void {
    try {
      const now = Date.now();
      const row = this.getStmt.get(sid) as { sess: string; expires_at: number } | undefined;
      if (!row) {
        callback(null, null);
        return;
      }
      if (row.expires_at < now) {
        this.destroyStmt.run(sid);
        callback(null, null);
        return;
      }
      const parsed = JSON.parse(row.sess) as session.SessionData;
      callback(null, parsed);
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    try {
      const maxAge = sess.cookie?.maxAge ?? 24 * 60 * 60 * 1000;
      const expiresAt = Date.now() + maxAge;
      this.setStmt.run(sid, JSON.stringify(sess), expiresAt);
      // Opportunistically clean expired sessions
      if (Math.random() < 0.05) {
        this.pruneStmt.run(Date.now());
      }
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      this.destroyStmt.run(sid);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    this.set(sid, sess, callback);
  }
}
