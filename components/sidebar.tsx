"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ClipboardCheck,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  PawPrint,
  Settings as SettingsIcon,
  ShoppingBag,
  Sprout,
  TrendingUp,
  UserRound,
  CircleUserRound,
  Users,
  UsersRound,
  X as XIcon
} from "lucide-react";
import { logOut } from "@/lib/auth-client";
import { Avatar } from "@/components/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NotificationBell } from "@/components/notification-bell";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

type SidebarProps = { user: any; profile: any };

type NavItem = { name: string; href: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

// Shared sizing for every nav icon — colour comes from the wrapping span
// (active accent mix vs muted sidebar tokens).
const navIcon = (Icon: LucideIcon) => <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />;

// Friendlier active state: a filled rounded tile tinted with the category
// accent, inked with a lime-warmed sidebar text. The nav surface is the
// always-dark `--bg-sidebar` ink in every theme, so this one recipe reads in
// all six palettes (accent fills are theme-independent and never shift hue).
const ACTIVE_STYLE: CSSProperties = {
  background: "color-mix(in srgb, var(--accent-green) 32%, var(--bg-sidebar))",
  color: "color-mix(in srgb, var(--accent-lime) 70%, var(--text-sidebar))"
};
const activeInk = (isActive: boolean): string =>
  isActive
    ? "color-mix(in srgb, var(--accent-lime) 70%, var(--text-sidebar))"
    : "var(--text-sidebar-muted)";

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Home", href: "/dashboard", icon: LayoutGrid },
      { name: "Insights", href: "/insights", icon: TrendingUp },
      { name: "Leaderboard", href: "/leaderboard", icon: Users }
    ]
  },
  {
    label: "Play",
    items: [
      { name: "Habits", href: "/habits", icon: ClipboardCheck },
      { name: "Team", href: "/team", icon: UsersRound }
    ]
  },
  {
    label: "Collection",
    items: [
      { name: "Shop", href: "/shop", icon: ShoppingBag },
      { name: "Collection", href: "/collection", icon: Package },
      { name: "Pets", href: "/pets", icon: PawPrint },
      { name: "Garden", href: "/garden", icon: Sprout }
    ]
  },
  {
    label: "Social",
    items: [
      { name: "Friends", href: "/friends", icon: UserRound },
      { name: "Profile", href: "/profile", icon: CircleUserRound }
    ]
  }
];

const bottomItems: NavItem[] = [
  { name: "Settings", href: "/settings", icon: SettingsIcon }
];

// fg-botlabel-style micro tag for group labels (0.625rem / 700 / uppercase /
// wide tracking) — a quieter voice than the 0.8125rem links, per theme.
function GroupLabel({ children }: { children: string }) {
  return (
    <p
      className="px-3 pb-1.5 pt-3 text-[0.625rem] font-bold uppercase leading-none tracking-[0.14em]"
      style={{ color: "var(--text-sidebar-muted)" }}
    >
      {children}
    </p>
  );
}

