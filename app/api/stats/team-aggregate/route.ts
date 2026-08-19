import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated" } },
      { status: 401 }
    );
  }

  try {
    // Single aggregate query: one row per team with summed member XP/eco (over
    // the team_active_missions × users join, matching the prior semantics where
    // member_count is the number of joined rows that resolve to a user) plus a
    // correlated mission-log count. Replaces the previous N+1 (2 queries × 50
    // teams = 100 round-trips) with one round-trip.
    const teamsResult = await sql<{
      id: string;
      payload: Record<string, unknown>;
      total_xp: string | number;
      total_eco: string | number;
      member_count: string | number;
      missions_completed: string | number;
    }>(
      `select t.id, t.payload,
              coalesce(sum((u.payload->>'xp')::numeric), 0) as total_xp,
              coalesce(sum((u.payload->>'ecoPoints')::numeric), 0) as total_eco,
              count(u.id) as member_count,
              (select count(*) from team_mission_logs tml where tml.team_id = t.id) as missions_completed
       from teams t
       left join team_active_missions tam on tam.team_id = t.id
       left join users u on u.id::text = tam.payload->>'user_id'
       group by t.id
       order by t.created_at desc
       limit $1`,
      [50]
    );

    const teamStats = teamsResult.rows.map((row) => {
      const teamPayload = row.payload as Record<string, unknown>;
      // NOTE: the team's private join_code is deliberately NOT selected or
      // returned. Join codes are crypto.randomBytes secrets used to gate team
      // membership; broadcasting them on a public leaderboard would let any
      // authenticated user join any private team. The /api/teams GET route is
      // the only place a join code is returned, and only for the caller's own
      // team. The name fallback uses the team id, never the join code.
      return {
        id: row.id,
        name: String(teamPayload?.name ?? "Unnamed team"),
        totalXP: Math.round(Number(row.total_xp ?? 0)),
        totalEco: Math.round(Number(row.total_eco ?? 0)),
        memberCount: Number(row.member_count ?? 0),
        missionsCompleted: Number(row.missions_completed ?? 0)
      };
    });

    // Sort teams by total XP descending
    const sorted = teamStats.sort((a, b) => b.totalXP - a.totalXP);

    return NextResponse.json({
      teams: sorted,
      count: sorted.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    logError("Team aggregate error", error);
    return NextResponse.json(
      { error: { code: "internal-error" }, teams: [] },
      { status: 500 }
    );
  }
}
