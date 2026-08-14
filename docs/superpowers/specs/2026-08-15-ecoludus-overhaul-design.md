# EcoLudus Overhaul — Design Spec

**Date:** 2026-08-15
**Scope:** Chest redesign, navigation/state fix, performance pass, notification repositioning, Impact removal, final QA.

## Confirmed decisions

- **Impact removal depth:** "Page + carbon/trees" — delete the visible Impact surfaces and the Ecologi/milestone/tree-planting machinery; **keep** `grantImpact` + the `impact_events` ledger as the internal reward engine so all 9 reward routes keep working unchanged.
- **Chest economy:** quests give 25–120 EP (median 30) / 40–150 XP (median 45). Current chests dump 100–2500 EP. New chests give **2–5 small rewards** with EP capped ~120/slot and total EP per chest ≈ 5–240 (≈90% reduction).

---

## 1. Chest system redesign

### New module: `lib/chest-rewards.ts`

Single source of truth for chest reward tables, the RNG, and the applier. Extensible: adding a reward type = add an entry to `RewardType`, a pool, and a branch in `applyReward`.

```ts
export type RewardRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type RewardType = "points" | "xp" | "egg" | "seed" | "plant";

export type RolledReward = {
  type: RewardType;
  name: string;          // "EcoPoints" | "XP" | seed/egg/plant name
  rarity: RewardRarity;
  amount?: number;       // points/xp
  image: string;
  seedName?: string;     // seed convenience
  count: number;          // stack size after dedup
  isNew: boolean;         // first-time discovery (server-set)
};

type TableEntry = {
  type: RewardType;
  rarity: RewardRarity;
  weight: number;
  pointsRange?: [number, number];   // for points/xp
  eggPool?: string[];              // egg names
  seedPool?: string[];             // seed names (subset of SEED_CATALOG)
  plantRarities?: RewardRarity[];  // plant pool picked from catalog by rarity
};

type ChestTable = { rewardCount: [number, number]; entries: TableEntry[]; };
```

Four tables keyed by chest name, each meaningfully different:

| Chest | # rewards | points/slot | xp/slot | egg rarities | seed pool | plant |
|------|-----------|-------------|---------|--------------|-----------|-------|
| Wooden  | 2–3 | 5–15 (common)   | 10–25 (common)     | common        | common               | — |
| Bronze  | 2–4 | 10–30 (uncommon) | 20–50 (uncommon)    | common/rare   | common+uncommon      | common |
| Silver  | 3–4 | 20–60 (rare)     | 40–100 (rare)       | rare/epic     | uncommon+rare        | uncommon/rare |
| Golden  | 3–5 | 40–120 (epic)    | 80–200 (epic)       | epic/legendary| rare+epic            | rare/epic |

Weights per table favor points/xp at low tiers and shift toward species/eggs at high tiers (full weights in the module). No slot ever grants the old 1000–2500 EP.

### Roll algorithm
1. Look up the table by `chest.name`.
2. Roll `N = randomInt(count[0], count[1])` entries by weighted sampling (without replacement to push variety).
3. Resolve each entry to a concrete reward (points range → amount; egg/seed/plant pool → random name).
4. **Dedup/stack:** group identical `(type, name)` rewards into one `RolledReward` with `count` = occurrences. points/xp are summed (never stacked as items).
5. The applier mutates a single `nextProfile` in memory: `ecoPoints +=`, `xp +=` (recompute `level = calculateLevel(nextXp)` once at the end), seeds/eggs/plants inventory stacks, chest consumed.

### Server route: `app/api/chests/open/route.ts`
- Keep the existing `transaction` + `selectUserForUpdate` lost-update guard.
- Snapshot pre-grant owned seed/egg/plant names → set `isNew` per inventory reward.
- Build `nextProfile` from all rewards + chest consumption, **one** upsert (no `grantImpact`; chests stay a sink — XP is granted inline with `calculateLevel`, no impact-spine growth, no carbon).
- Response: `{ success, chestName, rewards: RolledReward[] }` (was `{ reward }`).
- `fileSql`: the route reuses existing query strings (the user upsert + selectUserForUpdate already have file branches). No new fileSql branch needed.

### Frontend: `app/(game)/collection/page.tsx`
- `openChest` sends the request, holds the shake animation, then renders `data.rewards` (array).
- Replace the single-reward reveal with a **staggered reward list**: each reward card has `RewardGlow` tinted by its rarity, `AnimatedNumber` for points/xp, stack badge `×count`, and a per-reward "✨ New Discovery ✨" banner (driven by server `isNew`).
- "Claim all & continue" button dismisses. Points/xp toasts summarize totals on claim.
- Chest-tinted background per chest rarity (reuse `var(--text-warning)` / rarity accents).

---

## 2. Navigation / stale-state fix

**Root cause class:** page data (profile) is SWR-cached; on revisit/browser-back within the dedupe window, the cached profile is shown without revalidating, so profile-derived values (EcoPoints, affordability, counts) can be stale after a mutation on another page.

