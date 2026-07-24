import { randomUUID } from "crypto";
import { sql, transaction } from "./db";
import { calculateLevel } from "./level-system";

/**
 * Impact is the single server-validated progression unit that every eco action
 * feeds. XP stays the lifetime prestige gauge (badges / level curve / milestones
 * read it); Impact is what the four hooks (companion biome, quest path, seasons,
 * leagues) consume. Most actions grant XP and Impact in a ~1:1 ratio, but callers
 * can pass `baseImpact: 0` for actions that should move XP/eco without growing the
 * spine (e.g. the free "pet" tap, which is a cosmetic interaction).
 *
 * All game-state mutations go through here so the client can never mint rewards —
 * it only reads numbers and asks the server to act. See the gamification plan.
 */

export type ImpactSource =
  | "quests"
  | "private"
  | "team"
  | "ecomap"
  | "petCare"
  | "garden"
  | "egg"
  | "friend"
  | "streak";

export type GrantImpactInput = {
  userId: string;
  source: ImpactSource;
  /** XP added to the lifetime gauge. Defaults to 0. */
  baseXp?: number;
  /** Impact added to the spine. Defaults to baseXp (1:1 ratio). */
  baseImpact?: number;
  /** EcoPoints delta (can be negative for spends). Defaults to 0. */
  eco?: number;
  /** kg CO2 reduced. Defaults to 0. */
  carbon?: number;
  /** Free-form metadata stored on the impact_events ledger row. */
  meta?: Record<string, unknown>;
  /**
   * Extra payload fields to merge into the user document atomically with the
   * reward (e.g. eggs granted by a streak, missionsCompleted bump). Shallow-merged
   * after the impact/xp/eco fields, so do not include xp/level/impact here.
   */
  payloadPatch?: Record<string, unknown>;
};

export type GrantImpactResult = {
  userId: string;
  xp: number;
  level: number;
  previousLevel: number;
  leveledUp: boolean;
  impact: number;
  impactDelta: number;
  ecoPoints: number;
  carbonReduced: number;
};

type UserRecord = {
  id: string;
  email: string;
  xp: number | null;
  level: number | null;
  trust_score: number | null;
  payload: Record<string, unknown>;
};

async function getUserForImpact(userId: string) {
  const result = await sql<UserRecord>(
    `select id, email, xp, level, trust_score, payload
     from users
     where id = $1
     limit 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function grantImpact(input: GrantImpactInput): Promise<GrantImpactResult | null> {
  const baseXp = Math.max(0, Math.floor(Number(input.baseXp ?? 0) || 0));
  const baseImpact = Math.max(0, Math.floor(Number(input.baseImpact ?? baseXp) || 0));
  const eco = Math.floor(Number(input.eco ?? 0) || 0);
  const carbon = Number(input.carbon ?? 0) || 0;
  const meta = input.meta ?? {};
  const patch = input.payloadPatch ?? {};

  // Nothing to do — avoid a no-op write.
  if (baseXp === 0 && baseImpact === 0 && eco === 0 && carbon === 0 && Object.keys(patch).length === 0) {
    return null;
  }

  const user = await getUserForImpact(input.userId);
  if (!user) {
    return null;
  }

  const payload = user.payload ?? {};
  const previousXp = Math.max(0, Math.floor(Number(payload.xp ?? user.xp ?? 0) || 0));
  const previousLevel = Math.max(1, Math.floor(Number(payload.level ?? user.level ?? calculateLevel(previousXp)) || 0) || 1);
  const nextXp = previousXp + baseXp;
  const nextLevel = calculateLevel(nextXp);

  const previousImpact = Math.max(0, Math.floor(Number(payload.impact ?? 0) || 0));
  const nextImpact = previousImpact + baseImpact;

  const previousEco = Math.max(0, Math.floor(Number(payload.ecoPoints ?? 0) || 0));
  const nextEco = Math.max(0, previousEco + eco);

  const previousCarbon = Math.max(0, Number(payload.carbonReduced ?? 0) || 0);
  const nextCarbon = Math.round((previousCarbon + carbon) * 100) / 100;

  const impactBySource = {
    ...(typeof payload.impactBySource === "object" && payload.impactBySource ? payload.impactBySource : {}),
    [input.source]: Math.max(0, Math.floor(Number((payload.impactBySource as Record<string, number> | undefined)?.[input.source] ?? 0) || 0)) + baseImpact
  };

  const nextPayload: Record<string, unknown> = {
    ...payload,
    xp: nextXp,
    level: nextLevel,
    ecoPoints: nextEco,
    carbonReduced: nextCarbon,
    impact: nextImpact,
    impactBySource,
    ...patch
  };

  const eventId = randomUUID();

  await transaction(async (query) => {
    await query(
      `insert into users (id, email, password_hash, xp, level, payload)
       values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $4, $5, $3::jsonb)
       on conflict (id) do update
       set email = excluded.email,
           xp = excluded.xp,
           level = excluded.level,
           payload = excluded.payload,
           updated_at = now()`,
      [input.userId, user.email, JSON.stringify(nextPayload), nextXp, nextLevel]
    );

    if (baseImpact > 0) {
      await query(
        `insert into impact_events (id, user_id, source, amount, meta)
         values ($1, $2, $3, $4, $5::jsonb)`,
        [eventId, input.userId, input.source, baseImpact, JSON.stringify(meta)]
      );
    }
  });

  return {
    userId: input.userId,
    xp: nextXp,
    level: nextLevel,
    previousLevel,
    leveledUp: nextLevel > previousLevel,
    impact: nextImpact,
    impactDelta: baseImpact,
    ecoPoints: nextEco,
    carbonReduced: nextCarbon
  };
}

/** Sum of Impact granted since `sinceIso` (ISO timestamp). Used by the dashboard "Impact this week" cell. */
export async function getImpactSince(userId: string, sinceIso: string): Promise<number> {
  const result = await sql<{ week_impact: number }>(
    `select coalesce(sum(amount), 0) as week_impact
     from impact_events
     where user_id = $1 and created_at >= $2`,
    [userId, sinceIso]
  );
  return Number(result.rows[0]?.week_impact ?? 0);
}

/** Recent impact ledger rows since `sinceIso`, newest first. */
export async function getRecentImpact(
  userId: string,
  sinceIso: string,
  limit = 100
): Promise<Array<{ id: string; source: string; amount: number; meta: Record<string, unknown>; created_at: string }>> {
  const result = await sql<{
    id: string;
    source: string;
    amount: number;
    meta: Record<string, unknown>;
    created_at: string;
  }>(
    `select id, source, amount, meta, created_at
     from impact_events
     where user_id = $1 and created_at >= $2
     order by created_at desc
     limit $3`,
    [userId, sinceIso, limit]
  );
  return result.rows;
}