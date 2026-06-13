# EcoLudus Migration Notes

## New runtime stack

- Frontend host: Next.js 16
- Language support: TypeScript for app/server code
- Backend runtime: Node.js via Next.js route handlers
- Database: PostgreSQL
- Auth/session model: Email/password with secure HTTP-only session cookies

## Local full-version mode

- If PostgreSQL is available, the app uses PostgreSQL.
- If PostgreSQL is not available locally, the app now falls back to a persistent local data store in `data/local-db.json`.
- This keeps signup, login, profiles, teams, and mission data working during local development instead of failing at startup.
- Production must use a real PostgreSQL database. Hosted deployments refuse to use the local file fallback because server files can be reset on each deploy, which would make users appear to lose their accounts.

## Deployment checklist

Set these environment variables on the hosting provider before deploying:

- `DATABASE_URL`: PostgreSQL connection string for the permanent production database.
- `SESSION_SECRET`: a long random string used to keep login sessions valid between deploys.
- `POSTGRES_SSL`: set to `true` if your database provider requires SSL.

After deploy, open `/api/health`. It should return `status: "ok"` and `database: "connected"`.

## How the migration works

- The existing website pages under `public/html/` are preserved so the current design and UX remain intact.
- Firebase browser SDK usage has been replaced with local compatibility modules:
  - `public/js/auth.js`
  - `public/js/firestore-compat.js`
- These compatibility modules now call the new backend APIs under `app/api/`.
- PostgreSQL stores the application state with JSONB-backed documents for compatibility, plus indexed relational columns for auth and team lookups.

## Database structure

Primary tables:

- `users`
- `teams`
- `team_active_missions`
- `team_mission_logs`
- `mission_logs`
- `photo_hashes`

Migration SQL lives in `db/migrations/001_initial.sql`.

## Local setup

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` and `SESSION_SECRET`.
3. Run `npm install`.
4. Run `npm run db:migrate`.
5. Run `npm run dev`.

If you do not have PostgreSQL running locally yet, you can still run `npm run dev` and the app will use the local persistent fallback automatically.

## Important note

The legacy `ecoquest/` folder contains an older untracked experiment and is not used by the new root-level production app.
