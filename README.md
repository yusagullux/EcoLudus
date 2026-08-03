# 🌍 EcoLudus

**Gamified Environmental Sustainability Platform**

## 📖 About

EcoLudus is a gamified web app that turns eco-friendly habits into a rewarding daily ritual. Users complete eco missions, track their carbon footprint reduction, earn XP and EcoPoints, level up, collect virtual plants and pets, and compete on leaderboards — solo or in teams.

Our mission is to inspire millions of people to adopt eco-friendly habits through gamification, making environmental consciousness a daily practice rather than an occasional thought.

---

## ✨ Features

- **Daily missions** — eco-friendly quests across categories (recycling, energy, transport, water, clean-up, gardening, sustainable living) with photo verification.
- **Gamification** — XP, levels, badges, EcoPoints (virtual currency), companion pets that assist on missions, and a chest reward system.
- **Progress tracking** — real-time XP/level progress, category completion, and carbon footprint reduction.
- **Plant shop & collection** — buy virtual plants with EcoPoints; rarity tiers from Common to Legendary.
- **Pets & garden** — hatch and raise companion animals, grow a personal garden.
- **Teams** — create/join teams (up to 8 members) via join codes, collaborate on team missions with difficulty-based rewards and cooldowns.
- **Social** — global leaderboard, friends, user profiles with stats.
- **Real-world impact** — milestone tree planting via Ecologi; weekly impact emails via SendGrid.

---

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19, TypeScript
- **Styling:** Tailwind CSS v4 + hand-authored CSS (CSS variables, theming)
- **Database:** PostgreSQL (`pg`) — Supabase in production, with a local JSON-file fallback for dev
- **Auth:** Email/password with `bcrypt`; JWT sessions in `httpOnly` cookies signed with `jose`
- **Validation:** Zod
- **AI verification:** Google Gemini (photo / private-mission proof)
- **Carbon data:** Climatiq API (cached in `carbon_cache`)
- **Hosting:** Vercel (with Vercel Cron Jobs)

---

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in at least `DATABASE_URL` and `SESSION_SECRET`. Without a `DATABASE_URL`, the app falls back to a local JSON file store (`data/local-db.json`) in development only — in production it refuses to start without a real database.

See `CLAUDE.md` for the full architecture, commands, and conventions.

### Commands

```bash
npm run dev              # dev server
npm run build            # production build
npm run lint             # lint
npm run db:migrate       # apply db/migrations/*.sql to Postgres
npm run test:photo-proof # standalone photo-verification test
```

---

## 🎮 How it works

### Leveling

Level is derived from total XP by the formula `requiredXP(level) = 100·level + 25·level²`. Badges cycle through 9 animal tiers (Cat → Fox → … → Lion) with metal tiers (Bronze, Silver, Gold, …) every 9 levels. See `lib/level-system.ts`.

### Quest completion

Selecting and completing daily quests (`/api/quests/complete`) validates the selection, requires photo proof where applicable, computes XP/EcoPoints/carbon rewards, applies companion-pet bonuses, optionally rolls a "daily clear" chest, and updates the user profile. Quest definitions and base carbon values live in `public/quests.json`, optionally enriched via Climatiq.

### User profile

Most game state is stored as a single JSON document in the `users.payload` column (XP, level, EcoPoints, plants, pets, chests, completed quests, team membership, trust score, …). XP/level/trust are also promoted to real columns for aggregate queries.

---

## 📁 Project Structure

```
app/
  (game)/          # authenticated app (dashboard, shop, garden, pets, team, …)
  api/             # route handlers (auth, store, quests, cron, …)
  legal/           # privacy / terms
  landing, login, signup
components/        # shared UI (sidebar, navigation-bar, auth-card, game-ui, …)
lib/               # auth, db, document-store, level-system, carbon-calc, verification, …
db/migrations/     # SQL migrations
public/            # static assets (images, quests.json, css)
scripts/           # migrate, setup-dev, ad-hoc test scripts
vercel.json        # cron schedules
```

---

## 🔒 Security

- Passwords hashed with bcrypt (cost 12); JWT sessions in `httpOnly`, `sameSite=lax` cookies (secure in production).
- Row-level access enforced in `lib/document-store.ts`: users can only read/write their own profile; team access requires membership.
- Supabase RLS enabled as a defense-in-depth measure (`db/migrations/002_lockdown_public_api.sql`).
- Cron endpoints gated by `CRON_SECRET` bearer token.