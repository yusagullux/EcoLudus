# Auth & Account-Management Flow — Design Spec

Date: 2026-09-01
Status: Design (pending implementation plan)

## 1. Goal

Complete, secure account-management for EcoLudus (Next.js 16 App Router + React 19 + Postgres + stateless JWT cookie sessions):

1. Email verification on sign-up
2. Sign-in (with unverified handling + forgot-password link)
3. Password reset (anti-enumeration, session revocation)
4. Account deletion (cascade, re-auth, idempotent)
5. Consistent UI/UX across all new pages
6. Security per auth-provider best practices
7. Built on the existing auth/DB architecture — no second auth system
8. Manually testable end-to-end (no mock UI)

OAuth is **out of scope** (deferred to a separate spec — codebase has none today).

## 2. Locked decisions

| # | Decision |
|---|---|
| D1 | Email provider: **Brevo only** (no SendGrid in the new sender). SendGrid cron untouched. |
| D2 | Token storage: **DB tables** (`verification_tokens`, `password_reset_tokens`), tokens stored as SHA-256 hash; raw token only in the email link. |
| D3 | Existing users: **backfill `email_verified=true`** at migration. |
| D4 | Unverified access: **soft gate** — can browse, server blocks reward/action routes via `requireVerifiedUser()`. |
| D5 | Session revocation: **`users.token_version` integer** carried as a JWT claim; `getSession` compares claim vs DB; mismatch = invalid. Bumped on password change and verification. |
| D6 | OAuth: **defer** (not in this spec). |

Folded defaults: verification token 24h expiry, reset token 1h expiry, `APP_URL` env var for absolute links, re-auth for delete = password + typing "DELETE", hard delete with FK cascade.

## 3. Architecture

Session machinery stays in `lib/auth.ts` (stateless JWT cookies signed with `jose`, `httpOnly` `ecoquest_session`, 14-day TTL). No server-side session table; revocation is via `token_version` (D5), not a session store.

Email sending is a single Brevo-only module `lib/email.ts` (plain `fetch`, no SDK) — distinct from the untouched SendGrid weekly-report cron. Exact Brevo request body shape is confirmed via Context7/Brevo docs before the sender is written.

Auth gating remains client-side (`useAuth()` redirects via useEffect); the **server is the real gate** through `requireVerifiedUser()` for reward/action routes. No `middleware.ts` is added.

Anti-enumeration: the existing login `DUMMY_PASSWORD_HASH` timing-equalization pattern extends to forgot-password (always 200 "if the email exists, a reset link was sent").

## 4. Components & Data Flow

### 4.1 DB schema (added in `lib/db.ts` `ensureMigrations()` + a migration file)

- `users.email_verified boolean not null default false` — existing rows backfilled to `true`.
- `users.token_version integer not null default 0`.
- `verification_tokens(id uuid pk, user_id uuid fk→users on delete cascade, token_hash text unique not null, expires_at timestamptz not null, created_at timestamptz default now())`.
- `password_reset_tokens(id uuid pk, user_id uuid fk→users on delete cascade, token_hash text unique not null, expires_at timestamptz not null, used_at timestamptz, created_at timestamptz default now())`.
- Tokens stored as **SHA-256 of the raw token**; raw token lives only in the email link.
- Every new query gets a matching `fileSql` branch (dev fallback contract — `lib/db.ts` throws `Unsupported file database query` otherwise).
- FKs to `users(id)` use `on delete cascade` (or `on delete set null` for `created_by`-style) — hard delete is DB-safe.

### 4.2 New/modified lib files

