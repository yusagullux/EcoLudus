"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import { useShopCatalog } from "@/lib/useCatalog";
import { HeroMetric, PageHero, Panel, Pill, primaryButton, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";
import type { ShopItem, ShopMode } from "@/lib/catalog";

type Mode = ShopMode;

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
    <Image
      src={item.image}
      alt={item.name}
      fill
      sizes="(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 220px"
      onError={() => setImgError(true)}
      className="object-cover transition duration-300 group-hover:scale-110"
    />
  );
}

export default function ShopPage() {
  const { user, profile, refreshProfile } = useAuth();
  const ecoPoints = Number(profile?.ecoPoints ?? 0);
  const [mode, setMode] = useState<Mode>("plants");
  const [filter, setFilter] = useState<"all" | Rarity>("all");
  const toast = useToast();
  // The catalog (incl. prices) is loaded from the server's read API and is
  // display-only — the /api/shop/buy route re-validates the price by id, so a
  // client cannot buy at a cheaper price even by tampering with this state.
  // SWR caches the catalog across navigations (shop → collection shares it).
  const shopCatalog = useShopCatalog();
  const catalog: Record<Mode, ShopItem[]> = {
    plants: shopCatalog.plants as ShopItem[],
    eggs: shopCatalog.eggs as ShopItem[],
    chests: shopCatalog.chests as ShopItem[]
  };
  const loading = shopCatalog.isLoading;

  const items = catalog[mode] ?? [];
  const filtered = filter === "all" ? items : items.filter((item) => item.rarity === filter);
  const tabs: ("all" | Rarity)[] = ["all", "common", "rare", "epic", "legendary"];

  const handleBuy = async (item: ShopItem) => {
    if (!profile || !user) {
      toast.error("Please log in to purchase items.");
      return;
    }

    if (ecoPoints < item.price) {
      toast.error(`Need ${item.price} EcoPoints; you have ${ecoPoints}.`);
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
      toast.error(data?.error?.message || "Purchase failed. Please try again.");
      return;
    }

    await refreshProfile();
    toast.success(`${item.name} added to collection!`);
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
        {loading ? (
          <p className="col-span-full text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Loading shop…</p>
        ) : filtered.length === 0 ? (
          <p className="col-span-full text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>No items in this category.</p>
        ) : filtered.map((item) => {
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

    </div>
  );
}
