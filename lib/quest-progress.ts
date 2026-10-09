// Shared quest-category progress — the single source both the dashboard
// "Quest progress" chips and the profile "Quest Category Progress" panel
// render from (FEEDBACKS.md B1: the two pages used separate hardcoded lists
// with different totals and disagreed on where "Sustainable Living" quests
// belonged).
//
// Categories and per-quest ids come from public/quests.json (static, served
// publicly — the client bundle already fetches it). Category totals are the
// real quest counts; the per-category CO₂ ceiling is the sum of each quest's
// own carbonFootprintReduction, replacing public-profile's stale hardcoded
// maxCo2 table.

import questsJson from "../public/quests.json";

export type CategoryProgress = {
  name: string;
  done: number;
  total: number;
  maxCo2: number;
};

type QuestJsonCategory = { name?: string; quests?: Array<{ id?: string; carbonFootprintReduction?: number }> };

const categories = (questsJson as { categories?: QuestJsonCategory[] }).categories ?? [];

export const TOTAL_QUESTS_BY_CATEGORY: Record<string, number> = Object.fromEntries(
  categories.map((c) => [c.name ?? "", (c.quests ?? []).length])
);

export function computeCategoryProgress(completedQuests: string[]): CategoryProgress[] {
  const completed = new Set(completedQuests.map(String));
  return categories.map((category) => {
    const quests = category.quests ?? [];
    let done = 0;
    let maxCo2 = 0;
    for (const quest of quests) {
      if (typeof quest.id === "string" && completed.has(quest.id)) done += 1;
      maxCo2 += Number(quest.carbonFootprintReduction) || 0;
    }
    return { name: category.name ?? "", done, total: quests.length, maxCo2 };
  });
}