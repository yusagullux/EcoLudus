import { describe, expect, it } from "vitest";
import { rollChest, applyChestRewards, type ChestTier, type RolledReward, type ProfileLike } from "@/lib/chest-rewards";

const baseProfile = (): ProfileLike => ({
  ecoPoints: 100,
  xp: 500,
  plants: [],
  eggs: [],
  seeds: [],
  animals: [],
  boosters: [],
  cosmetics: { owned: [], equippedFrame: null, equippedBackground: null }
});

// Deterministic rng cycling through a fixed sequence.
const seqRng = (vals: number[]) => {
  let i = 0;
  return () => {
    const v = vals[i % vals.length];
    i++;
    return v;
  };
};

describe("rollChest", () => {
  it("rolls between 2 and 5 rewards for every tier", () => {
    for (const tier of ["wooden", "bronze", "silver", "golden"] as ChestTier[]) {
      for (let n = 0; n < 25; n++) {
        const rewards = rollChest(tier, baseProfile(), Math.random);
        expect(rewards.length).toBeGreaterThanOrEqual(2);
        expect(rewards.length).toBeLessThanOrEqual(5);
      }
    }
  });

  it("caps EcoPoints at ~120 per points slot", () => {
    // Force the points bucket on every slot.
    const rng = seqRng([0.01, 0.99, 0.99, 0.99, 0.99]);
    const rewards = rollChest("golden", baseProfile(), rng);
    const pointsRewards = rewards.filter((r) => r.kind === "points");
    expect(pointsRewards.length).toBeGreaterThan(0);
    for (const p of pointsRewards) {
      expect(p.amount ?? 0).toBeLessThanOrEqual(120);
    }
  });

  it("never rolls more than one cosmetic per chest", () => {
    for (let n = 0; n < 60; n++) {
      const rewards = rollChest("golden", baseProfile(), Math.random);
      const cosmetics = rewards.filter((r) => r.kind === "cosmetic");
      expect(cosmetics.length).toBeLessThanOrEqual(1);
    }
  });

  it("is never cosmetic-only", () => {
    for (let n = 0; n < 50; n++) {
      const rewards = rollChest("golden", baseProfile(), Math.random);
      expect(rewards.some((r) => r.kind !== "cosmetic")).toBe(true);
    }
  });
});

describe("applyChestRewards", () => {
  it("sums points and xp and adds inventory items", () => {
    const rewards: RolledReward[] = [
      { kind: "points", name: "EcoPoints", amount: 80, rarity: "common" },
      { kind: "xp", name: "XP", amount: 50, rarity: "common" },
      { kind: "seed", name: "Mossy Fern Seed", rarity: "common", seedName: "Mossy Fern Seed" }
    ];
    const { profile: next, summary } = applyChestRewards(baseProfile() as any, rewards);
    expect(next.ecoPoints).toBe(180);
    expect(next.xp).toBe(550);
    expect(summary.points).toBe(80);
    expect(summary.xp).toBe(50);
    expect((next.seeds ?? []).length).toBe(1);
  });

  it("stacks a second identical seed by count", () => {
    const p = baseProfile();
    p.seeds = [{ id: "Mossy Fern Seed", name: "Mossy Fern Seed", rarity: "common", image: "/x", count: 1, obtainedAt: "t" }];
    const rewards: RolledReward[] = [
      { kind: "seed", name: "Mossy Fern Seed", rarity: "common", seedName: "Mossy Fern Seed" }
    ];
    const { profile: next } = applyChestRewards(p as any, rewards);
    expect((next.seeds ?? []).length).toBe(1);
    expect(Number((next.seeds ?? [])[0].count)).toBe(2);
  });

  it("refunds a duplicate cosmetic as EP shards (no second owned entry)", () => {
    const p = baseProfile();
    p.cosmetics = {
      owned: [{ id: "frame-leaf", slot: "frame", name: "Leaf Frame", rarity: "uncommon", frame: { ring: "2px solid #4ade80" } }],
      equippedFrame: null,
      equippedBackground: null
    };
    const rewards: RolledReward[] = [
      { kind: "cosmetic", name: "Leaf Frame", rarity: "uncommon", cosmeticId: "frame-leaf", isNew: true }
    ];
    const { profile: next, summary } = applyChestRewards(p as any, rewards);
    expect(next.cosmetics!.owned.filter((c) => String(c.id) === "frame-leaf").length).toBe(1);
    expect(summary.shards).toBe(25); // uncommon shard refund
    expect(next.ecoPoints).toBe(100 + 25);
  });

  it("adds a new cosmetic to owned", () => {
    const p = baseProfile();
    const rewards: RolledReward[] = [
      { kind: "cosmetic", name: "Gold Frame", rarity: "epic", cosmeticId: "frame-gold", isNew: true }
    ];
    const { profile: next } = applyChestRewards(p as any, rewards);
    expect(next.cosmetics!.owned.some((c) => String(c.id) === "frame-gold")).toBe(true);
  });

  it("stacks a booster it already owns by increasing charges, not a duplicate entry", () => {
    const p = baseProfile();
    p.boosters = [
      { id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 1, name: "XP Sprout Booster", rarity: "rare", emoji: "🌱", obtainedAt: "x" }
    ];
    const rewards: RolledReward[] = [
      { kind: "booster", name: "XP Sprout Booster", rarity: "rare", boosterId: "booster-xp-2" }
    ];
    const { profile: next } = applyChestRewards(p as any, rewards);
    expect(next.boosters!.filter((b) => String(b.id) === "booster-xp-2").length).toBe(1);
    expect(Number(next.boosters!.find((b) => String(b.id) === "booster-xp-2")!.charges)).toBe(4);
  });
});