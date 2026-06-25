// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { updateUserProfile } from "@/public/js/auth.js";
import { HeroMetric, PageHero, Panel, primaryButton, secondaryButton, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";

type CollMode = "plants" | "eggs" | "animals" | "chests";

const HATCH_DURATIONS: Record<Rarity, number> = {
  common: 60 * 60 * 1000,      // 1 hour
  rare: 4 * 60 * 60 * 1000,     // 4 hours
  epic: 12 * 60 * 60 * 1000,    // 12 hours
  legendary: 24 * 60 * 60 * 1000 // 24 hours
};

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
  "Wooden Chest": "/images/chests/wooden-chest.png",
  "Bronze Chest": "/images/chests/bronze-chest.png",
  "Silver Chest": "/images/chests/silver-chest.png",
  "Golden Chest": "/images/chests/golden-chest.png",
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

const animalEmoji: Record<string, string> = {
  Cat: "🐱", Dog: "🐶", Rabbit: "🐰", Bee: "🐝", Mouse: "🐭", Worm: "🪱",
  Deer: "🦌", Owl: "🦉", Panda: "🐼", Cobra: "🐍", Jaguar: "🐆",
  Wolf: "🐺", Bear: "🐻", Eagle: "🦅", Lynx: "🐱", Shark: "🦈", Whale: "🐋",
  Tiger: "🐯", Lion: "🦁", Phoenix: "🔥", Dragon: "🐉", Kraken: "🐙", Octapus: "🐙"
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

const OPEN_CHEST_REWARDS: Record<string, () => { type: "points" | "plant" | "egg"; name: string; amount?: number; rarity: Rarity; image: string }> = {
  "Wooden Chest": () => {
    const rand = Math.random();
    if (rand < 0.6) {
      const amount = Math.floor(Math.random() * 151) + 100;
      return { type: "points", name: "EcoPoints", amount, rarity: "common", image: "/images/logo.png" };
    } else {
      const plantPool = [
        { name: "Mossy Fern", rarity: "common", image: "/images/plants/mint.png" },
        { name: "Golden Daisy", rarity: "common", image: "/images/plants/sunflower.png" }
      ];
      const plant = plantPool[Math.floor(Math.random() * plantPool.length)];
      return { type: "plant", name: plant.name, rarity: "common", image: plant.image };
    }
  },
  "Bronze Chest": () => {
    const rand = Math.random();
    if (rand < 0.5) {
      const amount = Math.floor(Math.random() * 301) + 200;
      return { type: "points", name: "EcoPoints", amount, rarity: "rare", image: "/images/logo.png" };
    } else if (rand < 0.8) {
      const plantPool = [
        { name: "Mossy Fern", rarity: "common", image: "/images/plants/mint.png" },
        { name: "Golden Daisy", rarity: "common", image: "/images/plants/sunflower.png" },
        { name: "Blue Orchid", rarity: "rare", image: "/images/plants/orchid.png" },
        { name: "Spotted Aloe", rarity: "rare", image: "/images/plants/basil.png" }
      ];
      const plant = plantPool[Math.floor(Math.random() * plantPool.length)];
      return { type: "plant", name: plant.name, rarity: plant.rarity, image: plant.image };
    } else {
      return { type: "egg", name: "Common Egg", rarity: "common", image: "/images/eggs/common-egg.png" };
    }
  },
  "Silver Chest": () => {
    const rand = Math.random();
    if (rand < 0.4) {
      const amount = Math.floor(Math.random() * 501) + 500;
      return { type: "points", name: "EcoPoints", amount, rarity: "epic", image: "/images/logo.png" };
    } else if (rand < 0.8) {
      const plantPool = [
        { name: "Blue Orchid", rarity: "rare", image: "/images/plants/orchid.png" },
        { name: "Spotted Aloe", rarity: "rare", image: "/images/plants/basil.png" },
        { name: "Mystic Bamboo", rarity: "epic", image: "/images/plants/bamboo.png" },
        { name: "Crystal Lotus", rarity: "epic", image: "/images/plants/lotus.png" }
      ];
      const plant = plantPool[Math.floor(Math.random() * plantPool.length)];
      return { type: "plant", name: plant.name, rarity: plant.rarity, image: plant.image };
    } else {
      const eggPool = [
        { type: "egg", name: "Rare Egg", rarity: "rare", image: "/images/eggs/rare-egg.png" },
        { type: "egg", name: "Epic Egg", rarity: "epic", image: "/images/eggs/epic-egg.png" }
      ];
      return eggPool[Math.floor(Math.random() * eggPool.length)];
    }
  },
  "Golden Chest": () => {
    const rand = Math.random();
    if (rand < 0.3) {
      const amount = Math.floor(Math.random() * 1501) + 1000;
      return { type: "points", name: "EcoPoints", amount, rarity: "legendary", image: "/images/logo.png" };
    } else if (rand < 0.7) {
      const plantPool = [
        { name: "Mystic Bamboo", rarity: "epic", image: "/images/plants/bamboo.png" },
        { name: "Crystal Lotus", rarity: "epic", image: "/images/plants/lotus.png" },
        { name: "Aurora Blossom", rarity: "legendary", image: "/images/plants/cherry_blossom.png" },
        { name: "Ember Cactus", rarity: "legendary", image: "/images/plants/dragonfruit.png" }
      ];
      const plant = plantPool[Math.floor(Math.random() * plantPool.length)];
      return { type: "plant", name: plant.name, rarity: plant.rarity, image: plant.image };
    } else {
      const eggPool = [
        { type: "egg", name: "Epic Egg", rarity: "epic", image: "/images/eggs/epic-egg.png" },
        { type: "egg", name: "Legendary Egg", rarity: "legendary", image: "/images/eggs/legendary-egg.png" }
      ];
      return eggPool[Math.floor(Math.random() * eggPool.length)];
    }
  }
};

function getAsset(item: any, mode: CollMode) {
  if (item.image) return item.image;
  if (assetByName[item.name]) return assetByName[item.name];
  if (mode === "plants") return "/images/plants/sunflower.png";
  if (mode === "eggs") return "/images/eggs/common-egg.png";
  if (mode === "chests") return "/images/chests/wooden-chest.png";
  return "/images/pets/cat.png";
}

function CardImage({ item, mode }: { item: any; mode: CollMode }) {
  const [imgError, setImgError] = useState(false);
  const src = getAsset(item, mode);
  
  if (mode === "animals" && (imgError || !src)) {
    const emoji = animalEmoji[item.name] || "🐾";
    return (
      <div className="flex h-full w-full items-center justify-center text-5xl select-none transition duration-300 group-hover:scale-120 drop-shadow-sm">
        {emoji}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={item.name}
      loading="lazy"
      onError={() => setImgError(true)}
      className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
    />
  );
}

const plantsList = [
  { id: 1, name: "Mossy Fern", rarity: "common", image: "/images/plants/mint.png" },
  { id: 2, name: "Golden Daisy", rarity: "common", image: "/images/plants/sunflower.png" },
  { id: 3, name: "Blue Orchid", rarity: "rare", image: "/images/plants/orchid.png" },
  { id: 4, name: "Spotted Aloe", rarity: "rare", image: "/images/plants/basil.png" },
  { id: 5, name: "Mystic Bamboo", rarity: "epic", image: "/images/plants/bamboo.png" },
  { id: 6, name: "Crystal Lotus", rarity: "epic", image: "/images/plants/lotus.png" },
  { id: 7, name: "Aurora Blossom", rarity: "legendary", image: "/images/plants/cherry_blossom.png" },
  { id: 8, name: "Ember Cactus", rarity: "legendary", image: "/images/plants/dragonfruit.png" }
];

const eggsList = [
  { id: 1, name: "Common Egg", rarity: "common", image: "/images/eggs/common-egg.png" },
  { id: 2, name: "Rare Egg", rarity: "rare", image: "/images/eggs/rare-egg.png" },
  { id: 3, name: "Epic Egg", rarity: "epic", image: "/images/eggs/epic-egg.png" },
  { id: 4, name: "Legendary Egg", rarity: "legendary", image: "/images/eggs/legendary-egg.png" }
];

export default function CollectionPage() {
  const { user, profile, setProfile } = useAuth();
  const ecoPoints = profile?.ecoPoints ?? 0;
  const [mode, setMode] = useState<CollMode>("plants");
  const [filter, setFilter] = useState<"all" | Rarity>("all");
  const [toast, setToast] = useState("");
  
  // Ticking Time state
  const [nowTime, setNowTime] = useState(Date.now());
  const [warmingId, setWarmingId] = useState<string | null>(null);

  // Fullscreen Hatching Reveal State
  const [activeHatching, setActiveHatching] = useState<any>(null);
  const [tapsLeft, setTapsLeft] = useState(5);
  const [isShaking, setIsShaking] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; dx: number; dy: number; color: string }>>([]);
  const [revealedAnimal, setRevealedAnimal] = useState<any>(null);

  // Fullscreen Chest Reveal State
  const [activeChest, setActiveChest] = useState<any>(null);
  const [chestReward, setChestReward] = useState<any>(null);
  const [chestState, setChestState] = useState<"closed" | "shaking" | "opened">("closed");
  const [chestParticles, setChestParticles] = useState<Array<{ id: number; dx: number; dy: number; color: string }>>([]);
  const [selectingPetId, setSelectingPetId] = useState<string | null>(null);

  const profilePlants = Array.isArray(profile?.plants) ? profile.plants : [];
  const profileEggs = Array.isArray(profile?.eggs) ? profile.eggs : [];
  const profileAnimals = Array.isArray(profile?.animals) ? profile.animals : [];
  const profileHatchings = Array.isArray(profile?.hatchings) ? profile.hatchings : [];
  const profileChests = Array.isArray(profile?.chests) ? profile.chests : [];

  const items = mode === "plants" ? profilePlants : mode === "eggs" ? profileEggs : mode === "animals" ? profileAnimals : profileChests;
  const filtered = filter === "all" ? items : items.filter((item) => item.rarity === filter);

  const totalPlants = profilePlants.reduce((sum, plant) => sum + (plant.count ?? 1), 0);
  const totalEggs = profileEggs.reduce((sum, egg) => sum + (egg.count ?? 1), 0) + profileHatchings.length;
  const totalAnimals = profileAnimals.reduce((sum, animal) => sum + (animal.count ?? 1), 0);
  const totalChests = profileChests.reduce((sum, chest) => sum + (chest.count ?? 1), 0);
  const tabs: ("all" | Rarity)[] = ["all", "common", "rare", "epic", "legendary"];

  // Countdown timer effect
  useEffect(() => {
    if (profileHatchings.length === 0) return;
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [profileHatchings]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  };

  const incubateEgg = async (egg: any) => {
    if (!user?.uid || !profile) return;

    if (profileHatchings.length >= 3) {
      showToast("All incubator slots are full! Hatch an egg to free up a slot.");
      return;
    }

    const nextEggs = profileEggs
      .map((entry) => (entry.id === egg.id ? { ...entry, count: (entry.count ?? 1) - 1 } : entry))
      .filter((entry) => (entry.count ?? 1) > 0);

    const newHatching = {
      id: `hatch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      eggId: egg.id,
      name: egg.name,
      rarity: egg.rarity,
      startTime: Date.now(),
      endTime: Date.now() + (HATCH_DURATIONS[egg.rarity as Rarity] ?? HATCH_DURATIONS.common),
      warmedCount: 0
    };

    const updates = {
      eggs: nextEggs,
      hatchings: [...profileHatchings, newHatching]
    };

    const result = await updateUserProfile(user.uid, updates);
    if (!result.success) {
      showToast("Could not place egg in incubator. Please try again.");
      return;
    }

    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...updates });
    }

    showToast(`${egg.name} is now incubating in the Hatching Chamber!`);
  };

  const warmEgg = async (hatching: any) => {
    if (!user?.uid || !profile) return;

    if (ecoPoints < 10) {
      showToast("Need 10 EcoPoints to warm the egg!");
      return;
    }

    const nextEcoPoints = ecoPoints - 10;
    const nextHatchings = profileHatchings.map((h) => {
      if (h.id === hatching.id) {
        return {
          ...h,
          endTime: Math.max(h.startTime, h.endTime - 15 * 60 * 1000), // Reduce by 15 mins
          warmedCount: (h.warmedCount ?? 0) + 1
        };
      }
      return h;
    });

    const updates = {
      ecoPoints: nextEcoPoints,
      hatchings: nextHatchings
    };

    setWarmingId(hatching.id);
    setTimeout(() => setWarmingId(null), 500);

    const result = await updateUserProfile(user.uid, updates);
    if (!result.success) {
      showToast("Failed to warm egg. Please try again.");
      return;
    }

    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...updates });
    }

    showToast("Warmed the egg! 15 minutes shaved off hatching time.");
  };

  const hatchInstantly = async (hatching: any) => {
    if (!user?.uid || !profile) return;

    const remainingTime = Math.max(0, hatching.endTime - nowTime);
    const cost = Math.max(10, Math.ceil(remainingTime / (3 * 60 * 1000))); // 1 EP per 3 minutes remaining, min 10

    if (ecoPoints < cost) {
      showToast(`Need ${cost} EcoPoints to hatch instantly!`);
      return;
    }

    if (!confirm(`Hatch this egg instantly for ${cost} EcoPoints?`)) return;

    const nextEcoPoints = ecoPoints - cost;
    const nextHatchings = profileHatchings.map((h) => {
      if (h.id === hatching.id) {
        return { ...h, endTime: Date.now() };
      }
      return h;
    });

    const updates = {
      ecoPoints: nextEcoPoints,
      hatchings: nextHatchings
    };

    const result = await updateUserProfile(user.uid, updates);
    if (!result.success) {
      showToast("Instant hatching failed. Please try again.");
      return;
    }

    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...updates });
    }

    showToast("Egg incubated! Ready to hatch.");
  };

  const startHatchingReveal = (hatching: any) => {
    setActiveHatching(hatching);
    setTapsLeft(5);
    setRevealedAnimal(null);
    setParticles([]);
  };

  const handleEggTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tapsLeft <= 0 || !activeHatching) return;

    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 150);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Spawn sparks at click location
    const newParticles = Array.from({ length: 8 }).map((_, idx) => ({
      id: Date.now() + idx + Math.random(),
      dx: (Math.random() - 0.5) * 160,
      dy: (Math.random() - 0.5) * 160 - 80,
      color: ["#aac487", "#eff3e8", "#9a6b1f", "#5dcfe0", "#f5f2eb"][Math.floor(Math.random() * 5)]
    }));

    setParticles((prev) => [...prev, ...newParticles]);

    const nextTaps = tapsLeft - 1;
    setTapsLeft(nextTaps);

    if (nextTaps === 0) {
      const rarity = activeHatching.rarity as Rarity;
      const rewardPool = animalRewards[rarity] ?? animalRewards.common;
      const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)];

      setRevealedAnimal(reward);

      // Mega burst sparks
      const explosionParticles = Array.from({ length: 45 }).map((_, idx) => ({
        id: Date.now() + idx + 100 + Math.random(),
        dx: (Math.random() - 0.5) * 360,
        dy: (Math.random() - 0.5) * 360 - 100,
        color: ["#f5f2eb", "#fbf4df", "#4ade80", "#60a5fa", "#f43f5e", "#fbbf24", "#d946ef"][Math.floor(Math.random() * 7)]
      }));
      setParticles((prev) => [...prev, ...explosionParticles]);
    }
  };

  const claimAnimal = async () => {
    if (!user?.uid || !profile || !activeHatching || !revealedAnimal) return;

    const nextHatchings = profileHatchings.filter((h) => h.id !== activeHatching.id);
    const nextAnimals = [...profileAnimals];
    const existingIndex = nextAnimals.findIndex((a) => a.name === revealedAnimal.name);

    if (existingIndex >= 0) {
      nextAnimals[existingIndex] = {
        ...nextAnimals[existingIndex],
        count: (nextAnimals[existingIndex].count ?? 1) + 1,
        hatchedAt: new Date().toISOString()
      };
    } else {
      nextAnimals.push({
        id: `${revealedAnimal.name.toLowerCase()}-${Date.now()}`,
        ...revealedAnimal,
        count: 1,
        active: false,
        hatchedAt: new Date().toISOString()
      });
    }

    const updates = {
      hatchings: nextHatchings,
      animals: nextAnimals
    };

    const result = await updateUserProfile(user.uid, updates);
    if (!result.success) {
      showToast("Could not claim your pet. Please try again.");
      return;
    }

    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...updates });
    }

    showToast(`${revealedAnimal.name} was added to your collection book!`);
    setActiveHatching(null);
    setMode("animals");
  };

  const openChest = async (chest: any) => {
    setActiveChest(chest);
    setChestState("shaking");
    setChestReward(null);
    setChestParticles([]);

    // Shake particles
    const shakeInterval = setInterval(() => {
      const p = Array.from({ length: 5 }).map((_, idx) => ({
        id: Date.now() + idx + Math.random(),
        dx: (Math.random() - 0.5) * 80,
        dy: (Math.random() - 0.5) * 80 - 40,
        color: ["#eab308", "#22c55e", "#3b82f6", "#ffffff"][Math.floor(Math.random() * 4)]
      }));
      setChestParticles((prev) => [...prev, ...p]);
    }, 200);

    setTimeout(async () => {
      clearInterval(shakeInterval);
      const generator = OPEN_CHEST_REWARDS[chest.name];
      const reward = generator ? generator() : { type: "points", name: "EcoPoints", amount: 100, rarity: "common", image: "/images/logo.png" };
      setChestReward(reward);
      setChestState("opened");

      // Exploding burst particles
      const burst = Array.from({ length: 40 }).map((_, idx) => ({
        id: Date.now() + idx + 100 + Math.random(),
        dx: (Math.random() - 0.5) * 360,
        dy: (Math.random() - 0.5) * 360 - 80,
        color: ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#c084fc", "#ffffff"][Math.floor(Math.random() * 6)]
      }));
      setChestParticles((prev) => [...prev, ...burst]);
    }, 1200);
  };

  const claimChestReward = async () => {
    if (!user?.uid || !profile || !activeChest || !chestReward) return;

    const nextChests = profileChests
      .map((c) => (c.id === activeChest.id ? { ...c, count: (c.count ?? 1) - 1 } : c))
      .filter((c) => (c.count ?? 1) > 0);

    const profileUpdates: Record<string, unknown> = {
      chests: nextChests
    };

    if (chestReward.type === "points") {
      profileUpdates.ecoPoints = ecoPoints + (chestReward.amount ?? 0);
    } else if (chestReward.type === "plant") {
      const nextPlants = [...profilePlants];
      const existingIdx = nextPlants.findIndex((p) => p.name === chestReward.name);
      if (existingIdx >= 0) {
        nextPlants[existingIdx] = {
          ...nextPlants[existingIdx],
          count: (nextPlants[existingIdx].count ?? 1) + 1,
          purchasedAt: new Date().toISOString()
        };
      } else {
        const basePlant = plantsList.find((p) => p.name === chestReward.name) || { id: Date.now(), name: chestReward.name, rarity: chestReward.rarity, price: 0, image: chestReward.image };
        nextPlants.push({ ...basePlant, count: 1, purchasedAt: new Date().toISOString() });
      }
      profileUpdates.plants = nextPlants;
    } else if (chestReward.type === "egg") {
      const nextEggs = [...profileEggs];
      const existingIdx = nextEggs.findIndex((e) => e.name === chestReward.name);
      if (existingIdx >= 0) {
        nextEggs[existingIdx] = {
          ...nextEggs[existingIdx],
          count: (nextEggs[existingIdx].count ?? 1) + 1,
          purchasedAt: new Date().toISOString()
        };
      } else {
        const baseEgg = eggsList.find((e) => e.name === chestReward.name) || { id: Date.now(), name: chestReward.name, rarity: chestReward.rarity, price: 0, image: chestReward.image };
        nextEggs.push({ ...baseEgg, count: 1, purchasedAt: new Date().toISOString() });
      }
      profileUpdates.eggs = nextEggs;
    }

    const result = await updateUserProfile(user.uid, profileUpdates);
    if (!result.success) {
      showToast("Failed to claim chest rewards. Please try again.");
      return;
    }

    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...profileUpdates });
    }

    showToast(`Claimed reward: ${chestReward.type === "points" ? `${chestReward.amount} EcoPoints` : chestReward.name}!`);
    setActiveChest(null);
    setChestReward(null);
    setChestState("closed");

    if (chestReward.type === "plant") {
      setMode("plants");
    } else if (chestReward.type === "egg") {
      setMode("eggs");
    }
  };

  const selectActivePet = async (animal: any) => {
    if (!user?.uid || !profile) return;
    setSelectingPetId(String(animal.id));
    const nextAnimals = profileAnimals.map((entry) => ({
      ...entry,
      active: entry.id === animal.id
    }));
    const updates = {
      animals: nextAnimals,
      activePet: animal.id
    };
    const result = await updateUserProfile(user.uid, updates);
    setSelectingPetId(null);
    if (!result.success) {
      showToast("Could not choose that companion. Please try again.");
      return;
    }
    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...updates });
    }
    showToast(`${animal.name} is now your active companion.`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Your nature collection" title="My Collection" description="Every plant, egg, companion, and chest you have earned.">
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Plants" value={totalPlants} />
          <HeroMetric label="Eggs" value={totalEggs} />
          <HeroMetric label="Chests" value={totalChests} />
          <HeroMetric label="Animals" value={totalAnimals} />
          <HeroMetric label="Eco" value={ecoPoints.toLocaleString()} />
        </div>
      </PageHero>

      <Panel>
        <div className="flex flex-col gap-4">
          {/* Mode tabs */}
          <div className="inline-flex w-fit rounded-full p-1" style={{ background: "var(--bg-panel-alt)", border: "1px solid var(--border-default)" }}>
            {(["plants", "eggs", "chests", "animals"] as CollMode[]).map((itemMode) => (
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

      {/* ── Active Hatching Pods (Incubator Chamber) ── */}
      {mode === "eggs" && (
        <Panel title="🥚 Hatching Chamber" eyebrow="Active Incubators (Max 3 Slots)">
          {profileHatchings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              <div className="text-4xl mb-2">💤</div>
              <p className="font-bold">No eggs are currently incubating.</p>
              <p className="text-xs">Place an egg from your inventory below into the chamber.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profileHatchings.map((hatching) => {
                const style = rarityStyle[hatching.rarity as Rarity] ?? rarityStyle.common;
                const border = rarityBorder[hatching.rarity as Rarity] ?? rarityBorder.common;
                const remainingTime = Math.max(0, hatching.endTime - nowTime);
                const isReady = remainingTime === 0;

                const hours = Math.floor(remainingTime / 3600000);
                const minutes = Math.floor((remainingTime % 3600000) / 60000);
                const seconds = Math.floor((remainingTime % 60000) / 1000);
                const timeString = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

                const totalDuration = HATCH_DURATIONS[hatching.rarity as Rarity] ?? HATCH_DURATIONS.common;
                const elapsed = totalDuration - remainingTime;
                const progressPct = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

                const instantCost = Math.max(10, Math.ceil(remainingTime / (3 * 60 * 1000)));
                const isWarming = warmingId === hatching.id;

                return (
                  <article
                    key={hatching.id}
                    className={`relative flex flex-col rounded-[22px] border p-4 transition-all duration-300 ${
                      isWarming ? "animate-egg-shake animate-heat-pulse border-red-400" : ""
                    }`}
                    style={{ borderColor: isReady ? "#22c55e" : border, background: "var(--bg-card)" }}
                  >
                    <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${style.chip}`}>
                      {hatching.rarity}
                    </span>

                    <div className="flex items-center gap-4">
                      {/* Incubator glass pod design */}
                      <div
                        className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm border border-forest-100/60 overflow-hidden p-1.5 ${
                          !isReady ? "animate-pulse" : "border-green-300 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                        }`}
                        style={!isReady ? { boxShadow: `0 0 12px ${style.accent}20` } : undefined}
                      >
                        <img
                          src={`/images/eggs/${hatching.rarity}-egg.png`}
                          alt={hatching.name}
                          className={`h-full w-full object-contain ${!isReady ? "animate-bounce" : "animate-egg-shake"}`}
                          style={{ animationDuration: !isReady ? "2.5s" : "0.8s" }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-serif text-sm font-extrabold leading-tight truncate">{hatching.name}</h4>
                        {!isReady ? (
                          <>
                            <p className="mt-1 font-mono text-xs font-black" style={{ color: "var(--text-accent)" }}>
                              ⏳ {timeString}
                            </p>
                            <div className="mt-2 h-1.5 w-full rounded-full bg-forest-100 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progressPct}%`, backgroundColor: style.accent }}
                              />
                            </div>
                          </>
                        ) : (
                          <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-green-600 animate-pulse">
                            ✨ Ready to hatch!
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      {!isReady ? (
                        <>
                          <button
                            onClick={() => warmEgg(hatching)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-[10px] font-black uppercase tracking-wider transition bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                          >
                            🔥 Warm (10 EP)
                          </button>
                          <button
                            onClick={() => hatchInstantly(hatching)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-[10px] font-black uppercase tracking-wider transition bg-forest-950 text-cream-100 hover:bg-forest-800"
                          >
                            ⚡ Hatch ({instantCost} EP)
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startHatchingReveal(hatching)}
                          className="w-full flex items-center justify-center gap-2 rounded-full py-2 text-xs font-black uppercase tracking-wider transition bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-500/10 animate-bounce"
                        >
                          🥚 Open Egg!
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      )}

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
                
                {/* Framed card image design - full bleed aspect ratio */}
                <div className="relative flex aspect-square items-center justify-center overflow-hidden" style={{ background: `${style.accent}12` }}>
                  <CardImage item={item} mode={mode} />
                  <span className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${style.chip}`}>{item.rarity}</span>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="font-serif text-sm font-extrabold leading-tight truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                  {mode === "eggs" && (
                    <button
                      type="button"
                      onClick={() => incubateEgg(item)}
                      className={`mt-auto w-full ${primaryButton}`}
                    >
                      Incubate
                    </button>
                  )}
                  {mode === "chests" && (
                    <button
                      type="button"
                      onClick={() => openChest(item)}
                      className={`mt-auto w-full ${primaryButton}`}
                    >
                      Open Chest
                    </button>
                  )}
                  {mode === "animals" && (
                    <button
                      type="button"
                      onClick={() => selectActivePet(item)}
                      disabled={(item as any).active || selectingPetId === String(item.id)}
                      className={`mt-auto w-full ${(item as any).active ? secondaryButton : primaryButton}`}
                    >
                      {(item as any).active ? "Active Pet" : selectingPetId === String(item.id) ? "Choosing..." : "Choose Pet"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Interactive Hatching Modal ── */}
      {activeHatching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md fade-in">
          <div className="relative w-full max-w-md rounded-[32px] border border-white/10 bg-gradient-to-b from-[#1c2e21] to-[#0c1810] p-6 text-center text-white shadow-2xl animate-modal-in">
            
            {/* Sparkle Particles container */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full animate-particle pointer-events-none"
                  style={{
                    backgroundColor: p.color,
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                    boxShadow: `0 0 8px ${p.color}`
                  } as any}
                />
              ))}
            </div>

            {!revealedAnimal ? (
              <div className="flex flex-col items-center gap-6 py-6">
                <div>
                  <h3 className="font-serif text-2xl font-black text-moss-300">Incubator Chamber</h3>
                  <p className="mt-1.5 text-xs text-white/60">Tap the egg to break the shell!</p>
                </div>

                <div
                  onClick={handleEggTap}
                  className="relative flex h-60 w-60 cursor-pointer items-center justify-center rounded-full bg-white/5 shadow-inner transition hover:scale-105"
                >
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_65%)] animate-pulse" />

                  <div className={`relative h-44 w-44 transition ${isShaking ? "animate-egg-shake" : ""}`}>
                    <img
                      src={`/images/eggs/${activeHatching.rarity}-egg.png`}
                      alt={activeHatching.name}
                      className="h-full w-full object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.4)]"
                    />

                    {/* SVG crack overlay depending on taps left */}
                    {tapsLeft < 5 && (
                      <svg
                        className="absolute inset-0 h-full w-full pointer-events-none select-none text-black/60"
                        viewBox="0 0 100 100"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      >
                        {tapsLeft <= 4 && <path d="M 50 20 L 45 40 L 55 50" />}
                        {tapsLeft <= 3 && <path d="M 55 50 L 35 60 L 40 75" />}
                        {tapsLeft <= 2 && <path d="M 45 40 L 65 35 L 75 45" />}
                        {tapsLeft <= 1 && <path d="M 40 75 L 60 85" />}
                      </svg>
                    )}
                  </div>

                  <div className="absolute bottom-4 rounded-full bg-black/40 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-moss-300">
                    Taps Left: {tapsLeft}
                  </div>
                </div>

                <div className="w-full max-w-[240px]">
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${((5 - tapsLeft) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 py-6 animate-bounce-in">
                <div>
                  <span className="rounded-full bg-green-500/20 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-green-400">
                    Hatched Successfully!
                  </span>
                  <h3 className="mt-4 font-serif text-3xl font-black text-white">Meet {revealedAnimal.name}!</h3>
                  <p className="mt-1 text-xs text-white/50">A rare eco companion was added to your collection.</p>
                </div>

                <div
                  className="relative flex h-52 w-52 items-center justify-center rounded-[28px] border border-white/10 bg-white/5 shadow-2xl p-6 overflow-hidden"
                  style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-green-500/10 to-transparent pointer-events-none" />
                  <CardImage item={revealedAnimal} mode="animals" />
                </div>

                <div className="flex flex-col items-center">
                  <span className={`rounded-full px-3.5 py-1 text-[10px] font-black uppercase tracking-widest ${rarityStyle[revealedAnimal.rarity as Rarity]?.chip}`}>
                    {revealedAnimal.rarity}
                  </span>
                  <p className="mt-3 text-xs leading-relaxed max-w-[280px] text-white/70">
                    {revealedAnimal.name} is a {revealedAnimal.rarity} companion that will accompany you on your sustainable missions!
                  </p>
                </div>

                <button
                  onClick={claimAnimal}
                  className="w-full max-w-[280px] rounded-full py-3.5 text-xs font-black uppercase tracking-wider transition bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/25 active:scale-[0.98]"
                >
                  Claim Pet & Continue
                </button>
              </div>
            )}

            {tapsLeft > 0 && (
              <button
                onClick={() => setActiveHatching(null)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                aria-label="Close modal"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Interactive Chest Opening Modal ── */}
      {activeChest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md fade-in">
          <div className="relative w-full max-w-md rounded-[32px] border border-white/10 bg-gradient-to-b from-[#1c222e] to-[#0c1018] p-6 text-center text-white shadow-2xl animate-modal-in">
            
            {/* Sparkle Particles container */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
              {chestParticles.map((p) => (
                <div
                  key={p.id}
                  className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full animate-particle pointer-events-none"
                  style={{
                    backgroundColor: p.color,
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                    boxShadow: `0 0 8px ${p.color}`
                  } as any}
                />
              ))}
            </div>

            {chestState !== "opened" ? (
              <div className="flex flex-col items-center gap-6 py-6">
                <div>
                  <h3 className="font-serif text-2xl font-black text-yellow-400">Opening Chest...</h3>
                  <p className="mt-1.5 text-xs text-white/60">Brace yourself for mysterious rewards!</p>
                </div>

                <div
                  className="relative flex h-60 w-60 items-center justify-center rounded-full bg-white/5 shadow-inner animate-pulse"
                >
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.1),transparent_65%)]" />

                  <div className={`relative h-44 w-44 transition ${chestState === "shaking" ? "animate-chest-shake animate-chest-glow" : ""}`}>
                    <img
                      src={`/images/chests/${activeChest.name.toLowerCase().replace(" ", "-")}.png`}
                      alt={activeChest.name}
                      className="h-full w-full object-contain drop-shadow-[0_18px_36px_rgba(0,0,0,0.45)]"
                    />
                    <div className="pointer-events-none absolute inset-x-6 top-8 h-10 rounded-full bg-yellow-300/25 blur-xl" />
                  </div>
                </div>

                <div className="text-xs font-black uppercase text-yellow-500 animate-pulse">
                  {chestState === "shaking" ? "Unlocking Magic..." : "Ready to Open"}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 py-6 animate-bounce-in">
                <div>
                  <span className="rounded-full bg-yellow-500/20 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-yellow-400">
                    Chest Opened!
                  </span>
                  <h3 className="mt-4 font-serif text-3xl font-black text-white">
                    {chestReward.type === "points" ? `+${chestReward.amount} EcoPoints!` : `Unlocked ${chestReward.name}!`}
                  </h3>
                  <p className="mt-1 text-xs text-white/50">Your reward has been added to your profile.</p>
                </div>

                <div
                  className="relative flex h-52 w-52 items-center justify-center rounded-[28px] border border-white/10 bg-white/5 shadow-2xl p-6 overflow-hidden"
                  style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/10 to-transparent pointer-events-none" />
                  {chestReward.type === "points" ? (
                    <div className="text-6xl select-none drop-shadow-md">🪙</div>
                  ) : (
                    <img
                      src={chestReward.image}
                      alt={chestReward.name}
                      className="h-32 w-32 object-contain"
                    />
                  )}
                </div>

                <div className="flex flex-col items-center">
                  <span className={`rounded-full px-3.5 py-1 text-[10px] font-black uppercase tracking-widest ${rarityStyle[chestReward.rarity as Rarity]?.chip}`}>
                    {chestReward.rarity}
                  </span>
                  <p className="mt-3 text-xs leading-relaxed max-w-[280px] text-white/70">
                    {chestReward.type === "points" 
                      ? "Spend these EcoPoints in the Plant Shop to buy more eggs and chests!" 
                      : `${chestReward.name} is a ${chestReward.rarity} item that has been added to your inventory.`}
                  </p>
                </div>

                <button
                  onClick={claimChestReward}
                  className="w-full max-w-[280px] rounded-full py-3.5 text-xs font-black uppercase tracking-wider transition bg-yellow-500 text-black hover:bg-yellow-600 shadow-lg shadow-yellow-500/25 active:scale-[0.98] font-bold"
                >
                  Claim & Continue
                </button>
              </div>
            )}

            {chestState === "closed" && (
              <button
                onClick={() => setActiveChest(null)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                aria-label="Close modal"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl"
          style={{ background: "var(--bg-sidebar)", color: "var(--text-sidebar)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
