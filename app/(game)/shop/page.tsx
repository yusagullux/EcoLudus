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

function ShopCardImage({ image, emoji, name }: { image?: string; emoji?: string; name: string }) {
  const [imgError, setImgError] = useState(false);

  if (imgError || (!image && emoji)) {
    return (
      <div className="flex h-full w-full items-center justify-center text-7xl select-none transition duration-300 group-hover:scale-110 drop-shadow-md">
        {emoji || "🎁"}
      </div>
    );
  }

  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        fill
        sizes="(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 220px"
        onError={() => setImgError(true)}
        className="object-contain p-4 transition duration-300 group-hover:scale-110 drop-shadow-md"
      />
    );
  }
  
  return null;
}

export default function ShopPage() {
  const { user, profile, refreshProfile } = useAuth();
  const ecoPoints = Number(profile?.ecoPoints ?? 0);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const toast = useToast();
  const shopCatalog = useShopCatalog();
  const dailyDeals = shopCatalog.dailyDeals as any[] || [];
  const loading = shopCatalog.isLoading;
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diff = tomorrow.getTime() - now.getTime();
      
      if (diff <= 0) return "00:00:00";
      
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      
      return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    };

    setTimeLeft(calculateTimeLeft());
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
        <PageHero eyebrow="Daily Deals" title="Market" description="Check back every day for new discounts on rare items!" accent={heroAccents.shop}>
          <div className="flex flex-col items-end gap-2">
            <HeroMetric label="EcoPoints" value={ecoPoints} />
            <div className="text-xs font-black uppercase tracking-widest text-[var(--text-warning)] animate-pulse bg-[color-mix(in_srgb,var(--text-warning)_15%,transparent)] px-3 py-1.5 rounded-full backdrop-blur-md border border-[color-mix(in_srgb,var(--text-warning)_30%,transparent)]">
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
            {dailyDeals.map((deal) => {
              const style = rarityStyle[deal.rarity as Rarity] ?? rarityStyle.common;
              const border = rarityBorder[deal.rarity as Rarity] ?? rarityBorder.common;
              const canAfford = ecoPoints >= deal.dealPrice;
              
              return (
                <StaggerItem
                  key={deal.dealId}
                  as="article"
                  className="group flex flex-col overflow-hidden rounded-[24px] border transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl relative"
                  style={{ borderColor: border, background: "var(--bg-card)" }}
                >
                  <div className="absolute top-3 left-3 z-20">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm ${style.chip}`}>
                      {deal.rarity} {deal.kind}
                    </span>
                  </div>
                  
                  <div className="absolute top-3 right-3 z-20">
                    <span className="rounded-full bg-red-500 text-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm animate-pulse">
                      -{deal.discountPct}%
                    </span>
                  </div>

                  <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden" style={{ background: `radial-gradient(circle at center, color-mix(in srgb, ${style.accent} 20%, var(--bg-card)), var(--bg-panel))` }}>
                    <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                    <ShopCardImage image={deal.image} emoji={deal.emoji} name={deal.name} />
                  </div>
                  
                  <div className="flex flex-1 flex-col gap-3 p-4 bg-gradient-to-b from-[var(--bg-card)] to-[var(--bg-panel)] border-t border-[var(--border-subtle)]">
                    <div>
                      <p className="font-serif text-[17px] font-black leading-tight" style={{ color: "var(--text-primary)" }}>{deal.name}</p>
                      {deal.description && <p className="mt-1 text-xs font-medium leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>{deal.description}</p>}
                    </div>
                    
                    <div className="mt-auto flex items-end justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] line-through opacity-70 mb-0.5">{deal.originalPrice} EP</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-serif text-2xl font-black text-[var(--text-primary)]">{deal.dealPrice}</span>
                          <span className="text-[10px] font-black uppercase text-[var(--text-warning)]">EP</span>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => handleBuy(deal)}
                        disabled={!canAfford || buyingId === deal.dealId}
                        className={`min-w-[100px] h-10 ${canAfford ? primaryButton : "inline-flex items-center justify-center rounded-full px-4 text-[11px] font-black uppercase tracking-[0.1em] cursor-not-allowed opacity-50 transition"}`}
                        style={!canAfford ? { background: "var(--bg-panel-alt)", color: "var(--text-muted)" } : undefined}
                      >
                        {buyingId === deal.dealId ? "..." : canAfford ? "Buy Now" : "Locked"}
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
