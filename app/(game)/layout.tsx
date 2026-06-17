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
          <div className="logo-breathe relative h-14 w-14 overflow-hidden rounded-2xl bg-white shadow-[0_18px_38px_rgba(16,33,20,0.16)]">
            <Image src="/images/logo.png" alt="EcoLudus" fill sizes="56px" className="object-cover" priority />
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
      <Sidebar user={user} profile={profile} />

      {/* ── Page wrapper ── */}
      <div className="app-main-bg min-h-screen">
        <main
          className={[
            /* Mobile: offset below top bar only (no bottom nav) */
            "pt-[56px] pb-6 px-4 sm:px-5",
            /* Desktop: offset for 240px sidebar, full available width */
            "md:ml-[240px] md:pt-7 md:pb-8 md:px-8",
          ].join(" ")}
        >
          {/* Content width: fills available space with a comfortable max */}
          <div className="mx-auto w-full max-w-[1100px]">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
