import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { getShopItem } from "@/lib/catalog-server";
import { logError } from "@/lib/logger";

// Server-validated shop purchase. The shop page used to spend EcoPoints and
// mint the plant/egg/chest straight through `updateUserProfile`, so a client
// could buy any item without paying (or "buy" an item it couldn't afford).
// This route owns the price (server is the source of truth for the catalog),
// validates the eco balance, spends the eco, and mints the item into the
// right inventory. Purchases are a SINK — they spend earned eco and grant no
// Impact / XP (no purchase→farm loop), so this is a direct payload write, NOT
// a grantImpact call (mirrors /api/chests/open).
//
// The catalog is loaded from `catalog_items` via lib/catalog-server — a
// client only sends `{ mode, itemId }` and the server looks up the price, so
// a client cannot send a cheaper price. Prices can be updated in the DB
// without a code deploy.

const buySchema = z.object({
  mode: z.enum(["plants", "eggs", "chests"]),
  itemId: z.number().int().min(1)
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof buySchema>;
  try {
    parsed = buySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    const item = await getShopItem(parsed.mode, parsed.itemId);
    if (!item) {
      return NextResponse.json({ error: { code: "shop/not-found" } }, { status: 404 });
    }

    // Read → compute → write inside one transaction with a row lock on the user
    // row, so a concurrent buy cannot double-grant the item against a stale read
    // (the lost-update / double-spend class from the 2026-07-25 audit). Early
    // 400/404 returns inside the callback still commit (empty tx) cleanly.
    return await transaction(async (query) => {
      const userResult = await selectUserForUpdate<{ email: string; payload: Record<string, unknown> }>(
        query,
        session.userId!
      );
      if (userResult.rowCount === 0) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const profile = userResult.rows[0].payload ?? {};
      const currentEco = Math.max(0, Number(profile.ecoPoints ?? 0) || 0);
      if (currentEco < item.price) {
        return NextResponse.json(
          { error: { code: "shop/insufficient-eco", message: `Need ${item.price} EcoPoints; you have ${currentEco}.` } },
          { status: 400 }
        );
      }

      const purchasedAt = new Date().toISOString();
      const inventoryKey = parsed.mode === "plants" ? "plants" : parsed.mode === "eggs" ? "eggs" : "chests";
      const inventory = Array.isArray(profile[inventoryKey])
        ? [...(profile[inventoryKey] as Array<Record<string, unknown>>)]
        : [];

      const idx = inventory.findIndex((entry) => {
        const entryId = entry.id ?? entry.name;
        return String(entryId) === String(item.id) || entry.name === item.name;
      });
      if (idx >= 0) {
        inventory[idx] = { ...inventory[idx], count: Number(inventory[idx].count ?? 1) + 1, purchasedAt };
      } else {
        inventory.push({ ...item, count: 1, purchasedAt });
      }

      const nextProfile: Record<string, unknown> = {
        ...profile,
        ecoPoints: currentEco - item.price,
        [inventoryKey]: inventory
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

      return NextResponse.json({
        success: true,
        itemName: item.name,
        ecoPoints: currentEco - item.price
      });
    });
  } catch (error) {
    logError("Shop buy error", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}