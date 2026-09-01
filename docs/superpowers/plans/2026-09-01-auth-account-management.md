# Auth & Account-Management Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship email verification, unverified-aware sign-in, anti-enumeration password reset, and re-authed cascade account deletion on top of the existing Next.js + Postgres + JWT-cookie auth system.

**Architecture:** No second auth system. Extend `lib/auth.ts` (stateless JWT cookies signed with `jose`) with a `token_version` JWT claim checked against the DB for session revocation. Store verification/reset tokens in two new Postgres tables as SHA-256 hashes (raw token only in the email link). Email sending is a single Brevo-only `fetch` module, distinct from the untouched SendGrid weekly-report cron. The server is the real gate via a new `requireVerifiedUser()`; the client soft-gates browsing. Hard delete via FK `on delete cascade` plus an explicit `team_active_missions` cleanup.

**Tech Stack:** Next.js 16 App Router, React 19, Postgres (`pg`), `jose` JWT, `bcryptjs`, `zod`, Brevo HTTP API (plain `fetch`), hCaptcha, vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-auth-account-management-design.md` — this plan argues from the spec; executors read both.

## Global Constraints

- Email provider is **Brevo only** — no SendGrid reference in any new code. The SendGrid cron (`lib/email-templates/` weekly reports + `/api/cron/send-weekly-reports`) stays untouched.
- Tokens are stored as **SHA-256 of the raw token**; the raw token exists only in the email link and is never logged.
- Every new SQL query string gets a matching `fileSql` branch in `lib/db.ts`, or local dev (no DB) throws `Unsupported file database query`. The file-fallback `EMPTY_STORE` and `FileStore` types must be kept in sync.
- `db.ts` is `@tsnocheck` — type errors won't surface; be careful and rely on `npm run build`/`npm test`.
- API errors are `{ error: { code: "<firebase-style-code>", ... } }` with matching HTTP status; `auth/unauthenticated`→401, `auth/invalid-input`→400.
- Always authenticate first in routes: `const session = await getSession(); if (!session) return 401`.
- Validate input with zod at the route boundary.
- Anti-enumeration: never reveal whether an email is registered (login + forgot-password return generic responses with timing equalized via `DUMMY_PASSWORD_HASH`).
- `getSession()` is authoritative — never trust client-supplied user IDs.
- Test runner is **vitest** (`npm test` / `npm run test:watch`). The CLAUDE.md "no test runner" line is stale.
- Path alias `@/*` → repo root.
- Brevo endpoint: `POST https://api.brevo.com/v3/smtp/email` with headers `accept: application/json`, `api-key: <BREVO_API_KEY>`, `content-type: application/json`; body `{ sender:{name,email}, to:[{email,name}], subject, htmlContent, textContent }` (confirmed via Context7 `/websites/developers_brevo`).
- Token expiries: verification 24h, reset 1h.
- Rate limits: signup 5/hr, login 10/5min, resend 3/hr, forgot 5/hr, reset 10/hr, delete 3/hr.
- hCaptcha on: signup (existing), forgot-password, delete-account.

---

## File Structure

**New files:**
- `lib/auth-tokens.ts` — token generate/hash/create/consume helpers (DB-backed, SHA-256 hashed).
- `lib/email.ts` — Brevo-only transactional sender (plain `fetch`, swallow failures).
- `db/migrations/007_auth_account_management.sql` — manual migration mirror of the schema changes.
- `app/api/auth/verify-email/route.ts` — GET: consume token → mark verified → redirect.
- `app/api/auth/resend-verification/route.ts` — POST: session-gated resend.
- `app/api/auth/forgot-password/route.ts` — POST: anti-enumeration reset link.
- `app/api/auth/reset-password/route.ts` — POST: consume reset token → new password.
- `app/api/auth/delete-account/route.ts` — POST: re-auth → cascade delete → clear cookie.
- `app/verify-email/page.tsx`, `app/resend-verification/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `app/delete-account/page.tsx` — the five new pages.
- `lib/__tests__/auth-tokens.test.ts` — unit tests for hash/generate.
- `lib/__tests__/auth-email.test.ts` — unit tests for Brevo body + no-op.
- `lib/__tests__/auth-filesql.test.ts` — contract test: every auth query string has a `fileSql` branch.

**Modified files:**
- `lib/db.ts` — schema (2 columns + 2 tables + backfill), `FileStore`/`UserRow` types, `EMPTY_STORE`, new + updated `fileSql` branches.
- `lib/auth.ts` — `token_version` in JWT; `getSession()` DB read + revocation check; `requireVerifiedUser()`.
- `app/api/auth/signup/route.ts` — insert unverified, create + send verification token, soft-gate cookie, response shape.
- `app/api/auth/login/route.ts` — select `email_verified`/`token_version`, unverified handling, cookie with token version.
- `app/api/auth/me/route.ts` — return `emailVerified`.
- `components/auth-card.tsx` — "Forgot password?" link, "Resend verification" link on `auth/email-not-verified`, `emailVerified` handling.
- `app/(game)/settings/page.tsx` — verification status + resend + delete-account link.
- `lib/useAuth.ts` — carry `emailVerified`, unverified banner.
- `.env.example` — `BREVO_API_KEY`, `BREVO_FROM`, `APP_URL`.

---

## Task 1: DB schema, fileSql branches, and FileStore types

**Files:**
- Modify: `lib/db.ts` (ensureMigrations ~L1500, `FileStore` type ~L115, `UserRow` ~L14, `EMPTY_STORE` ~L146, `fileSql` branches)
- Create: `db/migrations/007_auth_account_management.sql`
- Test: `lib/__tests__/auth-filesql.test.ts` (skeleton — full assertions added in Task 11)

**Interfaces:**
- Produces: the exact normalized SQL strings below. Every later task that issues SQL MUST use these exact strings verbatim (the file-fallback string-matches on normalized text). The strings are:
  - `select email_verified, token_version from users where id = $1 limit 1`
  - `select id, email, password_hash, email_verified, token_version, payload from users where email = $1 limit 1` (replaces the old login query)
  - `insert into verification_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)`
  - `select user_id, expires_at from verification_tokens where token_hash = $1 limit 1`
  - `delete from verification_tokens where token_hash = $1`
  - `insert into password_reset_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)`
  - `select user_id, expires_at, used_at from password_reset_tokens where token_hash = $1 limit 1`
  - `update password_reset_tokens set used_at = now() where token_hash = $1`
  - `update users set email_verified = true, token_version = token_version + 1 where id = $1`
  - `update users set password_hash = $1, token_version = token_version + 1 where id = $2`
  - (existing, reused) `delete from team_active_missions where payload->>'user_id' = $1`
  - (existing, extended) `delete from users where id = $1`

- [ ] **Step 1: Add the schema to `ensureMigrations()` in `lib/db.ts`**

Append this block inside the ``migrationSql`` template literal, immediately before the closing backtick (after the last `create index` statement, ~L1789):

```sql

-- Auth & account management: email verification + password reset tokens,
-- plus email_verified / token_version on users. Mirrored in
-- db/migrations/007_auth_account_management.sql. Backfill: existing rows get
-- email_verified=true by adding the column with default true, then flipping the
-- default to false for new signups. token_version starts at 0 for everyone.
alter table users
  add column if not exists email_verified boolean not null default true,
  add column if not exists token_version integer not null default 0;
alter table users alter column email_verified set default false;

create table if not exists verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_verification_tokens_hash on verification_tokens(token_hash);
create index if not exists idx_verification_tokens_user on verification_tokens(user_id);

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_reset_tokens_hash on password_reset_tokens(token_hash);
create index if not exists idx_password_reset_tokens_user on password_reset_tokens(user_id);
```

Note the backfill trick: `add column ... default true` sets existing rows to `true` on first run; `alter column ... set default false` flips the default so future signups (which omit the column from their INSERT) get `false`. On subsequent boots both statements are no-ops — no re-backfill of unverified users.

- [ ] **Step 2: Create `db/migrations/007_auth_account_management.sql`**

```sql
-- 007_auth_account_management.sql
-- Email verification + password-reset token tables, and email_verified /
-- token_version columns on users. Also created by ensureMigrations() in
-- lib/db.ts (the runtime source of truth); this file lets a manual
-- `npm run db:migrate` against an existing DB pick them up.
--
-- Backfill: existing users are marked email_verified=true by adding the column
-- with default true, then flipping the default to false for new signups.

alter table users
  add column if not exists email_verified boolean not null default true,
  add column if not exists token_version integer not null default 0;
alter table users alter column email_verified set default false;

create table if not exists verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_verification_tokens_hash on verification_tokens(token_hash);
create index if not exists idx_verification_tokens_user on verification_tokens(user_id);

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_reset_tokens_hash on password_reset_tokens(token_hash);
create index if not exists idx_password_reset_tokens_user on password_reset_tokens(user_id);
```

- [ ] **Step 3: Extend `UserRow` and `FileStore` types in `lib/db.ts`**

Add `email_verified` and `token_version` to `UserRow` (~L14):

```ts
type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  token_version: number;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
```

Add token-table row types near the other row types (e.g. after `MissionLogRow`):

```ts
type VerificationTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

type PasswordResetTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};
```

Add the two arrays to `FileStore` (~L115, after `team_mission_templates`):

```ts
  verification_tokens: VerificationTokenRow[];
  password_reset_tokens: PasswordResetTokenRow[];
```

Add the two empty arrays to `EMPTY_STORE` (~L146, after `team_mission_templates: ...`):

```ts
  verification_tokens: [],
  password_reset_tokens: [],
```

- [ ] **Step 4: Update the existing login-query `fileSql` branch**

Find the branch (normalized `select id, email, password_hash, payload from users where email = $1 limit 1`) and replace it so it also returns the new columns:

```ts
  if (normalized === "select id, email, password_hash, email_verified, token_version, payload from users where email = $1 limit 1") {
    const email = String(params[0] ?? "");
    const row = store.users.find((user) => user.email === email);
    return result(
      row
        ? ([{ id: row.id, email: row.email, password_hash: row.password_hash, email_verified: row.email_verified, token_version: row.token_version, payload: clone(row.payload) }] as unknown as T[])
        : []
    );
  }
```

- [ ] **Step 5: Extend the existing `delete from users where id = $1` branch to cascade-clean file arrays**

Find the branch (~L1058) and replace it so file mode also removes the user's owned rows (mirroring the Postgres FK cascade + the explicit team_active_missions cleanup):

```ts
  if (normalized === "delete from users where id = $1") {
    const id = String(params[0] ?? "");
    store.users = store.users.filter((user) => user.id !== id);
    store.mission_logs = store.mission_logs.filter((entry) => entry.user_id !== id);
    store.mission_submissions = store.mission_submissions.filter((entry) => entry.user_id !== id);
    store.private_mission_logs = store.private_mission_logs.filter((entry) => entry.user_id !== id);
    store.xp_transactions = store.xp_transactions.filter((entry) => (entry as any).user_id !== id);
    store.trust_history = store.trust_history.filter((entry) => (entry as any).user_id !== id);
    store.impact_events = store.impact_events.filter((entry) => entry.user_id !== id);
    store.team_progress = store.team_progress.filter((entry) => (entry as any).user_id !== id);
    store.photo_hashes = store.photo_hashes.filter((entry) => entry.user_id !== id);
    store.team_active_missions = store.team_active_missions.filter((entry) => String((entry.payload as any)?.user_id ?? "") !== id);
    store.verification_tokens = store.verification_tokens.filter((entry) => entry.user_id !== id);
    store.password_reset_tokens = store.password_reset_tokens.filter((entry) => entry.user_id !== id);
    // teams.created_by → set null (mirrors on delete set null)
    store.teams = store.teams.map((team) => (team.created_by === id ? { ...team, created_by: null } : team));
    await persistStore();
    return result([], "DELETE");
  }
```

- [ ] **Step 6: Add the new `fileSql` branches**

Add these branches inside `fileSql` (place them near the other user branches, before the final `throw`):

```ts
  if (normalized === "select email_verified, token_version from users where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.users.find((user) => user.id === id);
    return result(
      row
        ? ([{ email_verified: row.email_verified, token_version: row.token_version }] as unknown as T[])
        : []
    );
  }

  if (normalized === "insert into verification_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)") {
    const [id, userId, tokenHash, expiresAt] = params;
    // Replace any previous unused token for this user (one outstanding verify token).
    store.verification_tokens = store.verification_tokens.filter((entry) => entry.user_id !== String(userId));
    store.verification_tokens.push({
      id: String(id),
      user_id: String(userId),
      token_hash: String(tokenHash),
      expires_at: String(expiresAt),
      created_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (normalized === "select user_id, expires_at from verification_tokens where token_hash = $1 limit 1") {
    const tokenHash = String(params[0] ?? "");
    const row = store.verification_tokens.find((entry) => entry.token_hash === tokenHash);
    return result(row ? ([{ user_id: row.user_id, expires_at: row.expires_at }] as unknown as T[]) : []);
  }

  if (normalized === "delete from verification_tokens where token_hash = $1") {
    const tokenHash = String(params[0] ?? "");
    store.verification_tokens = store.verification_tokens.filter((entry) => entry.token_hash !== tokenHash);
    await persistStore();
    return result([], "DELETE");
  }

  if (normalized === "insert into password_reset_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)") {
    const [id, userId, tokenHash, expiresAt] = params;
    // One outstanding reset token per user.
    store.password_reset_tokens = store.password_reset_tokens.filter((entry) => entry.user_id !== String(userId));
    store.password_reset_tokens.push({
      id: String(id),
      user_id: String(userId),
      token_hash: String(tokenHash),
      expires_at: String(expiresAt),
      used_at: null,
      created_at: nowIso()
    });
    await persistStore();
    return result([], "INSERT");
  }

  if (normalized === "select user_id, expires_at, used_at from password_reset_tokens where token_hash = $1 limit 1") {
    const tokenHash = String(params[0] ?? "");
    const row = store.password_reset_tokens.find((entry) => entry.token_hash === tokenHash);
    return result(
      row ? ([{ user_id: row.user_id, expires_at: row.expires_at, used_at: row.used_at }] as unknown as T[]) : []
    );
  }

  if (normalized === "update password_reset_tokens set used_at = now() where token_hash = $1") {
    const tokenHash = String(params[0] ?? "");
    const row = store.password_reset_tokens.find((entry) => entry.token_hash === tokenHash);
    if (row) row.used_at = nowIso();
    await persistStore();
    return result([], "UPDATE");
  }

  if (normalized === "update users set email_verified = true, token_version = token_version + 1 where id = $1") {
    const id = String(params[0] ?? "");
    const row = store.users.find((user) => user.id === id);
    if (row) {
      row.email_verified = true;
      row.token_version = row.token_version + 1;
      row.updated_at = nowIso();
    }
    await persistStore();
    return result([], "UPDATE");
  }

  if (normalized === "update users set password_hash = $1, token_version = token_version + 1 where id = $2") {
    const [passwordHash, id] = [String(params[0] ?? ""), String(params[1] ?? "")];
    const row = store.users.find((user) => user.id === id);
    if (row) {
      row.password_hash = passwordHash;
      row.token_version = row.token_version + 1;
      row.updated_at = nowIso();
    }
    await persistStore();
    return result([], "UPDATE");
  }
```

Also update the two existing user INSERT branches (`insert into users (id, email, password_hash, payload) ...`) so the file-store rows they create include the new columns with correct defaults. In the plain insert branch (~L852) set the pushed/updated row to `email_verified: false, token_version: 0`. In the `coalesce((select password_hash ...))` upsert branch (~L876) and the xp/level upsert branch (~L900), do the same for newly-created rows (set `email_verified: false, token_version: 0`; for existing rows leave `email_verified`/`token_version` untouched).

- [ ] **Step 7: Create the contract test skeleton `lib/__tests__/auth-filesql.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Regression guard mirroring lib/__tests__/catalog-filesql.test.ts: the file-DB
// fallback in lib/db.ts (`fileSql`) string-matches the EXACT normalized SQL text
// of each query. Every auth query issued by lib/auth-tokens.ts, lib/auth.ts, and
// the auth API routes MUST have a matching `if (normalized === "...")` branch in
// lib/db.ts, or local dev (no Postgres) throws "Unsupported file database query".

function normalizeSql(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

const dbSource = readFileSync(path.join(process.cwd(), "lib", "db.ts"), "utf8").replace(/\s+/g, " ");

function hasBranch(sql: string) {
  const needle = `if (normalized === "${normalizeSql(sql)}")`;
  return dbSource.includes(needle);
}

const AUTH_QUERIES = [
  "select email_verified, token_version from users where id = $1 limit 1",
  "select id, email, password_hash, email_verified, token_version, payload from users where email = $1 limit 1",
  "insert into verification_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)",
  "select user_id, expires_at from verification_tokens where token_hash = $1 limit 1",
  "delete from verification_tokens where token_hash = $1",
  "insert into password_reset_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)",
  "select user_id, expires_at, used_at from password_reset_tokens where token_hash = $1 limit 1",
  "update password_reset_tokens set used_at = now() where token_hash = $1",
  "update users set email_verified = true, token_version = token_version + 1 where id = $1",
  "update users set password_hash = $1, token_version = token_version + 1 where id = $2",
  "delete from team_active_missions where payload->>'user_id' = $1",
  "delete from users where id = $1"
];

describe("auth fileSql contract", () => {
  it.each(AUTH_QUERIES)("has a fileSql branch for: %s", (sql) => {
    expect(hasBranch(sql), `Missing fileSql branch for: ${sql}`).toBe(true);
  });
});
```

- [ ] **Step 8: Run the contract test**

Run: `npm test -- auth-filesql`
Expected: PASS (all 12 queries have branches after Steps 4–6).

- [ ] **Step 9: Build to confirm no type/compile errors**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add lib/db.ts db/migrations/007_auth_account_management.sql lib/__tests__/auth-filesql.test.ts
git commit -m "feat(auth): schema + fileSql branches for verification/reset tokens

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: `lib/auth-tokens.ts` — token helpers

**Files:**
- Create: `lib/auth-tokens.ts`
- Test: `lib/__tests__/auth-tokens.test.ts`

**Interfaces:**
- Consumes: `sql` from `@/lib/db`; `randomUUID`/`createHash` from `crypto`. The exact SQL strings from Task 1.
- Produces:
  - `generateToken(): string` — returns a raw random token (UUID string, no dashes is fine; we use `randomUUID()`).
  - `hashToken(raw: string): string` — SHA-256 hex of the raw token.
  - `createVerificationToken(userId: string): Promise<string>` — inserts a hashed 24h-expiry row, returns the RAW token (caller puts it in the email link).
  - `createResetToken(userId: string): Promise<string>` — inserts a hashed 1h-expiry row, returns the RAW token.
  - `consumeVerificationToken(raw: string): Promise<{ status: "ok"; userId: string } | { status: "expired" } | { status: "invalid" }>` — peek-then-delete; single-use.
  - `consumeResetToken(raw: string): Promise<{ status: "ok"; userId: string } | { status: "expired" } | { status: "used" } | { status: "invalid" }>` — peek-then-mark-used; single-use.

- [ ] **Step 1: Write the failing test `lib/__tests__/auth-tokens.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { generateToken, hashToken } from "@/lib/auth-tokens";

describe("auth-tokens", () => {
  it("generateToken returns a unique non-empty string each call", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("hashToken returns the SHA-256 hex of the raw token", () => {
    const raw = "abc-123";
    const expected = createHash("sha256").update(raw).digest("hex");
    expect(hashToken(raw)).toBe(expected);
  });

  it("hashToken is deterministic", () => {
    expect(hashToken("same")).toBe(hashToken("same"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth-tokens`
Expected: FAIL (`generateToken`/`hashToken` not exported — module not found).

- [ ] **Step 3: Create `lib/auth-tokens.ts`**

```ts
import { createHash, randomUUID } from "crypto";
import { sql } from "@/lib/db";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export function generateToken(): string {
  return randomUUID();
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function isoFromNow(ttlMs: number): string {
  return new Date(Date.now() + ttlMs).toISOString();
}

// Insert a hashed verification token (24h). Returns the RAW token — the caller
// puts it in the email link; only the hash is stored. Any prior unused
// verification token for this user is replaced first (file branch enforces this;
// for Postgres we delete-then-insert in one round-trip via the file-equivalent).
export async function createVerificationToken(userId: string): Promise<string> {
  const raw = generateToken();
  const tokenHash = hashToken(raw);
  const expiresAt = isoFromNow(VERIFICATION_TTL_MS);
  await sql(
    "insert into verification_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)",
    [randomUUID(), userId, tokenHash, expiresAt]
  );
  return raw;
}

export async function createResetToken(userId: string): Promise<string> {
  const raw = generateToken();
  const tokenHash = hashToken(raw);
  const expiresAt = isoFromNow(RESET_TTL_MS);
  await sql(
    "insert into password_reset_tokens (id, user_id, token_hash, expires_at) values ($1, $2, $3, $4)",
    [randomUUID(), userId, tokenHash, expiresAt]
  );
  return raw;
}

export type ConsumeResult =
  | { status: "ok"; userId: string }
  | { status: "expired" }
  | { status: "invalid" };

export type ResetConsumeResult =
  | { status: "ok"; userId: string }
  | { status: "expired" }
  | { status: "used" }
  | { status: "invalid" };

// Peek-then-delete so we can distinguish expired from invalid. Single-use: the
// row is deleted whether valid or expired, so a link can only ever be consumed
// once.
export async function consumeVerificationToken(raw: string): Promise<ConsumeResult> {
  const tokenHash = hashToken(raw);
  const peek = await sql<{ user_id: string; expires_at: string }>(
    "select user_id, expires_at from verification_tokens where token_hash = $1 limit 1",
    [tokenHash]
  );
  const row = peek.rows[0];
  if (!row) return { status: "invalid" };
  await sql("delete from verification_tokens where token_hash = $1", [tokenHash]);
  if (new Date(row.expires_at).getTime() <= Date.now()) return { status: "expired" };
  return { status: "ok", userId: row.user_id };
}

// Peek-then-mark-used so we can distinguish expired / reused / invalid. The
// used_at guard makes reuse impossible: once consumed, used_at is set and a
// second consume returns { status: "used" }.
export async function consumeResetToken(raw: string): Promise<ResetConsumeResult> {
  const tokenHash = hashToken(raw);
  const peek = await sql<{ user_id: string; expires_at: string; used_at: string | null }>(
    "select user_id, expires_at, used_at from password_reset_tokens where token_hash = $1 limit 1",
    [tokenHash]
  );
  const row = peek.rows[0];
  if (!row) return { status: "invalid" };
  if (row.used_at) return { status: "used" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { status: "expired" };
  await sql("update password_reset_tokens set used_at = now() where token_hash = $1", [tokenHash]);
  return { status: "ok", userId: row.user_id };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- auth-tokens`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth-tokens.ts lib/__tests__/auth-tokens.test.ts
git commit -m "feat(auth): token generate/hash/create/consume helpers

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 3: `lib/email.ts` — Brevo sender + env vars

**Files:**
- Create: `lib/email.ts`
- Modify: `.env.example`
- Test: `lib/__tests__/auth-email.test.ts`

**Interfaces:**
- Consumes: `BREVO_API_KEY`, `BREVO_FROM` env vars. `fetch` (Node 18+ global).
- Produces: `sendEmail({ to, toName?, subject, html, text }): Promise<{ ok: boolean }>` — POSTs to Brevo; on non-2xx logs + returns `{ ok: false }`; no-op `{ ok: false }` when `BREVO_API_KEY` is missing (dev). Callers never throw on email outage.

- [ ] **Step 1: Add env vars to `.env.example`**

Append after the SendGrid block:

```env
# ── Brevo (transactional auth emails: verification + password reset) ───────
# Distinct from SendGrid (weekly impact cron). Brevo-only in the new sender.
BREVO_API_KEY=
BREVO_FROM=hello@ecoludus.com
# Absolute base URL for verify/reset email links. Defaults to http://localhost:3000 in dev.
APP_URL=http://localhost:3000
```

- [ ] **Step 2: Write the failing test `lib/__tests__/auth-email.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail } from "@/lib/email";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.stubEnv("BREVO_API_KEY", "test-key");
  vi.stubEnv("BREVO_FROM", "hello@ecoludus.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("returns {ok:false} and does not call fetch when BREVO_API_KEY is missing", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>", text: "t" });
    expect(res.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the Brevo body shape to the Brevo endpoint and returns ok on 2xx", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await sendEmail({ to: "u@example.com", toName: "U", subject: "Verify", html: "<h1/>", text: "verify" });
    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("https://api.brevo.com/v3/smtp/email");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.sender.email).toBe("hello@ecoludus.com");
    expect(body.to[0].email).toBe("u@example.com");
    expect(body.to[0].name).toBe("U");
    expect(body.subject).toBe("Verify");
    expect(body.htmlContent).toBe("<h1/>");
    expect(body.textContent).toBe("verify");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["api-key"]).toBe("test-key");
    expect(headers["content-type"]).toBe("application/json");
  });

  it("returns {ok:false} and swallows on non-2xx (never throws)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("err", { status: 400 }));
    const res = await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>", text: "t" });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- auth-email`
Expected: FAIL (module `@/lib/email` not found).

- [ ] **Step 4: Create `lib/email.ts`**

```ts
import { logger, logError } from "@/lib/logger";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export type SendEmailInput = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = { ok: boolean };

// Brevo-only transactional sender (plain fetch, no SDK). Distinct from the
// SendGrid weekly-report cron. Failures are logged and swallowed — callers
// never throw on email outage, and provider errors are never surfaced to the
// client. No-op (returns {ok:false}) when BREVO_API_KEY is missing (dev).
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("BREVO_API_KEY not configured — skipping email send");
    return { ok: false };
  }

  const from = process.env.BREVO_FROM?.trim() || "hello@ecoludus.com";
  const fromName = process.env.BREVO_FROM_NAME?.trim() || "EcoLudus";

  const body = {
    sender: { name: fromName, email: from },
    to: [{ email: input.to, name: input.toName ?? input.to }],
    subject: input.subject,
    htmlContent: input.html,
    textContent: input.text
  };

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    if (!response.ok) {
      // Log without the body (credentials/PII never logged).
      logError(`Brevo send failed: ${response.status} ${response.statusText}`);
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    logError("Brevo send threw", error);
    return { ok: false };
  }
}

// Build an absolute verify/reset URL from APP_URL (default localhost:3000).
export function appUrl(): string {
  return (process.env.APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- auth-email`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/email.ts .env.example lib/__tests__/auth-email.test.ts
git commit -m "feat(auth): Brevo transactional email sender

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 4: Extend `lib/auth.ts` — token_version claim, revocation, `requireVerifiedUser`

**Files:**
- Modify: `lib/auth.ts`
- Test: `lib/__tests__/auth-session.test.ts`

**Interfaces:**
- Consumes: `sql` from `@/lib/db`; the `select email_verified, token_version from users where id = $1 limit 1` query from Task 1.
- Produces:
  - `createSessionToken` / `setSessionCookie` now accept `{ sub, email, tokenVersion }` and add `token_version` to the JWT payload.
  - `getSession()` returns `{ userId, email, emailVerified, tokenVersion } | null` — does a DB read, returns null on missing user or `token_version` mismatch (revocation). Unverified users still get a session (soft gate).
  - `requireVerifiedUser(): Promise<{ userId, email, emailVerified, tokenVersion } | NextResponse>` — returns the session or a 401 `auth/unauthenticated` / 401 `auth/email-not-verified` response. Used by reward/action routes.

- [ ] **Step 1: Write the failing test `lib/__tests__/auth-session.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { jwtVerify } from "jose";
import { createSessionToken } from "@/lib/auth";

const SECRET = "test-secret-at-least-32-chars-long-xxxxx";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createSessionToken", () => {
  it("includes token_version in the JWT payload", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const token = await createSessionToken({ sub: "user-1", email: "a@b.com", tokenVersion: 3 });
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET), { algorithms: ["HS256"] });
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("a@b.com");
    expect(payload.token_version).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth-session`
Expected: FAIL (`createSessionToken` doesn't accept `tokenVersion` / claim missing).

- [ ] **Step 3: Modify `lib/auth.ts`**

Replace the `SessionPayload` type, `createSessionToken`, `getSession`, and add `requireVerifiedUser`. Add imports at top:

```ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
```

Replace the `SessionPayload` type:

```ts
type SessionPayload = {
  sub: string;
  email: string;
  tokenVersion: number;
};
```

Replace `createSessionToken`:

```ts
export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ email: payload.email, token_version: payload.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}
```

Replace `getSession` (now DB-backed for revocation; unverified users still get a session — the soft gate is enforced by `requireVerifiedUser`):

```ts
export type Session = {
  userId: string;
  email: string;
  emailVerified: boolean;
  tokenVersion: number;
};

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"]
    });

    if (!payload.sub || typeof payload.email !== "string") {
      return null;
    }

    // Claim vs DB check. Old cookies (pre-feature) carry no token_version —
    // treat as 0, matching the DB default, so the deploy doesn't log everyone
    // out. A mismatch (password changed / email verified on another device)
    // revokes this session.
    const claimVersion = typeof payload.token_version === "number" ? payload.token_version : 0;

    const result = await sql<{ email_verified: boolean; token_version: number }>(
      "select email_verified, token_version from users where id = $1 limit 1",
      [payload.sub]
    );

    const row = result.rows[0];
    if (!row) return null;
    if (Number(row.token_version) !== claimVersion) return null;

    return {
      userId: payload.sub,
      email: payload.email,
      emailVerified: Boolean(row.email_verified),
      tokenVersion: Number(row.token_version)
    };
  } catch {
    return null;
  }
}

// Server-side soft gate for reward/action routes. Returns the session when the
// user is verified; otherwise a 401 response the route can return directly.
export async function requireVerifiedUser(): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "Sign in to continue." } },
      { status: 401 }
    );
  }
  if (!session.emailVerified) {
    return NextResponse.json(
      { error: { code: "auth/email-not-verified", message: "Please verify your email to continue." } },
      { status: 401 }
    );
  }
  return session;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- auth-session`
Expected: PASS.

- [ ] **Step 5: Build to confirm call-site types still compile**

Run: `npm run build`
Expected: build succeeds. (`setSessionCookie` callers in signup/login are updated in Task 5/6; if build fails on those two files because `tokenVersion` is now required, that's expected — fix them minimally by passing `tokenVersion: 0` to unblock, then do the real changes in Task 5/6.)

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts lib/__tests__/auth-session.test.ts
git commit -m "feat(auth): token_version JWT claim, DB revocation check, requireVerifiedUser

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 5: Modify signup, login, and me routes

**Files:**
- Modify: `app/api/auth/signup/route.ts`
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/api/auth/me/route.ts`

**Interfaces:**
- Consumes: `createVerificationToken` + `sendEmail` + `appUrl` + the email templates (`buildVerificationEmailHtml`/`Text` from `lib/email-templates/auth-emails.ts`); `getSession` now returns `emailVerified`.
- Produces: signup returns `{ user, emailVerified:false, message }`; login returns `auth/email-not-verified` for unverified while still setting the cookie; me returns `emailVerified`.

- [ ] **Step 1: Update `app/api/auth/signup/route.ts`**

Add imports:

```ts
import { createVerificationToken } from "@/lib/auth-tokens";
import { sendEmail, appUrl } from "@/lib/email";
import { buildVerificationEmailHtml, buildVerificationEmailText } from "@/lib/email-templates/auth-emails";
```

After the successful `insert into users (...)` (before `setSessionCookie`), create + send the verification token, and update the cookie + response. Replace the block from `await setSessionCookie(...)` through the `return NextResponse.json({ user: ... })`:

```ts
    // Email verification: create a token (hashed in DB) and email the raw
    // token in the link. Email failure is swallowed — signup still succeeds
    // and the user can resend from the app.
    const rawToken = await createVerificationToken(userId);
    const verifyUrl = `${appUrl()}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
    const displayName = profile.displayName;
    await sendEmail({
      to: email,
      toName: displayName,
      subject: "Verify your email — EcoLudus",
      html: buildVerificationEmailHtml({ displayName, email, verifyUrl }),
      text: buildVerificationEmailText({ displayName, email, verifyUrl })
    });

    // Soft gate: cookie is set so the user can browse, but reward/action
    // routes return 401 auth/email-not-verified until they verify. New users
    // start at token_version 0.
    await setSessionCookie({ sub: userId, email, tokenVersion: 0 });

    return NextResponse.json({
      user: {
        uid: userId,
        email,
        displayName: profile.displayName
      },
      emailVerified: false,
      message: "Check your email to verify your account."
    });
```

- [ ] **Step 2: Update `app/api/auth/login/route.ts`**

Change the SELECT to include the new columns, then handle unverified. Replace the `result` query and the success path:

```ts
    const result = await sql<{
      id: string;
      email: string;
      password_hash: string;
      email_verified: boolean;
      token_version: number;
      payload: Record<string, unknown>;
    }>(
      "select id, email, password_hash, email_verified, token_version, payload from users where email = $1 limit 1",
      [email]
    );
```

Then replace the success branch (after `if (!user || !isValidPassword) return 401 ...`):

```ts
    await setSessionCookie({
      sub: user.id,
      email: user.email,
      tokenVersion: Number(user.token_version)
    });

    // Unverified: cookie is set (soft gate — browse OK), but we return the
    // not-verified code so the client can prompt to resend. Timing is already
    // equalized by the bcrypt compare above, so this branch adds no oracle.
    if (!user.email_verified) {
      return NextResponse.json(
        { error: { code: "auth/email-not-verified", message: "Please verify your email to continue." } },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        uid: user.id,
        email: user.email,
        displayName: String(user.payload?.displayName ?? user.email.split("@")[0])
      },
      emailVerified: true
    });
```

- [ ] **Step 3: Update `app/api/auth/me/route.ts`**

`getSession()` now returns `emailVerified`, so return it. Replace the final `return NextResponse.json({ user: ..., profile: ... })`:

```ts
    return NextResponse.json({
      user: {
        uid: user.id,
        email: user.email,
        displayName: String(user.payload?.displayName ?? user.email.split("@")[0])
      },
      emailVerified: session.emailVerified,
      profile: user.payload ?? {}
    });
```

- [ ] **Step 4: Build and lint**

Run: `npm run build && npm run lint`
Expected: build + lint clean.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/signup/route.ts app/api/auth/login/route.ts app/api/auth/me/route.ts
git commit -m "feat(auth): verification email on signup, unverified login handling, emailVerified in /me

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 6: `verify-email` and `resend-verification` routes

**Files:**
- Create: `app/api/auth/verify-email/route.ts`
- Create: `app/api/auth/resend-verification/route.ts`

**Interfaces:**
- Consumes: `consumeVerificationToken`, `createVerificationToken`, `sendEmail`/`appUrl`, `getSession`, the verify email templates, `rateLimit`.
- Produces: `GET /api/auth/verify-email?token=` → 302 redirect to `/verify-email?status=success|invalid|expired`; `POST /api/auth/resend-verification` → session-gated, 200, rate-limited 3/hr.

- [ ] **Step 1: Create `app/api/auth/verify-email/route.ts`**

```ts
import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/auth-tokens";
import { sql } from "@/lib/db";

// GET (email link click). Consumes the token (single-use), marks the user
// verified, bumps token_version (revokes other sessions), and redirects to the
// status page. No session required — the token is the credential.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?status=invalid", request.url));
  }

  try {
    const consumed = await consumeVerificationToken(token);

    if (consumed.status === "invalid") {
      return NextResponse.redirect(new URL("/verify-email?status=invalid", request.url));
    }
    if (consumed.status === "expired") {
      return NextResponse.redirect(new URL("/verify-email?status=expired", request.url));
    }

    // ok — mark verified + bump token_version (kills sessions issued before
    // verification, e.g. the one set at signup on another device).
    await sql(
      "update users set email_verified = true, token_version = token_version + 1 where id = $1",
      [consumed.userId]
    );

    return NextResponse.redirect(new URL("/verify-email?status=success", request.url));
  } catch (error) {
    console.error("verify-email error:", error);
    return NextResponse.redirect(new URL("/verify-email?status=invalid", request.url));
  }
}
```

- [ ] **Step 2: Create `app/api/auth/resend-verification/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createVerificationToken } from "@/lib/auth-tokens";
import { sendEmail, appUrl } from "@/lib/email";
import { buildVerificationEmailHtml, buildVerificationEmailText } from "@/lib/email-templates/auth-emails";
import { sql } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// POST — session-gated. If already verified, 200 noop. Otherwise create a new
// token + email. Rate-limited 3/hr per IP.
export async function POST(request: Request) {
  const limit = rateLimit(request, "auth-resend", 3, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "auth/too-many-attempts", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "Sign in to continue." } },
      { status: 401 }
    );
  }

  if (session.emailVerified) {
    return NextResponse.json({ message: "Email already verified." });
  }

  try {
    const rawToken = await createVerificationToken(session.userId);
    const verifyUrl = `${appUrl()}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
    const displayName = session.email.split("@")[0];
    await sendEmail({
      to: session.email,
      toName: displayName,
      subject: "Verify your email — EcoLudus",
      html: buildVerificationEmailHtml({ displayName, email: session.email, verifyUrl }),
      text: buildVerificationEmailText({ displayName, email: session.email, verifyUrl })
    });

    return NextResponse.json({ message: "Check your email to verify your account." });
  } catch (error) {
    console.error("resend-verification error:", error);
    return NextResponse.json(
      { error: { code: "auth/internal-error", message: "Could not resend verification email." } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Build and lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/verify-email/route.ts app/api/auth/resend-verification/route.ts
git commit -m "feat(auth): verify-email GET + resend-verification POST routes

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 7: `forgot-password` and `reset-password` routes

**Files:**
- Create: `app/api/auth/forgot-password/route.ts`
- Create: `app/api/auth/reset-password/route.ts`

**Interfaces:**
- Consumes: `createResetToken`, `consumeResetToken`, `sendEmail`/`appUrl`, `hashPassword`, the reset email templates, `rateLimit`, `verifyHCaptcha`, zod.
- Produces: `POST /api/auth/forgot-password` → anti-enumeration 200 always; `POST /api/auth/reset-password` → 200 on success, 401 on invalid/expired/used token.

- [ ] **Step 1: Create `app/api/auth/forgot-password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createResetToken } from "@/lib/auth-tokens";
import { sendEmail, appUrl } from "@/lib/email";
import { buildPasswordResetEmailHtml, buildPasswordResetEmailText } from "@/lib/email-templates/auth-emails";
import { sql } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { verifyHCaptcha } from "@/lib/hcaptcha";

const forgotSchema = z.object({
  email: z.string().email(),
  captchaToken: z.string().max(4096).optional()
});

const GENERIC = { message: "If the email exists, a reset link was sent." };

// Anti-enumeration: always 200 with the same body, regardless of whether the
// email is registered. Only create + send if the user exists. Rate-limited 5/hr.
export async function POST(request: Request) {
  const limit = rateLimit(request, "auth-forgot", 5, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "auth/too-many-attempts", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const payload = forgotSchema.parse(await request.json());
    if (!(await verifyHCaptcha(payload.captchaToken, request))) {
      return NextResponse.json(
        { error: { code: "auth/captcha-failed", message: "Please complete the security check and try again." } },
        { status: 403 }
      );
    }

    const email = payload.email.trim().toLowerCase();
    const result = await sql<{ id: string; payload: Record<string, unknown> }>(
      "select id, email, payload from users where email = $1 limit 1",
      [email]
    );
    const user = result.rows[0];

    if (user) {
      const rawToken = await createResetToken(user.id);
      const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
      const displayName = String(user.payload?.displayName ?? email.split("@")[0]);
      await sendEmail({
        to: email,
        toName: displayName,
        subject: "Reset your password — EcoLudus",
        html: buildPasswordResetEmailHtml({ displayName, email, resetUrl }),
        text: buildPasswordResetEmailText({ displayName, email, resetUrl })
      });
    }

    // Same response whether or not the email exists.
    return NextResponse.json(GENERIC);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Still 200-ish? No — invalid input is a client bug, return 400 but do
      // not reveal existence. Use the generic message to avoid enumeration.
      return NextResponse.json(GENERIC, { status: 400 });
    }
    console.error("forgot-password error:", error);
    // Swallow — never reveal provider/email state.
    return NextResponse.json(GENERIC);
  }
}
```

- [ ] **Step 2: Create `app/api/auth/reset-password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { consumeResetToken } from "@/lib/auth-tokens";
import { sql } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(128)
});

// POST — consume the reset token (single-use), hash the new password, bump
// token_version (revokes ALL sessions including this one → re-login). No new
// cookie is set. Rate-limited 10/hr.
export async function POST(request: Request) {
  const limit = rateLimit(request, "auth-reset", 10, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "auth/too-many-attempts", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const payload = resetSchema.parse(await request.json());
    const consumed = await consumeResetToken(payload.token);

    if (consumed.status === "invalid") {
      return NextResponse.json(
        { error: { code: "auth/invalid-token", message: "This reset link is invalid." } },
        { status: 401 }
      );
    }
    if (consumed.status === "expired") {
      return NextResponse.json(
        { error: { code: "auth/expired-token", message: "This reset link has expired." } },
        { status: 401 }
      );
    }
    if (consumed.status === "used") {
      return NextResponse.json(
        { error: { code: "auth/used-token", message: "This reset link has already been used." } },
        { status: 401 }
      );
    }

    const passwordHash = await hashPassword(payload.password);
    await sql(
      "update users set password_hash = $1, token_version = token_version + 1 where id = $2",
      [passwordHash, consumed.userId]
    );

    return NextResponse.json({ message: "Password updated. Please log in." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "auth/invalid-input", details: error.flatten() } },
        { status: 400 }
      );
    }
    console.error("reset-password error:", error);
    return NextResponse.json(
      { error: { code: "auth/internal-error", message: "Could not reset password." } },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Build and lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/forgot-password/route.ts app/api/auth/reset-password/route.ts
git commit -m "feat(auth): anti-enumeration forgot-password + single-use reset-password routes

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 8: `delete-account` route

**Files:**
- Create: `app/api/auth/delete-account/route.ts`

**Interfaces:**
- Consumes: `getSession`, `clearSessionCookie`, `verifyPassword`, `sql`, `rateLimit`, `verifyHCaptcha`, zod. Uses `transaction` from `@/lib/db` for the team_active_missions + user delete.
- Produces: `POST /api/auth/delete-account` → re-auth (password + typing "DELETE" + hCaptcha) → cascade delete → clear cookie → 200 idempotent.

- [ ] **Step 1: Create `app/api/auth/delete-account/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSessionCookie, getSession, verifyPassword } from "@/lib/auth";
import { sql, transaction } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { verifyHCaptcha } from "@/lib/hcaptcha";

const deleteSchema = z.object({
  password: z.string().optional(),
  confirmation: z.literal("DELETE"),
  captchaToken: z.string().max(4096).optional()
});

// POST — permanent account deletion. Requires re-auth (password + typing
// "DELETE" + hCaptcha). Hard-deletes the user row (FK on delete cascade cleans
// mission_logs, mission_submissions, xp_transactions, etc.); team_active_missions
// has no user FK (user_id is in payload), so it's removed explicitly. Idempotent:
// a second request finds no row and still returns 200. Rate-limited 3/hr.
export async function POST(request: Request) {
  const limit = rateLimit(request, "auth-delete", 3, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "auth/too-many-attempts", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "Sign in to continue." } },
      { status: 401 }
    );
  }

  let parsed;
  try {
    parsed = deleteSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Distinguish a wrong confirmation string from generic invalid input so
      // the UI can show the right message; neither reveals account state.
      const wrongConfirmation = error.flatten().fieldErrors.confirmation?.[0];
      if (wrongConfirmation) {
        return NextResponse.json(
          { error: { code: "auth/invalid-confirmation", message: "Type DELETE to confirm." } },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: { code: "auth/invalid-input", details: error.flatten() } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "auth/invalid-json", message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  if (!(await verifyHCaptcha(parsed.captchaToken, request))) {
    return NextResponse.json(
      { error: { code: "auth/captcha-failed", message: "Please complete the security check and try again." } },
      { status: 403 }
    );
  }

  // Re-auth: verify the password against the stored hash. A missing password is
  // treated as invalid credentials (password accounts always require it).
  if (!parsed.password || !(await verifyPasswordById(session.userId, parsed.password))) {
    return NextResponse.json(
      { error: { code: "auth/invalid-credentials", message: "Incorrect password." } },
      { status: 401 }
    );
  }

  try {
    // Cascade: remove the user's team membership (no FK on payload user_id),
    // then delete the user (FK cascade cleans the rest).
    await transaction(async (query) => {
      await query("delete from team_active_missions where payload->>'user_id' = $1", [session.userId]);
      await query("delete from users where id = $1", [session.userId]);
    });
  } catch (error) {
    console.error("delete-account error:", error);
    return NextResponse.json(
      { error: { code: "auth/internal-error", message: "Could not delete account." } },
      { status: 500 }
    );
  }

  await clearSessionCookie();
  return NextResponse.json({ message: "Account deleted." });
}

async function verifyPasswordById(userId: string, password: string): Promise<boolean> {
  const result = await sql<{ password_hash: string }>(
    "select password_hash from users where id = $1 limit 1",
    [userId]
  );
  const row = result.rows[0];
  if (!row) return false;
  return verifyPassword(password, row.password_hash);
}
```

- [ ] **Step 2: Add a `fileSql` branch for the password-hash lookup**

The query `select password_hash from users where id = $1 limit 1` is new. Add this branch to `lib/db.ts` `fileSql`:

```ts
  if (normalized === "select password_hash from users where id = $1 limit 1") {
    const id = String(params[0] ?? "");
    const row = store.users.find((user) => user.id === id);
    return result(row ? ([{ password_hash: row.password_hash }] as unknown as T[]) : []);
  }
```

Also add this query string to the `AUTH_QUERIES` array in `lib/__tests__/auth-filesql.test.ts` so the contract test guards it.

- [ ] **Step 3: Build, lint, and run the contract test**

Run: `npm run build && npm run lint && npm test -- auth-filesql`
Expected: clean + contract test PASS (now 13 queries).

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/delete-account/route.ts lib/db.ts lib/__tests__/auth-filesql.test.ts
git commit -m "feat(auth): re-authed cascade account deletion

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 9: The five new pages

**Files:**
- Create: `app/verify-email/page.tsx`
- Create: `app/resend-verification/page.tsx`
- Create: `app/forgot-password/page.tsx`
- Create: `app/reset-password/page.tsx`
- Create: `app/delete-account/page.tsx`

**Interfaces:**
- Consumes: the auth API routes above; `inputClass`, `primaryButton` from `@/components/game-ui`; `ErrorBanner` from `@/components/ui/error-banner`; `HCaptchaWidget` from `@/components/hcaptcha-widget`; `useAuth`; Next `Link` + `useRouter` + `useSearchParams`.

These pages live under the root (marketing/unauth) layer — they must NOT be inside `app/(game)/` (no auth layout required; verify-email and reset-password are reached unauthenticated).

- [ ] **Step 1: Create `app/verify-email/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VerifyEmailContent() {
  const params = useSearchParams();
  const status = params.get("status");

  const map: Record<string, { title: string; body: string }> = {
    success: { title: "Email verified", body: "Your account is active. You can now log in and start your eco journey." },
    invalid: { title: "Invalid link", body: "This verification link is invalid or was already used." },
    expired: { title: "Link expired", body: "This verification link has expired. Request a new one." }
  };

  const content = map[status ?? "invalid"] ?? map.invalid;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="font-serif text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>{content.title}</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{content.body}</p>
      <div className="mt-8 flex flex-col gap-3">
        {status === "success" && (
          <Link href="/login" className={`${primaryButtonLink} text-center`}>Continue to log in</Link>
        )}
        {(status === "expired" || status === "invalid") && (
          <Link href="/resend-verification" className={`${primaryButtonLink} text-center`}>Resend verification email</Link>
        )}
        <Link href="/" className="text-center text-sm font-bold" style={{ color: "var(--text-muted)" }}>Back to home</Link>
      </div>
    </main>
  );
}

const primaryButtonLink =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] transition hover:opacity-90";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Create `app/resend-verification/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButton } from "@/components/game-ui";
import { useAuth } from "@/lib/useAuth";

export default function ResendVerificationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleResend() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Could not resend.");
      setMessage(data.message || "Check your email to verify your account.");
    } catch (err) {
      setError((err as Error).message || "Could not resend.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="font-serif text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>Resend verification</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        We&apos;ll send a new verification link to {user?.email ?? "your email"}.
      </p>

      {error && <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>}
      {message && <p className="mt-4 text-sm font-semibold" style={{ color: "var(--text-accent)" }}>{message}</p>}

      <div className="mt-8 flex flex-col gap-3">
        <button type="button" onClick={handleResend} disabled={pending} className={primaryButton}>
          {pending ? "Sending…" : "Resend verification email"}
        </button>
        <Link href="/dashboard" className="text-center text-sm font-bold" style={{ color: "var(--text-muted)" }}>Back to dashboard</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `app/forgot-password/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { inputClass, primaryButton } from "@/components/game-ui";
import { HCaptchaWidget } from "@/components/hcaptcha-widget";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return;
    setPending(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), captchaToken })
      });
      // Anti-enumeration: same message regardless of whether the email exists.
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="font-serif text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>Reset your password</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {sent ? (
        <p className="mt-6 text-sm font-semibold" style={{ color: "var(--text-accent)" }}>
          If the email exists, a reset link was sent.
        </p>
      ) : (
        <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
          <HCaptchaWidget onToken={setCaptchaToken} onExpired={() => setCaptchaToken("")} />
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <div className="mt-6">
        <Link href="/login" className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>Back to log in</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create `app/reset-password/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { inputClass, primaryButton } from "@/components/game-ui";

function ResetPasswordContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || "Could not reset password.");
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message || "Could not reset password.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <Shell title="Invalid link" body="This reset link is missing a token.">
        <Link href="/forgot-password" className={linkBtn}>Request a new reset link</Link>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell title="Password updated" body="Your password has been changed. Please log in with your new password.">
        <Link href="/login" className={`${linkBtn} text-center`}>Continue to log in</Link>
      </Shell>
    );
  }

  return (
    <Shell title="Set a new password" body="Choose a new password for your EcoLudus account.">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (at least 6 characters)"
          className={inputClass}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className={inputClass}
        />
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
    </Shell>
  );
}

const linkBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] transition hover:opacity-90";

function Shell({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="font-serif text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{body}</p>
      <div className="mt-8 flex flex-col gap-3">{children}</div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
```

- [ ] **Step 5: Create `app/delete-account/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButton } from "@/components/game-ui";
import { HCaptchaWidget } from "@/components/hcaptcha-widget";
import { useAuth } from "@/lib/useAuth";

export default function DeleteAccountPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (confirmation !== "DELETE") {
      setError("Type DELETE to confirm.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, confirmation: "DELETE", captchaToken })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Could not delete account.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Could not delete account.");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="font-serif text-3xl font-extrabold text-rose-600">Delete account</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        This permanently deletes your account, profile, missions, collection, and team membership for{" "}
        <span className="font-bold">{user?.email ?? "your account"}</span>. This cannot be undone.
      </p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={handleDelete}>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
            Password
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
            Type DELETE to confirm
          </label>
          <input
            type="text"
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
            className={inputClass}
          />
        </div>
        <HCaptchaWidget onToken={setCaptchaToken} onExpired={() => setCaptchaToken("")} />
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={pending || confirmation !== "DELETE"}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-rose-600 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Permanently delete my account"}
        </button>
      </form>

      <div className="mt-6">
        <Link href="/settings" className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>Cancel and go back</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Build and lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/verify-email/page.tsx app/resend-verification/page.tsx app/forgot-password/page.tsx app/reset-password/page.tsx app/delete-account/page.tsx
git commit -m "feat(auth): verify-email, resend, forgot/reset-password, delete-account pages

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 10: UI wiring — auth-card, settings, useAuth

**Files:**
- Modify: `components/auth-card.tsx`
- Modify: `app/(game)/settings/page.tsx`
- Modify: `lib/useAuth.ts`

**Interfaces:**
- Consumes: `emailVerified` from `/api/auth/me` and from login/signup responses; the `auth/email-not-verified` error code.

- [ ] **Step 1: Update `lib/useAuth.ts` to carry `emailVerified`**

Extend the `AuthUser` type and the session payload handling. In the type:

```ts
type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
};
```

Add `emailVerified` to the returned hook value. In `fetchSession`, capture it:

```ts
async function fetchSession(): Promise<{ user: AuthUser | null; profile: Record<string, unknown> | null; emailVerified: boolean }> {
  const res = await fetch(SESSION_KEY, { credentials: "include", cache: "no-store" });
  if (!res.ok) return { user: null, profile: null, emailVerified: false };
  const payload = await res.json().catch(() => ({}));
  return {
    user: (payload as any).user ?? null,
    profile: (payload as any).profile ?? null,
    emailVerified: Boolean((payload as any).emailVerified)
  };
}
```

In `useAuth`, destructure `emailVerified` and return it:

```ts
  const user = data?.user ?? null;
  const profile = data?.profile ?? null;
  const emailVerified = data?.emailVerified ?? false;
```

Add `emailVerified` to the returned object (alongside `user`, `profile`, etc.). Keep the redirect behavior unchanged (unverified users may still browse game routes; the server gates actions).

- [ ] **Step 2: Update `components/auth-card.tsx`**

Add a "Forgot password?" link in login mode and a "Resend verification" link when the error is `auth/email-not-verified`. Add `auth/email-not-verified` to the `formatClientError` map:

```ts
    "auth/email-not-verified": "Please verify your email to continue.",
```

In the login form, under the "Remember me" label, add a right-aligned "Forgot password?" link. Replace the remember-me block with:

```tsx
            {mode === "login" && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded accent-[var(--text-accent)]"
                  />
                  Remember me
                </label>
                <Link href="/forgot-password" className="text-xs font-bold transition" style={{ color: "var(--text-muted)" }}>
                  Forgot password?
                </Link>
              </div>
            )}
```

Below the `{error && <ErrorBanner>{error}</ErrorBanner>}` line, add a resend link when the last error code is `auth/email-not-verified`. Track the last error code in state: change `setError` usage so you also store the code. Minimal approach — add a `lastErrorCode` state set in the catch handler:

```tsx
  const [lastErrorCode, setLastErrorCode] = useState("");
```

In the catch block, replace `setError(formatClientError(message));` with:

```tsx
      const code = err instanceof Error ? err.message : "auth/internal-error";
      setLastErrorCode(code);
      setError(formatClientError(code));
```

And below the error banner:

```tsx
            {error && lastErrorCode === "auth/email-not-verified" && (
              <Link href="/resend-verification" className="text-xs font-bold" style={{ color: "var(--text-accent)" }}>
                Resend verification email →
              </Link>
            )}
```

- [ ] **Step 3: Update `app/(game)/settings/page.tsx`**

Add a verification-status row inside the "Account → Details" panel and a "Delete account" section. Pull `emailVerified` from `useAuth`. In `SettingsPage`:

```ts
  const { user, profile, refreshProfile, emailVerified } = useAuth();
```

Pass `emailVerified` into `SettingsForm` (add it to `SettingsFormProps` and the destructure). In the "Details" `Panel`, after the existing two rows, add a verification row:

```tsx
          {[
            { label: "User ID", value: user?.uid ?? "—", mono: true },
            { label: "Email", value: user?.email ?? "—", mono: false },
            { label: "Email verified", value: emailVerified ? "Yes" : "No — action required", mono: false }
          ].map(({ label, value, mono }) => (
            /* …existing row markup… */
          ))}
