// Pure notification helpers — no DB imports, safe to unit-test in isolation.
// The IO wrapper (`markNotificationsRead`) lives in `lib/notifications-server.ts`
// and reuses `applyRead` inside its locked read-modify-write transaction.

import type { NotificationItem } from "@/lib/types";

export type ReadOpts = { all?: boolean; id?: string };

/**
 * Flip `read: true` on the matched notifications without touching anything else.
 *
 * - `opts.all`  → every currently-unread item.
 * - `opts.id`   → the single item whose `id` matches (no-op if not found / already read).
 *
 * Returns a NEW array (input is never mutated) plus the count of items that
 * actually flipped, so the server can skip the write when nothing changed.
 * Array length is always preserved — this never adds or removes notifications,
 * so the generators' 20-item cap is unaffected.
 */
export function applyRead(
  notifications: NotificationItem[],
  opts: ReadOpts
): { next: NotificationItem[]; changed: number } {
  if (!opts.all && !opts.id) {
    return { next: notifications, changed: 0 };
  }

  let changed = 0;
  const next = notifications.map((item) => {
    const matches = opts.all ? !item.read : Boolean(opts.id) && item.id === opts.id;
    if (matches && !item.read) {
      changed++;
      return { ...item, read: true };
    }
    return item;
  });

  return { next, changed };
}