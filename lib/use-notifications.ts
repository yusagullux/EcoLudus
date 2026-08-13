"use client";

import { useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import { applyRead, type ReadOpts } from "@/lib/notifications-shared";
import type { NotificationItem } from "@/lib/types";

// Shared notification state for the sidebar bell and the Impact page. Both call
// `useAuth()`, which shares one SWR profile cache (`["profile", uid]`), so there
// is no double fetch and an optimistic write from one is visible to the other.
//
// `markRead` / `markAllRead` do optimistic `setProfile` → POST → `refreshProfile`
// (authoritative revalidation). On POST failure we revalidate to roll back and
// surface a toast — the client never authoritatively flips `read`; the server
// route's row-locked UPDATE is the source of truth.

export function useNotifications() {
  const { user, profile, setProfile, refreshProfile } = useAuth();
  const toast = useToast();

  const notifications: NotificationItem[] = Array.isArray(profile?.notifications)
    ? (profile.notifications as NotificationItem[])
    : [];
  const unread = notifications.filter((n) => !n.read);
  const unreadCount = unread.length;
  const recent = notifications.slice(0, 5);

  const mark = useCallback(
    async (opts: ReadOpts) => {
      if (!user) return;
      const current = profile ?? {};
      const list = Array.isArray(current.notifications)
        ? (current.notifications as NotificationItem[])
        : [];
      const { next } = applyRead(list, opts);

      // Optimistic cache write (no revalidate) so the badge clears instantly.
      setProfile({ ...current, notifications: next });

      try {
        const res = await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(opts)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Confirm with the authoritative server state.
        await refreshProfile();
      } catch {
        // Roll back to server truth and tell the user.
        await refreshProfile();
        toast.error("Couldn't update notifications");
      }
    },
    [user, profile, setProfile, refreshProfile, toast]
  );

  const markRead = useCallback((id: string) => mark({ id }), [mark]);
  const markAllRead = useCallback(() => mark({ all: true }), [mark]);

  return { notifications, unread, unreadCount, recent, markRead, markAllRead };
}