import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId) {
      // Get user's team from team_active_missions (since team_members table doesn't exist in schema)
      const result = await sql(
        "select id, join_code, created_by, payload from teams where id = (select team_id from team_active_missions where payload->>'user_id' = $1 limit 1)",
        [userId]
      );

      if (result.rowCount === 0) {
        return NextResponse.json({ team: null, members: [], activeMissions: [] });
      }

      const team = result.rows[0];
      const payload = team.payload as any;

      // Get team members from payload or active missions
      const membersResult = await sql(
        `select distinct u.id, u.email, u.payload 
         from team_active_missions tam
         join users u on (tam.payload->>'user_id')::text = u.id
         where tam.team_id = $1`,
        [team.id]
      );

      const members = membersResult.rows.map((row) => {
        const userPayload = row.payload as any;
        return {
          id: row.id,
          name: userPayload?.displayName || row.email?.split("@")[0] || "Anonymous",
          role: row.id === team.created_by ? "leader" : "member",
          xp: userPayload?.xp || 0
        };
      });

      // Get team stats
      const statsResult = await sql(
        `select 
           coalesce(sum((payload->>'xp')::int), 0) as total_xp,
           coalesce(sum((payload->>'ecoPoints')::int), 0) as total_eco,
           count(*) as member_count
         from users 
         where id in (select distinct (payload->>'user_id')::text from team_active_missions where team_id = $1)`,
        [team.id]
      );

      const stats = statsResult.rows[0];

      // Get completed missions count
      const missionsResult = await sql(
        `select count(*) as missions_completed
         from team_mission_logs 
         where team_id = $1`,
        [team.id]
      );

      const teamData = {
        id: team.id,
        name: payload?.name || "Team",
        code: team.join_code,
        role: team.created_by === userId ? "leader" : "member",
        stats: {
          xp: parseInt(stats.total_xp) || 0,
          eco: parseInt(stats.total_eco) || 0,
          missions: parseInt(missionsResult.rows[0].missions_completed) || 0,
          members: parseInt(stats.member_count) || 0
        },
        members
      };

      // Get active missions
      const activeMissionsResult = await sql(
        `select id, mission_id, payload 
         from team_active_missions 
         where team_id = $1 
         order by created_at desc`,
        [team.id]
      );

      const activeMissions = activeMissionsResult.rows.map((row) => {
        const missionPayload = row.payload as any;
        return {
          id: row.id,
          title: missionPayload?.title || "Mission",
          icon: missionPayload?.icon || "🎯",
          xp: missionPayload?.xp || 0,
          eco: missionPayload?.eco || 0,
          needed: missionPayload?.needed || 1,
          done: missionPayload?.completed_count || 0
        };
      });

      return NextResponse.json({ team: teamData, activeMissions });
    }

    return NextResponse.json({ error: { code: "invalid-request" } }, { status: 400 });
  } catch (error) {
    console.error("Get team error:", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, userId, teamName, teamCode } = body;

    if (action === "create" && teamName && userId) {
      // Generate a random 6-character team code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const result = await sql(
        "insert into teams (join_code, created_by, payload) values ($1, $2, $3::jsonb) returning id",
        [code, userId, JSON.stringify({ name: teamName })]
      );

      const teamId = result.rows[0].id;

      // Add leader to team_active_missions as a placeholder
      await sql(
        "insert into team_active_missions (id, team_id, payload) values ($1, $2, $3::jsonb)",
        [crypto.randomUUID(), teamId, JSON.stringify({ user_id: userId, role: "leader" })]
      );

      return NextResponse.json({ teamId, code });
    }

    if (action === "join" && teamCode && userId) {
      // Find team by code
      const teamResult = await sql(
        "select id, payload from teams where join_code = $1 limit 1",
        [teamCode.toUpperCase()]
      );

      if (teamResult.rowCount === 0) {
        return NextResponse.json(
          { error: { code: "team-not-found" } },
          { status: 404 }
        );
      }

      const team = teamResult.rows[0];

      // Check if user is already in a team
      const existingResult = await sql(
        "select team_id from team_active_missions where payload->>'user_id' = $1 limit 1",
        [userId]
      );

      if (existingResult.rowCount > 0) {
        return NextResponse.json(
          { error: { code: "already-in-team" } },
          { status: 400 }
        );
      }

      // Add user to team
      await sql(
        "insert into team_active_missions (id, team_id, payload) values ($1, $2, $3::jsonb)",
        [crypto.randomUUID(), team.id, JSON.stringify({ user_id: userId, role: "member" })]
      );

      return NextResponse.json({ teamId: team.id, teamName: (team.payload as any)?.name || "Team" });
    }

    return NextResponse.json({ error: { code: "invalid-request" } }, { status: 400 });
  } catch (error) {
    console.error("Team action error:", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId) {
      // Remove user from their team
      await sql("delete from team_active_missions where payload->>'user_id' = $1", [userId]);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: { code: "invalid-request" } }, { status: 400 });
  } catch (error) {
    console.error("Leave team error:", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}
