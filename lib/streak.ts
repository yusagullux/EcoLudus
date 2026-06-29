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
