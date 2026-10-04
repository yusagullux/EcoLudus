"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Camera, Check, Flame, Leaf, Plus, ShieldCheck } from "lucide-react";
import { AnimatedNumber, AnimatedProgressBar } from "@/lib/animations";
import { getXPProgress } from "@/lib/level-system";

// "Friendly game card" design language (docs/superpowers/specs/2026-10-01-game-app-redesign.md):
// generous radius (the --radius-card token, tuned to 1.25rem), soft shadows,
// ≥44px touch targets, color exclusively through the `[data-theme]` vars
// (tints via color-mix).
const CARD = "rounded-card";

// Tint helper — mix any theme var into the current panel color.
const wash = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, var(--bg-panel))`;

const springPop = { type: "spring" as const, stiffness: 480, damping: 24 };

// ── Shared rarity styles ──────────────────────────────────────
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
// Tokenized rarity system — colors live in the theme blocks of globals.css
// (`--rarity-<r>` fill, `-text` ink, `-border` edge), so every consumer below
// resolves per theme instead of hardcoding light-scheme hexes.
export const rarityStyle: Record<Rarity, { chip: string; accent: string }> = {
  common: {
    chip: "rarity-common-chip",
    accent: "var(--rarity-common)"
  },
  uncommon: {
    chip: "rarity-uncommon-chip",
    accent: "var(--rarity-uncommon)"
  },
  rare: {
    chip: "rarity-rare-chip",
    accent: "var(--rarity-rare)"
  },
  epic: {
    chip: "rarity-epic-chip",
    accent: "var(--rarity-epic)"
  },
  legendary: {
    chip: "rarity-legendary-chip",
    accent: "var(--rarity-legendary)"
  }
};
export const rarityBorder: Record<Rarity, string> = {
  common: "var(--rarity-common-border)",
  uncommon: "var(--rarity-uncommon-border)",
  rare: "var(--rarity-rare-border)",
  epic: "var(--rarity-epic-border)",
  legendary: "var(--rarity-legendary-border)"
};

// ── PageHero ──────────────────────────────────────────────────
// Soft-tinted page band: a flat ~6% accent wash over the panel color, no
// gradient sweep (the boxed 12% diagonal hero is retired). The eyebrow is a
// plain accent sentence-case line — all-caps micro eyebrows are retired with
// the dashboard look.
type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
};

export function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <section
      className={`relative overflow-hidden border border-line px-5 py-6 shadow-elev-1 sm:px-8 sm:py-8 ${CARD}`}
      style={{
        background: wash("var(--text-accent)", 6)
      }}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold leading-snug text-accent">{eyebrow}</p>
          <h1 className="mt-1.5 text-balance font-serif text-2xl font-bold leading-tight text-ink sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">{description}</p>
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </section>
  );
}

// ── PageHeader ────────────────────────────────────────────────
// The light successor to the boxed hero: title + description + optional action,
// NO panel by default. `tint` opts into the same soft 6% accent wash band
// (rounded like every card). Use this on pages whose content immediately
// follows — the panel look stays for pages that need a heavier announcement.
type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  tint?: boolean;
};

export function PageHeader({ title, description, action, tint = false }: PageHeaderProps) {
  return (
    <section
      className={tint ? `border border-line-soft px-5 py-5 sm:px-6 sm:py-6 ${CARD}` : ""}
      style={tint ? { background: wash("var(--text-accent)", 6) } : undefined}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance font-serif text-2xl font-bold leading-tight text-ink sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </section>
  );
}

// ── HeroMetric ────────────────────────────────────────────────
export function HeroMetric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  const numericValue = typeof value === "number" ? value : null;
  return (
    <div
      className="relative min-w-[70px] rounded-input border border-line bg-surface-alt px-3 py-2.5 text-center"
      title={hint}
    >
      <div className="flex items-center justify-center gap-1 text-micro text-ink-muted">
        {label}
        {hint && (
          <span
            className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-line text-micro text-ink-soft"
            aria-label="More info"
            role="img"
          >
            i
          </span>
        )}
      </div>
      <div className="mt-1 font-serif text-xl font-bold leading-none text-ink">
        {numericValue !== null ? <AnimatedNumber value={numericValue} /> : value}
      </div>
    </div>
  );
}

// ── MetricCard ────────────────────────────────────────────────
// Optional `icon` slot: a small rounded tile tinted with the card's accent,
// replacing the plain accent tick when present. Optional `hint` renders a
// one-line explainer under the value. Both are additive — every existing call
// site (label/value/accent/wide) keeps rendering exactly as before.
type MetricCardProps = {
  label: string;
  value: ReactNode;
  accent?: string;
  wide?: boolean;
  icon?: ReactNode;
  hint?: string;
};

export function MetricCard({ label, value, accent = "var(--text-accent)", wide = false, icon, hint }: MetricCardProps) {
  const numericValue = typeof value === "number" ? value : null;
  return (
    <article className={`t-panel p-4 shadow-elev-1 ${CARD} ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-start gap-3">
        {icon && (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
            style={{ background: wash(accent, 12), color: accent }}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {!icon && <span className="h-[3px] w-6 rounded-full" style={{ background: accent }} />}
            <p className="text-xs font-bold leading-tight text-ink-muted">{label}</p>
          </div>
          <p className="mt-1.5 font-serif text-2xl font-bold leading-none text-ink">
            {numericValue !== null ? <AnimatedNumber value={numericValue} /> : value}
          </p>
          {hint && <p className="mt-1.5 text-xs leading-snug text-ink-muted">{hint}</p>}
        </div>
      </div>
    </article>
  );
}

