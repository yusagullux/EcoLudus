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

`scripts/setup-dev.ps1` / `setup-dev.cmd` wipe `.next`/`node_modules`, reinstall, and start the dev server (interactive). `npm test` runs **vitest** (config in `vitest.config.ts`; repo global env is jsdom, so jose-based tests use a `// @vitest-environment node` pragma). `test:photo-proof` is a one-off `scripts/test-photo-verification.ts`; the other `scripts/test-*.ts` are ad-hoc tsx scripts, not part of the vitest suite. Copy `.env.example` to `.env.local` for local env.

## Environment

Key integrations (all keys in `.env.local`, see `.env.example`): **Brevo** (`BREVO_API_KEY`/`BREVO_FROM`) sends the transactional auth emails (signup verification + password reset) — distinct from **SendGrid** (`SENDGRID_API_KEY`/`SENDGRID_FROM`), which only sends the weekly impact reports. Others: `SESSION_SECRET` (required in prod), `CRON_SECRET` (bearer gate for `/api/cron/*`), `CLIMATIQ_API_KEY`, `GEMINI_API_KEY`/`GEMINI_MODEL`, `ECOLOGI_API_KEY`, `APP_URL` (builds absolute verify/reset links). Without `DATABASE_URL` the app falls back to a local JSON file DB in dev only (see Data layer); `LOCAL_DB_MODE=postgres` forces Postgres.

## Architecture

### Auth

`lib/auth.ts`: passwords hashed with `bcrypt` (cost 12), sessions are **JWT signed with `jose`** in an `httpOnly` `ecoquest_session` cookie (14-day TTL) carrying a `token_version` claim; `getSession()` returns null if the claim mismatches the DB (revocation — bumping `token_version` on password change / email verification invalidates all cookies without a session table). `requireVerifiedUser()` is the gate for reward/action routes (401 `auth/unauthenticated` or `auth/email-not-verified`). API routes return Firebase-style error codes as `{ error: { code: "auth/…" } }`.

**Email verification + account management** (design spec: `docs/superpowers/specs/2026-09-01-auth-account-management-design.md`): signup creates an unverified user with a session cookie (soft gate — unverified users browse game routes but reward routes 401). Auth routes: `/api/auth/signup`, `login`, `me`, `verify-email` (GET, token is credential), `resend-verification`, `forgot-password` (**anti-enumeration: always 200**), `reset-password`, `delete-account` (password + typing "DELETE" + hCaptcha; cascade hard-delete). Tokens are randomUUID stored as **SHA-256 hashes** (`lib/auth-tokens.ts`; raw token only in the email link). Emails via Brevo (`lib/email.ts`, failures swallowed — never surface provider errors). hCaptcha on signup/forgot/delete; `rateLimit()` on all auth routes. New-user verification pages live under root `app/`. Existing users were backfilled `email_verified=true` via the `add column default true` then `alter set default false` migration trick (no mass logout on deploy).

`lib/useAuth.ts` (client hook) bootstraps via `GET /api/auth/me`, then reads/writes the profile through the `/api/store` RPC (see below). `lib/auth-persistence.ts` handles "remember me" localStorage.

### Data layer — dual-mode Postgres / file store

`lib/db.ts` exports `sql(text, params)` and `transaction(callback)`. **Mode is auto-detected**: Postgres via `pg` Pool (capped `max:1` on Vercel/serverless, `max:10` locally) when a connection string is present and reachable; otherwise a JSON file store at `data/local-db.json` in non-hosted dev. **In production with no DB it throws `DatabaseSetupError` rather than silently using the ephemeral file store.**

Critical detail: the file fallback (`fileSql`) emulates Postgres by **string-matching the exact normalized SQL text** of each query the app issues. A new SQL query must (a) reuse an existing query string, (b) add a matching `fileSql` branch, or (c) run only against real Postgres — otherwise local dev throws `Unsupported file database query`.

Migrations: `ensureMigrations()` in `lib/db.ts` runs an inline idempotent schema automatically on first pool connect; `npm run db:migrate` (`scripts/migrate.ts` + `db/migrations/*.sql`) is a separate manual path — `002_lockdown_public_api.sql` enables RLS / revokes PostgREST access (the app talks to Postgres directly). `db.ts`, `document-store.ts`, and `migrate.ts` are `@ts-nocheck` — type errors won't surface; be careful editing them.

### Document-store RPC (`/api/store`)

`app/api/store/route.ts` is a single POST endpoint accepting `{ op, path, data, filters, limit }` with ops `getDoc|setDoc|updateDoc|deleteDoc|addDoc|getDocs`, validated with zod. `lib/document-store.ts` maps document paths (e.g. `["users", uid]`) to Postgres tables and enforces **row-level permissions** (users read/write only their own profile; team access requires membership). `updateDoc` supports sentinels `__delete_field__` / `__increment__`. It was once a Firestore-compatibility shim (hence the op names); the backing is now Postgres but the RPC shape was kept to avoid churning client callers: `lib/useAuth.ts` reads the profile via `getDoc(["users", uid])`, and `lib/auth-client.ts` exposes `logOut`, `updateUserProfile`, `getAllUsers`.

