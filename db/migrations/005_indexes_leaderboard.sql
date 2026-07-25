-- 005_indexes_leaderboard.sql
-- Indexes for the most common leaderboard / aggregate lookups. Idempotent.
-- Mirrors the indexes added to ensureMigrations() in lib/db.ts so a manual
-- `npm run db:migrate` against an existing DB (created before these were in
-- the inline schema) also picks them up.
--
-- idx_users_xp_desc backs the individual leaderboard's ORDER BY xp DESC.
-- idx_team_progress_team_source backs team-progress aggregations that filter
-- by team and source.

create index if not exists idx_users_xp_desc on users(xp desc);
create index if not exists idx_team_progress_team_source on team_progress(team_id, source);