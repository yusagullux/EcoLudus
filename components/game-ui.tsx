import type { CSSProperties, ReactNode } from "react";
import { AnimatedNumber, AnimatedProgressBar } from "@/lib/animations";

// ── Shared rarity styles ──────────────────────────────────────
export type Rarity = "common" | "rare" | "epic" | "legendary";
export const rarityStyle: Record<Rarity, { chip: string; accent: string }> = {
  common:    { chip: "bg-[#eef2e8] text-[#344534]",  accent: "#7c8b74" },
  rare:      { chip: "bg-[#edf5f8] text-[#27556b]",  accent: "#2f5f86" },
  epic:      { chip: "bg-[#f2eff7] text-[#594174]",  accent: "#62508f" },
  legendary: { chip: "bg-[#fbf4df] text-[#76511a]",  accent: "#9a6b1f" }
};
export const rarityBorder: Record<Rarity, string> = {
  common: "#d9e2d2", rare: "#bed0dd", epic: "#d2c9df", legendary: "#e6d3a6"
};

// ── PageHero ──────────────────────────────────────────────────
type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
  // Optional CSS background that overrides the default --bg-hero gradient so
  // each section can carry its own accent color (blue for Insights, amber for
  // Shop, purple for Team…). All accents in `heroAccents` below are dark
  // gradients, so the white hero text stays readable across every theme.
  accent?: string;
};

// Per-section hero accents. Dark, low-saturation gradients keyed by section so
// the app's information hierarchy isn't a flat wall of identical forest-green
// heroes. The default (no accent) keeps the theme's --bg-hero for the spine
// pages (Dashboard, Impact, Profile).
export const heroAccents = {
  habits:      "linear-gradient(135deg, #0e1430 0%, #1a2a5a 55%, #2e4a8a 100%)",
  shop:        "linear-gradient(135deg, #2e1d10 0%, #7b5832 55%, #b08d60 100%)",
  collection:  "linear-gradient(135deg, #0a1f1f 0%, #0f3d3a 55%, #1e6b5e 100%)",
  garden:      "linear-gradient(135deg, #0a1f10 0%, #115f2e 55%, #2e7a45 100%)",
  pets:        "linear-gradient(135deg, #3a1525 0%, #6b2a45 55%, #a8456b 100%)",
  insights:    "linear-gradient(135deg, #071828 0%, #0d3540 55%, #1e4a6b 100%)",
  premium:     "linear-gradient(135deg, #2e2410 0%, #6b5215 55%, #b08d20 100%)",
  team:        "linear-gradient(135deg, #2a1545 0%, #4a2a7a 55%, #7a4aa8 100%)",
  friends:     "linear-gradient(135deg, #14203a 0%, #2a3a6b 55%, #4a6aa8 100%)",
  leaderboard: "linear-gradient(135deg, #2e2410 0%, #6b5215 55%, #b08d20 100%)",
  settings:    "linear-gradient(135deg, #0e1418 0%, #1e2a32 55%, #3a4a52 100%)"
} as const;

