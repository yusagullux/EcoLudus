import { isDatabaseSetupError, sql } from "@/lib/db";

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
    if (!isDatabaseSetupError(error)) {
      console.error("Error calculating stats:", error);
    }

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
      <div className="relative overflow-hidden rounded-[1.5rem] bg-[linear-gradient(180deg,#26472e_0%,#16301d_100%)] p-6 text-cream-100 shadow-inner sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-moss-300/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-moss-300 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-moss-300" />
              </span>
              <p className="text-[11px] uppercase tracking-[0.24em] text-moss-300">Real-time impact</p>
            </div>
            <h2 className="mt-3 font-serif text-3xl">Forest pulse</h2>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-[0.22em] text-moss-300">CO₂ reduced</div>
            <div className="mt-1.5 font-serif text-3xl font-bold">{stats.total_co2_reduced.toFixed(1)}<span className="text-lg">kg</span></div>
            <div className="mt-0.5 text-[10px] text-moss-300">by community</div>
          </div>
        </div>
        <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-moss-300">Active members</div>
            <div className="mt-2 font-serif text-2xl font-bold text-white">{stats.active_users.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-moss-300">Missions</div>
            <div className="mt-2 font-serif text-2xl font-bold text-white">{stats.total_missions.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-moss-300">Community XP</div>
            <div className="mt-2 font-serif text-2xl font-bold text-white">{(stats.total_xp / 1000).toFixed(1)}k</div>
          </div>
        </div>
        <div className="relative mt-4 text-[11px] text-moss-300">Real data from verified missions</div>
      </div>
    </div>
  );
}
