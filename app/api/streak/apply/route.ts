import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { applyDailyStreak, applyStreakRewards, type StreakReward } from "@/lib/streak";
import { grantProgression, type ProgressionUser } from "@/lib/progression";

// Daily-reset reward grant for streak milestones. The dashboard used to compute
// these client-side and write eco/eggs straight through `updateUserProfile`, which
// was trivially forgeable. This route is the only place streak milestone rewards
// are granted: it runs the streak counter + milestone logic server-side and
// persists via the progression service (eco grant + egg payload land in one atomic
// write). Quest *selection* still happens client-side; only the *reward* moved.
//
// Returns the granted milestone (if any) so the dashboard can surface the toast.

type StreakApplyResponse = {
  streak: number;
  longestStreak: number;
  granted: StreakReward | null;
};

export async function POST() {
  const session = await requireVerifiedUser();
  if (session instanceof NextResponse) return session;

  try {
    return await transaction(async (query) => {
      const result = await selectUserForUpdate<ProgressionUser>(query, session.userId!);
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

      await grantProgression({
        userId: session.userId,
        source: "streak",
        baseXp: 0,
        eco: ecoGrant,
        meta: granted ? { milestone: granted.day, type: granted.type } : { milestone: 0 },
        payloadPatch: patch,
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