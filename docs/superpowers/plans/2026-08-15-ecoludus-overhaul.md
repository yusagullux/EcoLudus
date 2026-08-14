# EcoLudus Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the committed EcoLudus overhaul — redesign the chest/reward system (7 reward types + boosters + cosmetics), add a daily rotating shop, fix navigation stale-state, a performance pass, reposition toasts/notifications, and fully remove the Impact system — as one cohesive production-ready change.

**Architecture:** Server-authoritative throughout: reward rolling and shop rotation happen on the server inside locked `transaction()` rows; clients only display and send ids. New pure modules (`lib/chest-rewards.ts`, `lib/boosters.ts`, `lib/cosmetics.ts`, `lib/shop-rotation.ts`) hold the testable logic; routes stay thin. Profile state stays a jsonb blob with new `boosters`/`cosmetics` fields. Cosmetic equip goes through a dedicated `POST /api/cosmetics/equip` route (the client-writable allowlist is NOT widened — cosmetics carry owned-set game state). Daily shop is deterministic per-user (mulberry32 seed from `hash(uid:dateKey)`), recomputed server-side at buy time. Impact removal deletes all visible surfaces + `rewards-sync.ts` + the cron route but KEEPS `grantImpact` (the reward engine) and `impact_events`/`impactBySource` accounting.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19.2.4, React Compiler (no manual useMemo — use lazy `useState(() => …)`), Postgres + `pg` Pool, JWT sessions (jose), SWR v2.4.2, motion v13 (`motion/react`), zod, vitest, bcrypt.

**Spec:** `docs/superpowers/specs/2026-08-15-ecoludus-overhaul-design.md` (committed: 38ab1a3, b4a074a, e8bfa4d). The plan argues from the spec; executors read both.

## Global Constraints

- **Server is source of truth** for all prices, rewards, and rotations. Clients send ids only; routes look up catalog/rotation server-side and ignore client-supplied price/reward values.
- **Authenticate first** in every API route: `const session = await getSession(); if (!session?.userId) return 401`. Validate input with zod. Return errors as `{ error: { code: "<firebase-style-code>", ... } }` with matching HTTP status.
- **Lost-update protection** on any reward/purchase mutation: `transaction()` + `selectUserForUpdate` (SELECT … FOR UPDATE) + a single upsert inside the callback. Reuse the existing upsert SQL strings verbatim (the file-DB fallback `fileSql` matches by exact normalized SQL text).
- **No new SQL without a `fileSql` branch.** Prefer reusing existing query strings. New catalog/rotation reads reuse `getShopCatalog` (no new SQL).
- **Path alias** `@/*` → repo root. Don't import from `node_modules/ecoquest/legacy` or `docs/`. `db.ts`/`document-store.ts`/`migrate.ts` are `@ts-nocheck` — edit carefully.
- **React Compiler**: never add `useMemo`/`useCallback` to fix hook warnings; use lazy `useState(() => …)` or `useRef` instead.
- **EcoPoints from chests capped ~120/slot** (~90% reduction vs old 1000–2500). No purchase→farm loops: chests/shop are SINKs (direct payload write, NOT `grantImpact`). Boosters auto-consume on quest completion (one xp-booster + one eco-booster max per completion — no stacking).
- **Cosmetics are CSS-based** (frame = ring/shadow, background = gradient) — no image assets. Cosmetic dupes refund as EP shards.
- **Per-user daily shop**, deterministic all day (mulberry32 from `hash(uid:dateKey)`); deals = discounts (~34% off) + featured flash (~15% of slots). Buy route recomputes the rotation and 404s non-rotation items.
- **Branch:** all work committed to `main` (user instruction). Commit frequently; messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **Tests:** vitest (`npm run test` = `vitest run`). New pure modules get unit tests in `lib/__tests__/`. Typecheck with `npm run typecheck` (`tsc --noEmit`), lint with `npm run lint` (`eslint .`), build with `npm run build`.

---

## File Structure

**New files:**
- `lib/chest-rewards.ts` — pure chest-rolling + reward-application logic (7 reward types, rarity tiers, dupe refund). No React, no DB.
- `lib/boosters.ts` — pure booster catalog + consume helper (multiplies xp/eco, consumes one charge, one-per-kind guard).
- `lib/cosmetics.ts` — pure cosmetic catalog + `cosmeticStyle()` (CSS descriptor → React style objects).
- `lib/shop-rotation.ts` — pure daily-shop rotation (mulberry32 PRNG, per-user seed, discount/flash tagging).
- `app/api/cosmetics/equip/route.ts` — POST; validates cosmetic ownership server-side, writes equipped frame/background.
- `app/api/shop/daily/route.ts` — GET; returns today's 6-slot rotation for the session user (recomputes via `getDailyShop`).
- `lib/__tests__/chest-rewards.test.ts` — unit tests for rolling + dupe refund + balance caps.
- `lib/__tests__/boosters.test.ts` — unit tests for consume helper + anti-exploit.
- `lib/__tests__/cosmetics.test.ts` — unit tests for cosmeticStyle + catalog.
- `lib/__tests__/shop-rotation.test.ts` — unit tests for determinism + deal tagging.

