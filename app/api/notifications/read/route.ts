import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { markNotificationsRead } from "@/lib/notifications-server";

// Mark notification(s) read. The client never read-modify-writes the profile
// payload itself — it POSTs `{ id }` (one item) or `{ all: true }` (every unread
// item) and this route performs the atomic, row-locked update server-side (same
// `SELECT … FOR UPDATE` + `UPDATE_USER_PAYLOAD` pattern the generators use), so
// a concurrent generator append cannot be dropped. See
// `docs/superpowers/specs/2026-08-11-notifications-design.md` (Approach B).

const readSchema = z
  .object({
    id: z.string().optional(),
    all: z.boolean().optional()
  })
  .refine(
    (d) =>
      (d.all === true && !d.id) ||
      (!d.all && typeof d.id === "string" && d.id.length > 0),
    { message: "Provide exactly one of `id` or `all`." }
  );

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  let parsed: z.infer<typeof readSchema>;
  try {
    parsed = readSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid-argument", details: error.flatten() } },
        { status: 400 }
      );
    }
    throw error;
  }

  try {
    const opts = parsed.all ? { all: true } : { id: parsed.id };
    const updated = await markNotificationsRead(session.userId, opts);

    // `updated: 0` is idempotent success — nothing matched or all were already read.
    return NextResponse.json({ success: true, updated });
  } catch (error) {
    logError("Notifications read error", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}