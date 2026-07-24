import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { uploadAvatar, StorageNotConfiguredError } from "@/lib/supabase-storage";

// Upload (and replace) the authenticated user's profile picture to Supabase
// Storage, then store the public object URL in `payload.profileImage`. The
// client resizes the chosen image to ~256px before uploading, so we enforce a
// modest size cap here. No new npm dependency — this uses Supabase's REST API.

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB post-resize cap

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "auth/unauthenticated" } }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { code: "invalid-argument", message: "No file provided." } }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: { code: "invalid-argument", message: "Picture must be a PNG, JPEG, or WebP image." } },
        { status: 400 }
      );
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: { code: "invalid-argument", message: "Picture is too large (max 2 MB)." } },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();

    let profileImage: string;
    try {
      profileImage = await uploadAvatar(session.userId, buffer, file.type);
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) {
        return NextResponse.json({ error: { code: "storage/not-configured", message: error.message } }, { status: 503 });
      }
      throw error;
    }

    // Persist the public URL into the user's payload.
    const userResult = await sql<{ email: string; payload: Record<string, unknown> }>(
      "select id, email, payload from users where id = $1 limit 1",
      [session.userId]
    );
    if (userResult.rowCount === 0) {
      return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
    }

    const nextProfile = { ...userResult.rows[0].payload, profileImage };
    await sql(
      `insert into users (id, email, password_hash, payload)
       values ($1, $2, coalesce((select password_hash from users where id = $1), ''), $3::jsonb)
       on conflict (id) do update
       set email = excluded.email,
           payload = excluded.payload,
           updated_at = now()`,
      [session.userId, session.email, JSON.stringify(nextProfile)]
    );

    return NextResponse.json({ success: true, profileImage });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}