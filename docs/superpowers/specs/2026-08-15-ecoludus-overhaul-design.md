# EcoLudus Overhaul — Design Spec

**Date:** 2026-08-15
**Scope:** Chest redesign, navigation/state fix, performance pass, notification repositioning, Impact removal, final QA.

## Confirmed decisions

- **Impact removal depth:** "Page + carbon/trees" — delete the visible Impact surfaces and the Ecologi/milestone/tree-planting machinery; **keep** `grantImpact` + the `impact_events` ledger as the internal reward engine so all 9 reward routes keep working unchanged.
- **Chest economy:** quests give 25–120 EP (median 30) / 40–150 XP (median 45). Current chests dump 100–2500 EP. New chests give **2–5 small rewards** with EP capped ~120/slot and total EP per chest ≈ 5–240 (≈90% reduction).
- **Reward categories (user list → concrete types):** the user asked chests to contain "EcoPoints, XP, Eggs, Items, Cosmetics, Collectibles, Boosters." Mapping to the app's real inventories:
  - EcoPoints → `points` · XP → `xp` · Eggs → `egg` · Collectibles → `seed` + `plant` + `egg` + `cosmetic` · Items (usable) → `booster` · Cosmetics → `cosmetic` · Boosters → `booster`.
  - User chose **"Build Booster + Cosmetics"**, so the chest engine has **7 reward types**: `points | xp | egg | seed | plant | booster | cosmetic`. Items/Cosmetics/Boosters are no longer extension points — they're built now.

---

## 1. Chest system redesign

### New module: `lib/chest-rewards.ts`

Single source of truth for chest reward tables, the RNG, and the applier. Extensible: adding a reward type = add an entry to `RewardType`, a pool, and a branch in `applyReward`.

```ts
export type RewardRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type RewardType = "points" | "xp" | "egg" | "seed" | "plant" | "booster" | "cosmetic";

export type RolledReward = {
  type: RewardType;
  name: string;          // "EcoPoints" | "XP" | seed/egg/plant/cosmetic/booster name
  rarity: RewardRarity;
  amount?: number;       // points/xp (summed if a slot rolls points/xp >1×)
  image: string;         // for species: existing asset; for booster/cosmetic: emoji or CSS swatch (no image assets)
  count: number;          // stack size after dedup (booster = charges added)
  isNew: boolean;         // first-time discovery (server-set)
  // type-specific convenience:
  boosterKind?: "xp" | "eco";
  boosterMultiplier?: number;
  boosterCharges?: number;
  cosmeticId?: string;
  cosmeticSlot?: "frame" | "background";
  dupeRefund?: number;   // EP refunded when a owned cosmetic rolled as a duplicate
};

type TableEntry = {
  type: RewardType;
  rarity: RewardRarity;
  weight: number;
  pointsRange?: [number, number];   // for points/xp
  eggPool?: string[];              // egg names
  seedPool?: string[];             // seed names (subset of SEED_CATALOG)
  plantRarities?: RewardRarity[];  // plant pool picked from catalog by rarity
  boosterKind?: "xp" | "eco";      // for booster
  cosmeticSlot?: "frame" | "background"; // for cosmetic
};

type ChestTable = { rewardCount: [number, number]; entries: TableEntry[]; };
```

Four tables keyed by chest name, each meaningfully different. `booster` and `cosmetic` are **rare finds** — only Bronze+, low weight, rarity climbing with tier:

| Chest | # rewards | points/slot | xp/slot | egg rarities | seed pool | plant | booster | cosmetic |
|------|-----------|-------------|---------|--------------|-----------|-------|---------|----------|
| Wooden  | 2–3 | 5–15 (common)    | 10–25 (common)    | common        | common            | — | — | — |
| Bronze  | 2–4 | 10–30 (uncommon) | 20–50 (uncommon) | common/rare   | common+uncommon   | common | uncommon xp (1.5×, 3) | — |
| Silver  | 3–4 | 20–60 (rare)     | 40–100 (rare)    | rare/epic     | uncommon+rare    | uncommon/rare | rare xp/eco (2×, 3) | uncommon frame |
| Golden  | 3–5 | 40–120 (epic)    | 80–200 (epic)    | epic/legendary| rare+epic         | rare/epic | epic xp/eco (2×, 5) | rare/epic frame + background (small legendary chance) |

