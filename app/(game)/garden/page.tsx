// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { updateUserProfile } from "@/public/js/auth.js";
import {
  HeroMetric, PageHero, Panel, Pill, ProgressBar,
  primaryButton, secondaryButton, rarityStyle, rarityBorder, type Rarity
} from "@/components/game-ui";
import { calculateLevel } from "@/lib/level-system";

const GRID_COLS = 6;
const GRID_ROWS = 4;
const TOTAL_TILES = GRID_COLS * GRID_ROWS;

const GROW_MS: Record<Rarity, number> = {
  common: 7 * 24 * 60 * 60 * 1000,
  rare: 14 * 24 * 60 * 60 * 1000,
  epic: 21 * 24 * 60 * 60 * 1000,
  legendary: 28 * 24 * 60 * 60 * 1000,
};

const HARVEST_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const HARVEST_EP: Record<Rarity, number> = { common: 20, rare: 55, epic: 120, legendary: 280 };
const HARVEST_XP: Record<Rarity, number> = { common: 30, rare: 80, epic: 175, legendary: 400 };
const COMPOST_EP: Record<Rarity, number> = { common: 4, rare: 10, epic: 22, legendary: 45 };

const ICONS = {
  seed: "\u{1F330}",
  sprout: "\u{1F331}",
  herb: "\u{1F33F}",
  flower: "\u{1F338}",
  chest: "\u{1F4E6}",
  timer: "\u23F3",
  compost: "\u267B\uFE0F",
  check: "\u2713",
};

type GrowthStage = "seedling" | "sprouting" | "growing" | "bloomed";

type GardenTile = {
  tileId: number;
  seedId: string;
  seedName: string;
  plantName: string;
  seedImage: string;
  rarity: Rarity;
  placedAt: number;
  lastHarvestAt?: number;
};

type GardenState = Record<string, GardenTile>;

const STAGE_ICON: Record<GrowthStage, string> = {
  seedling: ICONS.seed,
  sprouting: ICONS.sprout,
  growing: ICONS.herb,
  bloomed: ICONS.flower,
};

const STAGE_COLOR: Record<GrowthStage, string> = {
  seedling: "#9a6b1f",
  sprouting: "#4c7a3b",
  growing: "#2f6b46",
  bloomed: "#c97c20",
};

function plantName(seedName: string): string {
  return String(seedName || "Mystery Seed").replace(/ Seed$/i, "").trim();
}

function normalizeRarity(value: unknown): Rarity {
  return (["common", "rare", "epic", "legendary"] as Rarity[]).includes(value as Rarity)
    ? value as Rarity
    : "common";
}

function growthPct(tile: GardenTile, now: number): number {
  const total = GROW_MS[normalizeRarity(tile.rarity)];
  return Math.max(0, Math.min(100, Math.round(((now - Number(tile.placedAt || now)) / total) * 100)));
}

function growthStage(tile: GardenTile, now: number): GrowthStage {
  const pct = growthPct(tile, now);
  if (pct >= 100) return "bloomed";
  if (pct >= 60) return "growing";
  if (pct >= 20) return "sprouting";
  return "seedling";
}

function canHarvest(tile: GardenTile, now: number): boolean {
  if (growthStage(tile, now) !== "bloomed") return false;
  if (!tile.lastHarvestAt) return true;
  return now - tile.lastHarvestAt >= HARVEST_COOLDOWN_MS;
}

function timeRemaining(tile: GardenTile, now: number): number {
  const total = GROW_MS[normalizeRarity(tile.rarity)];
  return Math.max(0, Number(tile.placedAt || now) + total - now);
}

function nextHarvestIn(tile: GardenTile, now: number): number {
  if (!tile.lastHarvestAt) return 0;
  return Math.max(0, tile.lastHarvestAt + HARVEST_COOLDOWN_MS - now);
}

