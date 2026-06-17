"use client";

import { useAuth } from "@/lib/useAuth";
import { ThemeProvider } from "@/lib/useTheme";
import { Sidebar } from "@/components/sidebar";
import Image from "next/image";

export default function GameLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bg-page, linear-gradient(135deg,#e8eee0,#faf8f0,#e2ebda))" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="logo-breathe relative h-16 w-16 overflow-hidden rounded-3xl bg-white shadow-[0_18px_38px_rgba(16,33,20,0.16)]">
            <Image src="/images/logo.png" alt="EcoLudus" fill sizes="64px" className="object-cover" priority />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted, #5f7c52)" }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      {/* Sidebar (desktop: fixed left; mobile: top bar + bottom nav) */}
      <Sidebar user={user} profile={profile} />

      {/* Main scroll area */}
      <div className="app-main-bg min-h-screen">
        <main
          className="mx-auto px-4 sm:px-6 pt-[60px] pb-[80px] md:ml-[220px] md:pt-8 md:pb-10 md:px-8"
          style={{ maxWidth: "calc(100vw - 0px)" }}
        >
          <div className="max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
