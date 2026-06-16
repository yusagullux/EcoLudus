import { randomUUID } from "crypto";
import { sql } from "@/lib/db";

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

async function getUserById(userId: string): Promise<UserRow | null> {
  const result = await sql<UserRow>(
    "select id, email, payload from users where id = $1 limit 1",
    [userId]
  );
  return result.rows[0] ?? null;
}

async function plantTreesViaEcologi(trees: number, userId: string, milestoneLabel: string): Promise<boolean> {
  const apiKey = process.env.ECOLOGI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("ECOLOGI_API_KEY not set — skipping tree planting for user", userId);
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
      console.error(`Ecologi API error ${response.status}: ${text}`);
      return false;
    }

    console.log(`Planted ${trees} tree(s) via Ecologi for user ${userId} — milestone: ${milestoneLabel}`);
    return true;
  } catch (error) {
    console.error("Ecologi API call failed:", error);
    return false;
  }
}

async function saveNotification(
  userId: string,
  type: string,
  title: string,
  message: string
): Promise<void> {
  const id = randomUUID();
  // Store notification in user payload (simple approach compatible with file store + PG)
  const user = await getUserById(userId);
  if (!user) return;

  const existingNotifications: unknown[] = Array.isArray(user.payload?.notifications)
    ? (user.payload.notifications as unknown[])
    : [];

  const notification = {
    id,
    type,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString()
  };

  const nextPayload = {
    ...user.payload,
    notifications: [notification, ...existingNotifications].slice(0, 20) // Keep last 20
  };

  await sql(
    `insert into users (id, email, password_hash, payload)
     values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
     on conflict (id) do update
     set email = excluded.email,
         payload = excluded.payload,
         updated_at = now()`,
    [userId, user.email, JSON.stringify(nextPayload)]
  );
}

/**
 * Check a single user's milestones and trigger tree planting if any are newly reached.
 * Returns the number of trees planted.
 */
export async function checkAndProcessMilestones(userId: string): Promise<number> {
  const user = await getUserById(userId);
  if (!user) return 0;

  const payload = user.payload;
  const level = Number(payload?.level ?? 1);
  const carbonReduced = Number(payload?.carbonReduced ?? 0);
  const missionsCompleted = Number(payload?.missionsCompleted ?? 0);

  let totalTreesPlanted = 0;
  const claimedMilestones: Record<string, boolean> = {};

  for (const milestone of MILESTONES) {
    // Already claimed
    if (payload?.[milestone.key]) continue;

    let reached = false;
    if (milestone.type === "level" && level >= milestone.value) reached = true;
    if (milestone.type === "carbon" && carbonReduced >= milestone.value) reached = true;
    if (milestone.type === "missions" && missionsCompleted >= milestone.value) reached = true;

    if (!reached) continue;

    const planted = await plantTreesViaEcologi(milestone.trees, userId, milestone.label);

    if (planted) {
      totalTreesPlanted += milestone.trees;
      claimedMilestones[milestone.key] = true;

      await saveNotification(
        userId,
        "tree_planted",
        `🌳 ${milestone.trees} Tree${milestone.trees > 1 ? "s" : ""} Planted!`,
        `Your efforts just planted ${milestone.trees} real tree${milestone.trees > 1 ? "s" : ""} via Ecologi. Milestone: ${milestone.label}.`
      );
    } else {
      // Mark as claimed even without API (no key configured) so we don't retry forever in dev
      if (!process.env.ECOLOGI_API_KEY) {
        claimedMilestones[milestone.key] = true;
      }
    }
  }

  if (Object.keys(claimedMilestones).length > 0) {
    const freshUser = await getUserById(userId);
    if (freshUser) {
      const treesPlanted = Number(freshUser.payload?.treesPlanted ?? 0) + totalTreesPlanted;
      const nextPayload = {
        ...freshUser.payload,
        treesPlanted,
        ...claimedMilestones
      };

      await sql(
        `update users
         set payload = $1::jsonb,
             updated_at = now()
         where id = $2`,
        [JSON.stringify(nextPayload), userId]
      );
    }
  }

  return totalTreesPlanted;
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
      console.error(`Milestone processing failed for user ${row.id}:`, error);
    }
  }

  return { processed: result.rows.length, treesPlanted: totalTrees };
}
