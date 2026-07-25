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
    <div className="rounded-2xl border border-forest-900/10 bg-white/80 px-6 py-5 shadow-[0_14px_34px_rgba(16,33,20,0.08)]">
      <div className="flex flex-wrap items-center justify-center gap-8 text-center sm:gap-12">
        <div>
          <div className="text-2xl font-semibold text-forest-900">
            {stats.members.toLocaleString()}
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-forest-900/60 mt-1">
            Members
          </div>
        </div>

        <div className="hidden h-12 w-px bg-forest-900/10 sm:block" />

        <div>
          <div className="text-2xl font-semibold text-forest-900">
            {stats.totalMissions.toLocaleString()}
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-forest-900/60 mt-1">
            Missions Completed
          </div>
        </div>

        <div className="hidden h-12 w-px bg-forest-900/10 sm:block" />

        <div>
          <div className="text-2xl font-semibold text-forest-900">
            {stats.totalCO2kg.toLocaleString()}kg
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-forest-900/60 mt-1">
            CO₂ Avoided
          </div>
        </div>
      </div>
      <div className="mt-4 text-center text-xs text-forest-900/50">
        Real data • Updated {new Date(stats.updated).toLocaleTimeString()}
      </div>
    </div>
  );
}