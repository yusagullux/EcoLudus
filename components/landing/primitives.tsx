import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared primitives for the landing page's field-guide visual language.
 * Server components (no hooks) so any section — server or client — can
 * compose them. All color flows through theme CSS vars, never hardcoded
 * hexes; see the design spec in docs/superpowers/specs/.
 */

/** Section rhythm wrapper: consistent max width + horizontal padding. */
export function SectionShell({
  id,
  children,
  className = ""
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 sm:px-8 lg:px-10 ${className}`}>
      {children}
    </section>
  );
}

/** Micro specimen tag — for genuine specimen/label artifacts only. */
export function BotanicalLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`fg-botlabel ${className}`}>{children}</span>;
}

type RewardChipKind = "coins" | "xp" | "carbon";

/** Reward pill — "+45 EP" / "+120 XP" / "−2.5 kg CO₂". */
export function RewardChip({ kind, children }: { kind: RewardChipKind; children: ReactNode }) {
  return <span className={`fg-chip ${kind === "coins" ? "fg-chip-coins" : kind === "xp" ? "fg-chip-xp" : "fg-chip-carbon"}`}>{children}</span>;
}

/**
 * Tinted information pill — the shared `.fg-chip` with a category tint mixed
 * over the panel (spec: tints via color-mix over bg-panel). One recipe for
 * every caller so chip tints/borders never drift between sections.
 */
export function TintChip({
  tint,
  tintText,
  children,
  className = ""
}: {
  tint: string;
  /** Dark-theme-safe text color — defaults to the tint itself. */
  tintText?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`fg-chip ${className}`}
      style={{
        background: `color-mix(in srgb, ${tint} 10%, var(--bg-panel))`,
        color: tintText ?? tint,
        borderColor: `color-mix(in srgb, ${tint} 28%, var(--border-default))`
      }}
    >
      {children}
    </span>
  );
}

/**
 * Circled lucide icon — the shared "icon in a tinted dot" recipe. Dominant
 * border mix from the previous inline blocks (30% over border-subtle) used
 * everywhere, so icon dots match across sections.
 */
export function IconDot({
  icon: Icon,
  tint,
  tintText,
  size = "h-8 w-8",
  iconSize = "h-4 w-4",
  className = ""
}: {
  icon: LucideIcon;
  tint: string;
  /** Dark-theme-safe icon color — defaults to the tint itself. */
  tintText?: string;
  /** Tailwind size classes for the circle, e.g. "h-9 w-9". */
  size?: string;
  /** Tailwind size classes for the glyph. */
  iconSize?: string;
  className?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full ${size} ${className}`}
      style={{
        background: `color-mix(in srgb, ${tint} 12%, var(--bg-panel))`,
        border: `1px solid color-mix(in srgb, ${tint} 30%, var(--border-subtle))`,
        color: tintText ?? tint
      }}
    >
      <Icon className={iconSize} aria-hidden="true" />
    </span>
  );
}

/** Circular verified-style stamp, rotated like a real rubber stamp. */
export function Stamp({ lines, className = "", size = 88 }: { lines: string[]; className?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`fg-stamp ${className}`}
      style={{ width: size, height: size }}
    >
      {lines.map((line, i) => (
        <span
          key={i}
          style={{ fontSize: i === 0 ? "0.625rem" : "0.5rem", fontWeight: 800, letterSpacing: "0.08em" }}
        >
          {line}
        </span>
      ))}
    </span>
  );
}

/** Dashed trail divider segment. */
export function DashedTrail({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`fg-trail ${className}`} />;
}

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/**
 * Collectible specimen: a real in-game photo presented like a field-guide
 * entry — rounded frame, optional rarity ring, optional caption strip.
 */
export function SpecimenFrame({
  src,
  alt,
  rarity,
  width = 160,
  height = 160,
  frameClassName = "",
  caption
}: {
  src: string;
  alt: string;
  rarity?: Rarity;
  width?: number;
  height?: number;
  frameClassName?: string;
  caption?: ReactNode;
}) {
  const borderColor = rarity
    ? `color-mix(in srgb, var(--rarity-${rarity}) 45%, var(--border-default))`
    : "var(--border-default)";
  return (
    <figure className={`flex flex-col items-center ${frameClassName}`}>
      <div
        className="relative overflow-hidden rounded-card shadow-elev-1"
        style={{ width, height, border: `2px solid ${borderColor}` }}
      >
        <Image src={src} alt={alt} fill sizes={`${Math.max(width, 160)}px`} className="object-cover" />
      </div>
      {caption ? <figcaption className="mt-2 text-center">{caption}</figcaption> : null}
    </figure>
  );
}