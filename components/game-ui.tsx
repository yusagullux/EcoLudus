import type { ReactNode } from "react";

// ── Shared rarity styles (used in shop + collection) ────────
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

// ── PageHero ─────────────────────────────────────────────────
type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
};

export function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <section
      className="relative overflow-hidden rounded-[24px] border border-white/10 px-5 py-6 text-[var(--text-inverse,#fcf9f2)] shadow-[0_24px_70px_rgba(0,0,0,0.2)] sm:px-8 sm:py-8"
      style={{ background: "var(--bg-hero)" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-moss-300">{eyebrow}</p>
          <h1 className="mt-3 text-balance font-serif text-2xl font-extrabold leading-tight sm:text-3xl" style={{ color: "var(--text-inverse, #fcf9f2)" }}>
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 opacity-70">{description}</p>
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </section>
  );
}

// ── HeroMetric ───────────────────────────────────────────────
export function HeroMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-[70px] rounded-2xl border border-white/12 bg-white/8 px-3 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-moss-300">{label}</div>
      <div className="mt-1 font-serif text-xl font-extrabold leading-none text-white">{value}</div>
    </div>
  );
}

// ── MetricCard ───────────────────────────────────────────────
type MetricCardProps = { label: string; value: ReactNode; accent?: string; wide?: boolean };

export function MetricCard({ label, value, accent = "#2f6b46", wide = false }: MetricCardProps) {
  return (
    <article
      className={`t-panel rounded-[18px] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.07)] transition hover:-translate-y-0.5 ${wide ? "sm:col-span-2" : ""}`}
    >
      <div className="mb-2.5 h-1 w-8 rounded-full" style={{ background: accent }} />
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1.5 font-serif text-2xl font-extrabold leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
    </article>
  );
}

// ── Panel ────────────────────────────────────────────────────
type PanelProps = { eyebrow?: string; title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string };

export function Panel({ eyebrow, title, action, children, className = "" }: PanelProps) {
  return (
    <section className={`t-panel rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] ${className}`}>
      {(eyebrow || title || action) && (
        <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" style={{ borderColor: "var(--border-subtle)" }}>
          <div>
            {eyebrow && <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{eyebrow}</p>}
            {title && <h2 className="mt-0.5 font-serif text-xl font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

// ── ProgressBar ──────────────────────────────────────────────
export function ProgressBar({ value, color = "#2f6b46" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border-subtle, #e7ecdf)" }}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

// ── Pill ─────────────────────────────────────────────────────
export function Pill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
      style={active
        ? { background: "var(--pill-active-bg)", color: "var(--pill-active-text)" }
        : { background: "var(--pill-bg)", border: "1px solid var(--pill-border)", color: "var(--pill-text)" }
      }
    >
      {children}
    </span>
  );
}

// ── Button constants ─────────────────────────────────────────
export const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-extrabold uppercase tracking-[0.1em] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export const primaryButton =
  `${buttonBase} bg-forest-950 text-cream-100 shadow-[0_12px_28px_rgba(16,33,20,0.18)] hover:-translate-y-0.5 hover:bg-forest-800 focus-visible:ring-forest-600`;

export const secondaryButton =
  `${buttonBase} border bg-transparent hover:-translate-y-0.5 focus-visible:ring-forest-600` +
  " [border-color:var(--border-default)] [color:var(--text-primary)] hover:[background:var(--bg-panel-alt)]";

export const dangerButton =
  `${buttonBase} border border-rose-200 bg-rose-50 text-rose-700 hover:-translate-y-0.5 hover:bg-rose-100 focus-visible:ring-rose-400`;

export const inputClass =
  "t-input w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none placeholder:opacity-50 focus:shadow-[0_0_0_3px_rgba(67,101,63,0.14)] transition";
