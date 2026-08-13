"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  motion,
  AnimatePresence,
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
function useAnimatedNumber(value: number, duration = 700) {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  // Mirror of `display` so the animation effect can read the latest animated
  // value as its start point WITHOUT depending on `display` (which would
  // re-run the effect every animation frame). The ref is written inside an
  // effect — the recommended place for ref writes — not during render.
  const displayRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    // Reduced motion: no animation. The hook returns `value` directly below, so
    // there's no need to setState here (which would be a cascading render).
    if (prefersReducedMotion) return;

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
  }, [value, duration, prefersReducedMotion]);

  // When reduced motion is on, show the target value immediately — no animated
  // intermediate, no setState-in-effect.
  return prefersReducedMotion ? value : display;
}

type AnimatedNumberProps = {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
  className?: string;
};

export function AnimatedNumber({
  value,
  duration = 700,
  formatter,
  className = ""
}: AnimatedNumberProps) {
  const display = useAnimatedNumber(value, duration);
  const formatted = formatter ? formatter(display) : Math.round(display).toLocaleString();
  return <span className={className}>{formatted}</span>;
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
};

export function MotionPresence({ children, className = "" }: MotionPresenceProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {children && (
        <motion.div
          className={className}
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
const RARITY_GLOW: Record<string, string> = {
  common: "#4ade80",
  rare: "#60a5fa",
  epic: "#c084fc",
  legendary: "#fbbf24"
};

type RewardGlowProps = {
  rarity?: string;
  className?: string;
};

export function RewardGlow({ rarity, className = "" }: RewardGlowProps) {
  const prefersReducedMotion = useReducedMotion();
  const color = RARITY_GLOW[rarity ?? ""] ?? "#fbbf24";

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Pulsing halo */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${color}55 0%, transparent 60%)` }}
        animate={prefersReducedMotion ? { opacity: 0.5 } : { opacity: [0.5, 0.22, 0.5], scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: prefersReducedMotion ? 0 : Infinity, ease: "easeInOut" }}
      />
      {/* Rotating conic light rays, masked to a soft disc so the edges fade */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 opacity-40"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${color}66 25deg, transparent 50deg, transparent 90deg, ${color}66 115deg, transparent 140deg, transparent 180deg, ${color}66 205deg, transparent 230deg, transparent 270deg, ${color}66 295deg, transparent 320deg, transparent 360deg)`,
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
