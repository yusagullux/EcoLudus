import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

const settingsSchema = z.object({
  emailWeeklyReport: z.boolean().optional()
});

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated" } },
      { status: 401 }
    );
  }

  try {
    const body = settingsSchema.parse(await request.json());

    // Read current payload
    const userResult = await sql<{ payload: Record<string, unknown> }>(
      "select id, email, payload from users where id = $1 limit 1",
      [session.userId]
    );

    const user = userResult.rows[0];
    if (!user) {
      return NextResponse.json(
        { error: { code: "auth/user-not-found" } },
        { status: 404 }
      );
    }

    const nextPayload = {
      ...user.payload,
      ...(body.emailWeeklyReport !== undefined && {
        emailWeeklyReport: body.emailWeeklyReport
      })
    };

    await sql(
      `insert into users (id, email, password_hash, payload)
       values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
       on conflict (id) do update
       set email = excluded.email,
           payload = excluded.payload,
           updated_at = now()`,
      [session.userId, session.email, JSON.stringify(nextPayload)]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid-argument", details: error.flatten() } },
        { status: 400 }
      );
    }

    console.error("Settings update error:", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}
