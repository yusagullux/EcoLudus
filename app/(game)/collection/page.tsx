"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/useAuth";
import { useShopCatalog, useSpeciesCatalog } from "@/lib/useCatalog";
import { HeroMetric, PageHero, Panel, Pill, primaryButton, secondaryButton, PillTabBar, PillFilterBar, rarityStyle, rarityBorder, heroAccents, type Rarity } from "@/components/game-ui";
import { useToast } from "@/lib/toast";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PET_EMOJI } from "@/lib/ui-shared";
import { StaggerContainer, StaggerItem, TabPanel } from "@/lib/animations";

// Pokédex-style collection book. Each tab renders the FULL master list of
// discoverable species (sourced from the catalog APIs), not just what the user
// owns. An entry the user owns (matched by `name`) is rendered fully; an entry
// they have never owned is rendered as a locked silhouette with "???" — no
// name, no rarity, no count, no actions. Per-tab "X/Y discovered" progress
// replaces the old owned-count totals.
//
// Master lists:
//   plants / eggs / chests → GET /api/catalog/shop  (DB-backed catalog_items)
//   pets / seeds           → GET /api/catalog/species (TS constants in lib/catalog)
//
// Discovery is binary "owned = discovered": a species is unlocked iff its
// `name` appears in the corresponding owned profile array. No new profile
// field, no server writes on acquisition — lowest risk. The hatch/chest routes
// re-validate rewards server-side, so a client can't forge discovery by
// tampering with what it renders.

type CollMode = "plants" | "eggs" | "animals" | "seeds" | "chests";

type MasterEntry = {
  id: string | number;
  name: string;
  rarity: Rarity;
  image: string;
};

type ShopCatalog = {
  plants: MasterEntry[];
  eggs: MasterEntry[];
  chests: MasterEntry[];
};

type SpeciesCatalog = {
  pets: MasterEntry[];
  seeds: MasterEntry[];
};

const HATCH_DURATIONS: Record<Rarity, number> = {
  common: 60 * 60 * 1000,      // 1 hour
  rare: 4 * 60 * 60 * 1000,     // 4 hours
  epic: 12 * 60 * 60 * 1000,    // 12 hours
  legendary: 24 * 60 * 60 * 1000 // 24 hours
};

// Image-error fallback for pets only (the catalog image path is the source of
// truth for every other species). Kept small — a missing pet asset falls back
// to an emoji rather than a broken-image icon. The emoji map itself is shared
// with the pets page via `PET_EMOJI` in lib/ui-shared so the two can't drift.

function CardImage({ entry, discovered, mode, fit }: { entry: MasterEntry; discovered: boolean; mode: CollMode; fit?: "cover" | "contain" }) {
  const [imgError, setImgError] = useState(false);

  // All species tiles (plants, eggs, seeds, chests AND animals) now use
  // object-cover for a uniform, full-bleed Pokédex grid that matches the shop.
  // Pass fit="contain" for showcase surfaces (e.g. the hatching reveal) where
  // the whole creature must stay visible — animal art has wildly varying
  // aspect ratios (cobra 687×1031 portrait, cat 1742×1161 landscape) and
  // cropping the head/tail/wings on a big reveal would look wrong.
  const fitClass = fit === "contain" ? "object-contain p-1.5" : "object-cover";

  // Locked entries render as a pure silhouette: brightness(0) kills color,
  // opacity(0.55) softens it into a dark shape over the panel. The alt text is
  // descriptive but non-spoilering — it tells assistive-tech users a discoverable
  // species card is here without revealing the name shown as "???".
  if (!discovered) {
    return (
      <Image
        src={entry.image}
        alt="Locked species — not yet discovered"
        fill
        sizes="(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 220px"
        onError={() => setImgError(true)}
        className={`${fitClass} transition duration-300`}
        style={{ filter: "grayscale(1) brightness(0.7)", opacity: 0.75 }}
      />
    );
  }

  if (mode === "animals" && imgError) {
    const emoji = PET_EMOJI[entry.name] || "🐾";
    return (
      <div className="flex h-full w-full items-center justify-center text-5xl select-none transition duration-300 group-hover:scale-120 drop-shadow-sm">
        {emoji}
      </div>
    );
  }

  return (
    <Image
      src={entry.image}
      alt={entry.name}
      fill
      sizes="(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 220px"
      onError={() => setImgError(true)}
      className={`${fitClass} transition duration-300 group-hover:scale-110`}
    />
  );
}

