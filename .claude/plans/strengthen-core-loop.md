# Plan: Strengthen the Core Loop

**Goal:** make the "Open app → see today's mission → complete it → verify → get reward → progress → want to come back tomorrow" flow feel inevitable, rewarding, and trustworthy.

## Current funnel mapping

| Step | Current implementation | Health |
|---|---|---|
| Open app | `useAuth` → `/api/auth/me` → dashboard skeleton | ✅ Fast, SWR cached |
| See today's mission | Dashboard effect calls `/api/quests/daily` (server-picked 5 quests, UTC midnight reset) | ⚠️ Fragile state sync; all non-honor quests require AI proof |
| Complete it | Checkbox selection → `/api/quests/complete` | ✅ Atomic transaction with row lock |
| Verify | Text or photo proof via `/api/quests/verify` (Gemini or heuristic fallback) | ⚠️ High friction; trust system not wired to rewards |
| Get reward | XP, EcoPoints, carbon, companion bonus, possible daily-clear chest | ⚠️ Level-up rewards are computed but never granted; daily chest is only 35% chance |
| Progress | `lib/progression.ts` updates XP/level/eco/carbon | ✅ Server-authoritative, no client minting |
| Want to come back tomorrow | Streak counter + garden growth (8h–96h) + UTC midnight reset | ⚠️ Streak reward preview is weak; garden first growth is too slow; no actual reminder delivery |

## Issues found (ranked by impact on the core loop)

### 🔴 Critical

1. **Level-up rewards are computed but never granted.**
   - `lib/level-system.ts` exports `getLevelUpRewards`, and it is tested.
   - It is used only in `lib/private-missions.ts`; the main `/api/quests/complete` route and `lib/progression.ts` ignore it.
   - Impact: players cross level thresholds and see a number change, but never receive the promised garden item / team boost. This kills the "get reward → progress" dopamine hit.
   - Fix: wire `getLevelUpRewards` into `grantProgression`; return `levelUpRewards` in the result; surface them in the dashboard completion popup.

2. **Trust/anti-cheat system is disconnected from daily quest rewards.**
   - `users.trust_score` exists, `getTrustMultiplier` exists, but `/api/quests/complete` never reads or updates trust.
   - All the fraud logic lives in the secondary private-missions flow.
   - Impact: the core loop has no reputation progression; bad proofs and good proofs feel identical. Also the `trust_score` column drifts stale for daily-quest users.
   - Fix: after quest completion, update `trust_score` based on proof confidence/risk; apply `getTrustMultiplier` to quest XP (small but visible); show trust progress in the UI.

3. **Impact page redirects to dashboard.**
   - `app/(game)/impact/page.tsx` is just `redirect("/dashboard")`.
   - The landing page now shows a real `/impact` screenshot, but that route renders the dashboard.
   - Impact: marketing promises "measured impact" but the standalone impact experience does not exist. New users feel the product is unfinished.
   - Fix: either build `/impact` (reuse the charts from `/insights`) or replace the landing card with `/insights` and retake the screenshot.

### 🟠 High

4. **Dashboard quest state sync is held together by `// eslint-disable` and set-state-in-effect.**
   - `dashboard/page.tsx` has two effects that intentionally disable `react-hooks/exhaustive-deps` and `react-hooks/set-state-in-effect`.
   - Race possible: user can click "complete" while `refreshProfile()` is still in flight; the local `quests` state and SWR profile can diverge.
   - Impact: stale quest list, double completions, or lost daily resets.
   - Fix: refactor the daily-quest sync into a small hook backed by SWR or a reducer; derive `verifiedQuestIds` from `profile` directly instead of mirroring in state.

5. **First garden growth is 8 hours even for brand-new players.**
   - `GROW_DURATION.common = 8 * 60 * 60 * 1000`.
   - New users plant their first sunflower and see nothing happen for most of a day.
   - Impact: breaks the "want to come back tomorrow" hook; there is no same-day payoff.
   - Fix: grant a "Sprout" seed/plant that blooms in ~15 minutes for the first day, or add a one-time tutorial quest that gives an instantly-bloomed plant.

6. **Daily-clear reward is a 35% gamble with no fallback celebration.**
   - `DAILY_CLEAR_CHEST_CHANCE = 0.35`. If the roll misses, the player cleared all 5 quests and gets nothing special.
   - Impact: the climax of the daily loop can feel empty.
   - Fix: guarantee a small reward on daily clear (e.g., +10 EcoPoints or a wooden chest) and keep the 35% roll for a rarer bonus chest.

