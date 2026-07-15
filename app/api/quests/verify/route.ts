import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getQuestDefinition } from "@/lib/carbon-calc";
import { MAX_PHOTO_BYTES, MIN_PHOTO_BYTES, verifyTextProofWithGemini, verifyImageWithProvider } from "@/lib/photo-verification";
import { markQuestProofVerified } from "@/lib/quest-proof";

function isValidBase64ImagePayload(value: string) {
  const normalized = value.replace(/\s/g, "");
  return normalized.length > 0 && normalized.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "You must be signed in to verify quest proof." } },
      { status: 401 }
    );
  }

  try {
    const { questId, textProof, photoProof, mimeType } = await request.json();

    if (!questId) {
      return NextResponse.json(
        { error: { code: "invalid-argument", message: "Quest ID is required." } },
        { status: 400 }
      );
    }

    if (!textProof && !photoProof) {
      return NextResponse.json(
        { error: { code: "invalid-argument", message: "Please provide either a text description or a photo as proof." } },
        { status: 400 }
      );
    }

    const quest = await getQuestDefinition(questId);
    if (!quest) {
      return NextResponse.json(
        { error: { code: "quest-not-found", message: "Quest not found." } },
        { status: 404 }
      );
    }

    // Photo proof verification
    if (photoProof) {
      if (typeof photoProof !== "string") {
        return NextResponse.json(
          { error: { code: "invalid-argument", message: "Photo proof must be a base64 image." } },
          { status: 400 }
        );
      }

      let base64Data = photoProof;
      if (base64Data.includes(";base64,")) {
        base64Data = base64Data.split(";base64,").pop() || "";
      }
      base64Data = base64Data.replace(/\s/g, "");
      if (!isValidBase64ImagePayload(base64Data)) {
        return NextResponse.json(
          { error: { code: "invalid-argument", message: "Photo proof must be a valid base64 image." } },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length > MAX_PHOTO_BYTES) {
        return NextResponse.json(
          { error: { code: "invalid-argument", message: "Image too large. Maximum size is 10MB." } },
          { status: 400 }
        );
      }

      if (buffer.length < MIN_PHOTO_BYTES) {
        return NextResponse.json(
          { error: { code: "invalid-argument", message: "The uploaded file appears to be empty or corrupt. Please upload a real photo." } },
          { status: 400 }
        );
      }

      const resolvedMimeType = mimeType || "image/jpeg";

      const result = await verifyImageWithProvider(
        buffer,
        session.userId || "",
        questId,
        quest.title,
        resolvedMimeType
      );

      console.log(`[verify] photo result — verified: ${result.verified}, provider: ${result.provider}, details: ${result.details?.slice(0, 100)}`);

      if (!result.verified) {
        return NextResponse.json(
          {
            error: {
              code: "verification-failed",
              message: result.details || "The uploaded photo does not appear to show completion of this quest. Please provide a relevant photo."
            }
          },
          { status: 422 }
        );
      }

      // Confidence: Gemini's warnings count as partial confidence deductions
      const warningCount = result.warnings?.length ?? 0;
      const confidence = Math.max(60, 100 - warningCount * 12);
      const nextProfile = await markQuestProofVerified(session.userId, questId, {
        method: "photo",
        confidence,
        provider: result.provider,
        warnings: result.warnings ?? []
      });

      if (!nextProfile) {
        return NextResponse.json(
          { error: { code: "auth/user-not-found", message: "User profile was not found." } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        verified: true,
        reasoning: result.details || "Photo proof accepted.",
        confidence,
        warnings: result.warnings ?? []
      });
    }

    // Text proof verification
    if (typeof textProof !== "string" || textProof.trim().length < 8) {
      return NextResponse.json(
        { error: { code: "invalid-argument", message: "Please describe your proof in more detail (min 8 characters)." } },
        { status: 400 }
      );
    }

    const result = await verifyTextProofWithGemini(textProof, quest.title, quest.title);

    if (!result.verified) {
      return NextResponse.json(
        {
          error: {
            code: "verification-failed",
            message: result.reasoning || "The description provided does not match or prove completion of this quest. Please provide a relevant description."
          }
        },
        { status: 422 }
      );
    }

    // Text confidence: based on length and specificity heuristic
    const wordCount = textProof.trim().split(/\s+/).length;
    const textConfidence = Math.min(100, Math.max(70, 70 + wordCount * 2));
    const nextProfile = await markQuestProofVerified(session.userId, questId, {
      method: "text",
      confidence: textConfidence,
      provider: "google-gemini-text"
    });

    if (!nextProfile) {
      return NextResponse.json(
        { error: { code: "auth/user-not-found", message: "User profile was not found." } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      verified: true,
      reasoning: result.reasoning,
      confidence: textConfidence
    });
  } catch (error) {
    console.error("Error in quest verification route:", error);
    return NextResponse.json(
      { error: { code: "internal-error", message: "An error occurred during verification." } },
      { status: 500 }
    );
  }
}
