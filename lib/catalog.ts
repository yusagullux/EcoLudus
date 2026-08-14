// Shared catalog types + seed data.
//
// This module is the single source of truth for the *seed* contents of the
// shop and team-mission catalogs. It has NO runtime dependencies (no `sql`,
// no React) so it can be imported by:
//   - `lib/db.ts`        (to seed the file-fallback store in EMPTY_STORE)
//   - `lib/catalog-server.ts` (server accessors that read the live DB)
//   - `app/api/catalog/*/route.ts` (response shapes)
//
// At runtime the live catalog lives in Postgres `catalog_items` /
// `team_mission_templates` (seeded idempotently by `ensureMigrations` from a
// SQL literal that mirrors these constants — see `lib/db.ts` and
// `db/migrations/006_catalogs.sql`). Editing a price in the DB after seeding
// takes effect with no code deploy; editing the *seed* here only affects new
// databases and the file fallback. The client never sends a price — the
// server looks the item up by `(mode, itemId)` and is the source of truth.

import type { Rarity } from "@/components/game-ui";

export type ShopMode = "plants" | "eggs" | "chests";

export type ShopItem = {
  id: number;
  name: string;
  rarity: Rarity;
  price: number;
  image: string;
  hatchTime?: string;
  description?: string;
};

export type TeamMissionTemplate = {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: "Easy" | "Medium" | "Hard";
  xp: number;
  eco: number;
  needed: number;
};

// Grouped shop catalog. Order within each mode is the display order.
export const SHOP_CATALOG: Record<ShopMode, ShopItem[]> = {
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
    { id: 1, name: "Wooden Chest", rarity: "common", price: 150, image: "/images/chests/wooden-chest.png", description: "Contains EcoCoins or Common Plants!" },
    { id: 2, name: "Bronze Chest", rarity: "rare", price: 350, image: "/images/chests/bronze-chest.png", description: "Contains EcoCoins, Rare Plants, or Common Eggs!" },
    { id: 3, name: "Silver Chest", rarity: "epic", price: 800, image: "/images/chests/silver-chest.png", description: "Contains a large amount of EcoCoins, Epic Plants, or Eggs!" },
    { id: 4, name: "Golden Chest", rarity: "legendary", price: 2000, image: "/images/chests/golden-chest.png", description: "Contains massive EcoCoins, Legendary Plants, or Eggs!" }
  ]
};

// Team mission templates. t1–t9 are the default set; t10–t13 are the
// "expanded" set the team page reveals after the first three missions.
export const TEAM_MISSION_TEMPLATES: TeamMissionTemplate[] = [
  { id: "t1", title: "Recycle 15 Plastic Bottles", description: "Split the work and recycle at least 15 plastic bottles as a team.", icon: "♻️", difficulty: "Easy", xp: 240, eco: 140, needed: 3 },
  { id: "t2", title: "Clean One Shared Area", description: "Pick a park block or stairwell and leave it visibly better.", icon: "🧹", difficulty: "Easy", xp: 260, eco: 160, needed: 3 },
  { id: "t3", title: "Commute Sustainably", description: "At least 3 teammates bike, walk or take transit instead of a car.", icon: "🚶", difficulty: "Medium", xp: 300, eco: 180, needed: 3 },
  { id: "t4", title: "Save 50 Liters of Water", description: "Collectively save about 50 liters through shorter showers.", icon: "💧", difficulty: "Medium", xp: 320, eco: 190, needed: 3 },
  { id: "t5", title: "Night Power Down", description: "Unplug unused chargers/devices across at least 3 households.", icon: "🔌", difficulty: "Easy", xp: 220, eco: 130, needed: 2 },
  { id: "t6", title: "Plant or Care for 3 Greens", description: "Plant seeds or tend to three different plants as a joint effort.", icon: "🌱", difficulty: "Easy", xp: 210, eco: 120, needed: 3 },
  { id: "t7", title: "Zero-Waste Group Feast", description: "Organize a group meal where all food ingredients are package-free and zero waste is generated.", icon: "🍽️", difficulty: "Hard", xp: 500, eco: 300, needed: 4 },
  { id: "t8", title: "Plastic Cleanup Blitz", description: "Do a neighborhood walk together and clean up 50 items of plastic waste.", icon: "🚯", difficulty: "Medium", xp: 380, eco: 220, needed: 3 },
  { id: "t9", title: "Community Energy Audit", description: "Inspect and log energy usage parameters in your homes to identify major power-draining sources.", icon: "📊", difficulty: "Hard", xp: 550, eco: 340, needed: 4 },
  { id: "t10", title: "Shared Compost Starter", description: "Set up or refresh a shared compost bin and have teammates add approved food scraps.", icon: "CP", difficulty: "Medium", xp: 420, eco: 250, needed: 3 },
  { id: "t11", title: "Reusable Kit Relay", description: "Each teammate prepares a reusable bottle, bag, and container kit for the week.", icon: "RK", difficulty: "Easy", xp: 280, eco: 170, needed: 3 },
  { id: "t12", title: "Tree Care Patrol", description: "Water, mulch, or clean around nearby trees and document care from multiple teammates.", icon: "TC", difficulty: "Medium", xp: 460, eco: 280, needed: 4 },
  { id: "t13", title: "Repair Circle", description: "Work together to repair clothes, gear, or household items instead of replacing them.", icon: "RC", difficulty: "Hard", xp: 600, eco: 380, needed: 4 }
];

