import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import { sql, transaction } from "./db";
import { calculateLevel, getLevelProgress, getLevelUpRewards } from "./level-system";
import {
  type PrivateMissionVerificationResult,
  type VerificationStatus,
  verifyPrivateMissionSubmission
} from "./private-mission-verification";
import {
  calculateTrustUpdate,
  getManualReviewProbability,
  getTrustMultiplier
} from "./trust-system";
import { checkAndProcessMilestones } from "./rewards-sync";

export const privateMissionSubmissionSchema = z.object({
  missionId: z.string().min(2).max(120),
  userId: z.string().uuid(),
  beforeValue: z.string().trim().min(1).max(80).optional(),
  afterValue: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().min(8).max(1000),
  timestamp: z.string().datetime().optional(),
  confidence: z.number().int().min(1).max(5)
});

export type PrivateMissionSubmissionBody = z.infer<typeof privateMissionSubmissionSchema>;

type UserRecord = {
  id: string;
  email: string;
  xp: number | null;
  level: number | null;
  trust_score: number | null;
  payload: Record<string, unknown>;
};

type MissionRecord = {
  id: string;
  title: string;
  base_xp: number;
  repeat_window_seconds: number;
};

const PARTIAL_REWARD_MULTIPLIER = 0.45;
const MAX_SUBMISSIONS_PER_HOUR = 12;

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function windowKey(timestamp: Date, repeatWindowSeconds: number) {
  const seconds = Math.max(60, repeatWindowSeconds);
  return String(Math.floor(timestamp.getTime() / 1000 / seconds));
}

function createSubmissionHash(input: {
  userId: string;
  missionId: string;
  beforeValue: string | null;
  afterValue: string | null;
  description: string;
  timeWindowKey: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        userId: input.userId,
        missionId: input.missionId,
        beforeValue: input.beforeValue?.toLowerCase() ?? null,
        afterValue: input.afterValue?.toLowerCase() ?? null,
        description: input.description.trim().toLowerCase().replace(/\s+/g, " "),
        timeWindowKey: input.timeWindowKey
      })
    )
    .digest("hex");
}

