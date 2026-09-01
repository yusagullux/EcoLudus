import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import {
  GARDEN_MAX_TILES,
  resolveGardenTiles,
  nextTileCost
} from "@/lib/garden-config";

// Server-validated garden tile purchase. The garden page can't just write
// `gardenTiles` through `updateUserProfile` — a client could unlock tiles for
// free or skip the cap. This route owns the price (server is the source of
// truth via nextTileCost), enforces the 16-tile cap, validates the eco
// balance, spends the eco, and increments `gardenTiles`. Buying tiles is a
// SINK (spends earned eco, grants no Impact/XP), so this is a direct payload
// write — NOT grantImpact — mirroring /api/shop/buy and /api/chests/open.
//
// Read → compute → write runs inside one transaction with a row lock
// (selectUserForUpdate) so a concurrent buy-tile cannot double-spend against a
// stale read (lost-update / double-spend class from the audit). Early 400/404
// returns inside the callback still commit (empty tx) cleanly.

export async function POST(request: Request) {
  const session = await requireVerifiedUser();
  if (session instanceof NextResponse) return session;

  // No body to parse, but accept an empty json body gracefully.
  try {
    await request.json().catch(() => null);
  } catch {
    // ignore — body is optional
  }

  try {
    return await transaction(async (query) => {
      const userResult = await selectUserForUpdate<{ email: string; payload: Record<string, unknown> }>(
        query,
        session.userId!
      );
      if (userResult.rowCount === 0) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const profile = userResult.rows[0].payload ?? {};
      const unlocked = resolveGardenTiles(profile);

      if (unlocked >= GARDEN_MAX_TILES) {
        return NextResponse.json(
          { error: { code: "garden/max-tiles", message: "You've already unlocked all 16 garden tiles." } },
          { status: 400 }
        );
      }

      const cost = nextTileCost(unlocked);
      const currentEco = Math.max(0, Number(profile.ecoPoints ?? 0) || 0);
      if (currentEco < cost) {
        return NextResponse.json(
          { error: { code: "garden/insufficient-eco", message: `Need ${cost} EcoPoints to unlock this tile; you have ${currentEco}.` } },
          { status: 400 }
        );
      }

      const nextProfile: Record<string, unknown> = {
        ...profile,
        ecoPoints: currentEco - cost,
        gardenTiles: unlocked + 1
      };

      await query(
        `insert into users (id, email, password_hash, payload)
         values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
         on conflict (id) do update
         set email = excluded.email,
             payload = excluded.payload,
             updated_at = now()`,
        [session.userId, userResult.rows[0].email, JSON.stringify(nextProfile)]
      );

      const newUnlocked = unlocked + 1;
      return NextResponse.json({
        success: true,
        gardenTiles: newUnlocked,
        ecoPoints: currentEco - cost,
        nextCost: newUnlocked >= GARDEN_MAX_TILES ? null : nextTileCost(newUnlocked)
      });
    });
  } catch (error) {
    console.error("Garden buy-tile error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}