import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initSchema } from './db.ts';
import type { UserRole } from './types.ts';

interface DemoAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  specialization: string;
  skills: string[];
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'ADMIN',
    name: 'Admin',
    email: 'admin@novaworks.example',
    role: 'ADMIN',
    specialization: 'Administrator',
    skills: ['Company overview', 'Transcript creation'],
  },
  {
    id: 'PM01',
    name: 'Ayesha Khan',
    email: 'ayesha@novaworks.example',
    role: 'MANAGER',
    specialization: 'Web PM',
    skills: ['Web projects', 'Client coordination'],
  },
  {
    id: 'PM02',
    name: 'Bilal Ahmed',
    email: 'bilal@novaworks.example',
    role: 'MANAGER',
    specialization: 'Mobile PM',
    skills: ['Mobile projects', 'Delivery planning'],
  },
  {
    id: 'PM03',
    name: 'Hina Malik',
    email: 'hina@novaworks.example',
    role: 'MANAGER',
    specialization: 'AI PM',
    skills: ['AI projects', 'Requirement review'],
  },
  {
    id: 'DEV01',
    name: 'Ali Raza',
    email: 'ali@novaworks.example',
    role: 'AGENT',
    specialization: 'Full-Stack',
    skills: ['React', 'Frontend integration'],
  },
  {
    id: 'DEV02',
    name: 'Hamza Shah',
    email: 'hamza@novaworks.example',
    role: 'AGENT',
    specialization: 'Full-Stack',
    skills: ['Node.js', 'Databases', 'APIs'],
  },
  {
    id: 'DEV03',
    name: 'Sara Noor',
    email: 'sara@novaworks.example',
    role: 'AGENT',
    specialization: 'App Developer',
    skills: ['Flutter', 'Mobile UI'],
  },
  {
    id: 'DEV04',
    name: 'Usman Tariq',
    email: 'usman@novaworks.example',
    role: 'AGENT',
    specialization: 'App Developer',
    skills: ['Flutter', 'Integration', 'Testing'],
  },
  {
    id: 'DEV05',
    name: 'Zain Abbas',
    email: 'zain@novaworks.example',
    role: 'AGENT',
    specialization: 'AI Developer',
    skills: ['LLMs', 'Extraction', 'Prompts'],
  },
  {
    id: 'DEV06',
    name: 'Maryam Asif',
    email: 'maryam@novaworks.example',
    role: 'AGENT',
    specialization: 'AI Developer',
    skills: ['Retrieval', 'Document processing'],
  },
];

export function seedDemoUsers(): { inserted: number; skipped: number } {
  initSchema();

  const findByEmail = db.prepare('SELECT id FROM users WHERE email = ?');
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, specialization, skills)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const passwordHash = bcrypt.hashSync('Demo123!', 10);

  let inserted = 0;
  let skipped = 0;

  const runSeed = db.transaction(() => {
    for (const account of DEMO_ACCOUNTS) {
      const existing = findByEmail.get(account.email) as { id: string } | undefined;
      if (existing) {
        skipped += 1;
        continue;
      }

      insertUser.run(
        account.id,
        account.name,
        account.email,
        passwordHash,
        account.role,
        account.specialization,
        JSON.stringify(account.skills)
      );
      inserted += 1;
    }
  });

  runSeed();
  return { inserted, skipped };
}

export function ensureDemoUsersSeeded(): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  if (row.count === 0) {
    seedDemoUsers();
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = seedDemoUsers();
  console.log(
    `Seed complete: ${result.inserted} user(s) inserted, ${result.skipped} existing user(s) skipped.`
  );
}