Weights per table favor points/xp at low tiers and shift toward species/eggs/booster/cosmetic at high tiers (full weights in the module). No slot ever grants the old 1000–2500 EP.

### Roll algorithm
1. Look up the table by `chest.name`.
2. Roll `N = randomInt(count[0], count[1])` entries by weighted sampling (without replacement to push variety).
3. Resolve each entry to a concrete reward (points range → amount; egg/seed/plant pool → random name; booster → fixed kind/multiplier/charges from the entry; cosmetic → random id from `COSMETIC_CATALOG` filtered by slot+rarity).
4. **Dedup/stack:** group identical `(type, name)` rewards into one `RolledReward` with `count` = occurrences. points/xp amounts are summed (never stacked as items). boosters stack by `(kind, multiplier)` → charges add. seeds/eggs/plants stack by name → count adds.
5. **Duplicate handling (logical, no wasted chests):**
   - seeds/eggs/plants/booster: stack (dupes are useful — more count/charges). `isNew` only on first-ever ownership of that name/kind.
   - **cosmetic: binary-owned.** If the rolled cosmetic id is already in `profile.cosmetics.owned`, it's a duplicate → convert to an **EcoPoint shard refund** scaled by rarity (e.g. uncommon 10, rare 25, epic 60, legendary 120 EP) and mark the reward `type:"points"` with `dupeRefund` set so the reveal shows "✨ Dupe → +N EcoPoints". This guarantees every chest feels rewarding and prevents cosmetic-flood exploits (you can't farm a cosmetic for infinite value — the refund is small and capped by the chest's EP budget).
6. The applier mutates a single `nextProfile` in memory: `ecoPoints +=` (incl. dupe refunds), `xp +=` (recompute `level = calculateLevel(nextXp)` once at the end), seeds/eggs/plants inventory stacks, `boosters` charges add (see 1b), `cosmetics.owned` append new ids (see 1c), chest consumed.

### Server route: `app/api/chests/open/route.ts`
- Keep the existing `transaction` + `selectUserForUpdate` lost-update guard.
- Snapshot pre-grant owned seed/egg/plant names **and** `cosmetics.owned` **and** booster kinds → set `isNew` per inventory reward; resolve cosmetic dupes to shard refunds.
- Build `nextProfile` from all rewards + chest consumption, **one** upsert (no `grantImpact`; chests stay a sink — XP is granted inline with `calculateLevel`, no impact-spine growth, no carbon).
- Response: `{ success, chestName, rewards: RolledReward[] }` (was `{ reward }`).
- `fileSql`: the route reuses existing query strings (the user upsert + selectUserForUpdate already have file branches). No new fileSql branch needed. The new payload fields (`boosters`, `cosmetics`) ride inside `payload` — no schema change, no new SQL.

### Frontend: `app/(game)/collection/page.tsx`
- `openChest` sends the request, holds the shake animation, then renders `data.rewards` (array).
- Replace the single-reward reveal with a **staggered reward list**: each reward card has `RewardGlow` tinted by its rarity, `AnimatedNumber` for points/xp (and dupe refunds), stack badge `×count` (booster shows "×{charges} charges"), a cosmetic swatch (CSS-rendered), and a per-reward "✨ New Discovery ✨" banner (driven by server `isNew`).
- "Claim all & continue" button dismisses. Points/xp toasts summarize totals on claim; a toast notes any new cosmetic unlock.
- Chest-tinted background per chest rarity (reuse `var(--text-warning)` / rarity accents).

---

## 1b. Eco-Booster consumable (new subsystem)

A **booster** is a consumable that multiplies quest rewards on the next few completions. Self-contained: a small `boosters` array in the profile + a consume-check in the quest-complete route. No activation UI — boosters auto-apply, so there's no "forget to activate" failure mode and no separate surface.

### Catalog (TS constant — `lib/catalog.ts`, like `PET_CATALOG`/`SEED_CATALOG`; no DB seed, no fileSql branch)
```ts
export type BoosterKind = "xp" | "eco";
export type BoosterDef = {
  id: string;            // "xp-2x-3"
  kind: BoosterKind;
  multiplier: number;     // 1.5 | 2
  charges: number;        // 3 | 5
  name: string;           // "XP Booster", "Eco Booster"
  rarity: RewardRarity;
  emoji: string;          // 🚀 for xp, 💰 for eco (no image assets)
};
export const BOOSTER_CATALOG: BoosterDef[] = [ /* the 4 entries from the table above */ ];
```

