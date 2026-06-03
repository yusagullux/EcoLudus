// @ts-nocheck
"use client";

import { useAuth } from "@/lib/useAuth";
import { NavigationBar } from "@/components/navigation-bar";

export default function GameLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile, refreshProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#e8eee0_0%,#faf8f0_48%,#e2ebda_100%)]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-forest-950 text-2xl font-bold text-cream-100 shadow-lg">
            E
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-forest-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#e8eee0_0%,#faf8f0_48%,#e2ebda_100%)] pb-16 pt-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(16,32,22,0.08),transparent)]" />
      <NavigationBar user={user} profile={profile} refreshProfile={refreshProfile} />
      <main className="relative z-10 mx-auto mt-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
