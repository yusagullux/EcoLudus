import { transaction, selectUserForUpdate } from "@/lib/db";

export type QuestProofMethod = "text" | "photo";

export type VerifiedQuestProof = {
  questId: string;
  method: QuestProofMethod;
  verifiedAt: string;
  resetKey: string | null;
  confidence: number;
  provider?: string | null;
  warnings?: string[];
};

type UserPayloadRow = {
  id: string;
  email: string;
  payload: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getVerifiedQuestProofs(profile: Record<string, unknown>) {
  return asRecord(profile.verifiedQuestProofs);
}

export async function markQuestProofVerified(
  userId: string,
  questId: string,
  proof: Omit<VerifiedQuestProof, "questId" | "verifiedAt" | "resetKey">
) {
  // Lock the user row and recompute verifiedQuestProofs from the locked payload,
  // then write via the covered "update users set payload = … where id = …" string.
  // The old unlocked full-payload overwrite raced concurrent reward grants on the
  // same row (lost-update class, audit H7). Shallow-merging over the locked
  // payload preserves all economy state; only verifiedQuestProofs changes.
  return transaction(async (query) => {
    const userResult = await selectUserForUpdate<UserPayloadRow>(query, userId);
    const user = userResult.rows[0];

    if (!user) {
      return null;
    }

    const profile = user.payload || {};
    const verifiedQuestProofs = {
      ...getVerifiedQuestProofs(profile),
      [questId]: {
        ...proof,
        questId,
        verifiedAt: new Date().toISOString(),
        resetKey: typeof profile.lastQuestResetTime === "string" ? profile.lastQuestResetTime : null
      }
    };

    const nextProfile = {
      ...profile,
      verifiedQuestProofs
    };

    await query(
      "update users set payload = $1::jsonb, updated_at = now() where id = $2",
      [JSON.stringify(nextProfile), userId]
    );

    return nextProfile;
  });
}

export function getMissingVerifiedQuestProofIds(
  profile: Record<string, unknown>,
  questIds: string[]
) {
  const verifiedQuestProofs = getVerifiedQuestProofs(profile);
  const resetKey = typeof profile.lastQuestResetTime === "string" ? profile.lastQuestResetTime : null;

  return questIds.filter((questId) => {
    const proof = asRecord(verifiedQuestProofs[questId]);
    if (!proof.verifiedAt) return true;
    return proof.resetKey !== resetKey;
  });
}

export function removeVerifiedQuestProofs(
  profile: Record<string, unknown>,
  questIds: string[]
) {
  const verifiedQuestProofs = { ...getVerifiedQuestProofs(profile) };
  for (const questId of questIds) {
    delete verifiedQuestProofs[questId];
  }

  return {
    ...profile,
    verifiedQuestProofs
  };
}