function fmt(ms: number): string {
  if (ms <= 0) return "Ready";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

function seedCount(seed: any): number {
  return Math.max(0, Number(seed?.count ?? 1));
}

export default function GardenPage() {
  const { user, profile, setProfile } = useAuth();
  const processing = useRef(false);

  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState("");
  const [selectingTile, setSelectingTile] = useState<number | null>(null);
  const [harvestAnim, setHarvestAnim] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const garden: GardenState = (profile?.garden as GardenState) ?? {};
  const seeds: any[] = Array.isArray(profile?.seeds) ? profile.seeds : [];

  const plantableSeeds = useMemo(() => (
    seeds
      .filter((seed: any) => seedCount(seed) > 0)
      .sort((a: any, b: any) => {
        const order = { common: 0, rare: 1, epic: 2, legendary: 3 };
        return (order[normalizeRarity(b.rarity)] - order[normalizeRarity(a.rarity)]) || String(a.name).localeCompare(String(b.name));
      })
  ), [seeds]);

  const tiles = Object.values(garden).filter(Boolean);
  const occupiedTiles = new Set(Object.keys(garden).map(Number));
  const totalPlanted = occupiedTiles.size;
  const bloomedCount = tiles.filter(t => growthStage(t, now) === "bloomed").length;
  const harvestableTiles = tiles.filter(t => canHarvest(t, now));
  const harvestableCount = harvestableTiles.length;
  const seedTotal = plantableSeeds.reduce((sum: number, seed: any) => sum + seedCount(seed), 0);
  const nextReadyTile = tiles
    .filter(t => !canHarvest(t, now))
    .sort((a, b) => {
      const aTime = growthStage(a, now) === "bloomed" ? nextHarvestIn(a, now) : timeRemaining(a, now);
      const bTime = growthStage(b, now) === "bloomed" ? nextHarvestIn(b, now) : timeRemaining(b, now);
      return aTime - bTime;
    })[0];

  const saveProfile = async (updates: Record<string, unknown>) => {
    if (!user?.uid || !profile) return false;
    const res = await updateUserProfile(user.uid, updates);
    if (!res.success) return false;
    if (typeof setProfile === "function") setProfile({ ...profile, ...updates });
    return true;
  };

  const plantSeed = async (seed: any) => {
    if (selectingTile === null || !user?.uid || !profile || processing.current) return;
    if (garden[selectingTile]) { setSelectingTile(null); return; }
    processing.current = true;
    try {
      const rarity = normalizeRarity(seed.rarity);
      const tile: GardenTile = {
        tileId: selectingTile,
        seedId: seed.id,
        seedName: seed.name,
        plantName: plantName(seed.name),
        seedImage: seed.image,
        rarity,
        placedAt: Date.now(),
      };
      const nextSeeds = seeds
        .map((s: any) => s.id === seed.id ? { ...s, count: seedCount(s) - 1 } : s)
        .filter((s: any) => seedCount(s) > 0);
      const nextGarden: GardenState = { ...garden, [selectingTile]: tile };
      const ok = await saveProfile({ garden: nextGarden, seeds: nextSeeds });
      showToast(ok ? `${seed.name} planted. First harvest in ${fmt(GROW_MS[rarity])}.` : "Could not plant seed. Try again.");
      if (ok) setSelectingTile(null);
    } finally {
      processing.current = false;
    }
  };

  const removeTile = async (tileId: number) => {
    if (!user?.uid || !profile || processing.current) return;
    const tile = garden[tileId];
    if (!tile) return;
    processing.current = true;
    try {
      const stage = growthStage(tile, Date.now());
      const nextGarden = { ...garden };
      delete nextGarden[tileId];

      if (stage !== "bloomed" && !tile.lastHarvestAt) {
        const nextSeeds = [...seeds];
        const idx = nextSeeds.findIndex((s: any) => s.id === tile.seedId);
        if (idx >= 0) {
          nextSeeds[idx] = { ...nextSeeds[idx], count: seedCount(nextSeeds[idx]) + 1 };
        } else {
          nextSeeds.push({ id: tile.seedId, name: tile.seedName, rarity: tile.rarity, image: tile.seedImage, count: 1 });
        }
        const ok = await saveProfile({ garden: nextGarden, seeds: nextSeeds });
        showToast(ok ? "Young plant returned to your seed bag." : "Could not return seed.");
        return;
      }

      const ep = COMPOST_EP[normalizeRarity(tile.rarity)];
      const ok = await saveProfile({ garden: nextGarden, ecoPoints: Number(profile.ecoPoints ?? 0) + ep });
      showToast(ok ? `Composted ${tile.plantName}. +${ep} EcoPoints.` : "Could not compost plant.");
    } finally {
      processing.current = false;
    }
  };

  const harvest = async (tileId: number) => {
    if (!user?.uid || !profile || processing.current) return;
    const tile = garden[tileId];
    if (!tile || !canHarvest(tile, Date.now())) return;
    processing.current = true;
    try {
      const ts = Date.now();
      setHarvestAnim(tileId);
      setTimeout(() => setHarvestAnim(null), 900);
      const rarity = normalizeRarity(tile.rarity);
      const ep = HARVEST_EP[rarity];
      const xpGain = HARVEST_XP[rarity];
      const nextXp = Number(profile.xp ?? 0) + xpGain;
      const nextGarden: GardenState = { ...garden, [tileId]: { ...tile, lastHarvestAt: ts } };
      const ok = await saveProfile({
        garden: nextGarden,
        ecoPoints: Number(profile.ecoPoints ?? 0) + ep,
        xp: nextXp,
        level: calculateLevel(nextXp),
      });
      showToast(ok ? `Harvested ${tile.plantName}. +${ep} EcoPoints, +${xpGain} XP.` : "Harvest failed. Try again.");
    } finally {
      processing.current = false;
    }
  };

  const harvestAll = async () => {
    if (!user?.uid || !profile || processing.current || harvestableTiles.length === 0) return;
    processing.current = true;
    try {
      const ts = Date.now();
      const nextGarden: GardenState = { ...garden };
      let ep = 0;
      let xp = 0;
      harvestableTiles.forEach((tile) => {
        const rarity = normalizeRarity(tile.rarity);
        nextGarden[tile.tileId] = { ...tile, lastHarvestAt: ts };
        ep += HARVEST_EP[rarity];
        xp += HARVEST_XP[rarity];
      });
      const nextXp = Number(profile.xp ?? 0) + xp;
      const ok = await saveProfile({
        garden: nextGarden,
        ecoPoints: Number(profile.ecoPoints ?? 0) + ep,
        xp: nextXp,
        level: calculateLevel(nextXp),
      });
      showToast(ok ? `Harvested ${harvestableTiles.length} plants. +${ep} EcoPoints, +${xp} XP.` : "Harvest failed. Try again.");
    } finally {
      processing.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Your living world"
        title="Virtual Garden"
        description="Plant seeds from chests, let them grow over time, then harvest recurring EcoPoints and XP."
      >
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Planted" value={totalPlanted} />
          <HeroMetric label="Bloomed" value={bloomedCount} />
          <HeroMetric label="Ready" value={harvestableCount} />
          <HeroMetric label="Seeds" value={seedTotal} />
        </div>
      </PageHero>

      <div className="grid gap-3 md:grid-cols-3">
        <Panel eyebrow="Next action" title={harvestableCount > 0 ? "Harvest Ready" : "Garden Status"}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {harvestableCount > 0 ? `${harvestableCount} plant${harvestableCount === 1 ? "" : "s"} ready` : nextReadyTile ? `${nextReadyTile.plantName} next` : "Ready for seeds"}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {harvestableCount > 0
                  ? "Collect rewards from every bloomed plant that has finished resting."
                  : nextReadyTile
                    ? `Ready in ${growthStage(nextReadyTile, now) === "bloomed" ? fmt(nextHarvestIn(nextReadyTile, now)) : fmt(timeRemaining(nextReadyTile, now))}.`
                    : "Select an empty tile, then choose a seed from your seed bag."}
              </p>
            </div>
            <button type="button" onClick={harvestAll} disabled={harvestableCount === 0} className={harvestableCount > 0 ? primaryButton : secondaryButton} style={harvestableCount === 0 ? { opacity: 0.5 } : undefined}>
              Harvest All
            </button>
          </div>
        </Panel>

        <Panel eyebrow="Capacity" title="Garden Space">
          <div className="flex items-center gap-4">
            <div className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>{totalPlanted}/{TOTAL_TILES}</div>
            <div className="min-w-0 flex-1">
              <ProgressBar value={(totalPlanted / TOTAL_TILES) * 100} color="#2f6b46" />
              <p className="mt-2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{TOTAL_TILES - totalPlanted} open tiles</p>
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Seed bag" title="Inventory">
          <div className="flex items-center gap-4">
            <div className="text-3xl">{ICONS.seed}</div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{seedTotal} seeds available</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{plantableSeeds.length} plant varieties</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Your garden" title="Garden Tiles" action={<Pill>{totalPlanted}/{TOTAL_TILES} planted</Pill>}>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}>
          {Array.from({ length: TOTAL_TILES }).map((_, tileId) => {
            const tile = garden[tileId];
            const stage = tile ? growthStage(tile, now) : null;
            const pct = tile ? growthPct(tile, now) : 0;
            const ready = tile ? canHarvest(tile, now) : false;
            const anim = harvestAnim === tileId;
            const rs = tile ? (rarityStyle[normalizeRarity(tile.rarity)] ?? rarityStyle.common) : null;
            const isSelecting = selectingTile === tileId;

            return (
              <button
                key={tileId}
                type="button"
                onClick={() => {
                  if (tile) return;
                  setSelectingTile(isSelecting ? null : tileId);
                }}
                className={[
                  "relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border transition",
                  isSelecting ? "ring-2 ring-[#2f6b46] ring-offset-1" : "",
                  tile ? "cursor-default" : "cursor-pointer hover:-translate-y-0.5",
                ].join(" ")}
                style={{
                  borderColor: tile ? (rarityBorder[normalizeRarity(tile.rarity)] ?? "var(--border-default)") : "var(--border-default)",
                  background: tile ? `${rs?.accent ?? "#2f6b46"}14` : "var(--bg-panel-alt)",
                }}
                aria-label={tile ? `${tile.plantName}, ${stage}` : `Empty tile ${tileId + 1}`}
              >
                {tile ? (
                  <div className="flex h-full w-full flex-col items-center justify-between p-1.5">
                    <span
                      className={["flex h-full w-full items-center justify-center text-xl transition-transform duration-300", anim ? "scale-150" : ""].join(" ")}
                      style={{ filter: stage === "bloomed" ? "drop-shadow(0 0 6px rgba(201,124,32,.55))" : "none" }}
                    >
                      {stage === "bloomed" && tile.seedImage
                        ? <img src={tile.seedImage} alt={tile.plantName} className="h-full w-full object-contain p-1" />
                        : <span>{STAGE_ICON[stage!]}</span>}
                    </span>
                    {stage !== "bloomed" && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--border-subtle)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: STAGE_COLOR[stage!] }} />
                      </div>
                    )}
                    {stage === "bloomed" && (
                      <span className="text-[7px] font-black uppercase tracking-wide" style={{ color: ready ? "#c97c20" : "var(--text-muted)" }}>
                        {ready ? "Harvest" : "Resting"}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xl font-bold" style={{ color: isSelecting ? "#2f6b46" : "var(--text-muted)" }}>
                    {isSelecting ? ICONS.check : "+"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            {selectingTile !== null ? `Tile ${selectingTile + 1} selected. Choose a seed below.` : "Tap an empty tile to choose where the next seed goes."}
          </p>
          {selectingTile !== null && (
            <button type="button" onClick={() => setSelectingTile(null)} className={secondaryButton}>Cancel Selection</button>
          )}
        </div>
      </Panel>

      {tiles.length > 0 && (
        <Panel eyebrow="What's growing" title="Plant Status" action={harvestableCount > 0 ? <Pill active>{harvestableCount} ready</Pill> : undefined}>
          <div className="grid gap-3 lg:grid-cols-2">
            {tiles.sort((a, b) => a.tileId - b.tileId).map((tile) => {
              const stage = growthStage(tile, now);
              const pct = growthPct(tile, now);
              const ready = canHarvest(tile, now);
              const remMs = timeRemaining(tile, now);
              const coolMs = nextHarvestIn(tile, now);
              const rarity = normalizeRarity(tile.rarity);
              const rs = rarityStyle[rarity] ?? rarityStyle.common;
              const removableYoung = stage !== "bloomed" && !tile.lastHarvestAt;

              return (
                <div key={tile.tileId} className="flex items-center gap-4 rounded-2xl border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel-alt)" }}>
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border text-2xl" style={{ borderColor: rarityBorder[rarity] ?? "var(--border-default)", background: `${rs.accent}14` }}>
                    {stage === "bloomed" && tile.seedImage
                      ? <img src={tile.seedImage} alt={tile.plantName} className="h-full w-full object-contain p-2" />
                      : STAGE_ICON[stage]}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-serif text-sm font-bold" style={{ color: "var(--text-primary)" }}>{tile.plantName}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${rs.chip}`}>{rarity}</span>
                      <Pill>Tile {tile.tileId + 1}</Pill>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold capitalize" style={{ color: STAGE_COLOR[stage] }}>
                      {STAGE_ICON[stage]} {stage}
                      {stage !== "bloomed" && ` - ${fmt(remMs)} remaining`}
                      {stage === "bloomed" && coolMs > 0 && ` - harvest resets in ${fmt(coolMs)}`}
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
                        +{HARVEST_EP[rarity]} EP
                      </button>
                    )}
                    <button type="button" onClick={() => removeTile(tile.tileId)} className={secondaryButton}>
                      {removableYoung ? "Return Seed" : `Compost +${COMPOST_EP[rarity]}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel eyebrow="Seed bag" title="Your Seeds" action={<Pill>{seedTotal} seeds</Pill>}>
        {plantableSeeds.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="text-5xl">{ICONS.seed}</span>
            <p className="font-serif text-lg font-bold" style={{ color: "var(--text-primary)" }}>No seeds yet</p>
            <p className="max-w-xs text-sm" style={{ color: "var(--text-muted)" }}>
              Open chests from your Collection to find seeds. Each chest can drop something new for the garden.
            </p>
            <a href="/collection" className={primaryButton}>Open Chests</a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {plantableSeeds.map((seed: any) => {
                const rarity = normalizeRarity(seed.rarity);
                const rs = rarityStyle[rarity] ?? rarityStyle.common;
                const rb = rarityBorder[rarity] ?? "var(--border-default)";
                const active = selectingTile !== null;
                return (
                  <button
                    key={seed.id}
                    type="button"
                    disabled={!active}
                    onClick={() => active && plantSeed(seed)}
                    className="group flex min-h-[178px] flex-col items-center gap-2 rounded-2xl border p-3 text-center transition hover:-translate-y-0.5"
                    style={{
                      borderColor: active ? rs.accent : rb,
                      background: active ? `${rs.accent}18` : "var(--bg-card)",
                      cursor: active ? "pointer" : "default",
                      opacity: active ? 1 : 0.72,
                    }}
                  >
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl" style={{ background: `${rs.accent}14` }}>
                      {seed.image
                        ? <img src={seed.image} alt={seed.name} className="h-full w-full object-contain p-2 transition group-hover:scale-110" />
                        : <span className="text-3xl">{ICONS.seed}</span>}
                    </div>
                    <p className="text-xs font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>{seed.name}</p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${rs.chip}`}>{rarity}</span>
                      <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>x{seedCount(seed)}</span>
                    </div>
                    <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>First harvest in {fmt(GROW_MS[rarity])}</p>
                    {active && <span className="text-[10px] font-extrabold text-emerald-600">Tap to plant</span>}
                  </button>
                );
              })}
            </div>

            {selectingTile === null && (
              <p className="mt-4 text-center text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Select an empty garden tile first, then choose a seed here.
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel eyebrow="Guide" title="Garden Rules">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { icon: ICONS.chest, title: "1. Find seeds", desc: "Open chests in your Collection. Better chests can drop rarer seeds." },
            { icon: ICONS.seed, title: "2. Plant once", desc: "Select an empty tile, then pick a seed. Young plants can be returned to your seed bag." },
            { icon: ICONS.timer, title: "3. Let it grow", desc: "Plants pass through seedling, sprouting, growing, and bloomed stages." },
            { icon: ICONS.flower, title: "4. Harvest forever", desc: "Bloomed plants can be harvested again every 3 days, or composted to free a tile." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rounded-2xl p-4" style={{ background: "var(--bg-panel-alt)" }}>
              <div className="mb-2 text-2xl">{icon}</div>
              <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-default)" }}>
          <div className="grid grid-cols-4 border-b px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel-alt)", color: "var(--text-muted)" }}>
            <span>Rarity</span><span className="text-center">Grow time</span><span className="text-center">Harvest EP</span><span className="text-center">Harvest XP</span>
          </div>
          {(["common", "rare", "epic", "legendary"] as Rarity[]).map(r => {
            const rs = rarityStyle[r];
            return (
              <div key={r} className="grid grid-cols-4 border-b px-4 py-3 text-sm last:border-0" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel)" }}>
                <span className={`w-fit rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${rs.chip}`}>{r}</span>
                <span className="text-center font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(GROW_MS[r])}</span>
                <span className="text-center font-semibold" style={{ color: "#9a6b1f" }}>{HARVEST_EP[r]} EP</span>
                <span className="text-center font-semibold" style={{ color: "#2f6b46" }}>{HARVEST_XP[r]} XP</span>
              </div>
            );
          })}
        </div>
      </Panel>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl" style={{ background: "var(--bg-sidebar)", color: "var(--text-sidebar)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
