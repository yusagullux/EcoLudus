"use client";

import { type ReactNode } from "react";

/**
 * Consistent empty state: an icon tile, a title, an optional description, and
 * an optional CTA, over a friendly hand-drawn ground line + sprout scene.
 * Replaces the ~18 ad-hoc empty-state variants across game pages.
 *
 * Defaults to a dashed-bordered card; pass `variant="plain"` for an inline
 * (borderless) treatment inside a Panel that already provides a container.
 *
 * Colors are entirely theme-var driven (`color-mix` tints), so every
 * `[data-theme]` palette renders the scene correctly.
 */
type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: "card" | "plain";
  className?: string;
};

/** Decorative sprout-on-a-dashed-ground SVG — pure theme-var color. */
function SproutGround() {
  return (
    <svg
      width="132"
      height="40"
      viewBox="0 0 132 40"
      fill="none"
      aria-hidden="true"
      className="mt-2.5"
    >
      {/* hand-drawn ground line */}
      <path
        d="M10 34 C 34 30, 54 37, 66 33.5 C 82 29, 104 36, 122 32"
        stroke="var(--border-default)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      {/* two fallen seeds on the ground */}
      <circle cx="34" cy="33" r="1.8" fill="var(--accent-gold)" />
      <circle cx="100" cy="32.5" r="1.6" fill="var(--accent-gold)" opacity="0.7" />
      {/* sprout stem */}
      <path
        d="M66 33.5 C 66 29.5, 65.5 25.5, 66 22"
        stroke="var(--accent-green)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* sprout leaves */}
      <path
        d="M66 24 C 60.5 21, 57.5 15.5, 61.5 12.5 C 65.5 15, 66.5 20, 66 24Z"
        fill="var(--accent-green)"
      />
      <path
        d="M66.5 22 C 71.5 19, 74 13.5, 70 10.5 C 67 13.5, 66.4 18, 66.5 22Z"
        fill="var(--accent-green)"
        opacity="0.72"
      />
      {/* tiny sun-side accent dot */}
      <circle cx="86" cy="18" r="1.4" fill="var(--text-accent)" opacity="0.45" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "card",
  className = ""
}: EmptyStateProps) {
  const body = (
    <div className="flex flex-col items-center text-center">
      {icon && (
        <span
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--text-accent) 12%, var(--bg-panel))",
            color: "var(--text-accent)"
          }}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      {/* Ground scene always renders — even icon-less states get the
          hand-drawn identity instead of floating bare text. */}
      <SproutGround />
      <p className="font-serif text-base font-bold leading-tight text-ink">
        {title}
      </p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-ink-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );

  if (variant === "plain") {
    return <div className={`py-8 ${className}`}>{body}</div>;
  }

  return (
    <div className={`rounded-card border border-dashed border-line px-6 py-10 ${className}`}>
      {body}
    </div>
  );
}