### Profile payload
- New field `boosters: Booster[]` where `Booster = { kind: "xp"|"eco"; multiplier: number; charges: number }` (stacks by `kind+multiplier`). Default `[]` in `buildInitialProfile`.
- Add `boosters: []` to the `EMPTY_STORE` default user payload in `lib/db.ts` so the file-DB fallback and real Postgres agree on the shape.

### Quest-complete integration (`app/api/quests/complete/route.ts`, inside the existing locked `tx`)
- Before `grantImpact` (around the `baseXp`/`ecoReward` computation, ~line 319–332): read `profile.boosters`, find one available xp-booster and one available eco-booster, multiply `baseXp` (xp kind) and `ecoReward` (eco kind) by their multipliers, and decrement one charge each into `patch.boosters` (drop stacks at 0 charges).
- **Anti-exploit rule:** at most **one booster of each kind applies per completion** (no multiplier stacking → no exponential XP). `baseImpact` passed to `grantImpact` stays the **unboosted** `xpReward`, so the impact spine measures real activity, not the booster perk — mirroring the existing companion-bonus decision.
- Response `totals` adds `appliedBoosters?: {kind, multiplier}[]` so the UI can show "🚀 2× XP applied!" on the completion toast.

### UI surfaces
- **Dashboard:** a compact active-booster pill near the daily-quests panel — "🚀 2× XP (3 left)" / "💰 1.5× Eco (2 left)" — only when charges > 0.
- **Collection page:** new **Boosters** tab (Pokédex style) — owned booster stacks with remaining charges; undiscovered booster kinds as locked silhouettes; "X/Y discovered" counter. Driven by `BOOSTER_CATALOG` (master list) + `profile.boosters` (discovery).

---

## 1c. Cosmetics system (new subsystem)

Avatar cosmetics unlocked from chests. **CSS-based — no image assets** (none exist): a **frame** is a ring/shadow style layered over the `Avatar`; a **background** is a gradient behind the avatar in the profile hero. Defined as a TS constant catalog; rendered via inline styles.

### Catalog (TS constant — `lib/catalog.ts`; no DB seed, no fileSql branch)
```ts
export type CosmeticSlot = "frame" | "background";
export type CosmeticDef = {
  id: string;            // "frame-verdant", "bg-forest"
  slot: CosmeticSlot;
  name: string;           // "Verdant Ring", "Forest Glow"
  rarity: RewardRarity;
  // Resolved to CSSProperties by cosmeticStyle(def) in lib/cosmetics.ts:
  frame?: { boxShadow: string; border?: string; outline?: string };   // slot:"frame"
  background?: { background: string };                                // slot:"background"
};
export const COSMETIC_CATALOG: CosmeticDef[] = [ /* ~4 frames + ~4 backgrounds across uncommon→legendary */ ];
```
Example frames: Verdant Ring (uncommon, green double-ring), Sunfire Ring (rare, orange glow), Mystic Halo (epic, purple glow), Golden Laurel (legendary, gold + pulse). Backgrounds: Forest Glow, Sunset, Aurora, Starfield.

### Profile payload
- New field `cosmetics: { owned: string[]; equippedFrame: string | null; equippedBackground: string | null }`. Default `{ owned: [], equippedFrame: null, equippedBackground: null }` in `buildInitialProfile` + `EMPTY_STORE`.
- Chest route appends new ids to `owned` (see 1.4 dupes).

### Equip — dedicated server route `POST /api/cosmetics/equip`
- **Do NOT widen `CLIENT_WRITABLE_USER_FIELDS`** (displayName/profileImage/settings/theme/preferences). `cosmetics` carries game-state (owned set), so client-writable is wrong.
- Route: `getSession()` → zod `{ slot: "frame"|"background", id: string }` → load profile in `transaction`+`selectUserForUpdate` → validate `id` is in `COSMETIC_CATALOG` **and** in `profile.cosmetics.owned` → write `equippedFrame`/`equippedBackground` (or `null` to unequip) → single upsert (reuse the existing user-upsert query string → fileSql branch already exists). 403 if not owned.
- No new fileSql branch (reuses existing upsert + selectUserForUpdate).

