import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

function calculateLevel(xp: number) {
  const milestones = [0, 100, 250, 500, 1000, 2500, 5000, 10000, 50000];
  if (typeof xp !== "number" || xp < 0) return 1;
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (xp >= milestones[i]) {
      return i + 1;
    }
  }
  return 1;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId) {
      // Get user's team from team_active_missions (where mission_id is null, indicating user-team linkage)
      const result = await sql(
        "select id, join_code, created_by, payload from teams where id = (select team_id from team_active_missions where payload->>'user_id' = $1 limit 1)",
        [userId]
      );

      if (result.rowCount === 0) {
        return NextResponse.json({ team: null, members: [], activeMissions: [] });
      }

      const team = result.rows[0];
      const payload = team.payload as any;

      // Get team members
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

      // Get active missions (excluding team member placeholder rows where mission_id is null)
      const activeMissionsResult = await sql(
        `select id, mission_id, payload 
         from team_active_missions 
         where team_id = $1 
         order by created_at desc`,
        [team.id]
      );

      const activeMissions = activeMissionsResult.rows
        .filter((row) => row.mission_id !== null)
        .map((row) => {
          const missionPayload = row.payload as any;
          return {
            id: row.id,
            mission_id: row.mission_id,
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
    const { action, userId, teamName, teamCode, teamId, missionId, activeMissionId, title, icon, xp, eco, needed } = body;

    // Create a new team
    if (action === "create" && teamName && userId) {
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

    // Join a team
    if (action === "join" && teamCode && userId) {
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

    // Assign a new mission to the team
    if (action === "assign" && userId && teamId && missionId) {
      // Verify team exists and user is part of it
      const activeCountResult = await sql(
        "select count(*) as count from team_active_missions where team_id = $1 and mission_id is not null",
        [teamId]
      );
      const count = parseInt(activeCountResult.rows[0].count) || 0;
      if (count >= 3) {
        return NextResponse.json(
          { error: { code: "max-missions", message: "Maximum of 3 active team missions allowed." } },
          { status: 400 }
        );
      }

      const duplicateResult = await sql(
        "select id from team_active_missions where team_id = $1 and mission_id = $2 limit 1",
        [teamId, missionId]
      );
      if (duplicateResult.rowCount > 0) {
        return NextResponse.json(
          { error: { code: "already-active", message: "This mission is already active." } },
          { status: 400 }
        );
      }

      const activeMissionId = crypto.randomUUID();
      const payload = {
        title,
        icon,
        xp,
        eco,
        needed,
        completed_count: 0
      };

      await sql(
        `insert into team_active_missions (id, team_id, mission_id, payload)
         values ($1, $2, $3, $4::jsonb)
         on conflict (id) do update
         set mission_id = excluded.mission_id,
             payload = excluded.payload,
             updated_at = now()`,
        [activeMissionId, teamId, missionId, JSON.stringify(payload)]
      );

      return NextResponse.json({ success: true });
    }

    // Submit progress on an active mission
    if (action === "submit_progress" && userId && teamId && activeMissionId) {
      const activeMissionResult = await sql(
        "select payload, mission_id from team_active_missions where team_id = $1 and id = $2 limit 1",
        [teamId, activeMissionId]
      );

      if (activeMissionResult.rowCount === 0) {
        return NextResponse.json(
          { error: { code: "mission-not-found", message: "Active mission not found." } },
          { status: 404 }
        );
      }

      const row = activeMissionResult.rows[0];
      const missionPayload = row.payload as any;
      const currentMissionId = row.mission_id;

      const newCount = (missionPayload.completed_count || 0) + 1;
      const needed = missionPayload.needed || 1;

      if (newCount >= needed) {
        // Mission completed!
        // Delete from active
        await sql(
          "delete from team_active_missions where team_id = $1 and id = $2",
          [teamId, activeMissionId]
        );

        // Add to logs
        const logId = crypto.randomUUID();
        const completedPayload = {
          ...missionPayload,
          completed_count: newCount,
          completed_at: new Date().toISOString()
        };

        await sql(
          `insert into team_mission_logs (id, team_id, mission_id, payload)
           values ($1, $2, $3, $4::jsonb)
           on conflict (id) do update
           set mission_id = excluded.mission_id,
               payload = excluded.payload`,
          [logId, teamId, currentMissionId, JSON.stringify(completedPayload)]
        );

        // Reward all members in the team
        const membersResult = await sql(
          `select distinct u.id, u.email, u.payload 
           from team_active_missions tam
           join users u on (tam.payload->>'user_id')::text = u.id
           where tam.team_id = $1`,
          [teamId]
        );

        for (const member of membersResult.rows) {
          const payload = member.payload as any;
          const newXp = (payload.xp || 0) + (missionPayload.xp || 0);
          const newEco = (payload.ecoPoints || 0) + (missionPayload.eco || 0);
          const newMissions = (payload.missionsCompleted || 0) + 1;
          const newLevel = calculateLevel(newXp);

          const nextPayload = {
            ...payload,
            xp: newXp,
            ecoPoints: newEco,
            level: newLevel,
            missionsCompleted: newMissions
          };

          await sql(
            `insert into users (id, email, password_hash, payload)
             values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
             on conflict (id) do update
             set email = excluded.email,
                 payload = excluded.payload,
                 updated_at = now()`,
            [member.id, member.email, JSON.stringify(nextPayload)]
          );
        }

        return NextResponse.json({ success: true, completed: true });
      }

      // Increment progress
      const updatedPayload = {
        ...missionPayload,
        completed_count: newCount
      };

      await sql(
        `insert into team_active_missions (id, team_id, mission_id, payload)
         values ($1, $2, $3, $4::jsonb)
         on conflict (id) do update
         set mission_id = excluded.mission_id,
             payload = excluded.payload,
             updated_at = now()`,
        [activeMissionId, teamId, currentMissionId, JSON.stringify(updatedPayload)]
      );

      return NextResponse.json({ success: true, completed: false });
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
