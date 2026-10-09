"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import { useShopCatalog } from "@/lib/useCatalog";
import { AnimatedNumber } from "@/lib/animations";
import { PageHeader, HeroMetric, primaryButton, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";
import { Clock, Coins, Store } from "lucide-react";
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
  const buyingRef = useRef(false);
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
    // Ref guard, not just state: a rapid double-click lands both events before
    // the buyingId re-render, so `if (buyingId) return` alone let both through
    // (FEEDBACKS.md C1 — server also guards with shop/duplicate-purchase).
    if (buyingRef.current || buyingId) return;
    buyingRef.current = true;

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
      buyingRef.current = false;
      setBuyingId(null);
    }
  };

  return (
    <StaggerContainer className="flex flex-col gap-6" as="div">
      <StaggerItem as="div">
        <PageHeader
          title="Daily market"
          description="A rotating selection of plants, eggs, and chests — refreshed daily, with a few deals mixed in."
          tint
          action={
            <div className="flex flex-col gap-2 sm:items-end">
              <HeroMetric label="EcoPoints" value={ecoPoints} />
              <div className="chip-warning self-start rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] sm:self-end">
                Resets in {timeLeft}
              </div>
            </div>
          }
        />
      </StaggerItem>

      <StaggerItem as="div">
        {loading ? (
          <CardGridSkeleton count={6} cols="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3" />
        ) : sortedDailyDeals.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={<Store className="h-7 w-7" strokeWidth={2.2} />}
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
                  className="t-card-hover group flex flex-col overflow-hidden rounded-dialog border shadow-elev-1"
                  style={{ borderColor: border }}
                >
                  <div
                    className="relative flex aspect-square w-full items-center justify-center overflow-hidden"
                    style={{ background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${style.accent} 18%, var(--bg-card)), var(--bg-panel))` }}
                  >
                    <span className={`absolute right-3 top-3 z-20 rounded-full px-2.5 py-1 text-micro shadow-sm ${style.chip}`}>
                      {deal.rarity}
                    </span>

                    {isDeal && (
                      <span
                        className="absolute left-3 top-3 z-20 -rotate-6 rounded-full px-2.5 py-1 text-micro shadow-elev-1"
                        style={{
                          background: "color-mix(in srgb, var(--text-warning) 18%, var(--bg-panel))",
                          color: "var(--text-warning)",
                          border: "1px solid color-mix(in srgb, var(--text-warning) 30%, var(--border-default))"
                        }}
                      >
                        −{deal.discountPct}%
                      </span>
                    )}

                    <span className="absolute bottom-3 left-3 z-20 rounded-full bg-card/85 px-2.5 py-1 text-micro tracking-[0.06em] text-ink-soft shadow-sm">
                      {kindLabel}
                    </span>

                    <CollectionCardImage
                      entry={{ id: deal.itemId, name: deal.name, rarity: deal.rarity, image: deal.image }}
                      discovered={true}
                      mode={KIND_TO_MODE[deal.kind] ?? "plants"}
                      priority={index === 0}
                      sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 340px"
                    />
                  </div>

                  <div className="flex flex-1 flex-col gap-3 border-t border-line-soft p-4 sm:p-5">
                    <div>
                      <p className="font-serif text-[0.9375rem] font-bold leading-tight text-ink">{deal.name}</p>
                      {deal.description && <p className="mt-1 text-xs font-medium leading-relaxed line-clamp-2 text-ink-muted">{deal.description}</p>}
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-3 pt-1">
                      <div className="min-w-0 flex flex-col">
                        {isDeal && (
                          <span className="text-xs font-bold line-through text-ink-muted">{deal.originalPrice} EP</span>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className={`font-serif text-2xl font-black ${isDeal ? "text-status-warning" : "text-ink"}`}>
                            {deal.dealPrice}
                          </span>
                          <span className={`text-micro ${isDeal ? "text-status-warning" : "text-ink-muted"}`}>EP</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBuy(deal)}
                        disabled={!!buyingId}
                        aria-disabled={!!buyingId}
                        aria-busy={isBuying}
                        aria-label={
                          isBuying
                            ? `Buying ${deal.name}`
                            : canAfford
                              ? `Buy ${deal.name} for ${deal.dealPrice} EcoPoints`
                              : `Need ${shortfall} more EcoPoints to buy ${deal.name}`
                        }
                        className={`shrink-0 disabled:cursor-not-allowed disabled:opacity-60 ${canAfford ? primaryButton : "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface-alt px-4 py-2.5 text-xs font-bold text-ink-muted transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"}`}
                      >
                        {isBuying ? "Buying…" : canAfford ? "Buy" : `Need ${shortfall} more`}
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
