import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedUser } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { logError } from "@/lib/logger";
import { rollChest, applyChestRewards, type ChestTier } from "@/lib/chest-rewards";

// Server-side chest opening. The collection page used to roll the reward with
// Math.random() in the browser and then write it through `updateUserProfile` —
// a client could simply claim a Legendary Egg every time. This route owns the
// RNG, the chest consumption, and the reward application.
//
// Chests are a SINK, not a source: they grant EcoPoints / seeds / eggs /
// boosters / cosmetics, never Impact (an open→Impact loop would make chests a
// farmable spine source). So this route does a direct payload write — it does
// NOT call grantImpact. Reward rolling lives in lib/chest-rewards.ts (pure,
// unit-tested); this route is the thin transactional wrapper.

const openSchema = z.object({ chestId: z.union([z.number(), z.string()]) });

const TIER_BY_NAME: Record<string, ChestTier> = {
  "wooden chest": "wooden",
  "bronze chest": "bronze",
  "silver chest": "silver",
  "golden chest": "golden"
};

export async function POST(request: Request) {
  const session = await requireVerifiedUser();
  if (session instanceof NextResponse) return session;

  let parsed: z.infer<typeof openSchema>;
  try {
    parsed = openSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    // Read → roll → consume → write inside one transaction with a row lock on
    // the user row, so a concurrent open cannot roll two reward sets against
    // one chest (lost-update / double-reward). Early 404 returns inside the
    // callback still commit (empty tx) cleanly.
    return await transaction(async (query) => {
      const userResult = await selectUserForUpdate<{ email: string; payload: Record<string, unknown> }>(
        query,
        session.userId!
      );
      if (userResult.rowCount === 0) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const profile = userResult.rows[0].payload ?? {};
      const chests = Array.isArray(profile.chests)
        ? (profile.chests as Array<Record<string, unknown>>).map((c) => ({ ...c }))
        : [];

      const chest = chests.find((c) => String(c.id) === String(parsed.chestId)) ?? null;
      if (!chest || Number(chest.count ?? 1) <= 0) {
        return NextResponse.json({ error: { code: "chests/not-owned" } }, { status: 404 });
      }

      const chestName = String(chest.name ?? "Wooden Chest");
      const tier = TIER_BY_NAME[chestName.toLowerCase()] ?? "wooden";

      // Roll 2–5 rewards server-side (pure, deterministic given the rng).
      const rewards = rollChest(tier, profile as any, Math.random);

      // Consume one of this chest.
      const nextChests = chests
        .map((c) => (String(c.id) === String(parsed.chestId) ? { ...c, count: Number(c.count ?? 1) - 1 } : c))
        .filter((c) => Number(c.count ?? 1) > 0);

      // Apply rewards to the profile (pure). Seeds/plants/eggs stack by count,
      // boosters stack by charges, cosmetic dupes refund as EP shards.
      const { profile: rewarded, summary } = applyChestRewards(profile as any, rewards);
      const nextProfile: Record<string, unknown> = { ...rewarded, chests: nextChests };

      await query(
        `insert into users (id, email, password_hash, payload)
         values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
         on conflict (id) do update
         set email = excluded.email,
             payload = excluded.payload,
             updated_at = now()`,
        [session.userId, userResult.rows[0].email, JSON.stringify(nextProfile)]
      );

      return NextResponse.json({ success: true, chestName, rewards, summary });
    });
  } catch (error) {
    logError("Chest open error", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}