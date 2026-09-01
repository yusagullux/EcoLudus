# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ The `docs/` directory is stale

`README.md` has been updated to the real stack. The `docs/` directory, however, is a leftover **Firebase + vanilla HTML/JS** GitHub Pages site (it has a `CNAME`) — `docs/README.md`, `docs/SCHEMA.md`, `docs/MIGRATION.md`, and the `docs/*.html` pages all describe the old Firebase/Firestore app. Do **not** trust `docs/` for the current architecture. The real stack is **Next.js 16 (App Router) + React 19 + Postgres + JWT sessions**. (The `docs/` Pages site was left in place because deleting its `CNAME` would take down a live URL — remove it only if you intend to retire that domain.)

## Commands

```bash
npm run dev              # Next.js dev server
npm run build            # Production build
npm run lint             # next lint
npm run db:migrate       # Apply db/migrations/*.sql to the configured Postgres (tsx)
npm run test:photo-proof # Standalone photo-verification test script
```

`scripts/setup-dev.ps1` / `setup-dev.cmd` wipe `.next`/`node_modules`, reinstall, and start the dev server (interactive).

`npm test` runs **vitest** (config in `vitest.config.ts`; repo global env is jsdom, so jose-based tests use a `// @vitest-environment node` pragma). `test:photo-proof` is a one-off `scripts/test-photo-verification.ts`, and the other `scripts/test-*.ts` are ad-hoc tsx scripts, not part of the vitest suite.

## Environment

Copy `.env.example` to `.env.local`. Key variables:

- `DATABASE_URL` (or Vercel-injected `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`) — Postgres connection. Without it the app falls back to a local JSON file DB in dev only (see Data layer).
- `SESSION_SECRET` — required in production; signs JWT cookies.
- `LOCAL_DB_MODE=postgres` — force Postgres instead of the file fallback.
- `CRON_SECRET` — bearer token authenticating the `/api/cron/*` jobs.
- Optional integrations: `CLIMATIQ_API_KEY` (carbon estimates), `GEMINI_API_KEY`/`GEMINI_MODEL` (AI photo/mission verification), `ECOLOGI_API_KEY` (real tree planting), `SENDGRID_API_KEY`/`SENDGRID_FROM` (weekly emails).
- `BREVO_API_KEY`/`BREVO_FROM` (transactional auth emails: signup verification + password reset — Brevo only, distinct from SendGrid weekly reports). `APP_URL` builds the absolute verify/reset links (defaults to `http://localhost:3000`).

## Architecture

### Routing & layout

Next.js App Router. Two route layers:

- **Root (marketing/unauth):** `app/page.tsx`, `app/landing`, `app/login`, `app/signup`, `app/legal/*`.
- **`app/(game)/`** — authenticated app behind a shared `layout.tsx` that calls `useAuth()` and renders the `Sidebar` + `ThemeProvider`. Pages: `dashboard`, `habits`, `shop`, `collection`, `garden`, `pets`, `insights`, `impact`, `premium`, `profile`, `team`, `friends`, `leaderboard`, `settings`.

`app/layout.tsx` is the root layout (fonts: Baloo_2 headings, Open Sans body; Vercel Analytics; JSON-LD; manifest).

### Auth

`lib/auth.ts`: passwords hashed with `bcrypt` (cost 12), sessions are **JWT signed with `jose`** stored in an `httpOnly` `ecoquest_session` cookie (14-day TTL). The JWT carries a `token_version` claim; `getSession()` verifies the cookie, reads the user's `email_verified` + `token_version` from Postgres, and returns `{ userId, email, emailVerified, tokenVersion } | null` — returning null if the claim mismatches the DB (revocation). Bumping `token_version` (on password change or email verification) invalidates all existing cookies for that user without a server-side session table. `requireVerifiedUser()` is the gate for reward/action routes: it returns the session or a 401 `auth/unauthenticated` (no session) / 401 `auth/email-not-verified` (session exists but email unverified). Call one of these at the top of any authenticated API route. API routes return Firebase-style error codes as `{ error: { code: "auth/…" } }` with appropriate HTTP status.

**Email verification + account management** (design spec: `docs/superpowers/specs/2026-09-01-auth-account-management-design.md`): signup creates an unverified user, sets a session cookie (soft gate — unverified users can browse game routes but reward/action routes return 401 `auth/email-not-verified`), and emails a verification link. Auth routes: `/api/auth/signup`, `/api/auth/login` (401 `auth/email-not-verified` for unverified users, cookie still set), `/api/auth/me`, `/api/auth/verify-email` (GET, token is credential), `/api/auth/resend-verification`, `/api/auth/forgot-password` (anti-enumeration: always 200), `/api/auth/reset-password`, `/api/auth/delete-account` (re-auth: password + typing "DELETE" + hCaptcha; cascade hard-delete). Tokens are randomUUID stored as **SHA-256 hashes** in `verification_tokens` / `password_reset_tokens` (raw token only in the email link); `lib/auth-tokens.ts` handles create/consume. Emails sent via Brevo through `lib/email.ts` (failures swallowed, never surface provider errors to the client). hCaptcha on signup/forgot/delete; `rateLimit()` on all auth routes. New pages under root `app/`: `verify-email`, `resend-verification`, `forgot-password`, `reset-password`, `delete-account`. Existing users were backfilled `email_verified=true` via the `add column default true` then `alter set default false` migration trick (no mass logout on deploy).

