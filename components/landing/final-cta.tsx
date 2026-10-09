import Link from "next/link";
import { SectionShell } from "./primitives";

/**
 * Final CTA band: the compact dark-forest container — the same ink gradient
 * as the .mk-hero surface (no blur), light sidebar text, a static scatter of
 * firefly dots (restraint over animation), the brand loop headline and the
 * two closing links. Pure server component.
 */

const FIREFLIES: Array<{ top: string; left: string; size: number; mix: number; gold?: boolean }> = [
  { top: "20%", left: "11%", size: 6, mix: 75 },
  { top: "16%", left: "25%", size: 4, mix: 45 },
  { top: "66%", left: "8%", size: 5, mix: 60 },
  { top: "60%", left: "89%", size: 6, mix: 70, gold: true },
  { top: "32%", left: "91%", size: 4, mix: 50 },
  { top: "80%", left: "74%", size: 4, mix: 40, gold: true }
];

export function FinalCta() {
  return (
    <SectionShell className="mt-6">
      <div
        className="relative overflow-hidden rounded-dialog px-6 py-14 text-center shadow-elev-2 sm:px-12 sm:py-16"
        style={{
          background:
            "linear-gradient(135deg, var(--bg-sidebar) 0%, color-mix(in srgb, var(--text-accent) 35%, var(--bg-sidebar)) 100%)"
        }}
      >
        {/* fireflies — a static scatter at varying brightness */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          {FIREFLIES.map((fly, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                top: fly.top,
                left: fly.left,
                width: fly.size,
                height: fly.size,
                background: `color-mix(in srgb, ${fly.gold ? "var(--accent-gold)" : "var(--text-accent)"} ${fly.mix}%, transparent)`,
                boxShadow: `0 0 ${fly.size * 2}px color-mix(in srgb, ${fly.gold ? "var(--accent-gold)" : "var(--text-accent)"} 40%, transparent)`
              }}
            />
          ))}
        </span>

        <h2
          className="relative font-serif text-5xl font-bold leading-tight tracking-tight"
          style={{ color: "var(--text-sidebar)" }}
        >
          Play. Protect. Grow.
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-sm leading-6 sm:text-base" style={{ color: "var(--text-sidebar-muted)" }}>
          Your garden is waiting — start a daily ritual of small actions that add up.
        </p>

        <div className="relative mt-9 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            style={{
              background: "var(--text-sidebar)",
              color: "var(--bg-sidebar)",
              boxShadow: "var(--shadow-lift)"
            }}
          >
            Start your garden
          </Link>
          <Link
            href="/login"
            className="inline-block -my-1 py-1 text-sm font-semibold underline-offset-4 hover:underline"
            style={{ color: "var(--text-sidebar-muted)" }}
          >
            Already playing? Sign in
          </Link>
        </div>
      </div>
    </SectionShell>
  );
}