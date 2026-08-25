function dayNumber(date: Date) {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000
  );
}

function parseDay(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  const time = parsed.getTime();
  return Number.isNaN(time) ? null : dayNumber(parsed);
}

export function applyDailyStreak(
  payload: Record<string, unknown>,
  now = new Date()
): Record<string, unknown> {
  const today = now.toISOString().slice(0, 10);
  const todayNumber = dayNumber(now);
  const lastLoginDay = parseDay(payload.lastLoginDate);
  const currentStreak = Math.max(0, Number(payload.currentStreak ?? 0) || 0);
  const longestStreak = Math.max(0, Number(payload.longestStreak ?? 0) || 0);

  if (lastLoginDay === todayNumber) {
    const normalizedCurrent = Math.max(1, currentStreak);
    return {
      ...payload,
      currentStreak: normalizedCurrent,
      longestStreak: Math.max(longestStreak, normalizedCurrent),
      lastLoginDate: today
    };
  }

  const nextCurrentStreak =
    lastLoginDay === todayNumber - 1 ? Math.max(1, currentStreak + 1) : 1;

  return {
    ...payload,
    currentStreak: nextCurrentStreak,
    longestStreak: Math.max(longestStreak, nextCurrentStreak),
    lastLoginDate: today
  };
}

// ── Streak milestone rewards ───────────────────────────────────────────────
// Milestone rewards: day 3 → 20 EcoPoints, day 7 → common egg, day 14 → rare
// egg, day 30 → legendary egg. Each milestone fires once per streak, tracked by
// `lastStreakRewardDay` so re-logins on the same day don't double-grant. The
// reward *grant* lives server-side (this function + /api/streak/apply); the
// client only asks the server to run it and surfaces the returned label.
//
// This function is pure: it returns the next payload + the granted milestone
// (or null) without touching the database. Callers persist via the impact
// service so the eco grant and the egg payload land in one atomic write.

export type StreakReward = {
  day: number;
  type: "eco" | "egg";
  amount?: number;
  rarity?: string;
  label: string;
};

export type StreakRewardResult = {
  payload: Record<string, unknown>;
  granted: StreakReward | null;
};

export const STREAK_MILESTONES = [
  { day: 3, type: "eco", amount: 20, label: "3-day streak: +20 EcoPoints" },
  { day: 7, type: "egg", rarity: "common", label: "7-day streak: Common Egg!" },
  { day: 14, type: "egg", rarity: "rare", label: "14-day streak: Rare Egg!" },
  { day: 30, type: "egg", rarity: "legendary", label: "30-day streak: Legendary Egg!" }
] as const;

export function applyStreakRewards(
  payload: Record<string, unknown>,
  now = new Date()
): StreakRewardResult {
  const streak = Math.max(0, Number(payload.currentStreak ?? 0) || 0);
  const lastStreakReward = Math.max(0, Number(payload.lastStreakRewardDay ?? 0) || 0);

  const nextPayload: Record<string, unknown> = { ...payload };
  let granted: StreakReward | null = null;

  for (const milestone of STREAK_MILESTONES) {
    if (streak >= milestone.day && lastStreakReward < milestone.day) {
      if (milestone.type === "egg") {
        const rarity = milestone.rarity as string;
        const eggName = `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Egg`;
        const eggImage = `/images/eggs/${rarity}-egg.png`;
        const currentEggs = Array.isArray(payload.eggs) ? [...(payload.eggs as Array<Record<string, unknown>>)] : [];
        const existingIdx = currentEggs.findIndex((egg) => egg.name === eggName);
        if (existingIdx >= 0) {
          currentEggs[existingIdx] = {
            ...currentEggs[existingIdx],
            count: Number(currentEggs[existingIdx].count ?? 1) + 1
          };
        } else {
          currentEggs.push({
            id: now.getTime(),
            name: eggName,
            rarity,
            price: 0,
            image: eggImage,
            count: 1,
            purchasedAt: now.toISOString()
          });
        }
        nextPayload.eggs = currentEggs;
      }
      nextPayload.lastStreakRewardDay = milestone.day;
      granted = {
        day: milestone.day,
        type: milestone.type,
        amount: milestone.type === "eco" ? milestone.amount : undefined,
        rarity: milestone.type === "egg" ? milestone.rarity : undefined,
        label: milestone.label
      };
      break; // grant one milestone at a time, highest applicable
    }
  }

  return { payload: nextPayload, granted };
}
