import { createHash } from "crypto";
import { sql } from "./db";

// ── Key format detection ──────────────────────────────────────────────────────
// Google AI Studio now issues two key formats:
//   - Legacy "standard" keys: start with "AIza" — sent via ?key= query param
//   - New "auth" keys (June 2026+): start with "AQ."  — sent via Authorization: Bearer header
// Both use the same Gemini API endpoint, just different auth methods.

function getGeminiEndpoint(model: string, key: string): { url: string; headers: Record<string, string> } {
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  if (key.startsWith("AIza")) {
    // Legacy standard key — query param auth
    return {
      url: `${base}?key=${encodeURIComponent(key)}`,
      headers: { "Content-Type": "application/json" }
    };
  }
  // New auth key (AQ. prefix) — Bearer token auth
  return {
    url: base,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    }
  };
}

// ── Startup warning ───────────────────────────────────────────────────────────
function warnIfKeyMissing() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    console.warn(
      "[EcoLudus] GEMINI_API_KEY is not set — AI verification disabled. " +
      "Get a free key at https://aistudio.google.com/app/apikey"
    );
  }
}

if (typeof process !== "undefined" && process.env) {
  warnIfKeyMissing();
}

// ── DB helpers ────────────────────────────────────────────────────────────────
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

// ── Photo verification via Gemini ─────────────────────────────────────────────
export async function verifyImageWithProvider(
  buffer: Buffer,
  userId: string,
  questId: string | null,
  questTitle: string | null = null,
  mimeType: string | null = null
) {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!geminiApiKey) {
    return {
      verified: false,
      warnings: [],
      provider: null,
      details: "Photo verification requires a Gemini API key. Please add GEMINI_API_KEY to your environment, or use text proof instead."
    };
  }

  try {
    const base64Image = buffer.toString("base64");
    const resolvedMimeType = mimeType || "image/jpeg";
    const { url, headers } = getGeminiEndpoint(geminiModel, geminiApiKey);

    let detailsText = "";
    if (questId) {
      try {
        const { getQuestDefinition } = await import("./carbon-calc");
        const questDef = await getQuestDefinition(questId);
        if (questDef) {
          detailsText = `\nQuest Category: ${questDef.categoryName}\nQuest Description: ${questDef.title}`;
        }
      } catch {
        // ignore
      }
    }

    const prompt = [
      "You are EcoLudus's automated environmental quest photo verifier.",
      `Verify if the attached image provides plausible visual proof of completing the quest: "${questTitle || questId || "Eco Quest"}".`,
      detailsText,
      "Analyze the image for: relevance to the quest, clarity of the proof, and potential mismatch.",
      "CRITICAL RULES:",
      "1. If the photo is not about the quest, is unrelated, or does not show completion of the quest, verified must be false.",
      "2. Do NOT mention that validation is controlled by AI or Gemini. Keep explanations neutral, focusing on visual details.",
      "Return JSON matching the schema."
    ].join("\n");

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: resolvedMimeType, data: base64Image } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.15,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              verified: { type: "BOOLEAN" },
              reasoning: { type: "STRING" },
              warnings: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["verified", "reasoning", "warnings"]
          }
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini photo verification returned ${response.status}: ${text}`);
    }

    const payload = await response.json();
    let jsonText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof jsonText === "string") {
      jsonText = jsonText.trim().replace(/^```json\s*/,"").replace(/^```\s*/,"").replace(/\s*```$/,"").trim();
    }

    const parsed = typeof jsonText === "string" ? JSON.parse(jsonText) : payload;

    return {
      verified: Boolean(parsed.verified ?? false),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      provider: `google-gemini-photo:${geminiModel}`,
      details: parsed.reasoning || null
    };
  } catch (error) {
    console.error("Gemini photo verification failed:", error);
    return {
      verified: false,
      warnings: [],
      provider: "error",
      details: "Photo verification is temporarily unavailable. Please try again or use text proof instead."
    };
  }
}

// ── Gibberish detection ───────────────────────────────────────────────────────
function isObviousGibberish(text: string): boolean {
  const cleaned = text.trim().toLowerCase();
  if (cleaned.length < 12) return true;
  if (/^(.)\1{5,}$/.test(cleaned.replace(/\s/g, ""))) return true;
  if (cleaned.length > 8 && !/[aeiou]/i.test(cleaned)) return true;
  const letterCount = (cleaned.match(/[a-z]/gi) || []).length;
  if (letterCount / cleaned.length < 0.4) return true;
  const words = cleaned.split(/\s+/);
  if (words.length >= 3 && new Set(words).size === 1) return true;
  const noSpaces = cleaned.replace(/\s/g, "");
  for (let len = 2; len <= 3; len++) {
    if (noSpaces.length >= len * 3) {
      const sub = noSpaces.substring(0, len);
      if (noSpaces === sub.repeat(Math.ceil(noSpaces.length / len)).substring(0, noSpaces.length)) return true;
    }
  }
  return false;
}

