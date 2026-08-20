"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import { computeVitals, getBondTier, getMood } from "@/lib/pet-vitals";
import { HeroMetric, PageHero, Panel, Pill, ProgressBar, primaryButton, secondaryButton, rarityStyle, rarityBorder, heroAccents, type Rarity } from "@/components/game-ui";
import { PET_EMOJI } from "@/lib/ui-shared";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerContainer, StaggerItem } from "@/lib/animations";

function getPetImage(pet: any) {
  if (pet?.image) return pet.image;
  return `/images/pets/${String(pet?.name || "cat").toLowerCase()}.png`;
}

// Pet card image. `fit="cover"` (default) fills the frame like the shop/collection
// tiles for a uniform grid; `fit="contain"` letterboxes the whole creature and is
// used for the showcase portrait where cropping the art would look wrong.
function PetImage({
  pet,
  fit = "cover",
  sizes = "(max-width: 640px) 45vw, 240px"
}: { pet: any; fit?: "cover" | "contain"; sizes?: string }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="flex h-full w-full items-center justify-center text-5xl select-none drop-shadow-sm transition duration-300 group-hover:scale-110">
        {PET_EMOJI[String(pet?.name || "")] || "🐾"}
      </div>
    );
  }

  const fitClass = "object-contain p-3 drop-shadow-[0_18px_28px_rgba(0,0,0,0.18)]";

  return (
    <Image
      src={getPetImage(pet)}
      alt={pet?.name || "pet"}
      fill
      sizes={sizes}
      onError={() => setImgError(true)}
      className={`${fitClass} transition duration-300 group-hover:scale-110`}
    />
  );
}

const CARE_ACTIONS = [
  { id: "snack", label: "Feed Snack", stat: "energy", amount: 18, cost: 8, xp: 8, eco: 0 },
  { id: "train", label: "Eco Trick", stat: "bond", amount: 12, cost: 0, xp: 18, eco: 4 },
  { id: "play", label: "Nature Play", stat: "happiness", amount: 14, cost: 4, xp: 12, eco: 2 }
];

// Maximum number of eco-rewarding care actions allowed per pet per day.
// Actions that grant eco > 0 count toward this cap; free non-eco actions (snack) do not.
const MAX_ECO_ACTIONS_PER_DAY = 5;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getPetMood(happiness: number, energy: number, bond: number) {
  const score = Math.round((happiness + energy + bond) / 3);
  if (score >= 85) return "Radiant";
  if (score >= 65) return "Adventurous";
  if (score >= 45) return "Content";
  return "Needs care";
}

function getBondLevel(bond: number) {
  return Math.max(1, Math.min(10, Math.floor(bond / 10) + 1));
}

// Apply time-based vitality drift (happiness decay / energy regen) to the
// displayed stats. Cosmetic & non-authoritative — the care/quest routes
// re-derive and re-anchor `vitalsAt` on interaction — but it keeps the page
// feeling alive: a neglected pet visibly slides toward "Needs care" before
// you act. See lib/pet-vitals.ts; the shared formula means display and server
// never diverge between interactions.
function normalizePet(pet: any) {
  const drifted = computeVitals(pet, Date.now());
  return {
    ...pet,
    happiness: drifted.happiness,
    energy: drifted.energy,
    bond: drifted.bond,
    careStreak: Math.max(0, Number(pet.careStreak ?? 0)),
    careActionsToday: Math.max(0, Number(pet.careActionsToday ?? 0))
  };
}