// ── StatGrid ───────────────────────────────────────────────────
// A declarative grid of MetricCards. Pages used to hand-write the grid wrapper
// and inline each <MetricCard>; pulling both into one component means the
// responsive column layout is named in one place and the page just declares
// the data. `className` controls only the grid tracks/spacing so each page
// can pick its own breakpoint (sm:grid-cols-4, lg:grid-cols-4, …).
type StatGridItem = { label: string; value: ReactNode; accent?: string };
export function StatGrid({
  items,
  className = "grid-cols-2 gap-3 lg:grid-cols-4"
}: {
  items: StatGridItem[];
  className?: string;
}) {
  return (
    <div className={`grid ${className}`}>
      {items.map((it) => (
        <MetricCard key={it.label} label={it.label} value={it.value} accent={it.accent} />
      ))}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────
// Friendly paper card: 1.25rem radius + soft grounding shadow. Eyebrow is a
// plain accent line (sentence case), not an all-caps micro label.
type PanelProps = {
  eyebrow?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function Panel({ eyebrow, title, action, children, className = "", id }: PanelProps) {
  return (
    <section id={id} className={`t-panel shadow-elev-1 ${CARD} ${className}`}>
      {(eyebrow || title || action) && (
        <div className="flex flex-col gap-1.5 border-b border-line-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            {eyebrow && <p className="text-xs font-bold leading-tight text-accent">{eyebrow}</p>}
            {title && (
              <h2 className={`font-serif text-lg font-bold leading-tight text-ink ${eyebrow ? "mt-0.5" : ""}`}>
                {title}
              </h2>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

// ── ProgressBar ───────────────────────────────────────────────
// `className` merges onto the track so flex-item usages can size it (the track
// defaults to w-full — as a bare flex child it otherwise collapses to 0px).
export function ProgressBar({ value, color = "var(--text-accent)", className = "" }: { value: number; color?: string; className?: string }) {
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full ${className}`}
      style={{
        background: "var(--border-subtle)",
        // Subtle inset edge so an empty (0%) bar is still visible — without it
        // the track and the panel behind it are too close in value and the bar
        // effectively disappears at 0%.
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--border-default) 70%, transparent)"
      }}
    >
      <AnimatedProgressBar value={value} color={color} />
    </div>
  );
}

// ── Pill ──────────────────────────────────────────────────────
// `size` scales the chip: "sm" is the original micro chip, "md" a roomier
// badge (e.g. level chips, counters that sit beside 14px+ text).
export function Pill({
  children,
  active = false,
  size = "sm",
  className,
  style
}: {
  children: ReactNode;
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
  style?: CSSProperties;
}) {
  const sizeCls = size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-micro";
  return (
    <span
      className={`inline-flex items-center rounded-full ${sizeCls} ${className ?? ""}`}
      style={{
        ...(active
          ? { background: "var(--pill-active-bg)", color: "var(--pill-active-text)" }
          : {
              background: "var(--pill-bg)",
              border: "1px solid var(--pill-border)",
              color: "var(--pill-text)"
            }),
        ...style
      }}
    >
      {children}
    </span>
  );
}

// ── PillFilterBar ─────────────────────────────────────────────
// (PillTabBar moved to components/ui/pill-tab-bar.tsx — animated.)
// Horizontal chip selectors shared by the Shop and Collection pages, which
// used to inline these bars byte-for-byte. The segmented "mode" switch now
// lives in `components/ui/pill-tab-bar.tsx` (animated sliding pill, shared
// styling with `SegmentedControl`); PillFilterBar is the rarity filter row
// (scrolls on mobile, wraps from sm: up). It scrolls horizontally without a
// scrollbar on narrow viewports so the chips never force page-level overflow.
export function PillFilterBar<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className="shrink-0 min-h-11 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition"
          style={
            value === opt
              ? { background: "var(--pill-active-bg)", color: "var(--pill-active-text)" }
              : { background: "var(--pill-bg)", border: "1px solid var(--pill-border)", color: "var(--pill-text)" }
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── RankMedallion ─────────────────────────────────────────────
// Circular rank roundel — medal-tinted disc for the top 3 (gold / silver /
// bronze from theme accent tokens), quiet number chip beyond. Hoisted from the
// team / friends / leaderboard pages, which carried identical copies.
export const MEDAL_TONES = [
  { fill: "var(--accent-gold)", ink: "var(--accent-gold-text)" },
  { fill: "var(--accent-slate)", ink: "var(--accent-slate-text)" },
  { fill: "var(--accent-orange)", ink: "var(--accent-orange-text)" }
] as const;

// `size` is px (default 36 = the list-row size); "podium" is the 44px seat
// used by leaderboard podium cards, "row" is an alias for the default.
export function RankMedallion({ rank, size = 36 }: { rank: number; size?: number | "row" | "podium" }) {
  const px = size === "row" ? 36 : size === "podium" ? 44 : size;
  const box = { width: px, height: px, fontSize: Math.round(px * 0.39) };
  if (rank <= 3) {
    const tone = MEDAL_TONES[rank - 1];
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full font-serif font-extrabold"
        style={{
          ...box,
          background: `color-mix(in srgb, ${tone.fill} 16%, var(--bg-panel))`,
          color: tone.ink,
          border: `1px solid color-mix(in srgb, ${tone.fill} 32%, var(--border-default))`
        }}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-alt font-serif font-bold text-ink-muted"
      style={box}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

// ── Buttons ───────────────────────────────────────────────────
// 48px friendly set. Primary is a FILLED accent-green pill (`.ap-btn-primary`
// lives in globals.css — the color-mix hover can't ride a Tailwind arbitrary
// class reliably); secondary is panel + default border; danger keeps its
// quiet-red chip treatment. The fill/ink pair is theme-var based, so no hexes.
export const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold transition active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-50 min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const primaryButton =
  `${buttonBase} ap-btn-primary min-h-12 px-6 shadow-elev-1 hover:-translate-y-0.5 active:scale-95`;

export const secondaryButton =
  `${buttonBase} min-h-12 border border-line bg-surface text-ink shadow-elev-1 hover:-translate-y-0.5 hover:bg-surface-alt active:scale-95`;

export const dangerButton =
  `${buttonBase} min-h-12 chip-danger border hover:-translate-y-0.5 active:scale-95` +
  " [border-color:color-mix(in_srgb,var(--text-error)_35%,var(--border-default))] focus-visible:ring-status-danger";

export const inputClass = "t-input w-full rounded-input px-4 py-3 text-sm font-medium outline-none transition";

// ── QuestCard ─────────────────────────────────────────────────
// The daily-mission game card: category icon tile (12% tint of the category
// accent), title + why-it-matters description, reward chips row, and a state
// control on the right:
//   idle     → round "not picked" ring (camera glyph when photo is required)
//   selected → filled accent check, spring pop
//   proof    → fg-stamp-style tappable "Add proof" tag
//   verified → ShieldCheck on a green tint (visually distinct from done)
//   done     → filled check with soft outer ring + pop
// Whole card taps fire `onClick` unless `disabled`. Self-contained motion,
// honors useReducedMotion.
export type QuestCardState = "idle" | "selected" | "proof" | "verified" | "done";

type QuestCardProps = {
  title: ReactNode;
  description?: string;
  /** A `var(--accent-*)` value that drives the icon-tile tint + selected state. */
  iconColor?: string;
  /** Display-only category name (small caption next to the title). */
  category?: string;
  /** Glyph inside the category tile; falls back to a leaf. Pass the page's own
   *  category lucide icon for stronger identity. */
  categoryIcon?: ReactNode;
  /** Reward chips row — pass fg-chip elements. */
  rewards?: ReactNode;
  state: QuestCardState;
  /** Text for the proof stamp (default "Add proof"). */
  proofLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Shows a tiny camera hint on the idle checkbox. */
  requiresPhoto?: boolean;
};

export function QuestCard({
  title,
  description,
  iconColor = "var(--text-accent)",
  category,
  categoryIcon,
  rewards,
  state,
  proofLabel = "Add proof",
  onClick,
  disabled = false,
  requiresPhoto = false
}: QuestCardProps) {
  const reduced = useReducedMotion();
  const isFilled = state === "selected" || state === "done";
  const background = isFilled || state === "verified"
    ? wash(iconColor, state === "selected" ? 8 : 5)
    : "var(--bg-panel)";
  const border = state === "selected"
    ? `color-mix(in srgb, ${iconColor} 45%, var(--border-default))`
    : "var(--border-default)";

  const content = (
    <>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input"
        style={{ background: wash(iconColor, 12), color: iconColor }}
        aria-hidden="true"
      >
        {categoryIcon ?? <Leaf className="h-5 w-5" strokeWidth={2.2} />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-serif text-[0.9375rem] font-bold leading-snug text-ink">{title}</span>
          {category && (
            <span className="shrink-0 text-[0.6875rem] font-bold text-ink-muted">{category}</span>
          )}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{description}</span>
        )}
        {rewards && <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{rewards}</span>}
      </span>

      <span className="shrink-0" aria-hidden="true">
        {state === "idle" && (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors"
            style={{ borderColor: iconColor === "var(--text-accent)" ? "var(--border-default)" : wash(iconColor, 45) }}
          >
            {requiresPhoto && <Camera className="h-3 w-3 text-ink-muted" />}
          </span>
        )}
        {state === "selected" && (
          <motion.span
            key="selected"
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: iconColor }}
            initial={reduced ? { scale: 1 } : { scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={springPop}
          >
            <Check className="h-4 w-4" strokeWidth={3.2} style={{ color: "var(--text-sidebar)" }} />
          </motion.span>
        )}
        {state === "proof" && (
          <motion.span
            key="proof"
            className="fg-stamp h-14 w-14 px-1 text-[0.5625rem] font-extrabold tracking-[0.08em]"
            style={{ transform: "rotate(-6deg)" }}
            initial={reduced ? { scale: 1 } : { scale: 0.7, rotate: -14 }}
            animate={{ scale: 1, rotate: -6 }}
            transition={springPop}
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={2.4} />
            {proofLabel}
          </motion.span>
        )}
        {state === "verified" && (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: wash("var(--accent-green)", 14), color: "var(--accent-green-text)" }}
          >
            <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
        )}
        {state === "done" && (
          <motion.span
            key="done"
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: "var(--accent-green)", boxShadow: `0 0 0 3px ${wash("var(--accent-green)", 18)}` }}
            initial={reduced ? { scale: 1 } : { scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={springPop}
          >
            <Check className="h-4 w-4" strokeWidth={3.2} style={{ color: "var(--text-sidebar)" }} />
          </motion.span>
        )}
      </span>
    </>
  );

  const shell = `flex w-full items-center gap-3 p-3.5 text-left ${CARD} transition-[background-color,border-color,box-shadow,transform] active:scale-[0.985]`;
  const surface = { background, border: `1px solid ${border}` };

  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={state === "selected" || state === "done"}
        className={`${shell} shadow-elev-1 ${disabled ? "cursor-not-allowed opacity-60" : "hover:shadow-elev-2"}`}
        style={surface}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={`${shell} shadow-elev-1 ${disabled ? "opacity-60" : ""}`} style={surface}>
      {content}
    </div>
  );
}

// ── StreakFlame ───────────────────────────────────────────────
// Compact streak medallion: gold flame disc + "N-day streak" + 7 day dots.
// `days` (last 7 days of { done }) wins over the streak-derived fill so the
// dashboard and profile can show gaps honestly.
type StreakFlameProps = {
  streak: number;
  longest?: number;
  days?: { done: boolean }[];
};

export function StreakFlame({ streak, longest, days }: StreakFlameProps) {
  const pattern = days
    ? days.slice(0, 7)
    : Array.from({ length: 7 }, (_, i) => ({ done: i < Math.min(Math.max(streak, 0), 7) }));

  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{
          background: wash("var(--accent-gold)", 14),
          border: `1px solid color-mix(in srgb, var(--accent-gold) 28%, var(--border-default))`,
          color: "var(--accent-gold-text)"
        }}
        aria-hidden="true"
      >
        <Flame className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="font-serif text-sm font-bold leading-tight text-ink">
          {streak}-day streak
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {pattern.map((d, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={
                  d.done
                    ? { background: "var(--accent-gold)" }
                    : { border: "1px solid var(--border-default)" }
                }
              />
            ))}
          </span>
          {typeof longest === "number" && (
            <span className="text-xs font-semibold text-ink-muted">Best {longest}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── LevelProgressRing ─────────────────────────────────────────
// SVG XP ring around a font-serif level number. Progress comes from the REAL
// curve via `getXPProgress` (@/lib/level-system) — never recalculated here.
// Stroke = text-accent, track = border-subtle; the sweep animates via a
// strokeDashoffset tween (skipped under reduced motion).
type LevelProgressRingProps = {
  level: number;
  xp: number;
  size?: number;
  showLabel?: boolean;
};

export function LevelProgressRing({ level, xp, size = 64, showLabel = true }: LevelProgressRingProps) {
  const reduced = useReducedMotion();
  const { current, required, percentage } = getXPProgress(xp);
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const targetOffset = circumference * (1 - Math.max(0, Math.min(100, percentage)) / 100);
  const fontSize = Math.max(13, Math.round(size * 0.28));
  const xpToNext = Math.max(0, required - current);

  return (
    <div
      className="inline-flex flex-col items-center"
      style={{ width: size }}
      role="img"
      aria-label={`Level ${level}, ${xpToNext} XP to next level`}
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
                stroke: "var(--text-accent)",
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
              style={{ stroke: "var(--text-accent)", strokeDasharray: circumference }}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: targetOffset }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-serif font-bold leading-none text-ink"
          style={{ fontSize }}
        >
          {level}
        </span>
      </div>
      {showLabel && (
        <p className="mt-1 text-center text-[0.6875rem] font-semibold leading-tight text-ink-muted">
          {xpToNext} XP to next
        </p>
      )}
    </div>
  );
}

// ── MiniShelf ─────────────────────────────────────────────────
// Horizontal collectible strip (no scrollbar): square rounded image tiles with
// optional per-tile ring + count badge, a trailing "+" tile when `children`
// given, and a dashed empty tile when the shelf is bare.
type MiniShelfItem = {
  src: string;
  alt: string;
  count?: number;
  /** Any theme var (e.g. `var(--rarity-rare)`); renders as a soft outer ring. */
  ringColor?: string;
};

type MiniShelfProps = {
  items: MiniShelfItem[];
  /** Square tile side, px (image + tile). */
  maxHeight?: number;
  /** Shown as a dashed empty tile when `items` is empty. */
  emptyHint?: string;
  /** Content of the trailing "more" tile (icon/label). */
  children?: ReactNode;
};

export function MiniShelf({ items, maxHeight = 56, emptyHint, children }: MiniShelfProps) {
  const t = Math.round(maxHeight * 1.25);

  if (items.length === 0 && !emptyHint) return null;

  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
      {items.map((item, i) => (
        <span
          key={`${item.src}-${i}`}
          className="relative shrink-0 overflow-hidden rounded-2xl border bg-surface-alt"
          style={{
            width: t,
            height: t,
            borderColor: item.ringColor ?? "var(--border-default)",
            boxShadow: item.ringColor
              ? `0 0 0 2px color-mix(in srgb, ${item.ringColor} 40%, transparent)`
              : undefined
          }}
        >
          <Image
            src={item.src}
            alt={item.alt}
            width={t}
            height={t}
            sizes={`${t}px`}
            className="h-full w-full object-cover"
          />
          {typeof item.count === "number" && (
            <span
              className="absolute bottom-0.5 right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[0.625rem] font-bold leading-none text-ink"
              style={{ background: "var(--bg-panel)", border: "1px solid var(--border-default)" }}
              aria-label={`${item.alt}: owned ${item.count}`}
            >
              ×{item.count}
            </span>
          )}
        </span>
      ))}

      {items.length === 0 && emptyHint && (
        <span
          className="flex shrink-0 items-center justify-center rounded-2xl border border-dashed border-line-soft px-3 text-center text-xs font-semibold leading-snug text-ink-muted"
          style={{ width: t, height: t }}
          aria-hidden="true"
        >
          {emptyHint}
        </span>
      )}

      {children && (
        <span
          className="flex shrink-0 items-center justify-center gap-1 rounded-2xl border border-dashed border-line px-2 text-ink-muted"
          style={{ width: t, height: t, background: "var(--bg-panel-alt)" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
          {children}
        </span>
      )}
    </div>
  );
}

// ── StatRow helper ────────────────────────────────────────────
// Renders a simple label+value row inside a Panel
export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-input bg-surface-alt px-4 py-3">
      <span className="text-overline text-ink-muted">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}