// ── Heuristic fallback (no Gemini key) ───────────────────────────────────────
function heuristicTextVerification(
  textProof: string,
  questTitle: string
): { verified: boolean; reasoning: string } {
  const cleaned = textProof.trim().toLowerCase();
  const questWords = questTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  if (cleaned.length < 15) {
    return { verified: false, reasoning: "Your description is too short. Please explain specifically what you did." };
  }

  const isJustTitle =
    questWords.length > 0 &&
    questWords.every((w) => cleaned.includes(w)) &&
    cleaned.split(/\s+/).length <= questWords.length + 2;
  if (isJustTitle) {
    return { verified: false, reasoning: "Your description just repeats the quest name. Describe the specific action you took." };
  }

  const actionWords = ["i ", "my ", "the ", "used ", "did ", "made ", "took ", "went ", "collected ", "sorted ", "reduced ", "switched ", "turned ", "walked ", "recycled ", "planted ", "cleaned ", "bought ", "avoided ", "replaced ", "unplugged ", "fixed "];
  if (!actionWords.some((w) => cleaned.includes(w))) {
    return { verified: false, reasoning: "Please describe what you actually did — include specific actions you took." };
  }

  return { verified: true, reasoning: "Your description provides a plausible account of completing this quest." };
}

// ── Text verification via Gemini ──────────────────────────────────────────────
export async function verifyTextProofWithGemini(
  textProof: string,
  questTitle: string,
  questDescription?: string
): Promise<{ verified: boolean; reasoning: string }> {
  if (isObviousGibberish(textProof)) {
    return { verified: false, reasoning: "Your description doesn't appear to be a real description. Please write a meaningful explanation of what you did." };
  }

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!geminiApiKey) {
    return heuristicTextVerification(textProof, questTitle);
  }

  try {
    const { url, headers } = getGeminiEndpoint(geminiModel, geminiApiKey);

    const prompt = [
      "You are a STRICT environmental quest proof verifier for the EcoLudus platform.",
      "Determine if the user's text is a GENUINE, SPECIFIC description of completing this quest.",
      "",
      `Quest Name: "${questTitle}"`,
      questDescription ? `Quest Description: "${questDescription}"` : "",
      "",
      `User's Submitted Proof Text: "${textProof}"`,
      "",
      "=== STRICT VERIFICATION RULES ===",
      "Set verified to FALSE if ANY apply:",
      "- Gibberish, random characters, or keyboard mashing",
      "- Just repeats/rephrases the quest name without describing a specific action",
      "- Extremely vague: 'I did it', 'done', 'yes I recycled'",
      "- Completely unrelated to the quest topic",
      "- Fewer than 5 meaningful words describing what was done",
      "- Physically implausible or clearly fake",
      "",
      "Set verified to TRUE only if:",
      "- Describes a SPECIFIC action directly related to the quest",
      "- Includes at least one concrete detail (what, where, when, or how)",
      "- The described action is physically plausible",
      "",
      "Do NOT mention any automated system. Keep reasoning neutral.",
      "Respond with JSON matching the schema."
    ].filter(Boolean).join("\n");

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.05,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              verified: { type: "BOOLEAN" },
              reasoning: { type: "STRING" }
            },
            required: ["verified", "reasoning"]
          }
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini text verification returned ${response.status}: ${text}`);
    }

    const payload = await response.json();
    let jsonText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof jsonText === "string") {
      jsonText = jsonText.trim().replace(/^```json\s*/,"").replace(/^```\s*/,"").replace(/\s*```$/,"").trim();
    }

    const parsed = typeof jsonText === "string" ? JSON.parse(jsonText) : payload;

    return {
      verified: Boolean(parsed.verified ?? false),
      reasoning: parsed.reasoning || "Could not determine proof validity."
    };
  } catch (error) {
    console.error("Gemini text verification error:", error);
    return {
      verified: false,
      reasoning: "Verification service is temporarily unavailable. Please try again."
    };
  }
}
