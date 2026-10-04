// Garden tile economy — shared by the garden page, the dashboard's readiness
// teaser, and the server-validated /api/garden routes so the client and server
// always agree on the unlocked-tile count, the price of the next tile, grow
// times, and harvest rewards.

import type { Rarity } from "@/components/game-ui";

export const GARDEN_START_TILES = 4;
export const GARDEN_MAX_TILES = 16;

// Time from planting to first bloom, per rarity. One home — the garden page
// timers, the dashboard "plots ready" teaser, and the harvest route's
// isReady() check all read this map, so they can never drift apart.
export const GROW_DURATION: Record<Rarity, number> = {
  common: 8 * 60 * 60 * 1000,
  uncommon: 14 * 60 * 60 * 1000,
  rare: 24 * 60 * 60 * 1000,
  epic: 72 * 60 * 60 * 1000,
  legendary: 96 * 60 * 60 * 1000
};

// How long a bloomed plant must wait between harvests.
export const HARVEST_COOLDOWN_MS = 48 * 60 * 60 * 1000;

// EcoPoints granted per harvest, by rarity. Displayed by the garden page and
// enforced by /api/garden/harvest (which adds the server-only XP table).
export const HARVEST_REWARDS: Record<Rarity, number> = {
  common: 8,
  uncommon: 14,
  rare: 22,
  epic: 55,
  legendary: 120
};

// Increasing cost per tile: the first extra tile (the 5th) costs the base,
// and each subsequent tile costs `step` more. So tiles 5→16 cost
// 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600 EcoPoints.
export const GARDEN_TILE_BASE_COST = 50;
export const GARDEN_TILE_COST_STEP = 50;

// Resolve how many tiles a user has unlocked. If `gardenTiles` is already
// persisted and in range, trust it. Otherwise derive a sensible default that
// never orphans plants a user already placed: at least the start count, at
// least one past the highest occupied tile id, and never above the max.
export function resolveGardenTiles(profile: any): number {
  const stored = Number(profile?.gardenTiles);
  if (Number.isFinite(stored) && stored >= GARDEN_START_TILES && stored <= GARDEN_MAX_TILES) {
    return Math.floor(stored);
  }

  const garden = (profile?.garden ?? {}) as Record<string, unknown>;
  const ids = Object.keys(garden)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 0 && n < GARDEN_MAX_TILES);
  const highest = ids.length ? Math.max(...ids) : -1;

  const needed = Math.max(GARDEN_START_TILES, highest + 1);
  return Math.min(GARDEN_MAX_TILES, needed);
}

// Cost to unlock the next tile given the current unlocked count.
export function nextTileCost(unlocked: number): number {
  const steps = Math.max(0, unlocked - GARDEN_START_TILES);
  return GARDEN_TILE_BASE_COST + steps * GARDEN_TILE_COST_STEP;
}