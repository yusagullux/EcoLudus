// Server-side catalog accessors. The live catalog lives in Postgres
// (`catalog_items`, `team_mission_templates`); in local-dev file mode the
// `fileSql` branches in `lib/db.ts` serve the seeded rows from the file store.
//
// Both the buy/assign *routes* and the read-only *catalog routes* go through
// here, so a client can never supply a price or xp/eco value the server
// doesn't validate — the server always looks the item up by id.

import { sql } from "@/lib/db";
import {
  PET_CATALOG,
  SEED_CATALOG,
  type ShopItem,
  type ShopMode,
  type TeamMissionTemplate,
  type PetSpecies,
  type SeedSpecies
} from "@/lib/catalog";
import type { Rarity } from "@/components/game-ui";

type ShopRow = {
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

function rowToShopItem(row: ShopRow): ShopItem {
  return {
    id: row.item_id,
    name: row.name,
    rarity: row.rarity,
    price: Number(row.price),
    image: row.image,
    ...(row.hatch_time ? { hatchTime: row.hatch_time } : null),
    ...(row.description ? { description: row.description } : null)
  };
}

type TeamTemplateRow = {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: "Easy" | "Medium" | "Hard";
  xp: number;
  eco: number;
  needed: number;
  sort_order: number;
};

function rowToTeamTemplate(row: TeamTemplateRow): TeamMissionTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    difficulty: row.difficulty,
    xp: Number(row.xp),
    eco: Number(row.eco),
    needed: Number(row.needed)
  };
}

const SHOP_COLUMNS =
  "mode, item_id, name, rarity, price, image, hatch_time, description, sort_order";

// Returns the full catalog grouped by mode. The shop page renders from this;
// prices here are display-only (the buy route re-validates by id).
export async function getShopCatalog(): Promise<Record<ShopMode, ShopItem[]>> {
  const result = await sql<ShopRow>(
    `select ${SHOP_COLUMNS} from catalog_items order by mode, sort_order, item_id`
  );
  const grouped: Record<ShopMode, ShopItem[]> = { plants: [], eggs: [], chests: [] };
  for (const row of result.rows) {
    if (row.mode === "plants" || row.mode === "eggs" || row.mode === "chests") {
      grouped[row.mode].push(rowToShopItem(row));
    }
  }
  return grouped;
}

import { getDailyShopItems, type DailyDealItem } from "@/lib/catalog";

export function getDailyDeals(): DailyDealItem[] {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD in UTC
  return getDailyShopItems(today);
}

// Single-item lookup used by /api/shop/buy — the server is the source of truth
// for the price; the client only sends `{ mode, itemId }`.
export async function getShopItem(
  mode: ShopMode,
  itemId: number
): Promise<ShopItem | null> {
  const result = await sql<ShopRow>(
    `select ${SHOP_COLUMNS} from catalog_items where mode = $1 and item_id = $2 limit 1`,
    [mode, itemId]
  );
  const row = result.rows[0];
  return row ? rowToShopItem(row) : null;
}

// All team mission templates, ordered for display. The team page renders from
// this; xp/eco/needed shown are display-only (the assign route re-validates).
export async function getTeamMissionTemplates(): Promise<TeamMissionTemplate[]> {
  const result = await sql<TeamTemplateRow>(
    "select id, title, description, icon, difficulty, xp, eco, needed, sort_order from team_mission_templates order by sort_order"
  );
  return result.rows.map(rowToTeamTemplate);
}

// Single-template lookup used by /api/teams `assign` — the server is the
// source of truth for xp/eco/needed/title/icon. A client cannot start a team
// mission with inflated rewards, because the server ignores the client's
// values and uses this row.
export async function getTeamMissionTemplate(
  id: string
): Promise<TeamMissionTemplate | null> {
  const result = await sql<TeamTemplateRow>(
    "select id, title, description, icon, difficulty, xp, eco, needed, sort_order from team_mission_templates where id = $1 limit 1",
    [id]
  );
  const row = result.rows[0];
  return row ? rowToTeamTemplate(row) : null;
}

// Pets and seeds have no DB table (no runtime-editable values) — the catalog
// *is* the constant. Returned through accessors so the read API and the page
// share one source with the hatch/chest routes, no client-side drift.
export function getPetCatalog(): PetSpecies[] {
  return PET_CATALOG;
}

export function getSeedCatalog(): SeedSpecies[] {
  return SEED_CATALOG;
}