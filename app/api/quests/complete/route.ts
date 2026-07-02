import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getQuestCarbonReduction, getQuestDefinition } from "@/lib/carbon-calc";
import { sql } from "@/lib/db";
import { calculateLevel } from "@/lib/level-system";
import { checkAndProcessMilestones } from "@/lib/rewards-sync";

const completeQuestSchema = z.object({
  questIds: z.array(z.string().min(1)).min(1).max(5)
});

const DAILY_CLEAR_CHEST_CHANCE = 0.35;

const DAILY_CLEAR_CHEST_POOL = [
  {
    id: 1,
    name: "Wooden Chest",
    rarity: "common",
    price: 0,
    image: "/images/chests/wooden-chest.png",
    weight: 60
  },
  {
    id: 2,
    name: "Bronze Chest",
    rarity: "rare",
    price: 0,
    image: "/images/chests/bronze-chest.png",
    weight: 30
  },
  {
    id: 3,
    name: "Silver Chest",
    rarity: "epic",
    price: 0,
    image: "/images/chests/silver-chest.png",
    weight: 9
  },
  {
    id: 4,
    name: "Golden Chest",
    rarity: "legendary",
    price: 0,
    image: "/images/chests/golden-chest.png",
    weight: 1
  }
];

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clampStat(value: unknown, fallback: number) {
  return Math.max(0, Math.min(100, Number(value ?? fallback) || fallback));
}

function pickDailyClearChest() {
  const totalWeight = DAILY_CLEAR_CHEST_POOL.reduce((sum, chest) => sum + chest.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const chest of DAILY_CLEAR_CHEST_POOL) {
    roll -= chest.weight;
    if (roll <= 0) {
      const { weight, ...reward } = chest;
      return reward;
    }
  }

  const { weight, ...fallback } = DAILY_CLEAR_CHEST_POOL[0];
  return fallback;
}

function addChest(chests: unknown, chest: ReturnType<typeof pickDailyClearChest>) {
  const nextChests = asArray(chests).map((entry) => ({ ...(entry as Record<string, unknown>) }));
  const existingIdx = nextChests.findIndex((entry) => entry.name === chest.name || entry.id === chest.id);
  const awardedAt = new Date().toISOString();

  if (existingIdx >= 0) {
    nextChests[existingIdx] = {
      ...nextChests[existingIdx],
      count: Number(nextChests[existingIdx].count ?? 1) + 1,
      awardedAt
    };
  } else {
    nextChests.push({
      ...chest,
      count: 1,
      awardedAt
    });
  }

  return nextChests;
}

function applyCompanionProgress(
  profile: Record<string, unknown>,
  missionCount: number,
  baseXpReward: number
) {
  const animals = asArray(profile.animals) as Array<Record<string, unknown>>;
  const activePetId = typeof profile.activePet === "string"
    ? profile.activePet
    : String(animals.find((pet) => pet.active)?.id ?? "");

  if (!activePetId || animals.length === 0) {
    return {
      animals,
      companion: null,
      companionXpBonus: 0
    };
  }

  const currentActivePet = animals.find((pet) => pet.id === activePetId) ?? null;
  const canAssist = clampStat(currentActivePet?.energy, 50) >= 10;
  const companion = currentActivePet
    ? {
        id: currentActivePet.id,
        name: currentActivePet.name,
        canAssist
      }
    : null;

  const nextAnimals = animals.map((pet) => {
    if (pet.id !== activePetId) return pet;

    const happiness = clampStat(pet.happiness, 50);
    const energy = clampStat(pet.energy, 50);
    const bond = clampStat(pet.bond, 10);

    return {
      ...pet,
      active: true,
      happiness: Math.min(100, happiness + missionCount * 3),
      energy: canAssist ? Math.max(0, energy - missionCount * 5) : energy,
      bond: Math.min(100, bond + missionCount * 2),
      missionsTogether: Number(pet.missionsTogether ?? 0) + missionCount,
      lastMissionAt: new Date().toISOString()
    };
  });

  const activePet = nextAnimals.find((pet) => pet.id === activePetId);
  const bond = clampStat(activePet?.bond, 10);
  const happiness = clampStat(activePet?.happiness, 50);
  const bonusRate = canAssist ? Math.min(0.12, 0.03 + Math.floor(bond / 25) * 0.02 + Math.floor(happiness / 50) * 0.01) : 0;
  const companionXpBonus = Math.round(baseXpReward * bonusRate);

  return {
    animals: nextAnimals,
    companion,
    companionXpBonus
  };
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
    const companionProgress = applyCompanionProgress(profile, completionRecords.length, xpReward);
    const nextXp = Number(profile.xp || 0) + xpReward + companionProgress.companionXpBonus;
    const nextDailyCompletions = Array.from(new Set([...dailyQuestsCompleted, ...questIds]));
    const nextCompletedQuests = Array.from(new Set([...completedQuests, ...questIds]));
    const dailyClearChestRewards = {
      ...((profile.dailyClearChestRewards as Record<string, unknown>) || {})
    };
    const didClearAllDailyQuests =
      currentDailyQuests.length > 0 &&
      currentDailyQuests.every((questId) => nextDailyCompletions.includes(questId));
    const wasAlreadyClear =
      currentDailyQuests.length > 0 &&
      currentDailyQuests.every((questId) => dailyQuestsCompleted.includes(questId));
    const canRollDailyChest = didClearAllDailyQuests && !wasAlreadyClear && !dailyClearChestRewards[todayKey];
    const bonusChest = canRollDailyChest && Math.random() < DAILY_CLEAR_CHEST_CHANCE
      ? pickDailyClearChest()
      : null;

    if (canRollDailyChest) {
      dailyClearChestRewards[todayKey] = bonusChest
        ? { awarded: true, chest: bonusChest.name, awardedAt: completedAt.toISOString() }
        : { awarded: false, rolledAt: completedAt.toISOString() };
    }

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
      animals: companionProgress.animals,
      carbonReduced: Math.round((Number(profile.carbonReduced || 0) + carbonReward) * 100) / 100,
      missionsCompleted: Number(profile.missionsCompleted || 0) + completionRecords.length,
      completedQuests: nextCompletedQuests,
      dailyQuestsCompleted: nextDailyCompletions,
      dailyQuestCompletions,
      dailyClearChestRewards,
      ...(bonusChest ? { chests: addChest(profile.chests, bonusChest) } : {}),
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

    // Check milestones async (tree planting) — non-blocking, don't fail the request
    checkAndProcessMilestones(session.userId).catch((err) =>
      console.error("Milestone check after quest completion failed:", err)
    );

    return NextResponse.json({
      success: true,
      profile: nextProfile,
      completed: completionRecords,
      totals: {
        xp: xpReward,
        companionXpBonus: companionProgress.companionXpBonus,
        ecoPoints: ecoReward,
        carbonReduced: Math.round(carbonReward * 100) / 100
      },
      bonusChest,
      companion: companionProgress.companion
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
