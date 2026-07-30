import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";

const settingsSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(32, "Name must be 32 characters or fewer")
    .optional(),
  emailWeeklyReport: z.boolean().optional(),
  // null removes the picture; a string sets it (a Supabase Storage public URL).
  profileImage: z.string().max(2048).nullable().optional()
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  try {
    const body = settingsSchema.parse(await request.json());

    // Read+write under a row lock so a concurrent reward grant on the same row
    // isn't clobbered by this full-payload write (lost-update class, audit M7).
    // The write uses the file-DB-covered "update users set payload = … where id"
    // string and shallow-merges over the locked payload, preserving economy.
    let notFound = false;
    await transaction(async (query) => {
      const result = await selectUserForUpdate<{ payload: Record<string, unknown> }>(
        query,
        session.userId!
      );
      const locked = result.rows[0];
      if (!locked) {
        notFound = true;
        return;
      }

      const nextPayload: Record<string, unknown> = { ...locked.payload };

      if (body.displayName !== undefined) {
        nextPayload.displayName = body.displayName;
      }
      if (body.emailWeeklyReport !== undefined) {
        nextPayload.emailWeeklyReport = body.emailWeeklyReport;
      }
      if (body.profileImage !== undefined) {
        if (body.profileImage === null) {
          delete nextPayload.profileImage;
        } else {
          nextPayload.profileImage = body.profileImage;
        }
      }

      await query("update users set payload = $1::jsonb, updated_at = now() where id = $2", [
        JSON.stringify(nextPayload),
        session.userId
      ]);
    });

    if (notFound) {
      return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid-argument", details: error.flatten() } },
        { status: 400 }
      );
    }
    console.error("Settings update error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}
