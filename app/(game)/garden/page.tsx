"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import {
  GARDEN_MAX_TILES,
  resolveGardenTiles,
  nextTileCost
} from "@/lib/garden-config";
import {
  HeroMetric,
  PageHero,
  Panel,
  Pill,
  ProgressBar,
  primaryButton,
  secondaryButton,
  rarityStyle,
  rarityBorder,
  heroAccents,
  type Rarity
} from "@/components/game-ui";
import { PLANT_IMAGES } from "@/lib/ui-shared";
import { EmptyState } from "@/components/ui/empty-state";

const TOTAL_TILES = GARDEN_MAX_TILES;

const GROW_DURATION: Record<Rarity, number> = {
  common: 8 * 60 * 60 * 1000,
  rare: 24 * 60 * 60 * 1000,
  epic: 72 * 60 * 60 * 1000,
  legendary: 96 * 60 * 60 * 1000
};

const HARVEST_COOLDOWN_MS = 48 * 60 * 60 * 1000;

const HARVEST_REWARDS: Record<Rarity, number> = {
  common: 8,
  rare: 22,
  epic: 55,
  legendary: 120
};

const HARVEST_XP: Record<Rarity, number> = {
  common: 12,
  rare: 30,
  epic: 70,
  legendary: 150
};

type GrowthStage = "sprout" | "growing" | "bloomed";
type InventorySource = "plant" | "seed";

type GardenTile = {
  tileId: number;
  source?: InventorySource;
  sourceId?: string | number;
  plantId?: string | number;
  seedId?: string | number;
  seedName?: string;
  seedImage?: string;
  plantName: string;
  plantImage: string;
  rarity: Rarity;
  placedAt: number;
  lastHarvestAt?: number;
};

type GardenState = Record<string, GardenTile>;

type PlantableItem = {
  inventoryKey: string;
  source: InventorySource;
  id: string | number;
  name: string;
  itemName: string;
  image: string;
  rarity: Rarity;
  count: number;
  raw: any;
};

const STAGE_COLOR: Record<GrowthStage, string> = {
  sprout: "#4c7a3b",
  growing: "#2f6b46",
  bloomed: "#9a6b1f"
};

// Plants render as their real photo at every stage (no asterisk placeholders);
// opacity rises with growth so sprouts read as "just planted" and bloomed reads
// as full/striking. The progress bar overlay still communicates growth %.
const STAGE_OPACITY: Record<GrowthStage, number> = {
  sprout: 0.45,
  growing: 0.72,
  bloomed: 1
};

function normalizeRarity(value: unknown): Rarity {
  return (["common", "rare", "epic", "legendary"] as Rarity[]).includes(value as Rarity)
    ? value as Rarity
    : "common";
}

function countOf(item: any): number {
  return Math.max(0, Number(item?.count ?? 1));
}

function plantNameFromSeed(seedName: string): string {
  return String(seedName || "Mystery Plant").replace(/ Seed$/i, "").trim();
}

function getPlantImage(name: string, fallback?: string): string {
  return PLANT_IMAGES[name] ?? fallback ?? "/images/plants/sunflower.png";
}

function tileRarity(tile: GardenTile): Rarity {
  return normalizeRarity(tile?.rarity);
}

function tileName(tile: GardenTile): string {
  return tile?.plantName || plantNameFromSeed(tile?.seedName || "Mystery Plant");
}

function tileImage(tile: GardenTile): string {
  return getPlantImage(tileName(tile), tile?.plantImage || tile?.seedImage);
}

function getGrowthStage(tile: GardenTile, now: number): GrowthStage {
  const placedAt = Number(tile?.placedAt ?? now);
  const elapsed = Math.max(0, now - placedAt);
  const total = GROW_DURATION[tileRarity(tile)] ?? GROW_DURATION.common;
  if (elapsed >= total) return "bloomed";
  if (elapsed >= total * 0.4) return "growing";
  return "sprout";
}

