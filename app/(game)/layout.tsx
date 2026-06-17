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

      {/* Main scroll area — offset for sidebar on desktop, top+bottom bar on mobile */}
      <div
        className="min-h-screen transition-colors duration-300"
        style={{ background: "var(--bg-page)" }}
      >
        <main
          className={[
            "mx-auto w-full max-w-4xl px-4 sm:px-6",
            /* mobile: below top bar (52px) + above bottom nav (64px) */
            "pt-[64px] pb-[80px]",
            /* desktop: left sidebar (220px), no extra bottom padding */
            "md:ml-[220px] md:pt-8 md:pb-10 md:max-w-none",
          ].join(" ")}
        >
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
