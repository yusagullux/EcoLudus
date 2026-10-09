import { describe, it, expect } from "vitest";
import { computeCategoryProgress, TOTAL_QUESTS_BY_CATEGORY } from "@/lib/quest-progress";

// FEEDBACKS.md B1: Dashboard ("Quest progress" chips) and Profile ("Quest
// Category Progress") each carried their own hardcoded category lists and
// totals, so the same account showed `Gardening & Nature 0/6` in one place
// and `Gardening & Nature 1/10` in the other (with Sustainable Living absent
// from Profile). Both pages now render from this single shared module.
//
// Expected contract: category names/totals come from public/quests.json and
// are the single source of truth; `done` counts completedQuests entries that
// match quest ids in quests.json; per-category CO₂ ceiling is the sum of the
// quests' own carbonFootprintReduction (replacing the stale hardcoded maxCo2).

describe("computeCategoryProgress", () => {
  it("lists all 7 quests.json categories in definitions order", () => {
    const names = computeCategoryProgress([]).map((c) => c.name);
    expect(names).toEqual([
      "Recycling",
      "Energy Saving",
      "Transportation",
      "Water Saving",
      "Clean-Up Missions",
      "Gardening & Nature",
      "Sustainable Living"
    ]);
  });

  it("totals match the quests.json category sizes (not hardcoded tables)", () => {
    for (const cat of computeCategoryProgress([])) {
      expect(cat.total).toBe(TOTAL_QUESTS_BY_CATEGORY[cat.name]);
    }
    expect(TOTAL_QUESTS_BY_CATEGORY["Gardening & Nature"]).toBe(6);
    expect(TOTAL_QUESTS_BY_CATEGORY["Sustainable Living"]).toBe(16);
  });

  it("counts completed quests under their quests.json category", () => {
    const result = computeCategoryProgress(["recycling_1", "sustainable_3"]);
    const recycling = result.find((c) => c.name === "Recycling")!;
    const sustainable = result.find((c) => c.name === "Sustainable Living")!;
    expect(recycling.done).toBe(1);
    expect(sustainable.done).toBe(1);
    // a completed id that doesn't exist in quests.json is ignored
    expect(result.every((c) => c.done <= c.total)).toBe(true);
  });

  it("ignores unknown completed ids", () => {
    const result = computeCategoryProgress(["nonexistent_quest_99", "garbage"]);
    expect(result.every((c) => c.done === 0)).toBe(true);
  });

  it("derives maxCo2 from the quests' own carbonFootprintReduction sums", () => {
    const recycling = computeCategoryProgress([]).find((c) => c.name === "Recycling")!;
    expect(recycling.maxCo2).toBeCloseTo(12, 1);
    const sustainable = computeCategoryProgress([]).find((c) => c.name === "Sustainable Living")!;
    expect(sustainable.maxCo2).toBeCloseTo(18.4, 1);
  });
});