import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { applyDailyStreak, applyStreakRewards, type StreakReward } from "@/lib/streak";
import { grantImpact, type ImpactUser } from "@/lib/impact-service";

// Daily-reset reward grant for streak milestones. The dashboard used to compute
// these client-side and write eco/eggs straight through `updateUserProfile`, which
// was trivially forgeable. This route is the only place streak milestone rewards
// are granted: it runs the streak counter + milestone logic server-side and
// persists via the impact service (eco grant + egg payload land in one atomic
// write). Quest *selection* still happens client-side; only the *reward* moved.
//
// Returns the granted milestone (if any) so the dashboard can surface the toast.

type StreakApplyResponse = {
  streak: number;
  longestStreak: number;
  granted: StreakReward | null;
};

export async function POST() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  try {
    // Read → streak-eval → grant inside one transaction with a row lock on the
    // user row. The `lastStreakRewardDay` idempotency guard is checked against
    // the locked row, so two concurrent same-day apply calls can no longer both
    // pass "not yet rewarded today" and double-grant the milestone eco/egg
    // (the lost-update class fixed in the other reward routes — see the
    // reward-routes-lost-update note). grantImpact shares the lock via `tx`
    // (no re-read, no nested transaction). Early 404 returns inside the
    // callback commit (empty tx) cleanly.
    return await transaction(async (query) => {
      const result = await selectUserForUpdate<ImpactUser>(query, session.userId!);
      if (result.rowCount === 0) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const user = result.rows[0];
      const payload = user.payload ?? {};
      const now = new Date();

      // 1. Advance the streak counter for the day (idempotent same-day).
      const streakPayload = applyDailyStreak(payload, now);

      // 2. Evaluate milestone rewards (idempotent via lastStreakRewardDay).
      const { payload: rewardedPayload, granted } = applyStreakRewards(streakPayload, now);

      // 3. Persist in one atomic write via the spine. Eco grants flow through the
      //    impact service so the egg payload and the (optional) impact/eco delta
      //    can't be split. Impact per milestone = the milestone day, so streaks
      //    feed the same number the hooks consume.
      const streakImpact = granted ? granted.day : 0;
      const ecoGrant = granted?.type === "eco" ? Number(granted.amount ?? 0) : 0;

      const patch: Record<string, unknown> = {
        currentStreak: streakPayload.currentStreak,
        longestStreak: streakPayload.longestStreak,
        lastLoginDate: streakPayload.lastLoginDate,
        lastStreakRewardDay: rewardedPayload.lastStreakRewardDay ?? streakPayload.lastStreakRewardDay ?? payload.lastStreakRewardDay
      };
      if (granted?.type === "egg") {
        patch.eggs = rewardedPayload.eggs;
      }

      await grantImpact({
        userId: session.userId,
        source: "streak",
        baseXp: 0,
        baseImpact: streakImpact,
        eco: ecoGrant,
        meta: granted ? { milestone: granted.day, type: granted.type } : { milestone: 0 },
        payloadPatch: patch,
        // Share the locked transaction so the streak state + reward grant are
        // one atomic unit.
        tx: { query, user }
      });

      const response: StreakApplyResponse = {
        streak: Number(streakPayload.currentStreak ?? 0),
        longestStreak: Number(streakPayload.longestStreak ?? 0),
        granted
      };

      return NextResponse.json(response);
    });
  } catch (error) {
    console.error("Streak apply error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}