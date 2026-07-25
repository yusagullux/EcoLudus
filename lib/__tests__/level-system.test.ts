import { describe, it, expect } from "vitest";
import {
  requiredXP,
  calculateLevel,
  getLevelProgress,
  getLevelUpRewards,
  getXPProgress,
  calculateEcoPoints
} from "../level-system";

describe("requiredXP", () => {
  it("uses the 100*L + 25*L² curve and floors to level 1", () => {
    expect(requiredXP(1)).toBe(125);
    expect(requiredXP(2)).toBe(300);
    expect(requiredXP(3)).toBe(525);
    expect(requiredXP(4)).toBe(800);
  });

  it("clamps non-positive levels to 1", () => {
    expect(requiredXP(0)).toBe(requiredXP(1));
    expect(requiredXP(-5)).toBe(requiredXP(1));
  });
});

describe("calculateLevel", () => {
  it("returns level 1 for XP below the first threshold", () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(124)).toBe(1);
  });

  it("crosses level boundaries exactly at requiredXP", () => {
    expect(calculateLevel(125)).toBe(2);
    expect(calculateLevel(299)).toBe(2);
    expect(calculateLevel(300)).toBe(3);
    expect(calculateLevel(525)).toBe(4);
  });

  it("guards against NaN / non-finite input", () => {
    expect(calculateLevel(Number.NaN)).toBe(1);
    expect(calculateLevel(Number.POSITIVE_INFINITY)).toBe(1);
    expect(calculateLevel(-100)).toBe(1);
  });
});

describe("getLevelProgress", () => {
  it("reports xp into / xp to next for a mid-level value", () => {
    const progress = getLevelProgress(200);
    // level 2 spans requiredXP(1)=125 .. requiredXP(2)=300
    expect(progress.level).toBe(2);
    expect(progress.currentLevelXp).toBe(125);
    expect(progress.nextLevelXp).toBe(300);
    expect(progress.xpIntoLevel).toBe(75);
    expect(progress.xpToNextLevel).toBe(100);
  });
});

describe("getLevelUpRewards", () => {
  it("grants a garden item at multiples of 5 and a team boost at multiples of 10", () => {
    expect(getLevelUpRewards(4, 6)).toEqual([
      { level: 5, rewardType: "garden_item", label: "Level 5 garden item" },
      { level: 6, rewardType: "level_up", label: "Level 6 reached" }
    ]);
    expect(getLevelUpRewards(9, 10)).toEqual([
      { level: 10, rewardType: "team_boost", label: "Level 10 team boost" }
    ]);
  });

  it("returns nothing when nextLevel is not above previousLevel", () => {
    expect(getLevelUpRewards(5, 5)).toEqual([]);
    expect(getLevelUpRewards(5, 3)).toEqual([]);
  });
});

describe("getXPProgress", () => {
  it("computes percentage within the current level", () => {
    const p = getXPProgress(200, 2);
    expect(p.current).toBe(75);
    expect(p.required).toBe(175);
    expect(p.percentage).toBeCloseTo(42.857, 2);
  });

  it("caps percentage at 100 when XP reaches the next level threshold", () => {
    // 525 XP = requiredXP(3), the top of level 3 (start of level 4). With an
    // explicit currentLevel=3 the within-level percentage is exactly 100.
    expect(getXPProgress(525, 3).percentage).toBe(100);
  });
});

describe("calculateEcoPoints", () => {
  it("scales the divisor by level tier and adds a badge bonus", () => {
    expect(calculateEcoPoints(100, 2, 0)).toBe(10); // level<=3 → /10
    expect(calculateEcoPoints(100, 5, 0)).toBe(6); // level<=5 → /15
    expect(calculateEcoPoints(100, 7, 0)).toBe(4); // level<=7 → /25
    expect(calculateEcoPoints(100, 9, 0)).toBe(2); // else → /50
    expect(calculateEcoPoints(100, 2, 3)).toBe(40); // 10 + 3*10
  });

  it("returns 0 for invalid inputs", () => {
    expect(calculateEcoPoints(-1, 2)).toBe(0);
    expect(calculateEcoPoints(100, 0)).toBe(0);
    expect(calculateEcoPoints(100, 2, -1)).toBe(0);
  });
});