- **`lib/email.ts`** — `sendEmail({to, toName?, subject, html, text})`. POSTs `https://api.brevo.com/v3/smtp/email` with header `api-key: BREVO_API_KEY`; from `BREVO_FROM` (default `hello@ecoludus.com`). **Brevo only — no SendGrid reference.** On non-2xx: log + return `{ok:false}` (swallow; callers never throw on email outage). No-op when `BREVO_API_KEY` missing (dev). Body shape confirmed via Context7 before coding.
- **`lib/auth-tokens.ts`** — `generateToken()` (`randomUUID()`; raw returned to caller), `hashToken(raw)` (`crypto.createHash("sha256").update(raw).digest("hex")`), `createVerificationToken(userId)` (insert hash + 24h expiry), `createResetToken(userId)` (insert hash + 1h expiry), `consumeVerificationToken(raw)` (lookup by hash, check not expired, **delete the row** — single-use, no reuse possible, return `userId` or null), `consumeResetToken(raw)` (lookup by hash, check not expired + `used_at is null`, set `used_at`, return `userId` or null). All queries get `fileSql` branches.
- **`lib/auth.ts` (extend)** —
  - `createSessionToken({sub, email, tokenVersion})` adds `token_version` to the JWT payload.
  - `getSession()` reads `email_verified, token_version` from the users row (folded into the existing profile read — no extra round-trip), compares the DB `token_version` to the JWT claim; mismatch → returns null.
  - New export `requireVerifiedUser()` — wraps `getSession`, checks `email_verified`, returns 401 `auth/email-not-verified` if not; used by all reward/action routes as the real server-side soft-gate.

### 4.3 API routes

| Route | Method | Change |
|---|---|---|
| `/api/auth/signup` | POST (mod) | Insert with `email_verified=false`; create verification token; send Brevo verification email (swallow failures); still `setSessionCookie` (soft-gate); return `{user, emailVerified:false, message:"check your email"}` |
| `/api/auth/login` | POST (mod) | Select adds `email_verified, token_version`; on success-if-unverified → set cookie, return `auth/email-not-verified` + resend hint; timing-equalized as today |
| `/api/auth/me` | GET (mod) | Return `emailVerified`; read `token_version` (folded into existing query) |
| `/api/auth/verify-email` | GET (new) | `?token=` → consume token → `update users set email_verified=true, token_version=token_version+1` → redirect `/verify-email?status=success\|invalid\|expired`; already-verified → `?status=success` |
| `/api/auth/resend-verification` | POST (new) | Session-gated; if already verified → 200 noop; else create new token + email; rate-limited 3/hr |
| `/api/auth/forgot-password` | POST (new) | Zod `{email, captchaToken}`; hCaptcha; **anti-enumeration** — always 200 `{message:"if the email exists, a reset link was sent"}`; only create token + send if user exists; rate-limited 5/hr |
| `/api/auth/reset-password` | POST (new) | Zod `{token, password}`; consume reset token; hash new password; `update users set password_hash=$1, token_version=token_version+1`; 200, no new cookie → re-login |
| `/api/auth/delete-account` | POST (new) | Session + zod `{password?, confirmation:"DELETE", captchaToken}`; hCaptcha; verify password for password accounts; `delete from users where id=$1` (cascade cleans all FK data); `clearSessionCookie`; idempotent 200 (row already gone = no-op) |

### 4.4 Pages (App Router)

- `app/verify-email/page.tsx` — reads `?status=` → success / invalid / expired + "Resend" CTA.
- `app/resend-verification/page.tsx` — button → POST resend API → "check your email" on success.
- `app/forgot-password/page.tsx` — email form + hCaptcha; on submit always shows "if exists, email sent" (anti-enumeration).
- `app/reset-password/page.tsx` — reads `?token=`; new password + confirm (zod client-side); POST reset API; success → "log in" CTA; expired/invalid → state + forgot-password link.
- `app/delete-account/page.tsx` — warning, type "DELETE", password (if password account), hCaptcha; confirm → POST delete API → redirect to landing.

### 4.5 Modified UI

- `components/auth-card.tsx` — "Forgot password?" link (login mode); "Resend verification" link when error is `auth/email-not-verified`; handle `emailVerified` in response; error-code → message map extended.
- `app/(game)/settings/page.tsx` — verification status display; "Resend verification" button if unverified; "Delete account" section linking to `/delete-account`.
- `lib/useAuth.ts` — carry `emailVerified`; unverified banner; client-side action block (server is the real gate).

### 4.6 Env vars (`.env.example`)

Add `BREVO_API_KEY`, `BREVO_FROM`, `APP_URL` (builds absolute verify/reset links; default `http://localhost:3000` in dev).

### 4.7 Data flow

- **Sign-up** → insert(verified=false) → token → Brevo email (swallowed) → cookie set (soft-gate) → user browses; reward/action routes return 401 `auth/email-not-verified` until verified.
- **Verify-email link** → GET `/api/auth/verify-email?token=…` → consume → mark verified → bump `token_version` (kills other sessions) → redirect `/verify-email?status=success`.
- **Login unverified** → cookie set + `auth/email-not-verified` returned → client shows resend.
- **Forgot-password** → (exists?) → reset token → Brevo email → same 200 response regardless.
- **Reset-password** → POST → hash password → bump `token_version` (kills all sessions incl. current) → re-login.
- **Delete** → password + "DELETE" + hCaptcha → cascade delete → cookie cleared → landing.

