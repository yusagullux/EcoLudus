// Time-based pet vitality drift. Pure module — no DB, no React — so it can be
// imported by both the client pets page (cosmetic, real-time display) and the
// server care/quest/hatch routes (authoritative, re-anchors `vitalsAt`).
//
// Design intent: pets are living companions, not static stat blocks.
//   - happiness DECAYS over time (a neglected pet slides toward "Needs care")
//   - energy   REGENERATES over time (rest recovers from missions; fixes the
//     "stuck at 0 energy, quest bonus locked out unless you pay" problem)
//   - bond     is long-term and does NOT decay
//
// The stored vitals + `vitalsAt` timestamp form an anchor: between interactions
// the displayed value is `computeVitals(pet, now)`, deterministic from the anchor.
// When a route authoritatively writes vitals it MUST (a) drift first, (b) apply
// the action delta, (c) set `vitalsAt = now` — keeping the anchor consistent so
// client and server never diverge.

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

// Happiness lost per full day since the pet was last cared for / interacted with.
export const HAPPINESS_DECAY_PER_DAY = 8;
// Energy recovered per full hour since the pet was last interacted with.
export const ENERGY_REGEN_PER_HOUR = 5;
// Cap decay days so a neglected pet bottoms out around 20 happiness, not 0
// forever — keeps recovery realistic without a punishing floor.
export const MAX_DECAY_DAYS = 10;

export interface PetVitals {
  happiness: number;
  energy: number;
  bond: number;
  daysMissed: number;
  hoursRested: number;
}

export interface PetMood {
  label: string;
  emoji: string;
  multiplier: number; // Reward multiplier (e.g. 1.2 for ecstatic)
}

export function getMood(vitals: PetVitals): PetMood {
  const { happiness, energy } = vitals;

  if (happiness < 30) {
    return { label: "Sad", emoji: "😢", multiplier: 0.8 };
  }
  if (energy < 20) {
    return { label: "Exhausted", emoji: "💤", multiplier: 0.9 };
  }
  if (happiness > 80 && energy > 50) {
    return { label: "Ecstatic", emoji: "🌟", multiplier: 1.2 };
  }
  if (happiness > 60) {
    return { label: "Happy", emoji: "😊", multiplier: 1.0 };
  }
  return { label: "Neutral", emoji: "😐", multiplier: 1.0 };
}

export function getBondTier(bond: number) {
  if (bond >= 80) return { label: "Soulmate", emoji: "💖" };
  if (bond >= 40) return { label: "Companion", emoji: "🤝" };
  return { label: "Acquaintance", emoji: "🐣" };
}

function clampStat(value: unknown, fallback: number): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
}

function parseAnchor(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

// Returns the drifted vitals for a pet as of `now` (ms epoch). If the pet has no
// `vitalsAt` (legacy pets from before this feature, or freshly hatched before
// the hatch route sets it), drift is 0 — stored values are returned as-is so
// existing pets are never suddenly drained on first load.
export function computeVitals(
  pet: Record<string, unknown> | null | undefined,
  now: number = Date.now()
): PetVitals {
  const baseHappiness = clampStat(pet?.happiness, 50);
  const baseEnergy = clampStat(pet?.energy, 50);
  const baseBond = clampStat(pet?.bond, 10);

  const anchor = parseAnchor(pet?.vitalsAt);
  if (anchor === null) {
    return { happiness: baseHappiness, energy: baseEnergy, bond: baseBond, daysMissed: 0, hoursRested: 0 };
  }

  const elapsedMs = Math.max(0, now - anchor);
  const daysMissed = Math.min(MAX_DECAY_DAYS, Math.floor(elapsedMs / DAY_MS));
  const hoursRested = Math.floor(elapsedMs / HOUR_MS);

  return {
    happiness: clampStat(baseHappiness - daysMissed * HAPPINESS_DECAY_PER_DAY, 0),
    energy: clampStat(baseEnergy + hoursRested * ENERGY_REGEN_PER_HOUR, 0),
    bond: baseBond,
    daysMissed,
    hoursRested
  };
}