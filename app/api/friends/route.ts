import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate, type DbQuery } from "@/lib/db";

// Friend-relationship mutations (request / accept / decline / remove).
//
// Lost-update safety (audit H6): the old `saveUserPayload` helper re-wrote the
// ENTIRE user payload (xp, ecoPoints, eggs, plants, …) for BOTH users from a
// single stale unlocked read — so a friend accept that raced a concurrent
// reward grant silently clobbered the grant. This version runs the whole op
// inside one `transaction`, locks BOTH user rows with SELECT … FOR UPDATE
// (in ascending id order, so two mutual requests can't deadlock), re-reads
// both payloads under the lock, and writes back ONLY the friendship fields by
// shallow-merging a patch over the locked payload. Economy state is preserved
// because it's read fresh under the lock and untouched in the merge.
//
// The write uses the file-DB-covered "update users set payload = … , updated_at
// = now() where id = …" string (lib/db.ts fileSql branch), so local no-DB dev
// no longer crashes on friend actions (the old full-payload string had no
// fileSql branch). Friends ops never touch xp/level/trust_score, so the
// denormalised columns are deliberately left alone.

type UserRow = { id: string; email: string; payload: Record<string, unknown> };

type FriendshipPatch = Partial<{
  friends: unknown[];
  friendRequests: unknown[];
  sentRequests: string[];
  notifications: unknown[];
}>;

const UPDATE_USER_PAYLOAD =
  "update users set payload = $1::jsonb, updated_at = now() where id = $2";

const actionSchema = z.object({
  action: z.enum(["request", "accept", "decline", "remove"]),
  targetUserId: z.string().min(1)
});

const fid = (f: any) => f?.id || f?.uid;

// Lock both user rows inside the caller's transaction, in ascending id order so
// two mutual requests can't deadlock. Returns the rows keyed by role, or null
// if either user is gone (caller returns 404).
async function lockBoth(
  query: DbQuery,
  currentUserId: string,
  targetUserId: string
): Promise<{ current: UserRow; target: UserRow } | null> {
  const order = [currentUserId, targetUserId].sort();
  const a = await selectUserForUpdate<UserRow>(query, order[0]);
  const b = await selectUserForUpdate<UserRow>(query, order[1]);
  const aRow = a.rows[0];
  const bRow = b.rows[0];
  if (!aRow || !bRow) return null;
  const byId = new Map<string, UserRow>([
    [aRow.id, aRow],
    [bRow.id, bRow]
  ]);
  return { current: byId.get(currentUserId)!, target: byId.get(targetUserId)! };
}

function nameOf(row: UserRow, fallback = "Explorer") {
  return String(row.payload?.displayName ?? (row.email ? row.email.split("@")[0] : fallback));
}

function friendEntry(row: UserRow, other: UserRow) {
  const op = other.payload ?? {};
  return {
    id: other.id,
    displayName: nameOf(other),
    xp: Number(op.xp || 0),
    level: Number(op.level || 1),
    ecoPoints: Number(op.ecoPoints || 0),
    cheers: 0,
    addedAt: new Date().toISOString()
  };
}

// Pure computation of the accept patches from the LOCKED rows. Shared by the
// "accept" action and the auto-accept path inside "request".
function computeAccept(current: UserRow, target: UserRow): {
  currentPatch: FriendshipPatch;
  targetPatch: FriendshipPatch;
} {
  const cp = current.payload ?? {};
  const tp = target.payload ?? {};

  const currentPatch: FriendshipPatch = {
    friendRequests: (Array.isArray(cp.friendRequests) ? cp.friendRequests : []).filter(
      (r) => fid(r) !== target.id
    ),
    sentRequests: (Array.isArray(cp.sentRequests) ? cp.sentRequests : []).filter(
      (id) => id !== target.id
    ),
    friends: [
      ...(Array.isArray(cp.friends) ? cp.friends : []).filter((f) => fid(f) !== target.id),
      friendEntry(current, target)
    ]
  };

  const targetPatch: FriendshipPatch = {
    friendRequests: (Array.isArray(tp.friendRequests) ? tp.friendRequests : []).filter(
      (r) => fid(r) !== current.id
    ),
    sentRequests: (Array.isArray(tp.sentRequests) ? tp.sentRequests : []).filter(
      (id) => id !== current.id
    ),
    friends: [
      ...(Array.isArray(tp.friends) ? tp.friends : []).filter((f) => fid(f) !== current.id),
      friendEntry(target, current)
    ],
    notifications: [
      {
        id: randomUUID(),
        type: "friend_accepted",
        title: "Friend Request Accepted",
        message: `${nameOf(current)} accepted your friend request!`,
        read: false,
        createdAt: new Date().toISOString()
      },
      ...(Array.isArray(tp.notifications) ? tp.notifications : [])
    ].slice(0, 20)
  };

  return { currentPatch, targetPatch };
}

