// @ts-nocheck
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logOut } from "@/public/js/auth.js";
import { getBadgeImageForLevel, getBadgeNameForLevel } from "@/public/js/levels.js";
import { dangerButton, secondaryButton } from "@/components/game-ui";

type NavigationBarProps = {
  user: any;
  profile: any;
  refreshProfile: () => void;
};

const navLinks = [
  { name: "Dashboard", href: "/dashboard", mark: "DB" },
  { name: "Team", href: "/team", mark: "TM" },
  { name: "Insights", href: "/insights", mark: "IN" },
  { name: "Shop", href: "/shop", mark: "SH" },
  { name: "Collection", href: "/collection", mark: "CO" },
  { name: "Profile", href: "/profile", mark: "PR" },
  { name: "Leaderboard", href: "/leaderboard", mark: "LB" }
];

export function NavigationBar({ user, profile, refreshProfile }: NavigationBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    if (confirm("Sign out of EcoLudus?")) {
      const res = await logOut();
      if (res.success) router.push("/landing");
    }
  };

  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const ecoPoints = profile?.ecoPoints || 0;
  const badgeImg = getBadgeImageForLevel(level);
  const badgeName = getBadgeNameForLevel(level);

  return (
    <header className="sticky top-3 z-50 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <nav className="flex items-center justify-between rounded-[22px] border border-[#dce6d8] bg-[#fffefa]/92 px-4 py-3 shadow-[0_18px_54px_rgba(16,33,20,0.11)] backdrop-blur-xl">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-3 text-forest-950">
          <div className="relative h-11 w-11 overflow-hidden rounded-3xl bg-white shadow-[0_14px_34px_rgba(16,33,20,0.18)]">
            <Image src="/images/logo.png" alt="EcoLudus logo" fill className="object-cover" priority />
          </div>
          <div className="hidden sm:block">
            <div className="font-serif text-xl font-extrabold leading-none">EcoLudus</div>
            <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.24em] text-forest-700/70">Forest Edition</div>
          </div>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-[13px] font-extrabold transition ${
                  isActive
                    ? "bg-forest-950 text-cream-100 shadow-[0_12px_24px_rgba(16,33,20,0.16)]"
                    : "text-forest-700 hover:bg-forest-100 hover:text-forest-950"
                }`}
              >
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${isActive ? "bg-white/12" : "bg-forest-200/70"}`}>
                  {link.mark}
                </span>
                {link.name}
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {profile && (
            <div className="hidden items-center gap-3 rounded-2xl border border-[#dce6d8] bg-[#f4f7ef] px-3 py-2 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                <Image src={badgeImg} alt={badgeName} width={28} height={28} className="object-contain" />
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-forest-600">Lvl {level}</div>
                <div className="text-xs font-extrabold leading-none text-forest-950">{xp.toLocaleString()} XP</div>
              </div>
              <div className="h-6 w-px bg-[#d6e0d0]" />
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-forest-600">Eco</div>
                <div className="text-xs font-extrabold leading-none text-forest-800">{ecoPoints.toLocaleString()}</div>
              </div>
            </div>
          )}

          <button onClick={handleLogout} className={`hidden md:inline-flex ${secondaryButton}`}>
            Sign Out
          </button>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#dce6d8] bg-[#f4f7ef] text-sm font-extrabold text-forest-950 transition hover:bg-white lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? "X" : "M"}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="mt-2 rounded-[22px] border border-[#dce6d8] bg-[#fffefa] p-4 shadow-[0_18px_54px_rgba(16,33,20,0.14)] lg:hidden">
          {profile && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[#dce6d8] bg-[#f4f7ef] p-3">
              <Image src={badgeImg} alt={badgeName} width={40} height={40} className="h-10 w-10 rounded-xl bg-white p-1 shadow-sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-extrabold text-forest-950">{badgeName} Badge, Level {level}</div>
                <div className="text-[11px] font-semibold text-forest-700">{xp.toLocaleString()} XP, {ecoPoints.toLocaleString()} Eco</div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                    isActive ? "bg-forest-950 text-cream-100" : "text-forest-800 hover:bg-forest-100"
                  }`}
                >
                  <span>{link.name}</span>
                  <span className={isActive ? "text-cream-100/70" : "text-forest-500"}>{link.mark}</span>
                </Link>
              );
            })}
            <div className="my-2 h-px bg-[#e7ecdf]" />
            <button
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              className={`w-full ${dangerButton}`}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
