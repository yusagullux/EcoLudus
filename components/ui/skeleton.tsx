"use client";

/**
 * Reusable layout skeletons that mirror the `game-ui` building blocks
 * (PageHero + MetricCard grid + Panel, plus card grids and list rows).
 *
 * Token-based throughout — `bg-surface`/`bg-surface-alt`/`bg-card`,
 * `border-line`, `bg-ink-soft/…` bars — so every skeleton resolves per theme
 * with zero per-theme overrides. All shimmer via Tailwind's `animate-pulse`.
 */

type PanelSpec = { rows?: number };

/** Hero band placeholder, shaped like the tokenized `PageHero`. */
export function HeroSkeleton({ chips = 5 }: { chips?: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-card border border-line p-6 shadow-elev-1 sm:p-8"
      style={{
        background: "color-mix(in srgb, var(--text-accent) 6%, var(--bg-panel))"
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-ink-muted/30" />
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-ink-muted/30" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-ink-muted/20" />
        <div className="mt-2 flex flex-wrap gap-3">
          {Array.from({ length: chips }).map((_, i) => (
            <div key={i} className="h-14 w-20 animate-pulse rounded-card bg-ink-muted/20" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Grid of metric-tile placeholders, shaped like `MetricCard`/`StatGrid`. */
export function MetricGridSkeleton({
  count = 4,
  cols = "grid-cols-2 lg:grid-cols-4"
}: {
  count?: number;
  cols?: string;
}) {
  return (
    <div className={`grid gap-3 ${cols}`} aria-busy="true" role="status" aria-live="polite">
      <span className="sr-only">Loading metrics…</span>
      <div aria-hidden="true" className="contents">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface p-4">
            <div className="h-[3px] w-7 animate-pulse rounded-full bg-ink-muted/40" />
            <div className="mt-3 h-2.5 w-20 animate-pulse rounded bg-surface-alt" />
            <div className="mt-3 h-6 w-16 animate-pulse rounded bg-surface-alt" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Single panel placeholder: header bar + N rounded row blocks. */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 sm:p-6" aria-hidden="true">
      <div className="h-4 w-32 animate-pulse rounded bg-surface-alt" />
      <div className="mt-5 flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, j) => (
          <div key={j} className="h-16 w-full animate-pulse rounded-card bg-surface-alt" />
        ))}
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
  heroChips = 5,
  hero = true
}: {
  metricCount?: number;
  panels?: PanelSpec[];
  heroChips?: number;
  /** Set false for pages whose PageHeader has no tinted hero band (the hero
      placeholder would flash a block that never becomes content). */
  hero?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {hero && <HeroSkeleton chips={heroChips} />}

      <MetricGridSkeleton count={metricCount} />

      {panels.map((panel, i) => (
        <PanelSkeleton key={i} rows={panel.rows ?? 4} />
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
    <div className={`grid gap-4 ${cols}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-dialog border border-line bg-card p-3">
          <div
            className={`mb-1 w-full animate-pulse rounded-card bg-surface-alt ${compact ? "h-16" : "aspect-square"}`}
          />
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface-alt" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-surface-alt" />
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
    <div className="flex flex-col gap-3" aria-busy="true" role="status" aria-live="polite">
      <span className="sr-only">Loading list…</span>
      <div aria-hidden="true" className="contents">
        {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface-alt p-4">
          <div
            className={`shrink-0 animate-pulse bg-surface ${variant === "avatar" ? "h-11 w-11 rounded-full" : "h-10 w-10 rounded-input"}`}
          />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-surface" />
          </div>
          <div className="h-8 w-16 shrink-0 animate-pulse rounded-full bg-surface" />
        </div>
      ))}
      </div>
    </div>
  );
}