// Flattened shop rows used to seed the file-fallback store and to keep the
// migration SQL in sync by reference (the SQL literal itself mirrors this).
export type ShopSeedRow = {
  mode: ShopMode;
  item_id: number;
  name: string;
  rarity: Rarity;
  price: number;
  image: string;
  hatch_time: string | null;
  description: string | null;
  sort_order: number;
};

export const SHOP_SEED_ROWS: ShopSeedRow[] = (Object.keys(SHOP_CATALOG) as ShopMode[]).flatMap((mode) =>
  SHOP_CATALOG[mode].map((item, index) => ({
    mode,
    item_id: item.id,
    name: item.name,
    rarity: item.rarity,
    price: item.price,
    image: item.image,
    hatch_time: item.hatchTime ?? null,
    description: item.description ?? null,
    sort_order: index
  }))
);

// ── Pets + seeds: shared species catalogs ─────────────────────────────────
//
// Unlike the shop catalog, pets and seeds have no runtime-editable values
// (no prices), so they live as TS constants rather than DB tables — the hatch
// route (`app/api/eggs/incubate`) and the chest route (`app/api/chests/open`)
// import these instead of hardcoding their pools, and the collection page
// reads them via `GET /api/catalog/species`. One source, no client drift.

export type PetSpecies = {
  id: string;
  name: string;
  rarity: Rarity;
  image: string;
};

export type SeedSpecies = {
  id: string;
  name: string;
  rarity: Rarity;
  image: string;
};

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// The 13 companion animals the hatch route rolls from, grouped by the egg
// rarity that hatches them. This is the single source of truth — the hatch
// route builds its per-rarity pool from this flat list.
export const PET_CATALOG: PetSpecies[] = [
  { id: "cat", name: "Cat", rarity: "common", image: "/images/pets/cat.png" },
  { id: "dog", name: "Dog", rarity: "common", image: "/images/pets/dog.png" },
  { id: "rabbit", name: "Rabbit", rarity: "common", image: "/images/pets/rabbit.png" },
  { id: "bee", name: "Bee", rarity: "common", image: "/images/pets/bee.png" },
  { id: "deer", name: "Deer", rarity: "rare", image: "/images/pets/deer.png" },
  { id: "owl", name: "Owl", rarity: "rare", image: "/images/pets/owl.png" },
  { id: "panda", name: "Panda", rarity: "rare", image: "/images/pets/panda.png" },
  { id: "wolf", name: "Wolf", rarity: "epic", image: "/images/pets/wolf.png" },
  { id: "bear", name: "Bear", rarity: "epic", image: "/images/pets/bear.png" },
  { id: "eagle", name: "Eagle", rarity: "epic", image: "/images/pets/eagle.png" },
  { id: "tiger", name: "Tiger", rarity: "legendary", image: "/images/pets/tiger.png" },
  { id: "lion", name: "Lion", rarity: "legendary", image: "/images/pets/lion.png" },
  { id: "dragon", name: "Dragon", rarity: "legendary", image: "/images/pets/dragon.png" }
];

