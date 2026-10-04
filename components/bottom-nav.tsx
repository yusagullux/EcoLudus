"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  House,
  Package,
  ShoppingBag,
  Sprout,
  type LucideIcon
} from "lucide-react";

// ── Mobile bottom tab bar ────────────────────────────────────────────────────
//
// Five primary tabs; everything else lives in the sidebar drawer ("More" menu).
// The bar sits on the always-dark `--bg-sidebar` ink surface in every theme, so
// the active fill/ink are mixed against sidebar tokens only — one recipe that
// reads correctly across all six `[data-theme]` palettes:
//
//   active fill : color-mix(in srgb, var(--accent-green) 32%, var(--bg-sidebar))
//   active ink  : color-mix(in srgb, var(--accent-lime) 70%, var(--text-sidebar))
//   inactive ink: var(--text-sidebar-muted)
//
// (`--accent-green`/`--accent-lime` fills are theme-independent; `--bg-sidebar`
// is dark ink and `--text-sidebar` is its light counterpart in every theme, so
// the mixes land legible in light AND dark palettes.)

type TabItem = { name: string; href: string; icon: LucideIcon };

const TABS: TabItem[] = [
  { name: "Home", href: "/dashboard", icon: House },
  { name: "Missions", href: "/habits", icon: ClipboardCheck },
  { name: "Garden", href: "/garden", icon: Sprout },
  { name: "Shop", href: "/shop", icon: ShoppingBag },
  { name: "Collection", href: "/collection", icon: Package }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        // z-40 keeps the bar above page content but BELOW the drawer's z-50
        // overlay, so opening the "More" menu covers it.
        background:
          "color-mix(in srgb, var(--bg-sidebar) 96%, var(--bg-panel))",
        borderTop:
          "1px solid color-mix(in srgb, var(--border-default) 60%, transparent)",
        // Navigation chrome exception: the only surface allowed a blur.
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)"
      }}
    >
      <ul
        className="mx-auto flex max-w-[640px] items-stretch px-1"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((tab) => {
          // Exact match first, nested-prefix fallback for sub-routes.
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex flex-1 min-w-0">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className="flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-xl pt-1.5 pb-1 transition-transform active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--accent-lime)]"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 md:hover:bg-[color-mix(in_srgb,var(--text-sidebar)_12%,transparent)]"
                  style={
                    isActive
                      ? {
                          background:
                            "color-mix(in srgb, var(--accent-green) 32%, var(--bg-sidebar))",
                          color:
                            "color-mix(in srgb, var(--accent-lime) 70%, var(--text-sidebar))"
                        }
                      : { color: "var(--text-sidebar-muted)" }
                  }
                >
                  <Icon
                    className="h-[21px] w-[21px] shrink-0"
                    strokeWidth={isActive ? 2 : 1.8}
                  />
                </span>
                <span
                  className="text-[0.6875rem] font-bold leading-none"
                  style={
                    isActive
                      ? {
                          color:
                            "color-mix(in srgb, var(--accent-lime) 70%, var(--text-sidebar))"
                        }
                      : { color: "var(--text-sidebar-muted)" }
                  }
                >
                  {tab.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}