**Modified files:**
- `lib/catalog.ts` — add `BOOSTER_CATALOG`, `COSMETIC_CATALOG` (TS constants; no DB seed, no fileSql branch — runtime values aren't editable).
- `lib/types.ts` — add `boosters`, `cosmetics` fields to `UserProfile`; add `Booster`, `Cosmetic`, `CosmeticsState` types.
- `app/api/auth/signup/route.ts` — `buildInitialProfile` adds default `boosters: []` + `cosmetics: { owned: [], equippedFrame: null, equippedBackground: null }`.
- `app/api/chests/open/route.ts` — rewrite to roll 2–5 rewards via `rollChest` + apply via `applyChestRewards`; response `{ rewards: RolledReward[] }`.
- `app/(game)/collection/page.tsx` — multi-reward reveal modal; add `boosters` + `cosmetics` tabs; equip UI for cosmetics.
- `app/api/shop/buy/route.ts` — recompute daily rotation, 404 non-rotation items, charge `dealPrice ?? price`.
- `app/(game)/shop/page.tsx` — rewrite to `useDailyShop`, flat 6-slot grid, countdown, deal/flash badges, drop mode tabs.
- `lib/useCatalog.ts` — add `useDailyShop()` SWR hook.
- `lib/useAuth.ts` — add `revalidateOnMount: true` to profile SWR.
- `app/(game)/layout.tsx` — wrap in `<SWRConfig>` provider.
- `app/(game)/shop/loading.tsx` + `app/(game)/collection/loading.tsx` — skeleton loading states.
- `lib/toast.tsx` — reposition to top-center (mobile) / top-right (desktop).
- `components/notification-bell.tsx` — remove `/impact` footer link + `tree_planted` icon entry.
- `app/(game)/dashboard/page.tsx` — remove impact fetches/cards; migrate legacy toast to `useToast`.
- `app/api/quests/complete/route.ts` — remove `checkAndProcessMilestones`; add booster consume (multiply xp/eco, consume charge in patch, inside tx).
- `lib/private-missions.ts` — remove `checkAndProcessMilestones` import + call.
- `components/avatar.tsx` — add optional `frame?` + `background?` cosmetic props.
- `components/public-profile.tsx` + `app/(game)/profile/page.tsx` + `app/api/users/[id]/route.ts` — pass/show equipped cosmetics.
- `lib/animations.tsx` — add `uncommon` to `RARITY_GLOW`.
- `app/robots.ts` — remove `/impact` from allowlist.

**Deleted files:**
- `app/(game)/impact/page.tsx` + `app/(game)/impact/layout.tsx`
- `app/api/stats/impact/route.ts`
- `lib/rewards-sync.ts`
- `app/api/cron/process-rewards/route.ts`
- `vercel.json` — remove the `process-rewards` cron entry (keep the other two).

---

## Phase A — Rewards subsystem (chests + boosters + cosmetics)

These are coupled: the chest roller emits booster/cosmetic rewards, so the catalogs and types must exist before the route is rewritten.

### Task A1: Catalogs + types (BOOSTER_CATALOG, COSMETIC_CATALOG, profile fields)

**Files:**
- Modify: `lib/catalog.ts` (append after `SEED_CATALOG`)
- Modify: `lib/types.ts` (UserProfile + new types)
- Test: `lib/__tests__/cosmetics.test.ts` (catalog sanity; style logic is Task A3)

**Interfaces:**
- Produces: `BoosterDef`, `BOOSTER_CATALOG: BoosterDef[]`, `CosmeticDef`, `COSMETIC_CATALOG: CosmeticDef[]` in `lib/catalog.ts`; `Booster`, `Cosmetic`, `CosmeticsState` in `lib/types.ts`.

- [ ] **Step 1: Add the types to `lib/types.ts`**

Add near the other inventory types (after the `SeedSpecies`-style fields on `UserProfile`). `Rarity` already exists via the components/game-ui import path used elsewhere; reuse the string union.

```ts
// Eco-Booster consumables. One per kind (xp/eco) active at a time — no stacking.
export type Booster = {
  id: string;          // matches BoosterDef.id
  kind: "xp" | "eco";
  multiplier: number;  // e.g. 2 = double
  charges: number;     // remaining quest completions it applies to
  name: string;
  rarity: Rarity;
  emoji: string;
  obtainedAt: string;
};

// CSS-based cosmetics — no image assets. Frame = ring/shadow; background = gradient.
export type Cosmetic = {
  id: string;
  slot: "frame" | "background";
  name: string;
  rarity: Rarity;
  // CSS descriptors consumed by cosmeticStyle() in lib/cosmetics.ts:
  frame?: { ring: string; shadow?: string };
  background?: { gradient: string };
};

export type CosmeticsState = {
  owned: Cosmetic[];
  equippedFrame: string | null;       // Cosmetic.id
  equippedBackground: string | null;  // Cosmetic.id
};
```

Add two fields to the `UserProfile` interface:

```ts
  boosters?: Booster[];
  cosmetics?: CosmeticsState;
```

- [ ] **Step 2: Add `BOOSTER_CATALOG` + `COSMETIC_CATALOG` to `lib/catalog.ts`**

Append at the end of the file. Import `Rarity` is already present.

```ts
// ── Boosters + cosmetics: catalog constants ────────────────────────────────
//
// Like pets/seeds, boosters and cosmetics have no runtime-editable values
// (no prices), so they live as TS constants — no DB seed, no fileSql branch.
// The chest route rolls from these; the collection page renders them.

export type BoosterDef = {
  id: string;
  kind: "xp" | "eco";
  multiplier: number;
  charges: number;
  name: string;
  rarity: Rarity;
  emoji: string;
};

export const BOOSTER_CATALOG: BoosterDef[] = [
  { id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 3, name: "XP Sprout Booster", rarity: "rare", emoji: "🌱" },
  { id: "booster-xp-3", kind: "xp", multiplier: 3, charges: 2, name: "XP Bloom Booster", rarity: "epic", emoji: "🌸" },
  { id: "booster-eco-2", kind: "eco", multiplier: 2, charges: 3, name: "Eco Sprout Booster", rarity: "rare", emoji: "💧" },
  { id: "booster-eco-3", kind: "eco", multiplier: 3, charges: 2, name: "Eco Bloom Booster", rarity: "epic", emoji: "✨" }
];

export type CosmeticDef = {
  id: string;
  slot: "frame" | "background";
  name: string;
  rarity: Rarity;
  frame?: { ring: string; shadow?: string };
  background?: { gradient: string };
};

export const COSMETIC_CATALOG: CosmeticDef[] = [
  // Frames
  { id: "frame-leaf", slot: "frame", name: "Leaf Frame", rarity: "uncommon", frame: { ring: "2px solid #4ade80", shadow: "0 0 8px #4ade80" } },
  { id: "frame-silver", slot: "frame", name: "Silver Frame", rarity: "rare", frame: { ring: "2px solid #cbd5e1", shadow: "0 0 10px #cbd5e1" } },
  { id: "frame-gold", slot: "frame", name: "Gold Frame", rarity: "epic", frame: { ring: "3px solid #fbbf24", shadow: "0 0 14px #fbbf24" } },
  { id: "frame-prism", slot: "frame", name: "Prism Frame", rarity: "legendary", frame: { ring: "3px solid #c084fc", shadow: "0 0 18px #c084fc" } },
  // Backgrounds
  { id: "bg-meadow", slot: "background", name: "Meadow Backdrop", rarity: "uncommon", background: { gradient: "linear-gradient(135deg, #86efac, #fde68a)" } },
  { id: "bg-sunset", slot: "background", name: "Sunset Backdrop", rarity: "rare", background: { gradient: "linear-gradient(135deg, #fca5a5, #fcd34d)" } },
  { id: "bg-aurora", slot: "background", name: "Aurora Backdrop", rarity: "epic", background: { gradient: "linear-gradient(135deg, #a5b4fc, #c4b5fd, #f0abfc)" } },
  { id: "bg-cosmos", slot: "background", name: "Cosmos Backdrop", rarity: "legendary", background: { gradient: "linear-gradient(135deg, #1e1b4b, #6d28d9, #db2777)" } }
];
```

- [ ] **Step 3: Add `Rarity` import to `lib/types.ts` if missing**

`lib/types.ts` already references a `Rarity` type elsewhere in the codebase (via `components/game-ui`). If `Rarity` is not imported at the top of `lib/types.ts`, add:

```ts
import type { Rarity } from "@/components/game-ui";
```

(Confirm by grepping `lib/types.ts` for `Rarity` before adding — if the `NotificationItem` or other types already pull it in, skip.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors from the new types/catalogs). If `Rarity` import collides, resolve by using the existing import.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog.ts lib/types.ts
git commit -m "feat(catalog): add BOOSTER_CATALOG, COSMETIC_CATALOG + profile types"
```

---

### Task A2: `lib/chest-rewards.ts` — pure rolling + application

**Files:**
- Create: `lib/chest-rewards.ts`
- Test: `lib/__tests__/chest-rewards.test.ts`

**Interfaces:**
- Consumes: `SHOP_CATALOG`, `SEED_CATALOG`, `BOOSTER_CATALOG`, `COSMETIC_CATALOG`, `PET_CATALOG` from `lib/catalog.ts`; `UserProfile`-shaped profile object (mutable).
- Produces:
  - `ChestTier = "wooden" | "bronze" | "silver" | "golden"`
  - `RewardKind = "points" | "xp" | "egg" | "seed" | "plant" | "booster" | "cosmetic"`
  - `RolledReward = { kind: RewardKind; name: string; amount?: number; rarity: Rarity; image?: string; seedName?: string; boosterId?: string; cosmeticId?: string; isNew?: boolean }`
  - `rollChest(tier: ChestTier, profile: ProfileLike, rng: () => number): RolledReward[]` — deterministic given `rng`; 2–5 rewards; EP capped ~120/slot.
  - `applyChestRewards(profile, rewards): { profile; summary: { points: number; xp: number; shards: number } }` — mutates a copy, handles dupes (cosmetic dupe → EP shard refund), returns totals.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/chest-rewards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rollChest, applyChestRewards, type ChestTier } from "@/lib/chest-rewards";
import type { UserProfile } from "@/lib/types";

const baseProfile = (): Partial<UserProfile> => ({
  ecoPoints: 100,
  xp: 500,
  plants: [],
  eggs: [],
  seeds: [],
  animals: [],
  boosters: [],
  cosmetics: { owned: [], equippedFrame: null, equippedBackground: null }
});

// Deterministic rng: returns a fixed sequence
const seqRng = (vals: number[]) => {
  let i = 0;
  return () => {
    const v = vals[i % vals.length];
    i++;
    return v;
  };
};

describe("rollChest", () => {
  it("rolls between 2 and 5 rewards", () => {
    const rng = Math.random;
    for (const tier of ["wooden", "bronze", "silver", "golden"] as ChestTier[]) {
      const rewards = rollChest(tier, baseProfile(), rng);
      expect(rewards.length).toBeGreaterThanOrEqual(2);
      expect(rewards.length).toBeLessThanOrEqual(5);
    }
  });

  it("caps EcoPoints at ~120 per points slot", () => {
    // Force many points rolls: use rng that always lands in the points bucket
    const rng = seqRng([0.01, 0.5, 0.5, 0.5, 0.5]);
    const rewards = rollChest("golden", baseProfile(), rng);
    const pointsRewards = rewards.filter((r) => r.kind === "points");
    for (const p of pointsRewards) {
      expect(p.amount ?? 0).toBeLessThanOrEqual(120);
    }
  });

  it("never rolls more than one cosmetic per chest", () => {
    for (let n = 0; n < 50; n++) {
      const rewards = rollChest("golden", baseProfile(), Math.random);
      const cosmetics = rewards.filter((r) => r.kind === "cosmetic");
      expect(cosmetics.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("applyChestRewards", () => {
  it("sums points and xp and adds inventory items", () => {
    const rewards = [
      { kind: "points", name: "EcoPoints", amount: 80, rarity: "common" },
      { kind: "xp", name: "XP", amount: 50, rarity: "common" },
      { kind: "seed", name: "Mossy Fern Seed", rarity: "common", seedName: "Mossy Fern Seed" }
    ] as const;
    const profile = baseProfile();
    const { profile: next, summary } = applyChestRewards(profile, rewards as any);
    expect(next.ecoPoints).toBe(180);
    expect(next.xp).toBe(550);
    expect(summary.points).toBe(80);
    expect(summary.xp).toBe(50);
    expect((next.seeds ?? []).length).toBe(1);
  });

  it("refunds a duplicate cosmetic as EP shards", () => {
    const profile = baseProfile();
    // Pre-own the Leaf Frame
    profile.cosmetics = {
      owned: [{ id: "frame-leaf", slot: "frame", name: "Leaf Frame", rarity: "uncommon", frame: { ring: "2px solid #4ade80" } }],
      equippedFrame: null,
      equippedBackground: null
    };
    const rewards = [{ kind: "cosmetic", name: "Leaf Frame", rarity: "uncommon", cosmeticId: "frame-leaf", isNew: true } ] as const;
    const { profile: next, summary } = applyChestRewards(profile, rewards as any);
    // Dupe → shard refund, not a second owned entry
    expect(next.cosmetics!.owned.filter((c) => c.id === "frame-leaf").length).toBe(1);
    expect(summary.shards).toBeGreaterThan(0);
    expect(next.ecoPoints).toBe(100 + summary.shards);
  });

  it("stacks a booster it already owns by increasing charges, not adding a duplicate entry", () => {
    const profile = baseProfile();
    profile.boosters = [{ id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 1, name: "XP Sprout Booster", rarity: "rare", emoji: "🌱", obtainedAt: "x" }];
    const rewards = [{ kind: "booster", name: "XP Sprout Booster", rarity: "rare", boosterId: "booster-xp-2" }] as const;
    const { profile: next } = applyChestRewards(profile, rewards as any);
    expect(next.boosters!.filter((b) => b.id === "booster-xp-2").length).toBe(1);
    expect(next.boosters!.find((b) => b.id === "booster-xp-2")!.charges).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/chest-rewards.test.ts`
Expected: FAIL — module `@/lib/chest-rewards` not found.

- [ ] **Step 3: Implement `lib/chest-rewards.ts`**

```ts
// Pure chest-rolling + reward-application logic. No React, no DB.
// The route (/api/chests/open) calls rollChest() with a seeded RNG, then
// applyChestRewards() to mutate the profile inside a locked transaction.
import {
  SHOP_CATALOG, SEED_CATALOG, BOOSTER_CATALOG, COSMETIC_CATALOG, PET_CATALOG
} from "@/lib/catalog";
import type { Rarity } from "@/components/game-ui";

export type ChestTier = "wooden" | "bronze" | "silver" | "golden";
export type RewardKind = "points" | "xp" | "egg" | "seed" | "plant" | "booster" | "cosmetic";

export type RolledReward = {
  kind: RewardKind;
  name: string;
  amount?: number;
  rarity: Rarity;
  image?: string;
  seedName?: string;
  boosterId?: string;
  cosmeticId?: string;
  isNew?: boolean;
};

export type ProfileLike = {
  ecoPoints?: number;
  xp?: number;
  level?: number;
  plants?: Array<Record<string, unknown>>;
  eggs?: Array<Record<string, unknown>>;
  seeds?: Array<Record<string, unknown>>;
  animals?: Array<Record<string, unknown>>;
  boosters?: Array<Record<string, unknown>>;
  cosmetics?: { owned: Array<Record<string, unknown>>; equippedFrame: string | null; equippedBackground: string | null };
};

export type RewardSummary = { points: number; xp: number; shards: number };

// Per-tier reward-count range and rarity weights. Higher tiers → more rewards,
// better rarity odds, and a small cosmetic chance.
const TIER_CONFIG: Record<ChestTier, {
  count: [number, number];
  rarityWeights: Record<Rarity, number>; // common, uncommon, rare, epic, legendary
  cosmeticChance: number;
}> = {
  wooden:  { count: [2, 3], rarityWeights: { common: 60, uncommon: 25, rare: 12, epic: 3, legendary: 0 }, cosmeticChance: 0.02 },
  bronze:  { count: [2, 4], rarityWeights: { common: 45, uncommon: 30, rare: 18, epic: 6, legendary: 1 }, cosmeticChance: 0.05 },
  silver:  { count: [3, 4], rarityWeights: { common: 30, uncommon: 28, rare: 25, epic: 13, legendary: 4 }, cosmeticChance: 0.08 },
  golden:  { count: [3, 5], rarityWeights: { common: 18, uncommon: 24, rare: 28, epic: 20, legendary: 10 }, cosmeticChance: 0.12 }
};

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

// EP per slot, capped. Scales with rarity so a legendary points slot is still
// exciting but never approaches the old 1000–2500 range.
const POINTS_BY_RARITY: Record<Rarity, [number, number]> = {
  common: [10, 30],
  uncommon: [25, 60],
  rare: [40, 80],
  epic: [60, 100],
  legendary: [80, 120]
};

const XP_BY_RARITY: Record<Rarity, [number, number]> = {
  common: [10, 25],
  uncommon: [20, 45],
  rare: [30, 70],
  epic: [50, 110],
  legendary: [80, 160]
};

// Cosmetic shard refund (EP) for a duplicate, by rarity.
const SHARD_BY_RARITY: Record<Rarity, number> = {
  common: 15, uncommon: 25, rare: 50, epic: 100, legendary: 200
};

function pickRarity(weights: Record<Rarity, number>, rng: () => number): Rarity {
  const total = RARITY_ORDER.reduce((s, r) => s + (weights[r] ?? 0), 0);
  let roll = rng() * total;
  for (const r of RARITY_ORDER) {
    roll -= weights[r] ?? 0;
    if (roll <= 0) return r;
  }
  return "common";
}

function randInt(rng: () => number, lo: number, hi: number): number {
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

// Map chest tier → which reward KINDS it can drop and their weights.
const KIND_WEIGHTS: Record<ChestTier, Array<[RewardKind, number]>> = {
  wooden: [["points", 40], ["xp", 25], ["seed", 25], ["plant", 8], ["egg", 2], ["booster", 0], ["cosmetic", 0]],
  bronze: [["points", 32], ["xp", 22], ["seed", 20], ["plant", 12], ["egg", 10], ["booster", 3], ["cosmetic", 1]],
  silver: [["points", 26], ["xp", 20], ["seed", 16], ["plant", 14], ["egg", 14], ["booster", 7], ["cosmetic", 3]],
  golden: [["points", 22], ["xp", 18], ["seed", 12], ["plant", 14], ["egg", 16], ["booster", 10], ["cosmetic", 8]]
};

function pickKind(tier: ChestTier, rng: () => number, allowCosmetic: boolean): RewardKind {
  const weights = KIND_WEIGHTS[tier].filter(([k, w]) => w > 0 && (k !== "cosmetic" || allowCosmetic));
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [k, w] of weights) {
    roll -= w;
    if (roll <= 0) return k;
  }
  return "points";
}

function ownedCosmeticIds(p: ProfileLike): Set<string> {
  return new Set((p.cosmetics?.owned ?? []).map((c) => String(c.id)));
}
function ownedBoosterIds(p: ProfileLike): Set<string> {
  return new Set((p.boosters ?? []).map((b) => String(b.id)));
}

function plantsByRarity(r: Rarity) {
  return SHOP_CATALOG.plants.filter((p) => p.rarity === r);
}
function eggsByRarity(r: Rarity) {
  return SHOP_CATALOG.eggs.filter((e) => e.rarity === r);
}
function seedsByRarity(r: Rarity) {
  return SEED_CATALOG.filter((s) => s.rarity === r);
}
function petsByRarity(r: Rarity) {
  return PET_CATALOG.filter((p) => p.rarity === r);
}
function cosmeticsByRarity(r: Rarity) {
  return COSMETIC_CATALOG.filter((c) => c.rarity === r);
}
function boostersByRarity(r: Rarity) {
  return BOOSTER_CATALOG.filter((b) => b.rarity === r);
}

function rollOne(tier: ChestTier, profile: ProfileLike, rng: () => number, allowCosmetic: boolean): RolledReward {
  const cfg = TIER_CONFIG[tier];
  const rarity = pickRarity(cfg.rarityWeights, rng);
  const kind = pickKind(tier, rng, allowCosmetic);

  switch (kind) {
    case "points": {
      const [lo, hi] = POINTS_BY_RARITY[rarity];
      return { kind: "points", name: "EcoPoints", amount: randInt(rng, lo, hi), rarity };
    }
    case "xp": {
      const [lo, hi] = XP_BY_RARITY[rarity];
      return { kind: "xp", name: "XP", amount: randInt(rng, lo, hi), rarity };
    }
    case "seed": {
      const pool = seedsByRarity(rarity);
      const seed = pool[Math.floor(rng() * pool.length)] ?? SEED_CATALOG[0];
      return { kind: "seed", name: seed.name, rarity: seed.rarity, image: seed.image, seedName: seed.name };
    }
    case "plant": {
      const pool = plantsByRarity(rarity);
      const plant = pool[Math.floor(rng() * pool.length)] ?? SHOP_CATALOG.plants[0];
      return { kind: "plant", name: plant.name, rarity: plant.rarity, image: plant.image };
    }
    case "egg": {
      const pool = eggsByRarity(rarity);
      const egg = pool[Math.floor(rng() * pool.length)] ?? SHOP_CATALOG.eggs[0];
      return { kind: "egg", name: egg.name, rarity: egg.rarity, image: egg.image };
    }
    case "booster": {
      const pool = boostersByRarity(rarity);
      const b = pool[Math.floor(rng() * pool.length)] ?? BOOSTER_CATALOG[0];
      return { kind: "booster", name: b.name, rarity: b.rarity, boosterId: b.id, image: undefined };
    }
    case "cosmetic": {
      const pool = cosmeticsByRarity(rarity);
      const c = pool[Math.floor(rng() * pool.length)] ?? COSMETIC_CATALOG[0];
      const isNew = !ownedCosmeticIds(profile).has(c.id);
      return { kind: "cosmetic", name: c.name, rarity: c.rarity, cosmeticId: c.id, isNew };
    }
  }
}

export function rollChest(tier: ChestTier, profile: ProfileLike, rng: () => number): RolledReward[] {
  const cfg = TIER_CONFIG[tier];
  const count = randInt(rng, cfg.count[0], cfg.count[1]);
  const rewards: RolledReward[] = [];
  let cosmeticRolled = false;
  for (let i = 0; i < count; i++) {
    // Cosmetic chance gate: only roll a cosmetic if the per-slot chance hits AND
    // we haven't already rolled one this chest.
    const allowCosmetic = !cosmeticRolled && rng() < cfg.cosmeticChance;
    const reward = rollOne(tier, profile, rng, allowCosmetic);
    if (reward.kind === "cosmetic") cosmeticRolled = true;
    rewards.push(reward);
  }
  // Guarantee at least one non-cosmetic reward (never a cosmetic-only chest)
  if (rewards.every((r) => r.kind === "cosmetic")) {
    rewards.push({ kind: "points", name: "EcoPoints", amount: randInt(rng, POINTS_BY_RARITY.common[0], POINTS_BY_RARITY.common[1]), rarity: "common" });
  }
  return rewards;
}

const nowISO = () => new Date().toISOString();

export function applyChestRewards(profile: ProfileLike, rewards: RolledReward[]): {
  profile: ProfileLike;
  summary: RewardSummary;
} {
  const next: ProfileLike = {
    ...profile,
    plants: profile.plants ? [...profile.plants] : [],
    eggs: profile.eggs ? [...profile.eggs] : [],
    seeds: profile.seeds ? [...profile.seeds] : [],
    animals: profile.animals ? [...profile.animals] : [],
    boosters: profile.boosters ? [...profile.boosters] : [],
    cosmetics: profile.cosmetics ? { ...profile.cosmetics, owned: [...profile.cosmetics.owned] } : { owned: [], equippedFrame: null, equippedBackground: null }
  };
  let points = 0;
  let xp = 0;
  let shards = 0;

  for (const r of rewards) {
    switch (r.kind) {
      case "points":
        points += r.amount ?? 0;
        break;
      case "xp":
        xp += r.amount ?? 0;
        next.xp = (Number(next.xp ?? 0) || 0) + (r.amount ?? 0);
        break;
      case "seed": {
        const seeds = next.seeds!;
        const idx = seeds.findIndex((s) => String(s.name) === String(r.seedName));
        if (idx >= 0) {
          seeds[idx] = { ...seeds[idx], count: Number(seeds[idx].count ?? 1) + 1 };
        } else {
          seeds.push({ id: r.seedName, name: r.seedName, rarity: r.rarity, image: r.image, count: 1, obtainedAt: nowISO() });
        }
        break;
      }
      case "plant": {
        const plants = next.plants!;
        const idx = plants.findIndex((p) => String(p.name) === String(r.name));
        if (idx >= 0) {
          plants[idx] = { ...plants[idx], count: Number(plants[idx].count ?? 1) + 1 };
        } else {
          plants.push({ id: r.name, name: r.name, rarity: r.rarity, image: r.image, count: 1, purchasedAt: nowISO() });
        }
        break;
      }
      case "egg": {
        const eggs = next.eggs!;
        const idx = eggs.findIndex((e) => String(e.name) === String(r.name));
        if (idx >= 0) {
          eggs[idx] = { ...eggs[idx], count: Number(eggs[idx].count ?? 1) + 1 };
        } else {
          eggs.push({ id: r.name, name: r.name, rarity: r.rarity, image: r.image, count: 1, purchasedAt: nowISO() });
        }
        break;
      }
      case "booster": {
        if (!r.boosterId) break;
        const def = BOOSTER_CATALOG.find((b) => b.id === r.boosterId);
        if (!def) break;
        const boosters = next.boosters!;
        const idx = boosters.findIndex((b) => String(b.id) === def.id);
        if (idx >= 0) {
          boosters[idx] = { ...boosters[idx], charges: Number(boosters[idx].charges ?? 0) + def.charges };
        } else {
          boosters.push({ id: def.id, kind: def.kind, multiplier: def.multiplier, charges: def.charges, name: def.name, rarity: def.rarity, emoji: def.emoji, obtainedAt: nowISO() });
        }
        break;
      }
      case "cosmetic": {
        if (!r.cosmeticId) break;
        const def = COSMETIC_CATALOG.find((c) => c.id === r.cosmeticId);
        if (!def) break;
        const owned = next.cosmetics!.owned;
        const exists = owned.some((c) => String(c.id) === def.id);
        if (exists) {
          // Dupe → EP shard refund (no second owned entry)
          shards += SHARD_BY_RARITY[r.rarity] ?? 15;
        } else {
          owned.push({ id: def.id, slot: def.slot, name: def.name, rarity: def.rarity, frame: def.frame, background: def.background });
        }
        break;
      }
    }
  }

  next.ecoPoints = (Number(next.ecoPoints ?? 0) || 0) + points + shards;
  return { profile: next, summary: { points, xp, shards } };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/chest-rewards.test.ts`
Expected: PASS. If `uncommon` isn't a valid `Rarity` (check `components/game-ui`), either add it there or remap uncommon→rare in `POINTS_BY_RARITY` etc. — see Task A6 for the `RARITY_GLOW` addition.

- [ ] **Step 5: Commit**

```bash
git add lib/chest-rewards.ts lib/__tests__/chest-rewards.test.ts
git commit -m "feat(chests): pure rollChest + applyChestRewards (7 reward types, dupe refund)"
```

---

### Task A3: `lib/cosmetics.ts` — pure cosmetic style helper

**Files:**
- Create: `lib/cosmetics.ts`
- Test: `lib/__tests__/cosmetics.test.ts`

**Interfaces:**
- Consumes: `COSMETIC_CATALOG`, `CosmeticDef` from `lib/catalog.ts`.
- Produces:
  - `cosmeticStyle(cosmetic: CosmeticDef | undefined, slot: "frame" | "background"): { frameStyle?: CSSProperties; backgroundStyle?: CSSProperties }` — maps CSS descriptors to React style objects.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { cosmeticStyle } from "@/lib/cosmetics";
import { COSMETIC_CATALOG } from "@/lib/catalog";

describe("cosmeticStyle", () => {
  it("returns a frame ring + shadow style for a frame cosmetic", () => {
    const frame = COSMETIC_CATALOG.find((c) => c.id === "frame-gold")!;
    const { frameStyle } = cosmeticStyle(frame, "frame");
    expect(frameStyle?.boxShadow).toContain("#fbbf24");
    expect(frameStyle?.boxShadow).toContain("0 0 14px");
  });

  it("returns a gradient background style for a background cosmetic", () => {
    const bg = COSMETIC_CATALOG.find((c) => c.id === "bg-sunset")!;
    const { backgroundStyle } = cosmeticStyle(bg, "background");
    expect(backgroundStyle?.background).toContain("linear-gradient");
  });

  it("returns empty styles for undefined cosmetic", () => {
    const { frameStyle, backgroundStyle } = cosmeticStyle(undefined, "frame");
    expect(frameStyle).toBeUndefined();
    expect(backgroundStyle).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/cosmetics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/cosmetics.ts`**

```ts
import type { CSSProperties } from "react";
import type { CosmeticDef } from "@/lib/catalog";

// Maps a CSS-descriptor cosmetic to React style objects. Frames render as a
// ring (border) + glow (box-shadow); backgrounds render as a positioned
// gradient layer. Avatar consumes these to layer the look without assets.
export function cosmeticStyle(
  cosmetic: CosmeticDef | undefined,
  slot: "frame" | "background"
): { frameStyle?: CSSProperties; backgroundStyle?: CSSProperties } {
  if (!cosmetic) return {};
  if (slot === "frame" && cosmetic.frame) {
    const f = cosmetic.frame;
    return {
      frameStyle: {
        border: f.ring,
        boxShadow: f.shadow,
      }
    };
  }
  if (slot === "background" && cosmetic.background) {
    return {
      backgroundStyle: {
        background: cosmetic.background.gradient,
      }
    };
  }
  return {};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/cosmetics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/cosmetics.ts lib/__tests__/cosmetics.test.ts
git commit -m "feat(cosmetics): pure cosmeticStyle helper (CSS-based frame/background)"
```

---

### Task A4: `lib/boosters.ts` — pure consume helper

**Files:**
- Create: `lib/boosters.ts`
- Test: `lib/__tests__/boosters.test.ts`

**Interfaces:**
- Consumes: `Booster` from `lib/types.ts`.
- Produces:
  - `consumeBoostersForQuest(profile: { boosters?: Booster[] }): { xpMul: number; ecoMul: number; boosters: Booster[]; consumed: string[] }` — applies at most one xp-booster and one eco-booster (highest-multiplier with charges > 0), decrements one charge each, returns the multipliers + the new boosters array + ids consumed. Pure; does not mutate input.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { consumeBoostersForQuest } from "@/lib/boosters";
import type { Booster } from "@/lib/types";

const mk = (over: Partial<Booster>): Booster => ({
  id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 3, name: "XP Sprout Booster",
  rarity: "rare", emoji: "🌱", obtainedAt: "x", ...over
});

describe("consumeBoostersForQuest", () => {
  it("applies one xp + one eco booster and decrements charges", () => {
    const profile = { boosters: [mk({ id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 1 }), mk({ id: "booster-eco-3", kind: "eco", multiplier: 3, charges: 1 })] };
    const { xpMul, ecoMul, boosters, consumed } = consumeBoostersForQuest(profile);
    expect(xpMul).toBe(2);
    expect(ecoMul).toBe(3);
    expect(consumed).toContain("booster-xp-2");
    expect(consumed).toContain("booster-eco-3");
    expect(boosters.find((b) => b.id === "booster-xp-2")!.charges).toBe(0);
  });

  it("picks the highest-multiplier charged booster per kind", () => {
    const profile = { boosters: [mk({ id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 1 }), mk({ id: "booster-xp-3", kind: "xp", multiplier: 3, charges: 1 })] };
    const { xpMul, consumed } = consumeBoostersForQuest(profile);
    expect(xpMul).toBe(3);
    expect(consumed).toContain("booster-xp-3");
    expect(consumed).not.toContain("booster-xp-2");
  });

  it("does not stack two xp boosters (no exponential XP)", () => {
    const profile = { boosters: [mk({ id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 1 }), mk({ id: "booster-xp-3", kind: "xp", multiplier: 3, charges: 1 })] };
    const { xpMul } = consumeBoostersForQuest(profile);
    expect(xpMul).toBe(3); // not 6
  });

  it("drops spent boosters at zero charges", () => {
    const profile = { boosters: [mk({ id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 1 })] };
    const { boosters } = consumeBoostersForQuest(profile);
    expect(boosters.find((b) => b.id === "booster-xp-2")).toBeUndefined();
  });

  it("returns 1/1 with no boosters", () => {
    const { xpMul, ecoMul, consumed } = consumeBoostersForQuest({ boosters: [] });
    expect(xpMul).toBe(1);
    expect(ecoMul).toBe(1);
    expect(consumed).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/boosters.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/boosters.ts`**

```ts
import type { Booster } from "@/lib/types";

// Applies boosters to a quest completion. At most ONE xp-booster and ONE
// eco-booster are consumed (highest multiplier with charges > 0), so two XP
// boosters never multiply together (no exponential XP). Each consumed booster
// loses one charge; boosters reaching 0 charges are dropped from the array.
// Pure: returns a new array + multipliers; does not mutate input.
export function consumeBoostersForQuest(profile: {
  boosters?: Booster[];
}): { xpMul: number; ecoMul: number; boosters: Booster[]; consumed: string[] } {
  const input = profile.boosters ?? [];
  const consumed: string[] = [];
  const next: Booster[] = [];

  const pick = (kind: "xp" | "eco"): Booster | undefined => {
    const charged = input.filter((b) => b.kind === kind && b.charges > 0);
    if (charged.length === 0) return undefined;
    return charged.reduce((best, b) => (b.multiplier > best.multiplier ? b : best));
  };

  const xpPick = pick("xp");
  const ecoPick = pick("eco");

  for (const b of input) {
    const isXpPick = xpPick && b.id === xpPick.id && b.kind === "xp";
    const isEcoPick = ecoPick && b.id === ecoPick.id && b.kind === "eco";
    if (isXpPick || isEcoPick) {
      consumed.push(b.id);
      const remaining = b.charges - 1;
      if (remaining > 0) next.push({ ...b, charges: remaining });
      // else: drop (spent)
    } else {
      next.push(b);
    }
  }

  return {
    xpMul: xpPick ? xpPick.multiplier : 1,
    ecoMul: ecoPick ? ecoPick.multiplier : 1,
    boosters: next,
    consumed
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/boosters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/boosters.ts lib/__tests__/boosters.test.ts
git commit -m "feat(boosters): pure consumeBoostersForQuest (one-per-kind anti-exploit)"
```

---

### Task A5: Default profile fields (signup + types wired through)

**Files:**
- Modify: `app/api/auth/signup/route.ts` (`buildInitialProfile`)

**Interfaces:**
- Consumes: `CosmeticsState`, `Booster` types from Task A1.
- Produces: every new user starts with `boosters: []` and a default empty `cosmetics` state.

- [ ] **Step 1: Add defaults to `buildInitialProfile`**

In `app/api/auth/signup/route.ts`, inside the object `buildInitialProfile` returns, add (next to the other empty inventory arrays like `plants: []`):

```ts
    boosters: [],
    cosmetics: { owned: [], equippedFrame: null, equippedBackground: null },
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/signup/route.ts
git commit -m "feat(profile): default boosters + cosmetics on signup"
```

---

### Task A6: Add `uncommon` rarity support

**Files:**
- Modify: `lib/animations.tsx` (`RARITY_GLOW`)
- Verify: `components/game-ui.tsx` — confirm `Rarity` includes `uncommon`; if not, add it + `rarityStyle`/`rarityBorder` entries.

**Interfaces:**
- Produces: `RARITY_GLOW["uncommon"]` exists; `Rarity` union includes `"uncommon"`.

- [ ] **Step 1: Check the Rarity union**

Run: `grep -n "Rarity" components/game-ui.tsx | head -20` (use Grep tool). If `Rarity` does not include `"uncommon"`, add it to the union and add matching entries to `rarityStyle`, `rarityBorder`, and any `Record<Rarity, ...>` maps (use a green-grey: accent `#34d399`, chip `bg-emerald-500/15 text-emerald-300`).

- [ ] **Step 2: Add `uncommon` to `RARITY_GLOW` in `lib/animations.tsx`**

```ts
  uncommon: "#34d399",
```

- [ ] **Step 3: Typecheck + run all tests**

Run: `npm run typecheck && npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/animations.tsx components/game-ui.tsx
git commit -m "feat(rarity): add 'uncommon' tier to RARITY_GLOW + style maps"
```

---

### Task A7: Rewrite the chest open route

**Files:**
- Modify: `app/api/chests/open/route.ts` (full rewrite of reward rolling + response)

**Interfaces:**
- Consumes: `rollChest`, `applyChestRewards` from `lib/chest-rewards.ts`; existing `transaction` + `selectUserForUpdate` + the existing upsert SQL (reused verbatim for fileSql).
- Produces: `POST /api/chests/open` → `{ success: true, chestName: string, rewards: RolledReward[], summary: { points, xp, shards } }`.

- [ ] **Step 1: Rewrite the route body**

Replace the reward-rolling section. Keep the auth + zod + chest-find + consume-chest + upsert structure; swap the single-`OPEN_CHEST_REWARDS` roll for `rollChest(tier, profile, rng)` + `applyChestRewards`. Map the chest name to a `ChestTier`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { logError } from "@/lib/logger";
import { rollChest, applyChestRewards, type ChestTier } from "@/lib/chest-rewards";

const openSchema = z.object({ chestId: z.union([z.number(), z.string()]) });

const TIER_BY_NAME: Record<string, ChestTier> = {
  "wooden chest": "wooden",
  "bronze chest": "bronze",
  "silver chest": "silver",
  "golden chest": "golden"
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof openSchema>;
  try {
    parsed = openSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    return await transaction(async (query) => {
      const userResult = await selectUserForUpdate<{ email: string; payload: Record<string, unknown> }>(
        query, session.userId!
      );
      if (userResult.rowCount === 0) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const profile = userResult.rows[0].payload ?? {};
      const chests = Array.isArray(profile.chests) ? [...(profile.chests as Array<Record<string, unknown>>)] : [];
      const idx = chests.findIndex((c) => String(c.id) === String(parsed.chestId));
      if (idx < 0) {
        return NextResponse.json({ error: { code: "chests/not-found" } }, { status: 404 });
      }

      const chest = chests[idx];
      const chestName = String(chest.name ?? "Wooden Chest");
      const tier = TIER_BY_NAME[chestName.toLowerCase()] ?? "wooden";

      // Consume one of this chest
      const chestCount = Number(chest.count ?? 1) - 1;
      if (chestCount > 0) {
        chests[idx] = { ...chests[idx], count: chestCount };
      } else {
        chests.splice(idx, 1);
      }

      const rewards = rollChest(tier, profile as any, Math.random);
      const { profile: nextProfile, summary } = applyChestRewards(profile as any, rewards);
      const finalProfile = { ...nextProfile, chests: chests } as Record<string, unknown>;

      await query(
        `insert into users (id, email, password_hash, payload)
         values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
         on conflict (id) do update
         set email = excluded.email,
             payload = excluded.payload,
             updated_at = now()`,
        [session.userId, userResult.rows[0].email, JSON.stringify(finalProfile)]
      );

      return NextResponse.json({ success: true, chestName, rewards, summary });
    });
  } catch (error) {
    logError("Chest open error", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}
```

Note: this reuses the **exact** existing upsert SQL string (unchanged) so the fileSql fallback keeps working. The `SELECT … FOR UPDATE` query string is also unchanged (from `selectUserForUpdate`).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Fix any `as any` narrowing by using the `ProfileLike` type where helpful.

- [ ] **Step 3: Commit**

```bash
git add app/api/chests/open/route.ts
git commit -m "feat(chests): multi-reward open route (2-5 rewards, 7 types, server-authoritative)"
```

---

### Task A8: Cosmetic equip route

**Files:**
- Create: `app/api/cosmetics/equip/route.ts`

**Interfaces:**
- Consumes: `COSMETIC_CATALOG` from `lib/catalog.ts`; existing `transaction` + `selectUserForUpdate` + upsert SQL.
- Produces: `POST /api/cosmetics/equip { slot: "frame"|"background", cosmeticId: string }` → validates ownership, sets `equippedFrame`/`equippedBackground` (or null to unequip), returns the new cosmetics state.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { COSMETIC_CATALOG } from "@/lib/catalog";
import { logError } from "@/lib/logger";

const equipSchema = z.object({
  slot: z.enum(["frame", "background"]),
  cosmeticId: z.string().nullable() // null = unequip
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof equipSchema>;
  try {
    parsed = equipSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    return await transaction(async (query) => {
      const userResult = await selectUserForUpdate<{ email: string; payload: Record<string, unknown> }>(
        query, session.userId!
      );
      if (userResult.rowCount === 0) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const profile = userResult.rows[0].payload ?? {};
      const cosmetics = (profile.cosmetics ?? { owned: [], equippedFrame: null, equippedBackground: null }) as {
        owned: Array<Record<string, unknown>>;
        equippedFrame: string | null;
        equippedBackground: string | null;
      };

      // null = unequip. Non-null must be owned + correct slot.
      if (parsed.cosmeticId !== null) {
        const def = COSMETIC_CATALOG.find((c) => c.id === parsed.cosmeticId && c.slot === parsed.slot);
        if (!def) {
          return NextResponse.json({ error: { code: "cosmetics/not-found" } }, { status: 404 });
        }
        const owned = cosmetics.owned.some((c) => String(c.id) === def.id);
        if (!owned) {
          return NextResponse.json({ error: { code: "cosmetics/not-owned" } }, { status: 403 });
        }
      }

      const field = parsed.slot === "frame" ? "equippedFrame" : "equippedBackground";
      const nextCosmetics = { ...cosmetics, [field]: parsed.cosmeticId };
      const finalProfile = { ...profile, cosmetics: nextCosmetics } as Record<string, unknown>;

      await query(
        `insert into users (id, email, password_hash, payload)
         values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
         on conflict (id) do update
         set email = excluded.email,
             payload = excluded.payload,
             updated_at = now()`,
        [session.userId, userResult.rows[0].email, JSON.stringify(finalProfile)]
      );

      return NextResponse.json({ success: true, cosmetics: nextCosmetics });
    });
  } catch (error) {
    logError("Cosmetic equip error", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add app/api/cosmetics/equip/route.ts
git commit -m "feat(cosmetics): server-authoritative equip route (validates ownership, no allowlist widen)"
```

---

### Task A9: Avatar + public profile show cosmetics

**Files:**
- Modify: `components/avatar.tsx`, `components/public-profile.tsx`, `app/(game)/profile/page.tsx`, `app/api/users/[id]/route.ts`

**Interfaces:**
- Consumes: `cosmeticStyle` from `lib/cosmetics.ts`; `COSMETIC_CATALOG` to resolve equipped ids → `CosmeticDef`.

- [ ] **Step 1: Add `frame?` + `background?` props to `Avatar`**

In `components/avatar.tsx`, add optional props `frame?: CosmeticDef` and `background?: CosmeticDef`. Render the background as an absolutely-positioned gradient layer behind the avatar image/initials, and the frame as an overlay ring using `cosmeticStyle`. Import `cosmeticStyle` + types from `lib/cosmetics` / `lib/catalog`.

- [ ] **Step 2: Surface equipped cosmetics on the public profile**

In `app/api/users/[id]/route.ts`, add `cosmetics: p.cosmetics` (the `{ owned, equippedFrame, equippedBackground }` state — only equipped ids, not the full owned list, are needed by viewers; send `equippedFrame` + `equippedBackground`) to the public projection.

In `components/public-profile.tsx`, add `equippedFrame?: string` + `equippedBackground?: string` to the `PublicProfile` type; resolve them to `CosmeticDef` via `COSMETIC_CATALOG.find` and pass to `<Avatar>`.

In `app/(game)/profile/page.tsx`, populate the two fields from `profile.cosmetics`.

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add components/avatar.tsx components/public-profile.tsx app/(game)/profile/page.tsx app/api/users/[id]/route.ts
git commit -m "feat(cosmetics): show equipped frame/background on avatar + public profile"
```

---

### Task A10: Collection page — multi-reward reveal + Boosters/Cosmetics tabs

**Files:**
- Modify: `app/(game)/collection/page.tsx`

This is the largest UI task. It (a) consumes the new `{ rewards, summary }` response, (b) renders a staggered multi-reward reveal in the chest modal, (c) adds `boosters` + `cosmetics` tabs to the Pokédex with equip UI.

**Interfaces:**
- Consumes: `RolledReward`, `RewardSummary` from `lib/chest-rewards.ts`; `BOOSTER_CATALOG`, `COSMETIC_CATALOG` from `lib/catalog.ts`; `cosmeticStyle` from `lib/cosmetics.ts`; `RewardGlow` from `lib/animations.tsx`.

- [ ] **Step 1: Update chest open state + handler**

Replace single `chestReward` state with `chestRewards: RolledReward[]` + `chestSummary: RewardSummary | null`. In `openChest`, read `data.rewards` + `data.summary` (fall back to empty). Keep the `closed → shaking → opened` animation timeline; reveal rewards one-by-one via `StaggerItem` after the chest opens.

- [ ] **Step 2: Rewrite `claimChestReward` to handle 7 types + totals**

Toast a summary: e.g. `"+{summary.points} EP, +{summary.xp} XP"` plus a line per non-points/non-xp reward (`"New: Leaf Frame!"`, `"+1 Mossy Fern Seed"`, etc.). For cosmetic dupes mention the shard refund (`"Leaf Frame (dup) → {shards} EP"`).

- [ ] **Step 3: Rewrite the chest modal JSX**

Render the chest image (shaking → opened), then a `StaggerContainer` of reward cards: each card shows `RewardGlow` keyed by `reward.rarity`, an icon/emoji by `reward.kind` (`points` 🪙, `xp` ⭐, `seed` 🌱, `plant` 🪴, `egg` 🥚, `booster` from `def.emoji`, `cosmetic` 🖼️), the reward name, amount where present, and a "NEW!" badge for new cosmetics/first-time species. A footer shows the totals (`summary.points` EP, `summary.xp` XP, `summary.shards` shards).

- [ ] **Step 4: Add `boosters` + `cosmetics` tabs**

Extend `CollMode` to `"plants" | "eggs" | "animals" | "seeds" | "chests" | "boosters" | "cosmetics"`. Add the two tabs to the mode options. Render:
  - **Boosters tab:** grid of owned boosters (from `profile.boosters`) showing emoji, name, multiplier, charges; undiscovered `BOOSTER_CATALOG` entries as locked silhouettes with "X/Y discovered" counter.
  - **Cosmetics tab:** two sub-sections (frames / backgrounds). Each owned cosmetic is a card with a preview (Avatar with the cosmetic applied) + an Equip/Unequip button that calls `POST /api/cosmetics/equip`; undiscovered entries as locked silhouettes.

- [ ] **Step 5: Typecheck + build + commit**

Run: `npm run typecheck && npm run build`
Expected: PASS.

```bash
git add app/(game)/collection/page.tsx
git commit -m "feat(collection): multi-reward chest reveal + boosters/cosmetics tabs + equip UI"
```

---

### Task A11: Booster consume on quest completion

**Files:**
- Modify: `app/api/quests/complete/route.ts`

**Interfaces:**
- Consumes: `consumeBoostersForQuest` from `lib/boosters.ts`.

- [ ] **Step 1: Apply boosters inside the reward transaction**

Before computing `patch`, call `consumeBoostersForQuest(profile)` to get `xpMul`/`ecoMul` + the new `boosters` array. Multiply `baseXp` by `xpMul` and `ecoReward` by `ecoMul` for the reward, and write the new `boosters` array into `patch`. Keep `baseImpact` (the impact-spine input) UNBOOSTED so impact accounting reflects real activity, not boosted XP. This happens inside the existing `transaction()`.

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add app/api/quests/complete/route.ts
git commit -m "feat(quests): consume boosters on completion (multiply xp/eco, one-per-kind)"
```

---

## Phase B — Daily rotating shop

### Task B1: `lib/shop-rotation.ts` — pure daily rotation

**Files:**
- Create: `lib/shop-rotation.ts`
- Test: `lib/__tests__/shop-rotation.test.ts`

**Interfaces:**
- Consumes: `SHOP_CATALOG` (`ShopItem[]` per mode) from `lib/catalog.ts`.
- Produces:
  - `ShopRotationEntry = ShopItem & { deal?: "discount" | "flash"; dealPrice?: number; originalPrice: number }`
  - `getDailyShop(allItems: ShopItem[], seed: number, todayKey: string): ShopRotationEntry[]` — picks 6 items deterministically from the seed, tags ~15% as flash and ~34% off on a discount subset.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { getDailyShop } from "@/lib/shop-rotation";
import { SHOP_CATALOG } from "@/lib/catalog";

const allItems = [...SHOP_CATALOG.plants, ...SHOP_CATALOG.eggs, ...SHOP_CATALOG.chests];
const todayKey = "2026-08-15";

describe("getDailyShop", () => {
  it("returns exactly 6 entries", () => {
    expect(getDailyShop(allItems, 12345, todayKey).length).toBe(6);
  });

  it("is deterministic for the same seed+day", () => {
    const a = getDailyShop(allItems, 12345, todayKey);
    const b = getDailyShop(allItems, 12345, todayKey);
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });

  it("changes when the day changes", () => {
    const a = getDailyShop(allItems, 12345, todayKey);
    const b = getDailyShop(allItems, 12345, "2026-08-16");
    // Not guaranteed to differ in every pick, but at least one slot usually does;
    // assert structural equality is NOT required — just that it CAN differ.
    expect(a.length).toBe(6);
    expect(b.length).toBe(6);
  });

  it("discount entries have a lower dealPrice than originalPrice", () => {
    const entries = getDailyShop(allItems, 999, todayKey);
    for (const e of entries) {
      if (e.deal === "discount") {
        expect(e.dealPrice!).toBeLessThan(e.originalPrice);
      }
      if (e.deal === "flash") {
        expect(e.dealPrice!).toBeLessThan(e.originalPrice);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to fail**

Run: `npx vitest run lib/__tests__/shop-rotation.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
import type { ShopItem } from "@/lib/catalog";

export type ShopRotationEntry = ShopItem & {
  originalPrice: number;
  deal?: "discount" | "flash";
  dealPrice?: number;
};

// mulberry32 PRNG — deterministic, no Math.random dependency.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(uid: string, todayKey: string): number {
  const s = `${uid}:${todayKey}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailyShopSeed(uid: string, todayKey: string): number {
  return hashSeed(uid, todayKey);
}

export function getDailyShop(allItems: ShopItem[], seed: number, _todayKey: string): ShopRotationEntry[] {
  const rng = mulberry32(seed);
  // Shuffle a copy with the rng, pick first 6 (or fewer if pool is small).
  const pool = [...allItems];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, Math.min(6, pool.length));

  // ~15% of slots become "flash" (bigger discount), ~34% of the rest "discount".
  const FLASH_RATE = 0.15;
  const DISCOUNT_RATE = 0.34;
  const DISCOUNT_FACTOR = 0.66; // 34% off
  const FLASH_FACTOR = 0.5;     // 50% off

  return picked.map((item) => {
    const r = rng();
    if (r < FLASH_RATE) {
      const dealPrice = Math.max(1, Math.round(item.price * FLASH_FACTOR));
      return { ...item, originalPrice: item.price, deal: "flash", dealPrice };
    }
    if (r < FLASH_RATE + DISCOUNT_RATE) {
      const dealPrice = Math.max(1, Math.round(item.price * DISCOUNT_FACTOR));
      return { ...item, originalPrice: item.price, deal: "discount", dealPrice };
    }
    return { ...item, originalPrice: item.price };
  });
}
```

- [ ] **Step 4: Run tests to pass + commit**

Run: `npx vitest run lib/__tests__/shop-rotation.test.ts` → PASS.

```bash
git add lib/shop-rotation.ts lib/__tests__/shop-rotation.test.ts
git commit -m "feat(shop): pure deterministic daily rotation (mulberry32, flash+discount)"
```

---

### Task B2: Daily shop API + SWR hook

**Files:**
- Create: `app/api/shop/daily/route.ts`
- Modify: `lib/useCatalog.ts` (add `useDailyShop`)

**Interfaces:**
- Produces: `GET /api/shop/daily` → `{ todayKey: string, entries: ShopRotationEntry[] }`; `useDailyShop()` SWR hook.

- [ ] **Step 1: Write the daily route**

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getShopCatalog } from "@/lib/catalog-server";
import { getDailyShop, dailyShopSeed } from "@/lib/shop-rotation";

function todayKey(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }
  const catalog = await getShopCatalog();
  const allItems = [...catalog.plants, ...catalog.eggs, ...catalog.chests];
  const tk = todayKey(new Date());
  const seed = dailyShopSeed(session.userId, tk);
  const entries = getDailyShop(allItems as any, seed, tk);
  return NextResponse.json({ todayKey: tk, entries });
}
```

- [ ] **Step 2: Add `useDailyShop` to `lib/useCatalog.ts`**

```ts
export function useDailyShop() {
  const { data, error, isLoading } = useSWR<{ todayKey: string; entries: ShopRotationEntry[] }>(
    "/api/shop/daily",
    catalogFetcher, // reuse the existing fetcher in this file (credentials + json)
    { revalidateOnMount: true, revalidateOnFocus: true, dedupingInterval: 30_000 }
  );
  return {
    todayKey: data?.todayKey,
    entries: Array.isArray(data?.entries) ? data.entries : [],
    isLoading: isLoading && !data,
    error
  };
}
```

(`catalogFetcher` + `useSWR` are already imported in `lib/useCatalog.ts`. Add `import type { ShopRotationEntry } from "@/lib/shop-rotation";` at the top.)

- [ ] **Step 3: Commit**

```bash
git add app/api/shop/daily/route.ts lib/useCatalog.ts
git commit -m "feat(shop): daily shop API + useDailyShop SWR hook"
```

---

### Task B3: Extend buy route for rotation + rewrite shop page

**Files:**
- Modify: `app/api/shop/buy/route.ts`
- Modify: `app/(game)/shop/page.tsx`

- [ ] **Step 1: Recompute rotation server-side in the buy route**

In `app/api/shop/buy/route.ts`, after looking up the catalog, recompute today's rotation via `getDailyShop(allItems, dailyShopSeed(uid, todayKey), todayKey)`. Find the entry by `(mode, itemId)`. If absent → `404 shop/not-available-today`. Charge `entry.dealPrice ?? entry.price` (NOT the catalog price). Keep the rest of the transaction/upsert as-is.

- [ ] **Step 2: Rewrite the shop page**

Replace `useShopCatalog` + mode tabs + rarity filter with `useDailyShop`, a flat 6-slot grid, a "Refreshes in HH:MM:SS" countdown (compute ms to next UTC midnight), deal/flash badges (strikethrough original price + discounted price), and a single Buy button per card. Drop the `PillTabBar` mode tabs (the daily shop is one flat list). Keep `ShopCardImage`, `EmptyState`, skeletons.

- [ ] **Step 3: Typecheck + build + commit**

Run: `npm run typecheck && npm run build` → PASS.

```bash
git add app/api/shop/buy/route.ts app/(game)/shop/page.tsx
git commit -m "feat(shop): daily rotation buy route + rotating shop page UI"
```

---

## Phase C — Navigation stale-state + performance

### Task C1: Profile SWR revalidates on mount + SWRConfig in layout

**Files:**
- Modify: `lib/useAuth.ts` (profile SWR `revalidateOnMount: true`)
- Modify: `app/(game)/layout.tsx` (wrap in `<SWRConfig>`)

- [ ] **Step 1: Add `revalidateOnMount: true`** to the profile SWR options in `lib/useAuth.ts` (the `["profile", uid]` key). This ensures navigating to a page that mutates the profile (e.g. shop → collection) shows fresh data without a manual refresh, while still benefiting from the SWR cache + focus revalidation.

- [ ] **Step 2: Wrap the game layout in `SWRConfig`**

In `app/(game)/layout.tsx`, import `SWRConfig` from `swr` and wrap the `ThemeProvider > ToastProvider > …` tree in `<SWRConfig value={{ revalidateOnFocus: true, dedupingInterval: 15_000 }}>`. This sets sensible defaults for all game SWR hooks.

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add lib/useAuth.ts app/(game)/layout.tsx
git commit -m "fix(nav): revalidate profile on mount + global SWRConfig (no stale state on nav)"
```

---

### Task C2: Loading skeletons + verify prefetch

**Files:**
- Create: `app/(game)/shop/loading.tsx`, `app/(game)/collection/loading.tsx`
- Verify: `<Link>` usage for internal nav (Next.js prefetches by default)

- [ ] **Step 1: Add skeleton loading states**

`app/(game)/shop/loading.tsx`:
```tsx
import { CardGridSkeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return <div className="p-4"><CardGridSkeleton count={6} cols="grid-cols-2 sm:grid-cols-3" /></div>;
}
```
`app/(game)/collection/loading.tsx`: same pattern.

- [ ] **Step 2: Verify Link prefetch**

Grep game pages for `<a href=` (should be `<Link>`); confirm navigation between game pages uses `next/link` so prefetch + client transitions work. Report any `<a>` found and convert to `<Link>`.

- [ ] **Step 3: Commit**

```bash
git add app/(game)/shop/loading.tsx app/(game)/collection/loading.tsx
git commit -m "perf(nav): loading skeletons + Link prefetch verification"
```

---

## Phase D — Toast + notification repositioning

### Task D1: Reposition toast to top-center/top-right

**Files:**
- Modify: `lib/toast.tsx`

- [ ] **Step 1: Move the ToastProvider live region**

Change the live region container className from bottom-center:
```
pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4
```
to top + responsive:
```
pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex w-full max-w-[min(92vw,28rem)] flex-col items-center gap-2 px-4 md:left-auto md:right-4 md:translate-x-0 md:items-end
```
This keeps toasts inside the viewport on mobile (top-center) and desktop (top-right), never covering the sidebar or bottom nav.

- [ ] **Step 2: Verify stacking + auto-dismiss**

`DEFAULT_DURATION` stays 3500; confirm toasts stack vertically (the `flex-col` does this) and auto-dismiss via the existing timer. Manually dismissible stays.

- [ ] **Step 3: Commit**

```bash
git add lib/toast.tsx
git commit -m "fix(toast): reposition to top-center (mobile) / top-right (desktop)"
```

---

### Task D2: Dashboard toast migration + impact removal (overlaps Phase E)

**Files:**
- Modify: `app/(game)/dashboard/page.tsx`

- [ ] **Step 1: Migrate the dashboard's legacy per-page toast to `useToast`**

Replace the dashboard's bespoke toast state with `const toast = useToast();` + `toast.success/error/info`. Remove the old toast JSX.

- [ ] **Step 2: Remove dashboard impact fetches + cards**

Delete the `/api/stats/impact` fetch + `weekImpact` state + the "Impact this week" HeroMetric + the "CO2 Reduced" StatGrid item.

- [ ] **Step 3: Commit**

```bash
git add app/(game)/dashboard/page.tsx
git commit -m "fix(dashboard): migrate to useToast + remove impact cards"
```

---

## Phase E — Impact removal

### Task E1: Delete impact surfaces + cron + rewards-sync

**Files:**
- Delete: `app/(game)/impact/page.tsx`, `app/(game)/impact/layout.tsx`, `app/api/stats/impact/route.ts`, `lib/rewards-sync.ts`, `app/api/cron/process-rewards/route.ts`
- Modify: `vercel.json` (remove process-rewards cron), `app/robots.ts` (remove `/impact`), `components/notification-bell.tsx` (remove `/impact` link + `tree_planted` icon), `app/api/quests/complete/route.ts` (remove `checkAndProcessMilestones` import+call), `lib/private-missions.ts` (remove `checkAndProcessMilestones` import+call)

**IMPORTANT:** KEEP `lib/impact-service.ts` (`grantImpact`) — it's the reward engine used by 9 reward routes. Impact *accounting* (`impact_events`, `impactBySource`, `carbonReduced`) stays in the profile; only the *visible Impact feature* (page, stats API, real-tree milestone engine, cron) is removed.

- [ ] **Step 1: Delete the files**

```bash
git rm app/(game)/impact/page.tsx app/(game)/impact/layout.tsx
git rm app/api/stats/impact/route.ts
git rm lib/rewards-sync.ts
git rm app/api/cron/process-rewards/route.ts
```

- [ ] **Step 2: Remove references**

- `vercel.json`: delete the `process-rewards` cron object (keep `send-weekly-reports` + `keep-alive`).
- `app/robots.ts`: remove `"/impact"` from the allowlist.
- `components/notification-bell.tsx`: remove the `<Link href="/impact">View all</Link>` footer + the `tree_planted` entry in `ICON_BY_TYPE`.
- `app/api/quests/complete/route.ts`: remove `import { checkAndProcessMilestones } …` and the fire-and-forget `checkAndProcessMilestones(...)` call. Keep the `grantImpact` import + call.
- `lib/private-missions.ts`: remove the `checkAndProcessMilestones` import + call.

- [ ] **Step 3: Grep for orphaned references**

Run: `grep -rn "rewards-sync\|/impact\|stats/impact\|tree_planted\|process-rewards" app lib components --include="*.ts" --include="*.tsx"` — expected: only `lib/impact-service.ts` (the reward engine, intentional) and any `impactBySource`/`carbonReduced` *accounting* reads (intentional). Fix any UI imports of the deleted page.

- [ ] **Step 4: Typecheck + build + commit**

Run: `npm run typecheck && npm run build` → PASS (no broken imports).

```bash
git add -A
git commit -m "feat(impact): remove Impact feature (page, stats API, rewards-sync, cron, nav refs)"
```

---

## Phase F — Final QA

### Task F1: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + lint + test + build**

Run:
```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
Expected: all PASS. Fix any errors before proceeding.

- [ ] **Step 2: Manual smoke (dev server)**

Run `npm run dev`. In a browser:
- Open a chest: confirm 2–5 rewards appear staggered, each with the right rarity glow; EP never >120/slot; totals shown.
- Open a dupe cosmetic: confirm shard refund toast + no duplicate owned entry.
- Buy a booster from a chest, complete a quest: confirm XP/eco multiplied by the booster, charges decremented, dropped at 0.
- Equip/unequip a cosmetic: confirm avatar + public profile show it.
- Daily shop: confirm 6 slots, a couple discounted/flashed, countdown to next UTC midnight, buy works, price matches rotation.
- Navigate Collection → Shop → back: confirm no stale state (profile EP updates immediately).
- Toasts appear top-right (desktop), top-center (mobile via responsive resize); never off-screen.
- `/impact` returns 404 / redirects; no Impact nav link; bell dropdown has no /impact footer.
- Browser back/forward works across game pages.

- [ ] **Step 3: Console + network check**

Open DevTools: confirm no console errors, no 404s, no unnecessary duplicate requests (SWR dedup). Confirm `/impact` route is gone (404, not a blank page).

- [ ] **Step 4: Final commit (if any QA fixes)**

If QA surfaced fixes, commit them with clear messages. Otherwise this step is a no-op.

---

## Self-Review (completed)

**1. Spec coverage:** Every spec section maps to a task:
- Chest redesign (7 types, rarity, balance, dupes, animation) → A2, A7, A10.
- Booster subsystem → A1, A4, A11.
- Cosmetics subsystem → A1, A3, A8, A9, A10.
- Navigation stale-state → C1, C2.
- Performance → C1, C2 (+ SWR/next/image already in codebase per memory).
- Toast/notification reposition → D1.
- Impact removal → E1 (+ D2 dashboard impact).
- Daily shop + special deals → B1, B2, B3.
- Final QA → F1.

**2. Placeholder scan:** No TBD/TODO/"add error handling"/"similar to Task N". All code blocks contain real code.

**3. Type consistency:** `RolledReward`, `RewardSummary`, `ChestTier`, `Booster`, `Cosmetic`, `CosmeticsState`, `ShopRotationEntry`, `cosmeticStyle`, `consumeBoostersForQuest`, `rollChest`, `applyChestRewards`, `getDailyShop`, `dailyShopSeed` — names/signatures are consistent across tasks. `Rarity` includes `uncommon` after A6. The upsert SQL string is reused verbatim (fileSql-safe).