// The 8 seed varieties the chest route can drop. Names mirror the shop plants
// with a " Seed" suffix. The chest route's per-tier pools are subsets of this
// list (filtered by name), so the rolling behavior is preserved.
export const SEED_CATALOG: SeedSpecies[] = [
  { id: slug("Mossy Fern Seed"), name: "Mossy Fern Seed", rarity: "common", image: "/images/plants/mint.png" },
  { id: slug("Golden Daisy Seed"), name: "Golden Daisy Seed", rarity: "common", image: "/images/plants/sunflower.png" },
  { id: slug("Blue Orchid Seed"), name: "Blue Orchid Seed", rarity: "rare", image: "/images/plants/orchid.png" },
  { id: slug("Spotted Aloe Seed"), name: "Spotted Aloe Seed", rarity: "rare", image: "/images/plants/basil.png" },
  { id: slug("Mystic Bamboo Seed"), name: "Mystic Bamboo Seed", rarity: "epic", image: "/images/plants/bamboo.png" },
  { id: slug("Crystal Lotus Seed"), name: "Crystal Lotus Seed", rarity: "epic", image: "/images/plants/lotus.png" },
  { id: slug("Aurora Blossom Seed"), name: "Aurora Blossom Seed", rarity: "legendary", image: "/images/plants/cherry_blossom.png" },
  { id: slug("Ember Cactus Seed"), name: "Ember Cactus Seed", rarity: "legendary", image: "/images/plants/dragonfruit.png" }
];

// ── Boosters + cosmetics: catalog constants ────────────────────────────────
//
// Like pets/seeds, boosters and cosmetics have no runtime-editable values
// (no prices), so they live as TS constants — no DB seed, no fileSql branch.
// The chest route rolls from these; the collection page renders them.

export type BoosterDef = {
  id: string;
  kind: "xp" | "eco";
  multiplier: number;
  charges: number;
  name: string;
  rarity: Rarity;
  emoji: string;
};

export const BOOSTER_CATALOG: BoosterDef[] = [
  { id: "booster-xp-2", kind: "xp", multiplier: 2, charges: 3, name: "XP Sprout Booster", rarity: "rare", emoji: "🌱" },
  { id: "booster-xp-3", kind: "xp", multiplier: 3, charges: 2, name: "XP Bloom Booster", rarity: "epic", emoji: "🌸" },
  { id: "booster-eco-2", kind: "eco", multiplier: 2, charges: 3, name: "Eco Sprout Booster", rarity: "rare", emoji: "💧" },
  { id: "booster-eco-3", kind: "eco", multiplier: 3, charges: 2, name: "Eco Bloom Booster", rarity: "epic", emoji: "✨" }
];

export type CosmeticDef = {
  id: string;
  slot: "frame" | "background";
  name: string;
  rarity: Rarity;
  frame?: { ring: string; shadow?: string };
  background?: { gradient: string };
};

export const COSMETIC_CATALOG: CosmeticDef[] = [
  // Frames — ring + glow overlay on the avatar
  { id: "frame-leaf", slot: "frame", name: "Leaf Frame", rarity: "uncommon", frame: { ring: "2px solid #4ade80", shadow: "0 0 8px #4ade80" } },
  { id: "frame-silver", slot: "frame", name: "Silver Frame", rarity: "rare", frame: { ring: "2px solid #cbd5e1", shadow: "0 0 10px #cbd5e1" } },
  { id: "frame-gold", slot: "frame", name: "Gold Frame", rarity: "epic", frame: { ring: "3px solid #fbbf24", shadow: "0 0 14px #fbbf24" } },
  { id: "frame-prism", slot: "frame", name: "Prism Frame", rarity: "legendary", frame: { ring: "3px solid #c084fc", shadow: "0 0 18px #c084fc" } },
  // Backgrounds — positioned gradient layer behind the avatar
  { id: "bg-meadow", slot: "background", name: "Meadow Backdrop", rarity: "uncommon", background: { gradient: "linear-gradient(135deg, #86efac, #fde68a)" } },
  { id: "bg-sunset", slot: "background", name: "Sunset Backdrop", rarity: "rare", background: { gradient: "linear-gradient(135deg, #fca5a5, #fcd34d)" } },
  { id: "bg-aurora", slot: "background", name: "Aurora Backdrop", rarity: "epic", background: { gradient: "linear-gradient(135deg, #a5b4fc, #c4b5fd, #f0abfc)" } },
  { id: "bg-cosmos", slot: "background", name: "Cosmos Backdrop", rarity: "legendary", background: { gradient: "linear-gradient(135deg, #1e1b4b, #6d28d9, #db2777)" } }
];