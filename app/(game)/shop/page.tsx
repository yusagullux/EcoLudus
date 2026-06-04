// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { updateUserProfile } from "@/public/js/auth.js";
import { HeroMetric, PageHero, Panel, Pill, primaryButton } from "@/components/game-ui";

type Rarity = "common" | "rare" | "epic" | "legendary";
type Mode = "plants" | "eggs";

type ShopItem = {
  id: number;
  name: string;
  rarity: Rarity;
  price: number;
  mark: string;
  hatchTime?: string;
};

const rarityStyle: Record<Rarity, { border: string; chip: string; accent: string }> = {
  common: { border: "#d9e2d2", chip: "bg-[#eef2e8] text-[#344534]", accent: "#7c8b74" },
  rare: { border: "#bed0dd", chip: "bg-[#edf5f8] text-[#27556b]", accent: "#2f5f86" },
  epic: { border: "#d2c9df", chip: "bg-[#f2eff7] text-[#594174]", accent: "#62508f" },
  legendary: { border: "#e6d3a6", chip: "bg-[#fbf4df] text-[#76511a]", accent: "#9a6b1f" }
};

const plants = [
  { id: 1, name: "Mossy Fern", rarity: "common", price: 50, mark: "MF" },
  { id: 2, name: "Golden Daisy", rarity: "common", price: 60, mark: "GD" },
  { id: 3, name: "Blue Orchid", rarity: "rare", price: 180, mark: "BO" },
  { id: 4, name: "Spotted Aloe", rarity: "rare", price: 200, mark: "SA" },
  { id: 5, name: "Mystic Bamboo", rarity: "epic", price: 450, mark: "MB" },
  { id: 6, name: "Crystal Lotus", rarity: "epic", price: 500, mark: "CL" },
  { id: 7, name: "Aurora Blossom", rarity: "legendary", price: 1200, mark: "AB" },
  { id: 8, name: "Ember Cactus", rarity: "legendary", price: 1500, mark: "EC" }
];

const eggs = [
  { id: 1, name: "Common Egg", rarity: "common", price: 100, mark: "CE", hatchTime: "1h" },
  { id: 2, name: "Rare Egg", rarity: "rare", price: 300, mark: "RE", hatchTime: "4h" },
  { id: 3, name: "Epic Egg", rarity: "epic", price: 700, mark: "EE", hatchTime: "12h" },
  { id: 4, name: "Legendary Egg", rarity: "legendary", price: 1800, mark: "LE", hatchTime: "24h" }
];

export default function ShopPage() {
  const { user, profile, setProfile } = useAuth();
  const ecoPoints = profile?.ecoPoints ?? 0;
  const [mode, setMode] = useState<Mode>("plants");
  const [filter, setFilter] = useState<"all" | Rarity>("all");
  const [toast, setToast] = useState("");

  const items = mode === "plants" ? plants : eggs;
  const filtered = filter === "all" ? items : items.filter((item) => item.rarity === filter);
  const tabs: ("all" | Rarity)[] = ["all", "common", "rare", "epic", "legendary"];

  const handleBuy = async (item: ShopItem) => {
    if (!profile || !user) {
      setToast("Please log in to purchase items.");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    if (ecoPoints < item.price) {
      setToast(`Need ${item.price} EcoPoints; you have ${ecoPoints}.`);
      setTimeout(() => setToast(""), 3000);
      return;
    }

    const currentPlants = Array.isArray(profile.plants) ? profile.plants : [];
    const currentEggs = Array.isArray(profile.eggs) ? profile.eggs : [];

    const nextEcoPoints = ecoPoints - item.price;
    const profileUpdates: Record<string, unknown> = {
      ecoPoints: nextEcoPoints
    };

    if (mode === "plants") {
      const existingIndex = currentPlants.findIndex((entry) => entry.id === item.id);
      const nextPlants = [...currentPlants];

      if (existingIndex >= 0) {
        const existingPlant = nextPlants[existingIndex];
        nextPlants[existingIndex] = {
          ...existingPlant,
          count: (existingPlant.count ?? 1) + 1,
          purchasedAt: new Date().toISOString()
        };
      } else {
        nextPlants.push({ ...item, count: 1, purchasedAt: new Date().toISOString() });
      }

      profileUpdates.plants = nextPlants;
    } else {
      const existingIndex = currentEggs.findIndex((entry) => entry.id === item.id);
      const nextEggs = [...currentEggs];

      if (existingIndex >= 0) {
        const existingEgg = nextEggs[existingIndex];
        nextEggs[existingIndex] = {
          ...existingEgg,
          count: (existingEgg.count ?? 1) + 1,
          purchasedAt: new Date().toISOString()
        };
      } else {
        nextEggs.push({ ...item, count: 1, purchasedAt: new Date().toISOString() });
      }

      profileUpdates.eggs = nextEggs;
    }

    const result = await updateUserProfile(user.uid, profileUpdates);

    if (!result.success) {
      setToast("Purchase failed. Please try again.");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...profileUpdates });
    }

    setToast(`${item.name} added to collection!`);
    setTimeout(() => setToast(""), 3000);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Nature store" title="Plant Shop" description="Spend EcoPoints on rare plants and mysterious eggs.">
        <HeroMetric label="EcoPoints" value={ecoPoints.toLocaleString()} />
      </PageHero>

      <Panel>
        <div className="flex flex-col gap-4">
          <div className="inline-flex w-fit rounded-full border border-[#dce6d8] bg-[#f4f7ef] p-1">
            {(["plants", "eggs"] as Mode[]).map((itemMode) => (
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((item) => {
          const style = rarityStyle[item.rarity as Rarity];
          const canAfford = ecoPoints >= item.price;
          return (
            <article key={item.id} className="flex flex-col overflow-hidden rounded-[22px] border bg-[#fffefa] shadow-[0_18px_48px_rgba(26,45,29,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_58px_rgba(26,45,29,0.11)]" style={{ borderColor: style.border }}>
              <div className="relative flex h-36 items-center justify-center" style={{ background: `${style.accent}14` }}>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/86 font-serif text-2xl font-extrabold" style={{ color: style.accent }}>{item.mark}</span>
                <span className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${style.chip}`}>{item.rarity}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="font-serif text-lg font-extrabold leading-tight text-forest-950">{item.name}</p>
                {(item as any).hatchTime && <p className="text-xs font-semibold text-forest-700/58">Hatches in {(item as any).hatchTime}</p>}
                <p className="font-serif text-xl font-extrabold text-forest-800">{item.price} <span className="text-xs font-bold text-forest-600/58">EP</span></p>
                <button onClick={() => handleBuy(item)} disabled={!canAfford} className={`mt-auto w-full ${canAfford ? primaryButton : "rounded-full bg-[#eef2e8] px-5 py-2.5 text-xs font-extrabold uppercase tracking-[0.1em] text-forest-500"}`}>
                  {canAfford ? "Buy" : "Can't afford"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-forest-950 px-6 py-3 text-sm font-extrabold text-cream-100 shadow-[0_20px_44px_rgba(16,33,20,0.3)]">
          {toast}
        </div>
      )}
    </div>
  );
}
