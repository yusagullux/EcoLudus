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
