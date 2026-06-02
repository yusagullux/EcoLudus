// @ts-nocheck
"use client";

import { useAuth } from "@/lib/useAuth";
import { NavigationBar } from "@/components/navigation-bar";

export default function GameLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profile, refreshProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(94,142,101,0.15),transparent_40%),linear-gradient(180deg,#f8f4ec_0%,#eef2e6_100%)] px-4">
        {/* Decorative elements */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_30%,rgba(155,118,83,0.06),transparent_20%)] animate-pulse" />
        
        {/* Loading card */}
        <div className="flex flex-col items-center justify-center rounded-3xl border border-forest-900/10 bg-white/70 px-8 py-10 shadow-[0_24px_50px_rgba(16,33,20,0.06)] backdrop-blur-md">
          {/* RPG spinner */}
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute h-full w-full rounded-full border-4 border-forest-100" />
            <div className="absolute h-full w-full rounded-full border-4 border-forest-900 border-t-transparent animate-spin" />
            <span className="text-xl">🌿</span>
          </div>
          
          <h2 className="mt-6 font-serif text-2xl font-bold tracking-wide text-forest-950">Entering EcoLudus</h2>
          <p className="mt-2 text-sm font-medium text-forest-700/80">Syncing with the forest ecosystem...</p>
        </div>
      </div>
    );
  }

  // Once authenticated, render children
  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,rgba(94,142,101,0.12),transparent_35%),linear-gradient(180deg,#f8f4ec_0%,#eef2e6_48%,#e7edde_100%)] pb-12 pt-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(155,118,83,0.08),transparent_25%)]" />
      <NavigationBar user={user} profile={profile} refreshProfile={refreshProfile} />
      <main className="relative z-10 mx-auto mt-8 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