function getGrowthPct(tile: GardenTile, now: number): number {
  const placedAt = Number(tile?.placedAt ?? now);
  const elapsed = Math.max(0, now - placedAt);
  const total = GROW_DURATION[tileRarity(tile)] ?? GROW_DURATION.common;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function canHarvest(tile: GardenTile, now: number): boolean {
  if (getGrowthStage(tile, now) !== "bloomed") return false;
  if (!tile.lastHarvestAt) return true;
  return now - Number(tile.lastHarvestAt) >= HARVEST_COOLDOWN_MS;
}

function nextHarvestIn(tile: GardenTile, now: number): number {
  if (!tile.lastHarvestAt) return 0;
  return Math.max(0, Number(tile.lastHarvestAt) + HARVEST_COOLDOWN_MS - now);
}

function timeToBloom(tile: GardenTile, now: number): number {
  const total = GROW_DURATION[tileRarity(tile)] ?? GROW_DURATION.common;
  return Math.max(0, Number(tile?.placedAt ?? now) + total - now);
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "Ready";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

function sortByRarityThenName(a: PlantableItem, b: PlantableItem): number {
  const order: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
  return (order[b.rarity] - order[a.rarity]) || a.name.localeCompare(b.name);
}

export default function GardenPage() {
  const { user, profile, setProfile, refreshProfile } = useAuth();
  const toast = useToast();
  const isProcessing = useRef(false);

  const [now, setNow] = useState(() => Date.now());
  const [selectingTile, setSelectingTile] = useState<number | null>(null);
  const [harvestAnim, setHarvestAnim] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const garden: GardenState = (profile?.garden as GardenState) ?? {};
  const ownedPlants: any[] = Array.isArray(profile?.plants) ? profile.plants : [];
  const ownedSeeds: any[] = Array.isArray(profile?.seeds) ? profile.seeds : [];

  // Unlocked tile count — derived (and migrated) server-side too, so the
  // client and /api/garden/buy-tile always agree. Tiles 0..unlocked-1 are
  // usable; tiles unlocked..15 can be bought one at a time (increasing cost).
  const unlocked = resolveGardenTiles(profile);
  const canBuyMore = unlocked < GARDEN_MAX_TILES;
  const nextCost = canBuyMore ? nextTileCost(unlocked) : 0;

  const plantableInventory = useMemo(() => {
    const plants: PlantableItem[] = ownedPlants
      .filter((plant) => countOf(plant) > 0)
      .map((plant) => ({
        inventoryKey: `plant:${plant.id ?? plant.name}`,
        source: "plant",
        id: plant.id ?? plant.name,
        name: plant.name,
        itemName: plant.name,
        image: getPlantImage(plant.name, plant.image),
        rarity: normalizeRarity(plant.rarity),
        count: countOf(plant),
        raw: plant
      }));

    const seeds: PlantableItem[] = ownedSeeds
      .filter((seed) => countOf(seed) > 0)
      .map((seed) => {
        const name = plantNameFromSeed(seed.name);
        return {
          inventoryKey: `seed:${seed.id ?? seed.name}`,
          source: "seed",
          id: seed.id ?? seed.name,
          name,
          itemName: seed.name,
          image: getPlantImage(name, seed.image),
          rarity: normalizeRarity(seed.rarity),
          count: countOf(seed),
          raw: seed
        };
      });

    return [...plants, ...seeds].sort(sortByRarityThenName);
  }, [ownedPlants, ownedSeeds]);

  const tiles = Object.values(garden).filter(Boolean);
  const occupiedTiles = new Set(Object.keys(garden).map(Number));
  const bloomedCount = tiles.filter((tile) => getGrowthStage(tile, now) === "bloomed").length;
  const harvestableTiles = tiles.filter((tile) => canHarvest(tile, now));
  const harvestableCount = harvestableTiles.length;
  const totalPlanted = tiles.length;
  const totalPlantables = plantableInventory.reduce((sum, item) => sum + item.count, 0);

  const placePlant = async (item: PlantableItem) => {
    if (selectingTile === null || !user?.uid || !profile || isProcessing.current) return;
    if (garden[selectingTile]) {
      setSelectingTile(null);
      return;
    }

    isProcessing.current = true;
    try {
      // Server owns placement: it validates the tile is unlocked + empty, that
      // we actually own the item, and resolves rarity/name/image from the server
      // catalog — so we can't plant a legendary we don't own, or forge a rarity.
      // See /api/garden/plant.
      const res = await fetch("/api/garden/plant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileId: selectingTile, source: item.source, itemId: item.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error?.message || "Could not plant. Please try again.");
        return;
      }
      if (typeof setProfile === "function" && profile) {
        const key = item.source === "plant" ? "plants" : "seeds";
        setProfile({ ...profile, garden: data.garden, [key]: data[key] });
      }
      await refreshProfile();
      const plantedRarity = normalizeRarity(data.tile?.rarity ?? item.rarity);
      toast.success(`${item.itemName} planted. First harvest in ${formatDuration(GROW_DURATION[plantedRarity])}.`);
      setSelectingTile(null);
    } finally {
      isProcessing.current = false;
    }
  };

  const removePlant = async (tileId: number) => {
    if (!user?.uid || !profile || isProcessing.current) return;
    const tile = garden[tileId];
    if (!tile) return;

    isProcessing.current = true;
    try {
      // Server owns removal + the inventory refund under a row lock, so we can't
      // end up with the item back AND the tile still placed (duplication), and the
      // refund's rarity comes from the server catalog. See /api/garden/remove.
      const res = await fetch("/api/garden/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error?.message || "Could not remove plant.");
        return;
      }
      if (typeof setProfile === "function" && profile) {
        const key =
          (tile.source ?? (tile.seedId || tile.seedName ? "seed" : "plant")) === "seed" ? "seeds" : "plants";
        setProfile({ ...profile, garden: data.garden, [key]: data[key] });
      }
      await refreshProfile();
      toast.success("Plant returned to your inventory.");
    } finally {
      isProcessing.current = false;
    }
  };

  const harvest = async (tileId: number) => {
    if (!user?.uid || !profile || isProcessing.current) return;
    const tile = garden[tileId];
    if (!tile || !canHarvest(tile, Date.now())) return;

    isProcessing.current = true;
    try {
      setHarvestAnim(tileId);
      setTimeout(() => setHarvestAnim(null), 800);

      const res = await fetch("/api/garden/harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileIds: [tileId] })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error?.message || data?.message || "Harvest failed. Please try again.");
        return;
      }
      if (typeof setProfile === "function" && profile) {
        setProfile({
          ...profile,
          level: data.level ?? Number(profile.level ?? 1),
          ecoPoints: data.ecoPoints ?? Number(profile.ecoPoints ?? 0) + Number(data.eco ?? 0),
          garden: { ...garden, [tileId]: { ...tile, lastHarvestAt: Date.now() } }
        });
      }
      await refreshProfile();
      toast.success(`Harvested ${tileName(tile)}. +${data.eco} EcoPoints, +${data.xp} XP.`);
    } finally {
      isProcessing.current = false;
    }
  };

  const harvestAll = async () => {
    if (!user?.uid || !profile || isProcessing.current || harvestableTiles.length === 0) return;

    isProcessing.current = true;
    try {
      const res = await fetch("/api/garden/harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileIds: harvestableTiles.map((t) => t.tileId) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error?.message || data?.message || "Harvest failed. Please try again.");
        return;
      }
      if (typeof setProfile === "function" && profile) {
        const ts = Date.now();
        const nextGarden: GardenState = { ...garden };
        harvestableTiles.forEach((tile) => {
          nextGarden[tile.tileId] = { ...tile, lastHarvestAt: ts };
        });
        setProfile({
          ...profile,
          level: data.level ?? Number(profile.level ?? 1),
          ecoPoints: data.ecoPoints ?? Number(profile.ecoPoints ?? 0) + Number(data.eco ?? 0),
          garden: nextGarden
        });
      }
      await refreshProfile();
      toast.success(`Harvested ${data.harvested} plant${data.harvested === 1 ? "" : "s"}. +${data.eco} EcoPoints, +${data.xp} XP.`);
    } finally {
      isProcessing.current = false;
    }
  };

  // Buy the next garden tile with EcoPoints. Server owns the price and cap
  // (see /api/garden/buy-tile), so we never write gardenTiles/ecoPoints
  // directly here — we just send the request and refresh from the response.
  const buyTile = async () => {
    if (!user?.uid || !profile || isProcessing.current || !canBuyMore) return;
    const balance = Number(profile.ecoPoints ?? 0) || 0;
    if (balance < nextCost) {
      toast.error(`Need ${nextCost} EcoPoints to unlock a tile; you have ${balance}.`);
      return;
    }

    isProcessing.current = true;
    try {
      const res = await fetch("/api/garden/buy-tile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error?.message || "Could not unlock tile. Please try again.");
        return;
      }
      if (typeof setProfile === "function" && profile) {
        setProfile({ ...profile, ecoPoints: data.ecoPoints, gardenTiles: data.gardenTiles });
      }
      await refreshProfile();
      toast.success(`Tile unlocked! −${nextCost} EcoPoints.`);
    } finally {
      isProcessing.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Your living world"
        title="Virtual Garden"
        description="Plant shop plants and chest seeds, let them bloom, then come back for repeat EcoPoints and XP. Start with 4 tiles — unlock more with EcoPoints, up to 16."
        accent={heroAccents.garden}
      >
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Planted" value={totalPlanted} />
          <HeroMetric label="Bloomed" value={bloomedCount} />
          <HeroMetric label="Ready" value={harvestableCount} />
          <HeroMetric label="Inventory" value={totalPlantables} />
        </div>
      </PageHero>

      <div className="grid gap-3 md:grid-cols-3">
        <Panel eyebrow="Next action" title={harvestableCount > 0 ? "Harvest Ready" : "Garden Status"}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {harvestableCount > 0
                  ? `${harvestableCount} plant${harvestableCount === 1 ? "" : "s"} ready`
                  : tiles.length > 0
                  ? "Growth in progress"
                  : "Start your first plot"}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {harvestableCount > 0
                  ? "Collect everything in one tap."
                  : tiles.length > 0
                  ? "Return later when plants bloom."
                  : "Pick an empty tile and choose a plant or seed."}
              </p>
            </div>
            {harvestableCount > 0 && (
              <button type="button" onClick={harvestAll} className={primaryButton}>
                Harvest All
              </button>
            )}
          </div>
        </Panel>

        <Panel eyebrow="Inventory" title="Plantables">
          <p className="font-serif text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            {totalPlantables}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Includes shop plants and seeds won from chests.
          </p>
        </Panel>

        <Panel eyebrow="Reward loop" title="Recurring Growth">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Bloomed plants reset every {formatDuration(HARVEST_COOLDOWN_MS)}.
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            This makes the garden a daily reason to come back.
          </p>
        </Panel>
      </div>

      <Panel
        eyebrow="Your garden"
        title="Tile Grid"
        action={<Pill>{totalPlanted}/{unlocked} used · {unlocked}/{GARDEN_MAX_TILES} unlocked</Pill>}
      >
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: TOTAL_TILES }).map((_, tileId) => {
            const tile = garden[tileId];
            const isUnlocked = tileId < unlocked;
            const isBuyable = tileId === unlocked && canBuyMore;
            const stage = tile ? getGrowthStage(tile, now) : null;
            const pct = tile ? getGrowthPct(tile, now) : 0;
            const ready = tile ? canHarvest(tile, now) : false;
            const isAnimating = harvestAnim === tileId;
            const rarity = tile ? tileRarity(tile) : "common";
            const rStyle = rarityStyle[rarity] ?? rarityStyle.common;

            // Locked tiles beyond the next-buyable one: render a placeholder
            // so the 4×4 grid stays intact, but they're not interactive.
            if (!isUnlocked && !isBuyable) {
              return (
                <div
                  key={tileId}
                  className="flex aspect-square flex-col items-center justify-center rounded-2xl border border-dashed"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)", opacity: 0.5 }}
                  aria-label={`Locked tile ${tileId + 1}`}
                >
                  <span className="text-base" style={{ color: "var(--text-muted)" }}>🔒</span>
                </div>
              );
            }

            // The next locked tile: buy it with EcoPoints (increasing cost).
            if (isBuyable) {
              const balance = Number(profile?.ecoPoints ?? 0) || 0;
              const affordable = balance >= nextCost;
              return (
                <button
                  key={tileId}
                  type="button"
                  onClick={buyTile}
                  disabled={!affordable || isProcessing.current}
                  className="group flex aspect-square flex-col items-center justify-center rounded-2xl border text-center transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  style={{
                    borderColor: affordable ? "var(--text-accent, #43653f)" : "var(--border-default)",
                    background: affordable ? "color-mix(in srgb, var(--text-accent, #43653f) 10%, var(--bg-panel-alt))" : "var(--bg-panel-alt)"
                  }}
                  aria-label={`Unlock tile ${tileId + 1} for ${nextCost} EcoPoints`}
                >
                  <span className="text-lg font-black" style={{ color: affordable ? "var(--text-accent, #43653f)" : "var(--text-muted)" }}>+</span>
                  <span className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: affordable ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {nextCost} EP
                  </span>
                </button>
              );
            }

            // Unlocked tile: planted or empty (clickable to plant).
            return (
              <button
                key={tileId}
                type="button"
                onClick={() => {
                  if (tile) return;
                  setSelectingTile(tileId === selectingTile ? null : tileId);
                }}
                className={[
                  "relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border text-center transition",
                  selectingTile === tileId ? "ring-2 ring-forest-600 ring-offset-2" : "",
                  tile ? "cursor-default" : "cursor-pointer hover:-translate-y-0.5"
                ].join(" ")}
                style={{
                  borderColor: tile ? (rarityBorder[rarity] ?? "var(--border-default)") : "var(--border-default)",
                  background: tile ? `${rStyle.accent}14` : "var(--bg-panel-alt)",
                  ["--tw-ring-offset-color" as string]: "var(--bg-panel)"
                }}
                aria-label={tile ? `${tileName(tile)} - ${stage}` : `Empty tile ${tileId + 1}`}
              >
                {tile ? (
                  <div className="relative h-full w-full">
                    {/* Framed image — object-contain (like Collection's creature
                        displays) so the whole plant fits in the tile instead of
                        being cropped, letterboxed on the rarity accent color. */}
                    <div
                      className="absolute inset-0 flex items-center justify-center overflow-hidden"
                      style={{ background: `${rStyle.accent}12` }}
                    >
                      <Image
                        src={tileImage(tile)}
                        alt={tileName(tile)}
                        fill
                        sizes="(max-width: 640px) 45vw, 120px"
                        className={[
                          "object-contain p-1 transition duration-300",
                          isAnimating ? "scale-150" : ""
                        ].join(" ")}
                        style={{
                          filter: stage === "bloomed" ? "drop-shadow(0 0 6px gold)" : "drop-shadow(0 2px 5px rgba(0,0,0,0.35))",
                          opacity: STAGE_OPACITY[stage!]
                        }}
                      />
                    </div>

                    {/* Rarity chip, top-right — matches the Shop/Collection card overlay. */}
                    <span className={`absolute right-1 top-1 z-10 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide ${rStyle.chip}`}>
                      {rarity}
                    </span>

                    {/* Status overlay along the bottom. */}
                    {stage !== "bloomed" ? (
                      <div className="absolute inset-x-1 bottom-1 z-10 h-1 overflow-hidden rounded-full" style={{ background: "var(--border-subtle)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: STAGE_COLOR[stage!] }} />
                      </div>
                    ) : (
                      <span
                        className={`absolute bottom-1 left-1 z-10 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                          ready ? "bg-amber-500 text-white" : "bg-black/55 text-white"
                        }`}
                      >
                        {ready ? "Harvest" : "Resting"}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-lg font-bold" style={{ color: "var(--text-muted)" }}>
                    {selectingTile === tileId ? "OK" : "+"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {canBuyMore && (
          <p className="mt-3 text-center text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Unlock your next tile for <strong style={{ color: "var(--text-primary)" }}>{nextCost} EcoPoints</strong> · {unlocked}/{GARDEN_MAX_TILES} unlocked
          </p>
        )}

        {selectingTile !== null && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Tile {selectingTile + 1} selected. Pick an item below to plant it.
            </p>
            <button type="button" onClick={() => setSelectingTile(null)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        )}
      </Panel>

      <Panel eyebrow="Inventory" title="Your Plantables" action={<Pill>{totalPlantables} available</Pill>}>
        {plantableInventory.length === 0 ? (
          <EmptyState
            variant="plain"
            icon="🌱"
            title="No plantables yet"
            description="Buy plants in the Shop or open chests in your Collection to find seeds, then place them on a tile to grow."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <a href="/shop" className={primaryButton}>Go to Shop</a>
                <a href="/collection" className={secondaryButton}>Open Chests</a>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {plantableInventory.map((item) => {
              const rStyle = rarityStyle[item.rarity] ?? rarityStyle.common;
              const rBorder = rarityBorder[item.rarity] ?? "var(--border-default)";
              const canPlantHere = selectingTile !== null && !occupiedTiles.has(selectingTile);
              return (
                <button
                  key={item.inventoryKey}
                  type="button"
                  disabled={!canPlantHere}
                  onClick={() => canPlantHere && placePlant(item)}
                  className="group flex min-h-[172px] flex-col items-center gap-2 rounded-2xl border p-3 text-center transition hover:-translate-y-0.5"
                  style={{
                    borderColor: canPlantHere ? rStyle.accent : rBorder,
                    background: canPlantHere ? `${rStyle.accent}18` : "var(--bg-card)",
                    cursor: canPlantHere ? "pointer" : "default",
                    opacity: canPlantHere ? 1 : 0.78
                  }}
                >
                  <div
                    className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl"
                    style={{ background: `${rStyle.accent}14` }}
                  >
                    <Image
                      src={item.image}
                      alt={item.itemName}
                      fill
                      sizes="64px"
                      className="object-cover transition group-hover:scale-110"
                    />
                  </div>
                  <p className="text-xs font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>
                    {item.itemName}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${rStyle.chip}`}>
                      {item.rarity}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                      x{item.count}
                    </span>
                    <Pill>{item.source === "seed" ? "Seed" : "Plant"}</Pill>
                  </div>
                  <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                    Blooms in {formatDuration(GROW_DURATION[item.rarity])}
                  </p>
                  {canPlantHere && <span className="text-[10px] font-extrabold text-emerald-600">Tap to plant</span>}
                </button>
              );
            })}
          </div>
        )}
        {selectingTile === null && plantableInventory.length > 0 && (
          <p className="mt-4 text-center text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Select an empty tile first, then choose a plant or seed here.
          </p>
        )}
      </Panel>

      {tiles.length > 0 && (
        <Panel eyebrow="Growing now" title="Plant Status" action={harvestableCount > 0 ? <Pill active>{harvestableCount} ready</Pill> : undefined}>
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {tiles
              .sort((a, b) => a.tileId - b.tileId)
              .map((tile) => {
                const stage = getGrowthStage(tile, now);
                const pct = getGrowthPct(tile, now);
                const ready = canHarvest(tile, now);
                const cooldownMs = nextHarvestIn(tile, now);
                const remainingMs = timeToBloom(tile, now);
                const rarity = tileRarity(tile);
                const rStyle = rarityStyle[rarity] ?? rarityStyle.common;

                return (
                  <div key={tile.tileId} className="flex items-center gap-4 py-4">
                    <div
                      className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
                      style={{ borderColor: rarityBorder[rarity] ?? "var(--border-default)", background: `${rStyle.accent}14` }}
                    >
                      <Image
                        src={tileImage(tile)}
                        alt={tileName(tile)}
                        fill
                        sizes="56px"
                        className="object-contain p-1"
                        style={{ opacity: STAGE_OPACITY[stage] }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-serif text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          {tileName(tile)}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${rStyle.chip}`}>
                          {rarity}
                        </span>
                        <Pill>{(tile.source ?? (tile.seedId ? "seed" : "plant")) === "seed" ? "Seed" : "Plant"}</Pill>
                        <Pill>Tile {tile.tileId + 1}</Pill>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold capitalize" style={{ color: STAGE_COLOR[stage] }}>
                        {stage}
                        {stage !== "bloomed" && ` - ${formatDuration(remainingMs)} left`}
                        {stage === "bloomed" && cooldownMs > 0 && ` - next harvest in ${formatDuration(cooldownMs)}`}
                        {ready && " - ready to harvest"}
                      </p>
                      {stage !== "bloomed" && (
                        <div className="mt-1.5">
                          <ProgressBar value={pct} color={STAGE_COLOR[stage]} />
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-1.5">
                      {ready && (
                        <button type="button" onClick={() => harvest(tile.tileId)} title={`Harvest for ${HARVEST_REWARDS[rarity]} EcoPoints`} className={primaryButton}>
                          +{HARVEST_REWARDS[rarity]} EP
                        </button>
                      )}
                      <button type="button" onClick={() => removePlant(tile.tileId)} className={secondaryButton}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </Panel>
      )}

      <Panel eyebrow="Guide" title="Garden Rules">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: "1", title: "Find", desc: "Buy plants in the Shop or earn seeds from chests in your Collection." },
            { icon: "2", title: "Grow", desc: "Common plants bloom in 8h, rare in 24h, epic in 72h, and legendary in 96h." },
            { icon: "3", title: "Return", desc: "Harvest ready plants for repeat EcoPoints and XP every 48h." },
            { icon: "4", title: "Expand", desc: "Unlock more tiles with EcoPoints (price rises each tile) — up to 16 tiles." }
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rounded-2xl p-4" style={{ background: "var(--bg-panel-alt)" }}>
              <div className="mb-2 text-2xl font-black" style={{ color: "var(--text-accent)" }}>{icon}</div>
              <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
