"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import {
  GARDEN_MAX_TILES,
  GROW_DURATION,
  HARVEST_COOLDOWN_MS,
  HARVEST_REWARDS,
  resolveGardenTiles,
  nextTileCost
} from "@/lib/garden-config";
import {
  Panel,
  PageHeader,
  Pill,
  ProgressBar,
  primaryButton,
  secondaryButton,
  rarityStyle,
  rarityBorder,
  type Rarity
} from "@/components/game-ui";
import { PLANT_IMAGES } from "@/lib/ui-shared";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StaggerContainer, StaggerItem } from "@/lib/animations";
import { Check, Coins, Lock, Plus, Sprout, Wheat } from "lucide-react";

const TOTAL_TILES = GARDEN_MAX_TILES;

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

// Growth stage colors ride the theme accent vars (they used to be hardcoded
// light-theme hexes) so every [data-theme] palette renders coherently:
// stems/bars use the fill, status text uses the -text ink variant.
const STAGE_COLOR: Record<GrowthStage, string> = {
  sprout: "var(--accent-lime)",
  growing: "var(--accent-green)",
  bloomed: "var(--accent-gold)"
};

const STAGE_TEXT: Record<GrowthStage, string> = {
  sprout: "var(--accent-lime-text)",
  growing: "var(--accent-green-text)",
  bloomed: "var(--accent-gold-text)"
};

// Player-vocabulary stage names for labels/screen readers (the raw stage
// values above are internal identifiers).
const STAGE_LABEL: Record<GrowthStage, string> = {
  sprout: "sprouting",
  growing: "growing",
  bloomed: "fully bloomed"
};

// Plants render as their real photo at every stage (no asterisk placeholders);
// opacity rises with growth so sprouts read as "just planted" and bloomed reads
// as full/striking. The bottom stem bar still communicates growth %.
const STAGE_OPACITY: Record<GrowthStage, number> = {
  sprout: 0.45,
  growing: 0.72,
  bloomed: 1
};