`lib/useAuth.ts` (client hook) bootstraps via `GET /api/auth/me` (which returns `{ user, profile, emailVerified }`), then reads/writes the user profile through the `/api/firestore` RPC (see below). Unauthenticated users visiting a game route are redirected to `/login`. `lib/auth-persistence.ts` handles "remember me" localStorage.

### Data layer — dual-mode Postgres / file store

`lib/db.ts` exports `sql(text, params)` and `transaction(callback)`. **Mode is auto-detected**: if a Postgres connection string is present and reachable, it uses a `pg` Pool (capped at `max:1` on Vercel/serverless, `max:10` locally); otherwise, in non-hosted dev, it falls back to a JSON file store at `data/local-db.json` (or `/tmp/local-db.json` when `VERCEL` is set). **In production with no DB it throws `DatabaseSetupError` rather than silently using the ephemeral file store.**

Critical detail: the file fallback (`fileSql`) emulates Postgres by **string-matching the exact normalized SQL text** of each query the app issues. If you write a *new* SQL query, you must either (a) keep using an existing query string, or (b) add a matching branch to `fileSql`, or (c) only run it against real Postgres. Otherwise local dev (no DB) will throw `Unsupported file database query`.

Migrations: `ensureMigrations()` in `lib/db.ts` runs an inline idempotent schema (creates all tables) automatically the first time the pool connects. `scripts/migrate.ts` + `db/migrations/*.sql` is a separate, manual migration path (applied via `npm run db:migrate`) — `db/migrations/002_lockdown_public_api.sql` enables RLS / revokes PostgREST access because the app talks to Postgres directly, not via the Supabase Data API.

`db.ts`, `document-store.ts`, and `migrate.ts` are `@ts-nocheck` — be careful editing them; type errors won't surface.

### Document-store RPC (`/api/store`)

`app/api/store/route.ts` is a single POST endpoint accepting `{ op, path, data, filters, limit }` with ops `getDoc|setDoc|updateDoc|deleteDoc|addDoc|getDocs`, validated with zod. `lib/document-store.ts` maps those document paths (e.g. `["users", uid]`, `["teams", teamId, "activeMissions", id]`) to the Postgres tables and enforces **row-level permissions** (users can only read/write their own profile; team access requires membership). `updateDoc` supports sentinel values `__delete_field__` and `__increment__` (field-transform semantics). This was once a Firestore-compatibility shim (hence the `getDoc`/`setDoc` op names); the Firebase/Firestore backing is gone and it now talks directly to Postgres, but the RPC shape was kept to avoid churning every client caller.

**Client callers:** `lib/useAuth.ts` reads the profile via `getDoc(["users", uid])`. `lib/auth-client.ts` exposes `logOut`, `updateUserProfile` (`updateDoc`), and `getAllUsers` (`getDocs`) for components/pages. These are the replacements for the deleted `public/js/auth.js`.

### The user profile is a JSON blob

