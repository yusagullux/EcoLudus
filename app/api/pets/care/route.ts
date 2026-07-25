import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { grantImpact, type ImpactUser } from "@/lib/impact-service";
import { computeVitals } from "@/lib/pet-vitals";

// Server-validated pet care. The pets page used to mutate XP/eco/stat fields
// straight through `updateUserProfile`, which was trivially forgeable (a client
// could send any XP/eco it wanted). This route owns the care mutation:
// it validates the pet exists, enforces the 5/day eco-reward cap per pet, applies
// the stat bumps, and routes any XP/eco through the spine. Pet care is a *small*
// daily reward, so it grants XP (and eco for paid actions) but Impact is left at
// 0 here — the companion biome grows from real eco activity, not from snacking
// (see the gamification plan: "Pet care boosts vitality, not biome").

const careSchema = z.object({
  petId: z.string().min(1),
  action: z.enum(["snack", "train", "play", "pet"])
});

// Mirrors the constants in app/(game)/pets/page.tsx — single source of truth
// lives here now (server-enforced). The client no longer decides reward amounts.
const ACTION_TABLE: Record<string, { stat: "energy" | "bond" | "happiness"; amount: number; cost: number; xp: number; eco: number }> = {
  snack: { stat: "energy", amount: 18, cost: 8, xp: 8, eco: 0 },
  train: { stat: "bond", amount: 12, cost: 0, xp: 18, eco: 4 },
  play: { stat: "happiness", amount: 14, cost: 4, xp: 12, eco: 2 },
  pet: { stat: "happiness", amount: 2, cost: 0, xp: 2, eco: 0 } // free "pet" tap
};

const MAX_ECO_ACTIONS_PER_DAY = 5;

