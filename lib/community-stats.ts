import { isDatabaseSetupError, sql } from "@/lib/db";

/**
 * Community aggregate for the public landing page (impact section).
 * Shared by every surface that needs the same numbers so the SQL string
 * exists exactly once — the file-store fallback (lib/db.ts) matches this
 * query by exact normalized text, so it must not be reformatted or split
 * per-consumer. Returns zeros when no database is reachable so landing
 * sections never break.
 */
export async function getCommunityStats() {
  try {
    // Single aggregate row — O(1) memory regardless of how many missions have
    // been logged. (payload->>'xp') is null when the key is absent, and SUM
    // skips nulls, so missing fields contribute 0 rather than erroring.
    const result = await sql(`
      SELECT
        COUNT(DISTINCT user_id) AS active_users,
        COUNT(*) AS total_missions,
        COALESCE(SUM((payload->>'xp')::numeric), 0) AS total_xp,
        COALESCE(SUM((payload->>'carbonReduced')::numeric), 0) AS total_co2_reduced
      FROM mission_logs
    `);

    const row = (result.rows as Array<Record<string, string | number>>)[0] ?? {};
    return {
      activeUsers: Number(row.active_users ?? 0),
      totalMissions: Number(row.total_missions ?? 0),
      totalXp: Number(row.total_xp ?? 0),
      totalCo2Reduced: Number(row.total_co2_reduced ?? 0)
    };
  } catch (error) {
    if (!isDatabaseSetupError(error)) {
      console.error("Error calculating community stats:", error);
    }

    return { activeUsers: 0, totalMissions: 0, totalXp: 0, totalCo2Reduced: 0 };
  }
}