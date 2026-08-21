"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { HeroMetric, PageHero, Panel, Pill, ProgressBar, StatGrid, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";
import { CategoryIcon } from "@/components/category-icon";
import { Avatar } from "@/components/avatar";
import { PillTabBar } from "@/components/ui/pill-tab-bar";
import { useShopCatalog, useSpeciesCatalog } from "@/lib/useCatalog";
import { PLANT_IMAGES } from "@/lib/ui-shared";
import { CollectionCardImage, CollectionCardLockedHint, CollectionCountBadge, CollectionRarityBadge } from "@/components/collection-card";
import { secondaryButton } from "@/components/game-ui";

// Shared profile view rendered for both the owner's own profile and other
// users' public profiles. The `profile` prop is a normalized public shape —
// callers (own page vs /api/users/[id]) are responsible for curating it so no
// private fields (email, friend requests, settings, trust) ever reach here.

export type PublicProfile = {
  id: string;
  displayName: string;
  profileImage?: string | null;
  xp: number;
  level: number;
  ecoPoints: number;
  missionsCompleted: number;
  carbonReduced: number;
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string;
  completedQuests: string[];
  // Public collection data — exposed for the full Pokédex-style book below.
  plants: any[];
  eggs: any[];
  animals: any[];
  seeds: any[];
  chests: any[];
};

const categories = [
  { id: "recycling", name: "Recycling", image: "/images/forest.webp", color: "#2f6b46", maxCo2: 3.6, badge: "Recycler" },
  { id: "energy", name: "Energy Saving", image: "/images/background.webp", color: "#9a6b1f", maxCo2: 2.1, badge: "Energy Saver" },
  { id: "transportation", name: "Transportation", image: "/images/mountains.webp", color: "#2f5f86", maxCo2: 3.0, badge: "Eco Commuter" },
  { id: "water", name: "Water Saving", image: "/images/nature.webp", color: "#237482", maxCo2: 0.5, badge: "Water Guardian" },
  { id: "cleanup", name: "Clean-Up", image: "/images/night.webp", color: "#62508f", maxCo2: 2.4, badge: "Clean Earth" },
  { id: "gardening", name: "Gardening & Nature", image: "/images/plants/bamboo.png", color: "#4c7a3b", maxCo2: 0.6, badge: "Green Thumb" }
];

function getPlantImage(plant: any) {
  return plant.image || PLANT_IMAGES[plant.name] || "/images/plants/sunflower.png";
}

