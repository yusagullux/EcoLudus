"use client";

import { useId, type ReactNode } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";

// Snappy spring for the sliding selection pill — matches PillTabBar so the
// two controls feel like one system. Keep in sync with pill-tab-bar.tsx.
const snapSpring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34
};

/**
 * Accessible segmented tab control. Replaces the 5 hand-rolled pill-tab
 * implementations (Shop, Collection, Habits proof tabs, Team proof tabs,
 * Leaderboard individual/team). Theme-aware via the --pill-* CSS variables.
 *
 * The active option is marked by a Motion `layoutId` "pill" that slides
 * between options (shared-layout animation) rather than a per-button
 * background swap — so the toggle feels smooth and symmetric. Respects
 * `prefers-reduced-motion` (no slide — the pill just appears).
 *
 * Keyboard: Arrow Left/Right move between tabs, Home/End jump to ends,
 * Tab moves focus out of the control. Roving tabindex per WAI-ARIA tabs
 * pattern (automatic activation — focus moves the selection).
 */
export type SegmentedOption = {
  value: string;
  label: ReactNode;
  /** Optional badge count rendered after the label. */
  count?: number;
  disabled?: boolean;
};

type SegmentedControlProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  /** Full-width segmented bar (default) vs. inline auto-width. */
  fullWidth?: boolean;
  className?: string;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth = true,
  className = ""
}: SegmentedControlProps) {
  const baseId = useId();
  const prefersReducedMotion = useReducedMotion();

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const enabled = options.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled);
    const currentPos = enabled.findIndex(({ o }) => o.value === value);
    let nextPos = currentPos;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextPos = (currentPos + 1) % enabled.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextPos = (currentPos - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") nextPos = 0;
    else if (e.key === "End") nextPos = enabled.length - 1;
    else return;
    e.preventDefault();
    const next = enabled[nextPos];
    if (next) {
      onChange(next.o.value);
      // Move focus to the newly-selected tab.
      const el = document.getElementById(`${baseId}-tab-${next.i}`);
      el?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap gap-1 rounded-full p-1 ${className}`}
      style={{ background: "var(--pill-bg)", border: "1px solid var(--pill-border)" }}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            id={`${baseId}-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={selected}
            disabled={opt.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`relative inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${fullWidth ? "flex-1" : ""}`}
            style={{ color: selected ? "var(--pill-active-text)" : "var(--pill-text)" }}
          >
            {selected && (
              <motion.span
                aria-hidden="true"
                layoutId={prefersReducedMotion ? undefined : `${baseId}-pill`}
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--pill-active-bg)" }}
                transition={snapSpring}
              />
            )}
            <span className="relative">{opt.label}</span>
            {typeof opt.count === "number" && opt.count > 0 && (
              <span
                className="relative rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none"
                style={
                  selected
                    ? { background: "color-mix(in srgb, var(--pill-active-text) 22%, transparent)", color: "inherit" }
                    : { background: "var(--pill-border)", color: "var(--pill-text)" }
                }
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}