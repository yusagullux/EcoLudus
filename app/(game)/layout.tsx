"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { ThemeProvider } from "@/lib/useTheme";
import { ToastProvider } from "@/lib/toast";
import { Sidebar } from "@/components/sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { PageTransition } from "@/lib/animations";
import { HeroSkeleton, MetricGridSkeleton, PanelSkeleton } from "@/components/ui/skeleton";

export default function GameLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile, loading, emailVerified } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  if (loading) {
    // Skeleton shell that mirrors the authenticated layout (mobile top bar +
    // desktop sidebar + content area) so the first paint reserves the same
    // space as the real app — no centered spinner, no layout shift once
    // useAuth resolves. Shared token-based skeletons keep it coherent across
    // all six themes.
    return (
      <div className="app-main-bg min-h-screen" aria-busy="true" role="status" aria-live="polite">
        <span className="sr-only">Loading EcoLudus…</span>

        {/* Mobile top bar skeleton */}
        <div className="t-sidebar flex h-[56px] items-center gap-3 px-4 md:hidden" />

        {/* Desktop sidebar skeleton */}
        <div className="t-sidebar fixed inset-y-0 left-0 hidden w-[240px] flex-col gap-2 p-4 md:flex">
          {/* Same white-mix tint as the real sidebar's hover tint — black/10
              vanishes on the always-dark --bg-sidebar surface. */}
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-white/10" />
          <div className="mt-4 flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 w-full animate-pulse rounded-card bg-white/10" />
            ))}
          </div>
        </div>

        {/* Mobile bottom-nav skeleton (clearance reservation) */}
        <div
          className="t-sidebar fixed bottom-0 left-0 right-0 z-40 md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-stretch justify-around gap-2 px-1 pt-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="h-8 w-8 animate-pulse rounded-lg bg-white/10" />
                <div className="mb-1 h-2 w-8 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>

        {/* Content skeleton */}
        <main className="pt-14 pb-[calc(5rem+env(safe-area-inset-bottom))] px-4 sm:px-5 md:ml-[240px] md:pt-7 md:pb-8 md:px-8">
          <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
            <HeroSkeleton chips={5} />
            <MetricGridSkeleton count={4} cols="grid-cols-2 lg:grid-cols-4" />
            <PanelSkeleton rows={4} />
          </div>
        </main>
      </div>
    );
  }

  // Unverified users get a persistent banner; `main` lets the banner own the
  // top-bar clearance whenever it's visible.
  const showBanner = Boolean(user) && !emailVerified && !bannerDismissed;

  return (
    <ThemeProvider>
      <ToastProvider>
        <Sidebar user={user} profile={profile} />
        <BottomNav />

        {/* ── Page wrapper ── */}
        <div className="app-main-bg min-h-screen">
          {showBanner && (
            <div
              role="status"
              className="mt-14 flex items-center justify-between gap-3 border-b border-line bg-surface-alt px-4 py-3 text-ink-soft sm:px-5 md:ml-[240px] md:px-8 md:mt-0"
            >
              <p className="text-sm font-semibold">
                Please verify your email to unlock quests and rewards.{" "}
                <Link
                  href="/resend-verification"
                  className="-my-2 inline-block py-2 font-bold text-accent underline underline-offset-2"
                >
                  Resend verification email
                </Link>
              </p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setBannerDismissed(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm transition hover:opacity-70 active:scale-95"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          )}
          <main
            className={[
              /* Mobile: the banner owns the top-bar clearance when it shows,
                 otherwise main clears the 56px fixed bar itself */
              `min-w-0 ${showBanner ? "pt-0" : "pt-14"} pb-[calc(5rem+env(safe-area-inset-bottom))] px-4 sm:px-5`,
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
