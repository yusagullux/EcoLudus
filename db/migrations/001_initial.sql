create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key,
  join_code text not null unique,
  created_by uuid references users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_active_missions (
  id uuid primary key,
  team_id uuid not null references teams(id) on delete cascade,
  mission_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_mission_logs (
  id uuid primary key,
  team_id uuid not null references teams(id) on delete cascade,
  mission_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists mission_logs (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists carbon_cache (
  quest_id text primary key,
  carbon_value numeric not null,
  source text not null,
  source_payload jsonb not null default '{}'::jsonb,
  cached_at timestamptz not null default now()
);

create table if not exists photo_hashes (
  id uuid primary key default gen_random_uuid(),
  image_hash text not null unique,
  user_id uuid not null references users(id) on delete cascade,
  quest_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_teams_join_code on teams(join_code);
create index if not exists idx_team_active_missions_team_id on team_active_missions(team_id);
create index if not exists idx_team_active_missions_mission_id on team_active_missions(mission_id);
create index if not exists idx_team_mission_logs_team_id on team_mission_logs(team_id);
create index if not exists idx_team_mission_logs_mission_id on team_mission_logs(mission_id);
create index if not exists idx_mission_logs_user_id on mission_logs(user_id);
create index if not exists idx_carbon_cache_cached_at on carbon_cache(cached_at);
