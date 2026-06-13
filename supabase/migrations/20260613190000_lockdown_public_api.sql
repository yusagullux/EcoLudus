-- EcoLudus uses direct Postgres via DATABASE_URL / POSTGRES_URL, not the Supabase Data API.
-- Enable RLS so tables are not readable through PostgREST if grants exist.

alter table if exists public.users enable row level security;
alter table if exists public.teams enable row level security;
alter table if exists public.team_active_missions enable row level security;
alter table if exists public.team_mission_logs enable row level security;
alter table if exists public.mission_logs enable row level security;
alter table if exists public.carbon_cache enable row level security;
alter table if exists public.photo_hashes enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.teams from anon, authenticated;
revoke all on table public.team_active_missions from anon, authenticated;
revoke all on table public.team_mission_logs from anon, authenticated;
revoke all on table public.mission_logs from anon, authenticated;
revoke all on table public.carbon_cache from anon, authenticated;
revoke all on table public.photo_hashes from anon, authenticated;
