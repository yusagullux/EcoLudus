import { createHash, randomUUID } from "crypto";
import { sql } from "./db";

type PhotoHashRecord = {
  id: string;
  image_hash: string;
  user_id: string;
  quest_id: string | null;
  created_at: string;
};

export function createImageHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function getExistingPhotoHash(imageHash: string) {
  const result = await sql<PhotoHashRecord>(
    "select id, image_hash, user_id, quest_id, created_at from photo_hashes where image_hash = $1 limit 1",
    [imageHash]
  );

  return result.rows[0] ?? null;
}

export async function savePhotoHash(imageHash: string, userId: string, questId: string | null) {
  await sql(
    "insert into photo_hashes (image_hash, user_id, quest_id) values ($1, $2, $3) on conflict (image_hash) do update set user_id = excluded.user_id, quest_id = excluded.quest_id, created_at = now()",
    [imageHash, userId, questId]
  );
}

export async function verifyImageWithProvider(buffer: Buffer, userId: string, questId: string | null) {
  const endpoint = process.env.PHOTO_VERIFICATION_ENDPOINT;
  const apiKey = process.env.PHOTO_VERIFICATION_API_KEY;

  if (!endpoint || !apiKey) {
    return {
      verified: true,
      warnings: [],
      provider: null
    };
  }

  const base64Image = buffer.toString("base64");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      image: base64Image,
      userId,
      questId
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Photo verification provider returned ${response.status}: ${payload}`);
  }

  const payload = await response.json();

  return {
    verified: Boolean(payload?.verified ?? true),
    warnings: Array.isArray(payload?.warnings) ? payload.warnings.map(String) : [],
    provider: String(payload?.provider ?? endpoint),
    details: payload?.details ?? null
  };
}
