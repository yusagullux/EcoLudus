"use client";

import Image from "next/image";
import Link from "next/link";
import { Sprout } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { BotanicalLabel, RewardChip } from "./primitives";
import { StaggerContainer, StaggerItem, useReducedMotion } from "@/lib/animations";

/**
 * Landing hero — asymmetric split (spec §1):
 * left: story copy + CTAs, right: a layered garden diorama built from
 * real in-game plant photos. The one orchestrated entrance moment on the
 * page: copy rises, the diorama settles in, then specimens grow in one
 * by one. Honors useReducedMotion (everything renders static).
 */

// Grow-in: scale starts undersized like a seedling, rises, settles.
const growVariants: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 240, damping: 22 }
  }
};

// The diorama frame itself — a wider, softer settle than the specimens.
const sceneVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 180,
      damping: 26,
      delayChildren: 0.12,
      staggerChildren: 0.11
    }
  }
};

/** Specimen photo tile that grows in with the hero sequence. */
function GrowTile({
  className = "",
  style,
  children
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div className={className} style={style} variants={growVariants}>
      {children}
    </motion.div>
  );
}

/** Floating reward chip that pops in after its specimen. */
function GrowChip({
  className = "",
  style,
  children
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) {
    return <div className={`absolute ${className}`} style={style}>{children}</div>;
  }
  return (
    <motion.div className={`absolute ${className}`} style={style} variants={growVariants}>
      {children}
    </motion.div>
  );
}

// Rarity ring — same formula the shared SpecimenFrame uses.
function rarityRing(rarity: string) {
  return `2px solid color-mix(in srgb, var(--rarity-${rarity}) 45%, var(--border-default))`;
}

type Specimen = {
  src: string;
  alt: string;
  rarity: "common" | "uncommon" | "rare" | "legendary";
  // Placement inside the diorama (percentages of the scene box).
  style: React.CSSProperties;
  sizes: string;
};

const SPECIMENS: Specimen[] = [
  {
    src: "/images/plants/goldentree.png",
    alt: "Golden tree specimen",
    rarity: "legendary",
    style: { width: "36%", top: "6%", right: "5%" },
    sizes: "200px"
  },
  {
    src: "/images/plants/cherry_blossom.png",
    alt: "Cherry blossom specimen",
    rarity: "rare",
    style: { width: "27%", top: "22%", left: "7%" },
    sizes: "150px"
  },
  {
    src: "/images/plants/lavender.png",
    alt: "Lavender specimen",
    rarity: "uncommon",
    style: { width: "23%", top: "44%", right: "16%" },
    sizes: "130px"
  },
  {
    src: "/images/plants/sunflower.png",
    alt: "Sunflower specimen",
    rarity: "common",
    style: { width: "31%", bottom: "7%", left: "11%" },
    sizes: "175px"
  }
];

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section aria-label="EcoLudus — daily eco missions">
      <StaggerContainer
        className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 pt-6 pb-4 sm:px-8 sm:pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-10"
        staggerDelay={0.09}
        initialDelay={0.05}
      >
        {/* ── Left: story ────────────────────────────────── */}
        <div className="flex flex-col items-start gap-6">
          {/* Sentence-case kicker (spec: no all-caps eyebrows above headings) */}
          <StaggerItem className="inline-flex items-center gap-1.5">
            <Sprout className="h-4 w-4 text-accent" aria-hidden="true" />
            <p className="text-sm font-bold text-accent">Daily eco missions</p>
          </StaggerItem>

          <StaggerItem>
            <h1 className="font-serif text-4xl leading-[1.08] font-bold tracking-tight text-ink sm:text-5xl">
              Play, protect, and grow a greener tomorrow.
            </h1>
          </StaggerItem>

          <StaggerItem>
            <p className="max-w-md text-base leading-7 text-ink-soft sm:text-lg sm:leading-8">
              Complete daily missions to earn XP, EcoPoints, and a garden that
              grows — and verified proof turns every mission into real CO₂
              savings you can count.
            </p>
          </StaggerItem>

          <StaggerItem className="mt-1 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="mk-btn-primary inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              Start growing
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink shadow-elev-1 transition hover:-translate-y-0.5 hover:bg-surface-alt active:translate-y-0 active:scale-[0.98]"
            >
              I have an account
            </Link>
          </StaggerItem>

          <StaggerItem className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
            <BotanicalLabel>Photo-verified proof</BotanicalLabel>
            <BotanicalLabel>Real trees planted</BotanicalLabel>
          </StaggerItem>
        </div>

        {/* ── Right: layered garden diorama ──────────────── */}
        {prefersReducedMotion ? (
          <Diorama />
        ) : (
          <motion.div variants={sceneVariants}>
            <Diorama />
          </motion.div>
        )}
      </StaggerContainer>
    </section>
  );
}

/** The layered scene: sky gradient, sun, hill + tree-line silhouettes,
 *  soil band, and four specimen photos with floating reward chips. */
function Diorama() {
  return (
    <div
      className="relative mx-auto aspect-[6/7] w-full max-w-[540px] overflow-hidden rounded-dialog border border-line shadow-elev-2"
      style={{
        background:
          "linear-gradient(to bottom, color-mix(in srgb, var(--accent-gold) 10%, var(--bg-panel-alt)) 0%, var(--bg-panel-alt) 45%, color-mix(in srgb, var(--text-accent) 20%, var(--bg-panel-alt)) 100%)"
      }}
    >
      {/* Sun — a warm glow in the sky corner */}
      <div
        aria-hidden="true"
        className="absolute -top-10 -left-10 h-36 w-36 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--accent-gold) 45%, transparent) 0%, transparent 70%)"
        }}
      />

      {/* Far hill line */}
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[15%] h-[44%] w-full"
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
      >
        <path
          d="M0 160 L0 96 C50 68 112 78 168 90 C228 102 268 62 324 70 C352 74 380 66 400 72 L400 160 Z"
          fill="color-mix(in srgb, var(--text-accent) 28%, var(--bg-panel-alt))"
        />
      </svg>

      {/* Near tree-line with canopy bumps */}
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[14%] h-[30%] w-full"
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0 120 L0 82 Q28 60 54 78 Q68 56 94 74 Q122 50 152 72 Q192 48 232 70 Q282 52 322 72 Q362 56 400 78 L400 120 Z"
          fill="color-mix(in srgb, var(--text-accent) 55%, var(--bg-panel-alt))"
        />
      </svg>

      {/* Soil band the specimens stand on */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[16%]"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--text-accent) 24%, var(--bg-sidebar)), var(--bg-sidebar))"
        }}
      />

      {/* Specimen tiles */}
      {SPECIMENS.map((s) => (
        <GrowTile key={s.src} className="absolute" style={s.style}>
          <div className="relative aspect-square overflow-hidden rounded-card shadow-elev-2" style={{ border: rarityRing(s.rarity) }}>
            <Image src={s.src} alt={s.alt} fill sizes={s.sizes} className="object-cover" />
          </div>
        </GrowTile>
      ))}

      {/* Floating reward chips */}
      <GrowChip className="z-10" style={{ bottom: "38%", left: "4%" }}>
        <RewardChip kind="coins">+45 EP</RewardChip>
      </GrowChip>
      <GrowChip className="z-10" style={{ top: "12%", left: "16%" }}>
        <RewardChip kind="carbon">+2.5 kg CO₂ saved</RewardChip>
      </GrowChip>
    </div>
  );
}

export default HeroSection;