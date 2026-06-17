"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logOut } from "@/public/js/auth.js";
import { getBadgeImageForLevel, getBadgeNameForLevel } from "@/public/js/levels.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SidebarProps = { user: any; profile: any };

type NavItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  },
  {
    name: "Team",
    href: "/team",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M12 12a4 4 0 100-8 4 4 0 000 8zm6 8v-2a4 4 0 00-3-3.87" />
      </svg>
    )
  },
  {
    name: "Habits",
    href: "/habits",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  },
  {
    name: "Insights",
    href: "/insights",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-6a3 3 0 013-3h4V6m4 12v-4m-4 4V9m8 9V4" />
      </svg>
    )
  },
  {
    name: "Leaderboard",
    href: "/leaderboard",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 21V10M12 21V4M16 21v-7" />
      </svg>
    )
  },
  {
    name: "Shop",
    href: "/shop",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    )
  },
  {
    name: "Collection",
    href: "/collection",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
      </svg>
    )
  },
  {
    name: "Profile",
    href: "/profile",
    icon: (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
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
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
];

// ── Mobile bottom nav items (only the most important) ────────
const mobileNavItems = navItems.slice(0, 5);

function SidebarContent({ pathname, onNavigate, user, profile, onLogout }: {
  pathname: string;
  onNavigate?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
  onLogout: () => void;
}) {
  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const ecoPoints = profile?.ecoPoints || 0;
  const displayName = profile?.displayName || user?.email?.split("@")[0] || "Explorer";
  const badgeImg = getBadgeImageForLevel(level);
  const badgeName = getBadgeNameForLevel(level);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white/10">
          <Image src="/images/logo.png" alt="EcoLudus" fill className="object-cover" priority sizes="36px" />
        </div>
        <div>
          <div className="font-serif text-base font-extrabold leading-none" style={{ color: "var(--text-sidebar)" }}>EcoLudus</div>
          <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: "var(--text-sidebar-muted)" }}>Forest Edition</div>
        </div>
      </div>

      {/* User profile chip */}
      {profile && (
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--sidebar-active-bg)" }}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
            <Image src={badgeImg} alt={badgeName} width={22} height={22} className="object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-extrabold" style={{ color: "var(--text-sidebar)" }}>{displayName}</p>
            <p className="text-[9px] font-bold" style={{ color: "var(--text-sidebar-muted)" }}>Lv {level} · {xp.toLocaleString()} XP</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase" style={{ color: "var(--text-sidebar-muted)" }}>Eco</p>
            <p className="text-[11px] font-extrabold" style={{ color: "var(--text-sidebar)" }}>{ecoPoints.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mx-3 mb-2 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />

      {/* Main nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2" aria-label="Main navigation">
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
              <span style={{ color: isActive ? "var(--text-sidebar)" : "var(--text-sidebar-muted)" }}>{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="mt-auto px-2 pb-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
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
              <span style={{ color: isActive ? "var(--text-sidebar)" : "var(--text-sidebar-muted)" }}>{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
        <button
          onClick={onLogout}
          className="t-sidebar-link w-full text-left"
          style={{ color: "rgba(239,68,68,0.7)" }}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
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
      {/* ── Desktop sidebar (≥768px) ────────────────────────── */}
      <aside
        className="t-sidebar hidden md:flex md:flex-col fixed left-0 top-0 z-40 h-full w-[220px] shrink-0"
        aria-label="Sidebar navigation"
      >
        <SidebarContent
          pathname={pathname}
          user={user}
          profile={profile}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────── */}
      <header className="md:hidden fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-4 py-3 t-sidebar">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-white/10">
            <Image src="/images/logo.png" alt="EcoLudus" fill className="object-cover" sizes="32px" />
          </div>
          <span className="font-serif text-base font-extrabold" style={{ color: "var(--text-sidebar)" }}>EcoLudus</span>
        </Link>

        {/* Right: user level chip + hamburger */}
        <div className="flex items-center gap-2">
          {profile && (
            <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: "var(--sidebar-active-bg)" }}>
              <Image
                src={getBadgeImageForLevel(profile.level || 1)}
                alt=""
                width={16}
                height={16}
                className="object-contain"
              />
              <span className="text-[11px] font-extrabold" style={{ color: "var(--text-sidebar)" }}>
                Lv {profile.level || 1}
              </span>
            </div>
          )}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "var(--sidebar-active-bg)", color: "var(--text-sidebar)" }}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Mobile slide-in drawer ──────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/50 fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="md:hidden t-sidebar fixed left-0 top-0 z-50 h-full w-[260px] sheet-slide overflow-y-auto">
            <div className="flex justify-end p-3">
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
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

      {/* ── Mobile bottom nav bar ───────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2"
        style={{ background: "var(--bg-sidebar)", borderTop: "1px solid rgba(255,255,255,0.08)" }}
        aria-label="Mobile bottom navigation"
      >
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition"
              style={{
                color: isActive ? "var(--text-sidebar)" : "var(--text-sidebar-muted)",
                background: isActive ? "var(--sidebar-active-bg)" : "transparent"
              }}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon}
              <span className="text-[9px] font-extrabold uppercase tracking-wide">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
