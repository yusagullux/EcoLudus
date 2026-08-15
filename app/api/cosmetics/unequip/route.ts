import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { logError } from "@/lib/logger";

// Unequips a cosmetic slot (frame or background) without removing ownership.
const unequipSchema = z.object({ slot: z.enum(["frame", "background"]) });

type CosmeticsLike = {
  owned?: Array<Record<string, unknown>>;
  equippedFrame?: string | null;
  equippedBackground?: string | null;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof unequipSchema>;
  try {
    parsed = unequipSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "invalid-argument", details: error.flatten() } }, { status: 400 });
    }
    throw error;
  }

  try {
    return await transaction(async (query) => {
      const userResult = await selectUserForUpdate<{ email: string; payload: Record<string, unknown> }>(
        query,
        session.userId!
      );
      if (userResult.rowCount === 0) {
        return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
      }

      const profile = userResult.rows[0].payload ?? {};
      const cosmetics = (profile.cosmetics ?? { owned: [], equippedFrame: null, equippedBackground: null }) as CosmeticsLike;

      const nextCosmetics = {
        ...cosmetics,
        equippedFrame: parsed.slot === "frame" ? null : (cosmetics.equippedFrame ?? null),
        equippedBackground: parsed.slot === "background" ? null : (cosmetics.equippedBackground ?? null)
      };

      const nextProfile: Record<string, unknown> = { ...profile, cosmetics: nextCosmetics };

      await query(
        `insert into users (id, email, password_hash, payload)
         values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
         on conflict (id) do update
         set email = excluded.email,
             payload = excluded.payload,
             updated_at = now()`,
        [session.userId, userResult.rows[0].email, JSON.stringify(nextProfile)]
      );

      return NextResponse.json({ success: true, cosmetics: nextCosmetics });
    });
  } catch (error) {
    logError("Cosmetic unequip error", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}