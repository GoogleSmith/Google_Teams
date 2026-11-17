# NovaWorks Project CRM — AI Meeting to Project CRM

A full-stack project management CRM built for **NovaWorks Technologies** where an administrator pastes a planning meeting transcript, an AI extraction service converts the final agreed decisions into structured projects and tasks, and role-based access control ensures managers and developer agents see only their permitted work.

## Team
- **Project**: NovaWorks Project CRM (The Infinity Hack '26 — AI Project Manager)
- **Team**: NovaWorks MVP Team (4 participants)
  - Frontend / UI Development: React workspace, role views, transcript form, validation & error displays
  - Backend / Database & Auth: Express API, SQLite schema, bcryptjs + session auth, server-side RBAC
  - AI / Extraction Pipeline: OpenRouter prompt engineering, JSON extraction, Zod + semantic validation
  - Full-Stack Integration & QA: End-to-end transcript verification, edge-case testing, documentation

## What Works
- **Seeded Demo Accounts & Session Auth**: Idempotent `seedDemoUsers` script creates the 10 company accounts (1 Admin, 3 Managers, 6 Developer Agents) with `bcryptjs`-hashed passwords and SQLite-backed `httpOnly` cookie sessions (`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`).
- **Admin Transcript Automation (`POST /api/transcripts/create-from-transcript`)**:
  - Admin-only (returns `403` for Managers and Agents) with per-session concurrency lock to prevent duplicate submissions.
  - Sends the transcript and sanitized team directory (`id`, `name`, `role`, `specialization`, `skills` — never password hashes) to OpenRouter.
  - Parses JSON, validates all projects, manager IDs, agent IDs, positive `estimatedHours`, valid `YYYY-MM-DD` dates, and `task.deadline <= project.deadline` with Zod before saving anything.
  - Saves all projects and tasks atomically in a single SQLite transaction, or returns structured unresolved-field errors while saving nothing.
- **Server-Side Role-Based Access Control**:
  - `ADMIN`: views all projects, all tasks, team directory, and transcript creation.
  - `MANAGER`: views only projects where `manager_id` matches their user ID and tasks inside those projects; direct access to other projects returns `404`.
  - `AGENT`: views only tasks assigned to them (`GET /api/my-tasks`) and related project summaries without seeing other agents' tasks; direct access to unassigned projects returns `404`.
- **Frontend Screens**: Login page (with Demo Accounts quick-fill table), Admin Workspace, Projects List, Project Detail, Agent My Tasks, Read-Only Team Directory, and Logout on every screen.
- **Persistence**: Projects, tasks, users, and sessions persist in a local SQLite database across page refreshes and server restarts.

## Technology Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js 20+, Express 4, TypeScript (`tsx`), `zod`
- **Database**: SQLite via `better-sqlite3` (foreign keys enabled, WAL mode)
- **AI**: OpenRouter Chat Completions API (`https://openrouter.ai/api/v1/chat/completions`) via `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`
- **Authentication / Sessions**: `bcryptjs` password hashing + `express-session` with `httpOnly` cookies stored in SQLite

## Repository Structure
- `/backend` — Express API server, SQLite schema, `seed` and `reset-projects` scripts, RBAC queries, Zod validation, and OpenRouter AI service
- `/frontend` — React + Vite single-page application
- `/sample/meeting-transcript.txt` — Supplied NovaWorks Client Delivery Planning meeting transcript
- `/.env.example` — Environment variable template (placeholders only)
- `/.gitignore` — Excludes `.env`, `node_modules`, `dist/`, and `data/`

## Requirements
- Node.js 20+ and npm
- An OpenRouter API key and a selected OpenRouter model ID (free or paid)

## Run Locally (Separate Backend & Frontend)
1. Install backend and frontend dependencies:
   ```sh
   cd backend && npm install
   cd ../frontend && npm install
   cd ..
   ```
2. Copy `.env.example` to `.env` in the repository root (or inside `backend/.env`) and add your OpenRouter credentials and session secret:
   ```sh
   cp .env.example .env
   ```
3. Seed all 10 demo users (safe to re-run; skips existing emails without creating duplicates):
   ```sh
   cd backend
   npm run seed
   ```
4. Start the backend API server (runs on port `4000`, keep this terminal running):
   ```sh
   cd backend
   npm run dev
   ```
5. In a second terminal, start the frontend Vite dev server (proxies `/api` to `http://localhost:4000`, keep this terminal running):
   ```sh
   cd frontend
   npm run dev
   ```
6. Open the application in your browser at:
   - `http://localhost:5173`

*(Note: A unified root server `npm run dev` on port `3000` is also available if running both in a single process.)*

## Environment Variables
| Variable | Purpose | Where configured |
| --- | --- | --- |
| `PORT` | Backend HTTP port (defaults to `4000`) | Backend `.env` |
| `SESSION_SECRET` | Secret used to sign `express-session` cookies | Backend `.env` |
| `DATABASE_PATH` | Path to the SQLite database file (e.g. `./data/crm.db`) | Backend `.env` |
| `OPENROUTER_API_KEY` | OpenRouter API Bearer token (never exposed to browser) | Backend `.env` |
| `OPENROUTER_MODEL` | OpenRouter model identifier used for transcript extraction | Backend `.env` |

## Demo Login Accounts
All 10 accounts share the password **`Demo123!`**. These are fictional login identifiers; no signup or email verification is needed.

| Role | Name | Demo email | Password |
| --- | --- | --- | --- |
| Admin | Admin | `admin@novaworks.example` | `Demo123!` |
| Manager | Ayesha Khan | `ayesha@novaworks.example` | `Demo123!` |
| Manager | Bilal Ahmed | `bilal@novaworks.example` | `Demo123!` |
| Manager | Hina Malik | `hina@novaworks.example` | `Demo123!` |
| Agent | Ali Raza | `ali@novaworks.example` | `Demo123!` |
| Agent | Hamza Shah | `hamza@novaworks.example` | `Demo123!` |
| Agent | Sara Noor | `sara@novaworks.example` | `Demo123!` |
| Agent | Usman Tariq | `usman@novaworks.example` | `Demo123!` |
| Agent | Zain Abbas | `zain@novaworks.example` | `Demo123!` |
| Agent | Maryam Asif | `maryam@novaworks.example` | `Demo123!` |

## How Judges Can Test
1. Log in as **Admin** (`admin@novaworks.example` / `Demo123!`).
2. In **Create from Transcript**, paste the contents of `sample/meeting-transcript.txt` (or click **Load sample transcript**) and click **Create from Transcript**.
3. Expect **"3 projects and 12 tasks created."**:
   - **UrbanCart Website** (Client: UrbanCart Clothing, Manager: Ayesha Khan, Deadline: `2026-10-20`, 4 tasks / 40h; Website integration and testing due `2026-10-19`)
   - **QuickServe Mobile App** (Client: QuickServe Services, Manager: Bilal Ahmed, Deadline: `2026-10-24`, 4 tasks / 46h; Mobile integration and testing is `10h` by Usman)
   - **HelpDeskPro AI Assistant** (Client: HelpDeskPro Solutions, Manager: Hina Malik, Deadline: `2026-10-22`, 4 tasks / 38h; Assistant evaluation and testing assigned to Maryam)
   - Verify rejected features (payments, inventory, live maps, driver tracking, real emails) and non-employee `Kamran` are excluded.
4. Refresh the browser page to confirm all projects and tasks persist in SQLite.
5. Log out and log in as **Ayesha Khan** (`ayesha@novaworks.example`): confirm only **UrbanCart Website** is visible. Attempting to request another manager's project ID via `/api/projects/:id` returns `404`.
6. Log out and log in as **Ali Raza** (`ali@novaworks.example`): confirm **My Tasks** shows only his 3 UrbanCart tasks, and opening UrbanCart does not show Hamza's task.
7. Log out and log in as **Hamza Shah** (`hamza@novaworks.example`): confirm **My Tasks** shows his 2 API tasks spanning **UrbanCart Website** and **QuickServe Mobile App**.
8. Test a modified transcript (for example, changing QuickServe's *Mobile integration and testing* to `12 hours` and `23 October`) to verify genuine AI extraction responds to updated inputs.

### Reset Generated Projects & Tasks (Keep Seeded Users)
To wipe generated projects and tasks between test runs without deleting the 10 seeded demo users:
```sh
cd backend
npm run reset-projects
```

## Deployment Details
- **Deployment status**: Local only (uses local SQLite database `./data/crm.db`). Record a short demo video walking through login, transcript conversion, role isolation, persistence after refresh, and a modified transcript test.

## Known Limitations
- **AI Model Variability**: Extraction accuracy depends on the configured `OPENROUTER_MODEL`. Smaller or heavily quantized free models may occasionally hit rate limits (`429`) or require a retry if OpenRouter throttles requests; all validation failures safely reject the draft without saving partial data.
- **No Manual Edit/Delete UI**: Per challenge scope, projects and tasks are created automatically from transcripts and viewed read-only in the CRM (no manual project/task editing forms, signup, password reset, charts, or cost tracking).
- **Local SQLite Storage**: Data is stored in a local SQLite file on disk rather than a hosted multi-region database.