export default function CollectionPage() {
  const { user, profile, setProfile, refreshProfile } = useAuth();
  const ecoPoints = Number(profile?.ecoPoints ?? 0);
  const [mode, setMode] = useState<CollMode>("plants");
  const [filter, setFilter] = useState<"all" | Rarity>("all");
  const toast = useToast();

  // Master lists (the full discoverable universe per tab). SWR caches both
  // across navigations — the shop catalog is shared with the shop page.
  const shopCat = useShopCatalog();
  const speciesCat = useSpeciesCatalog();
  const shopCatalog: ShopCatalog = {
    plants: shopCat.plants as MasterEntry[],
    eggs: shopCat.eggs as MasterEntry[],
    chests: shopCat.chests as MasterEntry[]
  };
  const speciesCatalog: SpeciesCatalog = {
    pets: speciesCat.pets as MasterEntry[],
    seeds: speciesCat.seeds as MasterEntry[]
  };

  // Ticking Time state. Lazy-initialized so the seed timestamp is read once
  // (in render, not during module init) and stays stable across the initial
  // server/client render — avoids a hydration mismatch and the React 19
  // "impure function during render" warning. Same pattern as the garden page.
  const [nowTime, setNowTime] = useState(() => Date.now());
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
  const profileSeeds = Array.isArray(profile?.seeds) ? profile.seeds : [];

  // Per-mode master list + owned records.
  const masterList: MasterEntry[] =
    mode === "plants" ? (shopCatalog?.plants ?? [])
    : mode === "eggs" ? (shopCatalog?.eggs ?? [])
    : mode === "chests" ? (shopCatalog?.chests ?? [])
    : mode === "animals" ? (speciesCatalog?.pets ?? [])
    : (speciesCatalog?.seeds ?? []);

  const ownedRecords: any[] =
    mode === "plants" ? profilePlants
    : mode === "eggs" ? profileEggs
    : mode === "chests" ? profileChests
    : mode === "animals" ? profileAnimals
    : profileSeeds;

  // Build a name → owned-record map so a discovered master entry can pick up
  // its count / active flag / id for actions. Match key is `name` — animal &
  // egg ids are timestamps, not stable catalog ids.
  const ownedByName = new Map<string, any>();
  for (const rec of ownedRecords) {
    if (rec && typeof rec.name === "string") ownedByName.set(rec.name, rec);
  }

  const discoveredCount = masterList.filter((entry) => ownedByName.has(entry.name)).length;
  const totalCount = masterList.length;

  const filtered = filter === "all" ? masterList : masterList.filter((entry) => entry.rarity === filter);

  // Per-category discovered/total for the hero. Falls back to 0/0 while the
  // catalogs are still loading.
  const stats = {
    plants: { found: (shopCatalog?.plants ?? []).filter((p) => profilePlants.some((o: any) => o.name === p.name)).length, total: shopCatalog?.plants.length ?? 0 },
    eggs: { found: (shopCatalog?.eggs ?? []).filter((p) => profileEggs.some((o: any) => o.name === p.name)).length, total: shopCatalog?.eggs.length ?? 0 },
    animals: { found: (speciesCatalog?.pets ?? []).filter((p) => profileAnimals.some((o: any) => o.name === p.name)).length, total: speciesCatalog?.pets.length ?? 0 },
    seeds: { found: (speciesCatalog?.seeds ?? []).filter((p) => profileSeeds.some((o: any) => o.name === p.name)).length, total: speciesCatalog?.seeds.length ?? 0 },
    chests: { found: (shopCatalog?.chests ?? []).filter((p) => profileChests.some((o: any) => o.name === p.name)).length, total: shopCatalog?.chests.length ?? 0 }
  };

  const tabs: ("all" | Rarity)[] = ["all", "common", "rare", "epic", "legendary"];

  // Countdown timer effect
  useEffect(() => {
    const hatchings = Array.isArray(profile?.hatchings) ? profile.hatchings : [];
    if (hatchings.length === 0) return;
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [profile]);

  const incubateEgg = async (egg: any) => {
    if (!user?.uid || !profile) return;

    if (profileHatchings.length >= 3) {
      toast.error("All incubator slots are full! Hatch an egg to free up a slot.");
      return;
    }

    // Placement (egg spend + slot claim) is owned by the server so a client
    // can't duplicate eggs or exceed the 3-slot cap.
    const res = await fetch("/api/eggs/incubate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "incubate", eggId: egg.id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      toast.error(data?.error?.message || "Could not place egg in incubator. Please try again.");
      return;
    }

    await refreshProfile();
    toast.success(`${egg.name} is now incubating in the Hatching Chamber!`);
  };

  const warmEgg = async (hatching: any) => {
    if (!user?.uid || !profile) return;

    if (ecoPoints < 10) {
      toast.error("Need 10 EcoPoints to warm the egg!");
      return;
    }

    setWarmingId(hatching.id);
    setTimeout(() => setWarmingId(null), 500);

    const res = await fetch("/api/eggs/incubate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "warm", hatchingId: hatching.id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      toast.error(data?.error?.message || "Failed to warm egg. Please try again.");
      return;
    }

    await refreshProfile();
    toast.success("Warmed the egg! 15 minutes shaved off hatching time.");
  };

  const hatchInstantly = async (hatching: any) => {
    if (!user?.uid || !profile) return;

    const remainingTime = Math.max(0, hatching.endTime - nowTime);
    const cost = Math.max(10, Math.ceil(remainingTime / (3 * 60 * 1000))); // 1 EP per 3 minutes remaining, min 10

    if (ecoPoints < cost) {
      toast.error(`Need ${cost} EcoPoints to hatch instantly!`);
      return;
    }

    if (!confirm(`Hatch this egg instantly for ${cost} EcoPoints?`)) return;

    const res = await fetch("/api/eggs/incubate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "instant", hatchingId: hatching.id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      toast.error(data?.error?.message || "Instant hatching failed. Please try again.");
      return;
    }

    await refreshProfile();
    toast.success("Egg incubated! Ready to hatch.");
  };

  // The hatching reveal is purely cosmetic — the actual hatch (timing check,
  // animal roll, pet mint, Impact grant) already happened on the server the
  // moment the user committed to hatching. The rolled animal is held in a ref
  // and only surfaced after the 5-tap reveal animation finishes, so the client
  // can't forge or preview the pet.
  const pendingAnimalRef = useRef<any>(null);

  const startHatchingReveal = async (hatching: any) => {
    const res = await fetch("/api/eggs/incubate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "hatch", hatchingId: hatching.id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      toast.error(data?.error?.message || "This egg is not ready to hatch yet.");
      await refreshProfile();
      return;
    }

    pendingAnimalRef.current = data.animal;
    setActiveHatching(hatching);
    setTapsLeft(5);
    setRevealedAnimal(null);
    setParticles([]);
  };

  const handleEggTap = (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
    if (tapsLeft <= 0 || !activeHatching) return;

    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 150);

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
      // Reveal the animal the server already rolled and minted.
      setRevealedAnimal(pendingAnimalRef.current);

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

    // The pet was already minted server-side when the reveal started. Just
    // sync local state, dismiss, and surface the toast.
    pendingAnimalRef.current = null;
    await refreshProfile();

    toast.success(`${revealedAnimal.name} was added to your collection book!`);
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

    // Roll + consume the chest on the server immediately, so the reward can't be
    // forged from the client. The reveal just surfaces what the server rolled.
    const resultPromise = fetch("/api/chests/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chestId: chest.id })
    }).then((r) => r.json().then((data) => ({ ok: r.ok, data })));

    setTimeout(async () => {
      clearInterval(shakeInterval);
      const { ok, data } = await resultPromise;
      if (!ok || !data?.success) {
        setChestState("closed");
        setActiveChest(null);
        toast.error(data?.error?.message || "Failed to open chest. Please try again.");
        return;
      }
      setChestReward(data.reward);
      setChestState("opened");
      await refreshProfile();

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

  // The chest and its reward were already consumed/granted server-side on open.
  // This just dismisses the reveal and surfaces a toast.
  const claimChestReward = async () => {
    if (!chestReward) return;

    if (chestReward.type === "points") {
      toast.success(`Claimed ${chestReward.amount} EcoPoints!`);
    } else if (chestReward.type === "seed") {
      toast.success(`Got a ${chestReward.seedName}! 🌱 Plant it in your Garden.`);
    } else {
      toast.success(`Got a ${chestReward.name}! Check your eggs.`);
    }

    setActiveChest(null);
    setChestReward(null);
    setChestState("closed");

    if (chestReward.type === "egg") {
      setMode("eggs");
    }
  };

  const selectActivePet = async (animal: any) => {
    if (!user?.uid || !profile) return;
    setSelectingPetId(String(animal.id));
    // Server owns the switch under a row lock — toggles only the `active` flag on
    // the canonical pet rows (stats untouched). See /api/pets/select.
    const res = await fetch("/api/pets/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ petId: String(animal.id) })
    });
    const data = await res.json().catch(() => ({}));
    setSelectingPetId(null);
    if (!res.ok || !data?.success) {
      toast.error(data?.error?.message || "Could not choose that companion. Please try again.");
      return;
    }
    if (typeof setProfile === "function" && profile) {
      setProfile({ ...profile, animals: data.animals, activePet: data.activePet });
    }
    toast.success(`${animal.name} is now your active companion.`);
  };

  const catalogLoading = !shopCatalog || !speciesCatalog;

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
        <PageHero eyebrow="Your nature collection" title="My Collection" description="Discover every species. Locked entries reveal as you earn them." accent={heroAccents.collection}>
          <div className="flex flex-wrap gap-3">
            <HeroMetric label="Plants" value={`${stats.plants.found}/${stats.plants.total}`} />
            <HeroMetric label="Eggs" value={`${stats.eggs.found}/${stats.eggs.total}`} />
            <HeroMetric label="Pets" value={`${stats.animals.found}/${stats.animals.total}`} />
            <HeroMetric label="Seeds" value={`${stats.seeds.found}/${stats.seeds.total}`} />
            <HeroMetric label="Chests" value={`${stats.chests.found}/${stats.chests.total}`} />
            <HeroMetric label="EcoPoints" value={ecoPoints} />
          </div>
        </PageHero>
      </StaggerItem>

      <StaggerItem as="div">
        <Panel>
          <div className="flex flex-col gap-4">
            {/* Mode tabs */}
            <PillTabBar<CollMode>
              value={mode}
              options={["plants", "eggs", "animals", "seeds", "chests"] as const}
              onChange={(v) => { setMode(v); setFilter("all"); }}
            />
            {/* Rarity filter */}
            <PillFilterBar<"all" | Rarity>
              value={filter}
              options={tabs}
              onChange={setFilter}
            />
          </div>
        </Panel>
      </StaggerItem>

      <StaggerItem as="div">
        <TabPanel activeKey={`${mode}-${filter}`}>
          {/* ── Active Hatching Pods (Incubator Chamber) ── */}
          {mode === "eggs" && (
        <Panel title="🥚 Hatching Chamber" eyebrow="Active Incubators (Max 3 Slots)">
          {profileHatchings.length === 0 ? (
            <EmptyState
              variant="plain"
              icon="💤"
              title="No eggs are currently incubating."
              description="Place an egg from your collection below into the chamber."
            />
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
                      isWarming ? "animate-egg-shake animate-heat-pulse border-[var(--text-error)]" : ""
                    }`}
                    style={{ borderColor: isReady ? "var(--text-accent)" : border, background: "var(--bg-card)" }}
                  >
                    <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${style.chip}`}>
                      {hatching.rarity}
                    </span>

                    <div className="flex items-center gap-4">
                      {/* Incubator glass pod design */}
                      <div
                        className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl shadow-sm overflow-hidden p-1.5 ${
                          !isReady ? "animate-pulse" : ""
                        }`}
                        style={{
                          background: "var(--bg-panel)",
                          border: `1px solid ${isReady ? "var(--text-accent)" : "var(--border-subtle)"}`,
                          boxShadow: isReady
                            ? "0 0 15px color-mix(in srgb, var(--text-accent) 20%, transparent)"
                            : `0 0 12px color-mix(in srgb, ${style.accent} 12%, transparent)`
                        }}
                      >
                        <Image
                          src={`/images/eggs/${hatching.rarity}-egg.png`}
                          alt={hatching.name}
                          fill
                          sizes="80px"
                          className={`object-contain ${!isReady ? "animate-bounce" : "animate-egg-shake"}`}
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
                            <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                              <div
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progressPct}%`, background: style.accent }}
                              />
                            </div>
                          </>
                        ) : (
                          <p className="mt-1 text-xs font-extrabold uppercase tracking-wide animate-pulse" style={{ color: "var(--text-accent)" }}>
                            ✨ Ready to hatch!
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      {!isReady ? (
                        <>
                          <button
                            type="button"
                            onClick={() => warmEgg(hatching)}
                            title="Warms the egg — costs 10 EcoPoints"
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-rose-300/60 bg-rose-500/10 py-2 text-[10px] font-black uppercase tracking-wider text-rose-600 transition hover:bg-rose-500/20"
                          >
                            🔥 Warm (10 EP)
                          </button>
                          <button
                            type="button"
                            onClick={() => hatchInstantly(hatching)}
                            title={`Hatch instantly — costs ${instantCost} EcoPoints`}
                            className={`flex-1 ${primaryButton}`}
                          >
                            ⚡ Hatch ({instantCost} EP)
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startHatchingReveal(hatching)}
                          className={`w-full ${primaryButton} animate-bounce`}
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

      {/* Per-tab discovered progress line */}
      {!catalogLoading && (
        <div className="px-1 text-sm font-extrabold" style={{ color: "var(--text-muted)" }}>
          Discovered {discoveredCount}/{totalCount} {mode}
        </div>
      )}

      {catalogLoading ? (
        <CardGridSkeleton count={10} cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" />
      ) : filtered.length === 0 ? (
        <Panel>
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
            <Image src="/images/plants/sunflower.png" alt="No matching species illustration" width={80} height={80} className="object-contain opacity-60" />
            <div>
              <p className="font-serif text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>Nothing matches that filter</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Try a different rarity, or the “all” filter.</p>
            </div>
          </div>
        </Panel>
      ) : (
        <StaggerContainer className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" as="div" staggerDelay={0.04}>
          {filtered.map((entry) => {
            const owned = ownedByName.get(entry.name);
            const discovered = !!owned;
            const style = rarityStyle[entry.rarity] ?? rarityStyle.common;
            const border = discovered ? (rarityBorder[entry.rarity] ?? rarityBorder.common) : "var(--border-default)";
            const count = Number(owned?.count ?? 1);
            const isActive = !!owned?.active;
            return (
              <StaggerItem
                key={`${mode}-${entry.id}-${entry.name}`}
                as="article"
                className="group relative flex flex-col overflow-hidden rounded-[20px] border transition hover:-translate-y-1"
                style={{
                  borderColor: border,
                  background: "var(--bg-card)",
                  borderStyle: discovered ? "solid" : "dashed"
                }}
                title={discovered ? undefined : "Complete quests to unlock"}
              >
                {discovered && isActive && <span className="absolute left-2 top-2 z-10"><Pill active>Active</Pill></span>}
                {!discovered && <span className="absolute left-2 top-2 z-10 text-base">🔒</span>}

                {/* Framed card image design - full bleed aspect ratio */}
                <div
                  className="relative flex aspect-square items-center justify-center overflow-hidden"
                  style={{
                    background: discovered ? `color-mix(in srgb, ${style.accent} 7%, var(--bg-card))` : "linear-gradient(160deg, var(--bg-panel-alt), color-mix(in srgb, var(--text-accent) 8%, var(--bg-panel-alt)))"
                  }}
                >
                  <CardImage entry={entry} discovered={discovered} mode={mode} />
                  {/* Hover affordance for locked cards — tells the user this is
                      discoverable content, not a broken/empty tile. */}
                  {!discovered && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-full px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" style={{ background: "color-mix(in srgb, var(--text-primary) 70%, transparent)", color: "var(--text-inverse)" }}>
                      Complete quests to unlock
                    </div>
                  )}
                  {discovered && <span className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${style.chip}`}>{entry.rarity}</span>}
                  {discovered && count > 1 && <span className="absolute bottom-2 right-2 z-10"><Pill active>×{count}</Pill></span>}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="font-serif text-sm font-extrabold leading-tight truncate" style={{ color: "var(--text-primary)" }}>
                    {discovered ? entry.name : "???"}
                  </p>
                  {discovered && mode === "eggs" && (
                    <button
                      type="button"
                      onClick={() => incubateEgg(owned)}
                      disabled={count <= 0}
                      className={`mt-auto w-full ${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      Incubate
                    </button>
                  )}
                  {discovered && mode === "chests" && (
                    <button
                      type="button"
                      onClick={() => openChest(owned)}
                      disabled={count <= 0}
                      className={`mt-auto w-full ${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      Open Chest
                    </button>
                  )}
                  {discovered && mode === "animals" && (
                    <button
                      type="button"
                      onClick={() => selectActivePet(owned)}
                      disabled={isActive || selectingPetId === String(owned.id)}
                      className={`mt-auto w-full ${isActive ? secondaryButton : primaryButton}`}
                    >
                      {isActive ? "Active Pet" : selectingPetId === String(owned.id) ? "Choosing..." : "Choose Pet"}
                    </button>
                  )}
                  {/* plants + seeds: display-only, no action button */}
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      )}
    </TabPanel>
  </StaggerItem>

      {/* ── Interactive Hatching Modal ── */}
      {activeHatching && (
        <div role="dialog" aria-modal="true" aria-label="Hatching reveal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md fade-in">
          <div className="relative w-full max-w-md rounded-[32px] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center text-[var(--text-primary)] shadow-2xl animate-modal-in">

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
                  <h3 className="font-serif text-2xl font-black text-[var(--text-primary)]">Incubator Chamber</h3>
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">Tap the egg to break the shell!</p>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Tap egg to crack the shell"
                  onClick={handleEggTap}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleEggTap(e);
                    }
                  }}
                  className="relative flex h-60 w-60 cursor-pointer items-center justify-center rounded-full bg-[var(--bg-panel-alt)] shadow-inner transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-accent)] focus-visible:ring-offset-2"
                  style={{ ["--tw-ring-offset-color" as string]: "var(--bg-card)" }}
                >
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--text-primary)_8%,transparent),transparent_65%)] animate-pulse" />

                  <div className={`relative h-44 w-44 transition ${isShaking ? "animate-egg-shake" : ""}`}>
                    <Image
                      src={`/images/eggs/${activeHatching.rarity}-egg.png`}
                      alt={activeHatching.name}
                      fill
                      sizes="176px"
                      className="object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.4)]"
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

                  <div className="absolute bottom-4 rounded-full bg-[var(--bg-sidebar)] px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--text-sidebar)]">
                    Taps Left: {tapsLeft}
                  </div>
                </div>

                <div className="w-full max-w-[240px]">
                  <div className="h-2 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--text-accent)] transition-all duration-300"
                      style={{ width: `${((5 - tapsLeft) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 py-6 animate-bounce-in">
                <div>
                  <span className="rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-widest bg-[var(--toast-success-bg)] text-[var(--toast-success-fg)]">
                    Hatched Successfully!
                  </span>
                  <h3 className="mt-4 font-serif text-3xl font-black text-[var(--text-primary)]">Meet {revealedAnimal.name}!</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">A rare eco companion was added to your collection.</p>
                </div>

                <div
                  className="relative flex h-52 w-52 items-center justify-center rounded-[28px] border border-[var(--border-subtle)] bg-[var(--bg-panel-alt)] shadow-2xl p-6 overflow-hidden"
                  style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}
                >
                  <div
                    className="absolute inset-0 bg-gradient-to-tr to-transparent pointer-events-none"
                    style={{ background: "linear-gradient(to top right, color-mix(in srgb, var(--text-accent) 10%, transparent), transparent)" }}
                  />
                  <CardImage entry={revealedAnimal} discovered mode="animals" fit="contain" />
                </div>

                <div className="flex flex-col items-center">
                  <span className={`rounded-full px-3.5 py-1 text-[10px] font-black uppercase tracking-widest ${rarityStyle[revealedAnimal.rarity as Rarity]?.chip}`}>
                    {revealedAnimal.rarity}
                  </span>
                  <p className="mt-3 text-xs leading-relaxed max-w-[280px] text-[var(--text-muted)]">
                    {revealedAnimal.name} is a {revealedAnimal.rarity} companion that will accompany you on your sustainable missions!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={claimAnimal}
                  className={`w-full max-w-[280px] ${primaryButton}`}
                >
                  Claim Pet & Continue
                </button>
              </div>
            )}

            {tapsLeft > 0 && (
              <button
                type="button"
                onClick={() => setActiveHatching(null)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-panel-alt)] text-[var(--text-muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
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
        <div role="dialog" aria-modal="true" aria-label="Chest opening" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md fade-in">
          <div className="relative w-full max-w-md rounded-[32px] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center text-[var(--text-primary)] shadow-2xl animate-modal-in">

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
                  <h3 className="font-serif text-2xl font-black text-yellow-500">Opening Chest...</h3>
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">Brace yourself for mysterious rewards!</p>
                </div>

                <div
                  className="relative flex h-60 w-60 items-center justify-center rounded-full bg-[var(--bg-panel-alt)] shadow-inner animate-pulse"
                >
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.1),transparent_65%)]" />

                  <div className={`relative h-44 w-44 transition ${chestState === "shaking" ? "animate-chest-shake animate-chest-glow" : ""}`}>
                    <Image
                      src={`/images/chests/${activeChest.name.toLowerCase().replace(" ", "-")}.png`}
                      alt={activeChest.name}
                      fill
                      sizes="176px"
                      className="object-contain drop-shadow-[0_18px_36px_rgba(0,0,0,0.45)]"
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
                  <span className="rounded-full bg-yellow-500/20 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-yellow-500">
                    Chest Opened!
                  </span>
                  <h3 className="mt-4 font-serif text-3xl font-black text-[var(--text-primary)]">
                    {chestReward.type === "points"
                      ? `+${chestReward.amount} EcoPoints!`
                      : chestReward.type === "seed"
                      ? `${chestReward.seedName}!`
                      : `Unlocked ${chestReward.name}!`}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {chestReward.type === "seed"
                      ? "Head to your Garden and plant it — it grows over 7 days! 🌱"
                      : "Your reward has been added to your profile."}
                  </p>
                </div>

                <div
                  className="relative flex h-52 w-52 items-center justify-center rounded-[28px] border border-[var(--border-subtle)] bg-[var(--bg-panel-alt)] shadow-2xl p-6 overflow-hidden"
                  style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/10 to-transparent pointer-events-none" />
                  {chestReward.type === "points" ? (
                    <div className="text-6xl select-none drop-shadow-md">🪙</div>
                  ) : (
                    <Image
                      src={chestReward.image}
                      alt={chestReward.name}
                      width={128}
                      height={128}
                      className="object-contain"
                    />
                  )}
                </div>

                <div className="flex flex-col items-center">
                  <span className={`rounded-full px-3.5 py-1 text-[10px] font-black uppercase tracking-widest ${rarityStyle[chestReward.rarity as Rarity]?.chip}`}>
                    {chestReward.rarity}
                  </span>
                  <p className="mt-3 text-xs leading-relaxed max-w-[280px] text-[var(--text-muted)]">
                    {chestReward.type === "points"
                      ? "Spend these EcoPoints in the Plant Shop to buy more eggs and chests!"
                      : chestReward.type === "seed"
                      ? `A ${chestReward.rarity} seed. Plant it in your Virtual Garden and wait ~7 days for it to bloom into rewards.`
                      : `${chestReward.name} is a ${chestReward.rarity} item that has been added to your inventory.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={claimChestReward}
                  className={`w-full max-w-[280px] ${primaryButton}`}
                >
                  Claim & Continue
                </button>
              </div>
            )}

            {chestState === "closed" && (
              <button
                type="button"
                onClick={() => setActiveChest(null)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-panel-alt)] text-[var(--text-muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                aria-label="Close modal"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

    </StaggerContainer>
  );
}