// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { updateUserProfile } from "@/public/js/auth.js";
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
  type Rarity
} from "@/components/game-ui";
import { calculateLevel } from "@/lib/level-system";

const GRID_COLS = 6;
const GRID_ROWS = 4;
const TOTAL_TILES = GRID_COLS * GRID_ROWS;

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

const PLANT_IMAGES: Record<string, string> = {
  "Mossy Fern": "/images/plants/mint.png",
  "Golden Daisy": "/images/plants/sunflower.png",
  "Blue Orchid": "/images/plants/orchid.png",
  "Spotted Aloe": "/images/plants/basil.png",
  "Mystic Bamboo": "/images/plants/bamboo.png",
  "Crystal Lotus": "/images/plants/lotus.png",
  "Aurora Blossom": "/images/plants/cherry_blossom.png",
  "Ember Cactus": "/images/plants/dragonfruit.png"
};

const STAGE_SYMBOL: Record<GrowthStage, string> = {
  sprout: "*",
  growing: "**",
  bloomed: "***"
};

const STAGE_COLOR: Record<GrowthStage, string> = {
  sprout: "#4c7a3b",
  growing: "#2f6b46",
  bloomed: "#9a6b1f"
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
  const { user, profile, setProfile } = useAuth();
  const isProcessing = useRef(false);

  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState("");
  const [selectingTile, setSelectingTile] = useState<number | null>(null);
  const [harvestAnim, setHarvestAnim] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const garden: GardenState = (profile?.garden as GardenState) ?? {};
  const ownedPlants: any[] = Array.isArray(profile?.plants) ? profile.plants : [];
  const ownedSeeds: any[] = Array.isArray(profile?.seeds) ? profile.seeds : [];

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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const saveProfile = async (updates: Record<string, unknown>) => {
    if (!user?.uid || !profile) return false;
    const result = await updateUserProfile(user.uid, updates);
    if (!result.success) return false;
    if (typeof setProfile === "function") setProfile({ ...profile, ...updates });
    return true;
  };

  const placePlant = async (item: PlantableItem) => {
    if (selectingTile === null || !user?.uid || !profile || isProcessing.current) return;
    if (garden[selectingTile]) {
      setSelectingTile(null);
      return;
    }

    isProcessing.current = true;
    try {
      const tile: GardenTile = {
        tileId: selectingTile,
        source: item.source,
        sourceId: item.id,
        plantId: item.source === "plant" ? item.id : undefined,
        seedId: item.source === "seed" ? item.id : undefined,
        seedName: item.source === "seed" ? item.itemName : undefined,
        seedImage: item.source === "seed" ? item.image : undefined,
        plantName: item.name,
        plantImage: item.image,
        rarity: item.rarity,
        placedAt: Date.now()
      };

      const updates: Record<string, unknown> = {
        garden: { ...garden, [selectingTile]: tile }
      };

      if (item.source === "plant") {
        updates.plants = ownedPlants
          .map((plant) => (plant.id ?? plant.name) === item.id ? { ...plant, count: countOf(plant) - 1 } : plant)
          .filter((plant) => countOf(plant) > 0);
      } else {
        updates.seeds = ownedSeeds
          .map((seed) => (seed.id ?? seed.name) === item.id ? { ...seed, count: countOf(seed) - 1 } : seed)
          .filter((seed) => countOf(seed) > 0);
      }

      const ok = await saveProfile(updates);
      showToast(ok ? `${item.itemName} planted. First harvest in ${formatDuration(GROW_DURATION[item.rarity])}.` : "Could not plant. Please try again.");
      if (ok) setSelectingTile(null);
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
      const nextGarden = { ...garden };
      delete nextGarden[tileId];

      const updates: Record<string, unknown> = { garden: nextGarden };
      const source = tile.source ?? (tile.seedId || tile.seedName ? "seed" : "plant");

      if (source === "seed") {
        const seedId = tile.seedId ?? tile.sourceId ?? tile.seedName ?? tileName(tile);
        const seedName = tile.seedName || `${tileName(tile)} Seed`;
        const nextSeeds = [...ownedSeeds];
        const existingIdx = nextSeeds.findIndex((seed) => (seed.id ?? seed.name) === seedId || seed.name === seedName);
        if (existingIdx >= 0) {
          nextSeeds[existingIdx] = { ...nextSeeds[existingIdx], count: countOf(nextSeeds[existingIdx]) + 1 };
        } else {
          nextSeeds.push({ id: seedId, name: seedName, rarity: tileRarity(tile), image: tileImage(tile), count: 1 });
        }
        updates.seeds = nextSeeds;
      } else {
        const plantId = tile.plantId ?? tile.sourceId ?? tileName(tile);
        const nextPlants = [...ownedPlants];
        const existingIdx = nextPlants.findIndex((plant) => (plant.id ?? plant.name) === plantId || plant.name === tileName(tile));
        if (existingIdx >= 0) {
          nextPlants[existingIdx] = { ...nextPlants[existingIdx], count: countOf(nextPlants[existingIdx]) + 1 };
        } else {
          nextPlants.push({ id: plantId, name: tileName(tile), rarity: tileRarity(tile), image: tileImage(tile), count: 1 });
        }
        updates.plants = nextPlants;
      }

      const ok = await saveProfile(updates);
      showToast(ok ? "Plant returned to your inventory." : "Could not remove plant.");
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
      const ts = Date.now();
      setHarvestAnim(tileId);
      setTimeout(() => setHarvestAnim(null), 800);

      const rarity = tileRarity(tile);
      const ep = HARVEST_REWARDS[rarity] ?? HARVEST_REWARDS.common;
      const xpGain = HARVEST_XP[rarity] ?? HARVEST_XP.common;
      const nextXp = Number(profile.xp ?? 0) + xpGain;
      const nextGarden: GardenState = {
        ...garden,
        [tileId]: { ...tile, lastHarvestAt: ts }
      };

      const ok = await saveProfile({
        garden: nextGarden,
        ecoPoints: Number(profile.ecoPoints ?? 0) + ep,
        xp: nextXp,
        level: calculateLevel(nextXp)
      });

      showToast(ok ? `Harvested ${tileName(tile)}. +${ep} EcoPoints, +${xpGain} XP.` : "Harvest failed. Please try again.");
    } finally {
      isProcessing.current = false;
    }
  };

  const harvestAll = async () => {
    if (!user?.uid || !profile || isProcessing.current || harvestableTiles.length === 0) return;

    isProcessing.current = true;
    try {
      const ts = Date.now();
      const nextGarden: GardenState = { ...garden };
      let ep = 0;
      let xpGain = 0;

      harvestableTiles.forEach((tile) => {
        const rarity = tileRarity(tile);
        nextGarden[tile.tileId] = { ...tile, lastHarvestAt: ts };
        ep += HARVEST_REWARDS[rarity] ?? HARVEST_REWARDS.common;
        xpGain += HARVEST_XP[rarity] ?? HARVEST_XP.common;
      });

      const nextXp = Number(profile.xp ?? 0) + xpGain;
      const ok = await saveProfile({
        garden: nextGarden,
        ecoPoints: Number(profile.ecoPoints ?? 0) + ep,
        xp: nextXp,
        level: calculateLevel(nextXp)
      });

      showToast(ok ? `Harvested ${harvestableTiles.length} plants. +${ep} EcoPoints, +${xpGain} XP.` : "Harvest failed. Please try again.");
    } finally {
      isProcessing.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Your living world"
        title="Virtual Garden"
        description="Plant shop plants and chest seeds, let them bloom, then come back for repeat EcoPoints and XP."
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

      <Panel eyebrow="Your garden" title="Tile Grid" action={<Pill>{totalPlanted}/{TOTAL_TILES} tiles used</Pill>}>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: TOTAL_TILES }).map((_, tileId) => {
            const tile = garden[tileId];
            const stage = tile ? getGrowthStage(tile, now) : null;
            const pct = tile ? getGrowthPct(tile, now) : 0;
            const ready = tile ? canHarvest(tile, now) : false;
            const isAnimating = harvestAnim === tileId;
            const rarity = tile ? tileRarity(tile) : "common";
            const rStyle = rarityStyle[rarity] ?? rarityStyle.common;

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
                  selectingTile === tileId ? "ring-2 ring-offset-1" : "",
                  tile ? "cursor-default" : "cursor-pointer hover:-translate-y-0.5"
                ].join(" ")}
                style={{
                  borderColor: tile ? (rarityBorder[rarity] ?? "var(--border-default)") : "var(--border-default)",
                  background: tile ? `${rStyle.accent}14` : "var(--bg-panel-alt)",
                  ringColor: "#2f6b46"
                }}
                aria-label={tile ? `${tileName(tile)} - ${stage}` : `Empty tile ${tileId + 1}`}
              >
                {tile ? (
                  <div className="flex h-full w-full flex-col items-center justify-between p-1.5">
                    <span
                      className={[
                        "flex h-full w-full items-center justify-center text-xl transition-transform duration-300",
                        isAnimating ? "scale-150" : ""
                      ].join(" ")}
                      style={{ filter: stage === "bloomed" ? "drop-shadow(0 0 6px gold)" : "none" }}
                    >
                      {stage === "bloomed"
                        ? <img src={tileImage(tile)} alt={tileName(tile)} className="h-full w-full object-contain p-1" />
                        : STAGE_SYMBOL[stage!]}
                    </span>
                    {stage !== "bloomed" && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--border-subtle)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: STAGE_COLOR[stage!] }} />
                      </div>
                    )}
                    {stage === "bloomed" && (
                      <span className="text-[8px] font-black uppercase tracking-wide text-amber-600">
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
                      className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
                      style={{ borderColor: rarityBorder[rarity] ?? "var(--border-default)", background: `${rStyle.accent}14` }}
                    >
                      {stage === "bloomed"
                        ? <img src={tileImage(tile)} alt={tileName(tile)} className="h-full w-full object-contain p-2" />
                        : <span className="text-2xl">{STAGE_SYMBOL[stage]}</span>}
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
                        <button type="button" onClick={() => harvest(tile.tileId)} className={primaryButton}>
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

      <Panel eyebrow="Inventory" title="Your Plantables" action={<Pill>{totalPlantables} available</Pill>}>
        {plantableInventory.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-4xl">*</span>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>No plantables yet</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Buy plants in the Shop or open chests in your Collection to find seeds.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <a href="/shop" className={primaryButton}>Go to Shop</a>
              <a href="/collection" className={secondaryButton}>Open Chests</a>
            </div>
          </div>
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
                    className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl"
                    style={{ background: `${rStyle.accent}14` }}
                  >
                    <img
                      src={item.image}
                      alt={item.itemName}
                      className="h-full w-full object-contain p-2 transition group-hover:scale-110"
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

      <Panel eyebrow="Guide" title="Garden Rules">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: "1", title: "Find", desc: "Buy plants in the Shop or earn seeds from chests in your Collection." },
            { icon: "2", title: "Grow", desc: "Common plants bloom in 8h, rare in 24h, epic in 72h, and legendary in 96h." },
            { icon: "3", title: "Return", desc: "Harvest ready plants for repeat EcoPoints and XP every 48h." }
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rounded-2xl p-4" style={{ background: "var(--bg-panel-alt)" }}>
              <div className="mb-2 text-2xl font-black" style={{ color: "var(--text-accent)" }}>{icon}</div>
              <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </Panel>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl"
          style={{ background: "var(--bg-sidebar)", color: "var(--text-sidebar)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
