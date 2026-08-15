import { describe, expect, it } from "vitest";
import { consumeBoostersForQuest } from "@/lib/boosters";
import type { Booster } from "@/lib/types";

const mk = (over: Partial<Booster>): Booster => ({
  id: "booster-xp-2",
  kind: "xp",
  multiplier: 2,
  charges: 3,
  name: "XP Sprout Booster",
  rarity: "rare",
  emoji: "🌱",
  obtainedAt: "x",
  ...over
});

describe("consumeBoostersForQuest", () => {
  it("applies one xp + one eco booster and decrements charges", () => {
    const profile = {
      boosters: [
        mk({ id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 1 }),
        mk({ id: "booster-eco-3", kind: "eco", multiplier: 3, charges: 1, name: "Eco Bloom Booster", emoji: "✨" })
      ]
    };
    const { xpMul, ecoMul, boosters, consumed } = consumeBoostersForQuest(profile);
    expect(xpMul).toBe(2);
    expect(ecoMul).toBe(3);
    expect(consumed).toContain("booster-xp-2");
    expect(consumed).toContain("booster-eco-3");
    // Both reached 0 charges → dropped
    expect(boosters.find((b) => b.id === "booster-xp-2")).toBeUndefined();
    expect(boosters.find((b) => b.id === "booster-eco-3")).toBeUndefined();
  });

  it("picks the highest-multiplier charged booster per kind", () => {
    const profile = {
      boosters: [
        mk({ id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 1 }),
        mk({ id: "booster-xp-3", kind: "xp", multiplier: 3, charges: 1, name: "XP Bloom Booster" })
      ]
    };
    const { xpMul, consumed } = consumeBoostersForQuest(profile);
    expect(xpMul).toBe(3);
    expect(consumed).toContain("booster-xp-3");
    expect(consumed).not.toContain("booster-xp-2");
  });

  it("does not stack two xp boosters (no exponential XP)", () => {
    const profile = {
      boosters: [
        mk({ id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 1 }),
        mk({ id: "booster-xp-3", kind: "xp", multiplier: 3, charges: 1, name: "XP Bloom Booster" })
      ]
    };
    const { xpMul } = consumeBoostersForQuest(profile);
    expect(xpMul).toBe(3); // not 6
  });

  it("keeps the un-picked booster (with its charges intact)", () => {
    const profile = {
      boosters: [
        mk({ id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 1 }),
        mk({ id: "booster-xp-3", kind: "xp", multiplier: 3, charges: 2, name: "XP Bloom Booster" })
      ]
    };
    const { boosters } = consumeBoostersForQuest(profile);
    const kept = boosters.find((b) => b.id === "booster-xp-2");
    expect(kept).toBeDefined();
    expect(kept!.charges).toBe(1); // untouched
  });

  it("returns 1/1 with no boosters", () => {
    const { xpMul, ecoMul, consumed } = consumeBoostersForQuest({ boosters: [] });
    expect(xpMul).toBe(1);
    expect(ecoMul).toBe(1);
    expect(consumed).toEqual([]);
  });

  it("does not consume a 0-charge booster", () => {
    const profile = { boosters: [mk({ id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 0 })] };
    const { xpMul, consumed } = consumeBoostersForQuest(profile);
    expect(xpMul).toBe(1);
    expect(consumed).toEqual([]);
  });
});