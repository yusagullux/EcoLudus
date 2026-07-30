import { randomUUID } from "crypto";
import { sql, transaction, selectUserForUpdate } from "@/lib/db";
import { logger, logError } from "@/lib/logger";

const MILESTONES: Array<{
  type: "level" | "carbon" | "missions";
  value: number;
  trees: number;
  key: string;
  label: string;
}> = [
  { type: "level", value: 5, trees: 1, key: "milestone_level_5", label: "Reached Level 5" },
  { type: "level", value: 10, trees: 5, key: "milestone_level_10", label: "Reached Level 10" },
  { type: "carbon", value: 10, trees: 1, key: "milestone_carbon_10", label: "10 kg CO₂ offset" },
  { type: "carbon", value: 50, trees: 3, key: "milestone_carbon_50", label: "50 kg CO₂ offset" },
  { type: "missions", value: 50, trees: 1, key: "milestone_missions_50", label: "50 missions completed" },
  { type: "missions", value: 100, trees: 2, key: "milestone_missions_100", label: "100 missions completed" }
];

type UserRow = {
  id: string;
  email: string;
  payload: Record<string, unknown>;
};

// Covered by fileSql (exact-match at "select id, email, payload from users where
// id = $1 limit 1") — used for the unlocked evaluation read.
const SELECT_USER =
  "select id, email, payload from users where id = $1 limit 1";

// Covered by fileSql (exact-match at "update users set payload = $1::jsonb,
// updated_at = now() where id = $2") — the only write string this module issues,
// so local no-DB dev works and we never clobber economy columns.
const UPDATE_USER_PAYLOAD =
  "update users set payload = $1::jsonb, updated_at = now() where id = $2";

async function getUserById(userId: string): Promise<UserRow | null> {
  const result = await sql<UserRow>(SELECT_USER, [userId]);
  return result.rows[0] ?? null;
}

function isReached(milestone: (typeof MILESTONES)[number], payload: Record<string, unknown>) {
  if (payload?.[milestone.key]) return false; // already claimed
  const level = Number(payload?.level ?? 1);
  const carbonReduced = Number(payload?.carbonReduced ?? 0);
  const missionsCompleted = Number(payload?.missionsCompleted ?? 0);
  if (milestone.type === "level") return level >= milestone.value;
  if (milestone.type === "carbon") return carbonReduced >= milestone.value;
  if (milestone.type === "missions") return missionsCompleted >= milestone.value;
  return false;
}

async function plantTreesViaEcologi(trees: number, userId: string, milestoneLabel: string): Promise<boolean> {
  const apiKey = process.env.ECOLOGI_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("ECOLOGI_API_KEY not set — skipping tree planting", { userId });
    return false;
  }

  try {
    const response = await fetch("https://public.ecologi.com/users/ecoludus/trees", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        number: trees
      })
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error("Ecologi API error", { status: response.status, body: text.slice(0, 500) });
      return false;
    }

    logger.info("Planted tree(s) via Ecologi", { trees, userId, milestone: milestoneLabel });
    return true;
  } catch (error) {
    logError("Ecologi API call failed", error, { userId });
    return false;
  }
}

/**
 * Check a single user's milestones and trigger tree planting if any are newly
 * reached. Returns the number of trees planted.
 *
 * Concurrency design (audit H8): this is fired fire-and-forget after every quest
 * completion, so two completions can overlap. The old version did three unlocked
 * full-payload overwrites (evaluation read, per-milestone notification upsert,
 * final treesPlanted write) — each clobbered any concurrent reward grant on the
 * same row (lost-update), and two overlapping calls could both plant real trees
 * for the same milestone (double-charge Ecologi).
 *
 * The fix is a pre-claim → plant (outside lock) → finalize flow:
 *   1. Evaluate reached+unclaimed milestones from an unlocked read (idempotent).
 *   2. PRE-CLAIM them under a row lock: re-check each against the locked payload
 *      (a concurrent call may have beaten us) and mark the milestone key so no
 *      other call plants for it. Returns only the milestones this call claimed.
 *   3. Plant real trees via Ecologi OUTSIDE any lock (network call — never hold
 *      a row lock across it).
 *   4. FINALIZE under a row lock: bump treesPlanted by the successfully-planted
 *      count, append a notification per planted milestone, and — for transient
 *      Ecologi failures (key configured) — un-claim so the next run retries.
 *      No-key dev runs keep the claim (matches the old "don't retry forever"
 *      behavior). Both writes are patch-merges over the locked payload, so
 *      economy state (xp/eco/eggs/…) is preserved, not clobbered.
 */
