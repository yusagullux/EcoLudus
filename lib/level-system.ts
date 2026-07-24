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
  rewardType: "level_up" | "garden_item" | "team_boost";
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
      rewards.push({ level, rewardType: "level_up", label: `Level ${level} reached` });
    }
  }

  return rewards;
}

// ── XP-progress helpers (ported from the legacy public/js/levels.js) ──

export function getXPRequiredForLevel(level: number) {
  const activeLevel = Math.max(1, Math.floor(level));
  return requiredXP(activeLevel) - (activeLevel <= 1 ? 0 : requiredXP(activeLevel - 1));
}

export function getTotalXPForLevel(level: number) {
  if (level <= 1) return 0;
  return requiredXP(level - 1);
}

export function getXPProgress(xp: number, currentLevel: number | null = null) {
  const safeXP = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  const level = currentLevel ?? calculateLevel(safeXP);

  const totalXPForCurrentLevel = level <= 1 ? 0 : requiredXP(level - 1);
  const totalXPForNextLevel = requiredXP(level);
  const xpInCurrentLevel = safeXP - totalXPForCurrentLevel;
  const requiredXPInLevel = totalXPForNextLevel - totalXPForCurrentLevel;

  const percentage = requiredXPInLevel > 0
    ? Math.min(100, (xpInCurrentLevel / requiredXPInLevel) * 100)
    : 100;

  return {
    current: xpInCurrentLevel,
    required: requiredXPInLevel,
    percentage: Math.max(0, percentage)
  };
}

export function calculateEcoPoints(xp: number, level: number, badgesCount = 0) {
  if (xp < 0 || level < 1 || badgesCount < 0) {
    return 0;
  }

  let basePoints = 0;
  if (level <= 3) {
    basePoints = Math.floor(xp / 10);
  } else if (level <= 5) {
    basePoints = Math.floor(xp / 15);
  } else if (level <= 7) {
    basePoints = Math.floor(xp / 25);
  } else {
    basePoints = Math.floor(xp / 50);
  }

  const badgeBonus = badgesCount * 10;
  return Math.max(0, basePoints + badgeBonus);
}
