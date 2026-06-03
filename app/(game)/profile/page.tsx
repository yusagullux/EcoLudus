// @ts-nocheck
"use client";

import { useAuth } from "@/lib/useAuth";
import { HeroMetric, MetricCard, PageHero, Panel, Pill, ProgressBar } from "@/components/game-ui";

const badgeList = [
  { level: 1, name: "Cat", mark: "CT" },
  { level: 2, name: "Fox", mark: "FX" },
  { level: 3, name: "Rabbit", mark: "RB" },
  { level: 4, name: "Deer", mark: "DR" },
  { level: 5, name: "Wolf", mark: "WF" },
  { level: 6, name: "Bear", mark: "BR" },
  { level: 7, name: "Eagle", mark: "EA" },
  { level: 8, name: "Tiger", mark: "TG" },
  { level: 9, name: "Lion", mark: "LN" }
];

function getBadge(level: number) {
  return badgeList[Math.min(Math.max(level, 1), 9) - 1];
}

const categories = [
  { id: "recycling", name: "Recycling", mark: "RC", color: "#2f6b46", done: 4, total: 8, co2: 1.8, maxCo2: 3.6, badge: "Recycler" },
  { id: "energy", name: "Energy Saving", mark: "EN", color: "#9a6b1f", done: 3, total: 7, co2: 0.9, maxCo2: 2.1, badge: "Energy Saver" },
  { id: "transportation", name: "Transportation", mark: "TR", color: "#2f5f86", done: 2, total: 5, co2: 1.2, maxCo2: 3.0, badge: "Eco Commuter" },
  { id: "water", name: "Water Saving", mark: "WA", color: "#237482", done: 5, total: 6, co2: 0.4, maxCo2: 0.5, badge: "Water Guardian" },
  { id: "cleanup", name: "Clean-Up", mark: "CU", color: "#62508f", done: 1, total: 4, co2: 0.6, maxCo2: 2.4, badge: "Clean Earth" },
  { id: "gardening", name: "Gardening & Nature", mark: "GD", color: "#4c7a3b", done: 2, total: 4, co2: 0.3, maxCo2: 0.6, badge: "Green Thumb" }
];

const samplePlants = [
  { id: 1, name: "Mossy Fern", rarity: "common", mark: "MF" },
  { id: 2, name: "Blue Orchid", rarity: "rare", mark: "BO" },
  { id: 3, name: "Aurora Blossom", rarity: "legendary", mark: "AB" }
];

const rarityChip: Record<string, string> = {
  common: "bg-[#eef2e8] text-[#344534]",
  rare: "bg-[#edf5f8] text-[#27556b]",
  epic: "bg-[#f2eff7] text-[#594174]",
  legendary: "bg-[#fbf4df] text-[#76511a]"
};

const rarityBorder: Record<string, string> = {
  common: "#d9e2d2",
  rare: "#bed0dd",
  epic: "#d2c9df",
  legendary: "#e6d3a6"
};

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const displayName = profile?.displayName || user?.email?.split("@")[0] || "Explorer";
  const email = user?.email || "-";
  const xp = profile?.xp ?? 0;
  const ecoPoints = profile?.ecoPoints ?? 0;
  const level = profile?.level ?? 1;
  const missionsCompleted = profile?.missionsCompleted ?? 0;
  const badge = getBadge(level);
  const totalCo2 = categories.reduce((sum, category) => sum + category.co2, 0);

  const statCards = [
    { label: "Current Rank", value: "#4", accent: "#2f6b46" },
    { label: "Best Rank", value: "#2", accent: "#9a6b1f" },
    { label: "Level", value: level, accent: "#2f5f86" },
    { label: "Missions Completed", value: missionsCompleted, accent: "#62508f" },
    { label: "CO2 Reduced", value: `${totalCo2.toFixed(1)} kg`, accent: "#237482", wide: true },
    { label: "EcoPoints", value: ecoPoints.toLocaleString(), accent: "#4c7a3b" }
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow={`${badge.name} Badge, Level ${level}`} title={displayName} description={email}>
        <div className="flex flex-wrap gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/12 bg-white/8 font-serif text-3xl font-extrabold text-white">{badge.mark}</div>
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
          {categories.map(({ name, mark, color, done, total, co2, maxCo2, badge: categoryBadge }) => {
            const pct = Math.round((done / total) * 100);
            const completed = done === total;
            return (
              <article key={name} className="rounded-2xl border border-[#dfe7d7] bg-[#f7f9f2] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-xs font-extrabold text-forest-800 shadow-sm">{mark}</span>
                    <div>
                      <p className="text-sm font-extrabold text-forest-950">{name}</p>
                      <p className="text-xs font-semibold text-forest-700/58">{done}/{total} quests</p>
                    </div>
                  </div>
                  {completed && <Pill active>{categoryBadge}</Pill>}
                </div>
                <ProgressBar value={pct} color={color} />
                <div className="mt-2 flex justify-between text-xs">
                  <span className="font-extrabold" style={{ color }}>{pct}%</span>
                  <span className="font-semibold text-forest-700/54">{co2.toFixed(1)}/{maxCo2.toFixed(1)} kg CO2</span>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel eyebrow="Rare finds" title="Collection Book" action={<Pill>{samplePlants.length} plants</Pill>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {samplePlants.map((plant) => (
            <article key={plant.id} className="flex flex-col items-center gap-3 rounded-2xl border bg-[#fffefa] p-4 text-center transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(26,45,29,0.1)]" style={{ borderColor: rarityBorder[plant.rarity] }}>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4f7ef] font-serif text-xl font-extrabold text-forest-800">{plant.mark}</span>
              <p className="text-sm font-extrabold leading-tight text-forest-950">{plant.name}</p>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${rarityChip[plant.rarity]}`}>{plant.rarity}</span>
            </article>
          ))}
          <a href="/shop" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#cbd9c2] bg-[#f7f9f2] p-4 text-center text-forest-700 transition hover:-translate-y-0.5 hover:bg-white">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white font-serif text-lg font-extrabold">SH</span>
            <span className="text-xs font-extrabold uppercase tracking-[0.08em]">Visit Shop</span>
          </a>
        </div>
      </Panel>
    </div>
  );
}
