// Pure chest-rolling + reward-application logic. No React, no DB.
//
// The route (/api/chests/open) calls rollChest() with a seeded RNG, then
// applyChestRewards() to build the next profile state inside a locked
// transaction. Keeping this pure makes the rolling + dupe-refund + balance
// rules unit-testable without a database.
//
// Design goals (see spec §1):
//  - One chest yields 2–5 different rewards across 7 kinds (points, xp, egg,
//    seed, plant, booster, cosmetic).
//  - Rarity tiers (common/uncommon/rare/epic/legendary) scale reward size;
//    higher chest tiers shift rarity weights up and add a cosmetic chance.
//  - EcoPoints per slot is capped (~120 max) — roughly a 90% cut from the old
//    1000–2500 Golden chest, so chests no longer break quest-based progression.
//  - Cosmetic dupes refund as EP shards (no second owned entry). Boosters stack
//    by charges (one owned entry per kind). Seeds/plants/eggs stack by count.
//  - At most one cosmetic per chest; a chest is never cosmetic-only.

import {
  SHOP_CATALOG,
  SEED_CATALOG,
  BOOSTER_CATALOG,
  COSMETIC_CATALOG,
  PET_CATALOG
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
  emoji?: string;
  description?: string;
  seedName?: string;
  boosterId?: string;
  cosmeticId?: string;
  /** True when this reward is a brand-new acquisition (cosmetic / first-of-species). */
  isNew?: boolean;
};

// Loose profile shape — the real UserProfile works here too. We accept a
// superset so the route can pass the jsonb payload without a cast fight.
export type ProfileLike = {
  ecoPoints?: number;
  xp?: number;
  level?: number;
  plants?: Array<Record<string, unknown>>;
  eggs?: Array<Record<string, unknown>>;
  seeds?: Array<Record<string, unknown>>;
  animals?: Array<Record<string, unknown>>;
  boosters?: Array<Record<string, unknown>>;
  cosmetics?: {
    owned: Array<Record<string, unknown>>;
    equippedFrame: string | null;
    equippedBackground: string | null;
  };
};

export type RewardSummary = { points: number; xp: number; shards: number };

// Per-tier reward-count range + rarity weights + cosmetic chance. Higher
// tiers → more rewards, better rarity odds, a small cosmetic chance.
const TIER_CONFIG: Record<
  ChestTier,
  { count: [number, number]; rarityWeights: Record<Rarity, number>; cosmeticChance: number }
