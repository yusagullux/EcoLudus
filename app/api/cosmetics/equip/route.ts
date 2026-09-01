import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedUser } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
import { logError } from "@/lib/logger";

// Equips an owned cosmetic. Clients send only {cosmeticId, slot}; the server
// is the source of truth for which cosmetic is equipped. The cosmetic must
// already be in the user's `cosmetics.owned` array (chests grant cosmetics;
// there is no separate "buy cosmetic" route), and the slot must match the
// cosmetic's slot. Equipping writes only `cosmetics.equippedFrame` /
// `cosmetics.equippedBackground` — it does not widen CLIENT_WRITABLE_USER_FIELDS
// (cosmetics equip is a dedicated route, not a profile patch).

const equipSchema = z.object({
  cosmeticId: z.string().min(1),
  slot: z.enum(["frame", "background"])
});

type CosmeticsLike = {
  owned?: Array<Record<string, unknown>>;
  equippedFrame?: string | null;
  equippedBackground?: string | null;
};

export async function POST(request: Request) {
  const session = await requireVerifiedUser();
  if (session instanceof NextResponse) return session;

  let parsed: z.infer<typeof equipSchema>;
  try {
    parsed = equipSchema.parse(await request.json());
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
      const owned = Array.isArray(cosmetics.owned) ? cosmetics.owned : [];

      const cosmetic = owned.find((c) => String(c.id) === parsed.cosmeticId);
      if (!cosmetic) {
        return NextResponse.json({ error: { code: "cosmetics/not-owned" } }, { status: 404 });
      }
      if (String(cosmetic.slot ?? "") !== parsed.slot) {
        return NextResponse.json({ error: { code: "cosmetics/slot-mismatch" } }, { status: 400 });
      }

      // "unequip" is expressed as equipping null; but to equip a real cosmetic
      // we set the matching equipped field. Allow equipping null (unequip) by
      // sending a known cosmeticId — clients unequip via a dedicated flag below.
      const nextCosmetics = {
        ...cosmetics,
        owned,
        equippedFrame: parsed.slot === "frame" ? parsed.cosmeticId : (cosmetics.equippedFrame ?? null),
        equippedBackground:
          parsed.slot === "background" ? parsed.cosmeticId : (cosmetics.equippedBackground ?? null)
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
    logError("Cosmetic equip error", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}