function usePublicProfileUrl(profileId: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/profile/${encodeURIComponent(profileId)}`;
}

// Quest id prefixes that map to each category id in quests.json.
const CATEGORY_QUEST_PREFIXES: Record<string, string[]> = {
  recycling: ["recycling_"],
  energy: ["energy_"],
  transportation: ["transportation_"],
  water: ["water_"],
  cleanup: ["cleanup_"],
  gardening: ["gardening_", "sustainable_"]
};

const CATEGORY_TOTALS: Record<string, number> = {
  recycling: 10,
  energy: 12,
  transportation: 7,
  water: 6,
  cleanup: 6,
  gardening: 10
};

type CollMode = "plants" | "eggs" | "animals" | "seeds" | "chests";

type MasterEntry = {
  id: string | number;
  name: string;
  rarity: Rarity;
  image: string;
};

export function PublicProfileView({ profile, isOwner }: { profile: PublicProfile; isOwner: boolean }) {
  const displayName = profile.displayName || "Eco Explorer";
  const xp = Number(profile.xp ?? 0);
  const ecoPoints = Number(profile.ecoPoints ?? 0);
  const level = Number(profile.level ?? 1);
  const missionsCompleted = Number(profile.missionsCompleted ?? 0);
  const carbonReduced = Number(profile.carbonReduced ?? 0);
  const completedQuests: string[] = Array.isArray(profile.completedQuests) ? profile.completedQuests : [];
  const profilePlants = Array.isArray(profile.plants) ? profile.plants : [];
  const profileEggs = Array.isArray(profile.eggs) ? profile.eggs : [];
  const profileAnimals = Array.isArray(profile.animals) ? profile.animals : [];
  const profileSeeds = Array.isArray(profile.seeds) ? profile.seeds : [];
  const profileChests = Array.isArray(profile.chests) ? profile.chests : [];
  const currentStreak = Number(profile.currentStreak ?? 0);
  const longestStreak = Number(profile.longestStreak ?? 0);
  const lastLoginDate = profile.lastLoginDate || "Not tracked yet";

  const [mode, setMode] = useState<CollMode>("plants");
  const [copied, setCopied] = useState(false);
  const profileUrl = usePublicProfileUrl(profile.id);

  const copyProfileLink = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures (e.g. permission denied).
    }
  };

  const shopCat = useShopCatalog();
  const speciesCat = useSpeciesCatalog();
  const catalogLoading = shopCat.isLoading || speciesCat.isLoading;

  const shopCatalog = {
    plants: shopCat.plants as MasterEntry[],
    eggs: shopCat.eggs as MasterEntry[],
    chests: shopCat.chests as MasterEntry[]
  };
  const speciesCatalog = {
    pets: speciesCat.pets as MasterEntry[],
    seeds: speciesCat.seeds as MasterEntry[]
  };

  const masterList: MasterEntry[] =
    mode === "plants" ? (shopCatalog.plants ?? [])
    : mode === "eggs" ? (shopCatalog.eggs ?? [])
    : mode === "chests" ? (shopCatalog.chests ?? [])
    : mode === "animals" ? (speciesCatalog.pets ?? [])
    : (speciesCatalog.seeds ?? []);

  const ownedRecords: any[] =
    mode === "plants" ? profilePlants
    : mode === "eggs" ? profileEggs
    : mode === "chests" ? profileChests
    : mode === "animals" ? profileAnimals
    : profileSeeds;

  const ownedByName = new Map<string, any>();
  for (const rec of ownedRecords) {
    if (rec && typeof rec.name === "string") ownedByName.set(rec.name, rec);
  }

  const discoveredCount = masterList.filter((entry) => ownedByName.has(entry.name)).length;
  const totalCount = masterList.length;
  const collectionStats = {
    plants: { found: (shopCatalog.plants ?? []).filter((p) => profilePlants.some((o: any) => o.name === p.name)).length, total: shopCatalog.plants?.length ?? 0 },
    eggs: { found: (shopCatalog.eggs ?? []).filter((p) => profileEggs.some((o: any) => o.name === p.name)).length, total: shopCatalog.eggs?.length ?? 0 },
    animals: { found: (speciesCatalog.pets ?? []).filter((p) => profileAnimals.some((o: any) => o.name === p.name)).length, total: speciesCatalog.pets?.length ?? 0 },
    seeds: { found: (speciesCatalog.seeds ?? []).filter((p) => profileSeeds.some((o: any) => o.name === p.name)).length, total: speciesCatalog.seeds?.length ?? 0 },
    chests: { found: (shopCatalog.chests ?? []).filter((p) => profileChests.some((o: any) => o.name === p.name)).length, total: shopCatalog.chests?.length ?? 0 }
  };

  const categoryProgress = categories.map(category => {
    const prefixes = CATEGORY_QUEST_PREFIXES[category.id] ?? [`${category.id}_`];
    const total = CATEGORY_TOTALS[category.id] ?? 6;
    const done = completedQuests.filter(qid =>
      prefixes.some(prefix => String(qid).startsWith(prefix))
    ).length;
    const co2 = total > 0 ? (done / total) * category.maxCo2 : 0;
    return { ...category, done, total, co2 };
  });

  const statCards = [
    { label: "Level", value: level, accent: "var(--text-accent)" },
    { label: "Missions Done", value: missionsCompleted, accent: "var(--text-accent)" },
    { label: "CO₂ Reduced", value: `${carbonReduced.toFixed(1)} kg`, accent: "var(--text-accent)", wide: true },
    { label: "EcoPoints", value: ecoPoints.toLocaleString(), accent: "var(--text-accent)" },
    { label: "Current Streak", value: `${currentStreak}d`, accent: "var(--text-accent)" },
    { label: "Best Streak", value: `${longestStreak}d`, accent: "var(--text-accent)" }
  ];

  const modeOptions: CollMode[] = ["plants", "eggs", "animals", "seeds", "chests"];
  const totalCollectedItems = profilePlants.reduce((sum, p) => sum + (p.count ?? 1), 0)
    + profileEggs.reduce((sum, p) => sum + (p.count ?? 1), 0)
    + profileAnimals.reduce((sum, p) => sum + (p.count ?? 1), 0)
    + profileSeeds.reduce((sum, p) => sum + (p.count ?? 1), 0)
    + profileChests.reduce((sum, p) => sum + (p.count ?? 1), 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow={`Level ${level}`} title={<span className="break-words" title={displayName}>{displayName}</span>} description={isOwner ? "Your profile" : "Public profile"}>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={displayName} src={profile.profileImage} size={80} className="ring-2 ring-[var(--border-subtle)]" />
          <HeroMetric label="XP" value={xp.toLocaleString()} />
          <HeroMetric label="Missions" value={missionsCompleted} />
          <HeroMetric label="Streak" value={`${currentStreak}d`} />
          {isOwner && (
            <Link
              href="/settings"
              className="inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] transition hover:opacity-80"
              style={{ background: "var(--bg-panel-alt)", color: "var(--text-primary)" }}
            >
              Edit profile
            </Link>
          )}
          {isOwner && profileUrl && (
            <button
              type="button"
              onClick={copyProfileLink}
              className={secondaryButton}
              aria-label="Copy public profile link"
            >
              {copied ? "Copied!" : "Share profile"}
            </button>
          )}
        </div>
      </PageHero>

      <StatGrid className="grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" items={statCards} />

      <Panel eyebrow="Login activity" title="Streak Status" action={<Pill>Last login {lastLoginDate}</Pill>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Current run</p>
            <p className="mt-2 font-serif text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{currentStreak} day{currentStreak === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Personal best</p>
            <p className="mt-2 font-serif text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{longestStreak} day{longestStreak === 1 ? "" : "s"}</p>
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Achievement tracking" title="Quest Category Progress">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categoryProgress.map(({ name, color, done, total, maxCo2, badge: categoryBadge }) => {
            const pct = Math.round((done / total) * 100);
            const completed = done === total;
            return (
              <article key={name} className="t-panel rounded-2xl p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl" style={{ background: "var(--bg-panel-alt)" }}>
                      <CategoryIcon name={name} color={color} className="h-6 w-6" />
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
                  <span className="font-semibold" style={{ color: "var(--text-muted)" }}>{(done / total * maxCo2).toFixed(1)}/{maxCo2.toFixed(1)} kg CO₂</span>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel
        eyebrow="Rare finds"
        title="Collection Book"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{collectionStats.plants.found}/{collectionStats.plants.total} plants</Pill>
            <Pill>{collectionStats.eggs.found}/{collectionStats.eggs.total} eggs</Pill>
            <Pill>{collectionStats.animals.found}/{collectionStats.animals.total} pets</Pill>
            <Pill>{collectionStats.seeds.found}/{collectionStats.seeds.total} seeds</Pill>
            <Pill>{collectionStats.chests.found}/{collectionStats.chests.total} chests</Pill>
            <Pill active>{totalCollectedItems} items</Pill>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <PillTabBar<CollMode>
            value={mode}
            options={modeOptions}
            onChange={(v) => setMode(v)}
          />

          {!catalogLoading && totalCount > 0 && (
            <p className="px-1 text-sm font-extrabold" style={{ color: "var(--text-muted)" }}>
              Discovered {discoveredCount}/{totalCount} {mode}
            </p>
          )}

          {catalogLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-[20px]" style={{ background: "var(--bg-panel-alt)" }} />
              ))}
            </div>
          ) : masterList.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)", color: "var(--text-muted)" }}>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-sm" style={{ background: "var(--bg-panel)" }} aria-hidden="true">📚</span>
              <p className="text-sm font-bold">No species data available</p>
              <p className="text-xs">The catalog could not be loaded.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {masterList.map((entry) => {
                const owned = ownedByName.get(entry.name);
                const discovered = !!owned;
                const style = rarityStyle[entry.rarity] ?? rarityStyle.common;
                const border = discovered ? (rarityBorder[entry.rarity] ?? rarityBorder.common) : "var(--border-default)";
                const count = Number(owned?.count ?? 1);
                return (
                  <article
                    key={`${mode}-${entry.id}-${entry.name}`}
                    className="group relative flex flex-col overflow-hidden rounded-[20px] border transition hover:-translate-y-1"
                    style={{
                      borderColor: border,
                      background: "var(--bg-card)",
                      borderStyle: discovered ? "solid" : "dashed"
                    }}
                    title={discovered ? undefined : "Complete quests to unlock"}
                    aria-label={discovered ? undefined : "Locked species — complete quests to unlock"}
                  >
                    {!discovered && <span className="absolute left-2 top-2 z-10 text-base">🔒</span>}

                    <div
                      className="relative flex aspect-square items-center justify-center overflow-hidden"
                      style={{
                        background: discovered ? `color-mix(in srgb, ${style.accent} 7%, var(--bg-card))` : "linear-gradient(160deg, var(--bg-panel-alt), color-mix(in srgb, var(--text-accent) 8%, var(--bg-panel-alt)))"
                      }}
                    >
                      <CollectionCardImage entry={entry} discovered={discovered} mode={mode} />
                      {!discovered && <CollectionCardLockedHint />}
                      {discovered && <span className="absolute right-2 top-2 z-10"><CollectionRarityBadge rarity={entry.rarity} className={style.chip} /></span>}
                      {discovered && <CollectionCountBadge count={count} />}
                    </div>

                    <div className="flex flex-1 flex-col gap-1 p-3 text-center">
                      <p className="font-serif text-sm font-extrabold leading-tight truncate" style={{ color: "var(--text-primary)" }}>
                        {discovered ? entry.name : "???"}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!isOwner && !catalogLoading && (
            <p className="text-center text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              This is what {displayName} has chosen to share publicly.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
