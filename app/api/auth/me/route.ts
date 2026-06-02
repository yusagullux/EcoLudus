import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ user: null });
  }

  const result = await sql<{
    id: string;
    email: string;
    payload: Record<string, unknown>;
  }>("select id, email, payload from users where id = $1 limit 1", [session.userId]);

  const user = result.rows[0];
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      uid: user.id,
      email: user.email,
      displayName: String(user.payload.displayName ?? user.email.split("@")[0])
    }
  });
}