// Mix a theme var into the panel color — the one sanctioned tint recipe.
const wash = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, var(--bg-panel))`;

// Planted-tile plot soil: a muted warm earth tint, not neon.
const SOIL_TILE = `color-mix(in srgb, color-mix(in srgb, var(--accent-gold) 62%, var(--accent-orange)) 10%, var(--bg-panel-alt))`;

// Garden bed backdrop: soft gold light over a deeper orange-earth band —
// the landing page's muted earth recipe, all theme-var mixed.
const BED_BACKDROP = `linear-gradient(180deg, var(--bg-panel) 0%, ${wash("var(--accent-gold)", 7)} 42%, ${wash("var(--accent-orange)", 10)} 100%)`;

function normalizeRarity(value: unknown): Rarity {
  return (["common", "uncommon", "rare", "epic", "legendary"] as Rarity[]).includes(value as Rarity)
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
  const order: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
  return (order[b.rarity] - order[a.rarity]) || a.name.localeCompare(b.name);
}

export default function GardenPage() {
  const { user, profile, setProfile, refreshProfile } = useAuth();
  const toast = useToast();
  const reduced = useReducedMotion();
  const [isProcessing, setIsProcessing] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  const [selectingTile, setSelectingTile] = useState<number | null>(null);
  const [harvestAnim, setHarvestAnim] = useState<number | null>(null);
  // Tile ids briefly popped after a successful Harvest All (confetti-lite).
  const [pulseTiles, setPulseTiles] = useState<number[] | null>(null);
  const [tileToRemove, setTileToRemove] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const garden: GardenState = (profile?.garden as GardenState) ?? {};

  // Unlocked tile count — derived (and migrated) server-side too, so the
  // client and /api/garden/buy-tile always agree. Tiles 0..unlocked-1 are
  // usable; tiles unlocked..15 can be bought one at a time (increasing cost).
  const unlocked = resolveGardenTiles(profile);
  const canBuyMore = unlocked < GARDEN_MAX_TILES;
  const nextCost = canBuyMore ? nextTileCost(unlocked) : 0;

  const plantableInventory = useMemo(() => {
    const ownedPlants: any[] = Array.isArray(profile?.plants) ? profile.plants : [];
    const ownedSeeds: any[] = Array.isArray(profile?.seeds) ? profile.seeds : [];

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
  }, [profile]);

  const tiles = Object.values(garden).filter(Boolean);
  const occupiedTiles = new Set(Object.keys(garden).map(Number));
  const harvestableTiles = tiles.filter((tile) => canHarvest(tile, now));
  const harvestableCount = harvestableTiles.length;
  const totalPlanted = tiles.length;
  const totalPlantables = plantableInventory.reduce((sum, item) => sum + item.count, 0);

  const placePlant = async (item: PlantableItem) => {
    if (selectingTile === null || !user?.uid || !profile || isProcessing) return;
    if (garden[selectingTile]) {
      setSelectingTile(null);
      return;
    }

    setIsProcessing(true);
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
      setIsProcessing(false);
    }
  };

  const removePlant = async (tileId: number) => {
    if (!user?.uid || !profile || isProcessing) return;
    const tile = garden[tileId];
    if (!tile) return;

    setIsProcessing(true);
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
      toast.success("Plant returned to your inventory.");
      void refreshProfile();
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmRemovePlant = async () => {
    if (tileToRemove === null) return;
    await removePlant(tileToRemove);
    setTileToRemove(null);
  };

  const harvest = async (tileId: number) => {
    if (!user?.uid || !profile || isProcessing) return;
    const tile = garden[tileId];
    if (!tile || !canHarvest(tile, now)) return;

    setIsProcessing(true);
    try {
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
      // Celebrate only after the server confirms — no pop on failure, and
      // none at all when the visitor prefers reduced motion.
      if (!reduced) {
        setHarvestAnim(tileId);
        setTimeout(() => setHarvestAnim(null), 800);
      }
      if (typeof setProfile === "function" && profile) {
        setProfile({
          ...profile,
          level: data.level ?? Number(profile.level ?? 1),
          ecoPoints: data.ecoPoints ?? Number(profile.ecoPoints ?? 0) + Number(data.eco ?? 0),
          garden: { ...garden, [tileId]: { ...tile, lastHarvestAt: Date.now() } }
        });
      }
      toast.success(`Harvested ${tileName(tile)}. +${data.eco} EcoPoints, +${data.xp} XP.`);
      void refreshProfile();
    } finally {
      setIsProcessing(false);
    }
  };

  const harvestAll = async () => {
    if (!user?.uid || !profile || isProcessing || harvestableTiles.length === 0) return;

    setIsProcessing(true);
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
      // One confetti-lite spring pop across the just-harvested tiles. Cleared
      // after 600ms so the tiles settle back before the next interaction.
      if (!reduced) {
        setPulseTiles(harvestableTiles.map((tile) => tile.tileId));
        setTimeout(() => setPulseTiles(null), 600);
      }
      toast.success(`Harvested ${data.harvested} plant${data.harvested === 1 ? "" : "s"}. +${data.eco} EcoPoints, +${data.xp} XP.`);
      void refreshProfile();
    } finally {
      setIsProcessing(false);
    }
  };

  // Buy the next garden tile with EcoPoints. Server owns the price and cap
  // (see /api/garden/buy-tile), so we never write gardenTiles/ecoPoints
  // directly here — we just send the request and refresh from the response.
  const buyTile = async () => {
    if (!user?.uid || !profile || isProcessing || !canBuyMore) return;
    const balance = Number(profile.ecoPoints ?? 0) || 0;
    if (balance < nextCost) {
      toast.error(`Need ${nextCost} EcoPoints to unlock a tile; you have ${balance}.`);
      return;
    }

    setIsProcessing(true);
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
      toast.success(`Tile unlocked! −${nextCost} EcoPoints.`);
      void refreshProfile();
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Compact action bar ───────────────────────────────────────
  // Replaces the three stat panels: Harvest All + honest count chips.
  const balance = Number(profile?.ecoPoints ?? 0) || 0;
  const affordable = balance >= nextCost;

  return (
    <>
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
        <PageHeader
          title="Your garden"
          description="Plant your shop finds and chest seeds, watch them bloom, then harvest for repeat EcoPoints and XP."
        />
      </StaggerItem>

      <StaggerItem as="div">
        <section className="flex flex-col gap-3 rounded-card border border-line p-3.5 shadow-elev-1 sm:flex-row sm:items-center sm:p-4">
          <button
            type="button"
            onClick={harvestAll}
            disabled={isProcessing || harvestableCount === 0}
            className={`${primaryButton} w-full sm:w-auto`}
            title={harvestableCount > 0 ? undefined : "No plants are ready to harvest yet"}
          >
            <Wheat className="h-4.5 w-4.5" strokeWidth={2.2} aria-hidden="true" />
            Harvest All
          </button>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span
              className="fg-chip fg-chip-coins"
              title="EcoPoints balance — earned from quests and harvests, spent on plots and shop items."
            >
              <Coins className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
              {balance.toLocaleString()} EcoPoints
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold"
              style={
                harvestableCount > 0
                  ? { background: wash("var(--accent-gold)", 16), borderColor: "color-mix(in srgb, var(--accent-gold) 28%, var(--border-default))", color: "var(--accent-gold-text)" }
                  : { background: "var(--pill-bg)", borderColor: "var(--pill-border)", color: "var(--pill-text)" }
              }
            >
              <Wheat className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
              {harvestableCount} ready
            </span>
            <Pill>
              <Sprout className="mr-1 h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
              {totalPlantables} plantables
            </Pill>
            {canBuyMore ? (
              <Pill active={affordable}>Next plot — {nextCost} EP</Pill>
            ) : (
              <Pill>All {GARDEN_MAX_TILES} plots open</Pill>
            )}
          </div>
        </section>
      </StaggerItem>

      {/* ── The garden bed (hero) ─────────────────────────────── */}
      <StaggerItem as="section">
        <section className="rounded-card border border-line p-3 shadow-elev-1 sm:p-4" style={{ background: BED_BACKDROP }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="font-serif text-lg font-bold leading-tight text-ink">The garden bed</h2>
            <Pill>{unlocked}/{TOTAL_TILES} plots open</Pill>
          </div>

          <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
            {Array.from({ length: TOTAL_TILES }).map((_, tileId) => {
              const tile = garden[tileId];
              const isUnlocked = tileId < unlocked;
              const isBuyable = tileId === unlocked && canBuyMore;
              const stage = tile ? getGrowthStage(tile, now) : null;
              const pct = tile ? getGrowthPct(tile, now) : 0;
              const ready = tile ? canHarvest(tile, now) : false;
              // The single-harvest pop, or the Harvest All spring pulse.
              const isAnimating =
                harvestAnim === tileId || (pulseTiles?.includes(tileId) ?? false);
              const rarity = tile ? tileRarity(tile) : "common";
              const rStyle = rarityStyle[rarity] ?? rarityStyle.common;

              // Locked tiles beyond the next-buyable one: faint dotted plots so
              // the 4×4 bed stays intact, but they're not interactive.
              if (!isUnlocked && !isBuyable) {
                return (
                  <div
                    key={tileId}
                    role="img"
                    className="flex aspect-square items-center justify-center rounded-card border-2 border-dashed border-line-soft opacity-40"
                    aria-label={`Locked plot ${tileId + 1}`}
                  >
                    <Lock className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  </div>
                );
              }

              // The next locked plot: buy it with EcoPoints (increasing cost).
              if (isBuyable) {
                return (
                  <button
                    key={tileId}
                    type="button"
                    onClick={buyTile}
                    disabled={!affordable || isProcessing}
                    className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed text-center transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:hover:translate-y-0 active:scale-[0.98]"
                    style={{
                      borderColor: affordable
                        ? "color-mix(in srgb, var(--text-accent) 45%, var(--border-default))"
                        : "var(--border-default)",
                      background: affordable ? wash("var(--text-accent)", 8) : undefined
                    }}
                    aria-label={`Unlock plot ${tileId + 1} for ${nextCost} EcoPoints`}
                  >
                    <Plus
                      className="h-5 w-5"
                      strokeWidth={2.6}
                      style={{ color: affordable ? "var(--text-accent)" : "var(--text-muted)" }}
                      aria-hidden="true"
                    />
                    <span
                      className="rounded-full border px-2 py-0.5 text-micro leading-tight"
                      style={
                        affordable
                          ? { background: "var(--bg-panel)", borderColor: "color-mix(in srgb, var(--text-accent) 35%, var(--border-default))", color: "var(--text-accent)" }
                          : { background: "var(--pill-bg)", borderColor: "var(--pill-border)", color: "var(--pill-text)" }
                      }
                    >
                      Unlock — {nextCost} EP
                    </span>
                  </button>
                );
              }

              // Unlocked plot: planted or empty (clickable to plant).
              return (
                <button
                  key={tileId}
                  type="button"
                  onClick={() => {
                    if (tile) return;
                    setSelectingTile(tileId === selectingTile ? null : tileId);
                  }}
                  className={[
                    "relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-card border p-1.5 text-center transition active:scale-[0.98]",
                    selectingTile === tileId ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "",
                    tile ? "cursor-default" : "cursor-pointer border-2 border-dashed border-line hover:-translate-y-0.5"
                  ].join(" ")}
                  style={
                    tile
                      ? { borderColor: rarityBorder[rarity] ?? "var(--border-default)", background: SOIL_TILE }
                      : { background: "color-mix(in srgb, var(--accent-orange) 5%, var(--bg-panel-alt))" }
                  }
                  aria-label={tile ? `${tileName(tile)} - ${STAGE_LABEL[stage!]}` : `Empty plot ${tileId + 1}`}
                >
                  {tile ? (
                    <>
                      {/* Plant art in a rarity-ringed circular plot frame — the
                          bed reads as plots of soil, not a shop grid. Rarity
                          still reads via the frame ring + top-right chip. */}
                      <span
                        className="relative aspect-square h-[68%] overflow-hidden rounded-full"
                        style={{
                          border: `1px solid color-mix(in srgb, ${rStyle.accent} 45%, var(--border-default))`,
                          background: `color-mix(in srgb, ${rStyle.accent} 10%, var(--bg-panel-alt))`
                        }}
                      >
                        <Image
                          src={tileImage(tile)}
                          alt={tileName(tile)}
                          fill
                          sizes="(max-width: 640px) 18vw, 120px"
                          className={["object-cover transition duration-300", isAnimating ? "scale-150" : ""].join(" ")}
                          style={{
                            filter: stage === "bloomed"
                              ? "drop-shadow(0 0 6px var(--text-accent))"
                              : "drop-shadow(0 2px 5px color-mix(in srgb, var(--text-primary) 35%, transparent))",
                            opacity: STAGE_OPACITY[stage!]
                          }}
                        />
                      </span>

                      <span className={`absolute right-1 top-1 z-20 rounded-full px-1.5 py-0.5 text-micro ${rStyle.chip}`}>
                        {rarity}
                      </span>

                      {/* Harvest / resting tag sits above the growth stem. */}
                      {stage === "bloomed" && (
                        <span
                          className="absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-micro"
                          style={
                            ready
                              ? { background: "var(--accent-gold)", color: "var(--text-sidebar)" }
                              : { background: "color-mix(in srgb, var(--bg-panel) 88%, transparent)", color: "var(--text-secondary)" }
                          }
                        >
                          {ready ? "Harvest" : "Resting"}
                        </span>
                      )}

                      {/* Tiny growth stem — a narrow bar filling with progress. */}
                      <span
                        className="absolute inset-x-2 bottom-1.5 z-10 h-[3px] overflow-hidden rounded-full"
                        style={{ background: "color-mix(in srgb, var(--text-primary) 18%, transparent)" }}
                      >
                        <span
                          className="block h-full rounded-full transition duration-300"
                          style={{ width: `${pct}%`, background: STAGE_COLOR[stage!] }}
                        />
                      </span>
                    </>
                  ) : (
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full"
                      style={{ background: "color-mix(in srgb, var(--accent-orange) 14%, var(--bg-panel-alt))" }}
                      aria-hidden="true"
                    >
                      {selectingTile === tileId ? (
                        <Check className="h-4.5 w-4.5 text-accent" strokeWidth={2.6} />
                      ) : (
                        <Plus className="h-4.5 w-4.5 text-ink-muted" strokeWidth={2.6} />
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectingTile !== null && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-soft px-3 py-2.5 sm:px-4" style={{ background: wash("var(--text-accent)", 6) }}>
              <p className="text-xs font-semibold text-ink">
                Plot {selectingTile + 1} selected — pick a seed packet below to plant it.
              </p>
              <button type="button" onClick={() => setSelectingTile(null)} className={secondaryButton}>
                Cancel
              </button>
            </div>
          )}
        </section>
      </StaggerItem>

      {/* ── Seed packets ──────────────────────────────────────── */}
      <StaggerItem as="section">
        <Panel
          eyebrow="Field pack"
          title="Seeds & plants"
          action={<Pill>{totalPlantables} ready to plant</Pill>}
        >
          {plantableInventory.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={<Sprout className="h-8 w-8" strokeWidth={2} aria-hidden="true" />}
              title="No plantables yet"
              description="Buy plants in the Shop or open chest seeds in your Collection, then place them on an empty plot."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/shop" className={primaryButton}>Go to Shop</Link>
                  <Link href="/collection" className={secondaryButton}>Open Chests</Link>
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
                    className="group flex min-h-[176px] flex-col items-center gap-2 rounded-card border p-3 text-center transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:hover:translate-y-0 active:scale-[0.98] sm:min-h-[188px]"
                    style={{
                      borderColor: canPlantHere ? rStyle.accent : rBorder,
                      background: canPlantHere ? `color-mix(in srgb, ${rStyle.accent} 18%, var(--bg-card))` : "var(--bg-card)",
                      cursor: canPlantHere ? "pointer" : "default",
                      opacity: canPlantHere ? 1 : 0.78
                    }}
                  >
                    {/* Seed-packet head: rarity-ringed art with a count badge. */}
                    <span
                      className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2"
                      style={{
                        borderColor: `color-mix(in srgb, ${rStyle.accent} 45%, var(--border-default))`,
                        background: `color-mix(in srgb, ${rStyle.accent} 14%, var(--bg-card))`
                      }}
                    >
                      <Image
                        src={item.image}
                        alt={item.itemName}
                        fill
                        sizes="64px"
                        className="object-cover transition group-hover:scale-110"
                      />
                    </span>
                    <p className="text-xs font-extrabold leading-tight text-ink">
                      {item.itemName}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-micro ${rStyle.chip}`}>
                        {item.rarity}
                      </span>
                      <span
                        className="min-w-6 rounded-full px-1.5 py-0.5 text-micro text-ink"
                        style={{ background: "var(--bg-panel)", border: "1px solid var(--border-default)" }}
                        aria-label={`${item.itemName}: owned ${item.count}`}
                      >
                        ×{item.count}
                      </span>
                      <Pill>{item.source === "seed" ? "Seed" : "Plant"}</Pill>
                    </div>
                    <p className="text-micro text-ink-muted">
                      Blooms in {formatDuration(GROW_DURATION[item.rarity])}
                    </p>
                    {canPlantHere && <span className="text-micro text-accent">Tap to plant</span>}
                  </button>
                );
              })}
            </div>
          )}
          {selectingTile === null && plantableInventory.length > 0 && (
            <p className="mt-4 text-center text-xs font-semibold text-ink-muted">
              Select an empty plot in the bed first, then tap a packet here.
            </p>
          )}
        </Panel>
      </StaggerItem>

      {tiles.length > 0 && (
      <StaggerItem as="section">
        <Panel
          eyebrow="Growing now"
          title="Bed notes"
          action={harvestableCount > 0 ? <Pill active>{harvestableCount} ready</Pill> : undefined}
        >
          <div className="flex flex-col gap-2.5">
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
                  <div key={tile.tileId} className="flex items-center gap-3 rounded-card border border-line-soft bg-surface-alt px-3 py-3 sm:gap-4 sm:px-4">
                    <div
                      className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2"
                      style={{
                        borderColor: `color-mix(in srgb, ${rStyle.accent} 45%, var(--border-default))`,
                        background: `color-mix(in srgb, ${rStyle.accent} 14%, var(--bg-card))`
                      }}
                    >
                      <Image
                        src={tileImage(tile)}
                        alt={tileName(tile)}
                        fill
                        sizes="56px"
                        className="object-cover"
                        style={{ opacity: STAGE_OPACITY[stage] }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-serif text-sm font-bold text-ink">
                          {tileName(tile)}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-micro ${rStyle.chip}`}>
                          {rarity}
                        </span>
                        <Pill>{(tile.source ?? (tile.seedId ? "seed" : "plant")) === "seed" ? "Seed" : "Plant"}</Pill>
                        <Pill>Plot {tile.tileId + 1}</Pill>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold" style={{ color: STAGE_TEXT[stage] }}>
                        {stage}
                        {stage !== "bloomed" && ` — ${formatDuration(remainingMs)} left`}
                        {stage === "bloomed" && cooldownMs > 0 && ` — resting ${formatDuration(cooldownMs)}`}
                        {ready && " — ready to harvest"}
                      </p>
                      {stage !== "bloomed" && (
                        <div className="mt-1.5 max-w-[220px]">
                          <ProgressBar value={pct} color={STAGE_COLOR[stage]} />
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                      {ready && (
                        <button
                          type="button"
                          onClick={() => harvest(tile.tileId)}
                          title={`Harvest for ${HARVEST_REWARDS[rarity]} EcoPoints`}
                          className={primaryButton}
                        >
                          +{HARVEST_REWARDS[rarity]} EP
                        </button>
                      )}
                      <button type="button" onClick={() => setTileToRemove(tile.tileId)} className={`${secondaryButton} px-4`}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </Panel>
      </StaggerItem>
      )}

      <StaggerItem as="section">
        <Panel eyebrow="Guide" title="How the bed works">
          {/* The one true sequence, so round number markers + a dashed trail. */}
          <ol className="relative flex flex-col gap-4 pl-9">
            <span
              aria-hidden="true"
              className="absolute bottom-4 left-[1.125rem] top-4 w-0 border-l-2 border-dashed"
              style={{ borderColor: "color-mix(in srgb, var(--accent-green) 45%, var(--border-default))" }}
            />
            {[
              {
                title: "Plant",
                desc: "Pick a plot in the bed, then add a plant or seed from your field pack."
              },
              {
                title: "Grow",
                desc: "The stem fills as your plant grows — commons bloom in 8h, legendaries in 96h."
              },
              {
                title: "Harvest",
                desc: "Bloomed plants pay EcoPoints and XP every 48h. Unlock new plots with EcoPoints as you go."
              }
            ].map((step, i) => (
              <li key={step.title} className="relative">
                <span
                  className="absolute -left-9 top-0 flex h-9 w-9 items-center justify-center rounded-full font-serif text-sm font-bold"
                  style={{
                    background: wash("var(--accent-green)", 12),
                    border: `1px solid color-mix(in srgb, var(--accent-green) 32%, var(--border-default))`,
                    color: "var(--accent-green-text)"
                  }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <p className="text-sm font-extrabold text-ink">{step.title}</p>
                <p className="mt-0.5 max-w-md text-xs leading-relaxed text-ink-muted">{step.desc}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </StaggerItem>

    </StaggerContainer>

      <ConfirmDialog
        open={tileToRemove !== null}
        onClose={() => setTileToRemove(null)}
        title="Remove plant?"
        message="The plant will return to your inventory, but its growth progress on this tile will be lost."
        confirmLabel="Remove Plant"
        danger
        onConfirm={confirmRemovePlant}
      />
    </>
  );
}