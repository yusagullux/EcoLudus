import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// In-memory 5-minute cache
let cache: {
  data: Record<string, unknown>;
  expiresAt: number;
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  // Serve from cache if fresh
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.data);
  }

  try {
    // Aggregate from users table (reliable source — all XP/CO2 is accumulated here)
    const usersResult = await sql<{
      total_users: string | number;
      total_xp: string | number;
      total_co2: string | number;
      total_missions: string | number;
      total_trees: string | number;
    }>(
      `select
         count(*) as total_users,
         coalesce(sum((payload->>'xp')::numeric), 0) as total_xp,
         coalesce(sum((payload->>'carbonReduced')::numeric), 0) as total_co2,
         coalesce(sum((payload->>'missionsCompleted')::numeric), 0) as total_missions,
         coalesce(sum((payload->>'treesPlanted')::numeric), 0) as total_trees
       from users`
    );

    const row = usersResult.rows[0];

    const data = {
      totalUsers: Number(row?.total_users ?? 0),
      totalXP: Math.round(Number(row?.total_xp ?? 0)),
      totalCO2kg: Math.round(Number(row?.total_co2 ?? 0) * 10) / 10,
      totalMissions: Number(row?.total_missions ?? 0),
      totalTreesPlanted: Number(row?.total_trees ?? 0),
      source: "live",
      cachedAt: new Date().toISOString()
    };

    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Community aggregate error:", error);

    // Return stale cache if available rather than an error
    if (cache) {
      return NextResponse.json({ ...cache.data, source: "stale-cache" });
    }

    return NextResponse.json(
      {
        totalUsers: 0,
        totalXP: 0,
        totalCO2kg: 0,
        totalMissions: 0,
        totalTreesPlanted: 0,
        source: "error",
        error: "Aggregation unavailable"
      },
      { status: 200 } // 200 so the client doesn't crash
    );
  }
}
