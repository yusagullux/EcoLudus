import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

// Helper to persist a user payload to Postgres, keeping top-level
// denormalised columns (xp, level, trust_score) in sync — mirrors
// the logic in document-store.ts setDocument for the "users" collection.
async function saveUserPayload(
  userId: string,
  email: string,
  payload: Record<string, unknown>
) {
  const merged: Record<string, unknown> = { ...payload, email };
  const xpVal = Number(merged.xp ?? 0);
  const levelVal = Number(merged.level ?? 1);
  const trustScoreVal = Number(
    (merged.trustScore ?? merged.trust_score ?? 50) as number
  );

  await sql(
    `update users
        set email        = $2,
            xp           = $3,
            level        = $4,
            trust_score  = $5,
            payload      = $6::jsonb,
            updated_at   = now()
      where id = $1`,
    [userId, email, xpVal, levelVal, trustScoreVal, JSON.stringify(merged)]
  );
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { action, targetUserId } = body;

    if (!action || !targetUserId) {
      return NextResponse.json(
        { error: "Missing action or targetUserId" },
        { status: 400 }
      );
    }

    const currentUserId = session.userId;

    if (currentUserId === targetUserId) {
      return NextResponse.json(
        { error: "Cannot perform action on yourself" },
        { status: 400 }
      );
    }

    // ── Fetch both profiles ──────────────────────────────────────────
    const [currentUserRes, targetUserRes] = await Promise.all([
      sql("select id, email, payload from users where id = $1 limit 1", [
        currentUserId,
      ]),
      sql("select id, email, payload from users where id = $1 limit 1", [
        targetUserId,
      ]),
    ]);

    if (currentUserRes.rowCount === 0 || targetUserRes.rowCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUserRow = currentUserRes.rows[0] as {
      id: string;
      email: string;
      payload: Record<string, unknown>;
    };
    const targetUserRow = targetUserRes.rows[0] as {
      id: string;
      email: string;
      payload: Record<string, unknown>;
    };

    const cp = currentUserRow.payload || {}; // current payload
    const tp = targetUserRow.payload || {}; // target payload

    const currentFriends: any[] = Array.isArray(cp.friends) ? cp.friends : [];
    const targetFriends: any[] = Array.isArray(tp.friends) ? tp.friends : [];

    const currentFriendRequests: any[] = Array.isArray(cp.friendRequests)
      ? cp.friendRequests
      : [];
    const targetFriendRequests: any[] = Array.isArray(tp.friendRequests)
      ? tp.friendRequests
      : [];

    const currentSentRequests: string[] = Array.isArray(cp.sentRequests)
      ? cp.sentRequests
      : [];
    const targetSentRequests: string[] = Array.isArray(tp.sentRequests)
      ? tp.sentRequests
      : [];

    const targetNotifications: any[] = Array.isArray(tp.notifications)
      ? tp.notifications
      : [];

    const fid = (f: any) => f?.id || f?.uid;

    // ── ACTION: request ──────────────────────────────────────────────
    if (action === "request") {
      // Already friends?
      if (currentFriends.some((f: any) => fid(f) === targetUserId)) {
        return NextResponse.json(
          { error: "You are already friends" },
          { status: 400 }
        );
      }

      // If the target already sent US a request, auto-accept instead of
      // creating a messy cross-request.
      const hasIncomingFromTarget = currentFriendRequests.some(
        (r: any) => fid(r) === targetUserId
      );
      if (hasIncomingFromTarget) {
        // Delegate to the accept path by falling through below.
        // We override `action` locally — this is safe because we never
        // read it again after the if/else chain.
        return await handleAccept(
          currentUserId,
          targetUserId,
          currentUserRow,
          targetUserRow,
          cp,
          tp,
          currentFriends,
          targetFriends,
          currentFriendRequests,
          targetSentRequests,
          targetNotifications
        );
      }

      // Already sent?
      if (currentSentRequests.includes(targetUserId)) {
        return NextResponse.json(
          { error: "Request already sent" },
          { status: 400 }
        );
      }

      const senderName =
        (cp.displayName as string) ||
        currentUserRow.email?.split("@")[0] ||
        "Someone";

      // Build the incoming-request record stored on the target
      const newRequest = {
        id: currentUserId,
        displayName: senderName,
        level: Number(cp.level || 1),
        xp: Number(cp.xp || 0),
        requestedAt: new Date().toISOString(),
      };

      tp.friendRequests = [
        ...targetFriendRequests.filter((r: any) => fid(r) !== currentUserId),
        newRequest,
      ];

      cp.sentRequests = [
        ...currentSentRequests.filter((id: string) => id !== targetUserId),
        targetUserId,
      ];

      tp.notifications = [
        {
          id: randomUUID(),
          type: "friend_request",
          title: "New Friend Request",
          message: `${senderName} sent you a friend request!`,
          read: false,
          createdAt: new Date().toISOString(),
          senderId: currentUserId,
        },
        ...targetNotifications,
      ].slice(0, 20);

      await Promise.all([
        saveUserPayload(currentUserId, currentUserRow.email, cp),
        saveUserPayload(targetUserId, targetUserRow.email, tp),
      ]);

      return NextResponse.json({
        success: true,
        message: "Friend request sent",
      });
    }

    // ── ACTION: accept ───────────────────────────────────────────────
    if (action === "accept") {
      const hasIncoming = currentFriendRequests.some(
        (r: any) => fid(r) === targetUserId
      );
      if (!hasIncoming) {
        return NextResponse.json(
          { error: "No pending request from this user" },
          { status: 400 }
        );
      }

      return await handleAccept(
        currentUserId,
        targetUserId,
        currentUserRow,
        targetUserRow,
        cp,
        tp,
        currentFriends,
        targetFriends,
        currentFriendRequests,
        targetSentRequests,
        targetNotifications
      );
    }

    // ── ACTION: decline ──────────────────────────────────────────────
    if (action === "decline") {
      cp.friendRequests = currentFriendRequests.filter(
        (r: any) => fid(r) !== targetUserId
      );
      tp.sentRequests = targetSentRequests.filter(
        (id: string) => id !== currentUserId
      );

      await Promise.all([
        saveUserPayload(currentUserId, currentUserRow.email, cp),
        saveUserPayload(targetUserId, targetUserRow.email, tp),
      ]);

      return NextResponse.json({
        success: true,
        message: "Friend request declined",
      });
    }

    // ── ACTION: remove ───────────────────────────────────────────────
    if (action === "remove") {
      cp.friends = currentFriends.filter(
        (f: any) => fid(f) !== targetUserId
      );
      tp.friends = targetFriends.filter(
        (f: any) => fid(f) !== currentUserId
      );

      // Also clean up any stale request artefacts
      cp.sentRequests = currentSentRequests.filter(
        (id: string) => id !== targetUserId
      );
      cp.friendRequests = currentFriendRequests.filter(
        (r: any) => fid(r) !== targetUserId
      );
      tp.sentRequests = targetSentRequests.filter(
        (id: string) => id !== currentUserId
      );
      tp.friendRequests = targetFriendRequests.filter(
        (r: any) => fid(r) !== currentUserId
      );

      await Promise.all([
        saveUserPayload(currentUserId, currentUserRow.email, cp),
        saveUserPayload(targetUserId, targetUserRow.email, tp),
      ]);

      return NextResponse.json({
        success: true,
        message: "Friend removed",
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("Friends API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── Shared accept logic (used by both "accept" and auto-accept in "request") ──
async function handleAccept(
  currentUserId: string,
  targetUserId: string,
  currentUserRow: { id: string; email: string; payload: Record<string, unknown> },
  targetUserRow: { id: string; email: string; payload: Record<string, unknown> },
  cp: Record<string, unknown>,
  tp: Record<string, unknown>,
  currentFriends: any[],
  targetFriends: any[],
  currentFriendRequests: any[],
  targetSentRequests: string[],
  targetNotifications: any[]
) {
  const fid = (f: any) => f?.id || f?.uid;

  const targetName =
    (tp.displayName as string) ||
    targetUserRow.email?.split("@")[0] ||
    "Explorer";
  const currentName =
    (cp.displayName as string) ||
    currentUserRow.email?.split("@")[0] ||
    "Explorer";

  // Remove from all request/sent tracking on BOTH sides
  cp.friendRequests = (
    Array.isArray(cp.friendRequests) ? cp.friendRequests : []
  ).filter((r: any) => fid(r) !== targetUserId);
  cp.sentRequests = (
    Array.isArray(cp.sentRequests) ? cp.sentRequests : []
  ).filter((id: string) => id !== targetUserId);

  tp.friendRequests = (
    Array.isArray(tp.friendRequests) ? tp.friendRequests : []
  ).filter((r: any) => fid(r) !== currentUserId);
  tp.sentRequests = (
    Array.isArray(tp.sentRequests) ? tp.sentRequests : []
  ).filter((id: string) => id !== currentUserId);

  // Add to friends (deduplicate first)
  cp.friends = [
    ...currentFriends.filter((f: any) => fid(f) !== targetUserId),
    {
      id: targetUserId,
      displayName: targetName,
      xp: Number(tp.xp || 0),
      level: Number(tp.level || 1),
      ecoPoints: Number(tp.ecoPoints || 0),
      cheers: 0,
      addedAt: new Date().toISOString(),
    },
  ];

  tp.friends = [
    ...targetFriends.filter((f: any) => fid(f) !== currentUserId),
    {
      id: currentUserId,
      displayName: currentName,
      xp: Number(cp.xp || 0),
      level: Number(cp.level || 1),
      ecoPoints: Number(cp.ecoPoints || 0),
      cheers: 0,
      addedAt: new Date().toISOString(),
    },
  ];

  // Notify the other user
  tp.notifications = [
    {
      id: randomUUID(),
      type: "friend_accepted",
      title: "Friend Request Accepted",
      message: `${currentName} accepted your friend request!`,
      read: false,
      createdAt: new Date().toISOString(),
    },
    ...targetNotifications,
  ].slice(0, 20);

  await Promise.all([
    saveUserPayload(currentUserId, currentUserRow.email, cp),
    saveUserPayload(targetUserId, targetUserRow.email, tp),
  ]);

  return NextResponse.json({
    success: true,
    message: "Friend request accepted",
  });
}
