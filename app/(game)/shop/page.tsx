"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import { useShopCatalog } from "@/lib/useCatalog";
import { HeroMetric, PageHero, primaryButton, rarityStyle, rarityBorder, heroAccents, type Rarity } from "@/components/game-ui";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerContainer, StaggerItem } from "@/lib/animations";

// Consistent product imagery: every card gets the same fixed-aspect image
// well with equal inner padding, so artwork never crops, stretches, or
// overflows — only `object-contain` (letterboxed) is used. Falls back to a
// kind emoji if the asset 404s so the card never shows a broken image.
function ShopCardImage({
  image,
  emoji,
  name,
  priority = false
}: {
  image?: string;
  emoji?: string;
  name: string;
  priority?: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  if (imgError || (!image && emoji)) {
    return (
      <div className="flex h-full w-full items-center justify-center text-6xl select-none transition-transform duration-300 group-hover:scale-110 drop-shadow-md">
        {emoji || "🎁"}
      </div>
    );
  }

  if (image) {
    // Egg and chest assets have large transparent padding baked in. Crop them
    // to fill the card well so they read at the same visual weight as plants;
    // other artwork stays letterboxed via object-contain to avoid clipping.
    const isPaddedAsset = /\/(eggs|chests)\//i.test(image);
    return (
      <Image
        src={image}
        alt={name}
        fill
        sizes="(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 220px"
        priority={priority}
        loading={priority ? "eager" : undefined}
        onError={() => setImgError(true)}
        className={`transition-transform duration-300 group-hover:scale-105 drop-shadow-md ${
          isPaddedAsset ? "object-cover" : "object-contain p-5"
        }`}
      />
    );
  }

  return null;
}

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

      await refreshProfile();
      toast.success(`${deal.name} added to collection!`);
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <StaggerContainer className="flex flex-col gap-6" as="div">
      <StaggerItem as="div">
        <PageHero eyebrow="Market" title="Shop" description="A rotating selection of plants, eggs, and chests — refreshed daily, with a few deals mixed in." accent={heroAccents.shop}>
          <div className="flex flex-col items-end gap-2">
            <HeroMetric label="EcoPoints" value={ecoPoints} />
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-warning)] bg-[color-mix(in_srgb,var(--text-warning)_15%,transparent)] px-3 py-1.5 rounded-full border border-[color-mix(in_srgb,var(--text-warning)_30%,transparent)]">
              Resets in {timeLeft}
            </div>
          </div>
        </PageHero>
      </StaggerItem>

      <StaggerItem as="div">
        {loading ? (
          <CardGridSkeleton count={6} cols="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3" />
        ) : dailyDeals.length === 0 ? (
          <EmptyState
            variant="plain"
            icon="🏪"
            title="Shop is closed"
            description="The daily deals are currently unavailable."
          />
        ) : (
          <StaggerContainer className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" as="div">
            {dailyDeals.map((deal, index) => {
              const style = rarityStyle[deal.rarity as Rarity] ?? rarityStyle.common;
              const border = rarityBorder[deal.rarity as Rarity] ?? rarityBorder.common;
              const canAfford = ecoPoints >= deal.dealPrice;
              const isDeal = Number(deal.discountPct) > 0;

              return (
                <StaggerItem
                  key={deal.dealId}
                  as="article"
                  className="group flex flex-col overflow-hidden rounded-[22px] border transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl"
                  style={{ borderColor: border, background: "var(--bg-card)" }}
                >
                  {/* Image well — one fixed aspect for every card, letterboxed
                      via object-contain so artwork is never cropped or stretched. */}
                  <div
                    className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden"
                    style={{ background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${style.accent} 18%, var(--bg-card)), var(--bg-panel))` }}
                  >
                    <div className="absolute left-3 top-3 z-20">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm ${style.chip}`}>
                        {deal.rarity} {deal.kind}
                      </span>
                    </div>

                    {isDeal && (
                      <div className="absolute right-3 top-3 z-20">
                        <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-950 shadow-sm">
                          −{deal.discountPct}%
                        </span>
                      </div>
                    )}

                    <ShopCardImage image={deal.image} emoji={deal.emoji} name={deal.name} priority={index === 0} />
                  </div>

                  <div className="flex flex-1 flex-col gap-3 border-t p-4" style={{ borderColor: "var(--border-subtle)" }}>
                    <div>
                      <p className="font-serif text-[17px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{deal.name}</p>
                      {deal.description && <p className="mt-1 text-xs font-medium leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>{deal.description}</p>}
                    </div>

                    <div className="mt-auto flex items-end justify-between pt-1">
                      <div className="flex flex-col">
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
                        disabled={!canAfford || buyingId === deal.dealId}
                        className={`min-w-[96px] ${canAfford ? primaryButton : "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-xs font-bold tracking-[0.02em] cursor-not-allowed opacity-50 transition"}`}
                        style={!canAfford ? { background: "var(--bg-panel-alt)", color: "var(--text-muted)" } : undefined}
                      >
                        {buyingId === deal.dealId ? "…" : canAfford ? "Buy" : "Locked"}
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
