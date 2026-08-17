"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/use-notifications";
import { MotionPresence, useReducedMotion } from "@/lib/animations";

// Sidebar bell + unread badge + dropdown. Renders in both the desktop sidebar
// header and the mobile top bar (both are `t-sidebar`-colored contexts). The
// dropdown panel uses the same panel/row tokens as the /impact notifications
// list so items look identical in both places. State + mark-as-read come from
// the shared `useNotifications()` hook (one SWR profile cache for the whole app).

const ICON_BY_TYPE: Record<string, string> = {
  tree_planted: "🌳",
  cheer: "🌿",
  friend_request: "🤝",
  friend_accepted: "🤝"
};

function iconFor(type: string) {
  return ICON_BY_TYPE[type] ?? "🔔";
}

// Panel geometry. The panel is rendered `position: fixed` (measured from the
// bell button's rect) rather than `absolute` so it escapes the sidebar's
// `overflow-hidden` ancestor — which otherwise clips it to the 240px sidebar
// on desktop, making it unreadable. On mobile the bell is *not* at the
// viewport's right edge (the avatar chip + hamburger sit to its right), so
// `absolute right-0` pushed a 320px panel off the left side of the screen.
// Fixed + viewport-clamped coordinates fix both.
const PANEL_WIDTH = 320; // 20rem
const GAP = 8;            // gap between bell and panel (was mt-2)
const EDGE_MARGIN = 12;  // keep this much clear of the viewport edges

export function NotificationBell() {
  const { unreadCount, recent, notifications, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const prefersReducedMotion = useReducedMotion();

  // Compute the panel's fixed position from the bell button's viewport rect.
  // Adaptive horizontal placement: open rightward from the bell's left edge
  // when there's room (desktop sidebar); otherwise right-align with the bell
  // (tablet/mobile); otherwise clamp inside the viewport (narrow phones).
  const placePanel = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(PANEL_WIDTH, vw - EDGE_MARGIN * 2);
    let left: number;
    if (rect.left + width <= vw - EDGE_MARGIN) {
      left = rect.left; // room to open rightward from the bell
    } else if (rect.right - width >= EDGE_MARGIN) {
      left = rect.right - width; // right-align with the bell
    } else {
      left = Math.max(EDGE_MARGIN, Math.min(rect.right - width, vw - EDGE_MARGIN - width));
    }
    setPanelStyle({ position: "fixed", top: rect.bottom + GAP, left, width, zIndex: 50 });
  }, []);

  // Place on open, and re-place on resize/orientation change while open.
  useEffect(() => {
    if (!open) return;
    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("orientationchange", placePanel);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("orientationchange", placePanel);
    };
  }, [open, placePanel]);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) placePanel();
          setOpen((v) => !v);
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
        style={{ color: "var(--text-sidebar-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-sidebar)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-sidebar-muted)")}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7C18 5.444 15.314 2 12 2S6 5.444 6 9.05v.7c0 2.22-.804 4.255-2.131 5.972a23.85 23.85 0 005.454 1.31m6 0a24.255 24.255 0 01-6 0m6 0a3 3 0 11-6 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black leading-none"
            style={{ background: "var(--text-accent)", color: "var(--text-inverse)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <MotionPresence
        // `position: fixed` + viewport-clamped coords (see placePanel) so the
        // panel is never clipped by the sidebar's overflow-hidden or pushed
        // off-screen by the mobile bell's non-right-edge position.
        className="overflow-hidden rounded-xl shadow-xl"
        style={panelStyle}
      >
        {open ? (
          <div
            className="flex flex-col"
            style={{ background: "var(--bg-panel)", border: "1px solid var(--border-default)" }}
            role="menu"
            aria-label="Notifications"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    void markAllRead();
                    if (prefersReducedMotion) setOpen(false);
                  }}
                  className="text-[11px] font-bold transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-accent)" }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-2xl">🔔</p>
                <p className="mt-2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  No notifications yet
                </p>
              </div>
            ) : (
              <div
                className="max-h-[min(20rem,calc(100vh-16rem))] overflow-y-auto divide-y"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                {recent.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.read) void markRead(n.id);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
                    style={{ background: n.read ? undefined : "var(--bg-panel-alt)" }}
                    role="menuitem"
                  >
                    <span className="mt-0.5 text-base">{iconFor(n.type)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                        {n.message}
                      </span>
                      <span className="mt-1 block text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                    {!n.read && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: "var(--text-accent)" }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {notifications.length > 0 && unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  void markAllRead();
                  setOpen(false);
                }}
                className="block w-full px-4 py-2.5 text-center text-[11px] font-bold transition-colors hover:opacity-70"
                style={{ color: "var(--text-accent)", borderTop: "1px solid var(--border-subtle)" }}
                role="menuitem"
              >
                Mark all as read
              </button>
            )}
          </div>
        ) : null}
      </MotionPresence>
    </div>
  );
}