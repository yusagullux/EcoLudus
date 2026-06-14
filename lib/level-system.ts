export type LevelProgress = {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
};

export type LevelUpReward = {
  level: number;
  rewardType: "badge" | "garden_item" | "team_boost";
  label: string;
};

export function requiredXP(level: number) {
  const safeLevel = Math.max(1, Math.floor(level));
  return 100 * safeLevel + 25 * safeLevel * safeLevel;
}

export function calculateLevel(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0));
  let level = 1;

  while (safeXp >= requiredXP(level)) {
    level += 1;
  }

  return level;
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0));
  const level = calculateLevel(safeXp);
  const currentLevelXp = level <= 1 ? 0 : requiredXP(level - 1);
  const nextLevelXp = requiredXP(level);

  return {
    level,
    totalXp: safeXp,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel: safeXp - currentLevelXp,
    xpToNextLevel: Math.max(0, nextLevelXp - safeXp)
  };
}

export function getLevelUpRewards(previousLevel: number, nextLevel: number) {
  const rewards: LevelUpReward[] = [];

  for (let level = previousLevel + 1; level <= nextLevel; level += 1) {
    if (level % 10 === 0) {
      rewards.push({ level, rewardType: "team_boost", label: `Level ${level} team boost` });
    } else if (level % 5 === 0) {
      rewards.push({ level, rewardType: "garden_item", label: `Level ${level} garden item` });
    } else {
      rewards.push({ level, rewardType: "badge", label: `Level ${level} habit badge` });
    }
  }

  return rewards;
}