> = {
  wooden: { count: [2, 3], rarityWeights: { common: 60, uncommon: 25, rare: 12, epic: 3, legendary: 0 }, cosmeticChance: 0.02 },
  bronze: { count: [2, 4], rarityWeights: { common: 45, uncommon: 30, rare: 18, epic: 6, legendary: 1 }, cosmeticChance: 0.05 },
  silver: { count: [3, 4], rarityWeights: { common: 30, uncommon: 28, rare: 25, epic: 13, legendary: 4 }, cosmeticChance: 0.08 },
  golden: { count: [3, 5], rarityWeights: { common: 18, uncommon: 24, rare: 28, epic: 20, legendary: 10 }, cosmeticChance: 0.12 }
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

// EP shard refund for a duplicate cosmetic, by rarity.
const SHARD_BY_RARITY: Record<Rarity, number> = {
  common: 15,
  uncommon: 25,
  rare: 50,
  epic: 100,
  legendary: 200
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

// Reward KIND weights per tier. Cosmetic is gated separately by cosmeticChance,
// so its weight here only matters once the gate has passed.
const KIND_WEIGHTS: Record<ChestTier, Array<[RewardKind, number]>> = {
  wooden: [["points", 40], ["xp", 25], ["seed", 25], ["plant", 8], ["egg", 2], ["booster", 0], ["cosmetic", 0]],
  bronze: [["points", 32], ["xp", 22], ["seed", 20], ["plant", 12], ["egg", 10], ["booster", 3], ["cosmetic", 1]],
  silver: [["points", 26], ["xp", 20], ["seed", 16], ["plant", 14], ["egg", 14], ["booster", 7], ["cosmetic", 3]],
  golden: [["points", 22], ["xp", 18], ["seed", 12], ["plant", 14], ["egg", 16], ["booster", 10], ["cosmetic", 8]]
};

function pickKind(tier: ChestTier, rng: () => number, allowCosmetic: boolean): RewardKind {
  const weights = KIND_WEIGHTS[tier].filter(
    ([k, w]) => w > 0 && (k !== "cosmetic" || allowCosmetic)
  );
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

function poolByRarity<T extends { rarity: Rarity }>(items: T[], r: Rarity): T[] {
  return items.filter((x) => x.rarity === r);
}

function rollOne(
  tier: ChestTier,
  profile: ProfileLike,
  rng: () => number,
  allowCosmetic: boolean
): RolledReward {
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
      const pool = poolByRarity(SEED_CATALOG, rarity);
      const seed = pool[Math.floor(rng() * pool.length)] ?? SEED_CATALOG[0];
      return { kind: "seed", name: seed.name, rarity: seed.rarity, image: seed.image, seedName: seed.name };
    }
    case "plant": {
      const pool = poolByRarity(SHOP_CATALOG.plants, rarity);
      const plant = pool[Math.floor(rng() * pool.length)] ?? SHOP_CATALOG.plants[0];
      return { kind: "plant", name: plant.name, rarity: plant.rarity, image: plant.image };
    }
    case "egg": {
      const pool = poolByRarity(SHOP_CATALOG.eggs, rarity);
      const egg = pool[Math.floor(rng() * pool.length)] ?? SHOP_CATALOG.eggs[0];
      return { kind: "egg", name: egg.name, rarity: egg.rarity, image: egg.image };
    }
    case "booster": {
      const pool = poolByRarity(BOOSTER_CATALOG, rarity);
      const b = pool[Math.floor(rng() * pool.length)] ?? BOOSTER_CATALOG[0];
      return { kind: "booster", name: b.name, rarity: b.rarity, boosterId: b.id, emoji: b.emoji, description: `${b.multiplier}x ${b.kind.toUpperCase()} (${b.charges} charges)` };
    }
    case "cosmetic": {
      const pool = poolByRarity(COSMETIC_CATALOG, rarity);
      const c = pool[Math.floor(rng() * pool.length)] ?? COSMETIC_CATALOG[0];
      const isNew = !ownedCosmeticIds(profile).has(c.id);
      return { kind: "cosmetic", name: c.name, rarity: c.rarity, cosmeticId: c.id, emoji: c.slot === "frame" ? "🖼️" : "🎨", isNew };
    }
  }
}

export function rollChest(tier: ChestTier, profile: ProfileLike, rng: () => number): RolledReward[] {
  const cfg = TIER_CONFIG[tier];
  const count = randInt(rng, cfg.count[0], cfg.count[1]);
  const rewards: RolledReward[] = [];
  let cosmeticRolled = false;
  for (let i = 0; i < count; i++) {
    // Cosmetic gate: only roll a cosmetic if the per-slot chance hits AND we
    // haven't already rolled one this chest.
    const allowCosmetic = !cosmeticRolled && rng() < cfg.cosmeticChance;
    const reward = rollOne(tier, profile, rng, allowCosmetic);
    if (reward.kind === "cosmetic") cosmeticRolled = true;
    rewards.push(reward);
  }
  // Guarantee at least one non-cosmetic reward (never a cosmetic-only chest).
  if (rewards.length === 0 || rewards.every((r) => r.kind === "cosmetic")) {
    const [lo, hi] = POINTS_BY_RARITY.common;
    rewards.push({ kind: "points", name: "EcoPoints", amount: randInt(rng, lo, hi), rarity: "common" });
  }
  return rewards;
}

const nowISO = () => new Date().toISOString();

function stackInventory(
  arr: Array<Record<string, unknown>>,
  matchId: string,
  entry: Record<string, unknown>,
  stampKey: string
): Array<Record<string, unknown>> {
  const idx = arr.findIndex((e) => {
    const eid = e.id ?? e.name;
    return String(eid) === matchId || String(e.name) === matchId;
  });
  if (idx >= 0) {
    const next = [...arr];
    next[idx] = { ...next[idx], count: Number(next[idx].count ?? 1) + 1, [stampKey]: nowISO() };
    return next;
  }
  return [...arr, { ...entry, count: 1, [stampKey]: nowISO() }];
}

export function applyChestRewards(
  profile: ProfileLike,
  rewards: RolledReward[]
): { profile: ProfileLike; summary: RewardSummary } {
  const next: ProfileLike = {
    ...profile,
    plants: profile.plants ? [...profile.plants] : [],
    eggs: profile.eggs ? [...profile.eggs] : [],
    seeds: profile.seeds ? [...profile.seeds] : [],
    animals: profile.animals ? [...profile.animals] : [],
    boosters: profile.boosters ? [...profile.boosters] : [],
    cosmetics: profile.cosmetics
      ? { ...profile.cosmetics, owned: [...profile.cosmetics.owned] }
      : { owned: [], equippedFrame: null, equippedBackground: null }
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
        if (!r.seedName) break;
        next.seeds = stackInventory(
          next.seeds ?? [],
          r.seedName,
          { id: r.seedName, name: r.seedName, rarity: r.rarity, image: r.image },
          "obtainedAt"
        );
        break;
      }
      case "plant": {
        next.plants = stackInventory(
          next.plants ?? [],
          r.name,
          { id: r.name, name: r.name, rarity: r.rarity, image: r.image },
          "purchasedAt"
        );
        break;
      }
      case "egg": {
        next.eggs = stackInventory(
          next.eggs ?? [],
          r.name,
          { id: r.name, name: r.name, rarity: r.rarity, image: r.image },
          "purchasedAt"
        );
        break;
      }
      case "booster": {
        if (!r.boosterId) break;
        const def = BOOSTER_CATALOG.find((b) => b.id === r.boosterId);
        if (!def) break;
        const boosters = next.boosters ?? [];
        const idx = boosters.findIndex((b) => String(b.id) === def.id);
        if (idx >= 0) {
          const updated = [...boosters];
          updated[idx] = { ...updated[idx], charges: Number(updated[idx].charges ?? 0) + def.charges };
          next.boosters = updated;
        } else {
          next.boosters = [
            ...boosters,
            {
              id: def.id,
              kind: def.kind,
              multiplier: def.multiplier,
              charges: def.charges,
              name: def.name,
              rarity: def.rarity,
              emoji: def.emoji,
              obtainedAt: nowISO()
            }
          ];
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
          // Dupe → EP shard refund (no second owned entry).
          shards += SHARD_BY_RARITY[r.rarity] ?? 15;
        } else {
          next.cosmetics = {
            ...next.cosmetics!,
            owned: [
              ...owned,
              {
                id: def.id,
                slot: def.slot,
                name: def.name,
                rarity: def.rarity,
                frame: def.frame,
                background: def.background
              }
            ]
          };
        }
        break;
      }
    }
  }

  next.ecoPoints = (Number(next.ecoPoints ?? 0) || 0) + points + shards;
  return { profile: next, summary: { points, xp, shards } };
}

// PET_CATALOG is re-exported here so the route can resolve pet images for egg
// rewards if needed without a second import site. (Kept for future use.)
export { PET_CATALOG };