**The user profile is a JSON blob**: most game state lives in `users.payload` jsonb (`xp`, `level`, `ecoPoints`, `carbonReduced`, `missionsCompleted`, `completedQuests`, `plants`, `animals`, `chests`, `trustScore`, team membership, …). Routes read the row, mutate the payload in JS, then upsert with parameterized `insert ... on conflict (id) do update`; `xp`/`level`/`trust_score` are also promoted to real columns for aggregate queries.

### Gamification & quests

- **Leveling** (`lib/level-system.ts`): level is *derived* from XP by `requiredXP(level) = 100*level + 25*level²`. **Not** the 9-step Cat→Lion table in the old docs — that table is stale. Also holds badge helpers (`getBadgeImageForLevel`, `getBadgeNameForLevel`), `getXPProgress`, `calculateEcoPoints` — import from `@/lib/level-system`, not `public/js`.
- **Quests** live in `public/quests.json` (each quest has `xp`, `ecoCoins`, `carbonFootprintReduction`, `progressLogic`, and a `requiresPhoto` flag). `lib/carbon-calc.ts` resolves definitions and carbon values (optionally via Climatiq with a 30-day `carbon_cache` table). Photo-quest detection comes from the `requiresPhoto` flag via `questRequiresPhoto(questsData, id)` — adding a photo quest is a data edit.
- **Quest completion** (`app/api/quests/complete/route.ts`): validates against today's daily set, requires photo proof where applicable, computes rewards, applies companion-pet bonuses, rolls a "daily clear" chest, writes `mission_logs`, fires milestone processing.
- **Catalogs (shop + team missions):** live in Postgres `catalog_items` / `team_mission_templates`, seeded idempotently by `ensureMigrations()` and `db/migrations/006_catalogs.sql`, mirrored in `lib/catalog.ts` and the file-fallback `EMPTY_STORE` — **keep all three in sync when editing the seed**. `lib/catalog-server.ts` exposes the getters; `GET /api/catalog/shop` and `/api/catalog/team-templates` serve them (no auth — prices aren't secret). **The server is the source of truth for prices and team-mission rewards**: `/api/shop/buy` and `/api/teams` `assign` look the item/template up by id and ignore client-supplied values, so clients can't buy cheaper or start missions with inflated rewards.
- **Species catalogs (pets + seeds):** no runtime-editable values, so they are TS constants in `lib/catalog.ts` (`PET_CATALOG` — 13 companion animals; `SEED_CATALOG` — 8 seeds) — no `fileSql` branch needed. The hatch route rolls its per-rarity pet pool from `PET_CATALOG` and the chest route rolls its per-tier seed pool from `SEED_CATALOG`, so drops can't desync from the collection page, which is a **Pokédex** (`app/(game)/collection/page.tsx`): full master list per tab (plants/eggs/pets/seeds/chests), undiscovered species as locked silhouettes, per-tab "X/Y discovered" counter. Discovery is binary "owned = discovered" (unlocked iff the species `name` appears in the corresponding owned profile array). `lib/__tests__/catalog-species.test.ts` locks this contract.
- **Photo / private-mission verification**: `lib/photo-verification.ts`, `lib/private-missions.ts`, `lib/private-mission-verification.ts`, `lib/trust-system.ts`, `lib/quest-proof.ts`. Submissions land in `mission_submissions` with a `trust_score` that modulates XP (`xp_transactions`, `trust_history`). Requires `GEMINI_API_KEY` for AI verification.
- **Milestones / real trees**: `lib/rewards-sync.ts` plants real trees via Ecologi when users cross milestones.

## Conventions

- **Always authenticate first** in API routes: `const session = await getSession(); if (!session) return 401`.
- **Validate input with zod** at the route boundary (see any `app/api/*/route.ts`).
- **Return errors** as `{ error: { code: "<firebase-style-code>", ... } }` with matching HTTP status; `app/api/firestore/route.ts` maps `auth/unauthenticated`→401, `permission-denied`→403.
- **Path alias** `@/*` → repo root (configured in `tsconfig.json`).
- When adding DB-backed features, remember the file-DB fallback needs an exact-match SQL branch — prefer reusing existing query strings. `lib/__tests__/catalog-filesql.test.ts` guards this contract for the catalog queries (it asserts every `catalog-server.ts` query has a matching `fileSql` branch); mirror that pattern when adding more.
- `tsconfig.json` excludes `node_modules`, `ecoquest`, and `legacy` directories; don't import from them.

Cron routes under `app/api/cron/` have their own CLAUDE.md with details (schedules live in `vercel.json`).