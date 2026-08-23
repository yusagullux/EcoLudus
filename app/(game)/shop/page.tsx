"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import { useShopCatalog } from "@/lib/useCatalog";
import { HeroMetric, PageHero, primaryButton, rarityStyle, rarityBorder, heroAccents, type Rarity } from "@/components/game-ui";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CollectionCardImage, type CollectionMode } from "@/components/collection-card";
import { StaggerContainer, StaggerItem } from "@/lib/animations";

const KIND_TO_MODE: Record<string, CollectionMode> = {
  plant: "plants",
  egg: "eggs",
  chest: "chests"
};

const KIND_LABEL: Record<string, string> = {
  plant: "Plant",
  egg: "Egg",
  chest: "Chest"
};

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4
};

function calculateTimeLeft(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const diff = tomorrow.getTime() - now.getTime();

  if (diff <= 0) return "00:00:00";

  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / 1000 / 60) % 60);
  const s = Math.floor((diff / 1000) % 60);

  return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

export default function ShopPage() {
  const { user, profile, refreshProfile } = useAuth();
  const ecoPoints = Number(profile?.ecoPoints ?? 0);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const toast = useToast();
  const shopCatalog = useShopCatalog();
  const dailyDeals = shopCatalog.dailyDeals as any[] || [];
  const sortedDailyDeals = [...dailyDeals].sort((a, b) => {
    const rarityDifference = (RARITY_ORDER[a.rarity] ?? Number.MAX_SAFE_INTEGER) - (RARITY_ORDER[b.rarity] ?? Number.MAX_SAFE_INTEGER);
    if (rarityDifference !== 0) return rarityDifference;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
  const loading = shopCatalog.isLoading;
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBuy = async (deal: any) => {
    if (!profile || !user) {
      toast.error("Please log in to purchase items.");
      return;
    }
    if (buyingId) return;

    if (ecoPoints < deal.dealPrice) {
      toast.error(`Need ${deal.dealPrice} EcoPoints; you have ${ecoPoints}.`);
      return;
    }

    setBuyingId(deal.dealId);
    try {
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "daily", dealId: deal.dealId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        if (data?.error?.code === "shop/already-owned") {
          toast.error("You already own this cosmetic!");
        } else {
          toast.error(data?.error?.message || "Purchase failed. Please try again.");
        }
        return;
      }

      toast.success(`${deal.name} added to collection!`);
      void refreshProfile();
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <StaggerContainer className="flex flex-col gap-6" as="div">
      <StaggerItem as="div">
        <PageHero eyebrow="Market" title="Shop" description="A rotating selection of plants, eggs, and chests — refreshed daily, with a few deals mixed in." accent={heroAccents.shop}>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <HeroMetric label="EcoPoints" value={ecoPoints} />
            <div
              className="self-start rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-widest sm:self-end"
              style={{
                color: "var(--text-warning)",
                background: "color-mix(in srgb, var(--text-warning) 15%, transparent)",
                borderColor: "color-mix(in srgb, var(--text-warning) 30%, transparent)"
              }}
            >
              Resets in {timeLeft}
            </div>
          </div>
        </PageHero>
      </StaggerItem>

      <StaggerItem as="div">
        {loading ? (
          <CardGridSkeleton count={6} cols="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3" />
        ) : sortedDailyDeals.length === 0 ? (
          <EmptyState
            variant="plain"
            icon="🏪"
            title="Shop is closed"
            description="The daily deals are currently unavailable."
          />
        ) : (
          <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3" as="div">
            {sortedDailyDeals.map((deal, index) => {
              const style = rarityStyle[deal.rarity as Rarity] ?? rarityStyle.common;
              const border = rarityBorder[deal.rarity as Rarity] ?? rarityBorder.common;
              const canAfford = ecoPoints >= deal.dealPrice;
              const shortfall = Math.max(0, deal.dealPrice - ecoPoints);
              const isDeal = Number(deal.discountPct) > 0;
              const isBuying = buyingId === deal.dealId;
              const kindLabel = KIND_LABEL[deal.kind] ?? deal.kind;

              return (
                <StaggerItem
                  key={deal.dealId}
                  as="article"
                  className="group flex flex-col overflow-hidden rounded-[22px] border transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl"
                  style={{ borderColor: border, background: "var(--bg-card)" }}
                >
                  <div
                    className="relative flex aspect-square w-full items-center justify-center overflow-hidden"
                    style={{ background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${style.accent} 18%, var(--bg-card)), var(--bg-panel))` }}
                  >
                    <span className={`absolute right-3 top-3 z-20 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm ${style.chip}`}>
                      {deal.rarity}
                    </span>

                    {isDeal && (
                      <span className="absolute left-3 top-3 z-20 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-950 shadow-sm">
                        −{deal.discountPct}%
                      </span>
                    )}

                    <span
                      className="absolute bottom-3 left-3 z-20 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm"
                      style={{ background: "color-mix(in srgb, var(--bg-card) 82%, transparent)", color: "var(--text-muted)" }}
                    >
                      {deal.emoji} {kindLabel}
                    </span>

                    <CollectionCardImage
                      entry={{ id: deal.itemId, name: deal.name, rarity: deal.rarity, image: deal.image }}
                      discovered={true}
                      mode={KIND_TO_MODE[deal.kind] ?? "plants"}
                      priority={index === 0}
                    />
                  </div>

                  <div className="flex flex-1 flex-col gap-3 border-t p-4 sm:p-5" style={{ borderColor: "var(--border-subtle)" }}>
                    <div>
                      <p className="font-serif text-[17px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{deal.name}</p>
                      {deal.description && <p className="mt-1 text-xs font-medium leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>{deal.description}</p>}
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-3 pt-1">
                      <div className="min-w-0 flex flex-col">
                        {isDeal && (
                          <span className="text-[11px] font-bold line-through" style={{ color: "var(--text-muted)" }}>{deal.originalPrice} EP</span>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span
                            className="font-serif text-2xl font-black"
                            style={{ color: isDeal ? "var(--text-warning)" : "var(--text-primary)" }}
                          >
                            {deal.dealPrice}
                          </span>
                          <span className="text-[10px] font-black uppercase" style={{ color: isDeal ? "var(--text-warning)" : "var(--text-muted)" }}>EP</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBuy(deal)}
                        disabled={isBuying}
                        aria-busy={isBuying}
                        aria-label={
                          isBuying
                            ? `Buying ${deal.name}`
                            : canAfford
                              ? `Buy ${deal.name} for ${deal.dealPrice} EcoPoints`
                              : `Need ${shortfall} more EcoPoints to buy ${deal.name}`
                        }
                        className={`shrink-0 ${canAfford ? primaryButton : "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-xs font-bold tracking-[0.02em] transition hover:opacity-90"}`}
                        style={!canAfford ? { background: "var(--bg-panel-alt)", color: "var(--text-muted)" } : undefined}
                      >
                        {isBuying ? "Buying…" : canAfford ? "Buy" : `+${shortfall} EP`}
                      </button>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </StaggerItem>
    </StaggerContainer>
  );
}
