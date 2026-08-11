# In-app Notification Feed — Design Spec

**Date:** 2026-08-11
**Status:** Approved (pending spec review)
**Scope:** First-version, in-app only

## 1. Goal

Surface the notifications the app already generates (friend cheers, friend requests, real-tree milestones) through a sidebar bell + unread badge + dropdown, with per-item and mark-all-read. No email, no push, no new event generators, no schema migration.

## 2. Current state (what already exists)

- **Data model:** `NotificationItem` (`id`, `type`, `title`, `message`, `read`, `createdAt`) in `lib/types.ts`, stored as `profile.notifications[]` JSON array inside `users.payload` (capped at 20).
- **Generators** (server-side append to payload, all set `read: false`):
  - `app/api/friends/cheer/route.ts` — "friend cheered you"
  - `app/api/friends/route.ts` — friend request
  - `lib/rewards-sync.ts` — tree-planted milestone
- **One reader UI:** `app/(game)/impact/page.tsx` renders the list with an unread count pill and highlights unread rows. **Read-only — nothing flips `read` to true.**
- **Preferences:** `NotificationPreferences` (`dailyReminderEnabled`, `reminderHour`, `teamUpdates`, `questTips`) + settings "Weekly Report" toggle. The `teamUpdates`/`questTips`/`dailyReminder` toggles are **inert** (stored, no generator respects them).
- **Email:** SendGrid wired only to the weekly digest cron.

## 3. Gaps this feature closes

1. No bell / unread badge in the sidebar — notifications are buried on the Impact page.
2. No mark-as-read — the `read` flag is written false by generators and never flipped; unread count only grows.
3. (Out of scope) Wiring the inert preference toggles and adding email/push — deferred to a later version.

## 4. Decisions (locked)

| Decision | Choice |
|---|---|
| Delivery scope | In-app feed only (no email/push) |
| Feed location | Sidebar bell + dropdown; "View all" → existing `/impact` page. No new route. |
| Mark-as-read | Per-item click + "Mark all read" button |
| Inert preference toggles | Left inert; wired when their event types are added later |
| Write architecture | Approach A — new `POST /api/notifications/read` with an atomic server-side `jsonb` UPDATE (no client read-modify-write, no lost-update window) |

## 5. Architecture

### Read side — no new fetch

The game layout already passes `profile` into the `Sidebar` (`type SidebarProps = { user: any; profile: any }`). The bell derives the unread count and list from that prop. SWR revalidation of the profile (on focus/reconnect) keeps the badge fresh. No polling, no new read endpoint.

### Write side — `POST /api/notifications/read`

Body `{ id?: string, all?: boolean }` — exactly one of the two. Authed via `getSession()`, validated with zod. Runs a **single atomic** Postgres `UPDATE` that flips `read=true` on matched items *inside one statement*. The handler never reads the whole payload first, so a concurrent append (tree milestone at 02:00 UTC, or a friend cheer) cannot be dropped — it does not reopen the lost-update class the reward routes were recently fixed for.

### Data flow

1. Existing generators append `{...,read:false}` — unchanged.
2. SWR revalidates `profile` → sidebar re-renders → badge shows unread count.
3. User clicks an item in the dropdown → optimistic `read=true` in SWR cache → `POST {id}` → atomic UPDATE → SWR revalidate to confirm.
4. "Mark all read" → optimistic all `read=true` → `POST {all:true}` → same flow.
5. On POST failure: rollback optimistic state + `toast.error(...)`.
6. "View all" link → `/impact`.

## 6. Components & files

**New:**

- `app/api/notifications/read/route.ts` — POST handler: `getSession()` auth, zod body validation, call `markNotificationsRead(userId, {id|all})`, return `{ updated: N }` or Firebase-style error.
- `lib/notifications-server.ts` — exports:
  - `markNotificationsRead(userId, opts)` — runs the atomic UPDATE (or fileSql branch).
  - `applyRead(notifications, opts)` — **pure** transform returning the new array (testable without SQL; reused by the fileSql branch).
