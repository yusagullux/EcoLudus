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
      <div className="mk-surface rounded-2xl px-6 py-5 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading community data...</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="mk-surface rounded-2xl px-6 py-6 shadow-[var(--shadow-lift)] backdrop-blur sm:px-10 sm:py-7">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--text-accent)" }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--text-accent)" }} />
          </span>
          Community pulse
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 text-center sm:gap-10">
          <div>
            <div className="font-serif text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              {stats.members.toLocaleString()}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              Members
            </div>
          </div>

          <div className="hidden h-10 w-px sm:block" style={{ background: "var(--border-default)" }} />

          <div>
            <div className="font-serif text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              {stats.totalMissions.toLocaleString()}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              Missions Completed
            </div>
          </div>

          <div className="hidden h-10 w-px sm:block" style={{ background: "var(--border-default)" }} />

          <div>
            <div className="font-serif text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              {stats.totalCO2kg.toLocaleString()}<span className="text-xl">kg</span>
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              CO₂ Avoided
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 border-t pt-3 text-center text-[11px] sm:text-right" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
        Real data • Updated {new Date(stats.updated).toLocaleTimeString()}
      </div>
    </div>
  );
}