"use client";

import { useEffect, useRef, useState } from "react";
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

export function NotificationBell() {
  const { unreadCount, recent, notifications, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

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
        type="button"
        onClick={() => setOpen((v) => !v)}
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
        className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl shadow-xl"
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
              <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: "var(--border-subtle)" }}>
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

            {/* Footer */}
            <Link
              href="/impact"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-center text-[11px] font-bold transition-colors hover:opacity-70"
              style={{ color: "var(--text-accent)", borderTop: "1px solid var(--border-subtle)" }}
              role="menuitem"
            >
              View all
            </Link>
          </div>
        ) : null}
      </MotionPresence>
    </div>
  );
}