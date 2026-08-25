import { sql, transaction, type DbQuery } from "./db";
import { calculateLevel, getLevelUpRewards, type LevelUpReward } from "./level-system";

/**
 * Progression engine for EcoLudus.
 * Manages player XP, level progression, EcoPoints, carbon reduction, and profile patches.
 * All game-state mutations go through here so the client can never mint rewards.
 */

export type ProgressionSource =
  | "quests"
  | "private"
  | "team"
  | "petCare"
  | "garden"
  | "egg"
  | "friend"
  | "streak";

export type GrantProgressionInput = {
  userId: string;
  source: ProgressionSource;
  /** XP added to the lifetime gauge. Defaults to 0. */
  baseXp?: number;
  /** EcoPoints delta (can be negative for spends). Defaults to 0. */
  eco?: number;
  /** kg CO2 reduced. Defaults to 0. */
  carbon?: number;
  /** Free-form metadata for audit/logging if needed. */
  meta?: Record<string, unknown>;
  /**
   * Extra payload fields to merge into the user document atomically with the
   * reward (e.g. eggs granted by a streak, missionsCompleted bump).
   */
  payloadPatch?: Record<string, unknown>;
  /**
   * Optional pre-locked transaction context from a surrounding transaction()
   * that locked the user row with SELECT ... FOR UPDATE.
   */
  tx?: { query: DbQuery; user: ProgressionUser };
};

export type GrantProgressionResult = {
  userId: string;
  xp: number;
  level: number;
  previousLevel: number;
  leveledUp: boolean;
  ecoPoints: number;
  carbonReduced: number;
  levelUpRewards: LevelUpReward[];
};

type UserRecord = {
  id: string;
  email: string;
  xp: number | null;
  level: number | null;
  trust_score: number | null;
  payload: Record<string, unknown>;
};

export type ProgressionUser = UserRecord;

async function getUserForProgression(userId: string) {
  const result = await sql<UserRecord>(
    `select id, email, xp, level, trust_score, payload
     from users
     where id = $1
     limit 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function grantProgression(input: GrantProgressionInput): Promise<GrantProgressionResult | null> {
  const baseXp = Math.max(0, Math.floor(Number(input.baseXp ?? 0) || 0));
  const eco = Math.floor(Number(input.eco ?? 0) || 0);
  const carbon = Number(input.carbon ?? 0) || 0;
  const patch = input.payloadPatch ?? {};

  // Nothing to do — avoid a no-op write.
  if (baseXp === 0 && eco === 0 && carbon === 0 && Object.keys(patch).length === 0) {
    return null;
  }

  const run = async (query: DbQuery, user: UserRecord): Promise<GrantProgressionResult> => {
    const payload = user.payload ?? {};
    const previousXp = Math.max(0, Math.floor(Number(payload.xp ?? user.xp ?? 0) || 0));
    const previousLevel = Math.max(1, Math.floor(Number(payload.level ?? user.level ?? calculateLevel(previousXp)) || 0) || 1);
    const nextXp = previousXp + baseXp;
    const nextLevel = calculateLevel(nextXp);
    const levelUpRewards = getLevelUpRewards(previousLevel, nextLevel);

    const previousEco = Math.max(0, Math.floor(Number(payload.ecoPoints ?? 0) || 0));
    const nextEco = Math.max(0, previousEco + eco);

    const previousCarbon = Math.max(0, Number(payload.carbonReduced ?? 0) || 0);
    const nextCarbon = Math.round((previousCarbon + carbon) * 100) / 100;

    const nextPayload: Record<string, unknown> = {
      ...payload,
      xp: nextXp,
      level: nextLevel,
      ecoPoints: nextEco,
      carbonReduced: nextCarbon,
      ...patch
    };

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

    return {
      userId: input.userId,
      xp: nextXp,
      level: nextLevel,
      previousLevel,
      leveledUp: nextLevel > previousLevel,
      ecoPoints: nextEco,
      carbonReduced: nextCarbon,
      levelUpRewards
    };
  };

  if (input.tx) {
    return run(input.tx.query, input.tx.user);
  }

  const user = await getUserForProgression(input.userId);
  if (!user) {
    return null;
  }
  return transaction((query) => run(query, user));
}
