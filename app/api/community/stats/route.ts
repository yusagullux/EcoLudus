import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    // Get all mission logs and users - these are supported queries
    const missionLogsResult = await sql(`
      SELECT id, user_id, payload FROM mission_logs
    `);

    const missionLogs = missionLogsResult.rows as any[];

    // Calculate aggregated community stats manually
    const activeMembers = new Set(missionLogs.map((log) => log.user_id)).size;
    const totalMissions = missionLogs.length;
    const totalCO2Avoided = missionLogs.reduce(
      (sum, log) => sum + (parseFloat(log.payload?.carbonReduced) || 0),
      0
    );
    const totalXP = missionLogs.reduce((sum, log) => sum + (parseInt(log.payload?.xp) || 0), 0);

    return NextResponse.json({
      activeMembers: Math.max(activeMembers, 0),
      totalMissions: Math.max(totalMissions, 0),
      totalCO2Avoided: Math.max(totalCO2Avoided, 0),
      totalXP: Math.max(totalXP, 0),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Community stats error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch community stats",
        activeMembers: 0,
        totalMissions: 0,
        totalCO2Avoided: 0,
        totalXP: 0
      },
      { status: 200 } // Return 200 even on error to show graceful fallback
    );
  }
}