**Fix (no full reloads):**
- `lib/useAuth.ts` profile SWR: add `revalidateOnMount: true` (keeps `revalidateOnFocus`, `revalidateIfStale`). Cached value renders instantly; a deduped background revalidation runs on every mount → fresh profile on every navigation. Dedupe (15s) prevents stampedes.
- Add a single `<SWRConfig value={{...}}>` provider in `app/(game)/layout.tsx` so layout + page mounts share one cache and default options (provider is the global cache; centralizes config).
- Catalog SWR stays long-cached (static, `revalidateOnFocus:false`, 5min dedupe) — correct for shop/collection.
- Confirm `PageTransition` `key={pathname}` remounts pages on nav (already does) — local `mode`/`filter` state resets cleanly per visit (expected).
- Verify browser back/forward: remount + revalidate → fresh. No `cache: "no-store"` on profile.

---

## 3. Performance pass (focused; SWR/next/image already in)

- **Remove Impact fetches:** dashboard drops its per-mount `GET /api/stats/impact` (+ `weekImpact` state/effect) and the "CO2 Reduced" stat — fewer requests, lighter dashboard.
- **Profile freshness via deduped revalidation** (above) — no extra steady-state cost.
- Add lightweight per-route `loading.tsx` under `app/(game)/` for shop/collection/dashboard so client-bundle load shows an instant skeleton instead of a blank frame (perceived nav speed).
- Audit for duplicate/unused fetches during QA; no blocking requests introduced.

---

## 4. Notification / toast repositioning

- **`lib/toast.tsx`:** move the live region from bottom-center to **top-right on desktop, top-center on mobile** — `fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0`, `flex-col items-center md:items-end`, `max-w-[min(92vw,28rem)]`. Stack downward. Never overflows (capped width + right/top anchors).
- **Dashboard old per-page toast:** the dashboard was left un-migrated (per project memory) and still renders an old left-side pill toast. Migrate it to `useToast` and delete the old local toast UI/state — that removes the "left side, partially off-screen" notification the user sees.
- Keep auto-dismiss, manual-dismiss-on-click, dedupe, reduced-motion, aria-live.
- `notification-bell.tsx` dropdown already anchored safely (`right-0` mobile / `left-0` desktop, `w-[min(20rem,calc(100vw-2rem))]`); keep. Audit other `fixed` elements for overflow (sidebar/modals are inset-bounded — fine).

---

## 5. Impact removal (Page + carbon/trees)

**Delete:**
- `app/(game)/impact/page.tsx`, `app/(game)/impact/layout.tsx` (route gone).
- `app/api/stats/impact/route.ts` (dashboard fetch gone).
- `lib/rewards-sync.ts` (Ecologi tree-planting + milestone engine).
- `app/api/cron/process-rewards/route.ts` + the `process-rewards` entry in `vercel.json` crons.
- Remove `import { checkAndProcessMilestones }` + its fire-and-forget call from `app/api/quests/complete/route.ts` and `lib/private-missions.ts`.
- Dashboard: remove "Impact this week" HeroMetric, `weekImpact` state + its `useEffect`, and the "CO2 Reduced" StatGrid item.
- `components/notification-bell.tsx`: remove the "View all → /impact" footer link and the `tree_planted` icon entry (old notifications fall back to 🔔).
- `app/robots.ts`: remove `"/impact"` from the allowlist.

**Keep (internal reward engine, per decision):**
- `lib/impact-service.ts` (`grantImpact`), `impact_events` table + ledger + fileSql branches + migrations, `getImpactSince`/`getRecentImpact` (weekly report cron still uses them), `lib/carbon-calc.ts` (quest carbon calc), `lib/types.ts` impact types.
- `/api/stats/community-aggregate` + its fileSql branch — still used by `components/community-pulse.tsx` on the landing page.

**Verify after removal:** no broken imports (rewards-sync consumers updated), no dead `/impact` links (bell/robots/dashboard), no empty nav items, build + lint + typecheck clean.

---

## 6. Final QA

`npm run typecheck && npm run lint && npm run build`; then manual: open chests of each tier (verify reward counts/rarities/amounts, dedup/stacking, reveal animation, new-discovery banner, EP/XP totals sane); navigate Collection↔Shop↔Dashboard with browser back/forward (verify fresh profile/affordability, no stale state, no console errors); check toasts top-right desktop + top-center mobile, stacking + dismiss; survey mobile for overflow; confirm Impact routes 404 and nothing links to them.

---

## Out of scope / extension points

- New reward types (boosters, cosmetics) are deliberate extension points — add a `RewardType` + pool + `applyReward` branch. Not implemented now to avoid dead, unconsumed features.
- A 5th "Legendary" chest tier is possible once a chest image asset exists; 4 tiers + 5 reward rarities is complete for now.
- The `grantImpact` internal spine/`carbonReduced` remain computed-but-undisplayed by design (user decision).