import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedUser } from "@/lib/auth";
import { getQuestDefinition } from "@/lib/carbon-calc";
import { MAX_PHOTO_BYTES, MIN_PHOTO_BYTES, isValidBase64ImagePayload, verifyTextProofWithGemini, verifyImageWithProvider, GEMINI_SUPPORTED_IMAGE_MIME_TYPES } from "@/lib/photo-verification";
import { markQuestProofVerified } from "@/lib/quest-proof";

// Validate the request shape at the boundary (project convention). Semantic
// checks (proof presence, base64 validity, size) remain below for their
// specific messages. `mimeType` is constrained to the formats Gemini actually
// accepts (plus the common `image/jpg` alias) so a spoofed/non-image type is
// rejected here with a clear 400 rather than passed through; the buffer is
// still re-derived from magic bytes downstream, so this is defense-in-depth.
// textProof/photoProof are bounded to keep oversized payloads off the provider
// and out of memory before the byte-size check runs.
const verifySchema = z.object({
  questId: z.string().min(1),
  textProof: z.string().max(5000).optional(),
  photoProof: z.string().max(15_000_000).optional(),
  mimeType: z.enum([...GEMINI_SUPPORTED_IMAGE_MIME_TYPES, "image/jpg"] as unknown as [string, ...string[]]).optional()
});

export async function POST(request: Request) {
  const session = await requireVerifiedUser();
  if (session instanceof NextResponse) return session;

  try {
    const parsed = verifySchema.parse(await request.json());
    const { questId, textProof, photoProof, mimeType } = parsed;

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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid-argument", details: error.flatten() } },
        { status: 400 }
      );
    }
    console.error("Error in quest verification route:", error);
    return NextResponse.json(
      { error: { code: "internal-error", message: "An error occurred during verification." } },
      { status: 500 }
    );
  }
}