// The free `pet` tap (no eco cost/reward) still grants +2 XP. Without a cap that
// is an unlimited XP farm — a client loops POST {action:"pet"} for free XP with
// no cooldown and no daily limit (the eco cap above only fires when
// action.eco > 0). Bound it: each pet grants pet-XP at most this many times per
// day. Taps past the cap still bump happiness and emit hearts (the feel-good
// free interaction is preserved) — only the XP stops. Per-pet counter stored
// alongside the existing care fields (freeform jsonb, no migration).
const MAX_PET_XP_PER_DAY = 10;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function clampStat(value: unknown, fallback: number) {
  return Math.max(0, Math.min(100, Number(value ?? fallback) || fallback));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof careSchema>;
  try {
    parsed = careSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    // Read → cap-check → compute → grant inside one transaction with a row lock
    // on the user row. This makes the per-pet daily eco cap and the per-pet
    // daily XP cap race-proof (concurrent care requests can no longer both
    // pass the cap against a stale read — the lost-update / cap-bypass class
    // from the 2026-07-25 audit) and shares the lock with grantImpact's write
    // via `tx` (no second read, no nested transaction). Early 400/404/429
    // returns inside the callback commit (empty tx) cleanly.
    return await transaction(async (query) => {
      const userResult = await selectUserForUpdate<ImpactUser>(query, session.userId!);
      if (userResult.rowCount === 0) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const user = userResult.rows[0];
      const profile = user.payload ?? {};
      const animals = Array.isArray(profile.animals)
        ? (profile.animals as Array<Record<string, unknown>>).map((pet) => ({ ...pet }))
        : [];

      const pet = animals.find((entry) => String(entry.id) === parsed.petId) ?? null;
      if (!pet) {
        return NextResponse.json({ error: { code: "pets/not-found" } }, { status: 404 });
      }

      const action = ACTION_TABLE[parsed.action];
      const today = todayKey();
      const lastCareDate = String(pet.lastCareDate ?? "");
      const isNewCareDay = lastCareDate !== today;
      const careActionsToday = isNewCareDay ? 0 : Math.max(0, Number(pet.careActionsToday ?? 0));

      // Enforce the daily eco-reward cap server-side (the whole point of moving this here).
      if (action.eco > 0 && careActionsToday >= MAX_ECO_ACTIONS_PER_DAY) {
        return NextResponse.json(
          { error: { code: "pets/eco-cap-reached", message: `Daily eco reward limit reached for this companion (${MAX_ECO_ACTIONS_PER_DAY}/day).` } },
          { status: 429 }
        );
      }

      // Free `pet` taps are bounded by a per-pet daily XP cap (see MAX_PET_XP_PER_DAY).
      const petXpToday = isNewCareDay ? 0 : Math.max(0, Number(pet.petXpToday ?? 0));
      const petXpEligible = parsed.action !== "pet" || petXpToday < MAX_PET_XP_PER_DAY;
      // XP only for the pet action when still under the daily cap; other actions
      // always grant their full XP.
      const xpToGrant = parsed.action === "pet" ? (petXpEligible ? action.xp : 0) : action.xp;

      // Validate the eco cost can be paid.
      const currentEco = Math.max(0, Number(profile.ecoPoints ?? 0) || 0);
      if (action.cost > 0 && currentEco < action.cost) {
        return NextResponse.json(
          { error: { code: "pets/insufficient-eco", message: `Need ${action.cost} EcoPoints for this action.` } },
          { status: 400 }
        );
      }

      const ecoGained = action.eco > 0 && careActionsToday < MAX_ECO_ACTIONS_PER_DAY ? action.eco : 0;

      const now = Date.now();
      const nextAnimals = animals.map((entry) => {
        if (String(entry.id) !== parsed.petId) return entry;
        // Drift the stored vitals to "now" first (authoritative), then apply the
        // action delta on top, then re-anchor `vitalsAt` so the client's own
        // computeVitals matches between interactions. Bond doesn't drift, so the
        // bond action reads from the clamped stored value.
        const drifted = computeVitals(entry, now);
        const currentStatValue =
          action.stat === "bond" ? clampStat(entry.bond, 10) : action.stat === "energy" ? drifted.energy : drifted.happiness;
        return {
          ...entry,
          [action.stat]: Math.min(100, currentStatValue + action.amount),
          happiness: Math.min(
            100,
            drifted.happiness + (action.stat === "happiness" ? 0 : 4)
          ),
          energy: action.stat === "energy" ? Math.min(100, drifted.energy + action.amount) : drifted.energy,
          petsGiven: Number(entry.petsGiven ?? 0) + 1,
          careActionsToday: careActionsToday + 1,
          petXpToday: parsed.action === "pet" ? (petXpEligible ? petXpToday + 1 : Number(entry.petXpToday ?? 0)) : Number(entry.petXpToday ?? 0),
          careStreak: isNewCareDay ? Number(entry.careStreak ?? 0) + 1 : Number(entry.careStreak ?? 0),
          lastCareDate: today,
          lastPettedAt: new Date(now).toISOString(),
          vitalsAt: new Date(now).toISOString()
        };
      });

      const granted = await grantImpact({
        userId: session.userId,
        source: "petCare",
        baseXp: xpToGrant,
        baseImpact: 0, // pet care feeds vitality (Phase 2), not the spine
        eco: ecoGained - action.cost, // net eco delta (reward minus cost)
        meta: { action: parsed.action, petId: parsed.petId, petName: String(pet.name ?? "") },
        payloadPatch: { animals: nextAnimals },
        // Share the locked transaction so the cap checks + grant are atomic.
        tx: { query, user }
      });

      return NextResponse.json({
        success: true,
        action: parsed.action,
        petId: parsed.petId,
        xpAwarded: xpToGrant,
        petXpCapReached: parsed.action === "pet" && !petXpEligible,
        ecoGained,
        ecoSpent: action.cost,
        careActionsToday: careActionsToday + 1,
        ecoCapReached: careActionsToday + 1 >= MAX_ECO_ACTIONS_PER_DAY && action.eco > 0,
        level: granted?.level ?? null,
        xp: granted?.xp ?? null,
        ecoPoints: granted?.ecoPoints ?? currentEco - action.cost + ecoGained
      });
    });
  } catch (error) {
    console.error("Pet care error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}