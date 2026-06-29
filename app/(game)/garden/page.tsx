// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { updateUserProfile } from "@/public/js/auth.js";
import {
  HeroMetric, PageHero, Panel, Pill, ProgressBar,
  primaryButton, secondaryButton, rarityStyle, rarityBorder, type Rarity
} from "@/components/game-ui";
import { calculateLevel } from "@/lib/level-system";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GRID_COLS = 6;
const GRID_ROWS = 4;
const TOTAL_TILES = GRID_COLS * GRID_ROWS;

// Seeds take ~1 week to fully bloom (common), longer for rarer seeds.
const GROW_MS: Record<Rarity, number> = {
  common:    7  * 24 * 60 * 60 * 1000,  //  7 days
  rare:      14 * 24 * 60 * 60 * 1000,  // 14 days
  epic:      21 * 24 * 60 * 60 * 1000,  // 21 days
  legendary: 28 * 24 * 60 * 60 * 1000,  // 28 days
};

// Harvest resets every 3 days once bloomed
const HARVEST_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

const HARVEST_EP: Record<Rarity, number>  = { common: 20,  rare: 55,   epic: 120,  legendary: 280  };
const HARVEST_XP: Record<Rarity, number>  = { common: 30,  rare: 80,   epic: 175,  legendary: 400  };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type GrowthStage = "seedling" | "sprouting" | "growing" | "bloomed";

type GardenTile = {
  tileId: number;
  seedId: string;
  seedName: string;      // e.g. "Mossy Fern Seed"
  plantName: string;     // e.g. "Mossy Fern"  (derived by stripping " Seed")
  seedImage: string;
  rarity: Rarity;
  placedAt: number;      // ms timestamp
  lastHarvestAt?: number;
};

// garden state stored as profile.garden: Record<string, GardenTile>
type GardenState = Record<string, GardenTile>;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function plantName(seedName: string): string {
  return seedName.replace(/ Seed$/i, "").trim();
}

function growthStage(tile: GardenTile, now: number): GrowthStage {
  const pct = growthPct(tile, now);
  if (pct >= 100) return "bloomed";
  if (pct >= 60)  return "growing";
  if (pct >= 20)  return "sprouting";
  return "seedling";
}

function growthPct(tile: GardenTile, now: number): number {
  const total = GROW_MS[tile.rarity] ?? GROW_MS.common;
  return Math.min(100, Math.round(((now - tile.placedAt) / total) * 100));
}

function canHarvest(tile: GardenTile, now: number): boolean {
  if (growthStage(tile, now) !== "bloomed") return false;
  if (!tile.lastHarvestAt) return true;
  return now - tile.lastHarvestAt >= HARVEST_COOLDOWN_MS;
}

function timeRemaining(tile: GardenTile, now: number): number {
  const total = GROW_MS[tile.rarity] ?? GROW_MS.common;
  return Math.max(0, tile.placedAt + total - now);
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
  return `${m}m`;
}

const STAGE_ICON: Record<GrowthStage, string> = {
  seedling:  "🌰",
  sprouting: "🌱",
  growing:   "🌿",
  bloomed:   "🌸",
};