// Apply a patch to a locked row and persist via the covered update string.
async function applyPatch(
  query: DbQuery,
  row: UserRow,
  patch: FriendshipPatch
) {
  if (Object.keys(patch).length === 0) return;
  const nextPayload = { ...row.payload, ...patch };
  await query(UPDATE_USER_PAYLOAD, [JSON.stringify(nextPayload), row.id]);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let body: z.infer<typeof actionSchema>;
  try {
    body = actionSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid-argument", details: error.flatten() } },
        { status: 400 }
      );
    }
    throw error;
  }

  const currentUserId = session.userId!;
  const targetUserId = body.targetUserId;

  if (currentUserId === targetUserId) {
    return NextResponse.json({ error: "Cannot perform action on yourself" }, { status: 400 });
  }

  try {
    return await transaction(async (query) => {
      const locked = await lockBoth(query, currentUserId, targetUserId);
      if (!locked) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const { current, target } = locked;
      const cp = current.payload ?? {};
      const tp = target.payload ?? {};

      const currentFriends = Array.isArray(cp.friends) ? cp.friends : [];
      const currentFriendRequests = Array.isArray(cp.friendRequests) ? cp.friendRequests : [];
      const currentSentRequests = Array.isArray(cp.sentRequests) ? cp.sentRequests : [];
      const targetFriendRequests = Array.isArray(tp.friendRequests) ? tp.friendRequests : [];
      const targetSentRequests = Array.isArray(tp.sentRequests) ? tp.sentRequests : [];
      const targetNotifications = Array.isArray(tp.notifications) ? tp.notifications : [];

      // ── ACTION: request ──────────────────────────────────────────────
      if (body.action === "request") {
        if (currentFriends.some((f) => fid(f) === targetUserId)) {
          return NextResponse.json({ error: "You are already friends" }, { status: 400 });
        }

        // Target already sent us a request → auto-accept instead of a cross-request.
        if (currentFriendRequests.some((r) => fid(r) === targetUserId)) {
          const { currentPatch, targetPatch } = computeAccept(current, target);
          await applyPatch(query, current, currentPatch);
          await applyPatch(query, target, targetPatch);
          return NextResponse.json({ success: true, message: "Friend request accepted" });
        }

        if (currentSentRequests.includes(targetUserId)) {
          return NextResponse.json({ error: "Request already sent" }, { status: 400 });
        }

        const senderName = nameOf(current, "Someone");
        const newRequest = {
          id: currentUserId,
          displayName: senderName,
          level: Number(cp.level || 1),
          xp: Number(cp.xp || 0),
          requestedAt: new Date().toISOString()
        };

        const currentPatch: FriendshipPatch = {
          sentRequests: [...currentSentRequests.filter((id) => id !== targetUserId), targetUserId]
        };
        const targetPatch: FriendshipPatch = {
          friendRequests: [
            ...targetFriendRequests.filter((r) => fid(r) !== currentUserId),
            newRequest
          ],
          notifications: [
            {
              id: randomUUID(),
              type: "friend_request",
              title: "New Friend Request",
              message: `${senderName} sent you a friend request!`,
              read: false,
              createdAt: new Date().toISOString(),
              senderId: currentUserId
            },
            ...targetNotifications
          ].slice(0, 20)
        };

        await applyPatch(query, current, currentPatch);
        await applyPatch(query, target, targetPatch);
        return NextResponse.json({ success: true, message: "Friend request sent" });
      }

      // ── ACTION: accept ───────────────────────────────────────────────
      if (body.action === "accept") {
        if (!currentFriendRequests.some((r) => fid(r) === targetUserId)) {
          return NextResponse.json(
            { error: "No pending request from this user" },
            { status: 400 }
          );
        }
        const { currentPatch, targetPatch } = computeAccept(current, target);
        await applyPatch(query, current, currentPatch);
        await applyPatch(query, target, targetPatch);
        return NextResponse.json({ success: true, message: "Friend request accepted" });
      }

      // ── ACTION: decline ──────────────────────────────────────────────
      if (body.action === "decline") {
        const currentPatch: FriendshipPatch = {
          friendRequests: currentFriendRequests.filter((r) => fid(r) !== targetUserId)
        };
        const targetPatch: FriendshipPatch = {
          sentRequests: targetSentRequests.filter((id) => id !== currentUserId)
        };
        await applyPatch(query, current, currentPatch);
        await applyPatch(query, target, targetPatch);
        return NextResponse.json({ success: true, message: "Friend request declined" });
      }

      // ── ACTION: remove ───────────────────────────────────────────────
      if (body.action === "remove") {
        const currentPatch: FriendshipPatch = {
          friends: currentFriends.filter((f) => fid(f) !== targetUserId),
          sentRequests: currentSentRequests.filter((id) => id !== targetUserId),
          friendRequests: currentFriendRequests.filter((r) => fid(r) !== targetUserId)
        };
        const targetPatch: FriendshipPatch = {
          friends: (Array.isArray(tp.friends) ? tp.friends : []).filter(
            (f) => fid(f) !== currentUserId
          ),
          sentRequests: targetSentRequests.filter((id) => id !== currentUserId),
          friendRequests: targetFriendRequests.filter((r) => fid(r) !== currentUserId)
        };
        await applyPatch(query, current, currentPatch);
        await applyPatch(query, target, targetPatch);
        return NextResponse.json({ success: true, message: "Friend removed" });
      }

      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    });
  } catch (error) {
    console.error("Friends API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}