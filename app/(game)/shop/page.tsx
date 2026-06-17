// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { updateUserProfile } from "@/public/js/auth.js";
import { HeroMetric, PageHero, Panel, Pill, primaryButton, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";

type Mode = "plants" | "eggs";

type ShopItem = {
  id: number;
  name: string;
  rarity: Rarity;
  price: number;
  image: string;
  hatchTime?: string;
};

const plants = [
  { id: 1, name: "Mossy Fern", rarity: "common", price: 50, image: "/images/plants/mint.png" },
  { id: 2, name: "Golden Daisy", rarity: "common", price: 60, image: "/images/plants/sunflower.png" },
  { id: 3, name: "Blue Orchid", rarity: "rare", price: 180, image: "/images/plants/orchid.png" },
  { id: 4, name: "Spotted Aloe", rarity: "rare", price: 200, image: "/images/plants/basil.png" },
  { id: 5, name: "Mystic Bamboo", rarity: "epic", price: 450, image: "/images/plants/bamboo.png" },
  { id: 6, name: "Crystal Lotus", rarity: "epic", price: 500, image: "/images/plants/lotus.png" },
  { id: 7, name: "Aurora Blossom", rarity: "legendary", price: 1200, image: "/images/plants/cherry_blossom.png" },
  { id: 8, name: "Ember Cactus", rarity: "legendary", price: 1500, image: "/images/plants/dragonfruit.png" }
];

const eggs = [
  { id: 1, name: "Common Egg", rarity: "common", price: 100, image: "/images/eggs/common-egg.png", hatchTime: "1h" },
  { id: 2, name: "Rare Egg", rarity: "rare", price: 300, image: "/images/eggs/rare-egg.png", hatchTime: "4h" },
  { id: 3, name: "Epic Egg", rarity: "epic", price: 700, image: "/images/eggs/epic-egg.png", hatchTime: "12h" },
  { id: 4, name: "Legendary Egg", rarity: "legendary", price: 1800, image: "/images/eggs/legendary-egg.png", hatchTime: "24h" }
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
          <div className="inline-flex w-fit rounded-full p-1" style={{ background: "var(--bg-panel-alt)", border: "1px solid var(--border-default)" }}>
            {(["plants", "eggs"] as Mode[]).map((itemMode) => (
              <button
                key={itemMode}
                onClick={() => { setMode(itemMode); setFilter("all"); }}
                className="rounded-full px-4 py-2 text-sm font-extrabold capitalize transition"
                style={mode === itemMode
                  ? { background: "var(--pill-active-bg)", color: "var(--pill-active-text)" }
                  : { color: "var(--text-muted)" }}
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
                className="rounded-full px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] transition"
                style={filter === rarity
                  ? { background: "var(--pill-active-bg)", color: "var(--pill-active-text)" }
                  : { background: "var(--pill-bg)", border: "1px solid var(--pill-border)", color: "var(--pill-text)" }}
              >
                {rarity}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((item) => {
          const style = rarityStyle[item.rarity as Rarity] ?? rarityStyle.common;
          const border = rarityBorder[item.rarity as Rarity] ?? rarityBorder.common;
          const canAfford = ecoPoints >= item.price;
          return (
            <article
              key={item.id}
              className="reveal-card group flex flex-col overflow-hidden rounded-[20px] border transition hover:-translate-y-1"
              style={{ borderColor: border, background: "var(--bg-card)" }}
            >
              <div className="relative flex aspect-square min-h-36 items-center justify-center overflow-hidden p-4" style={{ background: `${style.accent}18` }}>
                <div className="absolute inset-x-7 bottom-6 h-7 rounded-full bg-black/8 blur-xl transition group-hover:scale-110" />
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  className="relative h-full max-h-32 w-full max-w-32 object-contain transition duration-300 group-hover:scale-105"
                />
                <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${style.chip}`}>{item.rarity}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="font-serif text-sm font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                {(item as any).hatchTime && <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Hatches in {(item as any).hatchTime}</p>}
                <p className="font-serif text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
                  {item.price} <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>EP</span>
                </p>
                <button
                  onClick={() => handleBuy(item)}
                  disabled={!canAfford}
                  className={`mt-auto w-full ${canAfford ? primaryButton : "rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-[0.08em] cursor-not-allowed opacity-50"}`}
                  style={!canAfford ? { background: "var(--bg-panel-alt)", color: "var(--text-muted)" } : undefined}
                >
                  {canAfford ? "Buy" : "Can't afford"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

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
