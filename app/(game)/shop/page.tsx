// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { HeroMetric, PageHero, Panel, Pill, primaryButton, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";

type Mode = "plants" | "eggs" | "chests";

// Mirrors the collection page's CardImage so shop item photos fill the card
// the same way (full-bleed object-cover, not letterboxed object-contain). Falls
// back to an emoji if the asset is missing so the card never shows a broken image.
const FALLBACK_EMOJI: Record<Mode, string> = { plants: "🌿", eggs: "🥚", chests: "🎁" };

function ShopCardImage({ item, mode }: { item: ShopItem; mode: Mode }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="flex h-full w-full items-center justify-center text-5xl select-none transition duration-300 group-hover:scale-110">
        {FALLBACK_EMOJI[mode]}
      </div>
    );
  }

  return (
    <img
      src={item.image}
      alt={item.name}
      loading="lazy"
      onError={() => setImgError(true)}
      className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
    />
  );
}

type ShopItem = {
  id: number;
  name: string;
  rarity: Rarity;
  price: number;
  image: string;
  hatchTime?: string;
  description?: string;
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

const chests = [
  { id: 1, name: "Wooden Chest", rarity: "common", price: 150, image: "/images/chests/wooden-chest.png", description: "Contains EcoCoins or Common Plants!" },
  { id: 2, name: "Bronze Chest", rarity: "rare", price: 350, image: "/images/chests/bronze-chest.png", description: "Contains EcoCoins, Rare Plants, or Common Eggs!" },
  { id: 3, name: "Silver Chest", rarity: "epic", price: 800, image: "/images/chests/silver-chest.png", description: "Contains a large amount of EcoCoins, Epic Plants, or Eggs!" },
  { id: 4, name: "Golden Chest", rarity: "legendary", price: 2000, image: "/images/chests/golden-chest.png", description: "Contains massive EcoCoins, Legendary Plants, or Eggs!" }
];

export default function ShopPage() {
  const { user, profile, refreshProfile } = useAuth();
  const ecoPoints = profile?.ecoPoints ?? 0;
  const [mode, setMode] = useState<Mode>("plants");
  const [filter, setFilter] = useState<"all" | Rarity>("all");
  const [toast, setToast] = useState("");

  const items = mode === "plants" ? plants : mode === "eggs" ? eggs : chests;
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

    // The price, eco spend, and item mint are owned by the server so a client
    // can't buy without paying or forge the item. The catalog on this page is
    // display-only; the route is the source of truth for prices.
    const res = await fetch("/api/shop/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, itemId: item.id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setToast(data?.error?.message || "Purchase failed. Please try again.");
      setTimeout(() => setToast(""), 3000);
      return;
    }

    await refreshProfile();
    setToast(`${item.name} added to collection!`);
    setTimeout(() => setToast(""), 3000);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Nature store" title="Plant Shop" description="Spend EcoPoints on rare plants, mysterious eggs, and magical chests.">
        <HeroMetric label="EcoPoints" value={ecoPoints.toLocaleString()} />
      </PageHero>

      <Panel>
        <div className="flex flex-col gap-4">
          <div className="inline-flex w-fit rounded-full p-1" style={{ background: "var(--bg-panel-alt)", border: "1px solid var(--border-default)" }}>
            {(["plants", "eggs", "chests"] as Mode[]).map((itemMode) => (
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
              {/* Framed card image design - full bleed aspect ratio (matches Collection) */}
              <div className="relative flex aspect-square items-center justify-center overflow-hidden" style={{ background: `${style.accent}12` }}>
                <ShopCardImage item={item} mode={mode} />
                <span className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${style.chip}`}>{item.rarity}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="font-serif text-sm font-extrabold leading-tight truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                {item.hatchTime && <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Hatches in {item.hatchTime}</p>}
                {item.description && <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{item.description}</p>}
                <p className="font-serif text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
                  {item.price} <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>EP</span>
                </p>
                <button
                  onClick={() => handleBuy(item)}
                  disabled={!canAfford}
                  className={`mt-auto w-full ${canAfford ? primaryButton : "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] cursor-not-allowed opacity-50"}`}
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
