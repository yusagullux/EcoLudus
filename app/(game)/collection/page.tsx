// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { updateUserProfile } from "@/public/js/auth.js";
import { HeroMetric, PageHero, Panel, primaryButton, secondaryButton, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";

type CollMode = "plants" | "eggs" | "animals";

const assetByName: Record<string, string> = {
  "Mossy Fern": "/images/plants/mint.png",
  "Golden Daisy": "/images/plants/sunflower.png",
  "Blue Orchid": "/images/plants/orchid.png",
  "Spotted Aloe": "/images/plants/basil.png",
  "Mystic Bamboo": "/images/plants/bamboo.png",
  "Crystal Lotus": "/images/plants/lotus.png",
  "Aurora Blossom": "/images/plants/cherry_blossom.png",
  "Ember Cactus": "/images/plants/dragonfruit.png",
  "Common Egg": "/images/eggs/common-egg.png",
  "Rare Egg": "/images/eggs/rare-egg.png",
  "Epic Egg": "/images/eggs/epic-egg.png",
  "Legendary Egg": "/images/eggs/legendary-egg.png",
  Cat: "/images/pets/cat.png",
  Dog: "/images/pets/dog.png",
  Rabbit: "/images/pets/rabbit.png",
  Bee: "/images/pets/bee.png",
  Deer: "/images/pets/deer.png",
  Wolf: "/images/pets/wolf.png",
  Bear: "/images/pets/bear.png",
  Eagle: "/images/pets/eagle.png",
  Tiger: "/images/pets/tiger.png",
  Lion: "/images/pets/lion.png",
  Owl: "/images/pets/owl.png",
  Panda: "/images/pets/panda.png",
  Dragon: "/images/pets/dragon.png"
};

const animalRewards: Record<Rarity, Array<{ name: string; image: string; rarity: Rarity }>> = {
  common: [
    { name: "Cat", image: "/images/pets/cat.png", rarity: "common" },
    { name: "Dog", image: "/images/pets/dog.png", rarity: "common" },
    { name: "Rabbit", image: "/images/pets/rabbit.png", rarity: "common" },
    { name: "Bee", image: "/images/pets/bee.png", rarity: "common" }
  ],
  rare: [
    { name: "Deer", image: "/images/pets/deer.png", rarity: "rare" },
    { name: "Owl", image: "/images/pets/owl.png", rarity: "rare" },
    { name: "Panda", image: "/images/pets/panda.png", rarity: "rare" }
  ],
  epic: [
    { name: "Wolf", image: "/images/pets/wolf.png", rarity: "epic" },
    { name: "Bear", image: "/images/pets/bear.png", rarity: "epic" },
    { name: "Eagle", image: "/images/pets/eagle.png", rarity: "epic" }
  ],
  legendary: [
    { name: "Tiger", image: "/images/pets/tiger.png", rarity: "legendary" },
    { name: "Lion", image: "/images/pets/lion.png", rarity: "legendary" },
    { name: "Dragon", image: "/images/pets/dragon.png", rarity: "legendary" }
  ]
};

function getAsset(item: any, mode: CollMode) {
  if (item.image) return item.image;
  if (assetByName[item.name]) return assetByName[item.name];
  if (mode === "plants") return "/images/plants/sunflower.png";
  if (mode === "eggs") return "/images/eggs/common-egg.png";
  return "/images/pets/cat.png";
}

export default function CollectionPage() {
  const { user, profile, setProfile } = useAuth();
  const ecoPoints = profile?.ecoPoints ?? 0;
  const [mode, setMode] = useState<CollMode>("plants");
  const [filter, setFilter] = useState<"all" | Rarity>("all");
  const [toast, setToast] = useState("");
  const [hatchingId, setHatchingId] = useState<number | string | null>(null);

  const profilePlants = Array.isArray(profile?.plants) ? profile.plants : [];
  const profileEggs = Array.isArray(profile?.eggs) ? profile.eggs : [];
  const profileAnimals = Array.isArray(profile?.animals) ? profile.animals : [];
  const items = mode === "plants" ? profilePlants : mode === "eggs" ? profileEggs : profileAnimals;
  const filtered = filter === "all" ? items : items.filter((item) => item.rarity === filter);
  const totalPlants = profilePlants.reduce((sum, plant) => sum + (plant.count ?? 1), 0);
  const totalEggs = profileEggs.reduce((sum, egg) => sum + (egg.count ?? 1), 0);
  const totalAnimals = profileAnimals.reduce((sum, animal) => sum + (animal.count ?? 1), 0);
  const tabs: ("all" | Rarity)[] = ["all", "common", "rare", "epic", "legendary"];

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const hatchEgg = async (egg: any) => {
    if (!user?.uid || !profile || hatchingId) return;

    setHatchingId(egg.id);
    const rewardPool = animalRewards[egg.rarity as Rarity] ?? animalRewards.common;
    const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    const nextEggs = profileEggs
      .map((entry) => (entry.id === egg.id ? { ...entry, count: (entry.count ?? 1) - 1 } : entry))
      .filter((entry) => (entry.count ?? 1) > 0);
    const nextAnimals = [...profileAnimals];
    const existingAnimalIndex = nextAnimals.findIndex((entry) => entry.name === reward.name);

    if (existingAnimalIndex >= 0) {
      nextAnimals[existingAnimalIndex] = {
        ...nextAnimals[existingAnimalIndex],
        count: (nextAnimals[existingAnimalIndex].count ?? 1) + 1,
        hatchedAt: new Date().toISOString()
      };
    } else {
      nextAnimals.push({
        id: `${reward.name.toLowerCase()}-${Date.now()}`,
        ...reward,
        count: 1,
        active: false,
        hatchedAt: new Date().toISOString()
      });
    }

    const updates = { eggs: nextEggs, animals: nextAnimals };
    const result = await updateUserProfile(user.uid, updates);

    if (!result.success) {
      showToast("Could not hatch egg. Please try again.");
      setHatchingId(null);
      return;
    }

    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...updates });
    }

    showToast(`${egg.name} hatched into ${reward.name}!`);
    setMode("animals");
    setHatchingId(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Your nature collection" title="My Collection" description="Every plant, egg, and companion you have earned.">
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Plants" value={totalPlants} />
          <HeroMetric label="Eggs" value={totalEggs} />
          <HeroMetric label="Animals" value={totalAnimals} />
          <HeroMetric label="Eco" value={ecoPoints.toLocaleString()} />
        </div>
      </PageHero>

      <Panel>
        <div className="flex flex-col gap-4">
          {/* Mode tabs */}
          <div className="inline-flex w-fit rounded-full p-1" style={{ background: "var(--bg-panel-alt)", border: "1px solid var(--border-default)" }}>
            {(["plants", "eggs", "animals"] as CollMode[]).map((itemMode) => (
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
          {/* Rarity filter */}
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

      {filtered.length === 0 ? (
        <Panel>
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
            <img src={mode === "eggs" ? "/images/eggs/common-egg.png" : "/images/plants/sunflower.png"} alt="" className="h-20 w-20 object-contain opacity-60" />
            <div>
              <p className="font-serif text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>Nothing here yet</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Visit the Shop to add items.</p>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((item) => {
            const style = rarityStyle[item.rarity as Rarity] ?? rarityStyle.common;
            const border = rarityBorder[item.rarity as Rarity] ?? rarityBorder.common;
            return (
              <article
                key={`${mode}-${item.id}-${item.name}`}
                className="reveal-card group relative flex flex-col overflow-hidden rounded-[20px] border transition hover:-translate-y-1"
                style={{ borderColor: border, background: "var(--bg-card)" }}
              >
                {(item as any).active && <span className="absolute left-2 top-2 z-10 rounded-full bg-[#fbf4df] px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#76511a]">Active</span>}
                {(item as any).count > 1 && <span className="absolute right-2 top-2 z-10 rounded-full bg-forest-950 px-2 py-0.5 text-[9px] font-extrabold text-cream-100">×{(item as any).count}</span>}
                <div className="relative flex aspect-square min-h-36 items-center justify-center overflow-hidden p-4" style={{ background: `${style.accent}18` }}>
                  <div className="absolute inset-x-8 bottom-6 h-6 rounded-full bg-black/8 blur-lg transition group-hover:scale-110" />
                  <img
                    src={getAsset(item, mode)}
                    alt={item.name}
                    loading="lazy"
                    className="relative h-full max-h-32 w-full max-w-32 object-contain drop-shadow-[0_12px_16px_rgba(16,33,20,0.14)] transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="font-serif text-sm font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                  <span className={`w-fit rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${style.chip}`}>{item.rarity}</span>
                  {mode === "eggs" && (
                    <button
                      type="button"
                      onClick={() => hatchEgg(item)}
                      disabled={hatchingId === item.id}
                      className={`mt-auto w-full ${hatchingId === item.id ? secondaryButton : primaryButton}`}
                    >
                      {hatchingId === item.id ? "Hatching…" : "Hatch Egg"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl md:bottom-6"
          style={{ background: "var(--bg-sidebar)", color: "var(--text-sidebar)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
