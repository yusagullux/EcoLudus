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