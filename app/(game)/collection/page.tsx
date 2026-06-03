// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { HeroMetric, PageHero, Panel } from "@/components/game-ui";

type Rarity = "common" | "rare" | "epic" | "legendary";
type CollMode = "plants" | "animals";

const rarityStyle: Record<Rarity, { border: string; chip: string; accent: string }> = {
  common: { border: "#d9e2d2", chip: "bg-[#eef2e8] text-[#344534]", accent: "#7c8b74" },
  rare: { border: "#bed0dd", chip: "bg-[#edf5f8] text-[#27556b]", accent: "#2f5f86" },
  epic: { border: "#d2c9df", chip: "bg-[#f2eff7] text-[#594174]", accent: "#62508f" },
  legendary: { border: "#e6d3a6", chip: "bg-[#fbf4df] text-[#76511a]", accent: "#9a6b1f" }
};

const samplePlants = [
  { id: 1, name: "Mossy Fern", rarity: "common", mark: "MF", count: 3 },
  { id: 2, name: "Golden Daisy", rarity: "common", mark: "GD", count: 1 },
  { id: 3, name: "Blue Orchid", rarity: "rare", mark: "BO", count: 2 },
  { id: 4, name: "Mystic Bamboo", rarity: "epic", mark: "MB", count: 1 },
  { id: 5, name: "Aurora Blossom", rarity: "legendary", mark: "AB", count: 1 },
  { id: 6, name: "Spotted Aloe", rarity: "rare", mark: "SA", count: 1 }
];

const sampleAnimals = [
  { id: 1, name: "Forest Fox", rarity: "rare", mark: "FX", count: 1, active: true },
  { id: 2, name: "Mystic Owl", rarity: "epic", mark: "OW", count: 1, active: false },
  { id: 3, name: "Golden Deer", rarity: "legendary", mark: "DR", count: 1, active: false }
];

export default function CollectionPage() {
  const { profile } = useAuth();
  const ecoPoints = profile?.ecoPoints ?? 0;
  const [mode, setMode] = useState<CollMode>("plants");
  const [filter, setFilter] = useState<"all" | Rarity>("all");

  const items = mode === "plants" ? samplePlants : sampleAnimals;
  const filtered = filter === "all" ? items : items.filter((item) => item.rarity === filter);
  const totalPlants = samplePlants.reduce((sum, plant) => sum + plant.count, 0);
  const totalAnimals = sampleAnimals.length;
  const tabs: ("all" | Rarity)[] = ["all", "common", "rare", "epic", "legendary"];

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Your nature collection" title="My Collection" description="Every plant and companion you have grown through completed actions.">
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Plants" value={totalPlants} />
          <HeroMetric label="Animals" value={totalAnimals} />
          <HeroMetric label="Eco" value={ecoPoints.toLocaleString()} />
        </div>
      </PageHero>

      <Panel>
        <div className="flex flex-col gap-4">
          <div className="inline-flex w-fit rounded-full border border-[#dce6d8] bg-[#f4f7ef] p-1">
            {(["plants", "animals"] as CollMode[]).map((itemMode) => (
              <button
                key={itemMode}
                onClick={() => { setMode(itemMode); setFilter("all"); }}
                className={`rounded-full px-5 py-2 text-sm font-extrabold capitalize transition ${mode === itemMode ? "bg-forest-950 text-cream-100 shadow-sm" : "text-forest-700 hover:text-forest-950"}`}
              >
                {itemMode}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((rarity) => (
              <button
                key={rarity}
                onClick={() => setFilter(rarity)}
                className={`rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-[0.08em] transition ${filter === rarity ? "bg-forest-950 text-cream-100" : "border border-[#dce6d8] bg-[#f4f7ef] text-forest-700 hover:border-forest-500"}`}
              >
                {rarity}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <Panel>
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-100 text-xl font-extrabold text-forest-800">CO</span>
            <div>
              <p className="font-serif text-2xl font-extrabold text-forest-950">Nothing here yet</p>
              <p className="mt-1 text-sm text-forest-700/64">Visit the Shop to start your collection.</p>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((item) => {
            const style = rarityStyle[item.rarity as Rarity];
            return (
              <article key={item.id} className="relative flex flex-col overflow-hidden rounded-[22px] border bg-[#fffefa] shadow-[0_18px_48px_rgba(26,45,29,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_58px_rgba(26,45,29,0.11)]" style={{ borderColor: style.border }}>
                {(item as any).active && <span className="absolute left-2 top-2 z-10 rounded-full bg-[#fbf4df] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#76511a]">Active</span>}
                {(item as any).count > 1 && <span className="absolute right-2 top-2 z-10 rounded-full bg-forest-950 px-2.5 py-1 text-[10px] font-extrabold text-cream-100">x{(item as any).count}</span>}
                <div className="flex h-32 items-center justify-center" style={{ background: `${style.accent}14` }}>
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/86 font-serif text-2xl font-extrabold" style={{ color: style.accent }}>{item.mark}</span>
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <p className="font-serif text-base font-extrabold leading-tight text-forest-950">{item.name}</p>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${style.chip}`}>{item.rarity}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
