-- 003_full_schema.sql
-- Brings the manual migration set (001 + 002) up to parity with the runtime
-- schema enforced by ensureMigrations() in lib/db.ts.
--
-- 001_initial.sql created the original 7 tables but predates the private-
-- missions and unified-impact-spine work, so it is missing the users.xp /
-- users.level / users.trust_score columns and 8 newer tables. Running only
-- 001 + 002 left `npm run db:migrate` producing a database the app would then
-- fail against at runtime. This migration adds the missing pieces so the
-- manual migration path produces a correct schema.
--
-- Everything here is idempotent (create table if not exists / add column if
-- not exists), so it is safe to run on a database already bootstrapped by
-- ensureMigrations().

-- Promote derived columns used by aggregate queries (level-system + trust).
alter table users
  add column if not exists xp integer not null default 0,
  add column if not exists level integer not null default 1,
  add column if not exists trust_score numeric(5,2) not null default 50;

create table if not exists missions (
  id text primary key,
  title text not null,
  category text not null default 'habits',
  mission_type text not null default 'private',
  visibility text not null default 'private',
  base_xp integer not null default 25,
  repeat_window_seconds integer not null default 86400,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mission_submissions (
  id uuid primary key default gen_random_uuid(),
  mission_id text not null references missions(id),
  user_id uuid not null references users(id) on delete cascade,
  before_value text,
  after_value text,
  description text not null,
  confidence smallint not null check (confidence between 1 and 5),
  submitted_at timestamptz not null default now(),
  submission_hash text not null unique,
  time_window_key text not null,
  status text not null check (status in ('APPROVED', 'PARTIAL', 'REJECTED', 'FLAGGED')),
  final_xp integer not null default 0 check (final_xp >= 0),
  trust_before numeric(5,2) not null,
  trust_after numeric(5,2) not null,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, mission_id, time_window_key)
);

create table if not exists private_mission_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references mission_submissions(id) on delete cascade,
  mission_id text not null references missions(id),
  user_id uuid not null references users(id) on delete cascade,
  before_value text,
  after_value text,
  description text not null,
  self_confidence smallint not null check (self_confidence between 1 and 5),
  logged_at timestamptz not null default now()
);

create table if not exists ai_verification_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references mission_submissions(id) on delete cascade,
  status text not null check (status in ('APPROVED', 'PARTIAL', 'REJECTED', 'FLAGGED')),
  confidence integer not null check (confidence >= 0 and confidence <= 100),
  realism_score integer not null check (realism_score >= 0 and realism_score <= 100),
  reasoning text not null,
  risk_flags jsonb not null default '[]'::jsonb,
  provider text,
  verified_at timestamptz not null default now()
);

create table if not exists team_progress (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  submission_id uuid references mission_submissions(id) on delete set null,
  points integer not null default 0 check (points >= 0),
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  submission_id uuid unique references mission_submissions(id) on delete set null,
  amount integer not null check (amount >= 0),
  reason text not null,
  trust_multiplier numeric(4,2) not null default 1,
  verification_status text not null check (verification_status in ('APPROVED', 'PARTIAL', 'REJECTED', 'FLAGGED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists trust_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  submission_id uuid references mission_submissions(id) on delete set null,
  previous_score numeric(5,2) not null,
  next_score numeric(5,2) not null,
  delta numeric(5,2) not null,
  reason text not null,
  risk_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists impact_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source text not null,
  amount integer not null check (amount >= 0),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_impact_events_user_created on impact_events(user_id, created_at desc);
create index if not exists idx_impact_events_source on impact_events(source);
create index if not exists idx_missions_type_active on missions(mission_type, active);
create index if not exists idx_mission_submissions_user_submitted on mission_submissions(user_id, submitted_at desc);
create index if not exists idx_mission_submissions_mission on mission_submissions(mission_id);
create index if not exists idx_private_mission_logs_user_logged on private_mission_logs(user_id, logged_at desc);
create index if not exists idx_ai_verification_results_status on ai_verification_results(status);
create index if not exists idx_team_progress_team_created on team_progress(team_id, created_at desc);
create index if not exists idx_xp_transactions_user_created on xp_transactions(user_id, created_at desc);
create index if not exists idx_trust_history_user_created on trust_history(user_id, created_at desc);

-- Seed the three built-in private missions (idempotent upsert).
insert into missions (id, title, category, mission_type, visibility, base_xp, repeat_window_seconds, metadata)
values
  ('shower_reduce_5min', 'Reduce shower time', 'water', 'private', 'private', 40, 86400, '{"preferredBeforeAfter": true, "unitHint": "minutes"}'::jsonb),
  ('drink_more_water', 'Drink more water', 'health', 'private', 'private', 25, 86400, '{"preferredBeforeAfter": true, "unitHint": "cups or liters"}'::jsonb),
  ('limit_screen_time', 'Limit screen time', 'wellbeing', 'private', 'private', 35, 86400, '{"preferredBeforeAfter": true, "unitHint": "minutes or hours"}'::jsonb)
on conflict (id) do update
set title = excluded.title,
    category = excluded.category,
    mission_type = excluded.mission_type,
    visibility = excluded.visibility,
    base_xp = excluded.base_xp,
    repeat_window_seconds = excluded.repeat_window_seconds,
    metadata = excluded.metadata,
    updated_at = now();