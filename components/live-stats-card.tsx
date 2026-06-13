import { sql } from "@/lib/db";

async function getAggregatedStats() {
  try {
    // Fetch all mission logs - these queries are supported by the file database
    const missionLogsResult = await sql(`
      SELECT id, user_id, payload FROM mission_logs
    `);

    const missionLogs = missionLogsResult.rows as any[];

    // Calculate aggregations manually
    const activeUsers = new Set(missionLogs.map((log) => log.user_id)).size;
    const totalMissions = missionLogs.length;
    const totalXp = missionLogs.reduce((sum, log) => sum + (parseInt(log.payload?.xp) || 0), 0);
    const totalCO2Reduced = missionLogs.reduce((sum, log) => sum + (parseFloat(log.payload?.carbonReduced) || 0), 0);

    return {
      active_users: activeUsers,
      total_missions: totalMissions,
      total_xp: totalXp,
      total_co2_reduced: totalCO2Reduced
    };
  } catch (error) {
    console.error("Error calculating stats:", error);
    return {
      active_users: 0,
      total_missions: 0,
      total_xp: 0,
      total_co2_reduced: 0
    };
  }
}

export async function LiveStatsCard() {
  const stats = await getAggregatedStats();

  return (
    <div className="rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(239,243,232,0.82))] p-5 shadow-[0_35px_90px_rgba(16,33,20,0.16)] backdrop-blur-xl">
      <div className="rounded-[1.5rem] bg-[linear-gradient(180deg,#26472e_0%,#16301d_100%)] p-6 text-cream-100 shadow-inner">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-moss-300">Real-time impact</p>
            <h2 className="mt-3 font-serif text-3xl">Forest pulse</h2>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.22em] text-moss-300">CO₂ reduced</div>
            <div className="mt-2 text-3xl font-semibold">{stats.total_co2_reduced.toFixed(1)}kg</div>
            <div className="mt-1 text-xs text-moss-300">by community</div>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-5">
            <div className="text-xs uppercase tracking-[0.2em] text-moss-300">Active members</div>
            <div className="mt-3 text-2xl font-semibold text-white">{stats.active_users}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-5">
            <div className="text-xs uppercase tracking-[0.2em] text-moss-300">Missions</div>
            <div className="mt-3 text-2xl font-semibold text-white">{stats.total_missions}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-5">
            <div className="text-xs uppercase tracking-[0.2em] text-moss-300">Community XP</div>
            <div className="mt-3 text-2xl font-semibold text-white">{(stats.total_xp / 1000).toFixed(1)}k</div>
          </div>
        </div>
        <div className="mt-4 text-xs text-moss-300">Real data from verified missions</div>
      </div>
    </div>
  );
}
