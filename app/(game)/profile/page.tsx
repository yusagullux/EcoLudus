"use client";

import { useAuth } from "@/lib/useAuth";
import { HeroMetric, MetricCard, PageHero, Panel, Pill, ProgressBar, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";

const badgeList = [
  { level: 1, name: "Cat", image: "/images/ecoquests-badges/cat-badge-removedbg.png" },
  { level: 2, name: "Fox", image: "/images/ecoquests-badges/fox-badge-removedbg.png" },
  { level: 3, name: "Rabbit", image: "/images/ecoquests-badges/rabbit-badge-removedbg.png" },
  { level: 4, name: "Deer", image: "/images/ecoquests-badges/deer-badge-removedbg.png" },
  { level: 5, name: "Wolf", image: "/images/ecoquests-badges/wolf-badge-removedbg.png" },
  { level: 6, name: "Bear", image: "/images/ecoquests-badges/bear-badge-removedbg.png" },
  { level: 7, name: "Eagle", image: "/images/ecoquests-badges/eagle-badge-removedbg.png" },
  { level: 8, name: "Tiger", image: "/images/ecoquests-badges/tiger-badge-removedbg.png" },
  { level: 9, name: "Lion", image: "/images/ecoquests-badges/lion-badge-removedbg.png" }
];

function getBadge(level: number) {
  return badgeList[Math.min(Math.max(level, 1), 9) - 1];
}

const categories = [
  { id: "recycling", name: "Recycling", image: "/images/forest.png", color: "#2f6b46", maxCo2: 3.6, badge: "Recycler" },
  { id: "energy", name: "Energy Saving", image: "/images/background.png", color: "#9a6b1f", maxCo2: 2.1, badge: "Energy Saver" },
  { id: "transportation", name: "Transportation", image: "/images/mountains.png", color: "#2f5f86", maxCo2: 3.0, badge: "Eco Commuter" },
  { id: "water", name: "Water Saving", image: "/images/nature.png", color: "#237482", maxCo2: 0.5, badge: "Water Guardian" },
  { id: "cleanup", name: "Clean-Up", image: "/images/night.png", color: "#62508f", maxCo2: 2.4, badge: "Clean Earth" },
  { id: "gardening", name: "Gardening & Nature", image: "/images/plants/bamboo.png", color: "#4c7a3b", maxCo2: 0.6, badge: "Green Thumb" }
];

const plantAssetByName: Record<string, string> = {
  "Mossy Fern": "/images/plants/mint.png",
  "Golden Daisy": "/images/plants/sunflower.png",
  "Blue Orchid": "/images/plants/orchid.png",
  "Spotted Aloe": "/images/plants/basil.png",
  "Mystic Bamboo": "/images/plants/bamboo.png",
  "Crystal Lotus": "/images/plants/lotus.png",
  "Aurora Blossom": "/images/plants/cherry_blossom.png",
  "Ember Cactus": "/images/plants/dragonfruit.png"
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPlantImage(plant: any) {
  return plant.image || plantAssetByName[plant.name] || "/images/plants/sunflower.png";
}

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const displayName = String(profile?.displayName || user?.email?.split("@")[0] || "Explorer");
  const email = user?.email || "-";
  const xp = Number(profile?.xp ?? 0);
  const ecoPoints = Number(profile?.ecoPoints ?? 0);
  const level = Number(profile?.level ?? 1);
  const missionsCompleted = Number(profile?.missionsCompleted ?? 0);
  const carbonReduced = Number(profile?.carbonReduced ?? 0);
  const completedQuests: string[] = Array.isArray(profile?.completedQuests) ? (profile.completedQuests as string[]) : [];
  const badge = getBadge(level);
  const profilePlants = Array.isArray(profile?.plants) ? profile.plants : [];
  const profileAnimals = Array.isArray(profile?.animals) ? profile.animals : [];

  // Calculate category progress from completed quests
  const categoryProgress = categories.map(category => {
    // Estimate total quests per category (this is game configuration)
    const total = category.id === "recycling" ? 8 :
                  category.id === "energy" ? 7 :
                  category.id === "transportation" ? 5 :
                  category.id === "water" ? 6 :
                  category.id === "cleanup" ? 4 : 4;
    // Calculate done based on completed quests (simplified - in real app would track per category)
    const done = Math.min(completedQuests.length, total);
    // Calculate CO2 based on progress
    const co2 = (done / total) * category.maxCo2;
    return { ...category, done, total, co2 };
  });

  const totalCo2 = categoryProgress.reduce((sum, category) => sum + category.co2, 0);

  const statCards = [
    { label: "Level", value: level, accent: "#2f5f86" },
    { label: "Missions Done", value: missionsCompleted, accent: "#62508f" },
    { label: "CO₂ Reduced", value: `${carbonReduced.toFixed(1)} kg`, accent: "#237482", wide: true },
    { label: "EcoPoints", value: ecoPoints.toLocaleString(), accent: "#4c7a3b" },
    { label: "Trees Planted", value: Number(profile?.treesPlanted ?? 0), accent: "#2f6b46" }
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow={`${badge.name} Badge, Level ${level}`} title={displayName} description={email}>
        <div className="flex flex-wrap gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/12 bg-white/12 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <img src={badge.image} alt={`${badge.name} badge`} className="h-full w-full object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.2)]" />
          </div>
          <HeroMetric label="XP" value={xp.toLocaleString()} />
          <HeroMetric label="Missions" value={missionsCompleted} />
        </div>
      </PageHero>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <Panel eyebrow="Achievement tracking" title="Quest Category Progress">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categoryProgress.map(({ name, image, color, done, total, co2, maxCo2, badge: categoryBadge }) => {
            const pct = Math.round((done / total) * 100);
            const completed = done === total;
            return (
              <article key={name} className="t-panel rounded-2xl p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl" style={{ background: "var(--bg-panel-alt)" }}>
                      <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{name}</p>
                      <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{done}/{total} quests</p>
                    </div>
                  </div>
                  {completed && <Pill active>{categoryBadge}</Pill>}
                </div>
                <ProgressBar value={pct} color={color} />
                <div className="mt-2 flex justify-between text-xs">
                  <span className="font-extrabold" style={{ color }}>{pct}%</span>
                  <span className="font-semibold" style={{ color: "var(--text-muted)" }}>{co2.toFixed(1)}/{maxCo2.toFixed(1)} kg CO₂</span>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel eyebrow="Rare finds" title="Collection Book" action={<Pill>{profilePlants.reduce((sum: number, plant: { count?: number }) => sum + (plant.count ?? 1), 0)} plants</Pill>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {profilePlants.length > 0 ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            profilePlants.map((plant: any) => (
              <article key={plant.id} className="reveal-card group flex flex-col items-center gap-3 rounded-2xl border p-4 text-center transition hover:-translate-y-1" style={{ borderColor: rarityBorder[plant.rarity as Rarity] ?? "#d9e2d2", background: "var(--bg-card)" }}>
                <span className="relative flex aspect-square w-full max-w-32 items-center justify-center rounded-2xl p-4" style={{ background: "var(--bg-panel-alt)" }}>
                  <img src={getPlantImage(plant)} alt={plant.name} loading="lazy" className="h-full w-full object-contain transition group-hover:scale-105" />
                </span>
                <p className="text-sm font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>{plant.name}</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${rarityStyle[plant.rarity as Rarity]?.chip ?? rarityStyle.common.chip}`}>{plant.rarity}</span>
                {plant.count > 1 && <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>×{plant.count}</span>}
              </article>
            ))
          ) : (
            <article className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)", color: "var(--text-muted)" }}>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-extrabold" style={{ background: "var(--bg-panel)" }}>+</span>
              <p className="text-sm font-bold">Collection is empty</p>
              <p className="text-xs">Buy plants in the Shop.</p>
            </article>
          )}
          <a href="/shop" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-4 text-center transition hover:-translate-y-0.5" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)", color: "var(--text-muted)" }}>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--bg-panel)" }}>
              <img src="/images/plants/sunflower.png" alt="" className="h-10 w-10 object-contain" />
            </span>
            <span className="text-xs font-extrabold uppercase tracking-[0.08em]">Visit Shop</span>
          </a>
        </div>
      </Panel>
    </div>
  );
}