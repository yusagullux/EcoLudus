// Display-only constants shared across game pages. Pure data — no React — so
// they can be imported by both server and client components without a
// "use client" boundary. Kept here (rather than re-declared per page) so a
// single edit updates every consumer and the values can't drift apart.

// ── Verification verdict presentation ──────────────────────────
// Used by the habits result modal (and any future AI-verification surface).
// `dashboard` used to declare a copy of this but never read it — that dead
// copy was removed when this module became the single source.
export type VerdictKey = "APPROVED" | "PARTIAL" | "REJECTED" | "FLAGGED";

export const VERDICT_STYLES: Record<
  VerdictKey,
  { bg: string; text: string; border: string; icon: string; label: string }
> = {
  APPROVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "✓", label: "Approved" },
  PARTIAL:  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   icon: "◐", label: "Partial Credit" },
  REJECTED: { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    icon: "✗", label: "Rejected" },
  FLAGGED:  { bg: "bg-red-50",     text: "text-red-800",     border: "border-red-300",     icon: "⚑", label: "Flagged" }
};

// ── Pet emoji fallback ─────────────────────────────────────────
// Shown when a pet's image asset is missing so the card never renders a
// broken-image icon. Mirrored between the pets page and the collection
// Pokédex; kept here so a new pet species only needs one edit.
export const PET_EMOJI: Record<string, string> = {
  Cat: "🐱", Dog: "🐶", Rabbit: "🐰", Bee: "🐝", Mouse: "🐭", Worm: "🪱",
  Deer: "🦌", Owl: "🦉", Panda: "🐼", Cobra: "🐍", Jaguar: "🐆", Wolf: "🐺",
  Bear: "🐻", Eagle: "🦅", Lynx: "🐱", Shark: "🦈", Whale: "🐋", Tiger: "🐯",
  Lion: "🦁", Phoenix: "🔥", Dragon: "🐉", Kraken: "🐙", Octapus: "🐙"
};

// ── Plant name → asset path ───────────────────────────────────
// Resolves a planted seed/plant name to its photo. Shared by the garden page
// and the public-profile collection book so the two surfaces agree on art.
export const PLANT_IMAGES: Record<string, string> = {
  "Mossy Fern": "/images/plants/mint.png",
  "Golden Daisy": "/images/plants/sunflower.png",
  "Blue Orchid": "/images/plants/orchid.png",
  "Spotted Aloe": "/images/plants/basil.png",
  "Mystic Bamboo": "/images/plants/bamboo.png",
  "Crystal Lotus": "/images/plants/lotus.png",
  "Aurora Blossom": "/images/plants/cherry_blossom.png",
  "Ember Cactus": "/images/plants/dragonfruit.png"
};

// Shared progress helper used by bars/rows that compute "done out of total"
// as a 0–100 integer. Guards against divide-by-zero and NaN so callers can
// pass raw tallies without normalizing first.
export function pct(done: number, total: number): number {
  if (!total || !Number.isFinite(total)) return 0;
  return Math.round((done / total) * 100);
}