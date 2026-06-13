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
  { id: 1, name: "Mossy Fern", rarity: "common", mark: "MF", count: 0, image: "/images/plants/mint.png" },
  { id: 2, name: "Golden Daisy", rarity: "common", mark: "GD", count: 0, image: "/images/plants/sunflower.png" },
  { id: 3, name: "Blue Orchid", rarity: "rare", mark: "BO", count: 0, image: "/images/plants/orchid.png" },
  { id: 4, name: "Mystic Bamboo", rarity: "epic", mark: "MB", count: 0, image: "/images/plants/bamboo.png" },
  { id: 5, name: "Aurora Blossom", rarity: "legendary", mark: "AB", count: 0, image: "/images/plants/cherry_blossom.png" },
  { id: 6, name: "Spotted Aloe", rarity: "rare", mark: "SA", count: 0, image: "/images/plants/basil.png" }
];

const sampleAnimals = [
  { id: 1, name: "Forest Fox", rarity: "rare", mark: "FX", count: 0, active: false, image: "/images/pets/wolf.png" },
  { id: 2, name: "Mystic Owl", rarity: "epic", mark: "OW", count: 0, active: false, image: "/images/pets/owl.png" },
  { id: 3, name: "Golden Deer", rarity: "legendary", mark: "DR", count: 0, active: false, image: "/images/pets/deer.png" }
];

const assetByName: Record<string, string> = {
  "Mossy Fern": "/images/plants/mint.png",
  "Golden Daisy": "/images/plants/sunflower.png",
  "Blue Orchid": "/images/plants/orchid.png",
  "Spotted Aloe": "/images/plants/basil.png",
  "Mystic Bamboo": "/images/plants/bamboo.png",
  "Crystal Lotus": "/images/plants/lotus.png",
  "Aurora Blossom": "/images/plants/cherry_blossom.png",
  "Ember Cactus": "/images/plants/dragonfruit.png",
  "Common Egg": "/images/eggs/common-egg.png",
  "Rare Egg": "/images/eggs/rare-egg.png",
  "Epic Egg": "/images/eggs/epic-egg.png",
  "Legendary Egg": "/images/eggs/legendary-egg.png",
  Cat: "/images/pets/cat.png",
  Deer: "/images/pets/deer.png",
  Wolf: "/images/pets/wolf.png",
  Bear: "/images/pets/bear.png",
  Eagle: "/images/pets/eagle.png",
  Tiger: "/images/pets/tiger.png",
  Lion: "/images/pets/lion.png",
  Owl: "/images/pets/owl.png"
};

function getAsset(item: any, mode: CollMode) {
  return item.image || assetByName[item.name] || (mode === "plants" ? "/images/plants/sunflower.png" : "/images/pets/cat.png");
}

export default function CollectionPage() {
  const { profile } = useAuth();
  const ecoPoints = profile?.ecoPoints ?? 0;
  const [mode, setMode] = useState<CollMode>("plants");
  const [filter, setFilter] = useState<"all" | Rarity>("all");

  const profilePlants = Array.isArray(profile?.plants) ? profile.plants : [];
  const profileAnimals = Array.isArray(profile?.animals) ? profile.animals : [];
  const items = mode === "plants" ? profilePlants : profileAnimals;
  const filtered = filter === "all" ? items : items.filter((item) => item.rarity === filter);
  const totalPlants = profilePlants.reduce((sum, plant) => sum + (plant.count ?? 1), 0);
  const totalAnimals = profileAnimals.reduce((sum, animal) => sum + (animal.count ?? 1), 0);
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
            <img src="/images/plants/sunflower.png" alt="" className="h-20 w-20 object-contain opacity-70" />
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
              <article key={item.id} className="reveal-card group relative flex flex-col overflow-hidden rounded-[22px] border bg-[#fffefa] shadow-[0_18px_48px_rgba(26,45,29,0.07)] transition hover:-translate-y-1 hover:shadow-[0_24px_58px_rgba(26,45,29,0.11)]" style={{ borderColor: style.border }}>
                {(item as any).active && <span className="absolute left-2 top-2 z-10 rounded-full bg-[#fbf4df] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#76511a]">Active</span>}
                {(item as any).count > 1 && <span className="absolute right-2 top-2 z-10 rounded-full bg-forest-950 px-2.5 py-1 text-[10px] font-extrabold text-cream-100">x{(item as any).count}</span>}
                <div className="relative flex h-36 items-center justify-center overflow-hidden" style={{ background: `${style.accent}14` }}>
                  <div className="absolute inset-x-8 bottom-5 h-7 rounded-full bg-black/8 blur-xl transition group-hover:scale-110" />
                  <img
                    src={getAsset(item, mode)}
                    alt={item.name}
                    loading="lazy"
                    className="relative h-24 w-24 object-contain drop-shadow-[0_12px_16px_rgba(16,33,20,0.14)] transition duration-300 group-hover:scale-110"
                  />
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
