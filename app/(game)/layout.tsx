"use client";

import { useAuth } from "@/lib/useAuth";
import { ThemeProvider } from "@/lib/useTheme";
import { ToastProvider } from "@/lib/toast";
import { Sidebar } from "@/components/sidebar";
import { PageTransition } from "@/lib/animations";

export default function GameLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    // Skeleton shell that mirrors the authenticated layout (mobile top bar +
    // desktop sidebar + content area) so the first paint reserves the same
    // space as the real app — no centered spinner, no layout shift once
    // useAuth resolves. Theme CSS vars keep it coherent across all palettes.
    return (
      <div className="app-main-bg min-h-screen" aria-busy="true" role="status" aria-live="polite">
        <span className="sr-only">Loading EcoLudus…</span>

        {/* Mobile top bar skeleton */}
        <div
          className="flex h-[56px] items-center gap-3 px-4 md:hidden"
          style={{ background: "var(--bg-sidebar, #1c2e21)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="h-8 w-8 animate-pulse rounded-lg bg-white/15" />
          <div className="h-3 w-24 animate-pulse rounded bg-white/15" />
        </div>

        {/* Desktop sidebar skeleton */}
        <div
          className="fixed inset-y-0 left-0 hidden w-[240px] flex-col gap-2 p-4 md:flex"
          style={{ background: "var(--bg-sidebar, #1c2e21)" }}
        >
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-white/15" />
          <div className="mt-4 flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-white/10" />
            ))}
          </div>
        </div>

        {/* Content skeleton */}
        <main className="pt-[56px] pb-6 px-4 sm:px-5 md:ml-[240px] md:pt-7 md:pb-8 md:px-8">
          <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
            {/* Hero skeleton */}
            <div className="rounded-[22px] p-6 sm:p-8" style={{ background: "var(--bg-hero)" }}>
              <div className="h-3 w-24 animate-pulse rounded-full bg-white/25" />
              <div className="mt-4 h-8 w-2/3 animate-pulse rounded-lg bg-white/25" />
              <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded bg-white/15" />
              <div className="mt-5 flex flex-wrap gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 w-20 animate-pulse rounded-xl bg-white/15" />
                ))}
              </div>
            </div>
            {/* Metric grid skeleton */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
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
            {/* Panel skeleton */}
            <div
              className="rounded-[18px] p-6"
              style={{ background: "var(--bg-panel)", border: "1px solid var(--border-subtle)" }}
            >
              <div className="h-4 w-32 animate-pulse rounded bg-[var(--bg-panel-alt)]" />
              <div className="mt-5 flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-[var(--bg-panel-alt)]" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <Sidebar user={user} profile={profile} />

        {/* ── Page wrapper ── */}
        <div className="app-main-bg min-h-screen">
          <main
            className={[
              /* Mobile: offset below top bar only (no bottom nav) */
              "min-w-0 pt-[56px] pb-6 px-4 sm:px-5",
              /* Desktop: offset for 240px sidebar, full available width */
              "md:ml-[240px] md:pt-7 md:pb-8 md:px-8",
            ].join(" ")}
          >
            {/* Content width: fills available space with a comfortable max */}
            <div className="mx-auto min-w-0 w-full max-w-[1100px]">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
