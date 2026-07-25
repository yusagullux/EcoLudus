-- 004_rls_newer_tables.sql
-- Enable row-level security on the 8 tables added by the private-missions and
-- unified-impact-spine work, and revoke access from the Supabase anon/authenticated
-- roles so they are not reachable through the Supabase Data API (PostgREST).
--
-- 002_lockdown_public_api.sql covered the original 7 tables but predates these.
-- The app talks to Postgres directly as the `postgres` role via DATABASE_URL,
-- so RLS does not gate the app itself — it only blocks anon/authenticated access
-- via the Supabase Data API if that surface is ever exposed.
--
-- Mirrors 002's pattern. Idempotent: safe to run multiple times.

alter table if exists public.missions enable row level security;
alter table if exists public.mission_submissions enable row level security;
alter table if exists public.private_mission_logs enable row level security;
alter table if exists public.ai_verification_results enable row level security;
alter table if exists public.team_progress enable row level security;
alter table if exists public.xp_transactions enable row level security;
alter table if exists public.trust_history enable row level security;
alter table if exists public.impact_events enable row level security;

revoke all on table public.missions from anon, authenticated;
revoke all on table public.mission_submissions from anon, authenticated;
revoke all on table public.private_mission_logs from anon, authenticated;
revoke all on table public.ai_verification_results from anon, authenticated;
revoke all on table public.team_progress from anon, authenticated;
revoke all on table public.xp_transactions from anon, authenticated;
revoke all on table public.trust_history from anon, authenticated;
revoke all on table public.impact_events from anon, authenticated;