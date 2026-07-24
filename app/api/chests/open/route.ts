import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

// Server-side chest opening. The collection page used to roll the reward with
// Math.random() in the browser and then write it through `updateUserProfile` —
// a client could simply claim a Legendary Egg every time. This route owns the
// RNG and the chest consumption.
//
// Chests are a SINK, not a source: they grant EcoPoints / seeds / eggs, never
// Impact or XP (an open→Impact loop would make chests a farmable spine source).
// So this route does a direct payload write — it does NOT call grantImpact.

type Rarity = "common" | "rare" | "epic" | "legendary";

type ChestReward = {
  type: "points" | "seed" | "egg";
  name: string;
  amount?: number;
  rarity: Rarity;
  image: string;
  seedName: string;
};

const OPEN_CHEST_REWARDS: Record<string, () => ChestReward> = {
  "Wooden Chest": () => {
    if (Math.random() < 0.55) {
      const amount = Math.floor(Math.random() * 151) + 100;
      return { type: "points", name: "EcoPoints", amount, rarity: "common", image: "/images/logo.png", seedName: "" };
    }
    const seedPool = [
      { seedName: "Mossy Fern Seed", rarity: "common" as Rarity, image: "/images/plants/mint.png" },
      { seedName: "Golden Daisy Seed", rarity: "common" as Rarity, image: "/images/plants/sunflower.png" }
    ];
    const seed = seedPool[Math.floor(Math.random() * seedPool.length)];
    return { type: "seed", name: seed.seedName, seedName: seed.seedName, rarity: seed.rarity, image: seed.image };
  },
  "Bronze Chest": () => {
    const rand = Math.random();
    if (rand < 0.45) {
      const amount = Math.floor(Math.random() * 301) + 200;
      return { type: "points", name: "EcoPoints", amount, rarity: "rare", image: "/images/logo.png", seedName: "" };
    }
    if (rand < 0.8) {
      const seedPool = [
        { seedName: "Mossy Fern Seed", rarity: "common" as Rarity, image: "/images/plants/mint.png" },
        { seedName: "Golden Daisy Seed", rarity: "common" as Rarity, image: "/images/plants/sunflower.png" },
        { seedName: "Blue Orchid Seed", rarity: "rare" as Rarity, image: "/images/plants/orchid.png" },
        { seedName: "Spotted Aloe Seed", rarity: "rare" as Rarity, image: "/images/plants/basil.png" }
      ];
      const seed = seedPool[Math.floor(Math.random() * seedPool.length)];
      return { type: "seed", name: seed.seedName, seedName: seed.seedName, rarity: seed.rarity, image: seed.image };
    }
    return { type: "egg", name: "Common Egg", seedName: "", rarity: "common", image: "/images/eggs/common-egg.png" };
  },
  "Silver Chest": () => {
    const rand = Math.random();
    if (rand < 0.35) {
      const amount = Math.floor(Math.random() * 501) + 500;
      return { type: "points", name: "EcoPoints", amount, rarity: "epic", image: "/images/logo.png", seedName: "" };
    }
    if (rand < 0.75) {
      const seedPool = [
        { seedName: "Blue Orchid Seed", rarity: "rare" as Rarity, image: "/images/plants/orchid.png" },
        { seedName: "Spotted Aloe Seed", rarity: "rare" as Rarity, image: "/images/plants/basil.png" },
        { seedName: "Mystic Bamboo Seed", rarity: "epic" as Rarity, image: "/images/plants/bamboo.png" },
        { seedName: "Crystal Lotus Seed", rarity: "epic" as Rarity, image: "/images/plants/lotus.png" }
      ];
      const seed = seedPool[Math.floor(Math.random() * seedPool.length)];
      return { type: "seed", name: seed.seedName, seedName: seed.seedName, rarity: seed.rarity, image: seed.image };
    }
    const eggPool = [
      { name: "Rare Egg", rarity: "rare" as Rarity, image: "/images/eggs/rare-egg.png" },
      { name: "Epic Egg", rarity: "epic" as Rarity, image: "/images/eggs/epic-egg.png" }
    ];
    const e = eggPool[Math.floor(Math.random() * eggPool.length)];
    return { type: "egg", name: e.name, seedName: "", rarity: e.rarity, image: e.image };
  },
  "Golden Chest": () => {
    const rand = Math.random();
    if (rand < 0.25) {
      const amount = Math.floor(Math.random() * 1501) + 1000;
      return { type: "points", name: "EcoPoints", amount, rarity: "legendary", image: "/images/logo.png", seedName: "" };
    }
    if (rand < 0.65) {
      const seedPool = [
        { seedName: "Mystic Bamboo Seed", rarity: "epic" as Rarity, image: "/images/plants/bamboo.png" },
        { seedName: "Crystal Lotus Seed", rarity: "epic" as Rarity, image: "/images/plants/lotus.png" },
        { seedName: "Aurora Blossom Seed", rarity: "legendary" as Rarity, image: "/images/plants/cherry_blossom.png" },
        { seedName: "Ember Cactus Seed", rarity: "legendary" as Rarity, image: "/images/plants/dragonfruit.png" }
      ];
      const seed = seedPool[Math.floor(Math.random() * seedPool.length)];
      return { type: "seed", name: seed.seedName, seedName: seed.seedName, rarity: seed.rarity, image: seed.image };
    }
    const eggPool = [
      { name: "Epic Egg", rarity: "epic" as Rarity, image: "/images/eggs/epic-egg.png" },
      { name: "Legendary Egg", rarity: "legendary" as Rarity, image: "/images/eggs/legendary-egg.png" }
    ];
    const e = eggPool[Math.floor(Math.random() * eggPool.length)];
    return { type: "egg", name: e.name, seedName: "", rarity: e.rarity, image: e.image };
  }
};

