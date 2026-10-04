"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useInView,
  useReducedMotion,
  type Transition,
  type Variants
} from "motion/react";

// ── Shared easing/duration tokens ─────────────────────────────
const springTransition: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 24
};

const easeOutTransition: Transition = {
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1]
};

// ── FadeIn ──────────────────────────────────────────────────────
type FadeInProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  x?: number;
  scale?: number;
  className?: string;
  once?: boolean;
  amount?: number;
  as?: "div" | "section" | "article" | "span" | "li" | "figure";
  id?: string;
  style?: CSSProperties;
};

export function FadeIn({
  children,
  delay = 0,
  duration = 0.45,
  y = 16,
  x = 0,
  scale = 1,
  className = "",
  once = true,
  amount = 0.2,
  as = "div",
  id,
  style
}: FadeInProps) {
  const prefersReducedMotion = useReducedMotion();
  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      id={id}
      className={className}
      style={style}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y, x, scale }}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}

// ── StaggerContainer / StaggerItem ────────────────────────────
const staggerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springTransition
  }
};

type StaggerContainerProps = {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
  as?: "div" | "ul" | "ol" | "section";
  id?: string;
  /** When true, reveal on scroll-into-view (for below-the-fold sections like
   *  landing). Default false → animate on mount, which is reliable for page
   *  wrappers that are already in view on load (and avoids content getting
   *  stuck at opacity:0 if whileInView's IntersectionObserver misses). */
  inView?: boolean;
};

export function StaggerContainer({
  children,
  className = "",
  staggerDelay = 0.06,
  initialDelay = 0.05,
  as = "div",
  id,
  inView = false
}: StaggerContainerProps) {
  const prefersReducedMotion = useReducedMotion();
  const Component = motion[as] as typeof motion.div;

  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay
      }
    }
  };

  if (prefersReducedMotion) {
    return <Component id={id} className={className}>{children}</Component>;
  }

  // inView → scroll-reveal (landing sections below the fold).
  // default → mount-triggered, always fires (page content already in view).
  const motionProps = inView
    ? { initial: "hidden" as const, whileInView: "visible" as const, viewport: { once: true, amount: 0.15 } }
    : { initial: "hidden" as const, animate: "visible" as const };

  return (
    <Component
      id={id}
      className={className}
      variants={variants}
      {...motionProps}
    >
      {children}
    </Component>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "section" | "figure";
  id?: string;
  style?: CSSProperties;
  title?: string;
};

export function StaggerItem({ children, className = "", as = "div", id, style, title }: StaggerItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const Component = motion[as] as typeof motion.div;

  if (prefersReducedMotion) {
    return <Component id={id} title={title} className={className} style={style}>{children}</Component>;
  }

  return (
    <Component id={id} title={title} className={className} style={style} variants={itemVariants}>
      {children}
    </Component>
  );
}

// ── AnimatedNumber ──────────────────────────────────────────────
function useAnimatedNumber(
  value: number,
  duration = 700,
  /** When `armed` is false the counter holds at `startAt` until it flips. */
  opts: { startAt?: number; armed?: boolean } = {}
) {
  const { startAt = value, armed = true } = opts;
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(startAt);
  // Mirror of `display` so the animation effect can read the latest animated
  // value as its start point WITHOUT depending on `display` (which would
  // re-run the effect every animation frame). The ref is written inside an
  // effect — the recommended place for ref writes — not during render.
  const displayRef = useRef(startAt);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    displayRef.current = armed ? display : startAt;
  }, [display, armed, startAt]);

  useEffect(() => {
    // Reduced motion: no animation. The hook returns `value` directly below, so
    // there's no need to setState here (which would be a cascading render).
    if (prefersReducedMotion || !armed) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const startValue = displayRef.current;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, prefersReducedMotion, armed]);

  // When reduced motion is on, show the target value immediately — no animated
  // intermediate, no setState-in-effect.
  return prefersReducedMotion ? value : display;
}

type AnimatedNumberProps = {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
  className?: string;
  /** Opt-in count-up on first scroll-in: hold at this value until the number
      enters the viewport, then animate to `value`. Omit for the default
      mount-time behavior (start already at `value`). */
  startFrom?: number;
};

