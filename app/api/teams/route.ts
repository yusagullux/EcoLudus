import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { verifyImageWithProvider, verifyTextProofWithGemini, parsePhotoProof, createImageHash, getExistingPhotoHash, savePhotoHash } from "@/lib/photo-verification";
import { grantImpact } from "@/lib/impact-service";
import { getTeamMissionTemplate } from "@/lib/catalog-server";

async function getUserTeamId(userId: string) {
  const result = await sql(
    "select team_id from team_active_missions where payload->>'user_id' = $1 limit 1",
    [userId]
  );

  return result.rows[0]?.team_id ? String(result.rows[0].team_id) : null;
}

async function isTeamMember(teamId: string, userId: string) {
  return (await getUserTeamId(userId)) === teamId;
}

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  try {
    const userId = session.userId;

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
         join users u on u.id::text = tam.payload->>'user_id'
         where tam.team_id = $1`,
        [team.id]
      );

      const members = membersResult.rows.map((row) => {
        const userPayload = row.payload as any;
        return {
          id: row.id,
          name: userPayload?.displayName || row.email?.split("@")[0] || "Anonymous",
          role: row.id === team.created_by ? "leader" : "member",
          xp: userPayload?.xp || 0,
          level: Number(userPayload?.level ?? 1),
          profileImage: typeof userPayload?.profileImage === "string" ? userPayload.profileImage : null
        };
      });

      // Get team stats
      const statsResult = await sql(
        `select 
           coalesce(sum((payload->>'xp')::int), 0) as total_xp,
           coalesce(sum((payload->>'ecoPoints')::int), 0) as total_eco,
           count(*) as member_count
         from users 
         where id::text in (select distinct payload->>'user_id' from team_active_missions where team_id = $1)`,
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
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, teamName, teamCode, teamId, missionId, activeMissionId, title, icon, xp, eco, needed, textProof, photoProof, mimeType } = body;
    const userId = session.userId;

    // Create a new team
    if (action === "create" && teamName && userId) {
      const existingResult = await sql(
        "select team_id from team_active_missions where payload->>'user_id' = $1 limit 1",
        [userId]
      );

      if (existingResult.rowCount > 0) {
        return NextResponse.json(
          { error: { code: "already-in-team", message: "You are already part of a team." } },
          { status: 400 }
        );
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const teamId = randomUUID();

      await sql(
        `insert into teams (id, join_code, created_by, payload)
         values ($1, $2, $3, $4::jsonb)
         on conflict (id) do update
         set join_code = excluded.join_code,
             payload = excluded.payload,
             updated_at = now()`,
        [teamId, code, userId, JSON.stringify({ name: teamName })]
      );

      // Add leader to team_active_missions as a placeholder
      await sql(
        "insert into team_active_missions (id, team_id, payload) values ($1, $2, $3::jsonb)",
        [randomUUID(), teamId, JSON.stringify({ user_id: userId, role: "leader" })]
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
        [randomUUID(), team.id, JSON.stringify({ user_id: userId, role: "member" })]
      );

      return NextResponse.json({ teamId: team.id, teamName: (team.payload as any)?.name || "Team" });
    }

    // Assign a new mission to the team
    if (action === "assign" && userId && teamId && missionId) {
      if (!(await isTeamMember(teamId, userId))) {
        return NextResponse.json(
          { error: { code: "permission-denied" } },
          { status: 403 }
        );
      }

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

      // The mission template is the server-side source of truth for the
      // mission's title/icon/xp/eco/needed. The client only sends a missionId;
      // any client-supplied title/icon/xp/eco/needed is ignored. This closes
      // the "client starts a team mission with inflated rewards" risk — the
      // values later granted by submit_progress come from this row, not the
      // request body.
      const template = await getTeamMissionTemplate(String(missionId));
      if (!template) {
        return NextResponse.json(
          { error: { code: "missions/not-found", message: "Unknown mission template." } },
          { status: 400 }
        );
      }

      const activeMissionId = randomUUID();
      const payload = {
        title: template.title,
        icon: template.icon,
        xp: template.xp,
        eco: template.eco,
        needed: template.needed,
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
      if (!(await isTeamMember(teamId, userId))) {
        return NextResponse.json(
          { error: { code: "permission-denied" } },
          { status: 403 }
        );
      }

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

      if (!textProof && !photoProof) {
        return NextResponse.json(
          { error: { code: "proof-required", message: "Please provide either a text description or a photo proof to submit progress." } },
          { status: 400 }
        );
      }

      if (photoProof) {
        // Parse + size-validate the same way /api/ecostops and /api/photo-verification
        // do, then dedupe by image hash so a single photo can't be reused across
        // submissions (previously this route decoded base64 with no checks).
        const photo = parsePhotoProof(photoProof, mimeType);
        if (!photo) {
          return NextResponse.json(
            { error: { code: "invalid-argument", message: "Photo proof must be a valid base64 image between 5KB and 10MB." } },
            { status: 400 }
          );
        }

        const imageHash = createImageHash(photo.buffer);
        const existingPhoto = await getExistingPhotoHash(imageHash);
        if (existingPhoto) {
          return NextResponse.json(
            {
              error: {
                code: "photo-already-used",
                message: existingPhoto.user_id === userId
                  ? "You already used this photo for a team mission. Please take a new photo."
                  : "This photo has already been used by another user. Please submit a unique photo."
              }
            },
            { status: 409 }
          );
        }

        const result = await verifyImageWithProvider(
          photo.buffer,
          userId,
          currentMissionId,
          missionPayload.title || "Team Mission",
          photo.mimeType
        );
        if (!result.verified) {
          return NextResponse.json(
            { error: { code: "verification-failed", message: result.details || "The uploaded photo does not match or prove completion of this team mission. Please provide a relevant photo." } },
            { status: 422 }
          );
        }

        await savePhotoHash(imageHash, userId, `team:${currentMissionId}`);
      } else if (textProof) {
        const result = await verifyTextProofWithGemini(
          textProof,
          missionPayload.title || "Team Mission",
          missionPayload.title || "Team Mission"
        );
        if (!result.verified) {
          return NextResponse.json(
            { error: { code: "verification-failed", message: result.reasoning || "The description provided does not match or prove completion of this team quest. Please write a relevant description." } },
            { status: 422 }
          );
        }
      }

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
        const logId = randomUUID();
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
           join users u on u.id::text = tam.payload->>'user_id'
           where tam.team_id = $1`,
          [teamId]
        );

        const teamXp = Math.max(0, Math.floor(Number(missionPayload.xp || 0)));
        const teamEco = Math.max(0, Math.floor(Number(missionPayload.eco || 0)));

        for (const member of membersResult.rows) {
          const payload = member.payload as any;
          const nextMissions = Math.max(0, Math.floor(Number(payload.missionsCompleted || 0))) + 1;

          // Route through the spine so XP/level/Impact are server-validated and
          // every team completion feeds the same Impact number the hooks consume.
          await grantImpact({
            userId: String(member.id),
            source: "team",
            baseXp: teamXp,
            baseImpact: teamXp,
            eco: teamEco,
            meta: {
              teamId,
              missionId: currentMissionId,
              missionTitle: missionPayload.title || "Team Mission"
            },
            payloadPatch: { missionsCompleted: nextMissions }
          });
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
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  try {
    const userId = session.userId;

    if (!userId) {
      return NextResponse.json({ error: { code: "invalid-request" } }, { status: 400 });
    }

    // Find the caller's team (placeholder rows carry payload.user_id; mission
    // rows do not, so this matches only the membership linkage).
    const teamLink = await sql(
      "select team_id from team_active_missions where payload->>'user_id' = $1 limit 1",
      [userId]
    );
    const teamId = teamLink.rows[0]?.team_id ? String(teamLink.rows[0].team_id) : null;

    // Not in a team — nothing to leave.
    if (!teamId) {
      return NextResponse.json({ success: true });
    }

    const teamRow = await sql(
      "select created_by from teams where id = $1 limit 1",
      [teamId]
    );
    const isLeader = teamRow.rows[0]?.created_by === userId;

    if (isLeader) {
      // Find remaining members (other placeholder rows), most senior first.
      const remaining = await sql(
        `select payload->>'user_id' as user_id
         from team_active_missions
         where team_id = $1
           and payload->>'user_id' is not null
           and payload->>'user_id' <> $2
         order by created_at asc
         limit 1`,
        [teamId, userId]
      );
      const newLeaderId = remaining.rows[0]?.user_id
        ? String(remaining.rows[0].user_id)
        : null;

      if (newLeaderId) {
        // Reassign leadership: the team keeps its id/code/missions; only the
        // leader pointer and the new leader's role label change.
        await sql(
          "update teams set created_by = $1, updated_at = now() where id = $2",
          [newLeaderId, teamId]
        );
        await sql(
          `update team_active_missions
             set payload = jsonb_set(payload, '{role}', to_jsonb('leader'::text), true),
                 updated_at = now()
           where team_id = $1 and payload->>'user_id' = $2`,
          [teamId, newLeaderId]
        );
      } else {
        // No remaining members — disband. Cascades to team_active_missions,
        // team_mission_logs, and team_progress (all on delete cascade).
        await sql("delete from teams where id = $1", [teamId]);
        return NextResponse.json({ success: true, disbanded: true });
      }
    }

    // Remove the caller's membership linkage (mission_id is null placeholder).
    await sql(
      "delete from team_active_missions where team_id = $1 and payload->>'user_id' = $2 and mission_id is null",
      [teamId, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Leave team error:", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}
