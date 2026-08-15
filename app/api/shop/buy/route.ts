import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { getShopItem, getDailyDeals } from "@/lib/catalog-server";
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
// without a code deploy. Daily deals are validated against the current UTC date.

const buySchema = z.object({
  mode: z.enum(["plants", "eggs", "chests", "daily"]),
  itemId: z.union([z.number(), z.string()]).optional(),
  dealId: z.string().optional()
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
    let item: { id: string | number; name: string; price: number; kind: string; image?: string } | null = null;
    
    if (parsed.mode === "daily" && parsed.dealId) {
      const deals = getDailyDeals();
      const deal = deals.find(d => d.dealId === parsed.dealId);
      if (deal) {
        item = {
          id: deal.itemId,
          name: deal.name,
          price: deal.dealPrice,
          kind: deal.kind,
          image: deal.image
        };
      }
    } else if (parsed.mode !== "daily" && parsed.itemId) {
      const shopItem = await getShopItem(parsed.mode as any, Number(parsed.itemId));
      if (shopItem) {
        item = {
          ...shopItem,
          kind: parsed.mode === "plants" ? "plant" : parsed.mode === "chests" ? "chest" : "egg"
        };
      }
    }

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
      if (currentEco < item!.price) {
        return NextResponse.json(
          { error: { code: "shop/insufficient-eco", message: `Need ${item!.price} EcoPoints; you have ${currentEco}.` } },
          { status: 400 }
        );
      }

      const purchasedAt = new Date().toISOString();
      let inventoryKey = item!.kind + "s";
      if (item!.kind === "chest") inventoryKey = "chests";
      
      let nextProfile: Record<string, unknown> = { ...profile, ecoPoints: currentEco - item!.price };

      if (item!.kind === "cosmetic") {
        const cosmetics = (profile.cosmetics as any) || { equipped: {}, owned: [] };
        if (!cosmetics.owned.some((c: any) => c.id === item!.id)) {
          cosmetics.owned.push({ id: item!.id, unlockedAt: purchasedAt });
          nextProfile.cosmetics = cosmetics;
        } else {
          return NextResponse.json({ error: { code: "shop/already-owned", message: "You already own this cosmetic." } }, { status: 400 });
        }
      } else if (item!.kind === "booster") {
        const boosters = Array.isArray(profile.boosters) ? [...profile.boosters] : [];
        const idx = boosters.findIndex((b: any) => b.id === item!.id);
        if (idx >= 0) {
          boosters[idx] = { ...boosters[idx], count: (boosters[idx].count || 1) + 1 };
        } else {
          boosters.push({ id: item!.id, count: 1 });
        }
        nextProfile.boosters = boosters;
      } else {
        const inventory = Array.isArray(profile[inventoryKey]) ? [...(profile[inventoryKey] as Array<any>)] : [];
        const idx = inventory.findIndex((entry) => {
          const entryId = entry.id ?? entry.name;
          return String(entryId) === String(item!.id) || entry.name === item!.name;
        });
        if (idx >= 0) {
          inventory[idx] = { ...inventory[idx], count: Number(inventory[idx].count ?? 1) + 1, purchasedAt };
        } else {
          inventory.push({ ...item, count: 1, purchasedAt });
        }
        nextProfile[inventoryKey] = inventory;
      }

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