- `components/notification-bell.tsx` — client component: bell button + unread badge + dropdown panel. Uses motion/react + AnimatePresence, reduced-motion safe (mirrors `lib/toast.tsx` patterns). Renders the latest ~5 notifications; clicking an item calls `markRead(id)` and navigates if the notification has an action target; "Mark all read" calls `markAllRead()`; "View all" links to `/impact`.
- `lib/use-notifications.ts` — `useNotifications()` hook returning `{ unreadCount, unread, recent, markRead(id), markAllRead() }`. Performs optimistic SWR mutate + POST, rollback + toast on failure. Shared by the bell and the Impact page.

**Modified:**

- `components/sidebar.tsx` — render `<NotificationBell profile={profile} />` in the header area.
- `app/(game)/impact/page.tsx` — per-row click-to-mark-read + a "Mark all read" button, both via `useNotifications()`. Existing panel/list markup preserved.
- `lib/db.ts` — add the `fileSql` branch matching the new UPDATE string (CLAUDE.md file-DB contract).

**Unchanged:** the three generators, `NotificationItem`, the DB schema, the settings toggles.

## 7. Atomic UPDATE + file-DB contract

Exact query text (normalized form matched by `fileSql`):

```sql
UPDATE users
SET payload = jsonb_set(
  payload, '{notifications}',
  COALESCE((
    SELECT jsonb_agg(
      CASE WHEN (el->>'read') = 'false'
                AND ($1::boolean OR el->>'id' = $2::text)
           THEN el || '{"read": true}'::jsonb
           ELSE el END
    )
    FROM jsonb_array_elements(payload->'notifications') AS el
  ), '[]'::jsonb)
)
WHERE id = $3
```

- Params: `$1` = all (bool), `$2` = id (text, ignored when `$1` is true), `$3` = userId.
- `COALESCE(..., '[]')` guards the no-notifications / null-array case.
- The transform never changes array length (no cap concerns).

**fileSql branch** (in `lib/db.ts`): load the user's JSON row, run `applyRead(notifications, opts)` in JS, write the row back. String-matched on the normalized query text, exactly as `catalog-server.ts` queries are.

## 8. Error handling

All errors return `{ error: { code: "<firebase-style-code>" } }` with matching HTTP status (project convention):

| Condition | Status | Code |
|---|---|---|
| No session | 401 | `auth/unauthenticated` |
| Body has both or neither of `id`/`all`, or `id` empty | 400 | `invalid-argument` |
| DB error | 500 | `internal` |
| Id not found / empty array / all already read | 200 | `{ updated: 0 }` (idempotent success) |

Client: on POST failure, rollback the optimistic SWR mutation and `toast.error("Couldn't update notifications")`.

## 9. Testing

- `lib/__tests__/notifications-filesql.test.ts` — asserts `markNotificationsRead`'s query string has a matching `fileSql` branch (mirrors `lib/__tests__/catalog-filesql.test.ts`).
- `lib/__tests__/notifications-server.test.ts` — unit-tests the pure `applyRead` transform: all-flag path, single-id path, id-not-found, empty array, already-read idempotency, length preserved.

No API-level test harness exists (vitest covers `lib/` only). The route is verified by `typecheck` + `lint` + `test` + `build` plus a manual click-through (open dropdown, click an item, mark all read, confirm badge clears and `/impact` reflects state).

## 10. Build sequence

1. `applyRead` pure transform + `lib/notifications-server.ts` + atomic UPDATE + `fileSql` branch + the two lib tests.
2. `lib/use-notifications.ts` hook (optimistic SWR + POST + rollback).
3. `components/notification-bell.tsx`.
4. Wire bell into `components/sidebar.tsx`.
5. Wire Impact page rows + "Mark all read" via `useNotifications()`.
6. `npm run typecheck && npm run lint && npm test && npm run build`; manual verify.

## 11. Out of scope (explicit)

- Email or push delivery.
- Wiring the `teamUpdates` / `questTips` / `dailyReminder` preference toggles (remain inert).
- New notification event types / generators.
- A dedicated `/notifications` route.
- Schema migration — `NotificationItem` and `profile.notifications` are reused as-is.