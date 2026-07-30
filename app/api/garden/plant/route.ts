import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { SHOP_CATALOG, SEED_CATALOG } from "@/lib/catalog";
import { resolveGardenTiles } from "@/lib/garden-config";
import type { Rarity } from "@/components/game-ui";

// Server-validated garden planting. The garden page used to write
// `garden[tileId] = { rarity, placedAt }` and decrement `plants`/`seeds` straight
// through `updateUserProfile`, so a client could plant a legendary on an empty
// tile without owning one (or forge any rarity), and the inventory decrement
// raced concurrent writes. This route owns placement: it validates the tile is
// unlocked and empty, validates the item is in the user's inventory with a
// positive count, looks the item up in the SERVER catalog (SHOP_CATALOG.plants
// or SEED_CATALOG) so rarity/name/image come from the server — never the client
// — deducts one, and writes `garden[tileId]` with a server-trusted `placedAt`.
// Everything runs in one locked transaction so it can't race harvest/buy-tile.

type PlantTile = Record<string, unknown>;

const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

const plantSchema = z.object({
  tileId: z.number().int().min(0),
  source: z.enum(["plant", "seed"]),
  itemId: z.union([z.string().min(1), z.number().int().min(1)])
});

function matchId(entry: Record<string, unknown>, itemId: string | number) {
  const entryId = entry.id ?? entry.name;
  return String(entryId) === String(itemId) || entry.name === String(itemId);
}

function plantNameFromSeed(seedName: string) {
  return String(seedName || "Mystery Plant").replace(/ Seed$/i, "").trim();
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof plantSchema>;
  try {
    parsed = plantSchema.parse(await request.json());
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

      // Tile must be unlocked and empty.
      const unlocked = resolveGardenTiles(profile);
      if (parsed.tileId >= unlocked) {
        return NextResponse.json({ error: { code: "garden/tile-locked", message: "That tile is not unlocked yet." } }, { status: 400 });
      }
      if (garden[tileKey]) {
        return NextResponse.json({ error: { code: "garden/tile-occupied", message: "That tile already has a plant." } }, { status: 400 });
      }

      const inventoryKey = parsed.source === "plant" ? "plants" : "seeds";
      const inventory = Array.isArray(profile[inventoryKey])
        ? [...(profile[inventoryKey] as Array<Record<string, unknown>>)]
        : [];

      const idx = inventory.findIndex((entry) => matchId(entry, parsed.itemId));
      if (idx < 0 || Number(inventory[idx].count ?? 0) <= 0) {
        return NextResponse.json(
          { error: { code: "garden/not-in-inventory", message: "You don't own that item." } },
          { status: 400 }
        );
      }
      const owned = inventory[idx];

      // Resolve canonical rarity/name/image from the SERVER catalog — never from
      // the client or the (still client-writable until the allowlist shrinks)
      // inventory entry. An item not in the catalog can't be planted at all.
      let canonicalName: string;
      let canonicalImage: string;
      let canonicalRarity: Rarity;
      let seedName: string | undefined;

      if (parsed.source === "plant") {
        const cat = SHOP_CATALOG.plants.find(
          (p) => String(p.id) === String(owned.id ?? parsed.itemId) || p.name === owned.name
        );
        if (!cat) {
          return NextResponse.json(
            { error: { code: "garden/unknown-item", message: "That plant is not in the catalog." } },
            { status: 400 }
          );
        }
        canonicalName = cat.name;
        canonicalImage = cat.image;
        canonicalRarity = cat.rarity;
      } else {
        const cat = SEED_CATALOG.find(
          (s) => s.id === String(owned.id ?? parsed.itemId) || s.name === owned.name
        );
        if (!cat) {
          return NextResponse.json(
            { error: { code: "garden/unknown-item", message: "That seed is not in the catalog." } },
            { status: 400 }
          );
        }
        seedName = cat.name;
        canonicalName = plantNameFromSeed(cat.name);
        canonicalImage = cat.image;
        canonicalRarity = cat.rarity;
      }

      if (!RARITIES.includes(canonicalRarity)) canonicalRarity = "common";
      const placedAt = Date.now();

      const tile: PlantTile = {
        tileId: parsed.tileId,
        source: parsed.source,
        sourceId: owned.id ?? parsed.itemId,
        plantName: canonicalName,
        plantImage: canonicalImage,
        rarity: canonicalRarity,
        placedAt
      };
      if (parsed.source === "plant") {
        tile.plantId = owned.id ?? parsed.itemId;
      } else {
        tile.seedId = owned.id ?? parsed.itemId;
        tile.seedName = seedName;
        tile.seedImage = canonicalImage;
      }

      const nextGarden = { ...garden, [tileKey]: tile };

      // Decrement (or remove) the inventory entry.
      const nextCount = Number(owned.count ?? 1) - 1;
      if (nextCount > 0) {
        inventory[idx] = { ...owned, count: nextCount };
      } else {
        inventory.splice(idx, 1);
      }

      const nextPayload = { ...profile, garden: nextGarden, [inventoryKey]: inventory };
      await query("update users set payload = $1::jsonb, updated_at = now() where id = $2", [
        JSON.stringify(nextPayload),
        session.userId
      ]);

      return NextResponse.json({
        success: true,
        tile,
        garden: nextGarden,
        [inventoryKey]: inventory
      });
    });
  } catch (error) {
    console.error("Garden plant error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}