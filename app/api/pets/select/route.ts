import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedUser } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";

// Server-validated active-companion selection. The pets and collection pages
// used to write `animals` (with `active` flags) + `activePet` straight through
// `updateUserProfile` — an unlocked full-payload overwrite that (a) clobbered
// concurrent care grants on the same row, and (b) on the pets page persisted the
// *client-drifted* happiness/energy/bond (computed by computeVitals for display)
// back as canonical stats. This route owns the switch: it locks the row,
// validates the pet exists in the user's `animals`, and toggles ONLY the
// `active` flag on the existing canonical rows (stats are never touched), then
// sets `activePet`. Cosmetic drift stays display-only, as intended.

const selectSchema = z.object({
  petId: z.string().min(1)
});

export async function POST(request: Request) {
  const session = await requireVerifiedUser();
  if (session instanceof NextResponse) return session;

  let parsed: z.infer<typeof selectSchema>;
  try {
    parsed = selectSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    return await transaction(async (query) => {
      const result = await selectUserForUpdate<{ payload: Record<string, unknown> }>(query, session.userId!);
      const locked = result.rows[0];
      if (!locked) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const profile = locked.payload ?? {};
      const animals = Array.isArray(profile.animals)
        ? (profile.animals as Array<Record<string, unknown>>).map((pet) => ({ ...pet }))
        : [];

      const pet = animals.find((entry) => String(entry.id) === parsed.petId);
      if (!pet) {
        return NextResponse.json({ error: { code: "pets/not-found" } }, { status: 404 });
      }

      // Toggle only the `active` flag on the canonical rows — never touch stats.
      const nextAnimals = animals.map((entry) => ({
        ...entry,
        active: String(entry.id) === parsed.petId
      }));

      const nextPayload = { ...profile, animals: nextAnimals, activePet: parsed.petId };
      await query("update users set payload = $1::jsonb, updated_at = now() where id = $2", [
        JSON.stringify(nextPayload),
        session.userId
      ]);

      return NextResponse.json({
        success: true,
        petId: parsed.petId,
        animals: nextAnimals,
        activePet: parsed.petId
      });
    });
  } catch (error) {
    console.error("Pet select error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}