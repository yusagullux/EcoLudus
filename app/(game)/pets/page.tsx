"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Egg } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import { computeVitals, getBondTier, getMood } from "@/lib/pet-vitals";
import { PageHeader, Panel, Pill, ProgressBar, primaryButton, secondaryButton, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";
import { PET_EMOJI } from "@/lib/ui-shared";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerContainer, StaggerItem } from "@/lib/animations";

function getPetImage(pet: any) {
  if (pet?.image) return pet.image;
  return `/images/pets/${String(pet?.name || "cat").toLowerCase()}.png`;
}

// Pet card image. `fit="cover"` (default) fills the frame like the shop/collection
// tiles for a uniform grid; `fit="contain"` letterboxes the whole creature and is
// used for the habitat portrait where cropping the art would look wrong.
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

  const fitClass = fit === "cover"
    ? "object-cover transition duration-300 group-hover:scale-110"
    : "object-contain p-3 drop-shadow-[0_18px_28px_rgba(0,0,0,0.18)] transition duration-300 group-hover:scale-110";

  return (
    <Image
      src={getPetImage(pet)}
      alt={pet?.name || "pet"}
      fill
      sizes={sizes}
      onError={() => setImgError(true)}
      className={fitClass}
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

function getBondLevel(bond: number) {
  return Math.max(1, Math.min(10, Math.floor(bond / 10) + 1));
}

// Mood → habitat accent. Keys match `getMood()` labels so the backdrop tint is
// driven straight from the drifted vitals, not hand-derived values.
const MOOD_ACCENT: Record<string, string> = {
  Ecstatic: "var(--accent-gold)",
  Happy: "var(--accent-green)",
  Neutral: "var(--accent-sage)",
  Exhausted: "var(--accent-slate)",
  Sad: "var(--accent-violet)"
};

// ── RingGauge (local) ──────────────────────────────────────────
// Small SVG ring for the three vitals (Happiness/Energy/Bond): track = border
// subtlety, sweep = a theme accent, center = font-serif percentage. Same
// strokeDashoffset tween the kit's LevelProgressRing uses, honoring reduced
// motion. Chosen instead of progress bars: three 56–64px rings sit in one row
// even at 390px and read as "vitals at a glance", without a third wall of bars
// on this page (the picker already uses bars).
function RingGauge({
  label,
  value,
  color,
  size = 60
}: {
  label: string;
  value: number;
  color: string;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const targetOffset = circumference * (1 - clamped / 100);

  return (
    <div
      className="inline-flex flex-col items-center"
      role="img"
      aria-label={`${label} ${clamped}%`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            style={{ stroke: "var(--border-subtle)" }}
          />
          {reduced ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{
                stroke: color,
                strokeDasharray: circumference,
                strokeDashoffset: targetOffset
              }}
            />
          ) : (
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ stroke: color, strokeDasharray: circumference }}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: targetOffset }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-serif font-bold leading-none text-ink"
          style={{ fontSize: Math.max(12, Math.round(size * 0.26)) }}
        >
          {clamped}%
        </span>
      </div>
      <span className="mt-1 text-center text-micro text-ink-muted">{label}</span>
    </div>
  );
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
  // Reflected copy of `isProcessing` so the UI can show disabled/loading states
  // while a care request is in flight (the ref stays the hard re-entrancy guard).
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
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
      setBusy(false);
    }
  };

  const runCareAction = async (action: any) => {
    if (!user?.uid || !profile || !selectedPet) return;
    // Hard re-entrancy guard — prevents spamming before the async round-trip finishes.
    if (isProcessing.current) return;
    isProcessing.current = true;
    setBusy(true);

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
      setBusy(false);
    }
  };

  const totalPets = pets.reduce((sum, pet) => sum + Number(pet.count ?? 1), 0);
  const selectedHappiness = Number(selectedPet?.happiness ?? 50);
  const selectedEnergy = Number(selectedPet?.energy ?? 50);
  const selectedBond = Number(selectedPet?.bond ?? 10);
  const selectedPetsGiven = Number(selectedPet?.petsGiven ?? 0);
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

  // Habitat backdrop tint — straight from the (already-drifted) vitals mood.
  const moodAccent = MOOD_ACCENT[vitalsMood.label] ?? "var(--text-accent)";
  // Rarity chip styling shared with the picker cards below.
  const selectedRarityStyle =
    rarityStyle[(selectedPet?.rarity as Rarity) ?? "common"] ?? rarityStyle.common;
  // Mix a theme var into the panel color — the one sanctioned tint recipe.
  const wash = (color: string, pct: number) =>
    `color-mix(in srgb, ${color} ${pct}%, var(--bg-panel))`;
  const tint = (color: string, pct: number) =>
    `color-mix(in srgb, ${color} ${pct}%, transparent)`;

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
        <PageHeader
          title="Your companions"
          description="Train, feed, and bond with pets to earn small daily rewards and make them stronger travel partners."
          action={selectedPet ? (
            <Pill>{totalPets} companion{totalPets === 1 ? "" : "s"} raised</Pill>
          ) : undefined}
        />
      </StaggerItem>

      <StaggerItem as="div">
      {!selectedPet ? (
        <Panel>
          <EmptyState
            variant="card"
            icon={<Egg className="h-8 w-8" strokeWidth={2} aria-hidden="true" />}
            title="No companions yet"
            description="Hatch eggs from your collection to unlock pets, then train and feed them to grow your bond."
            action={<Link href="/collection" className={primaryButton}>Browse your eggs</Link>}
          />
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          {/* ── Habitat scene ──────────────────────────────────── */}
          <section className="rounded-card shadow-elev-1 border border-line p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight text-accent">Active companion</p>
                <h2 className="mt-0.5 truncate font-serif text-lg font-bold leading-tight text-ink">
                  {selectedPet.name}
                </h2>
              </div>
              <div className="flex gap-2">
                <span className={`rounded-full px-2 py-0.5 text-micro ${selectedRarityStyle.chip}`}>
                  {selectedPet.rarity || "common"}
                </span>
                <Pill>{vitalsMood.emoji} {vitalsMood.label}</Pill>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-center gap-4 text-center">
              {/* Tap-to-pet habitat: mood-tinted sky + ground glow over the
                  panel-alt base, rarity ring as the frame. Kept heart-burst
                  particle animation and its --dx/--dy CSS vars untouched. */}
              <button
                type="button"
                onClick={petTheAnimal}
                disabled={busy}
                aria-busy={busy}
                aria-label={`Pet ${selectedPet.name}`}
                className="relative flex aspect-[5/4] w-full max-w-[380px] items-center justify-center overflow-hidden rounded-dialog border-2 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 disabled:hover:scale-[1]"
                style={{
                  borderColor: rarityBorder[selectedPet.rarity as Rarity] ?? "var(--border-default)",
                  background: `radial-gradient(circle at 50% 30%, ${tint(moodAccent, 16)}, transparent 62%), radial-gradient(85% 45% at 50% 108%, ${tint(moodAccent, 10)}, transparent 70%), var(--bg-panel-alt)`
                }}
              >
                <PetImage pet={selectedPet} fit="contain" sizes="(max-width: 640px) 85vw, 320px" />
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
              <p className="text-micro text-ink-muted">
                Tap portrait to pet · free · +2 XP
              </p>

              {/* Vitals as three small ring gauges (Happiness/Energy/Bond). */}
              <div className="flex w-full max-w-[380px] items-start justify-between gap-2 sm:justify-center sm:gap-6">
                <RingGauge label="Happiness" value={selectedHappiness} color="var(--accent-green)" />
                <RingGauge label="Energy" value={selectedEnergy} color="var(--accent-blue)" />
                <RingGauge label="Bond" value={selectedBond} color="var(--accent-gold)" />
              </div>

              <div className="grid w-full max-w-[420px] gap-3 sm:grid-cols-3">
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
                      disabled={busy || blocked}
                      aria-busy={busy}
                      className={`${primaryButton} w-full disabled:opacity-50 disabled:cursor-not-allowed`}
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
                <p className="text-xs font-semibold text-ink-muted">
                  Daily eco reward limit reached ({MAX_ECO_ACTIONS_PER_DAY}/{MAX_ECO_ACTIONS_PER_DAY}). Resets tomorrow.
                </p>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => selectActivePet(selectedPet)} disabled={selectedPet.active || activePetId === selectedPet.id} className={`${secondaryButton} disabled:opacity-60 disabled:cursor-not-allowed`}>
                  {selectedPet.active || activePetId === selectedPet.id ? "Active Pet" : "Make Active"}
                </button>
              </div>
            </div>
          </section>

          {/* ── Care notes ─────────────────────────────────────── */}
          <Panel eyebrow="Companion" title="Care notes">
            <div className="flex flex-col gap-4">
              {/* Bond tier — the hero row of the card. */}
              <div
                className="flex items-center justify-between rounded-card border border-line-soft p-4"
                style={{
                  background: bondTier.label === "Soulmate" ? wash("var(--accent-gold)", 12) : wash("var(--accent-sage)", 10)
                }}
              >
                <div>
                  <p className="text-micro text-ink-muted">Bond tier</p>
                  <p className="text-sm font-bold text-ink">{bondTier.label}</p>
                </div>
                <Pill active>{selectedBond}%</Pill>
              </div>

              {/* One expressive line: the mood as the headline, with bond level
                  and care streak as supporting facts (no uniform sub-card wall). */}
              <div className="rounded-card border border-line bg-surface-alt p-4">
                <p className="text-micro text-ink-muted">Mood</p>
                <p className="mt-1 font-serif text-2xl font-bold text-ink">
                  {vitalsMood.label}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-ink-muted">
                  <span>Bond level {selectedBondLevel}</span>
                  <span
                    aria-hidden="true"
                    className="h-1 w-1 rounded-full"
                    style={{ background: "var(--border-default)" }}
                  />
                  <span>
                    Care streak {Number(selectedPet.careStreak ?? 0)} day{Number(selectedPet.careStreak ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* Footer meta — the quiet facts, one small sentence pair. */}
              <div className="border-t border-line-soft pt-3">
                <p className="text-xs font-semibold text-ink">
                  {selectedPet.lastPettedAt
                    ? `Last petted ${new Date(selectedPet.lastPettedAt).toLocaleString()}`
                    : "Not petted yet"}
                </p>
                <p className="mt-0.5 text-micro text-ink-muted">
                  {ecoActionsToday} of {MAX_ECO_ACTIONS_PER_DAY} eco actions today. Lifetime care: {selectedPetsGiven.toLocaleString()}.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}
      </StaggerItem>

      {pets.length > 0 && (
        <StaggerItem as="section">
          <Panel eyebrow="Your menagerie" title="Choose a pet">
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
                    className="reveal-card group t-card-hover overflow-hidden rounded-card border bg-card text-left active:scale-[0.98]"
                    style={{
                      borderColor: border,
                      ...(isSelected ? { boxShadow: `0 10px 28px color-mix(in srgb, ${accent} 20%, transparent)` } : {})
                    }}
                  >
                    <span className="relative block aspect-square overflow-hidden" style={{ background: `color-mix(in srgb, ${accent} 12%, var(--bg-card))` }}>
                      <PetImage pet={pet} fit="cover" />
                      {isActive && <span className="absolute left-2 top-2 z-10"><Pill active>Active</Pill></span>}
                      <span className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-micro ${style.chip}`}>{pet.rarity}</span>
                    </span>
                    <span className="block p-3">
                      <span className="block truncate font-serif text-sm font-extrabold text-ink">{pet.name}</span>
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
      )}

    </StaggerContainer>
  );
}