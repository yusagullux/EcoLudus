import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedUser } from "@/lib/auth";
import { getQuestCarbonReduction, getQuestDefinition } from "@/lib/carbon-calc";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { getMissingVerifiedQuestProofIds, removeVerifiedQuestProofs } from "@/lib/quest-proof";
import { grantProgression, type ProgressionUser } from "@/lib/progression";
import { consumeBoostersForQuest } from "@/lib/boosters";
import { computeVitals } from "@/lib/pet-vitals";
import { BOOSTER_CATALOG, SEED_CATALOG } from "@/lib/catalog";
import type { LevelUpReward as LevelUpRewardType } from "@/lib/level-system";
import type { Rarity } from "@/components/game-ui";

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

function rarityForLevelReward(level: number): Rarity {
  if (level % 10 === 0) return "legendary";
  if (level % 10 === 5) return "epic";
  if (level % 10 >= 7) return "rare";
  if (level % 10 >= 3) return "uncommon";
  return "common";
}

function applyLevelUpRewards(
  profile: Record<string, unknown>,
  rewards: LevelUpRewardType[]
): { patch: Record<string, unknown>; details: Array<{ label: string; icon: string }> } {
  const patch: Record<string, unknown> = {};
  const details: Array<{ label: string; icon: string }> = [];

  for (const reward of rewards) {
    if (reward.rewardType === "garden_item") {
      const rarity = rarityForLevelReward(reward.level);
      const pool = SEED_CATALOG.filter((s) => s.rarity === rarity);
      const seed = pool[reward.level % Math.max(pool.length, 1)] ?? SEED_CATALOG[0];
      if (seed) {
        const seeds = asArray(profile.seeds).map((entry) => ({ ...(entry as Record<string, unknown>) }));
        const idx = seeds.findIndex((s) => s.name === seed.name);
        const awardedAt = new Date().toISOString();
        if (idx >= 0) {
          seeds[idx] = { ...seeds[idx], count: Number(seeds[idx].count ?? 1) + 1, awardedAt };
        } else {
          seeds.push({ id: seed.id, name: seed.name, rarity: seed.rarity, image: seed.image, count: 1, awardedAt });
        }
        patch.seeds = seeds;
        details.push({ label: `${seed.name}`, icon: "🌱" });
      }
    } else if (reward.rewardType === "team_boost") {
      const def = BOOSTER_CATALOG.find((b) => b.id === "booster-xp-2") ?? BOOSTER_CATALOG[0];
      if (def) {
        const boosters = asArray(profile.boosters).map((entry) => ({ ...(entry as Record<string, unknown>) }));
        const idx = boosters.findIndex((b) => String(b.id) === def.id);
        if (idx >= 0) {
          boosters[idx] = { ...boosters[idx], charges: Number(boosters[idx].charges ?? 0) + def.charges };
        } else {
          boosters.push({
            id: def.id,
            kind: def.kind,
            multiplier: def.multiplier,
            charges: def.charges,
            name: def.name,
            rarity: def.rarity,
            emoji: def.emoji,
            obtainedAt: new Date().toISOString()
          });
        }
        patch.boosters = boosters;
        details.push({ label: `${def.name} (+${def.charges} charges)`, icon: def.emoji });
      }
    } else {
      details.push({ label: `Level ${reward.level} reached`, icon: "⭐" });
    }
  }

  return { patch, details };
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
  // Drift the active pet's vitals to "now" before deciding whether it can
  // assist and before applying mission deltas. This is the fix for the
  // "stuck at 0 energy forever" problem: a pet that spent its energy on
  // yesterday's missions has regenerated by today (energy regenerates over
  // time per computeVitals), so the companion bonus isn't permanently locked
  // out and the canAssist check reflects the rested pet, not the spent one.
  const driftedVitals = computeVitals(currentActivePet ?? null);
  const canAssist = driftedVitals.energy >= 10;
  const companion = currentActivePet
    ? {
        id: currentActivePet.id,
        name: currentActivePet.name,
        canAssist
      }
    : null;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const nextAnimals = animals.map((pet) => {
    if (pet.id !== activePetId) return pet;

    const happiness = driftedVitals.happiness;
    const energy = driftedVitals.energy;
    const bond = clampStat(pet.bond, 10);

    return {
      ...pet,
      active: true,
      happiness: Math.min(100, happiness + missionCount * 3),
      energy: canAssist ? Math.max(0, energy - missionCount * 5) : energy,
      bond: Math.min(100, bond + missionCount * 2),
      missionsTogether: Number(pet.missionsTogether ?? 0) + missionCount,
      lastMissionAt: nowIso,
      vitalsAt: nowIso
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
  const session = await requireVerifiedUser();
  if (session instanceof NextResponse) return session;

  try {
    const payload = completeQuestSchema.parse(await request.json());
    const requestedQuestIds = Array.from(new Set(payload.questIds));

    // Wrap the read→compute→grant→mission_logs in one transaction with a row
    // lock on the user row, so concurrent quest completions on the same user
    // cannot both pass the "already completed today" check against a stale read
    // and double-grant XP/eco, or roll the daily-clear bonus chest twice (the
    // lost-update / double-grant class from the 2026-07-25 audit). grantImpact
    // shares the lock via `tx` (no second read, no nested transaction), and the
    // mission_logs inserts run on the same `query` so they commit atomically
    // with the user write. The quest-definition / carbon lookups use the global
    // pool (not the locked client), so they only serialize same-user
    // completions — the desired behavior — and don't block cross-user traffic.
    // Early 400/404/422 returns inside the callback commit (empty tx) cleanly.
    let questSucceeded = false;
    const result = await transaction(async (query) => {
      const userResult = await selectUserForUpdate<ProgressionUser>(query, session.userId!);

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

      // Fetch every selected quest's definition up front. We need them for the
      // carbon lookup regardless, and resolving them now lets us skip the
      // verified-proof check for honor-system quests (requiresProof === false),
      // which are trivial "invisible action" quests (turn off lights, unplug
      // chargers, etc.) that have no checkable artifact and complete on trust.
      const questDefs = new Map<string, NonNullable<Awaited<ReturnType<typeof getQuestDefinition>>>>();
      for (const questId of questIds) {
        const quest = await getQuestDefinition(questId);
        if (!quest) {
          return NextResponse.json(
            { error: { code: "quests/not-found", questId } },
            { status: 400 }
          );
        }
        questDefs.set(questId, quest);
      }

      const proofRequiredIds = questIds.filter((id) => questDefs.get(id)?.requiresProof !== false);
      const missingVerifiedProofIds = getMissingVerifiedQuestProofIds(profile, proofRequiredIds);
      if (missingVerifiedProofIds.length > 0) {
        return NextResponse.json(
          {
            error: {
              code: "quests/proof-required",
              message: "Please verify proof for each selected quest before completing it.",
              questIds: missingVerifiedProofIds
            }
          },
          { status: 422 }
        );
      }

      const completedAt = new Date();
      const todayKey = dateKey(completedAt);
      const completionRecords = [];

      for (const questId of questIds) {
        const quest = questDefs.get(questId)!;

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

      // Consume boosters (at most one xp + one eco, highest multiplier with
      // charges) and apply their multipliers to the quest rewards. baseImpact
      // stays UNBOOSTED so the spine measures real eco activity, not the
      // booster perk stacked on top of it. The companion bonus is computed from
      // the base quest XP (xpReward) and added after boosting.
      const boosterResult = consumeBoostersForQuest(profile);
      const boostedXp = Math.round(xpReward * boosterResult.xpMul);
      const boostedEco = Math.round(ecoReward * boosterResult.ecoMul);

      const companionProgress = applyCompanionProgress(profile, completionRecords.length, xpReward);
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
      const bonusChest = canRollDailyChest
        ? (Math.random() < DAILY_CLEAR_CHEST_CHANCE ? pickDailyClearChest() : DAILY_CLEAR_CHEST_POOL[0])
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

      // Route the reward write through the spine. XP includes the companion bonus
      // (a perk for the active pet) on top of the boosted XP; Impact is the base
      // quest XP only (unboosted), so the spine measures the actual eco activity,
      // not the booster perk or companion perk on top of it.
      const baseXp = boostedXp + companionProgress.companionXpBonus;
      const patch: Record<string, unknown> = {
        animals: companionProgress.animals,
        missionsCompleted: Number(profile.missionsCompleted || 0) + completionRecords.length,
        completedQuests: nextCompletedQuests,
        dailyQuestsCompleted: nextDailyCompletions,
        dailyQuestCompletions,
        dailyClearChestRewards,
        verifiedQuestProofs: removeVerifiedQuestProofs(profile, questIds).verifiedQuestProofs,
        ...(bonusChest ? { chests: addChest(profile.chests, bonusChest) } : {}),
        ...(boosterResult.consumed.length > 0 ? { boosters: boosterResult.boosters } : {}),
        lastQuestCompletionTime: completedAt.toISOString()
      };

      const granted = await grantProgression({
        userId: session.userId,
        source: "quests",
        baseXp,
        eco: boostedEco,
        carbon: carbonReward,
        meta: {
          questIds,
          count: completionRecords.length,
          companionXpBonus: companionProgress.companionXpBonus
        },
        payloadPatch: patch,
        // Share the locked transaction so the quest completion + reward grant
        // are one atomic unit (no second read, no nested transaction).
        tx: { query, user }
      });

      // Apply concrete rewards for any level thresholds crossed. The spine returns
      // the labels; here we mint the actual seed / booster items inside the same
      // locked transaction so the client cannot forge level-up drops.
      const levelUpRewardDetails = granted && granted.levelUpRewards.length > 0
        ? applyLevelUpRewards({ ...profile, ...patch, xp: granted.xp, level: granted.level, ecoPoints: granted.ecoPoints, carbonReduced: granted.carbonReduced }, granted.levelUpRewards)
        : { patch: {}, details: [] };

      const nextProfile = granted
        ? {
            ...profile,
            ...patch,
            ...levelUpRewardDetails.patch,
            xp: granted.xp,
            level: granted.level,
            ecoPoints: granted.ecoPoints,
            carbonReduced: granted.carbonReduced
          }
        : { ...removeVerifiedQuestProofs(profile, questIds), ...patch };

      for (const completion of completionRecords) {
        await query(
          `insert into mission_logs (id, user_id, payload)
           values ($1, $2, $3::jsonb)
           on conflict (id) do update
           set user_id = excluded.user_id,
               payload = excluded.payload`,
          [completion.id, session.userId, JSON.stringify({ ...completion, userId: session.userId })]
        );
      }

      questSucceeded = true;
      return NextResponse.json({
        success: true,
        profile: nextProfile,
        completed: completionRecords,
        totals: {
          xp: boostedXp,
          companionXpBonus: companionProgress.companionXpBonus,
          ecoPoints: boostedEco,
          carbonReduced: Math.round(carbonReward * 100) / 100
        },
        bonusChest,
        levelUpRewards: granted?.levelUpRewards ?? [],
        levelUpRewardDetails: levelUpRewardDetails.details,
        companion: companionProgress.companion,
        booster: {
          xpMul: boosterResult.xpMul,
          ecoMul: boosterResult.ecoMul,
          consumed: boosterResult.consumed
        }
      });
    });

    // Check milestones async (tree planting) — fire-and-forget, OUTSIDE the
    // transaction so its network calls (Ecologi) don't hold the user row lock.
    // Only fire on a successful completion, not on the early 400/404/422 paths.
    // (Milestone checks removed since impact mechanics were stripped)

    return result;
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
