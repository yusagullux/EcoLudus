// @ts-nocheck
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logOut } from "@/public/js/auth.js";
import { getBadgeImageForLevel, getBadgeNameForLevel } from "@/public/js/levels.js";

type NavigationBarProps = {
  user: any;
  profile: any;
  refreshProfile: () => void;
};

export function NavigationBar({ user, profile, refreshProfile }: NavigationBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: "📋" },
    { name: "Team", href: "/team", icon: "👥" },
    { name: "Insights", href: "/insights", icon: "📊" },
    { name: "Shop", href: "/shop", icon: "🛒" },
    { name: "Collection", href: "/collection", icon: "📚" },
    { name: "Profile", href: "/profile", icon: "👤" },
    { name: "Leaderboard", href: "/leaderboard", icon: "🏆" }
  ];

  const handleLogout = async () => {
    if (confirm("Are you sure you want to sign out from your forest journey?")) {
      const res = await logOut();
      if (res.success) {
        router.push("/landing");
      }
    }
  };

  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const ecoPoints = profile?.ecoPoints || 0;
  const badgeImg = getBadgeImageForLevel(level);
  const badgeName = getBadgeNameForLevel(level);

  return (
    <header className="sticky top-4 z-50 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <nav className="flex items-center justify-between rounded-3xl border border-forest-900/10 bg-white/80 px-6 py-4 shadow-[0_20px_54px_rgba(16,33,20,0.08)] backdrop-blur-xl">
        {/* Brand/Logo */}
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-900 text-lg font-semibold text-cream-100 shadow-[0_12px_24px_rgba(16,33,20,0.18)] hover:scale-105 transition-transform">
            E
          </div>
          <div>
            <div className="font-serif text-xl font-bold tracking-wide text-forest-950">EcoLudus</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-forest-700/70">Forest Edition</div>
          </div>
        </Link>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2.5 rounded-full text-sm font-semibold tracking-wide transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-forest-800 to-forest-700 text-cream-100 shadow-[0_8px_16px_rgba(22,48,29,0.15)]"
                    : "text-forest-900/80 hover:text-forest-950 hover:bg-forest-900/5"
                }`}
              >
                <span className="mr-1.5">{link.icon}</span>
                {link.name}
              </Link>
            );
          })}
        </div>

        {/* Mini Stats Bar (Desktop) */}
        {profile && (
          <div className="hidden md:flex items-center gap-3 rounded-full border border-forest-900/8 bg-forest-100/50 p-1.5 pr-4 shadow-inner">
            <div className="relative group flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
              <img src={badgeImg} alt={badgeName} className="h-7 w-7 object-contain group-hover:scale-110 transition-transform" />
              {/* Tooltip */}
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-forest-900 px-2 py-1 text-[10px] text-cream-100 opacity-0 transition-opacity group-hover:opacity-100 shadow-lg">
                {badgeName} Badge
              </span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700">Lvl {level}</span>
              <span className="text-xs font-extrabold text-forest-950">{xp.toLocaleString()} XP</span>
            </div>
            <div className="h-6 w-px bg-forest-900/10" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700">EcoPoints</span>
              <span className="text-xs font-extrabold text-moss-600">💰 {ecoPoints.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Action Button & Menu Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="hidden md:inline-flex items-center justify-center rounded-full border border-forest-900/12 bg-white/90 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-forest-900 shadow-sm hover:bg-white hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer"
          >
            Sign Out
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-forest-900/5 hover:bg-forest-900/10 text-forest-950 transition-colors"
            aria-label="Toggle Menu"
          >
            <span className="text-xl">{mobileOpen ? "✕" : "☰"}</span>
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden mt-2 rounded-3xl border border-forest-900/10 bg-white/95 p-5 shadow-[0_24px_50px_rgba(16,33,20,0.12)] backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200">
          {/* Mini Stats Bar (Mobile) */}
          {profile && (
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-forest-900/8 bg-forest-100/40 p-3 mb-4 text-center">
              <div className="flex flex-col items-center border-r border-forest-900/10">
                <img src={badgeImg} alt={badgeName} className="h-8 w-8 object-contain mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700">{badgeName}</span>
              </div>
              <div className="flex flex-col justify-center border-r border-forest-900/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700">Level {level}</span>
                <span className="text-xs font-extrabold text-forest-950">{xp} XP</span>
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700">EcoPoints</span>
                <span className="text-xs font-extrabold text-moss-600">💰 {ecoPoints}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-forest-800 to-forest-700 text-cream-100"
                      : "text-forest-900/80 hover:text-forest-950 hover:bg-forest-900/5"
                  }`}
                >
                  <span className="text-lg">{link.icon}</span>
                  {link.name}
                </Link>
              );
            })}
            <div className="h-px bg-forest-900/10 my-2" />
            <button
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-rose-700 hover:bg-rose-50 transition-all cursor-pointer"
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