const STAGE_COLOR: Record<GrowthStage, string> = {
  seedling:  "#9a6b1f",
  sprouting: "#4c7a3b",
  growing:   "#2f6b46",
  bloomed:   "#c97c20",
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function GardenPage() {
  const { user, profile, setProfile } = useAuth();
  const processing = useRef(false);

  // Live clock — ticks every 30 s so countdowns update without hammering React
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [toast, setToast]               = useState("");
  const [selectingTile, setSelectingTile] = useState<number | null>(null);
  const [harvestAnim, setHarvestAnim]   = useState<number | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  // ── Derived state ──────────────────────────────────────────────────────────
  const garden: GardenState   = (profile?.garden as GardenState) ?? {};
  const seeds: any[]          = Array.isArray(profile?.seeds) ? profile.seeds : [];
  const plantableSeeds        = seeds.filter((s: any) => (s.count ?? 1) > 0);
  const occupiedTiles         = new Set(Object.keys(garden).map(Number));
  const totalPlanted          = occupiedTiles.size;
  const bloomedCount          = Object.values(garden).filter(t => growthStage(t, now) === "bloomed").length;
  const harvestableCount      = Object.values(garden).filter(t => canHarvest(t, now)).length;

  // ── Plant a seed ───────────────────────────────────────────────────────────
  const plantSeed = async (seed: any) => {
    if (selectingTile === null || !user?.uid || !profile || processing.current) return;
    processing.current = true;
    try {
      const tile: GardenTile = {
        tileId:    selectingTile,
        seedId:    seed.id,
        seedName:  seed.name,
        plantName: plantName(seed.name),
        seedImage: seed.image,
        rarity:    seed.rarity as Rarity,
        placedAt:  Date.now(),
      };
      const nextSeeds = seeds
        .map((s: any) => s.id === seed.id ? { ...s, count: (s.count ?? 1) - 1 } : s)
        .filter((s: any) => (s.count ?? 1) > 0);
      const nextGarden: GardenState = { ...garden, [selectingTile]: tile };
      const updates = { garden: nextGarden, seeds: nextSeeds };
      const res = await updateUserProfile(user.uid, updates);
      if (!res.success) { showToast("Could not plant seed. Try again."); return; }
      if (typeof setProfile === "function") setProfile({ ...profile, ...updates });
      showToast(`${seed.name} planted! 🌰 Come back in ${fmt(GROW_MS[seed.rarity as Rarity] ?? GROW_MS.common)}.`);
      setSelectingTile(null);
    } finally { processing.current = false; }
  };

  // ── Uproot a tile ──────────────────────────────────────────────────────────
  const uproot = async (tileId: number) => {
    if (!user?.uid || !profile || processing.current) return;
    const tile = garden[tileId];
    if (!tile) return;
    processing.current = true;
    try {
      const nextSeeds = [...seeds];
      const idx = nextSeeds.findIndex((s: any) => s.id === tile.seedId);
      if (idx >= 0) {
        nextSeeds[idx] = { ...nextSeeds[idx], count: (nextSeeds[idx].count ?? 0) + 1 };
      } else {
        nextSeeds.push({ id: tile.seedId, name: tile.seedName, rarity: tile.rarity, image: tile.seedImage, count: 1 });
      }
      const nextGarden = { ...garden };
      delete nextGarden[tileId];
      const updates = { garden: nextGarden, seeds: nextSeeds };
      const res = await updateUserProfile(user.uid, updates);
      if (!res.success) { showToast("Could not uproot."); return; }
      if (typeof setProfile === "function") setProfile({ ...profile, ...updates });
      showToast("Seed returned to inventory.");
    } finally { processing.current = false; }
  };

  // ── Harvest ────────────────────────────────────────────────────────────────
  const harvest = async (tileId: number) => {
    if (!user?.uid || !profile || processing.current) return;
    const tile = garden[tileId];
    if (!tile || !canHarvest(tile, Date.now())) return;
    processing.current = true;
    try {
      setHarvestAnim(tileId);
      setTimeout(() => setHarvestAnim(null), 900);
      const ep     = HARVEST_EP[tile.rarity] ?? HARVEST_EP.common;
      const xpGain = HARVEST_XP[tile.rarity] ?? HARVEST_XP.common;
      const nextXp = Number(profile.xp ?? 0) + xpGain;
      const nextGarden: GardenState = { ...garden, [tileId]: { ...tile, lastHarvestAt: Date.now() } };
      const updates = {
        garden: nextGarden,
        ecoPoints: Number(profile.ecoPoints ?? 0) + ep,
        xp: nextXp,
        level: calculateLevel(nextXp),
      };
      const res = await updateUserProfile(user.uid, updates);
      if (!res.success) { showToast("Harvest failed. Try again."); return; }
      if (typeof setProfile === "function") setProfile({ ...profile, ...updates });
      showToast(`Harvested ${tile.plantName}! +${ep} EcoPoints +${xpGain} XP 🌸`);
    } finally { processing.current = false; }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      {/* Hero */}
      <PageHero
        eyebrow="Your living world"
        title="Virtual Garden"
        description="Open chests to collect seeds. Plant them in your garden and wait up to a week for them to bloom into EcoPoints and XP."
      >
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Planted"     value={totalPlanted} />
          <HeroMetric label="Bloomed"     value={bloomedCount} />
          <HeroMetric label="Harvestable" value={harvestableCount} />
          <HeroMetric label="Seeds"       value={plantableSeeds.length} />
        </div>
      </PageHero>

      {/* ── Garden grid ──────────────────────────────────────────────────── */}
      <Panel
        eyebrow="Your garden"
        title="Garden Tiles"
        action={<Pill>{totalPlanted}/{TOTAL_TILES} planted</Pill>}
      >
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}>
          {Array.from({ length: TOTAL_TILES }).map((_, tileId) => {
            const tile    = garden[tileId];
            const stage   = tile ? growthStage(tile, now) : null;
            const pct     = tile ? growthPct(tile, now)   : 0;
            const ready   = tile ? canHarvest(tile, now)  : false;
            const anim    = harvestAnim === tileId;
            const rs      = tile ? (rarityStyle[tile.rarity] ?? rarityStyle.common) : null;
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
                  "relative flex flex-col items-center justify-center rounded-2xl border transition aspect-square overflow-hidden",
                  isSelecting ? "ring-2 ring-[#2f6b46] ring-offset-1" : "",
                  tile ? "cursor-default" : "hover:-translate-y-0.5 cursor-pointer",
                ].join(" ")}
                style={{
                  borderColor: tile ? (rarityBorder[tile.rarity] ?? "var(--border-default)") : "var(--border-default)",
                  background: tile ? `${rs?.accent ?? "#2f6b46"}14` : "var(--bg-panel-alt)",
                }}
                aria-label={tile ? `${tile.plantName} — ${stage}` : `Empty tile ${tileId + 1}`}
              >
                {tile ? (
                  <div className="flex h-full w-full flex-col items-center justify-between p-1.5">
                    <span
                      className={["flex h-full w-full items-center justify-center text-xl transition-transform duration-300", anim ? "scale-150" : ""].join(" ")}
                      style={{ filter: stage === "bloomed" ? "drop-shadow(0 0 6px gold)" : "none" }}
                    >
                      {/* Show the actual plant image once bloomed, emoji otherwise */}
                      {stage === "bloomed"
                        ? <img src={tile.seedImage} alt={tile.plantName} className="h-full w-full object-contain p-1" />
                        : <span>{STAGE_ICON[stage!]}</span>}
                    </span>
                    {stage !== "bloomed" && (
                      <div className="w-full h-1 rounded-full overflow-hidden mt-1" style={{ background: "var(--border-subtle)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: STAGE_COLOR[stage!] }} />
                      </div>
                    )}
                    {stage === "bloomed" && (
                      <span className="text-[7px] font-black uppercase tracking-wide" style={{ color: ready ? "#c97c20" : "var(--text-muted)" }}>
                        {ready ? "Harvest!" : "Resting"}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xl font-bold" style={{ color: isSelecting ? "#2f6b46" : "var(--text-muted)" }}>
                    {isSelecting ? "✓" : "+"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectingTile !== null && (
          <p className="mt-3 text-center text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            Tile {selectingTile + 1} selected — choose a seed from your inventory below.
          </p>
        )}
        {selectingTile !== null && (
          <button type="button" onClick={() => setSelectingTile(null)} className={`mt-2 w-full ${secondaryButton}`}>
            Cancel selection
          </button>
        )}
      </Panel>

      {/* ── Growing plants status ─────────────────────────────────────────── */}
      {Object.values(garden).length > 0 && (
        <Panel eyebrow="What's growing" title="Plant Status">
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {Object.values(garden)
              .sort((a, b) => a.tileId - b.tileId)
              .map((tile) => {
                const stage   = growthStage(tile, now);
                const pct     = growthPct(tile, now);
                const ready   = canHarvest(tile, now);
                const remMs   = timeRemaining(tile, now);
                const coolMs  = nextHarvestIn(tile, now);
                const rs      = rarityStyle[tile.rarity] ?? rarityStyle.common;

                return (
                  <div key={tile.tileId} className="flex items-center gap-4 py-4">
                    {/* Thumbnail */}
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border overflow-hidden text-2xl"
                      style={{ borderColor: rarityBorder[tile.rarity] ?? "var(--border-default)", background: `${rs.accent}14` }}
                    >
                      {stage === "bloomed"
                        ? <img src={tile.seedImage} alt={tile.plantName} className="h-full w-full object-contain p-2" />
                        : STAGE_ICON[stage]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-serif text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                          {tile.plantName}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${rs.chip}`}>
                          {tile.rarity}
                        </span>
                        <Pill>Tile {tile.tileId + 1}</Pill>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold capitalize" style={{ color: STAGE_COLOR[stage] }}>
                        {STAGE_ICON[stage]} {stage}
                        {stage !== "bloomed" && ` — ${fmt(remMs)} remaining`}
                        {stage === "bloomed" && coolMs > 0 && ` — harvest resets in ${fmt(coolMs)}`}
                        {stage === "bloomed" && coolMs === 0 && ready && " — ready to harvest!"}
                      </p>
                      {stage !== "bloomed" && (
                        <div className="mt-1.5">
                          <ProgressBar value={pct} color={STAGE_COLOR[stage]} />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {ready && (
                        <button type="button" onClick={() => harvest(tile.tileId)} className={primaryButton}>
                          +{HARVEST_EP[tile.rarity]} EP
                        </button>
                      )}
                      <button type="button" onClick={() => uproot(tile.tileId)} className={secondaryButton}>
                        Uproot
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </Panel>
      )}

      {/* ── Seed inventory ────────────────────────────────────────────────── */}
      <Panel
        eyebrow="Seed bag"
        title="Your Seeds"
        action={<Pill>{plantableSeeds.reduce((s: number, seed: any) => s + (seed.count ?? 1), 0)} seeds</Pill>}
      >
        {plantableSeeds.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="text-5xl">🌰</span>
            <p className="font-serif text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              No seeds yet
            </p>
            <p className="max-w-xs text-sm" style={{ color: "var(--text-muted)" }}>
              Open Chests from your Collection to find seeds. Each chest has a chance to drop a seed you can plant here.
            </p>
            <a href="/collection" className={primaryButton}>Open Chests</a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {plantableSeeds.map((seed: any) => {
                const rs     = rarityStyle[seed.rarity as Rarity] ?? rarityStyle.common;
                const rb     = rarityBorder[seed.rarity as Rarity] ?? "var(--border-default)";
                const active = selectingTile !== null;
                return (
                  <button
                    key={seed.id}
                    type="button"
                    disabled={!active}
                    onClick={() => active && plantSeed(seed)}
                    className="group flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition hover:-translate-y-0.5"
                    style={{
                      borderColor: active ? rs.accent : rb,
                      background:  active ? `${rs.accent}18` : "var(--bg-card)",
                      cursor:      active ? "pointer" : "default",
                    }}
                  >
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-xl overflow-hidden"
                      style={{ background: `${rs.accent}14` }}
                    >
                      <img
                        src={seed.image}
                        alt={seed.name}
                        className="h-full w-full object-contain p-2 transition group-hover:scale-110"
                      />
                    </div>
                    <p className="text-xs font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>
                      {seed.name}
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${rs.chip}`}>
                        {seed.rarity}
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                        ×{seed.count ?? 1}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                      Grows in {fmt(GROW_MS[seed.rarity as Rarity] ?? GROW_MS.common)}
                    </p>
                    {active && (
                      <span className="text-[10px] font-extrabold text-emerald-600">Tap to plant</span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectingTile === null && (
              <p className="mt-4 text-center text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Tap an empty tile (the <strong>+</strong> squares) above, then tap a seed here to plant it.
              </p>
            )}
          </>
        )}
      </Panel>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <Panel eyebrow="Guide" title="How the Garden Works">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            {
              icon: "📦",
              title: "1. Open a Chest",
              desc: "Every chest in your Collection has a chance to drop a seed. Rarer chests drop rarer seeds.",
            },
            {
              icon: "🌰",
              title: "2. Plant the seed",
              desc: "Select an empty tile, then tap your seed. Common seeds take 7 days. Legendary seeds take 28 days.",
            },
            {
              icon: "⏳",
              title: "3. Wait & watch",
              desc: "Seeds go through Seedling → Sprouting → Growing → Bloomed. Come back to check progress.",
            },
            {
              icon: "🌸",
              title: "4. Harvest",
              desc: `Once bloomed, harvest for ${HARVEST_EP.common}–${HARVEST_EP.legendary} EcoPoints and ${HARVEST_XP.common}–${HARVEST_XP.legendary} XP. Resets every 3 days.`,
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rounded-2xl p-4" style={{ background: "var(--bg-panel-alt)" }}>
              <div className="mb-2 text-2xl">{icon}</div>
              <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Rarity grow-time table */}
        <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-default)" }}>
          <div className="grid grid-cols-4 border-b px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em]"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel-alt)", color: "var(--text-muted)" }}>
            <span>Rarity</span><span className="text-center">Grow time</span><span className="text-center">Harvest EP</span><span className="text-center">Harvest XP</span>
          </div>
          {(["common", "rare", "epic", "legendary"] as Rarity[]).map(r => {
            const rs = rarityStyle[r];
            return (
              <div key={r} className="grid grid-cols-4 border-b px-4 py-3 last:border-0 text-sm"
                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel)" }}>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide w-fit ${rs.chip}`}>{r}</span>
                <span className="text-center font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(GROW_MS[r])}</span>
                <span className="text-center font-semibold" style={{ color: "#9a6b1f" }}>{HARVEST_EP[r]} EP</span>
                <span className="text-center font-semibold" style={{ color: "#2f6b46" }}>{HARVEST_XP[r]} XP</span>
              </div>
            );
          })}
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