## 5. Error Handling

| Scenario | Behavior |
|---|---|
| Wrong password / non-existent email | Generic `auth/invalid-credentials`; timing equalized via `DUMMY_PASSWORD_HASH` |
| Unverified login | `auth/email-not-verified` + resend hint; cookie set (soft-gate) |
| Expired verification token | `/verify-email?status=expired`; resend CTA |
| Invalid verification token | `/verify-email?status=invalid` |
| Already-verified (verify/reverify) | `?status=success`; resend → 200 noop |
| Expired/invalid/reused reset token | page shows state + forgot-password link; `used_at` guards reuse |
| Forgot-password, email absent | Always 200 "if the email exists, a reset link was sent"; no email sent |
| Reset success | password hashed, `token_version` bumped; no new cookie → re-login |
| Delete wrong password | `auth/invalid-credentials`; no delete |
| Delete wrong confirmation text | `auth/invalid-confirmation`; no delete |
| Delete dup request (row gone) | 200 idempotent |
| `token_version` mismatch in `getSession` | returns null → client redirects to login |
| Brevo send failure | log + swallow; user can resend/retry; never surface provider errors to client |
| Rate limits (`rateLimit()`) | signup 5/hr, login 10/5min, resend 3/hr, forgot 5/hr, reset 10/hr, delete 3/hr |
| hCaptcha | signup (existing) + forgot-password + delete-account |
| Zod fail / missing session | 400 `auth/invalid-input` / 401 `auth/unauthenticated` |

## 6. Testing (manual matrix)

1. Sign-up → Brevo email → verify link → `?status=success` → verified; actions unlock.
2. Sign-up, don't verify → login → `auth/email-not-verified` + resend; soft-gate browse OK, actions blocked server-side (`requireVerifiedUser`).
3. Resend → new email → verify → success.
4. Manually expire verification token → `?status=expired` → resend works.
5. Random token → `?status=invalid`.
6. Wrong-password login & non-existent-email login → identical `auth/invalid-credentials` + equal timing.
7. Forgot-password (existing) → reset email → new password → login works; old cookie `token_version` mismatch → forced re-login.
8. Forgot-password (absent email) → same response, no email sent.
9. Expired reset token → expired state → forgot-password link.
10. Reused reset token → rejected.
11. Delete: type "DELETE" + password → cascade delete, cookie cleared, redirect to landing; spot-check teams/mission_logs/xp_transactions gone.
12. Delete wrong password / wrong confirmation → rejected, no data change.
13. Delete twice → second 200 idempotent.
14. Pre-feature existing users → backfilled `email_verified=true` → login, no prompt.
15. Mobile: all new pages responsive, 44px touch targets, forms usable.
16. hCaptcha renders on forgot-password + delete-account.
17. file-fallback dev (no DB): every new query has `fileSql` branch, no `Unsupported file database query`.
18. Brevo outage (bad key) → signup still succeeds (email swallowed), log shows error, resend works later.
19. `npm run lint` + `npm run build` clean.

## 7. Security checklist

- [x] Passwords hashed bcrypt cost 12 (existing).
- [x] Tokens stored as SHA-256 hash, raw token only in email link.
- [x] Anti-enumeration on login + forgot-password (never reveal email existence).
- [x] `token_version` revocation on password change + verification.
- [x] Re-auth (password + "DELETE") for account deletion.
- [x] Cascade delete — no orphaned private data; FKs safe.
- [x] Delete idempotent against duplicate requests.
- [x] No sensitive credentials in frontend code.
- [x] No client-supplied user IDs trusted — `getSession()` is authoritative.
- [x] hCaptcha on sensitive routes (forgot-password, delete-account).
- [x] Rate limits on all auth routes.
- [x] Credentials never logged; Brevo failures logged without payload.

## 8. Open items for user decision

- None at design time. Implementation will confirm Brevo request body shape via Context7 before writing `lib/email.ts`.
- Production ship requires `BREVO_API_KEY`, `BREVO_FROM`, `APP_URL` set on Vercel.