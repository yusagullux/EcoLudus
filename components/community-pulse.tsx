"use client";

import { useEffect, useState } from "react";

// Live community stats for the landing page. Sourced from /api/stats/community-aggregate
// (the cached, users-table aggregate) rather than the old /api/community/stats route,
// which read the mission_logs table and duplicated this aggregation.

interface CommunityStats {
  members: number;
  totalMissions: number;
  totalCO2kg: number;
  updated: string;
}

export function CommunityPulse() {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats/community-aggregate", {
          cache: "no-store"
        });
        const data = await response.json();
        setStats({
          members: Number(data?.totalUsers ?? 0),
          totalMissions: Number(data?.totalMissions ?? 0),
          totalCO2kg: Number(data?.totalCO2kg ?? 0),
          updated: String(data?.cachedAt ?? new Date().toISOString())
        });
      } catch (error) {
        console.error("Failed to fetch community stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Refresh every 5 minutes (matches the server-side cache TTL)
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-forest-900/10 bg-white/60 px-6 py-5 text-center">
        <p className="text-sm text-forest-900/60">Loading community data...</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-forest-900/10 bg-white/80 px-6 py-6 shadow-[0_14px_34px_rgba(16,33,20,0.08)] backdrop-blur sm:px-10 sm:py-7">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-forest-900/60">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest-600" />
          </span>
          Community pulse
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 text-center sm:gap-10">
          <div>
            <div className="font-serif text-3xl font-bold text-forest-950">
              {stats.members.toLocaleString()}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-forest-900/55">
              Members
            </div>
          </div>

          <div className="hidden h-10 w-px bg-forest-900/10 sm:block" />

          <div>
            <div className="font-serif text-3xl font-bold text-forest-950">
              {stats.totalMissions.toLocaleString()}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-forest-900/55">
              Missions Completed
            </div>
          </div>

          <div className="hidden h-10 w-px bg-forest-900/10 sm:block" />

          <div>
            <div className="font-serif text-3xl font-bold text-forest-950">
              {stats.totalCO2kg.toLocaleString()}<span className="text-xl">kg</span>
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-forest-900/55">
              CO₂ Avoided
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-forest-900/8 pt-3 text-center text-[11px] text-forest-900/50 sm:text-right">
        Real data • Updated {new Date(stats.updated).toLocaleTimeString()}
      </div>
    </div>
  );
}