```

Below the "Details" `StaggerItem`, add a new "Danger Zone" panel:

```tsx
      {/* ── Danger zone ── */}
      <StaggerItem as="div">
      <Panel eyebrow="Danger Zone" title="Delete Account">
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          {!emailVerified && (
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Your email isn&apos;t verified yet — you can still resend the verification link below.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!emailVerified && (
              <Link href="/resend-verification" className={primaryButton}>Resend verification</Link>
            )}
            <Link
              href="/delete-account"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-rose-600 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:opacity-90"
            >
              Delete account
            </Link>
          </div>
        </div>
      </Panel>
      </StaggerItem>
```

Add `import Link from "next/link";` at the top if not present.

- [ ] **Step 4: Build and lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/useAuth.ts components/auth-card.tsx "app/(game)/settings/page.tsx"
git commit -m "feat(auth): wire emailVerified + forgot/resend/delete links into UI

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 11: Final verification — contract test, lint, build, manual matrix

**Files:**
- Verify: `lib/__tests__/auth-filesql.test.ts` (full assertion list)
- Run: full test suite, lint, build
- Execute: the manual test matrix from spec §6

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all auth tests + existing tests PASS. The `auth-filesql` contract test must pass for all 13 queries.

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Update `CLAUDE.md` Commands/Environment sections**

In `CLAUDE.md`, under the Environment section's optional integrations line, add Brevo + APP_URL. After the SendGrid mention, add:

```markdown
- `BREVO_API_KEY`/`BREVO_FROM` (transactional auth emails: verification + password reset — Brevo only, distinct from SendGrid). `APP_URL` builds absolute verify/reset links.
```

Also correct the stale "There is no test runner" line to note `npm test` runs vitest (optional but accurate).

- [ ] **Step 4: Manual test matrix (spec §6)**

Run `npm run dev` against a real Postgres (`LOCAL_DB_MODE=postgres` or a configured `DATABASE_URL`) and walk through spec §6 items 1–19. Pay special attention to:
- #1: signup → email → verify → `?status=success` → actions unlock.
- #2/#17: unverified soft-gate — browse OK, a reward/action route returns 401 `auth/email-not-verified`; file-fallback dev hits no `Unsupported file database query`.
- #6: wrong-password vs non-existent-email login → identical `auth/invalid-credentials` + equal timing.
- #7: reset → old cookie's `token_version` mismatch forces re-login.
- #8: forgot-password absent email → same 200, no email sent.
- #10: reused reset token → `auth/used-token`.
- #11/#13: delete cascade + idempotent double-delete.
- #14: pre-feature users backfilled `email_verified=true`.
- #18: bad Brevo key → signup still succeeds (email swallowed), resend works later.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note Brevo + APP_URL env and vitest test runner

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** sign-up+verification (T1,2,5,6), sign-in unverified handling (T4,5,10), password reset anti-enumeration + revocation (T1,2,7), account deletion cascade+re-auth+idempotent (T1,8), consistent UI (T9,10), security checklist (bcrypt, SHA-256 tokens, anti-enumeration, token_version revocation, re-auth, cascade, hCaptcha, rate limits) all covered. OAuth explicitly deferred per spec D6.
- **fileSql contract:** every new query string is enumerated in T1 and guarded by `auth-filesql.test.ts`; T8 adds the password-hash lookup and updates the test.
- **No mass logout on deploy:** `getSession` treats a missing `token_version` claim as 0, matching the DB default 0 for existing users (spec D3/D5).
- **Backfill idempotency:** `add column default true` + `alter column set default false` backfills once without re-verifying unverified users on re-run.
- **Delete cascade:** Postgres FK `on delete cascade` covers user-FK tables; `team_active_missions` (user_id in payload) is removed explicitly inside the transaction; file mode mirrors via the extended `delete from users` branch.