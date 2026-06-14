import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getQuestCarbonReduction, getQuestDefinition } from "@/lib/carbon-calc";
import { sql } from "@/lib/db";

import { calculateLevel } from "@/lib/level-system";

const completeQuestSchema = z.object({
  questIds: z.array(z.string().min(1)).min(1).max(5)
});

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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
    const payload = completeQuestSchema.parse(await request.json());
    const requestedQuestIds = Array.from(new Set(payload.questIds));

    const userResult = await sql<{
      id: string;
      email: string;
      payload: Record<string, unknown>;
    }>("select id, email, payload from users where id = $1 limit 1", [session.userId]);

    const user = userResult.rows[0];
    if (!user) {
      return NextResponse.json(
        { error: { code: "auth/user-not-found" } },
        { status: 404 }
      );
    }

    const profile = user.payload || {};
    const currentDailyQuests = asArray(profile.currentDailyQuests).map(String);
    const dailyQuestsCompleted = asArray(profile.dailyQuestsCompleted).map(String);
    const completedQuests = asArray(profile.completedQuests).map(String);

    const questIds = requestedQuestIds.filter(
      (questId) => currentDailyQuests.includes(questId) && !dailyQuestsCompleted.includes(questId)
    );

    if (!questIds.length) {
      return NextResponse.json(
        { error: { code: "quests/no-valid-selection" } },
        { status: 400 }
      );
    }

    const completedAt = new Date();
    const todayKey = dateKey(completedAt);
    const completionRecords = [];

    for (const questId of questIds) {
      const quest = await getQuestDefinition(questId);

      if (!quest) {
        return NextResponse.json(
          { error: { code: "quests/not-found", questId } },
          { status: 400 }
        );
      }

      const carbon = await getQuestCarbonReduction(quest);
      completionRecords.push({
        id: randomUUID(),
        questId: quest.id,
        title: quest.title,
        categoryId: quest.categoryId,
        categoryName: quest.categoryName,
        xp: quest.xp,
        ecoPoints: quest.eco,
        carbonReduced: carbon.kg,
        carbonSource: carbon.source,
        carbonSourcePayload: carbon.sourcePayload,
        completedAt: completedAt.toISOString()
      });
    }

    const xpReward = completionRecords.reduce((sum, quest) => sum + quest.xp, 0);
    const ecoReward = completionRecords.reduce((sum, quest) => sum + quest.ecoPoints, 0);
    const carbonReward = completionRecords.reduce((sum, quest) => sum + quest.carbonReduced, 0);
    const nextXp = Number(profile.xp || 0) + xpReward;
    const nextDailyCompletions = Array.from(new Set([...dailyQuestsCompleted, ...questIds]));
    const nextCompletedQuests = Array.from(new Set([...completedQuests, ...questIds]));
    const dailyQuestCompletions = {
      ...((profile.dailyQuestCompletions as Record<string, string[]>) || {}),
      [todayKey]: Array.from(
        new Set([
          ...asArray((profile.dailyQuestCompletions as Record<string, unknown>)?.[todayKey]).map(String),
          ...questIds
        ])
      )
    };

    const nextLevel = calculateLevel(nextXp);
    const nextProfile = {
      ...profile,
      xp: nextXp,
      ecoPoints: Number(profile.ecoPoints || 0) + ecoReward,
      level: nextLevel,
      carbonReduced: Math.round((Number(profile.carbonReduced || 0) + carbonReward) * 100) / 100,
      missionsCompleted: Number(profile.missionsCompleted || 0) + completionRecords.length,
      completedQuests: nextCompletedQuests,
      dailyQuestsCompleted: nextDailyCompletions,
      dailyQuestCompletions,
      lastQuestCompletionTime: completedAt.toISOString()
    };

    await sql(
      `insert into users (id, email, password_hash, xp, level, payload)
       values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $4, $5, $3::jsonb)
       on conflict (id) do update
       set email = excluded.email,
           xp = excluded.xp,
           level = excluded.level,
           payload = excluded.payload,
           updated_at = now()`,
      [session.userId, session.email, JSON.stringify(nextProfile), nextXp, nextLevel]
    );

    for (const completion of completionRecords) {
      await sql(
        `insert into mission_logs (id, user_id, payload)
         values ($1, $2, $3::jsonb)
         on conflict (id) do update
         set user_id = excluded.user_id,
             payload = excluded.payload`,
        [completion.id, session.userId, JSON.stringify({ ...completion, userId: session.userId })]
      );
    }

    return NextResponse.json({
      success: true,
      profile: nextProfile,
      completed: completionRecords,
      totals: {
        xp: xpReward,
        ecoPoints: ecoReward,
        carbonReduced: Math.round(carbonReward * 100) / 100
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid-argument", details: error.flatten() } },
        { status: 400 }
      );
    }

    console.error("Quest completion error:", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}
