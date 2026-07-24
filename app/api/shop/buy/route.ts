import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

// Server-validated shop purchase. The shop page used to spend EcoPoints and
// mint the plant/egg/chest straight through `updateUserProfile`, so a client
// could buy any item without paying (or "buy" an item it couldn't afford).
// This route owns the price (server is the source of truth for the catalog),
// validates the eco balance, spends the eco, and mints the item into the
// right inventory. Purchases are a SINK — they spend earned eco and grant no
// Impact / XP (no purchase→farm loop), so this is a direct payload write, NOT
// a grantImpact call (mirrors /api/chests/open).

type Rarity = "common" | "rare" | "epic" | "legendary";

type CatalogItem = {
  id: number;
  name: string;
  rarity: Rarity;
  price: number;
  image: string;
  hatchTime?: string;
  description?: string;
};

// Single source of truth for shop pricing. Mirrors the catalog in
// app/(game)/shop/page.tsx — the client only renders this; the server decides
// what each item costs. A client cannot send a cheaper price.
const CATALOG: Record<"plants" | "eggs" | "chests", CatalogItem[]> = {
  plants: [
    { id: 1, name: "Mossy Fern", rarity: "common", price: 50, image: "/images/plants/mint.png" },
    { id: 2, name: "Golden Daisy", rarity: "common", price: 60, image: "/images/plants/sunflower.png" },
    { id: 3, name: "Blue Orchid", rarity: "rare", price: 180, image: "/images/plants/orchid.png" },
    { id: 4, name: "Spotted Aloe", rarity: "rare", price: 200, image: "/images/plants/basil.png" },
    { id: 5, name: "Mystic Bamboo", rarity: "epic", price: 450, image: "/images/plants/bamboo.png" },
    { id: 6, name: "Crystal Lotus", rarity: "epic", price: 500, image: "/images/plants/lotus.png" },
    { id: 7, name: "Aurora Blossom", rarity: "legendary", price: 1200, image: "/images/plants/cherry_blossom.png" },
    { id: 8, name: "Ember Cactus", rarity: "legendary", price: 1500, image: "/images/plants/dragonfruit.png" }
  ],
  eggs: [
    { id: 1, name: "Common Egg", rarity: "common", price: 100, image: "/images/eggs/common-egg.png", hatchTime: "1h" },
    { id: 2, name: "Rare Egg", rarity: "rare", price: 300, image: "/images/eggs/rare-egg.png", hatchTime: "4h" },
    { id: 3, name: "Epic Egg", rarity: "epic", price: 700, image: "/images/eggs/epic-egg.png", hatchTime: "12h" },
    { id: 4, name: "Legendary Egg", rarity: "legendary", price: 1800, image: "/images/eggs/legendary-egg.png", hatchTime: "24h" }
  ],
  chests: [
    { id: 1, name: "Wooden Chest", rarity: "common", price: 150, image: "/images/chests/wooden-chest.png" },
    { id: 2, name: "Bronze Chest", rarity: "rare", price: 350, image: "/images/chests/bronze-chest.png" },
    { id: 3, name: "Silver Chest", rarity: "epic", price: 800, image: "/images/chests/silver-chest.png" },
    { id: 4, name: "Golden Chest", rarity: "legendary", price: 2000, image: "/images/chests/golden-chest.png" }
  ]
};

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
    const userResult = await sql<{ email: string; payload: Record<string, unknown> }>(
      "select id, email, payload from users where id = $1 limit 1",
      [session.userId]
    );
    if (userResult.rowCount === 0) {
      return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
    }

    const item = CATALOG[parsed.mode].find((entry) => entry.id === parsed.itemId) ?? null;
    if (!item) {
      return NextResponse.json({ error: { code: "shop/not-found" } }, { status: 404 });
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

    await sql(
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
  } catch (error) {
    console.error("Shop buy error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}