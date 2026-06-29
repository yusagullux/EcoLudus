// @ts-nocheck
"use client";

import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { updateUserProfile } from "@/public/js/auth.js";
import { HeroMetric, PageHero, Panel, Pill, ProgressBar, primaryButton, secondaryButton, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";
import { calculateLevel } from "@/lib/level-system";

function getPetImage(pet: any) {
  if (pet?.image) return pet.image;
  return `/images/pets/${String(pet?.name || "cat").toLowerCase()}.png`;
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

function normalizePet(pet: any) {
  return {
    ...pet,
    happiness: Math.min(100, Math.max(0, Number(pet.happiness ?? 50))),
    energy: Math.min(100, Math.max(0, Number(pet.energy ?? 50))),
    bond: Math.min(100, Math.max(0, Number(pet.bond ?? 10))),
    careStreak: Math.max(0, Number(pet.careStreak ?? 0)),
    careActionsToday: Math.max(0, Number(pet.careActionsToday ?? 0))
  };
}

export default function PetsPage() {
  const { user, profile, setProfile } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hearts, setHearts] = useState<Array<{ id: number; dx: string; dy: string }>>([]);
  const [toast, setToast] = useState("");
  // Prevents concurrent care-action submissions (double-click / button spam).
  const isProcessing = useRef(false);
  const pets = Array.isArray(profile?.animals) ? profile.animals.map(normalizePet) : [];
  const activePetId = profile?.activePet || pets.find((pet) => pet.active)?.id || pets[0]?.id || null;

  const selectedPet = useMemo(() => {
    return pets.find((pet) => pet.id === (selectedId || activePetId)) || pets[0] || null;
  }, [pets, selectedId, activePetId]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const selectActivePet = async (pet: any) => {
    if (!user?.uid || !profile) return;
    const nextPets = pets.map((entry) => ({ ...entry, active: entry.id === pet.id }));
    const updates = { animals: nextPets, activePet: pet.id };
    const result = await updateUserProfile(user.uid, updates);
    if (!result.success) {
      showToast("Could not choose that companion.");
      return;
    }
    setSelectedId(pet.id);
    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...updates });
    }
    showToast(`${pet.name} is traveling with you now.`);
  };

  // Free "pet" interaction — no eco cost, no eco reward. Just +2 XP and happiness bump.
  // This is what the portrait tap triggers so it's never silently spending EcoPoints.
  const petTheAnimal = async () => {
    if (!user?.uid || !profile || !selectedPet) return;
    if (isProcessing.current) return;
    isProcessing.current = true;
    try {
      const today = todayKey();
      const lastCareDate = String(selectedPet.lastCareDate ?? "");
      const isNewCareDay = lastCareDate !== today;
      const nextPets = pets.map((pet) => {
        if (pet.id !== selectedPet.id) return pet;
        return {
          ...pet,
          happiness: Math.min(100, Number(pet.happiness ?? 50) + 2),
          petsGiven: Number(pet.petsGiven ?? 0) + 1,
          lastPettedAt: new Date().toISOString(),
          careActionsToday: isNewCareDay ? 1 : Number(pet.careActionsToday ?? 0) + 1,
          careStreak: isNewCareDay ? Number(pet.careStreak ?? 0) + 1 : Number(pet.careStreak ?? 0),
          lastCareDate: today
        };
      });
      const nextXp = Number(profile.xp ?? 0) + 2;
      const updates = { animals: nextPets, xp: nextXp, level: calculateLevel(nextXp) };
      const burst = Array.from({ length: 10 }).map((_, index) => ({
        id: Date.now() + index,
        dx: `${Math.round((Math.random() - 0.5) * 160)}px`,
        dy: `${Math.round(-80 - Math.random() * 110)}px`
      }));
      setHearts((current) => [...current, ...burst]);
      setTimeout(() => setHearts((current) => current.filter((h) => !burst.some((b) => b.id === h.id))), 1100);
      const result = await updateUserProfile(user.uid, updates);
      if (!result.success) { showToast("Pet action did not save."); return; }
      if (typeof setProfile === "function") setProfile({ ...profile, ...updates });
    } finally {
      isProcessing.current = false;
    }
  };
    if (!user?.uid || !profile || !selectedPet) return;
    // Hard re-entrancy guard — prevents spamming before the async round-trip finishes.
    if (isProcessing.current) return;
    isProcessing.current = true;

    try {
      if (Number(profile.ecoPoints ?? 0) < action.cost) {
        showToast(`Need ${action.cost} EcoPoints for ${action.label}.`);
        return;
      }

      const today = todayKey();
      const lastCareDate = String(selectedPet.lastCareDate ?? "");
      const isNewCareDay = lastCareDate !== today;
      const careActionsToday = isNewCareDay ? 0 : Number(selectedPet.careActionsToday ?? 0);

      // Cap eco-rewarding actions to prevent infinite eco farming.
      if (action.eco > 0 && careActionsToday >= MAX_ECO_ACTIONS_PER_DAY) {
        showToast(`Daily eco reward limit reached for ${selectedPet.name}. Come back tomorrow!`);
        return;
      }

      const nextPets = pets.map((pet) => {
        if (pet.id !== selectedPet.id) return pet;
        const currentValue = Number(pet[action.stat] ?? 50);
        return {
          ...pet,
          [action.stat]: Math.min(100, currentValue + action.amount),
          happiness: Math.min(100, Number(pet.happiness ?? 50) + (action.stat === "happiness" ? 0 : 4)),
          petsGiven: Number(pet.petsGiven ?? 0) + 1,
          careActionsToday: careActionsToday + 1,
          careStreak: isNewCareDay ? Number(pet.careStreak ?? 0) + 1 : Number(pet.careStreak ?? 0),
          lastCareDate: today,
          lastPettedAt: new Date().toISOString()
        };
      });

      // Only grant eco points if under the daily cap.
      const ecoGained = action.eco > 0 && careActionsToday < MAX_ECO_ACTIONS_PER_DAY ? action.eco : 0;
      const nextXp = Number(profile.xp ?? 0) + action.xp;
      const nextEcoPoints = Number(profile.ecoPoints ?? 0) - action.cost + ecoGained;
      const updates = {
        animals: nextPets,
        xp: nextXp,
        level: calculateLevel(nextXp),
        ecoPoints: nextEcoPoints
      };

      const burst = Array.from({ length: 10 }).map((_, index) => ({
        id: Date.now() + index,
        dx: `${Math.round((Math.random() - 0.5) * 160)}px`,
        dy: `${Math.round(-80 - Math.random() * 110)}px`
      }));
      setHearts((current) => [...current, ...burst]);
      setTimeout(() => {
        setHearts((current) => current.filter((heart) => !burst.some((item) => item.id === heart.id)));
      }, 1100);

      const result = await updateUserProfile(user.uid, updates);
      if (!result.success) {
        showToast("Care action did not save. Please try again.");
        return;
      }
      if (typeof setProfile === "function") {
        setProfile({ ...profile, ...updates });
      }
      showToast(`${action.label}: +${action.xp} XP${ecoGained ? `, +${ecoGained} Eco` : ""}.`);
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
  const selectedBondLevel = getBondLevel(selectedBond);
  const careActionsToday = Number(selectedPet?.careActionsToday ?? 0);
  // Whether the daily eco reward cap has been reached for the active pet.
  const isNewCareDay = String(selectedPet?.lastCareDate ?? "") !== todayKey();
  const ecoActionsToday = isNewCareDay ? 0 : careActionsToday;
  const ecoCapReached = ecoActionsToday >= MAX_ECO_ACTIONS_PER_DAY;

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Companion care" title="Pets" description="Train, feed, and bond with companions to earn small daily rewards and make them stronger travel partners.">
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Pets" value={totalPets} />
          <HeroMetric label="Happy" value={`${avgHappiness}%`} />
          <HeroMetric label="Bond" value={selectedPet ? `Lv ${selectedBondLevel}` : "-"} />
        </div>
      </PageHero>

      {!selectedPet ? (
        <Panel>
          <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
            <p className="font-serif text-xl font-bold" style={{ color: "var(--text-primary)" }}>No companions yet</p>
            <p className="mt-1 text-sm">Hatch eggs from your collection to unlock pets.</p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel eyebrow="Active companion" title={selectedPet.name} action={<Pill active>{selectedPet.rarity || "common"}</Pill>}>
            <div className="flex flex-col items-center gap-5 text-center">
              <button
                type="button"
                onClick={petTheAnimal}
                aria-label={`Pet ${selectedPet.name}`}
                className="relative flex aspect-square w-full max-w-[360px] items-center justify-center overflow-hidden rounded-[28px] border transition active:scale-[0.98]"
                style={{
                  borderColor: rarityBorder[selectedPet.rarity as Rarity] ?? "var(--border-default)",
                  background: `radial-gradient(circle at 50% 35%, ${(rarityStyle[selectedPet.rarity as Rarity]?.accent ?? "#2f6b46")}22, transparent 58%), var(--bg-panel-alt)`
                }}
              >
                <img src={getPetImage(selectedPet)} alt={selectedPet.name} className="h-full w-full object-contain p-8 drop-shadow-[0_18px_28px_rgba(0,0,0,0.18)]" />
                {hearts.map((heart) => (
                  <span
                    key={heart.id}
                    className="pointer-events-none absolute left-1/2 top-1/2 text-3xl text-rose-500 animate-heart-pop"
                    style={{ "--dx": heart.dx, "--dy": heart.dy } as any}
                  >
                    &hearts;
                  </span>
                ))}
              </button>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                Tap portrait to pet · free · +2 XP
              </p>

              <div className="w-full max-w-md">
                {[
                  { label: "Happiness", value: selectedHappiness, color: rarityStyle[selectedPet.rarity as Rarity]?.accent ?? "#2f6b46" },
                  { label: "Energy", value: selectedEnergy, color: "#2f5f86" },
                  { label: "Bond", value: selectedBond, color: "#9a6b1f" }
                ].map((stat) => (
                  <div key={stat.label} className="mb-3">
                    <div className="mb-2 flex items-center justify-between text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                      <span>{stat.label}</span>
                      <span>{stat.value}%</span>
                    </div>
                    <ProgressBar value={stat.value} color={stat.color} />
                  </div>
                ))}
              </div>

              <div className="grid w-full max-w-xl gap-3 sm:grid-cols-3">
                {CARE_ACTIONS.map((action) => {
                  const blocked = action.eco > 0 && ecoCapReached;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => runCareAction(action)}
                      disabled={blocked}
                      className={primaryButton}
                      title={blocked ? `Daily eco limit reached (${MAX_ECO_ACTIONS_PER_DAY}/day)` : undefined}
                    >
                      {action.label}
                      <span className="ml-1 opacity-70">{action.cost ? `${action.cost} EP` : `+${action.xp} XP`}</span>
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
                <button type="button" onClick={() => selectActivePet(selectedPet)} disabled={selectedPet.active || activePetId === selectedPet.id} className={secondaryButton}>
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

      <Panel eyebrow="Inventory" title="Choose a Pet">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {pets.map((pet) => {
            const isSelected = selectedPet?.id === pet.id;
            const isActive = pet.active || activePetId === pet.id;
            return (
              <button
                key={pet.id}
                type="button"
                onClick={() => setSelectedId(pet.id)}
                className="group overflow-hidden rounded-[20px] border text-left transition hover:-translate-y-1"
                style={{
                  borderColor: isSelected ? rarityStyle[pet.rarity as Rarity]?.accent ?? "var(--border-default)" : rarityBorder[pet.rarity as Rarity] ?? "var(--border-default)",
                  background: "var(--bg-card)"
                }}
              >
                <span className="relative block aspect-square overflow-hidden" style={{ background: `${rarityStyle[pet.rarity as Rarity]?.accent ?? "#2f6b46"}12` }}>
                  <img src={getPetImage(pet)} alt={pet.name} className="h-full w-full object-contain p-5 transition group-hover:scale-110" />
                  {isActive && <span className="absolute left-2 top-2 rounded-full bg-[#fbf4df] px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#76511a]">Active</span>}
                </span>
                <span className="block p-3">
                  <span className="block truncate font-serif text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{pet.name}</span>
                  <span className="mt-2 block">
                    <ProgressBar value={Number(pet.happiness ?? 50)} color={rarityStyle[pet.rarity as Rarity]?.accent ?? "#2f6b46"} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl" style={{ background: "var(--bg-sidebar)", color: "var(--text-sidebar)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
