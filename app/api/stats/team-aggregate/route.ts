import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated" } },
      { status: 401 }
    );
  }

  try {
    // Get all teams with their member stats aggregated
    const teamsResult = await sql<{
      id: string;
      join_code: string;
      payload: Record<string, unknown>;
    }>(
      `select id, join_code, payload from teams order by created_at desc limit $1`,
      [50]
    );

    const teamStats = await Promise.all(
      teamsResult.rows.map(async (team) => {
        // Get all members for this team
        const membersResult = await sql<{
          total_xp: string | number;
          total_eco: string | number;
          member_count: string | number;
        }>(
          `select
             coalesce(sum((u.payload->>'xp')::numeric), 0) as total_xp,
             coalesce(sum((u.payload->>'ecoPoints')::numeric), 0) as total_eco,
             count(*) as member_count
           from team_active_missions tam
           join users u on u.id::text = tam.payload->>'user_id'
           where tam.team_id = $1`,
          [team.id]
        );

        // Get missions completed by this team
        const missionsResult = await sql<{ missions_completed: string | number }>(
          `select count(*) as missions_completed from team_mission_logs where team_id = $1`,
          [team.id]
        );

        const memberRow = membersResult.rows[0];
        const missionRow = missionsResult.rows[0];

        const teamPayload = team.payload as Record<string, unknown>;

        return {
          id: team.id,
          name: String(teamPayload?.name ?? `Team ${team.join_code}`),
          joinCode: team.join_code,
          totalXP: Math.round(Number(memberRow?.total_xp ?? 0)),
          totalEco: Math.round(Number(memberRow?.total_eco ?? 0)),
          memberCount: Number(memberRow?.member_count ?? 0),
          missionsCompleted: Number(missionRow?.missions_completed ?? 0)
        };
      })
    );

    // Sort teams by total XP descending
    const sorted = teamStats.sort((a, b) => b.totalXP - a.totalXP);

    return NextResponse.json({
      teams: sorted,
      count: sorted.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Team aggregate error:", error);
    return NextResponse.json(
      { error: { code: "internal-error" }, teams: [] },
      { status: 500 }
    );
  }
}
