import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { PET_CATALOG, SEED_CATALOG } from "@/lib/catalog";

// Locks the contract between the shared species catalogs (lib/catalog.ts) and
// the routes that roll from them:
//   - the egg-hatch route rolls pets from PET_CATALOG grouped by rarity
//   - the chest route rolls seeds from per-tier subsets of SEED_CATALOG
//
// A future edit can't silently desync the route pools from the Pokédex (which
// reads PET_CATALOG / SEED_CATALOG through /api/catalog/species) without
// breaking one of these assertions. See CLAUDE.md "Catalogs".

const incubateSource = readFileSync(
  path.join(process.cwd(), "app", "api", "eggs", "incubate", "route.ts"),
  "utf8"
);
const chestSource = readFileSync(
  path.join(process.cwd(), "lib", "chest-rewards.ts"),
  "utf8"
);

describe("species catalog contract", () => {
  it("PET_CATALOG covers exactly the 13 companion species across 4 rarities", () => {
    expect(PET_CATALOG.length).toBe(13);
    const byRarity = (r: string) => PET_CATALOG.filter((p) => p.rarity === r).length;
    expect(byRarity("common")).toBe(4);
    expect(byRarity("rare")).toBe(3);
    expect(byRarity("epic")).toBe(3);
    expect(byRarity("legendary")).toBe(3);
  });

  it("SEED_CATALOG covers exactly the 8 seed varieties", () => {
    expect(SEED_CATALOG.length).toBe(8);
    expect(SEED_CATALOG.map((s) => s.name)).toEqual([
      "Mossy Fern Seed",
      "Golden Daisy Seed",
      "Blue Orchid Seed",
      "Spotted Aloe Seed",
      "Mystic Bamboo Seed",
      "Crystal Lotus Seed",
      "Aurora Blossom Seed",
      "Ember Cactus Seed"
    ]);
  });

  it("the hatch route imports PET_CATALOG (no inline animal pool)", () => {
    // The route must source its per-rarity pool from the shared catalog, not a
    // hardcoded inline list — otherwise the Pokédex and the hatch drops drift.
    expect(incubateSource).toContain("PET_CATALOG");
    expect(incubateSource).not.toMatch(/const\s+animalRewards\s*=\s*\{/);
    // Sanity: the route still builds the per-rarity pools by filtering.
    expect(incubateSource).toMatch(/PET_CATALOG\.filter\(\s*\(p\)\s*=>\s*p\.rarity\s*===/);
  });

  it("the chest rewards lib imports SEED_CATALOG and filters it by rarity", () => {
    expect(chestSource).toContain("SEED_CATALOG");
    expect(chestSource).not.toMatch(/const\s+seedPool\s*=\s*\[/);
    expect(chestSource).toMatch(/poolByRarity\(\s*SEED_CATALOG\s*,\s*rarity\s*\)/);
  });
});