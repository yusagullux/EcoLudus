"use client";

import { useId } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";

// Snappy spring for the sliding selection pill — a segmented toggle should
// feel like it clicks into place, not softly bounce.
const snapSpring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34
};

/**
 * Segmented "mode" toggle (one option active) shared by the Shop and
 * Collection pages. Mirrors `SegmentedControl`'s track styling and uses a
 * Motion `layoutId` "pill" that slides between options for a smooth,
 * symmetric toggle. Respects `prefers-reduced-motion` (no slide — the pill
 * just appears on the active option).
 *
 * Track + tab styling intentionally match `components/ui/segmented-control.tsx`
 * so the two controls read as one system. Keep them in sync.
 */
export function PillTabBar<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  const baseId = useId();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className="no-scrollbar inline-flex w-fit max-w-full overflow-x-auto rounded-full p-1"
      style={{ background: "var(--pill-bg)", border: "1px solid var(--pill-border)" }}
    >
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onChange(opt)}
            className="relative shrink-0 min-h-11 rounded-full px-4 py-2 text-sm font-extrabold capitalize transition-colors"
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
            <span className="relative">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}