Most game state lives in the `users.payload` **jsonb** column — a single object holding `xp`, `level`, `ecoPoints`, `carbonReduced`, `missionsCompleted`, `completedQuests`, `dailyQuestsCompleted`, `currentDailyQuests`, `plants`, `animals` (pets), `chests`, `trustScore`, team membership, etc. (Compare against `docs/SCHEMA.md`'s "Database Schema" section for field names, but ignore its Firebase framing.) API routes read the row, mutate the payload in JS, then upsert with a parameterized `insert ... on conflict (id) do update`. `xp`/`level`/`trust_score` are also promoted to real columns for aggregate queries.

### Gamification & quests

- **Leveling** (`lib/level-system.ts`): level is *derived* from XP by the formula `requiredXP(level) = 100*level + 25*level²`. This is **not** the 9-step Cat→Lion table in the old docs — that table is stale. `calculateLevel()` walks the curve; levels mod 5/10 grant garden/team rewards. This module also holds the badge helpers (`getBadgeImageForLevel`, `getBadgeNameForLevel`), `getXPProgress`, and `calculateEcoPoints` (ported from the deleted `public/js/levels.js`) — import these from `@/lib/level-system`, not from `public/js`.
- **Quests** live in `public/quests.json` (categories → quests, each with `xp`, `ecoCoins`, `carbonFootprintReduction`, `progressLogic`, and a `requiresPhoto` flag). `lib/carbon-calc.ts` resolves quest definitions and carbon values, optionally enriching via the Climatiq API with a 30-day `carbon_cache` table. The dashboard's photo-quest check is derived from the `requiresPhoto` flag on the quest definition (via `questRequiresPhoto(questsData, id)`), not a hardcoded id list — adding a photo quest is a data edit.
- **Quest completion** (`app/api/quests/complete/route.ts`): validates selected quests against today's daily set, requires photo proof where applicable, computes XP/eco/carbon rewards, applies companion-pet bonuses, rolls a "daily clear" chest, updates the payload, writes `mission_logs`, and fires milestone processing.
- **Catalogs (shop + team missions + species):** shop items and team-mission templates live in Postgres `catalog_items` and `team_mission_templates` (seeded idempotently by `ensureMigrations()` and `db/migrations/006_catalogs.sql`; the seed data is mirrored in `lib/catalog.ts` and the file-fallback `EMPTY_STORE` — keep all three in sync when editing the seed). `lib/catalog-server.ts` exposes `getShopCatalog` / `getShopItem` / `getTeamMissionTemplates` / `getTeamMissionTemplate`; `GET /api/catalog/shop` and `GET /api/catalog/team-templates` serve the display-only catalog (no auth — prices aren't secret). The **server is the source of truth for prices and team-mission rewards**: `/api/shop/buy` looks the item up by `(mode, itemId)` and ignores any client-supplied price, and `/api/teams` `assign` looks the template up by `missionId` and ignores client-supplied `xp`/`eco`/`needed`/`title`/`icon` — so a client cannot buy cheaper or start a team mission with inflated rewards. Editing a price/reward in the DB takes effect with no code deploy.
  - **Species catalogs (pets + seeds)** have no runtime-editable values, so they live as TS constants in `lib/catalog.ts` (`PET_CATALOG` — 13 companion animals; `SEED_CATALOG` — 8 seed varieties) rather than DB tables — no `fileSql` branch needed. `lib/catalog-server.ts` exposes `getPetCatalog` / `getSeedCatalog`, and `GET /api/catalog/species` serves both (no auth — names/images aren't secret). The hatch route (`/api/eggs/incubate`) rolls its per-rarity pet pool from `PET_CATALOG`, and the chest route (`/api/chests/open`) rolls its per-tier seed pool from subsets of `SEED_CATALOG` — so drops can't desync from what the Pokédex shows. The collection page (`app/(game)/collection/page.tsx`) is a **Pokédex**: it renders the full master list per tab (plants/eggs/pets/seeds/chests) from these APIs, with undiscovered species as locked silhouettes and a per-tab "X/Y discovered" counter. Discovery is binary "owned = discovered" — a species is unlocked iff its `name` appears in the corresponding owned profile array (`profile.seeds` is the seeds array, written by the chest route); no server writes happen on acquisition. `lib/__tests__/catalog-species.test.ts` locks the contract between the catalogs and the routes that roll from them.
- **Photo / private-mission verification**: `lib/photo-verification.ts`, `lib/private-missions.ts`, `lib/private-mission-verification.ts`, `lib/trust-system.ts`, `lib/quest-proof.ts`. Submissions land in `mission_submissions` with a `trust_score` that modulates XP (`xp_transactions`, `trust_history`). Requires `GEMINI_API_KEY` for AI verification.
- **Milestones / real trees**: `lib/rewards-sync.ts` plants real trees via Ecologi when users cross milestones.

### Cron jobs (vercel.json)

Three cron routes, all gated by `Authorization: Bearer <CRON_SECRET>` and exported as both GET and POST (Vercel Cron sends GET):

- `/api/cron/process-rewards` — 02:00 UTC daily; milestone tree-planting.
- `/api/cron/send-weekly-reports` — 08:00 UTC Mondays; SendGrid impact emails (`lib/email-templates/`).
- `/api/cron/keep-alive` — 04:00 UTC daily.

## Conventions

- **Always authenticate first** in API routes: `const session = await getSession(); if (!session) return 401`.
- **Validate input with zod** at the route boundary (see any `app/api/*/route.ts`).
- **Return errors** as `{ error: { code: "<firebase-style-code>", ... } }` with matching HTTP status; `app/api/firestore/route.ts` maps `auth/unauthenticated`→401, `permission-denied`→403.
- **Path alias** `@/*` → repo root (configured in `tsconfig.json`).
- When adding DB-backed features, remember the file-DB fallback needs an exact-match SQL branch — prefer reusing existing query strings. `lib/__tests__/catalog-filesql.test.ts` guards this contract for the catalog queries (it asserts every `catalog-server.ts` query has a matching `fileSql` branch); mirror that pattern when adding more.
- `tsconfig.json` excludes `node_modules`, `ecoquest`, and `legacy` directories; don't import from them.