import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getQuestDefinition } from "@/lib/carbon-calc";
import { verifyTextProofWithGemini } from "@/lib/photo-verification";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "You must be signed in to verify quest proof." } },
      { status: 401 }
    );
  }

  try {
    const { questId, textProof } = await request.json();

    if (!questId || !textProof || typeof textProof !== "string") {
      return NextResponse.json(
        { error: { code: "invalid-argument", message: "Quest ID and text proof are required." } },
        { status: 400 }
      );
    }

    if (textProof.trim().length < 8) {
      return NextResponse.json(
        { error: { code: "invalid-argument", message: "Please describe your proof in more detail (min 8 characters)." } },
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
