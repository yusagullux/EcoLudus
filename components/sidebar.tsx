"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logOut } from "@/public/js/auth.js";
import { getBadgeImageForLevel, getBadgeNameForLevel } from "@/public/js/levels.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SidebarProps = { user: any; profile: any };

type NavItem = { name: string; href: string; icon: React.ReactNode };

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  },
  {
    name: "Team",
    href: "/team",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M12 12a4 4 0 100-8 4 4 0 000 8zm6 8v-2a4 4 0 00-3-3.87" />
      </svg>
    )
  },
  {
    name: "Habits",
    href: "/habits",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  },
  {
    name: "Insights",
    href: "/insights",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-6a3 3 0 013-3h4V6m4 12v-4m-4 4V9m8 9V4" />
      </svg>
    )
  },
  {
    name: "Leaderboard",
    href: "/leaderboard",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 21V10M12 21V4M16 21v-7" />
      </svg>
    )
  },
  {
    name: "Shop",
    href: "/shop",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    )
  },
  {
    name: "Collection",
    href: "/collection",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    )
  },
  {
    name: "Pets",
    href: "/pets",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12.5c-1.2 0-2-1-2-2.2S5.8 8 7 8s2 1 2 2.3-.8 2.2-2 2.2Zm10 0c-1.2 0-2-1-2-2.2S15.8 8 17 8s2 1 2 2.3-.8 2.2-2 2.2ZM9.5 17.5c0-1.9 1.2-3.5 2.5-3.5s2.5 1.6 2.5 3.5c0 1.1-.8 1.8-2.5 1.8s-2.5-.7-2.5-1.8ZM9 5.5c0 1.1-.7 2-1.6 2s-1.6-.9-1.6-2 .7-2 1.6-2S9 4.4 9 5.5Zm9.2 0c0 1.1-.7 2-1.6 2s-1.6-.9-1.6-2 .7-2 1.6-2 1.6.9 1.6 2Z" />
      </svg>
    )
  },
  {
    name: "Friends",
    href: "/friends",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11a3 3 0 100-6 3 3 0 000 6Zm8 0a3 3 0 100-6 3 3 0 000 6ZM3.5 20a4.5 4.5 0 019 0M11.5 20a4.5 4.5 0 019 0" />
      </svg>
    )
  },
  {
    name: "Garden",
    href: "/garden",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22V12m0 0C12 7 8 4 4 5c0 4 3 7 8 7zm0 0c0-5 4-8 8-7-1 4-4 7-8 7z" />
      </svg>
    )
  },
  {
    name: "EcoMap",
    href: "/ecomap",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6 3m0 7l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 10m0 10V10" />
      </svg>
    )
  },
  {
    name: "Profile",
    href: "/profile",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  }
];

const bottomItems: NavItem[] = [
  {
    name: "Settings",
    href: "/settings",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
];

function SidebarContent({ pathname, onNavigate, user, profile, onLogout }: {
  pathname: string;
  onNavigate?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
  onLogout: () => void;
}) {
  const level = Number(profile?.level) || 1;
  const xp = Number(profile?.xp) || 0;
  const ecoPoints = Number(profile?.ecoPoints) || 0;
  const displayName = String(profile?.displayName || user?.email?.split("@")[0] || "Explorer");
  const badgeImg = getBadgeImageForLevel(level);
  const badgeName = getBadgeNameForLevel(level);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 py-5 shrink-0">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-white/10">
          <Image src="/images/logo.png" alt="EcoLudus" fill className="object-cover" priority sizes="32px" />
        </div>
        <div>
          <div className="font-serif text-[15px] font-extrabold leading-none tracking-wide" style={{ color: "var(--text-sidebar)" }}>EcoLudus</div>
          <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.28em]" style={{ color: "var(--text-sidebar-muted)" }}>Forest Edition</div>
        </div>
      </div>

      {/* ── User chip ── */}
      {profile && (
        <div className="mx-3 mb-4 shrink-0">
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "var(--sidebar-active-bg)" }}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <Image src={badgeImg} alt={badgeName} width={18} height={18} className="object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold leading-tight" style={{ color: "var(--text-sidebar)" }}>{displayName}</p>
              <p className="text-[9px]" style={{ color: "var(--text-sidebar-muted)" }}>Lv {level} · {xp.toLocaleString()} XP</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-4 mb-3 h-px shrink-0" style={{ background: "rgba(255,255,255,0.06)" }} />

      {/* ── Main nav ── */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`t-sidebar-link${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="shrink-0" style={{ color: isActive ? "var(--text-sidebar)" : "var(--text-sidebar-muted)" }}>
                {item.icon}
              </span>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom section ── */}
      <div className="shrink-0 px-3 pb-4 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {/* EcoPoints quick stat */}
        {profile && (
          <div className="mb-2 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            <span className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-sidebar-muted)" }}>EcoPoints</span>
            <span className="text-[12px] font-extrabold" style={{ color: "var(--text-sidebar)" }}>{ecoPoints.toLocaleString()}</span>
          </div>
        )}
        {bottomItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`t-sidebar-link${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="shrink-0" style={{ color: isActive ? "var(--text-sidebar)" : "var(--text-sidebar-muted)" }}>
                {item.icon}
              </span>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={onLogout}
          className="t-sidebar-link w-full text-left mt-0.5"
          style={{ color: "rgba(239,68,68,0.65)" }}
        >
          <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="truncate">Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ user, profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    if (confirm("Sign out of EcoLudus?")) {
      const res = await logOut();
      if (res.success) router.push("/landing");
    }
  };

  return (
    <>
      {/* ── Desktop sidebar (≥768px) ── */}
      <aside
        className="t-sidebar hidden md:flex md:flex-col fixed left-0 top-0 z-40 h-full w-[240px] shrink-0"
        aria-label="Sidebar navigation"
      >
        <SidebarContent
          pathname={pathname}
          user={user}
          profile={profile}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile top bar ── */}
      <header
        className="md:hidden fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-4 py-3 t-sidebar"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link href="/dashboard" className="flex min-h-11 items-center gap-2.5">
          <div className="relative h-8 w-8 overflow-hidden rounded-xl bg-white/10">
            <Image src="/images/logo.png" alt="EcoLudus" fill className="object-cover" sizes="32px" />
          </div>
          <div>
            <span className="font-serif text-[15px] font-extrabold leading-none" style={{ color: "var(--text-sidebar)" }}>EcoLudus</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {profile && (
            <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: "var(--sidebar-active-bg)" }}>
              <Image src={getBadgeImageForLevel(Number(profile.level) || 1)} alt="" width={14} height={14} className="object-contain" />
              <span className="text-[11px] font-bold" style={{ color: "var(--text-sidebar)" }}>
                Lv {Number(profile.level) || 1}
              </span>
            </div>
          )}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: "var(--sidebar-active-bg)", color: "var(--text-sidebar)" }}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/60 fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            className="md:hidden t-sidebar fixed left-0 top-0 z-50 h-full w-[280px] overflow-y-auto sheet-slide"
            style={{ boxShadow: "4px 0 32px rgba(0,0,0,0.4)" }}
          >
            <div className="flex justify-end p-3">
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: "var(--sidebar-active-bg)", color: "var(--text-sidebar)" }}
                aria-label="Close menu"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              user={user}
              profile={profile}
              onLogout={() => { setMobileOpen(false); handleLogout(); }}
            />
          </div>
        </>
      )}
      {/* NOTE: Mobile bottom nav removed — use hamburger menu instead */}
    </>
  );
}