7. **Streak reward preview is invisible until milestone day.**
   - The dashboard streak panel says "x days to next reward" but never lists what the reward is.
   - Impact: weak motivation to maintain the streak.
   - Fix: show the upcoming milestone reward (3d, 7d, 14d, 30d) in the dashboard streak panel.

### 🟡 Medium

8. **Quest pool permanently excludes completed quests from daily selection.**
   - `/api/quests/daily` filters `available = allQuests.filter(q => !completedQuests.includes(q.id))`.
   - Once a user has done most easy quests, the daily set is forced into medium/hard.
   - Impact: the game gets harder over time without signaling it, increasing proof friction.
   - Fix: reset the exclusion window to ~30 days or make it category-rotating; surface "new category focus" copy.

9. **No actual reminder delivery despite `notificationPreferences`.**
   - Profile stores reminder preferences and `reminderMetadata`, but no cron/service worker sends them.
   - Impact: the strongest retention hook ("come back tomorrow") is unimplemented.
   - Fix: add a cron job that queries users with `dailyReminderEnabled=true` and sends a push/email reminder at their `reminderHour`.

10. **Honour-system quests are scarce.**
    - Only 2 of ~60 quests set `requiresProof: false`.
    - Impact: high daily friction, especially for users without a camera habit.
    - Fix: mark more invisible-action quests (turn off lights, unplug charger, take shorter shower, etc.) as honor-system.

## Proposed implementation phases

### Phase 1 — Fix the reward climax (highest ROI)
- Wire `getLevelUpRewards` into `grantProgression` and `/api/quests/complete`.
- Guarantee a daily-clear reward and keep the rarer chest roll.
- Show level-up rewards and daily-clear reward in the dashboard completion popup.
- Surface next streak milestone reward in the streak panel.
- **Files:** `lib/progression.ts`, `app/api/quests/complete/route.ts`, `app/(game)/dashboard/page.tsx`.

### Phase 2 — Reconnect trust and reduce verification friction
- Update `trust_score` after quest proof verification (confidence/risk-based delta).
- Apply `getTrustMultiplier` to quest XP in `/api/quests/complete`.
- Add a small trust indicator on the dashboard.
- Expand honor-system quest count in `public/quests.json`.
- **Files:** `lib/quest-proof.ts`, `app/api/quests/verify/route.ts`, `app/api/quests/complete/route.ts`, `public/quests.json`, `app/(game)/dashboard/page.tsx`.

### Phase 3 — Make the dashboard state robust
- Extract daily-quest sync into `lib/useDailyQuests.ts` (SWR-backed, server-invalidated on complete).
- Derive `verifiedQuestIds` from `profile.verifiedQuestProofs` directly; remove the mirroring effect.
- Add optimistic UI updates for completion with rollback on error.
- **Files:** `lib/useDailyQuests.ts`, `app/(game)/dashboard/page.tsx`.

### Phase 4 — New-player and retention hooks
- Accelerate the first garden growth (tutorial plant or shortened first timer).
- Build `/impact` as a real page (reuse `/insights` charts) or swap landing card to `/insights` and recapture screenshot.
- Implement daily reminder cron (`/api/cron/send-daily-reminders`).
- **Files:** `app/(game)/impact/page.tsx` or `app/page.tsx`, `app/(game)/garden/page.tsx`, `app/api/cron/send-daily-reminders/route.ts`.

### Phase 5 — Long-term quest pool health
- Change daily selection from lifetime-exclusion to rolling 30-day exclusion.
- Surface category/difficulty focus in dashboard copy.
- **Files:** `app/api/quests/daily/route.ts`.

## Open decisions

1. **Impact page:** Build a standalone `/impact` page, or replace the landing "Impact tracker" card with `/insights`?
2. **First garden growth:** Give a 15-minute tutorial plant, or globally shorten common plants to ~1 hour?
3. **Trust multiplier size:** Apply full `0.4–1.0` multiplier to quest XP, or a gentler `0.8–1.1` band so low-trust users aren't punished too hard?
4. **Daily-clear guaranteed reward:** +10 EcoPoints, a guaranteed Wooden Chest, or both?
5. **Reminder channel:** Email (needs SendGrid), push notifications (needs service worker + subscription flow), or both?

## Risks to avoid

- Do **not** change the proof requirement model without updating the landing-page copy ("verified, rewarded habits").
- Do **not** weaken existing anti-cheat: any trust multiplier change must keep the server-authoritative reward path.
- Do **not** touch the document-store/file-DB fallback unless required; if new SQL is added, mirror it in `lib/db.ts` `fileSql`.
