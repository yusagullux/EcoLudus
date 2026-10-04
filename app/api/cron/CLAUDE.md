# Cron routes

Three cron routes, all gated by `Authorization: Bearer <CRON_SECRET>` and exported as both GET and POST (Vercel Cron sends GET). Schedules live in `vercel.json`:

- `/api/cron/process-rewards` — 02:00 UTC daily; milestone tree-planting (Ecologi, via `lib/rewards-sync.ts`).
- `/api/cron/send-weekly-reports` — 08:00 UTC Mondays; SendGrid impact emails (`lib/email-templates/`).
- `/api/cron/keep-alive` — 04:00 UTC daily.