export function AnimatedNumber({
  value,
  duration = 700,
  formatter,
  className = "",
  startFrom
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Only subscribe to viewport when a startFrom is requested, so existing
  // consumers (game stat chips) keep animating on mount unconditionally.
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const armed = startFrom === undefined ? true : inView;
  const display = useAnimatedNumber(value, duration, { startAt: startFrom ?? value, armed });
  const formatted = formatter ? formatter(display) : Math.round(display).toLocaleString();
  return <span ref={ref} className={className}>{formatted}</span>;
}

// ── AnimatedProgressBar ─────────────────────────────────────────
type AnimatedProgressBarProps = {
  value: number;
  color?: string;
  className?: string;
};

export function AnimatedProgressBar({ value, color = "var(--text-accent)", className = "" }: AnimatedProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={`h-1.5 overflow-hidden rounded-full ${className}`} style={{ background: "var(--border-subtle)" }}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={easeOutTransition}
        style={{ background: color }}
      />
    </div>
  );
}

// ── PageTransition ──────────────────────────────────────────────
type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        className={className}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
        transition={easeOutTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── TabPanel ────────────────────────────────────────────────────
type TabPanelProps = {
  children: ReactNode;
  activeKey: string;
  className?: string;
};

export function TabPanel({ children, activeKey, className = "" }: TabPanelProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        className={className}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6, scale: 0.99 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── MotionPresence ──────────────────────────────────────────────
// Lightweight wrapper for conditional single-child mount/unmount motion.
type MotionPresenceProps = {
  children: ReactNode;
  className?: string;
  /** Optional inline style for the animated wrapper (e.g. fixed positioning
   *  for dropdowns that must escape an `overflow-hidden` ancestor). */
  style?: CSSProperties;
};

export function MotionPresence({ children, className = "", style }: MotionPresenceProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {children && (
        <motion.div
          className={className}
          style={style}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
          transition={easeOutTransition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── RewardGlow ──────────────────────────────────────────────────
// Magical rotating rarity-colored light rays + a soft pulsing halo, placed
// *behind* a reward card (chest / hatch / species-unlock reveal). Purely
// decorative: pointer-events-none and aria-hidden so it never interferes with
// content or screen readers. Honors reduced motion (static halo, no spin).
//
// Used by the collection page's chest-opening and egg-hatching reveals to give
// the "you unlocked something" moment ambient, rarity-tinted light.
// Color source: the `--rarity-<r>` theme vars (single rarity system — see
// globals.css). The fallback is the legendary glow, keyed for unknown rarities.
const RARITY_GLOW: Record<string, string> = {
  common: "var(--rarity-common)",
  uncommon: "var(--rarity-uncommon)",
  rare: "var(--rarity-rare)",
  epic: "var(--rarity-epic)",
  legendary: "var(--rarity-legendary)"
};

type RewardGlowProps = {
  rarity?: string;
  className?: string;
};

export function RewardGlow({ rarity, className = "" }: RewardGlowProps) {
  const prefersReducedMotion = useReducedMotion();
  // Tints mix the rarity token against transparent (`color-mix`) because the
  // token is a var() — bare hex alpha suffixes wouldn't resolve here.
  const color = RARITY_GLOW[rarity ?? ""] ?? "var(--rarity-legendary)";
  const tintAlpha = (p: number) => `color-mix(in srgb, ${color} ${p}%, transparent)`;

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Pulsing halo */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${tintAlpha(33)} 0%, transparent 60%)` }}
        animate={prefersReducedMotion ? { opacity: 0.5 } : { opacity: [0.5, 0.22, 0.5], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: prefersReducedMotion ? 0 : Infinity, ease: "easeInOut" }}
      />
      {/* Rotating conic light rays, masked to a soft disc so the edges fade */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 opacity-40"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${tintAlpha(40)} 25deg, transparent 50deg, transparent 90deg, ${tintAlpha(40)} 115deg, transparent 140deg, transparent 180deg, ${tintAlpha(40)} 205deg, transparent 230deg, transparent 270deg, ${tintAlpha(40)} 295deg, transparent 320deg, transparent 360deg)`,
          maskImage: "radial-gradient(circle, black 0%, transparent 68%)",
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 68%)"
        }}
        animate={prefersReducedMotion ? { rotate: 0 } : { rotate: 360 }}
        transition={{ duration: 8, repeat: prefersReducedMotion ? 0 : Infinity, ease: "linear" }}
      />
    </div>
  );
}

// ── Re-export useful hooks ──────────────────────────────────────
export { useReducedMotion };
