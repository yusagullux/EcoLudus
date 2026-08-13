// Server-only IO for marking notifications read. The pure transform
// (`applyRead`) lives in `lib/notifications-shared.ts` and is reused here.

import { transaction, selectUserForUpdate } from "@/lib/db";
import { applyRead, type ReadOpts } from "@/lib/notifications-shared";
import type { NotificationItem } from "@/lib/types";

type UserRow = {
  id: string;
  email: string;
  payload: Record<string, unknown>;
};

// Covered by fileSql (exact-match at "update users set payload = $1::jsonb,
// updated_at = now() where id = $2") — the same write string the three
// notification generators (friends/cheer, friends, rewards-sync) issue, so
// local no-DB dev works and we never clobber economy columns. No new fileSql
// branch is introduced.
const UPDATE_USER_PAYLOAD =
  "update users set payload = $1::jsonb, updated_at = now() where id = $2";

/**
 * Mark notifications read for a user. Uses the same locked read-modify-write
 * pattern as the generators (`SELECT … FOR UPDATE` → patch → `UPDATE_USER_PAYLOAD`
 * inside one transaction), so a concurrent generator append (tree milestone at
 * 02:00 UTC, a friend cheer, a friend request) cannot be dropped — the row lock
 * serializes the writers. Returns the number of items that flipped to read
 * (0 is idempotent success: nothing matched or all were already read).
 */
export async function markNotificationsRead(
  userId: string,
  opts: ReadOpts
): Promise<number> {
  return transaction(async (query) => {
    const result = await selectUserForUpdate<UserRow>(query, userId);
    const locked = result.rows[0];
    if (!locked) return 0;

    const payload = locked.payload || {};
    const notifications: NotificationItem[] = Array.isArray(payload.notifications)
      ? (payload.notifications as NotificationItem[])
      : [];

    const { next, changed } = applyRead(notifications, opts);
    if (changed === 0) return 0;

    const nextPayload = { ...payload, notifications: next };
    await query(UPDATE_USER_PAYLOAD, [JSON.stringify(nextPayload), userId]);
    return changed;
  });
}