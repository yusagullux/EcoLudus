import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedUser } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { grantProgression, type ProgressionUser } from "@/lib/progression";

// Server-validated garden harvest. The garden page used to compute XP/eco from
// a tile's rarity and write it through `updateUserProfile`, which a client could
// forge (any XP/eco it wanted, on any tile, ignoring cooldowns). This route owns
// the harvest: it re-validates that each tile is bloomed AND past its 48h
// per-tile cooldown, recomputes rewards from rarity, and routes them through
// the spine. `tileIds` omitted ⇒ harvest all currently-ready tiles.

type Rarity = "common" | "rare" | "epic" | "legendary";

const GROW_DURATION: Record<Rarity, number> = {
  common: 8 * 60 * 60 * 1000,
  rare: 24 * 60 * 60 * 1000,
  epic: 72 * 60 * 60 * 1000,
  legendary: 96 * 60 * 60 * 1000
};

const HARVEST_COOLDOWN_MS = 48 * 60 * 60 * 1000;

const HARVEST_REWARDS: Record<Rarity, number> = { common: 8, rare: 22, epic: 55, legendary: 120 };
const HARVEST_XP: Record<Rarity, number> = { common: 12, rare: 30, epic: 70, legendary: 150 };

function normalizeRarity(value: unknown): Rarity {
  return (["common", "rare", "epic", "legendary"] as Rarity[]).includes(value as Rarity)
    ? (value as Rarity)
    : "common";
}

function isReady(tile: Record<string, unknown>, now: number): boolean {
  const placedAt = Number(tile.placedAt ?? now);
  const rarity = normalizeRarity(tile.rarity);
  const total = GROW_DURATION[rarity] ?? GROW_DURATION.common;
  const bloomed = now - placedAt >= total;
  if (!bloomed) return false;
  const lastHarvestAt = Number(tile.lastHarvestAt ?? 0);
  if (!lastHarvestAt) return true;
  return now - lastHarvestAt >= HARVEST_COOLDOWN_MS;
}

const harvestSchema = z.object({
  tileIds: z.array(z.number().int().min(0)).max(24).optional()
});

export async function POST(request: Request) {
  const session = await requireVerifiedUser();
  if (session instanceof NextResponse) return session;

  let parsed: z.infer<typeof harvestSchema>;
  try {
    parsed = harvestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    // Read → harvest-eval → grant inside one transaction with a row lock on the
    // user row. The per-tile `lastHarvestAt` / 48h cooldown is checked against
    // the locked row, so two concurrent harvests of the same ready tile can no
    // longer both pass `isReady` and double-grant (the lost-update class fixed
    // in the other reward routes — see the reward-routes-lost-update note).
    // grantImpact shares the lock via `tx` (no re-read, no nested transaction).
    return await transaction(async (query) => {
      const userResult = await selectUserForUpdate<ProgressionUser>(query, session.userId!);
      if (userResult.rowCount === 0) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const user = userResult.rows[0];
      const profile = user.payload ?? {};
      const garden = (profile.garden ?? {}) as Record<string, Record<string, unknown>>;
      const now = Date.now();

      // Candidate tiles: the requested ids (if given) else every occupied tile.
      const candidateIds = parsed.tileIds && parsed.tileIds.length > 0
        ? parsed.tileIds.map(String)
        : Object.keys(garden);

      const nextGarden: Record<string, Record<string, unknown>> = { ...garden };
      let totalEco = 0;
      let totalXp = 0;
      let harvested = 0;

      for (const tileIdKey of candidateIds) {
        const tile = garden[tileIdKey];
        if (!tile || !isReady(tile, now)) continue;

        const rarity = normalizeRarity(tile.rarity);
        totalEco += HARVEST_REWARDS[rarity];
        totalXp += HARVEST_XP[rarity];
        nextGarden[tileIdKey] = { ...tile, lastHarvestAt: now };
        harvested += 1;
      }

      if (harvested === 0) {
        return NextResponse.json({
          success: true,
          harvested: 0,
          eco: 0,
          xp: 0,
          message: "No plants are ready to harvest yet."
        });
      }

      const granted = await grantProgression({
        userId: session.userId,
        source: "garden",
        baseXp: totalXp,
        eco: totalEco,
        meta: { harvested, tileIds: candidateIds },
        payloadPatch: { garden: nextGarden },
        tx: { query, user }
      });

      return NextResponse.json({
        success: true,
        harvested,
        eco: totalEco,
        xp: totalXp,
        level: granted?.level ?? null,
        ecoPoints: granted?.ecoPoints ?? null
      });
    });
  } catch (error) {
    console.error("Garden harvest error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}