const openSchema = z.object({ chestId: z.union([z.string(), z.number()]) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

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
    const userResult = await sql<{ email: string; payload: Record<string, unknown> }>(
      "select id, email, payload from users where id = $1 limit 1",
      [session.userId]
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
    const generator = OPEN_CHEST_REWARDS[chestName] ?? OPEN_CHEST_REWARDS["Wooden Chest"];
    const reward = generator();

    // Consume one chest.
    const nextChests = chests
      .map((c) => (String(c.id) === String(parsed.chestId) ? { ...c, count: Number(c.count ?? 1) - 1 } : c))
      .filter((c) => Number(c.count ?? 1) > 0);

    const nextProfile: Record<string, unknown> = { ...profile, chests: nextChests };

    if (reward.type === "points") {
      nextProfile.ecoPoints = Math.max(0, Number(profile.ecoPoints ?? 0) || 0) + Number(reward.amount ?? 0);
    } else if (reward.type === "seed") {
      const seeds = Array.isArray(profile.seeds) ? [...(profile.seeds as Array<Record<string, unknown>>)] : [];
      const idx = seeds.findIndex((s) => s.name === reward.seedName);
      if (idx >= 0) {
        seeds[idx] = { ...seeds[idx], count: Number(seeds[idx].count ?? 1) + 1, obtainedAt: new Date().toISOString() };
      } else {
        seeds.push({
          id: `seed-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          name: reward.seedName,
          rarity: reward.rarity,
          image: reward.image,
          count: 1,
          obtainedAt: new Date().toISOString()
        });
      }
      nextProfile.seeds = seeds;
    } else {
      const eggs = Array.isArray(profile.eggs) ? [...(profile.eggs as Array<Record<string, unknown>>)] : [];
      const idx = eggs.findIndex((e) => e.name === reward.name);
      if (idx >= 0) {
        eggs[idx] = { ...eggs[idx], count: Number(eggs[idx].count ?? 1) + 1, purchasedAt: new Date().toISOString() };
      } else {
        eggs.push({ id: Date.now(), name: reward.name, rarity: reward.rarity, price: 0, image: reward.image, count: 1, purchasedAt: new Date().toISOString() });
      }
      nextProfile.eggs = eggs;
    }

    await sql(
      `insert into users (id, email, password_hash, payload)
       values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
       on conflict (id) do update
       set email = excluded.email,
           payload = excluded.payload,
           updated_at = now()`,
      [session.userId, userResult.rows[0].email, JSON.stringify(nextProfile)]
    );

    return NextResponse.json({ success: true, reward, chestName });
  } catch (error) {
    console.error("Chest open error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}