import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { grantProgression, type ProgressionUser, type GrantProgressionResult } from "@/lib/progression";

// Server-validated friend cheer. The friends page used to enforce the 5/day
// cap and grant XP/eco client-side through `updateUserProfile`, which a client
// could bypass (forge any XP/eco, ignore the cap, cheer non-friends). This
// route owns the cap, the friend-relationship check, and routes rewards
// through the spine. A small one-shot `source:"friend"` Impact is granted to
// BOTH users — the cheerer (who acted) and the friend (who was encouraged) —
// with a notification left for the friend.
//
// The cheerer's read → friend/cap checks → grant run inside one transaction
// with a row lock (selectUserForUpdate) so a concurrent cheer cannot both
// pass the 5/day cap against a stale read (lost-update / cap-bypass class from
// the audit), and the grant shares the lock via `tx`. The friend's
// notification grant is a SEPARATE user row, done best-effort AFTER the
// cheerer's transaction commits — it must not fail the cheerer's reward.

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

  // The cheerer's read → friend/cap checks → grant run inside one transaction
  // with a row lock (selectUserForUpdate) so a concurrent cheer cannot both
  // pass the 5/day cap against a stale read (lost-update / cap-bypass class from
  // the audit), and the grant shares the lock via `tx`. The transaction returns a
  // discriminated result — either an early 404/429 response (empty tx commits) or
  // the grant outcome. The friend's notification grant is a SEPARATE user row,
  // done best-effort AFTER the cheerer's transaction commits — never fails the
  // cheerer.
  type CheerOutcome =
    | { early: NextResponse }
    | { grant: GrantProgressionResult | null; cheersAfter: number; cheererName: string };

  let outcome: CheerOutcome;
  try {
    outcome = await transaction<CheerOutcome>(async (query) => {
      const userResult = await selectUserForUpdate<ProgressionUser>(query, session.userId!);
      if (userResult.rowCount === 0) {
        return { early: NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 }) };
      }

      const user = userResult.rows[0];
      const profile = user.payload ?? {};
      const friends = Array.isArray(profile.friends)
        ? [...(profile.friends as Array<Record<string, unknown>>)]
        : [];

      // Must be an actual friend — no cheering arbitrary users.
      const friendEntry = friends.find((f) => String(f.id) === parsed.friendId) ?? null;
      if (!friendEntry) {
        return { early: NextResponse.json({ error: { code: "friends/not-friend" } }, { status: 404 }) };
      }

      // Enforce the 5/day cap server-side (checked under the row lock).
      const today = todayKey();
      const socialStats = (profile.socialStats ?? {}) as Record<string, unknown>;
      const sameDay = String(socialStats.lastCheerDate ?? "") === today;
      const cheersToday = sameDay ? Math.max(0, Number(socialStats.cheersToday ?? 0)) : 0;
      if (cheersToday >= MAX_CHEERS_PER_DAY) {
        return {
          early: NextResponse.json(
            { error: { code: "friends/cheer-cap-reached", message: "Daily cheer limit reached. Come back tomorrow." } },
            { status: 429 }
          )
        };
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
      const cheersAfter = cheersToday + 1;

      // Grant to the cheerer (XP + eco), patching friend list + social
      // stats atomically inside the locked transaction.
      const grant = await grantProgression({
        userId: session.userId,
        source: "friend",
        baseXp: CHEER_XP,
        eco: CHEER_ECO,
        meta: { friendId: parsed.friendId, friendName: String(friendEntry.displayName ?? "") },
        payloadPatch: { friends: nextFriends, socialStats: nextSocialStats },
        tx: { query, user }
      });

      return { grant, cheersAfter, cheererName };
    });
  } catch (error) {
    console.error("Friend cheer error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }

  if ("early" in outcome) {
    return outcome.early;
  }

  const { grant: cheererGrant, cheersAfter, cheererName } = outcome;

  // Grant to the friend too, plus a notification. Best-effort,
  // AFTER the cheerer's locked transaction committed — never fail the cheerer.
  let friendNotified = false;
  try {
    friendNotified = await transaction(async (query) => {
      const friendResult = await selectUserForUpdate<{
        id: string;
        email: string;
        xp: number | null;
        level: number | null;
        trust_score: number | null;
        payload: Record<string, unknown>;
      }>(query, parsed.friendId);
      if (friendResult.rowCount === 0) return false;

      const friendUser = friendResult.rows[0];
      const friendProfile = friendUser.payload ?? {};
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

      await grantProgression({
        userId: parsed.friendId,
        source: "friend",
        baseXp: 5,
        meta: { cheeredBy: session.userId, cheeredByName: cheererName },
        payloadPatch: { notifications: nextNotifications },
        tx: { query, user: friendUser }
      });
      return true;
    });
  } catch (friendError) {
    console.error("Friend cheer notification error:", friendError);
  }

  return NextResponse.json({
    success: true,
    xpAwarded: CHEER_XP,
    ecoAwarded: CHEER_ECO,
    cheersToday: cheersAfter,
    cheersCap: MAX_CHEERS_PER_DAY,
    friendNotified,
    level: cheererGrant?.level ?? null,
    xp: cheererGrant?.xp ?? null,
    ecoPoints: cheererGrant?.ecoPoints ?? null
  });
}