export function PageHero({ eyebrow, title, description, children, accent }: PageHeroProps) {
  return (
    <section
      className="relative overflow-hidden rounded-[22px] border border-white/10 px-5 py-6 sm:px-8 sm:py-8"
      style={{ background: accent ?? "var(--bg-hero)", boxShadow: "var(--shadow-hero)" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-moss-300">{eyebrow}</p>
          <h1 className="mt-2 text-balance font-serif text-2xl font-bold leading-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">{description}</p>
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </section>
  );
}

// ── HeroMetric ────────────────────────────────────────────────
export function HeroMetric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  const numericValue = typeof value === "number" ? value : null;
  return (
    <div
      className="relative min-w-[70px] rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-center"
      title={hint}
    >
      <div className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-[0.18em] text-moss-300">
        {label}
        {hint && (
          <span
            className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-white/25 text-[8px] text-white/70"
            aria-label="More info"
            role="img"
          >
            i
          </span>
        )}
      </div>
      <div className="mt-1 font-serif text-xl font-bold leading-none text-white">
        {numericValue !== null ? <AnimatedNumber value={numericValue} /> : value}
      </div>
    </div>
  );
}

// ── MetricCard ────────────────────────────────────────────────
type MetricCardProps = { label: string; value: ReactNode; accent?: string; wide?: boolean };

export function MetricCard({ label, value, accent = "#2f6b46", wide = false }: MetricCardProps) {
  const numericValue = typeof value === "number" ? value : null;
  return (
    <article
      className={`t-panel rounded-[16px] p-4 transition hover:-translate-y-0.5 ${wide ? "sm:col-span-2" : ""}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-2 h-[3px] w-7 rounded-full" style={{ background: accent }} />
      <p
        className="min-h-[1.6rem] text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <p
        className="mt-1.5 min-h-[1.75rem] font-serif text-2xl font-bold leading-none"
        style={{ color: "var(--text-primary)" }}
      >
        {numericValue !== null ? <AnimatedNumber value={numericValue} /> : value}
      </p>
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
    <section
      id={id}
      className={`t-panel rounded-[18px] ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {(eyebrow || title || action) && (
        <div
          className="flex flex-col gap-1.5 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div>
            {eyebrow && (
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "var(--text-muted)" }}
              >
                {eyebrow}
              </p>
            )}
            {title && (
              <h2
                className="mt-0.5 font-serif text-lg font-bold leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
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
export function ProgressBar({ value, color = "#2f6b46" }: { value: number; color?: string }) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full"
      style={{
        background: "var(--border-subtle, #e7ecdf)",
        // Subtle inset edge so an empty (0%) bar is still visible — without it
        // the track and the panel behind it are too close in value and the bar
        // effectively disappears at 0%.
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--border-default, #dfe7d7) 70%, transparent)"
      }}
    >
      <AnimatedProgressBar value={value} color={color} />
    </div>
  );
}

// ── Pill ──────────────────────────────────────────────────────
export function Pill({
  children,
  active = false,
  className,
  style
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${className ?? ""}`}
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

// ── PillTabBar / PillFilterBar ─────────────────────────────────
// Horizontal chip selectors shared by the Shop and Collection pages, which
// used to inline these two bars byte-for-byte. PillTabBar is the segmented
// "mode" switch (one option active, fills the track); PillFilterBar is the
// rarity filter row (scrolls on mobile, wraps from sm: up). Both scroll
// horizontally without a scrollbar on narrow viewports so the chips never
// force page-level horizontal overflow.
export function PillTabBar<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="no-scrollbar inline-flex w-fit max-w-full overflow-x-auto rounded-full p-1"
      style={{ background: "var(--bg-panel-alt)", border: "1px solid var(--border-default)" }}
    >
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          onClick={() => onChange(opt)}
          className="shrink-0 min-h-11 rounded-full px-4 py-2 text-sm font-extrabold capitalize transition"
          style={
            value === opt
              ? { background: "var(--pill-active-bg)", color: "var(--pill-active-text)" }
              : { color: "var(--text-muted)" }
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

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
          className="shrink-0 min-h-11 rounded-full px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] transition"
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

// ── Buttons ───────────────────────────────────────────────────
// Labels render in their natural (sentence) case — the source strings are
// already cased correctly, so we no longer CSS-uppercase them. Wide all-caps
// tracking made longer labels ("Select missions to complete") hard to scan.
export const buttonBase =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold tracking-[0.02em] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export const primaryButton =
  `${buttonBase} bg-forest-950 text-cream-100 shadow-[0_8px_24px_rgba(16,33,20,0.18)] hover:-translate-y-0.5 hover:bg-forest-800 focus-visible:ring-forest-600`;

export const secondaryButton =
  `${buttonBase} border hover:-translate-y-0.5 focus-visible:ring-forest-600` +
  " [border-color:var(--border-default)] [color:var(--text-primary)] [background:transparent] hover:[background:var(--bg-panel-alt)]";

export const dangerButton =
  `${buttonBase} border border-rose-300 bg-rose-50 text-rose-700 hover:-translate-y-0.5 hover:bg-rose-100 focus-visible:ring-rose-400`;

export const inputClass =
  "t-input w-full rounded-xl px-4 py-3 text-sm font-medium outline-none transition focus:shadow-[0_0_0_3px_rgba(67,101,63,0.14)]";

// ── StatRow helper ────────────────────────────────────────────
// Renders a simple label+value row inside a Panel
export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ background: "var(--bg-panel-alt)" }}
    >
      <span
        className="text-[11px] font-bold uppercase tracking-[0.12em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}
