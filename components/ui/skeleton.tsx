"use client";

/**
 * Reusable layout skeletons that mirror the `game-ui` building blocks
 * (PageHero + MetricCard grid + Panel, plus card grids and list rows).
 *
 * Visually consistent with the hand-rolled skeletons already living in
 * `app/(game)/dashboard/page.tsx` and `app/(game)/layout.tsx`: theme CSS vars
 * for surfaces/borders, and translucent white bars over the dark hero gradient
 * (which is dark in every theme, so `bg-white/25` is always legible).
 *
 * All shimmer via Tailwind's `animate-pulse` — no new CSS required.
 */

type PanelSpec = { rows?: number };

/** Dark hero block with eyebrow/title/description bars + a row of glass tiles. */
export function HeroSkeleton({ chips = 5 }: { chips?: number }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] p-6 sm:p-8" style={{ background: "var(--bg-hero)" }}>
      <div className="flex flex-col gap-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-white/25" />
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-white/25" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-white/15" />
        <div className="mt-2 flex flex-wrap gap-3">
          {Array.from({ length: chips }).map((_, i) => (
            <div key={i} className="h-14 w-20 animate-pulse rounded-xl bg-white/15" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Full-page skeleton: hero + MetricCard grid + N panel blocks.
 * For pages that gate the WHOLE page behind an early `return` while fetching.
 */
export function PageSkeleton({
  metricCount = 4,
  panels = [{ rows: 4 }],
  heroChips = 5
}: {
  metricCount?: number;
  panels?: PanelSpec[];
  heroChips?: number;
}) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <HeroSkeleton chips={heroChips} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: metricCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-[18px] p-5"
            style={{ background: "var(--bg-panel)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--bg-panel-alt)]" />
            <div className="mt-3 h-6 w-16 animate-pulse rounded bg-[var(--bg-panel-alt)]" />
          </div>
        ))}
      </div>

      {panels.map((panel, i) => (
        <div
          key={i}
          className="rounded-[18px] p-6"
          style={{ background: "var(--bg-panel)", border: "1px solid var(--border-subtle)" }}
        >
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--bg-panel-alt)]" />
          <div className="mt-5 flex flex-col gap-3">
            {Array.from({ length: panel.rows ?? 4 }).map((_, j) => (
              <div key={j} className="h-16 w-full animate-pulse rounded-xl bg-[var(--bg-panel-alt)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Grid of card placeholders (aspect-square image block + name bar + price bar).
 * For shop/collection item grids and the team mission-library template grid.
 * `compact` renders shorter image blocks for small stat-tile grids (impact).
 */
export function CardGridSkeleton({
  count = 8,
  cols = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
  compact = false
}: {
  count?: number;
  cols?: string;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-4 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-[20px] border p-3"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
        >
          <div className={`mb-1 w-full animate-pulse rounded-xl bg-[var(--bg-panel-alt)] ${compact ? "h-16" : "aspect-square"}`} />
          <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--bg-panel-alt)]" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--bg-panel-alt)]" />
        </div>
      ))}
    </div>
  );
}

/**
 * List of row placeholders: avatar circle + two text bars + a pill/button bar.
 * `variant="avatar"` for friend/player rows; `variant="row"` for leaderboard
 * table rows (numbered square instead of avatar circle).
 */
export function RowListSkeleton({
  rows = 4,
  variant = "avatar"
}: {
  rows?: number;
  variant?: "avatar" | "row";
}) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border p-4"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}
        >
          <div
            className={`shrink-0 animate-pulse bg-[var(--bg-panel)] ${variant === "avatar" ? "h-11 w-11 rounded-full" : "h-10 w-10 rounded-xl"}`}
          />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--bg-panel)]" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-[var(--bg-panel)]" />
          </div>
          <div className="h-8 w-16 shrink-0 animate-pulse rounded-full bg-[var(--bg-panel)]" />
        </div>
      ))}
    </div>
  );
}