### Rendering
- `components/avatar.tsx`: add optional `frame?: CosmeticDef` and `background?: CosmeticDef` props → `background` renders as an absolutely-positioned gradient layer behind the avatar circle; `frame` as an overlay ring via `cosmeticStyle(def)`. Honors existing reduced-motion/image-error paths.
- **Profile hero** (`components/public-profile.tsx`): owner + public views render equipped `frame` + `background` on the `<Avatar>`. Pass equipped cosmetics through the `PublicProfile` shape (owner builds it from full profile; the public single-profile endpoint must include `cosmetics.equippedFrame/equippedBackground` so others see your look — verify that endpoint during implementation).
- **Sidebar/leaderboard avatars:** equipped **frame** only (backgrounds are profile-hero-specific) where the profile is already in context.

### UI surface — Collection page
- New **Cosmetics** tab (Pokédex style): two sub-sections (Frames / Backgrounds). Each owned cosmetic shown with its CSS swatch + rarity; click → equip via `/api/cosmetics/equip` (optimistic SWR mutate on profile); currently-equipped one is highlighted. Undiscovered cosmetics as locked silhouettes + "X/Y discovered" per slot. Driven by `COSMETIC_CATALOG` (master list) + `profile.cosmetics.owned` (discovery) + equipped fields.

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
- **Code-splitting + prefetching (explicit):** App Router already auto-splits per route; ensure nav cards use `next/link` (default prefetch on hover/viewport) so the next route's JS is warm. **Lazy-load the heavy chest + hatch reveal modals** in the collection page (`next/dynamic` with `ssr:false`) so the 1k+ line reveal code isn't in the initial page bundle — it only loads when a chest/egg is opened. Keep the species grid eager.
- Audit for duplicate/unused fetches during QA; no blocking requests introduced.

---

## 4. Notification / toast repositioning

- **`lib/toast.tsx`:** move the live region from bottom-center to **top-right on desktop, top-center on mobile** — `fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0`, `flex-col items-center md:items-end`, `max-w-[min(92vw,28rem)]`. Stack downward. Never overflows (capped width + right/top anchors).
- **Don't cover the bell (explicit):** the mobile notification bell sits at the **top-right** of the mobile top bar — this is why mobile toasts go **top-center** (not top-right), so they never overlap the bell. On desktop the bell is in the sidebar (left), so top-right toasts are clear of it. Verify during QA: trigger a toast on mobile while the bell has a badge and confirm no overlap; confirm desktop toasts don't cover any top-right page content.
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

`npm run typecheck && npm run lint && npm run build`; then manual:
- **Chests:** open each tier — verify reward counts (2–5)/rarities (5 bands)/amounts, dedup/stacking (seeds/eggs/booster stack; cosmetic dupe → EP refund banner), staggered reveal animation, new-discovery banner, EP/XP totals sane (no 1000+ EP), booster + cosmetic drops appear only at Bronze+ with correct rarity.
- **Boosters:** a rolled booster adds charges to `profile.boosters`; completing a quest consumes one xp/eco charge and multiplies that completion's reward (verify the dashboard booster pill decrements; verify the completion toast shows "2× applied"); confirm a second xp-booster does NOT stack in a single completion (anti-exploit).
- **Cosmetics:** a rolled cosmetic unlocks in the Collection → Cosmetics tab; equipping via that tab persists and renders on the profile hero (owner + public view) and the sidebar avatar frame; rolling an already-owned cosmetic refunds EP; unequip works.
- **Nav:** Collection↔Shop↔Dashboard with browser back/forward — verify fresh profile/affordability, no stale state, no console errors, no full reloads.
- **Toasts:** top-right desktop + top-center mobile, stacking + dismiss; confirm no overlap with the notification bell on mobile.
- **Impact:** `/impact` 404s; nothing links to it (bell, robots, dashboard, sidebar).
- **Mobile/perf:** survey mobile for overflow; confirm the collection reveal modal is code-split (not in initial bundle); confirm Link prefetch on nav cards.

---

## Out of scope / extension points

- A 5th "Legendary" chest tier is possible once a chest image asset exists; 4 tiers + 5 reward rarities is complete for now.
- The `grantImpact` internal spine/`carbonReduced` remain computed-but-undisplayed by design (user decision).
- **More cosmetic slots** (e.g. avatar badges, profile banners) = add a `CosmeticSlot` + catalog entries + a render branch in `Avatar`/hero. The slot system is the extension point; frames/backgrounds are the first two.
- **Booster variants beyond xp/eco** (e.g. a carbon-booster) = add a `BoosterKind` + a consume branch in the relevant route. xp/eco are the first two.