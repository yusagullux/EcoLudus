import type { ReactNode } from "react";

type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
};

type MetricCardProps = {
  label: string;
  value: ReactNode;
  accent?: string;
  wide?: boolean;
};

type PanelProps = {
  eyebrow?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#112519_0%,#1f4d35_55%,#5d7250_100%)] px-5 py-6 text-cream-100 shadow-[0_28px_80px_rgba(16,33,20,0.22)] sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-moss-200">{eyebrow}</p>
          <h1 className="mt-3 text-balance font-serif text-3xl font-extrabold leading-tight text-cream-100 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-cream-100/72">{description}</p>
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </section>
  );
}

export function HeroMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-[76px] rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-moss-200">{label}</div>
      <div className="mt-1 font-serif text-2xl font-extrabold leading-none text-white">{value}</div>
    </div>
  );
}

export function MetricCard({ label, value, accent = "#2f6b46", wide = false }: MetricCardProps) {
  return (
    <article
      className={`rounded-[20px] border border-[#dfe7d7] bg-[#fffefa] p-4 shadow-[0_18px_48px_rgba(26,45,29,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_58px_rgba(26,45,29,0.1)] ${wide ? "sm:col-span-2" : ""}`}
    >
      <div className="mb-3 h-1 w-10 rounded-full" style={{ background: accent }} />
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-forest-700/70">{label}</p>
      <p className="mt-2 font-serif text-3xl font-extrabold leading-none text-forest-950">{value}</p>
    </article>
  );
}

export function Panel({ eyebrow, title, action, children, className = "" }: PanelProps) {
  return (
    <section className={`rounded-[24px] border border-[#dfe7d7] bg-[#fffefa]/92 shadow-[0_18px_50px_rgba(26,45,29,0.07)] backdrop-blur ${className}`}>
      {(eyebrow || title || action) && (
        <div className="flex flex-col gap-3 border-b border-[#e7ecdf] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            {eyebrow && <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-forest-700/64">{eyebrow}</p>}
            {title && <h2 className="mt-1 font-serif text-2xl font-extrabold leading-tight text-forest-950">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function ProgressBar({ value, color = "#2f6b46" }: { value: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#e8eee1]">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

export function Pill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={
        active
          ? "rounded-full bg-forest-950 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-cream-100"
          : "rounded-full border border-[#dce6d8] bg-[#f4f7ef] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-forest-700"
      }
    >
      {children}
    </span>
  );
}

export const buttonBase =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-extrabold uppercase tracking-[0.1em] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55";

export const primaryButton =
  `${buttonBase} bg-forest-950 text-cream-100 shadow-[0_16px_36px_rgba(16,33,20,0.2)] hover:-translate-y-0.5 hover:bg-forest-800`;

export const secondaryButton =
  `${buttonBase} border border-[#d6e0d0] bg-[#fffefa] text-forest-900 hover:-translate-y-0.5 hover:border-forest-400 hover:bg-[#f4f7ef]`;

export const dangerButton =
  `${buttonBase} border border-rose-200 bg-rose-50 text-rose-700 hover:-translate-y-0.5 hover:bg-rose-100`;

export const inputClass =
  "w-full rounded-2xl border border-[#d8e1d2] bg-[#fbfcf7] px-4 py-3 text-sm font-semibold text-forest-950 outline-none placeholder:text-forest-500/55 focus:border-forest-600 focus:bg-white focus:shadow-[0_0_0_4px_rgba(47,107,70,0.12)]";
