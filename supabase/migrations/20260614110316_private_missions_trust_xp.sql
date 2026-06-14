create extension if not exists pgcrypto;

alter table users
  add column if not exists xp integer not null default 0,
  add column if not exists level integer not null default 1,
  add column if not exists trust_score numeric(5,2) not null default 50;

alter table users
  drop constraint if exists users_xp_nonnegative,
  add constraint users_xp_nonnegative check (xp >= 0),
  drop constraint if exists users_level_positive,
  add constraint users_level_positive check (level >= 1),
  drop constraint if exists users_trust_score_range,
  add constraint users_trust_score_range check (trust_score >= 0 and trust_score <= 100);

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
  updated_at timestamptz not null default now(),
  constraint missions_base_xp_nonnegative check (base_xp >= 0),
  constraint missions_repeat_window_positive check (repeat_window_seconds >= 60),
  constraint missions_mission_type_check check (mission_type in ('private', 'photo', 'team', 'daily')),
  constraint missions_visibility_check check (visibility in ('private', 'public', 'team'))
);

create table if not exists mission_submissions (
  id uuid primary key default gen_random_uuid(),
  mission_id text not null references missions(id),
  user_id uuid not null references users(id) on delete cascade,
  before_value text,
  after_value text,
  description text not null,
  confidence smallint not null,
  submitted_at timestamptz not null default now(),
  submission_hash text not null unique,
  time_window_key text not null,
  status text not null,
  final_xp integer not null default 0,
  trust_before numeric(5,2) not null,
  trust_after numeric(5,2) not null,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint mission_submissions_confidence_check check (confidence between 1 and 5),
  constraint mission_submissions_status_check check (status in ('APPROVED', 'PARTIAL', 'REJECTED', 'FLAGGED')),
  constraint mission_submissions_final_xp_check check (final_xp >= 0),
  constraint mission_submissions_trust_before_check check (trust_before >= 0 and trust_before <= 100),
  constraint mission_submissions_trust_after_check check (trust_after >= 0 and trust_after <= 100),
  constraint mission_submissions_once_per_window unique (user_id, mission_id, time_window_key)
);

create table if not exists private_mission_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references mission_submissions(id) on delete cascade,
  mission_id text not null references missions(id),
  user_id uuid not null references users(id) on delete cascade,
  before_value text,
  after_value text,
  description text not null,
  self_confidence smallint not null,
  logged_at timestamptz not null default now(),
  constraint private_mission_logs_self_confidence_check check (self_confidence between 1 and 5)
);

create table if not exists ai_verification_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references mission_submissions(id) on delete cascade,
  status text not null,
  confidence integer not null,
  realism_score integer not null,
  reasoning text not null,
  risk_flags jsonb not null default '[]'::jsonb,
  provider text,
  verified_at timestamptz not null default now(),
  constraint ai_verification_status_check check (status in ('APPROVED', 'PARTIAL', 'REJECTED', 'FLAGGED')),
  constraint ai_verification_confidence_check check (confidence >= 0 and confidence <= 100),
  constraint ai_verification_realism_score_check check (realism_score >= 0 and realism_score <= 100),
  constraint ai_verification_risk_flags_array check (jsonb_typeof(risk_flags) = 'array')
);

create table if not exists team_progress (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  submission_id uuid references mission_submissions(id) on delete set null,
  points integer not null default 0,
  source text not null,
  created_at timestamptz not null default now(),
  constraint team_progress_points_nonnegative check (points >= 0)
);

create table if not exists xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  submission_id uuid unique references mission_submissions(id) on delete set null,
  amount integer not null,
  reason text not null,
  trust_multiplier numeric(4,2) not null default 1,
  verification_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint xp_transactions_amount_nonnegative check (amount >= 0),
  constraint xp_transactions_status_check check (verification_status in ('APPROVED', 'PARTIAL', 'REJECTED', 'FLAGGED'))
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
  created_at timestamptz not null default now(),
  constraint trust_history_previous_score_check check (previous_score >= 0 and previous_score <= 100),
  constraint trust_history_next_score_check check (next_score >= 0 and next_score <= 100),
  constraint trust_history_risk_flags_array check (jsonb_typeof(risk_flags) = 'array')
);

insert into missions (id, title, category, mission_type, visibility, base_xp, repeat_window_seconds, metadata)
values
  (
    'shower_reduce_5min',
    'Reduce shower time',
    'water',
    'private',
    'private',
    40,
    86400,
    '{"preferredBeforeAfter": true, "unitHint": "minutes"}'::jsonb
  ),
  (
    'drink_more_water',
    'Drink more water',
    'health',
    'private',
    'private',
    25,
    86400,
    '{"preferredBeforeAfter": true, "unitHint": "cups or liters"}'::jsonb
  ),
  (
    'limit_screen_time',
    'Limit screen time',
    'wellbeing',
    'private',
    'private',
    35,
    86400,
    '{"preferredBeforeAfter": true, "unitHint": "minutes or hours"}'::jsonb
  )
on conflict (id) do update
set title = excluded.title,
    category = excluded.category,
    mission_type = excluded.mission_type,
    visibility = excluded.visibility,
    base_xp = excluded.base_xp,
    repeat_window_seconds = excluded.repeat_window_seconds,
    metadata = excluded.metadata,
    updated_at = now();

create index if not exists idx_missions_type_active on missions(mission_type, active);
create index if not exists idx_mission_submissions_user_submitted on mission_submissions(user_id, submitted_at desc);
create index if not exists idx_mission_submissions_mission on mission_submissions(mission_id);
create index if not exists idx_private_mission_logs_user_logged on private_mission_logs(user_id, logged_at desc);
create index if not exists idx_ai_verification_results_status on ai_verification_results(status);
create index if not exists idx_team_progress_team_created on team_progress(team_id, created_at desc);
create index if not exists idx_xp_transactions_user_created on xp_transactions(user_id, created_at desc);
create index if not exists idx_trust_history_user_created on trust_history(user_id, created_at desc);

alter table missions enable row level security;
alter table mission_submissions enable row level security;
alter table private_mission_logs enable row level security;
alter table ai_verification_results enable row level security;
alter table team_progress enable row level security;
alter table xp_transactions enable row level security;
alter table trust_history enable row level security;

revoke all on table public.missions from anon, authenticated;
revoke all on table public.mission_submissions from anon, authenticated;
revoke all on table public.private_mission_logs from anon, authenticated;
revoke all on table public.ai_verification_results from anon, authenticated;
revoke all on table public.team_progress from anon, authenticated;
revoke all on table public.xp_transactions from anon, authenticated;
revoke all on table public.trust_history from anon, authenticated;