export async function checkAndProcessMilestones(userId: string): Promise<number> {
  // 1. Evaluate (unlocked).
  const user = await getUserById(userId);
  if (!user) return 0;

  const candidates = MILESTONES.filter((m) => isReached(m, user.payload || {}));
  if (candidates.length === 0) return 0;

  // 2. Pre-claim under a lock.
  const claimed = await preClaimMilestones(userId, candidates);
  if (claimed.length === 0) return 0;

  // 3. Plant outside the lock.
  let totalTreesPlanted = 0;
  const plantResults: Array<{ milestone: (typeof MILESTONES)[number]; planted: boolean }> = [];
  for (const milestone of claimed) {
    const planted = await plantTreesViaEcologi(milestone.trees, userId, milestone.label);
    plantResults.push({ milestone, planted });
    if (planted) totalTreesPlanted += milestone.trees;
  }

  // 4. Finalize under a lock.
  await finalizeMilestones(userId, plantResults, totalTreesPlanted);

  return totalTreesPlanted;
}

// Mark the candidate milestones as claimed under a row lock, re-checking each
// against the locked payload so a concurrent call can't double-claim. Returns
// only the milestones THIS call newly claimed.
async function preClaimMilestones(
  userId: string,
  candidates: Array<(typeof MILESTONES)[number]>
): Promise<Array<(typeof MILESTONES)[number]>> {
  const newlyClaimed: Array<(typeof MILESTONES)[number]> = [];

  await transaction(async (query) => {
    const result = await selectUserForUpdate<UserRow>(query, userId);
    const locked = result.rows[0];
    if (!locked) return;

    const patch: Record<string, unknown> = {};
    for (const milestone of candidates) {
      if (locked.payload?.[milestone.key]) continue; // beaten by a concurrent call
      // Re-check reachability against the locked payload — a concurrent grant
      // may have changed level/carbon/missions since our unlocked evaluation.
      if (!isReached(milestone, locked.payload || {})) continue;
      patch[milestone.key] = true;
      newlyClaimed.push(milestone);
    }

    if (Object.keys(patch).length > 0) {
      const nextPayload = { ...locked.payload, ...patch };
      await query(UPDATE_USER_PAYLOAD, [JSON.stringify(nextPayload), userId]);
    }
  });

  return newlyClaimed;
}

// Bump treesPlanted + append notifications for successfully-planted milestones,
// and un-claim transient Ecologi failures so the next run retries. All under one
// row lock, one patch-merge write.
async function finalizeMilestones(
  userId: string,
  plantResults: Array<{ milestone: (typeof MILESTONES)[number]; planted: boolean }>,
  totalTreesPlanted: number
): Promise<void> {
  await transaction(async (query) => {
    const result = await selectUserForUpdate<UserRow>(query, userId);
    const locked = result.rows[0];
    if (!locked) return;

    const payload = locked.payload || {};
    const patch: Record<string, unknown> = {};
    const hasApiKey = Boolean(process.env.ECOLOGI_API_KEY?.trim());

    if (totalTreesPlanted > 0) {
      patch.treesPlanted = Math.max(0, Number(payload?.treesPlanted ?? 0)) + totalTreesPlanted;
    }

    const notifications: unknown[] = Array.isArray(payload?.notifications)
      ? (payload.notifications as unknown[])
      : [];

    for (const { milestone, planted } of plantResults) {
      if (planted) {
        notifications.unshift({
          id: randomUUID(),
          type: "tree_planted",
          title: `🌳 ${milestone.trees} Tree${milestone.trees > 1 ? "s" : ""} Planted!`,
          message: `Your efforts just planted ${milestone.trees} real tree${milestone.trees > 1 ? "s" : ""} via Ecologi. Milestone: ${milestone.label}.`,
          read: false,
          createdAt: new Date().toISOString()
        });
      } else if (hasApiKey) {
        // Transient Ecologi failure — un-claim so the next run retries.
        // (Set false rather than delete to stay within the patch-merge model;
        // isReached treats a falsy key as unclaimed.)
        patch[milestone.key] = false;
      }
      // No-key dev runs: leave the claim (key stays true) — don't retry forever.
    }

    if (notifications.length > 0) {
      patch.notifications = notifications.slice(0, 20);
    }

    if (Object.keys(patch).length > 0) {
      const nextPayload = { ...payload, ...patch };
      await query(UPDATE_USER_PAYLOAD, [JSON.stringify(nextPayload), userId]);
    }
  });
}

/**
 * Process all users — called by the nightly cron job.
 */
export async function processMilestonesForAllUsers(): Promise<{ processed: number; treesPlanted: number }> {
  const result = await sql<{ id: string }>("select id from users limit 1000");
  let totalTrees = 0;

  for (const row of result.rows) {
    try {
      totalTrees += await checkAndProcessMilestones(row.id);
    } catch (error) {
      logError("Milestone processing failed", error, { userId: row.id });
    }
  }

  return { processed: result.rows.length, treesPlanted: totalTrees };
}