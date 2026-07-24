// Minimal Supabase Storage client via the REST API (no @supabase/supabase-js
// dependency). The app already runs on Supabase Postgres (the DATABASE_URL host
// is `db.<project-ref>.supabase.co`), so Storage is available; we just need the
// service role key (set as SUPABASE_SERVICE_ROLE_KEY) to write server-side.
//
// Avatars are stored at `avatars/<userId>.png` in a public bucket and referenced
// by their public object URL, which we save into the user's `payload.profileImage`.
// Keeping the avatar out of the jsonb payload keeps `getAllUsers` responses small.

const BUCKET = "avatars";

export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new StorageNotConfiguredError(
      "Avatar storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY (and optionally SUPABASE_URL) to enable profile pictures."
    );
  }
  return key;
}

// Resolve the Supabase project URL. Prefer SUPABASE_URL; otherwise derive it
// from the Postgres DATABASE_URL host (`db.<ref>.supabase.co` → `https://<ref>.supabase.co`).
function getProjectUrl(): string {
  const explicit = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || "";
  try {
    const parsed = new URL(dbUrl);
    let host = parsed.hostname;
    if (host.startsWith("db.")) host = host.slice(3);
    if (host && host.includes("supabase.co")) return `https://${host}`;
  } catch {
    // fall through
  }
  throw new StorageNotConfiguredError(
    "Could not determine the Supabase project URL. Set SUPABASE_URL (e.g. https://<project-ref>.supabase.co)."
  );
}

function authHeaders(): Record<string, string> {
  const key = getServiceRoleKey();
  return {
    Authorization: `Bearer ${key}`,
    apikey: key
  };
}

// Create the public `avatars` bucket if it doesn't already exist. Safe to call
// on every upload — ignores "already exists" responses.
export async function ensureAvatarsBucket(): Promise<void> {
  const url = `${getProjectUrl()}/storage/v1/bucket`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true })
  });
  // 409 = bucket already exists; that's the success path on repeat uploads.
  if (!res.ok && res.status !== 409) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Could not create avatars bucket (status ${res.status}): ${detail.slice(0, 200)}`);
  }
}

// Upload (upsert) the avatar bytes for a user. Returns the public object URL,
// cache-busted with a version query so re-uploads immediately invalidate the
// previous image in browsers/CDN.
export async function uploadAvatar(userId: string, body: ArrayBuffer, contentType: string): Promise<string> {
  const projectUrl = getProjectUrl();
  const objectPath = `${BUCKET}/${userId}.png`;
  const upsertUrl = `${projectUrl}/storage/v1/object/${objectPath}`;

  const res = await fetch(upsertUrl, {
    method: "PUT",
    headers: {
      ...authHeaders(),
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "public,max-age=31536000,immutable"
    },
    body
  });

  if (res.status === 404) {
    // Bucket missing — create it and retry once.
    await ensureAvatarsBucket();
    const retry = await fetch(upsertUrl, {
      method: "PUT",
      headers: {
        ...authHeaders(),
        "Content-Type": contentType,
        "x-upsert": "true",
        "cache-control": "public,max-age=31536000,immutable"
      },
      body
    });
    if (!retry.ok) {
      const detail = await retry.text().catch(() => "");
      throw new Error(`Avatar upload failed after bucket create (status ${retry.status}): ${detail.slice(0, 200)}`);
    }
  } else if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Avatar upload failed (status ${res.status}): ${detail.slice(0, 200)}`);
  }

  const version = Date.now();
  return `${projectUrl}/storage/v1/object/public/${BUCKET}/${userId}.png?v=${version}`;
}