"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import { useShopCatalog } from "@/lib/useCatalog";
import { HeroMetric, PageHero, Panel, Pill, PillFilterBar, primaryButton, rarityStyle, rarityBorder, heroAccents, type Rarity } from "@/components/game-ui";
import { PillTabBar } from "@/components/ui/pill-tab-bar";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerContainer, StaggerItem, TabPanel } from "@/lib/animations";
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
  const [buyingId, setBuyingId] = useState<number | string | null>(null);
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
    if (buyingId) return;

    if (ecoPoints < item.price) {
      toast.error(`Need ${item.price} EcoPoints; you have ${ecoPoints}.`);
      return;
    }

    setBuyingId(item.id);
    try {
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
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
        <PageHero eyebrow="Nature store" title="Plant Shop" description="Spend EcoPoints on rare plants, mysterious eggs, and magical chests." accent={heroAccents.shop}>
          <HeroMetric label="EcoPoints" value={ecoPoints} />
        </PageHero>
      </StaggerItem>

      <StaggerItem as="div">
        <Panel>
          <div className="flex flex-col gap-4">
            <PillTabBar<Mode>
              value={mode}
              options={["plants", "eggs", "chests"] as const}
              onChange={(v) => { setMode(v); setFilter("all"); }}
            />
            <PillFilterBar<"all" | Rarity>
              value={filter}
              options={tabs}
              onChange={setFilter}
            />
          </div>
        </Panel>
      </StaggerItem>

      <StaggerItem as="div">
        <TabPanel activeKey={mode}>
          {loading ? (
            <CardGridSkeleton count={8} cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 col-span-full" />
          ) : filtered.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                variant="plain"
                icon="🔍"
                title="No items match this filter"
                description="Try selecting a different rarity or switch to another shop tab."
              />
            </div>
          ) : (
            <StaggerContainer className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" as="div">
              {filtered.map((item) => {
                const style = rarityStyle[item.rarity as Rarity] ?? rarityStyle.common;
                const border = rarityBorder[item.rarity as Rarity] ?? rarityBorder.common;
                const canAfford = ecoPoints >= item.price;
                return (
                  <StaggerItem
                    key={item.id}
                    as="article"
                    className="group flex flex-col overflow-hidden rounded-[20px] border transition hover:-translate-y-1"
                    style={{ borderColor: border, background: "var(--bg-card)" }}
                  >
                    {/* Framed card image design - full bleed aspect ratio (matches Collection) */}
                    <div className="relative flex aspect-square items-center justify-center overflow-hidden" style={{ background: `color-mix(in srgb, ${style.accent} 7%, var(--bg-card))` }}>
                      <ShopCardImage item={item} mode={mode} />
                      <span className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${style.chip}`}>{item.rarity}</span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <p className="font-serif text-sm font-extrabold leading-tight truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                      {item.hatchTime && <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Hatches in {item.hatchTime}</p>}
                      {item.description && <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{item.description}</p>}
                      <p className="font-serif text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
                        {item.price} <span className="text-xs font-bold" title="EcoPoints" style={{ color: "var(--text-muted)" }}>EP</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleBuy(item)}
                        disabled={!canAfford || buyingId === item.id}
                        className={`mt-auto w-full ${canAfford ? primaryButton : "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] cursor-not-allowed opacity-50"}`}
                        style={!canAfford ? { background: "var(--bg-panel-alt)", color: "var(--text-muted)" } : undefined}
                      >
                        {buyingId === item.id ? "Buying…" : canAfford ? "Buy" : "Need more EP"}
                      </button>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          )}
        </TabPanel>
      </StaggerItem>

    </StaggerContainer>
  );
}