function hashNullable(value: string | null) {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

function xpForVerification(baseXp: number, verification: PrivateMissionVerificationResult, trustScore: number) {
  if (verification.status === "REJECTED" || verification.status === "FLAGGED") {
    return 0;
  }

  const verificationMultiplier = verification.status === "APPROVED" ? 1 : PARTIAL_REWARD_MULTIPLIER;
  const trustMultiplier = getTrustMultiplier(trustScore);
  const confidenceMultiplier = Math.max(0.5, verification.confidence / 100);

  return Math.max(0, Math.floor(baseXp * verificationMultiplier * trustMultiplier * confidenceMultiplier));
}

async function getMission(missionId: string) {
  const result = await sql<MissionRecord>(
    `select id, title, base_xp, repeat_window_seconds
     from missions
     where id = $1 and active = true and mission_type = 'private'
     limit 1`,
    [missionId]
  );

  return result.rows[0] ?? null;
}

async function getUser(userId: string) {
  const result = await sql<UserRecord>(
    `select id, email, xp, level, trust_score, payload
     from users
     where id = $1
     limit 1`,
    [userId]
  );

  return result.rows[0] ?? null;
}

async function getTeamId(userId: string) {
  const result = await sql<{ team_id: string }>(
    "select team_id from team_active_missions where payload->>'user_id' = $1 limit 1",
    [userId]
  );

  return result.rows[0]?.team_id ?? null;
}

async function getRecentSubmissions(userId: string) {
  const result = await sql<{
    mission_id: string;
    status: string;
    submitted_at: string;
    before_value: string | null;
    after_value: string | null;
    description: string;
  }>(
    `select mission_id, status, submitted_at, before_value, after_value, description
     from mission_submissions
     where user_id = $1
     order by submitted_at desc
     limit 20`,
    [userId]
  );

  return result.rows.map((row) => ({
    missionId: row.mission_id,
    status: row.status,
    submittedAt: new Date(row.submitted_at).toISOString(),
    beforeValue: row.before_value,
    afterValue: row.after_value,
    description: row.description
  }));
}

async function getRateLimitCount(userId: string) {
  const result = await sql<{ count: string | number }>(
    `select count(*) as count
     from mission_submissions
     where user_id = $1 and submitted_at > now() - interval '1 hour'`,
    [userId]
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function getMissionVarietyCount(userId: string) {
  const result = await sql<{ count: string | number }>(
    `select count(distinct mission_id) as count
     from mission_submissions
     where user_id = $1 and submitted_at > now() - interval '14 days'`,
    [userId]
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function submitPrivateMission(
  body: PrivateMissionSubmissionBody,
  context: { ipAddress: string | null; userAgent: string | null }
) {
  const submittedAt = body.timestamp ? new Date(body.timestamp) : new Date();
  const mission = await getMission(body.missionId);

  if (!mission) {
    return { error: { code: "missions/not-found", status: 404 } as const };
  }

  const user = await getUser(body.userId);
  if (!user) {
    return { error: { code: "auth/user-not-found", status: 404 } as const };
  }

  const recentSubmissionCount = await getRateLimitCount(body.userId);
  if (recentSubmissionCount >= MAX_SUBMISSIONS_PER_HOUR) {
    return { error: { code: "missions/rate-limited", status: 429 } as const };
  }

  const beforeValue = normalizeOptionalText(body.beforeValue);
  const afterValue = normalizeOptionalText(body.afterValue);
  const timeWindowKey = windowKey(submittedAt, mission.repeat_window_seconds);
  const submissionHash = createSubmissionHash({
    userId: body.userId,
    missionId: body.missionId,
    beforeValue,
    afterValue,
    description: body.description,
    timeWindowKey
  });
  const currentTrustScore = Number(user.payload?.trustScore ?? user.payload?.trust_score ?? user.trust_score ?? 50);
  const recentSubmissions = await getRecentSubmissions(body.userId);
  const missionVarietyCount = await getMissionVarietyCount(body.userId);

  const verification = await verifyPrivateMissionSubmission({
    missionId: body.missionId,
    userId: body.userId,
    beforeValue,
    afterValue,
    description: body.description,
    confidence: body.confidence,
    timestamp: submittedAt.toISOString(),
    userTrustScore: currentTrustScore,
    recentSubmissions
  });

  const trustUpdate = calculateTrustUpdate({
    currentTrustScore,
    verification,
    missionVarietyCount,
    recentSubmissionCount
  });
  const finalXp = xpForVerification(mission.base_xp, verification, trustUpdate.nextScore);
  const previousXp = Number(user.payload?.xp ?? user.xp ?? 0);
  const nextXp = previousXp + finalXp;
  const previousLevel = Number(user.payload?.level ?? user.level ?? calculateLevel(previousXp));
  const nextLevel = calculateLevel(nextXp);
  const levelRewards = getLevelUpRewards(previousLevel, nextLevel);
  const teamId = await getTeamId(body.userId);
  const submissionId = randomUUID();
  const privateLogId = randomUUID();
  const verificationId = randomUUID();
  const trustHistoryId = randomUUID();
  const xpTransactionId = randomUUID();
  const teamProgressId = randomUUID();
  const manualReviewProbability = getManualReviewProbability(
    trustUpdate.nextScore,
    verification.risk_flags.length
  );

  try {
    await transaction(async (query) => {
      await query(
        `insert into mission_submissions (
           id, mission_id, user_id, before_value, after_value, description, confidence,
           submitted_at, submission_hash, time_window_key, status, final_xp,
           trust_before, trust_after, ip_hash, user_agent_hash, metadata
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)`,
        [
          submissionId,
          body.missionId,
          body.userId,
          beforeValue,
          afterValue,
          body.description,
          body.confidence,
          submittedAt.toISOString(),
          submissionHash,
          timeWindowKey,
          verification.status,
          finalXp,
          trustUpdate.previousScore,
          trustUpdate.nextScore,
          hashNullable(context.ipAddress),
          hashNullable(context.userAgent),
          JSON.stringify({ manualReviewProbability, provider: verification.provider })
        ]
      );

      await query(
        `insert into private_mission_logs (
           id, submission_id, mission_id, user_id, before_value, after_value,
           description, self_confidence, logged_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          privateLogId,
          submissionId,
          body.missionId,
          body.userId,
          beforeValue,
          afterValue,
          body.description,
          body.confidence,
          submittedAt.toISOString()
        ]
      );

      await query(
        `insert into ai_verification_results (
           id, submission_id, status, confidence, realism_score, reasoning,
           risk_flags, provider, verified_at
         )
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, now())`,
        [
          verificationId,
          submissionId,
          verification.status,
          verification.confidence,
          verification.realism_score,
          verification.reasoning,
          JSON.stringify(verification.risk_flags),
          verification.provider
        ]
      );

      await query(
        `insert into trust_history (
           id, user_id, submission_id, previous_score, next_score, delta,
           reason, risk_flags
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          trustHistoryId,
          body.userId,
          submissionId,
          trustUpdate.previousScore,
          trustUpdate.nextScore,
          trustUpdate.delta,
          trustUpdate.reason,
          JSON.stringify(verification.risk_flags)
        ]
      );

      if (finalXp > 0) {
        await query(
          `insert into xp_transactions (
             id, user_id, submission_id, amount, reason, trust_multiplier,
             verification_status, metadata
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
          [
            xpTransactionId,
            body.userId,
            submissionId,
            finalXp,
            "private_mission_verified",
            getTrustMultiplier(trustUpdate.nextScore),
            verification.status,
            JSON.stringify({ baseXp: mission.base_xp, levelRewards })
          ]
        );
      }

      if (teamId && finalXp > 0) {
        await query(
          `insert into team_progress (
             id, team_id, user_id, submission_id, points, source, created_at
           )
           values ($1, $2, $3, $4, $5, $6, now())`,
          [teamProgressId, teamId, body.userId, submissionId, finalXp, "private_mission"]
        );
      }

      const nextPayload = {
        ...user.payload,
        xp: nextXp,
        level: nextLevel,
        trustScore: trustUpdate.nextScore,
        missionsCompleted: Number(user.payload?.missionsCompleted ?? 0) + (finalXp > 0 ? 1 : 0),
        lastPrivateMissionAt: submittedAt.toISOString()
      };

      await query(
        `update users
         set xp = $1,
             level = $2,
             trust_score = $3,
             payload = $4::jsonb,
             updated_at = now()
         where id = $5`,
        [nextXp, nextLevel, trustUpdate.nextScore, JSON.stringify(nextPayload), body.userId]
      );
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
    if (code === "23505") {
      return { error: { code: "missions/duplicate-window", status: 409 } as const };
    }
    throw error;
  }

  return {
    submission: {
      id: submissionId,
      missionId: body.missionId,
      status: verification.status as VerificationStatus,
      submittedAt: submittedAt.toISOString()
    },
    verification: {
      status: verification.status,
      confidence: verification.confidence,
      realism_score: verification.realism_score,
      reasoning: verification.reasoning,
      risk_flags: verification.risk_flags
    },
    rewards: {
      xpAwarded: finalXp,
      baseXp: mission.base_xp,
      trustMultiplier: getTrustMultiplier(trustUpdate.nextScore),
      level: getLevelProgress(nextXp),
      levelRewards
    },
    trust: {
      previousScore: trustUpdate.previousScore,
      nextScore: trustUpdate.nextScore,
      delta: trustUpdate.delta,
      manualReviewProbability
    },
    team: {
      teamId,
      pointsAwarded: teamId ? finalXp : 0
    }
  };

  // Check milestones async (tree planting) — fire-and-forget, never blocks the response
  checkAndProcessMilestones(body.userId).catch((err) =>
    console.error("Milestone check after private mission failed:", err)
  );

  return result;
}
