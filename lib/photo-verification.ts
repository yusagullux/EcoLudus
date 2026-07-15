import { createHash } from "crypto";
import { sql } from "./db";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MIN_PHOTO_BYTES = 5 * 1024;
export const GEMINI_SUPPORTED_IMAGE_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
];

type PhotoHashRecord = {
  id: string;
  image_hash: string;
  user_id: string;
  quest_id: string | null;
  created_at: string;
};

type ImageVerificationResult = {
  verified: boolean;
  warnings: string[];
  provider: string;
  details: string | null;
};

function getGeminiEndpoint(model: string, key: string): { url: string; headers: Record<string, string> } {
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    }
  };
}

function warnIfKeyMissing() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    console.warn(
      "[EcoLudus] GEMINI_API_KEY is not set - AI verification disabled. " +
      "Get a free key at https://aistudio.google.com/app/apikey"
    );
  }
}

if (typeof process !== "undefined" && process.env) {
  warnIfKeyMissing();
}

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

function normalizeImageMimeType(buffer: Buffer, mimeType: string | null): string | null {
  const requestedType = (mimeType || "").split(";")[0]?.trim().toLowerCase();
  if (requestedType === "image/jpg") return "image/jpeg";
  if (GEMINI_SUPPORTED_IMAGE_MIME_TYPES.includes(requestedType)) return requestedType;

  const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isWebp = buffer.slice(8, 12).toString("ascii") === "WEBP";
  const majorBrand = buffer.slice(8, 12).toString("ascii");
  const isHeicOrHeif =
    buffer.slice(4, 8).toString("ascii") === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(majorBrand);

  if (isJpeg) return "image/jpeg";
  if (isPng) return "image/png";
  if (isWebp) return "image/webp";
  if (isHeicOrHeif) return "image/heic";
  return null;
}

function stripJsonFence(text: string) {
  return text.trim().replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
}

function parseGeminiJsonPayload(payload: any) {
  const jsonText =
    payload?.candidates?.[0]?.content?.parts?.find((part: any) => typeof part?.text === "string")?.text ??
    payload?.output_text ??
    payload?.outputText;

  if (typeof jsonText === "string") {
    return JSON.parse(stripJsonFence(jsonText));
  }

  if (typeof payload?.verified === "boolean") {
    return payload;
  }

  throw new Error("Gemini did not return parseable verification JSON.");
}

export async function verifyImageWithProvider(
  buffer: Buffer,
  userId: string,
  questId: string | null,
  questTitle: string | null = null,
  mimeType: string | null = null,
  options: { allowHeuristicFallback?: boolean } = {}
): Promise<ImageVerificationResult> {
  void userId;

  const { allowHeuristicFallback = false } = options;
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (buffer.length > MAX_PHOTO_BYTES) {
    return {
      verified: false,
      warnings: ["file_too_large"],
      provider: "local-validation",
      details: "Photo is too large (max 10MB). Please compress it and try again."
    };
  }

  if (buffer.length < MIN_PHOTO_BYTES) {
    return {
      verified: false,
      warnings: ["file_too_small"],
      provider: "local-validation",
      details: "The uploaded file appears to be empty or corrupt. Please upload a real photo."
    };
  }

  const resolvedMimeType = normalizeImageMimeType(buffer, mimeType);
  if (!resolvedMimeType) {
    return {
      verified: false,
      warnings: ["unsupported_format"],
      provider: "local-validation",
      details: "Please upload a supported photo format: JPEG, PNG, WebP, HEIC, or HEIF."
    };
  }

  if (!geminiApiKey) {
    return heuristicPhotoVerification(buffer, resolvedMimeType);
  }

  try {
    const base64Image = buffer.toString("base64");
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
        // Quest details are helpful, but photo verification can continue without them.
      }
    }

    const prompt = [
      "You are EcoLudus's automated environmental quest photo verifier.",
      `Verify if the attached image provides plausible visual proof of completing the quest: "${questTitle || questId || "Eco Quest"}".`,
      detailsText,
      "Analyze the image for relevance to the quest, clarity of the proof, and potential mismatch.",
      "CRITICAL RULES:",
      "1. If the photo is not about the quest, is unrelated, or does not show completion of the quest, verified must be false.",
      "2. Do not mention that validation is controlled by AI or Gemini. Keep explanations neutral, focusing on visual details.",
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
      console.error(`[Gemini photo] HTTP ${response.status} - key prefix: ${geminiApiKey.slice(0, 8)}, url: ${url.split("?")[0]}`);
      console.error(`[Gemini photo] Response body: ${text.slice(0, 500)}`);
      throw new Error(`Gemini photo verification returned ${response.status}: ${text}`);
    }

    const payload = await response.json();
    const parsed = parseGeminiJsonPayload(payload);

    return {
      verified: Boolean(parsed.verified ?? false),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      provider: `google-gemini-photo:${geminiModel}`,
      details: parsed.reasoning || null
    };
  } catch (error) {
    console.error("Gemini photo verification failed:", error);
    if (!allowHeuristicFallback) {
      return {
        verified: false,
        warnings: ["verification_unavailable"],
        provider: "google-gemini-photo:failed",
        details: "Photo verification is temporarily unavailable. Please try again in a moment."
      };
    }
    return heuristicPhotoVerification(buffer, resolvedMimeType);
  }
}

function heuristicPhotoVerification(buffer: Buffer, mimeType: string | null): ImageVerificationResult {
  const warnings: string[] = [];
  const resolvedMime = normalizeImageMimeType(buffer, mimeType);

  if (!resolvedMime) {
    return {
      verified: false,
      warnings: ["unsupported_format"],
      provider: "heuristic",
      details: "Please upload a supported photo format: JPEG, PNG, WebP, HEIC, or HEIF."
    };
  }

  if (buffer.length < MIN_PHOTO_BYTES) {
    return {
      verified: false,
      warnings: ["file_too_small"],
      provider: "heuristic",
      details: "The uploaded file appears to be empty or corrupt. Please upload a real photo."
    };
  }

  if (buffer.length > MAX_PHOTO_BYTES) {
    return {
      verified: false,
      warnings: ["file_too_large"],
      provider: "heuristic",
      details: "Photo is too large (max 10MB). Please compress it and try again."
    };
  }

  const headerMime = normalizeImageMimeType(buffer, null);
  if (headerMime && headerMime !== resolvedMime) {
    warnings.push("mime_type_mismatch");
  }

  return {
    verified: true,
    warnings,
    provider: "heuristic-local",
    details: warnings.length > 0
      ? "Photo accepted with minor warnings. Configure GEMINI_API_KEY for stricter quest-specific verification."
      : "Photo accepted. Configure GEMINI_API_KEY for stricter quest-specific verification."
  };
}

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
    return { verified: false, reasoning: "Please describe what you actually did - include specific actions you took." };
  }

  return { verified: true, reasoning: "Your description provides a plausible account of completing this quest." };
}

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
      "Do not mention any automated system. Keep reasoning neutral.",
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
    const parsed = parseGeminiJsonPayload(payload);

    return {
      verified: Boolean(parsed.verified ?? false),
      reasoning: parsed.reasoning || "Could not determine proof validity."
    };
  } catch (error) {
    console.error("Gemini text verification error:", error);
    return heuristicTextVerification(textProof, questTitle);
  }
}
