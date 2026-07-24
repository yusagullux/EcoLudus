// Garden tile economy — shared by the garden page and the server-validated
// /api/garden/buy-tile route so the client and server always agree on the
// unlocked-tile count and the price of the next tile.

export const GARDEN_START_TILES = 4;
export const GARDEN_MAX_TILES = 16;

// Increasing cost per tile: the first extra tile (the 5th) costs the base,
// and each subsequent tile costs `step` more. So tiles 5→16 cost
// 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600 EcoPoints.
export const GARDEN_TILE_BASE_COST = 50;
export const GARDEN_TILE_COST_STEP = 50;

// Resolve how many tiles a user has unlocked. If `gardenTiles` is already
// persisted and in range, trust it. Otherwise derive a sensible default that
// never orphans plants a user already placed: at least the start count, at
// least one past the highest occupied tile id, and never above the max.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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