import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { transaction, selectUserForUpdate } from "@/lib/db";
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

    // Persist the public URL into the user's payload. The storage upload already
    // happened (network, outside any lock); this just records the resulting URL.
    // Read+write under a row lock so a concurrent reward grant on the same row
    // isn't clobbered by the full-payload write (lost-update class, audit M7).
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
      const nextProfile = { ...locked.payload, profileImage };
      await query("update users set payload = $1::jsonb, updated_at = now() where id = $2", [
        JSON.stringify(nextProfile),
        session.userId
      ]);
    });
    if (notFound) {
      return NextResponse.json({ error: { code: "auth/user-not-found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, profileImage });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: { code: "internal-error" } }, { status: 500 });
  }
}