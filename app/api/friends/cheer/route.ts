import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { grantImpact } from "@/lib/impact-service";

// Server-validated friend cheer. The friends page used to enforce the 5/day
// cap and grant XP/eco client-side through `updateUserProfile`, which a client
// could bypass (forge any XP/eco, ignore the cap, cheer non-friends). This
// route owns the cap, the friend-relationship check, and routes rewards
// through the spine. A small one-shot `source:"friend"` Impact is granted to
// BOTH users — the cheerer (who acted) and the friend (who was encouraged) —
// with a notification left for the friend.

const CHEER_XP = 10;
const CHEER_ECO = 3;
const CHEERER_IMPACT = 5;
const FRIEND_IMPACT = 5;
const MAX_CHEERS_PER_DAY = 5;

const cheerSchema = z.object({
  friendId: z.string().min(1)
});

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof cheerSchema>;
  try {
    parsed = cheerSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  if (parsed.friendId === session.userId) {
    return NextResponse.json({ error: { code: "friends/self-cheer" } }, { status: 400 });
  }

  try {
    const userResult = await sql<{ email: string; payload: Record<string, unknown> }>(
      "select id, email, payload from users where id = $1 limit 1",
      [session.userId]
    );
    if (userResult.rowCount === 0) {
      return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
    }

    const profile = userResult.rows[0].payload ?? {};
    const friends = Array.isArray(profile.friends) ? [...(profile.friends as Array<Record<string, unknown>>)] : [];

    // Must be an actual friend — no cheering arbitrary users.
    const friendEntry = friends.find((f) => String(f.id) === parsed.friendId) ?? null;
    if (!friendEntry) {
      return NextResponse.json({ error: { code: "friends/not-friend" } }, { status: 404 });
    }

    // Enforce the 5/day cap server-side.
    const today = todayKey();
    const socialStats = (profile.socialStats ?? {}) as Record<string, unknown>;
    const sameDay = String(socialStats.lastCheerDate ?? "") === today;
    const cheersToday = sameDay ? Math.max(0, Number(socialStats.cheersToday ?? 0)) : 0;
    if (cheersToday >= MAX_CHEERS_PER_DAY) {
      return NextResponse.json(
        { error: { code: "friends/cheer-cap-reached", message: "Daily cheer limit reached. Come back tomorrow." } },
        { status: 429 }
      );
    }

    // Bump the per-friend cheer counter on the cheerer's friend list.
    const nextFriends = friends.map((f) =>
      String(f.id) === parsed.friendId
        ? { ...f, cheers: Number(f.cheers ?? 0) + 1, lastCheeredAt: new Date().toISOString() }
        : f
    );

    const nextSocialStats = {
      ...socialStats,
      cheersGiven: Number(socialStats.cheersGiven ?? 0) + 1,
      cheersToday: cheersToday + 1,
      lastCheerDate: today
    };

    const cheererName = String(profile.displayName ?? profile.name ?? "A friend");

    // Grant to the cheerer (XP + eco + Impact), patching friend list + social stats atomically.
    const granted = await grantImpact({
      userId: session.userId,
      source: "friend",
      baseXp: CHEER_XP,
      baseImpact: CHEERER_IMPACT,
      eco: CHEER_ECO,
      meta: { friendId: parsed.friendId, friendName: String(friendEntry.displayName ?? "") },
      payloadPatch: { friends: nextFriends, socialStats: nextSocialStats }
    });

    // Grant a small Impact to the friend too, plus a notification. Load the
    // friend's current notifications so we can prepend (kept to last 20).
    let friendNotified = false;
    try {
      const friendResult = await sql<{ email: string; payload: Record<string, unknown> }>(
        "select id, email, payload from users where id = $1 limit 1",
        [parsed.friendId]
      );
      if (friendResult.rowCount !== 0) {
        const friendProfile = friendResult.rows[0].payload ?? {};
        const existingNotifications = Array.isArray(friendProfile.notifications)
          ? (friendProfile.notifications as Array<Record<string, unknown>>)
          : [];
        const notification = {
          id: `cheer-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          type: "cheer",
          title: "You were cheered! 🌿",
          message: `${cheererName} cheered you on. Keep going!`,
          read: false,
          createdAt: new Date().toISOString()
        };
        const nextNotifications = [notification, ...existingNotifications].slice(0, 20);

        await grantImpact({
          userId: parsed.friendId,
          source: "friend",
          baseImpact: FRIEND_IMPACT,
          meta: { cheeredBy: session.userId, cheeredByName: cheererName },
          payloadPatch: { notifications: nextNotifications }
        });
        friendNotified = true;
      }
    } catch (friendError) {
      // The friend grant is best-effort — never fail the cheerer's reward.
      console.error("Friend cheer notification error:", friendError);
    }

    return NextResponse.json({
      success: true,
      xpAwarded: CHEER_XP,
      ecoAwarded: CHEER_ECO,
      impactAwarded: CHEERER_IMPACT,
      cheersToday: cheersToday + 1,
      cheersCap: MAX_CHEERS_PER_DAY,
      friendNotified,
      level: granted?.level ?? null,
      xp: granted?.xp ?? null,
      ecoPoints: granted?.ecoPoints ?? null
    });
  } catch (error) {
    console.error("Friend cheer error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}