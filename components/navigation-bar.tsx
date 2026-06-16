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
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )
  },
  {
    name: "Team",
    href: "/team",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  {
    name: "Habits",
    href: "/habits",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  },
  {
    name: "Insights",
    href: "/insights",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    name: "Shop",
    href: "/shop",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    )
  },
  {
    name: "Collection",
    href: "/collection",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  },
  {
    name: "Profile",
    href: "/profile",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  },
  {
    name: "Leaderboard",
    href: "/leaderboard",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
      </svg>
    )
  },
  {
    name: "Impact",
    href: "/impact",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
      </svg>
    )
  },
  {
    name: "Premium",
    href: "/premium",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    )
  },
  {
    name: "Settings",
    href: "/settings",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
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
    <header className="sticky top-4 z-50 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <nav className="flex items-center justify-between rounded-[24px] border border-[#dce6d8]/80 bg-white/76 px-4 py-3 shadow-[0_20px_50px_rgba(16,33,20,0.08)] backdrop-blur-md">
        
        {/* Logo and Brand */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-3 text-forest-950 group">
          <div className="relative h-11 w-11 overflow-hidden rounded-full bg-white shadow-[0_8px_24px_rgba(16,33,20,0.12)] border border-[#dce6d8]/50 group-hover:scale-105 transition-transform duration-300">
            <Image src="/images/logo.png" alt="EcoLudus logo" fill className="object-cover" priority />
          </div>
          <div className="hidden sm:block">
            <div className="font-serif text-xl font-extrabold leading-none tracking-wide text-forest-950">EcoLudus</div>
            <div className="mt-1 text-[9px] font-black uppercase tracking-[0.28em] text-forest-600">Forest Edition</div>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden items-center gap-1.5 lg:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-forest-950 text-cream-100 shadow-[0_10px_20px_rgba(16,33,20,0.16)]"
                    : "text-forest-800 hover:bg-forest-100/60 hover:text-forest-950"
                }`}
              >
                <span className={`transition-colors duration-200 ${isActive ? "text-moss-300" : "text-forest-500/70"}`}>
                  {link.icon}
                </span>
                {link.name}
              </Link>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex shrink-0 items-center gap-3">
          {profile && (
            <div className="hidden items-center gap-3 rounded-2xl border border-[#dce6d8]/80 bg-[#f4f7ef]/60 px-3 py-1.5 md:flex shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm border border-[#dce6d8]/30">
                <Image src={badgeImg} alt={badgeName} width={24} height={24} className="object-contain" />
              </div>
              <div className="text-left">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-forest-600">Lvl {level}</div>
                <div className="text-[11px] font-extrabold leading-none text-forest-950">{xp.toLocaleString()} XP</div>
              </div>
              <div className="h-5 w-px bg-[#d6e0d0]" />
              <div className="text-left pr-1">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-forest-600">Eco</div>
                <div className="text-[11px] font-extrabold leading-none text-forest-800">{ecoPoints.toLocaleString()}</div>
              </div>
            </div>
          )}

          <button onClick={handleLogout} className={`hidden md:inline-flex ${secondaryButton} !text-xs !py-2.5`}>
            Sign Out
          </button>

          {/* Hamburger Menu Icon */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#dce6d8]/80 bg-[#f4f7ef]/60 text-forest-950 transition hover:bg-white lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer menu */}
      {mobileOpen && (
        <div className="mt-2 rounded-[24px] border border-[#dce6d8]/80 bg-white p-4 shadow-[0_20px_50px_rgba(16,33,20,0.12)] lg:hidden transition-all duration-300">
          {profile && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-[#dce6d8]/80 bg-[#f4f7ef]/60 p-3 shadow-sm">
              <Image src={badgeImg} alt={badgeName} width={36} height={36} className="h-9 w-9 rounded-xl bg-white p-1 shadow-sm border border-[#dce6d8]/30" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-black text-forest-950">{badgeName} Badge, Level {level}</div>
                <div className="text-[10px] font-bold text-forest-700">{xp.toLocaleString()} XP, {ecoPoints.toLocaleString()} EcoPoints</div>
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
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                    isActive ? "bg-forest-950 text-cream-100 shadow-sm" : "text-forest-800 hover:bg-forest-100/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? "text-moss-300" : "text-forest-500"}>{link.icon}</span>
                    <span>{link.name}</span>
                  </div>
                </Link>
              );
            })}
            <div className="my-2 h-px bg-[#e7ecdf]" />
            <button
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              className={`w-full ${dangerButton} !py-3`}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
