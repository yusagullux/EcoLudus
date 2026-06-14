import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getQuestDefinition } from "@/lib/carbon-calc";
import { verifyTextProofWithGemini, verifyImageWithProvider } from "@/lib/photo-verification";

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
      let base64Data = photoProof;
      if (base64Data.includes(";base64,")) {
        base64Data = base64Data.split(";base64,").pop() || "";
      }
      const buffer = Buffer.from(base64Data, "base64");
      const resolvedMimeType = mimeType || "image/jpeg";

      const result = await verifyImageWithProvider(
        buffer,
        session.userId || "",
        questId,
        quest.title,
        resolvedMimeType
      );

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

      return NextResponse.json({ verified: true, reasoning: result.details || "Photo proof accepted." });
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

    return NextResponse.json({ verified: true, reasoning: result.reasoning });
  } catch (error) {
    console.error("Error in quest verification route:", error);
    return NextResponse.json(
      { error: { code: "internal-error", message: "An error occurred during verification." } },
      { status: 500 }
    );
  }
}

