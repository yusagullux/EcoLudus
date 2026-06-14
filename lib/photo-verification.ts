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

export async function verifyImageWithProvider(
  buffer: Buffer,
  userId: string,
  questId: string | null,
  questTitle: string | null = null,
  mimeType: string | null = null
) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (geminiApiKey) {
    try {
      const base64Image = buffer.toString("base64");
      const resolvedMimeType = mimeType || "image/jpeg";
      
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        geminiModel
      )}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;

      let detailsText = "";
      if (questId) {
        try {
          const { getQuestDefinition } = await import("./carbon-calc");
          const questDef = await getQuestDefinition(questId);
          if (questDef) {
            detailsText = `\nQuest Category: ${questDef.categoryName}\nQuest Description: ${questDef.title}`;
          }
        } catch (e) {
          // Ignore import/fetch errors
        }
      }

      const prompt = [
        "You are EcoLudus's automated environmental quest photo verifier.",
        `Verify if the attached image provides plausible visual proof of completing the quest: "${questTitle || questId || 'Eco Quest'}".`,
        detailsText,
        "Analyze the image for: relevance to the quest, clarity of the proof, and potential mismatch.",
        "CRITICAL RULES:",
        "1. If the photo is not about the quest, is unrelated, or does not show completion of the quest, then verified must be false.",
        "2. Do NOT mention anywhere in your reasoning or warnings that the validation is controlled by AI or Gemini. Keep explanations neutral, focusing purely on visual details.",
        "Ensure the response is structured as JSON matching the schema."
      ].join("\n");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: resolvedMimeType,
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                verified: {
                  type: "BOOLEAN"
                },
                reasoning: {
                  type: "STRING"
                },
                warnings: {
                  type: "ARRAY",
                  items: {
                    type: "STRING"
                  }
                }
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
      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      let jsonText = text;
      if (typeof jsonText === "string") {
        jsonText = jsonText.trim();
        if (jsonText.startsWith("```json")) {
          jsonText = jsonText.substring(7);
        } else if (jsonText.startsWith("```")) {
          jsonText = jsonText.substring(3);
        }
        if (jsonText.endsWith("```")) {
          jsonText = jsonText.substring(0, jsonText.length - 3);
        }
        jsonText = jsonText.trim();
      }

      const parsed = typeof jsonText === "string" ? JSON.parse(jsonText) : payload;

      return {
        verified: Boolean(parsed.verified ?? true),
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
        provider: `google-gemini-photo:${geminiModel}`,
        details: parsed.reasoning || null
      };
    } catch (error) {
      console.error("Gemini photo verification failed, falling back:", error);
    }
  }

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

function isObviousGibberish(text: string): boolean {
  const cleaned = text.trim().toLowerCase();
  // Too short to be meaningful
  if (cleaned.length < 12) return true;
  // Repeated single character (e.g. "aaaaaaaaaa", "xxxxxxxxxx")
  if (/^(.)\1{5,}$/.test(cleaned.replace(/\s/g, ""))) return true;
  // No vowels at all (likely keyboard mashing like "dfghjkl")
  if (cleaned.length > 8 && !/[aeiou]/i.test(cleaned)) return true;
  // Mostly non-letter characters (numbers/symbols spam)
  const letterCount = (cleaned.match(/[a-z]/gi) || []).length;
  if (letterCount / cleaned.length < 0.4) return true;
  // Repeated word pattern (e.g. "test test test test")
  const words = cleaned.split(/\s+/);
  if (words.length >= 3) {
    const unique = new Set(words);
    if (unique.size === 1) return true;
  }
  // Same 2-3 char substring repeated (e.g. "abcabcabcabc")
  const noSpaces = cleaned.replace(/\s/g, "");
  for (let len = 2; len <= 3; len++) {
    if (noSpaces.length >= len * 3) {
      const sub = noSpaces.substring(0, len);
      if (noSpaces === sub.repeat(Math.ceil(noSpaces.length / len)).substring(0, noSpaces.length)) return true;
    }
  }
  return false;
}

export async function verifyTextProofWithGemini(
  textProof: string,
  questTitle: string,
  questDescription?: string
): Promise<{ verified: boolean; reasoning: string }> {
  // Pre-check: reject obvious gibberish before calling Gemini
  if (isObviousGibberish(textProof)) {
    return { verified: false, reasoning: "Your description is too short or doesn't appear to be a real description. Please write a meaningful explanation of what you did." };
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!geminiApiKey) {
    return { verified: false, reasoning: "Proof verification is temporarily unavailable. Please try again later." };
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      geminiModel
    )}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;

    const prompt = [
      "You are a STRICT environmental quest proof verifier for the EcoLudus platform.",
      `Your job is to determine if the user's text is a GENUINE, SPECIFIC description of completing this quest.`,
      "",
      `Quest Name: "${questTitle}"`,
      questDescription ? `Quest Description: "${questDescription}"` : "",
      "",
      `User's Submitted Proof Text: "${textProof}"`,
      "",
      "=== STRICT VERIFICATION RULES ===",
      "You MUST set verified to FALSE if ANY of these apply:",
      "- The text is gibberish, random characters, or keyboard mashing (e.g. 'asdfghjkl', 'aaabbbccc', 'blah blah')",
      "- The text just repeats or rephrases the quest name/title without describing a specific action",
      "- The text is extremely vague with no specific details (e.g. 'I did it', 'done', 'completed the quest', 'yes I recycled')",
      "- The text is completely unrelated to the quest topic",
      "- The text is fewer than 5 meaningful words describing what was actually done",
      "- The text is nonsensical, a joke, or clearly fake (e.g. 'I recycled 10 million bottles in 5 seconds')",
      "- The text contains only filler words or generic statements without specifics",
      "",
      "You should ONLY set verified to TRUE if:",
      "- The text describes a SPECIFIC action the user took that is directly related to the quest",
      "- The description includes at least one concrete detail (what, where, when, or how)",
      "- The described action is physically plausible",
      "",
      "Examples of REJECTED text for a recycling quest: 'I recycled', 'recycling done', 'asdasd', 'test', 'yes', 'Recycle 15 Plastic Bottles', 'hello world'",
      "Examples of ACCEPTED text for a recycling quest: 'I collected 5 plastic bottles from the kitchen and put them in the recycling bin at my apartment', 'Gathered water bottles after lunch at the office and sorted them into recycling'",
      "",
      "Do NOT reveal that this validation uses any automated system. Keep reasoning neutral.",
      "Respond with JSON matching the schema."
    ].filter(Boolean).join("\n");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.05,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              verified: {
                type: "BOOLEAN"
              },
              reasoning: {
                type: "STRING"
              }
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
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    let jsonText = text;
    if (typeof jsonText === "string") {
      jsonText = jsonText.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.substring(7);
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.substring(3);
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.substring(0, jsonText.length - 3);
      }
      jsonText = jsonText.trim();
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