export default function PetsPage() {
  const { user, profile, setProfile, refreshProfile } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hearts, setHearts] = useState<Array<{ id: number; dx: string; dy: string }>>([]);
  const toast = useToast();
  // Prevents concurrent care-action submissions (double-click / button spam).
  const isProcessing = useRef(false);

  const pets = useMemo(() => Array.isArray(profile?.animals) ? profile.animals.map(normalizePet) : [], [profile]);

  const selectedPet = useMemo(() => {
    const activePetId = profile?.activePet || pets.find((pet) => pet.active)?.id || pets[0]?.id || null;
    return pets.find((pet) => pet.id === (selectedId || activePetId)) || pets[0] || null;
  }, [pets, selectedId, profile?.activePet]);

  const activePetId = profile?.activePet || pets.find((pet) => pet.active)?.id || pets[0]?.id || null;

  const selectActivePet = async (pet: any) => {
    if (!user?.uid || !profile) return;
    // Server owns the switch: /api/pets/select locks the row and toggles only the
    // `active` flag on the canonical pet rows — it never writes the client-drifted
    // happiness/energy/bond back as canonical stats (the old updateUserProfile
    // path did). We just ask and reflect the result.
    const res = await fetch("/api/pets/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ petId: pet.id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      toast.error(data?.error?.message || "Could not choose that companion.");
      return;
    }
    setSelectedId(pet.id);
    if (typeof setProfile === "function" && profile) {
      setProfile({ ...profile, animals: data.animals, activePet: data.activePet });
    }
    toast.success(`${pet.name} is traveling with you now.`);
  };

  // Heart-burst animation (purely visual — fires regardless of server outcome).
  function emitHearts() {
    const burst = Array.from({ length: 10 }).map((_, index) => ({
      id: Date.now() + index,
      dx: `${Math.round((Math.random() - 0.5) * 160)}px`,
      dy: `${Math.round(-80 - Math.random() * 110)}px`
    }));
    setHearts((current) => [...current, ...burst]);
    setTimeout(() => setHearts((current) => current.filter((h) => !burst.some((b) => b.id === h.id))), 1100);
  }

  // Free "pet" interaction — no eco cost, no eco reward. Just +2 XP and a
  // happiness bump. The reward is granted server-side by /api/pets/care so it
  // can't be forged; the client only asks and reflects the result.
  const petTheAnimal = async () => {
    if (!user?.uid || !profile || !selectedPet) return;
    if (isProcessing.current) return;
    isProcessing.current = true;
    try {
      emitHearts();
      const res = await fetch("/api/pets/care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petId: selectedPet.id, action: "pet" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error?.message || "Pet action did not save.");
        return;
      }
      if (typeof setProfile === "function" && profile) {
        setProfile({
          ...profile,
          xp: data.xp ?? Number(profile.xp ?? 0) + 2,
          level: data.level ?? Number(profile.level ?? 1),
          animals: (profile.animals as any[]).map((pet) =>
            pet.id === selectedPet.id
              ? { ...pet, happiness: Math.min(100, Number(pet.happiness ?? 50) + 2) }
              : pet
          )
        });
      }
      await refreshProfile();
    } finally {
      isProcessing.current = false;
    }
  };

  const runCareAction = async (action: any) => {
    if (!user?.uid || !profile || !selectedPet) return;
    // Hard re-entrancy guard — prevents spamming before the async round-trip finishes.
    if (isProcessing.current) return;
    isProcessing.current = true;

    try {
      emitHearts();
      const res = await fetch("/api/pets/care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petId: selectedPet.id, action: action.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error?.message || "Care action did not save. Please try again.");
        return;
      }
      if (typeof setProfile === "function" && profile) {
        setProfile({
          ...profile,
          xp: data.xp ?? Number(profile.xp ?? 0) + action.xp,
          level: data.level ?? Number(profile.level ?? 1),
          ecoPoints: data.ecoPoints ?? Number(profile.ecoPoints ?? 0) - action.cost + (data.ecoGained ?? 0)
        });
      }
      await refreshProfile();
      const ecoGained = Number(data.ecoGained ?? 0);
      toast.success(`${action.label}: +${action.xp} XP${ecoGained ? `, +${ecoGained} Eco` : ""}.`);
    } finally {
      isProcessing.current = false;
    }
  };

  const totalPets = pets.reduce((sum, pet) => sum + Number(pet.count ?? 1), 0);
  const avgHappiness = pets.length
    ? Math.round(pets.reduce((sum, pet) => sum + Number(pet.happiness ?? 50), 0) / pets.length)
    : 0;
  const selectedHappiness = Number(selectedPet?.happiness ?? 50);
  const selectedEnergy = Number(selectedPet?.energy ?? 50);
  const selectedBond = Number(selectedPet?.bond ?? 10);
  const selectedPetsGiven = Number(selectedPet?.petsGiven ?? 0);
  const selectedMood = getPetMood(selectedHappiness, selectedEnergy, selectedBond);
  // `selectedPet` is already drifted by `normalizePet`, so build the PetVitals
  // shape from the derived stats directly — re-running computeVitals would
  // apply a second round of decay/regen from the same anchor (double drift).
  const vitalsMood = getMood({
    happiness: selectedHappiness,
    energy: selectedEnergy,
    bond: selectedBond,
    daysMissed: 0,
    hoursRested: 0
  });
  const bondTier = getBondTier(selectedBond);
  const selectedBondLevel = getBondLevel(selectedBond);
  const careActionsToday = Number(selectedPet?.careActionsToday ?? 0);
  // Whether the daily eco reward cap has been reached for the active pet.
  const isNewCareDay = String(selectedPet?.lastCareDate ?? "") !== todayKey();
  const ecoActionsToday = isNewCareDay ? 0 : careActionsToday;
  const ecoCapReached = ecoActionsToday >= MAX_ECO_ACTIONS_PER_DAY;

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
      <PageHero eyebrow="Companion care" title="Pets" description="Train, feed, and bond with companions to earn small daily rewards and make them stronger travel partners." accent={heroAccents.pets}>
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Pets" value={totalPets} />
          <HeroMetric label="Happy" value={`${avgHappiness}%`} hint="Average happiness across all your companions." />
          <HeroMetric
            label="Bond"
            value={selectedPet ? `Lv ${selectedBondLevel}` : "-"}
            hint="Bond level grows as you train, feed, and spend time with a companion. Higher bond makes them stronger travel partners."
          />
        </div>
      </PageHero>
      </StaggerItem>

      <StaggerItem as="div">
      {!selectedPet ? (
        <Panel>
          <EmptyState
            variant="card"
            icon="🥚"
            title="No companions yet"
            description="Hatch eggs from your collection to unlock pets, then train and feed them to grow your bond."
            action={<Link href="/collection" className={primaryButton}>Browse your eggs</Link>}
          />
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel eyebrow="Active companion" title={selectedPet.name} action={
            <div className="flex gap-2">
              <Pill active>{selectedPet.rarity || "common"}</Pill>
              <Pill>{vitalsMood.emoji} {vitalsMood.label}</Pill>
            </div>
          }>
            <div className="flex flex-col items-center gap-4 text-center">
              <button
                type="button"
                onClick={petTheAnimal}
                aria-label={`Pet ${selectedPet.name}`}
                className="relative flex aspect-square w-full max-w-[360px] items-center justify-center overflow-hidden rounded-[28px] border transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  borderColor: rarityBorder[selectedPet.rarity as Rarity] ?? "var(--border-default)",
                  background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${rarityStyle[selectedPet.rarity as Rarity]?.accent ?? "var(--text-accent)"} 13%, transparent), transparent 58%), var(--bg-panel-alt)`
                }}
              >
                <PetImage pet={selectedPet} fit="contain" sizes="(max-width: 1024px) 90vw, 360px" />
                {hearts.map((heart) => (
                  <span
                    key={heart.id}
                    className="pointer-events-none absolute left-1/2 top-1/2 text-3xl animate-heart-pop"
                    style={{ color: "var(--text-error)", "--dx": heart.dx, "--dy": heart.dy } as any}
                  >
                    &hearts;
                  </span>
                ))}
              </button>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                Tap portrait to pet · free · +2 XP
              </p>

              <div className="flex w-full max-w-[360px] flex-col gap-2.5">
                {[
                  { label: "Happiness", value: selectedHappiness, color: rarityStyle[selectedPet.rarity as Rarity]?.accent ?? "var(--text-accent)" },
                  { label: "Energy", value: selectedEnergy, color: "var(--text-accent)" },
                  { label: "Bond", value: selectedBond, color: "var(--text-warning)" }
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="mb-2 flex items-center justify-between text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                      <span>{stat.label}</span>
                      <span>{stat.value}%</span>
                    </div>
                    <ProgressBar value={stat.value} color={stat.color} />
                  </div>
                ))}
              </div>

              <div className="grid w-full max-w-[360px] gap-3 sm:grid-cols-3">
                {CARE_ACTIONS.map((action) => {
                  // `train` is server-rejected when energy < 10 — disable it
                  // upfront so the user isn't told via a toast after clicking.
                  const exhausted = action.id === "train" && selectedEnergy < 10;
                  const blocked = (action.eco > 0 && ecoCapReached) || exhausted;
                  const blockTitle = exhausted
                    ? "Too exhausted to train — rest to recover energy first"
                    : `Daily eco limit reached (${MAX_ECO_ACTIONS_PER_DAY}/day)`;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => runCareAction(action)}
                      disabled={blocked}
                      className={`${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={blocked ? blockTitle : undefined}
                    >
                      {action.label}
                      <span className="ml-1 opacity-70" title={action.cost ? "EcoPoints" : "Experience points"}>
                        {action.cost ? `${action.cost} EP` : `+${action.xp} XP`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {ecoCapReached && (
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  Daily eco reward limit reached ({MAX_ECO_ACTIONS_PER_DAY}/{MAX_ECO_ACTIONS_PER_DAY}). Resets tomorrow.
                </p>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => selectActivePet(selectedPet)} disabled={selectedPet.active || activePetId === selectedPet.id} className={`${secondaryButton} disabled:opacity-60 disabled:cursor-not-allowed`}>
                  {selectedPet.active || activePetId === selectedPet.id ? "Active Pet" : "Make Active"}
                </button>
              </div>

              <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                {ecoActionsToday}/{MAX_ECO_ACTIONS_PER_DAY} eco actions today. Lifetime care: {selectedPetsGiven.toLocaleString()}.
              </p>
            </div>
          </Panel>

          <Panel eyebrow="Companion stats" title="Care Notes">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{bondTier.emoji}</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Bond Status</p>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{bondTier.label}</p>
                  </div>
                </div>
                <Pill active>{selectedBond}%</Pill>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Mood</p>
                <p className="mt-1 font-serif text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {selectedMood}
                </p>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Bond Level</p>
                <p className="mt-1 font-serif text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  Level {selectedBondLevel}
                </p>
                <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  Care streak {Number(selectedPet.careStreak ?? 0)} day{Number(selectedPet.careStreak ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Last petted</p>
                <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {selectedPet.lastPettedAt ? new Date(selectedPet.lastPettedAt).toLocaleString() : "Not yet"}
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}
      </StaggerItem>

      <StaggerItem as="section">
      <Panel eyebrow="Inventory" title="Choose a Pet">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {pets.map((pet) => {
            const isSelected = selectedPet?.id === pet.id;
            const isActive = pet.active || activePetId === pet.id;
            const style = rarityStyle[pet.rarity as Rarity] ?? rarityStyle.common;
            const accent = style.accent;
            const border = isSelected ? accent : (rarityBorder[pet.rarity as Rarity] ?? rarityBorder.common);
            return (
              <button
                key={pet.id}
                type="button"
                onClick={() => setSelectedId(pet.id)}
                className="reveal-card group overflow-hidden rounded-[20px] border text-left transition duration-300 hover:-translate-y-1"
                style={{
                  borderColor: border,
                  background: "var(--bg-card)",
                  ...(isSelected ? { boxShadow: `0 10px 28px color-mix(in srgb, ${accent} 20%, transparent)` } : {})
                }}
              >
                <span className="relative block aspect-square overflow-hidden" style={{ background: `color-mix(in srgb, ${accent} 12%, var(--bg-card))` }}>
                  <PetImage pet={pet} fit="contain" />
                  {isActive && <span className="absolute left-2 top-2 z-10"><Pill active>Active</Pill></span>}
                  <span className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${style.chip}`}>{pet.rarity}</span>
                </span>
                <span className="block p-3">
                  <span className="block truncate font-serif text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{pet.name}</span>
                  <span className="mt-2 block">
                    <ProgressBar value={Number(pet.happiness ?? 50)} color={accent} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
      </StaggerItem>

    </StaggerContainer>
  );
}