function SidebarContent({ pathname, onNavigate, user, profile, onLogout }: {
  pathname: string;
  onNavigate?: () => void;
  user: any;
  profile: any;
  onLogout: () => void;
}) {
  const level = Number(profile?.level) || 1;
  const xp = Number(profile?.xp) || 0;
  const ecoPoints = Number(profile?.ecoPoints) || 0;
  const displayName = String(profile?.displayName || user?.email?.split("@")[0] || "Eco Explorer");
  const profileImage = typeof profile?.profileImage === "string" ? (profile.profileImage as string) : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Logo lockup + notification bell ── */}
      <div className="flex items-center justify-between px-5 py-5 shrink-0">
        <div className="flex items-center gap-3">
          {/* Growth-ring collar on the mark */}
          <div
            className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl"
            style={{ boxShadow: "0 0 0 1.5px color-mix(in srgb, var(--accent-lime) 45%, transparent)" }}
          >
            <Image src="/images/logo.png" alt="EcoLudus" fill className="object-cover" priority sizes="36px" />
          </div>
          <div>
            <div className="font-serif text-[15px] font-extrabold leading-none tracking-wide" style={{ color: "var(--text-sidebar)" }}>EcoLudus</div>
            <div className="mt-1 text-[0.625rem] font-bold leading-none" style={{ color: "var(--text-sidebar-muted)" }}>Living garden</div>
          </div>
        </div>
        {/* The mobile top bar carries its own bell — skip it in the drawer
            so the open drawer doesn't show two bells at once. */}
        <div className="hidden md:block">
          <NotificationBell />
        </div>
      </div>

      {/* ── User chip — small card with the level-ring look ── */}
      {profile && (
        <div className="mx-3 mb-4 shrink-0">
          <div
            className="rounded-xl px-3 py-3"
            style={{
              background: "color-mix(in srgb, var(--accent-green) 16%, var(--bg-sidebar))",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent-lime) 30%, transparent)"
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar
                name={displayName}
                src={profileImage}
                size={34}
                className="shrink-0"
                style={{ boxShadow: "0 0 0 2px var(--bg-sidebar), 0 0 0 3.5px color-mix(in srgb, var(--accent-lime) 55%, transparent)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-extrabold leading-tight" style={{ color: "var(--text-sidebar)" }} title={displayName}>{displayName}</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight" style={{ color: "var(--text-sidebar-muted)" }}>
                  Lv {level} · {xp.toLocaleString()} XP
                </p>
              </div>
            </div>
            {/* EcoPoints quick stat, folded into the card */}
            <div
              className="mt-2.5 flex items-center justify-between pt-2.5"
              style={{ borderTop: "1px dashed color-mix(in srgb, var(--text-sidebar) 14%, transparent)" }}
            >
              <span className="text-[0.625rem] font-bold uppercase leading-none tracking-[0.14em]" style={{ color: "var(--text-sidebar-muted)" }}>EcoPoints</span>
              <span className="text-[12px] font-extrabold" style={{ color: "var(--text-sidebar)" }}>{ecoPoints.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {!profile && <div className="mx-4 mb-3 h-px shrink-0" style={{ background: "color-mix(in srgb, var(--text-sidebar) 6%, transparent)" }} />}

      {/* ── Main nav ── */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-2" aria-label="Main navigation">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            <GroupLabel>{group.label}</GroupLabel>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                // Same two-step match as the bottom nav so sub-routes keep
                // the parent link highlighted in both shells.
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`t-sidebar-link${isActive ? " active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    style={isActive ? ACTIVE_STYLE : undefined}
                  >
                    <span className="shrink-0" style={{ color: activeInk(isActive) }}>
                      {navIcon(item.icon)}
                    </span>
                    <span className="flex-1 truncate">{item.name}</span>
                    {item.name === "Friends" && (
                      (() => {
                        const requestsCount = Array.isArray(profile?.friendRequests)
                          ? profile.friendRequests.length
                          : 0;
                        return requestsCount > 0 ? (
                          <span className="rounded-full px-1.5 py-0.5 text-micro leading-none shrink-0" style={{ background: "var(--text-accent)", color: "var(--text-inverse)" }}>
                            {requestsCount}
                          </span>
                        ) : null;
                      })()
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom section ── */}
      <div className="shrink-0 px-3 pb-4 pt-2" style={{ borderTop: "1px solid color-mix(in srgb, var(--text-sidebar) 6%, transparent)" }}>
        {bottomItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`t-sidebar-link${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              style={isActive ? ACTIVE_STYLE : undefined}
            >
              <span className="shrink-0" style={{ color: activeInk(isActive) }}>
                {navIcon(item.icon)}
              </span>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onLogout}
          className="t-sidebar-link w-full text-left mt-0.5"
          style={{ color: "color-mix(in srgb, var(--text-error) 65%, transparent)" }}
        >
          {navIcon(LogOut)}
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
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Mobile drawer a11y: Escape to close, focus trap, body scroll lock, focus
  // restore — mirrors the shared Dialog component so the drawer isn't a step
  // down in keyboard/screen-reader behaviour.
  useEffect(() => {
    if (!mobileOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
    focusables()[0]?.focus({ preventScroll: true });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMobileOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) {
        e.preventDefault();
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !drawer.contains(active))) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (active === last || !drawer.contains(active))) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [mobileOpen]);

  const [logoutOpen, setLogoutOpen] = useState(false);

  // Open the in-app confirmation instead of the blocking native confirm().
  const handleLogout = () => {
    setLogoutOpen(true);
  };

  const confirmLogout = async () => {
    const res = await logOut();
    if (res.success) router.push("/");
    setLogoutOpen(false);
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

      {/* ── Mobile top bar (exactly 56px so the layout's pt-14 clears it) ── */}
      <header
        className="md:hidden fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between px-4 t-sidebar"
        style={{ borderBottom: "1px solid color-mix(in srgb, var(--text-sidebar) 6%, transparent)" }}
      >
        <Link href="/dashboard" className="flex min-h-11 items-center gap-2.5">
          <div
            className="relative h-8 w-8 overflow-hidden rounded-xl"
            style={{
              background: "color-mix(in srgb, var(--text-sidebar) 10%, transparent)",
              boxShadow: "0 0 0 1.5px color-mix(in srgb, var(--accent-lime) 40%, transparent)"
            }}
          >
            <Image src="/images/logo.png" alt="EcoLudus" fill className="object-cover" sizes="32px" />
          </div>
          <span className="font-serif text-[15px] font-extrabold leading-none" style={{ color: "var(--text-sidebar)" }}>EcoLudus</span>
        </Link>

        <div className="flex items-center gap-2">
          <NotificationBell />
          {profile && (
            <div
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5"
              style={{ background: "color-mix(in srgb, var(--accent-green) 22%, var(--bg-sidebar))" }}
            >
              <Avatar
                name={String(profile?.displayName || user?.email?.split("@")[0] || "Eco Explorer")}
                src={typeof profile?.profileImage === "string" ? (profile.profileImage as string) : null}
                size={20}
              />
              <span className="text-xs font-bold" style={{ color: "var(--text-sidebar)" }}>
                Lv {Number(profile.level) || 1}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform active:scale-95"
            style={{ background: "var(--sidebar-active-bg)", color: "var(--text-sidebar)" }}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer — the "More" menu (5 bottom-nav tabs + everything else) ── */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/60 fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="md:hidden t-sidebar fixed left-0 top-0 z-50 h-full w-[280px] overflow-y-auto sheet-slide"
            style={{ boxShadow: "var(--shadow-hero)" }}
          >
            <div className="flex justify-end p-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: "var(--sidebar-active-bg)", color: "var(--text-sidebar)" }}
                aria-label="Close menu"
              >
                <XIcon className="h-4 w-4" strokeWidth={2.5} />
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

      {/* ── Sign-out confirmation (replaces native confirm()) ── */}
      <ConfirmDialog
        open={logoutOpen}
        title="Sign out of EcoLudus?"
        message="You can sign back in anytime with your email and password."
        confirmLabel="Sign out"
        danger
        onConfirm={confirmLogout}
        onClose={() => setLogoutOpen(false)}
      />
    </>
  );
}