import { z } from "zod";

export const verificationStatusSchema = z.enum(["APPROVED", "PARTIAL", "REJECTED", "FLAGGED"]);

export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export type PrivateMissionVerificationInput = {
  missionId: string;
  userId: string;
  beforeValue: string | null;
  afterValue: string | null;
  description: string;
  confidence: number;
  timestamp: string;
  userTrustScore: number;
  recentSubmissions: Array<{
    missionId: string;
    status: VerificationStatus | string;
    submittedAt: string;
    beforeValue: string | null;
    afterValue: string | null;
    description: string;
  }>;
};

export type PrivateMissionVerificationResult = {
  status: VerificationStatus;
  confidence: number;
  realism_score: number;
  reasoning: string;
  risk_flags: string[];
  provider: string;
};

const aiVerificationSchema = z.object({
  status: verificationStatusSchema,
  confidence: z.number().min(0).max(100),
  realism_score: z.number().min(0).max(100),
  reasoning: z.string().min(1).max(2000),
  risk_flags: z.array(z.string().min(1).max(120)).max(20).default([])
});

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function extractFirstNumber(value: string | null) {
  if (!value) return null;
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function statusFromConfidence(confidence: number, riskFlags: string[]): VerificationStatus {
  if (riskFlags.some((flag) => flag.includes("contradiction") || flag.includes("spam"))) {
    return confidence >= 50 ? "FLAGGED" : "REJECTED";
  }

  if (confidence >= 80) return "APPROVED";
  if (confidence >= 50) return "PARTIAL";
  return riskFlags.length >= 2 ? "FLAGGED" : "REJECTED";
}

function heuristicVerification(input: PrivateMissionVerificationInput): PrivateMissionVerificationResult {
  const riskFlags: string[] = [];
  let realismScore = 62;

  const description = input.description.trim();
  const lowerDescription = description.toLowerCase();

  if (description.length >= 24) realismScore += 10;
  if (description.length < 12) {
    realismScore -= 20;
    riskFlags.push("thin_description");
  }

  if (input.beforeValue && input.afterValue) {
    realismScore += 8;
    const beforeNumber = extractFirstNumber(input.beforeValue);
    const afterNumber = extractFirstNumber(input.afterValue);

    if (beforeNumber !== null && afterNumber !== null) {
      const delta = beforeNumber - afterNumber;
      const absoluteRatio = beforeNumber === 0 ? 0 : Math.abs(delta / beforeNumber);

      if (absoluteRatio > 0.8) {
        realismScore -= 18;
        riskFlags.push("extreme_progress_claim");
      } else if (absoluteRatio > 0 && absoluteRatio <= 0.5) {
        realismScore += 8;
      }
    }
  } else {
    realismScore -= 8;
    riskFlags.push("missing_before_or_after_value");
  }

  if (input.confidence <= 2) realismScore -= 8;
  if (input.confidence >= 4) realismScore += 4;

  const recentSameMission = input.recentSubmissions.filter((submission) => submission.missionId === input.missionId);
  if (recentSameMission.length >= 2) {
    realismScore -= 14;
    riskFlags.push("repeated_same_mission_pattern");
  }

  const duplicateText = input.recentSubmissions.some(
    (submission) => submission.description.trim().toLowerCase() === lowerDescription
  );
  if (duplicateText) {
    realismScore -= 22;
    riskFlags.push("duplicate_description_pattern");
  }

  if (input.userTrustScore < 35) realismScore -= 10;
  if (input.userTrustScore >= 75) realismScore += 6;

  const confidence = clampScore(realismScore + (input.confidence - 3) * 4);
  const finalRealismScore = clampScore(realismScore);

  return {
    status: statusFromConfidence(confidence, riskFlags),
    confidence,
    realism_score: finalRealismScore,
    reasoning:
      "Submission was evaluated for detail, before/after consistency, recent repetition, trust history, and behavioral plausibility.",
    risk_flags: riskFlags,
    provider: "local-structured-verifier"
  };
}

const geminiResponseSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["APPROVED", "PARTIAL", "REJECTED", "FLAGGED"]
    },
    confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100
    },
    realism_score: {
      type: "integer",
      minimum: 0,
      maximum: 100
    },
    reasoning: {
      type: "string"
    },
    risk_flags: {
      type: "array",
      items: {
        type: "string"
      }
    }
  },
  required: ["status", "confidence", "realism_score", "reasoning", "risk_flags"]
};

function verificationPrompt(input: PrivateMissionVerificationInput) {
  return [
    "You are EcoLudus's private mission verifier.",
    "Evaluate a habit-based mission submission where photos are not possible.",
    "Assess realism, internal consistency, behavioral plausibility, repetition, spam risk, and contradictions.",
    "Do not assign XP or rewards.",
    "Use these confidence bands: 80-100 APPROVED, 50-79 PARTIAL, below 50 REJECTED or FLAGGED.",
    "Prefer FLAGGED when there are suspicious patterns that may need manual review.",
    "",
    JSON.stringify(input, null, 2)
  ].join("\n");
}

async function verifyWithGemini(input: PrivateMissionVerificationInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) return null;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: verificationPrompt(input) }]
        }
      ],
      generationConfig: {
        temperature: 0.15,
        responseMimeType: "application/json",
        responseSchema: geminiResponseSchema
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini verification returned ${response.status}: ${text}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  const candidate = typeof text === "string" ? JSON.parse(text) : payload?.result ?? payload;
  const parsed = aiVerificationSchema.parse(candidate);

  return {
    ...parsed,
    confidence: clampScore(parsed.confidence),
    realism_score: clampScore(parsed.realism_score),
    provider: `google-gemini:${model}`
  };
}

export async function verifyPrivateMissionSubmission(input: PrivateMissionVerificationInput) {
  const geminiResult = await verifyWithGemini(input);
  if (geminiResult) return geminiResult;

  const endpoint = process.env.AI_VERIFICATION_ENDPOINT;
  const apiKey = process.env.AI_VERIFICATION_API_KEY;

  if (!endpoint || !apiKey) {
    return heuristicVerification(input);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      task:
        "Verify a private habit mission submission. Return only structured JSON with status, confidence, realism_score, reasoning, and risk_flags. Do not assign XP.",
      rules: {
        approved: "80-100 confidence",
        partial: "50-79 confidence",
        rejected_or_flagged: "below 50 confidence",
        evaluate: ["realism", "consistency", "behavioral plausibility", "spam risk", "contradictions"]
      },
      input
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI verification provider returned ${response.status}: ${text}`);
  }

  const payload = await response.json();
  const candidate = payload?.result ?? payload;
  const parsed = aiVerificationSchema.parse(candidate);

  return {
    ...parsed,
    confidence: clampScore(parsed.confidence),
    realism_score: clampScore(parsed.realism_score),
    provider: String(payload?.provider ?? endpoint)
  };
}
