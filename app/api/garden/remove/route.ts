import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedUser } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { SHOP_CATALOG, SEED_CATALOG } from "@/lib/catalog";
import type { Rarity } from "@/components/game-ui";

// Server-validated garden removal. The garden page used to delete the tile and
// re-add the item to `plants`/`seeds` client-side through `updateUserProfile` —
// a full-payload overwrite that raced concurrent harvest/buy writes (you could
// end up with the item back AND the tile still placed, or clobber a concurrent
// grant), and the client could forge what got returned. This route owns removal:
// it removes the tile and re-adds ONE of the item to inventory under a row lock,
// resolving the item's rarity/name/image from the SERVER catalog. Atomic with
// harvest/buy-tile/plant.

type PlantTile = Record<string, unknown>;

const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

const removeSchema = z.object({
  tileId: z.number().int().min(0)
});

function matchId(entry: Record<string, unknown>, id: string | number, name?: string) {
  const entryId = entry.id ?? entry.name;
  return String(entryId) === String(id) || (name != null && entry.name === name);
}

function plantNameFromSeed(seedName: string) {
  return String(seedName || "Mystery Plant").replace(/ Seed$/i, "").trim();
}

export async function POST(request: Request) {
  const session = await requireVerifiedUser();
  if (session instanceof NextResponse) return session;

  let parsed: z.infer<typeof removeSchema>;
  try {
    parsed = removeSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    return await transaction(async (query) => {
      const result = await selectUserForUpdate<{ payload: Record<string, unknown> }>(query, session.userId!);
      const locked = result.rows[0];
      if (!locked) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const profile = locked.payload ?? {};
      const garden = (profile.garden ?? {}) as Record<string, PlantTile>;
      const tileKey = String(parsed.tileId);
      const tile = garden[tileKey];
      if (!tile) {
        return NextResponse.json({ error: { code: "garden/empty-tile", message: "Nothing is planted there." } }, { status: 400 });
      }

      const source = (tile.source as string | undefined) ?? (tile.seedId || tile.seedName ? "seed" : "plant");
      const inventoryKey = source === "seed" ? "seeds" : "plants";
      const inventory = Array.isArray(profile[inventoryKey])
        ? [...(profile[inventoryKey] as Array<Record<string, unknown>>)]
        : [];

      // Resolve the canonical catalog entry for the item that was on the tile, so
      // the returned inventory row has server-trusted rarity/name/image.
      let returnName: string;
      let returnImage: string;
      let returnRarity: Rarity;
      let returnId: string | number;

      if (source === "seed") {
        const seedId = (tile.seedId ?? tile.sourceId ?? tile.seedName) as string | number;
        const seedName = (tile.seedName as string | undefined) ?? `${tile.plantName ?? "Mystery"} Seed`;
        const cat =
          SEED_CATALOG.find((s) => s.id === String(seedId) || s.name === seedName) ??
          SEED_CATALOG.find((s) => plantNameFromSeed(s.name) === (tile.plantName as string | undefined));
        returnId = cat?.id ?? seedId;
        returnName = cat?.name ?? seedName;
        returnImage = cat?.image ?? (tile.seedImage as string) ?? (tile.plantImage as string) ?? "";
        returnRarity = (cat?.rarity as Rarity) ?? (tile.rarity as Rarity) ?? "common";
      } else {
        const plantId = (tile.plantId ?? tile.sourceId ?? tile.plantName) as string | number;
        const cat =
          SHOP_CATALOG.plants.find((p) => String(p.id) === String(plantId)) ??
          SHOP_CATALOG.plants.find((p) => p.name === tile.plantName);
        returnId = cat?.id ?? plantId;
        returnName = cat?.name ?? (tile.plantName as string) ?? "Mystery Plant";
        returnImage = cat?.image ?? (tile.plantImage as string) ?? "";
        returnRarity = (cat?.rarity as Rarity) ?? (tile.rarity as Rarity) ?? "common";
      }

      if (!RARITIES.includes(returnRarity)) returnRarity = "common";

      // Re-add one to inventory (stack if already present).
      const idx = inventory.findIndex((entry) => matchId(entry, returnId, returnName));
      if (idx >= 0) {
        inventory[idx] = { ...inventory[idx], count: Number(inventory[idx].count ?? 1) + 1 };
      } else {
        inventory.push({ id: returnId, name: returnName, rarity: returnRarity, image: returnImage, count: 1 });
      }

      // Remove the tile.
      const nextGarden = { ...garden };
      delete nextGarden[tileKey];

      const nextPayload = { ...profile, garden: nextGarden, [inventoryKey]: inventory };
      await query("update users set payload = $1::jsonb, updated_at = now() where id = $2", [
        JSON.stringify(nextPayload),
        session.userId
      ]);

      return NextResponse.json({
        success: true,
        garden: nextGarden,
        [inventoryKey]: inventory,
        returned: { id: returnId, name: returnName, rarity: returnRarity }
      });
    });
  } catch (error) {
    console.error("Garden remove error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}