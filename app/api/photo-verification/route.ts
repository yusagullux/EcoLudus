import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createImageHash,
  GEMINI_SUPPORTED_IMAGE_MIME_TYPES,
  getExistingPhotoHash,
  MAX_PHOTO_BYTES,
  MIN_PHOTO_BYTES,
  savePhotoHash,
  verifyImageWithProvider
} from "@/lib/photo-verification";

const VALID_TYPES = new Set([...GEMINI_SUPPORTED_IMAGE_MIME_TYPES, "image/jpg"]);

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "You must be signed in to verify photos." } },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const photo = formData.get("photo");
  const questId = String(formData.get("questId") || "");
  const questTitle = String(formData.get("questTitle") || "");

  if (!photo || typeof photo !== "object" || typeof (photo as any).arrayBuffer !== "function") {
    return NextResponse.json(
      { error: { code: "invalid-argument", message: "A valid image file is required." } },
      { status: 400 }
    );
  }

  const file = photo as File;
  if (!VALID_TYPES.has(file.type.toLowerCase())) {
    return NextResponse.json(
      { error: { code: "invalid-argument", message: "Image type must be JPEG, PNG, WebP, HEIC, or HEIF." } },
      { status: 400 }
    );
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: { code: "invalid-argument", message: "Image too large. Maximum size is 10MB." } },
      { status: 400 }
    );
  }

  if (file.size < MIN_PHOTO_BYTES) {
    return NextResponse.json(
      { error: { code: "invalid-argument", message: "The uploaded file appears to be empty or corrupt. Please upload a real photo." } },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageHash = createImageHash(buffer);
    const existing = await getExistingPhotoHash(imageHash);

    if (existing && existing.user_id !== session.userId) {
      return NextResponse.json(
        {
          error: {
            code: "already-exists",
            message:
              "This photo has already been used by another user. Please provide a unique photo proof for your mission.",
            details: {
              questId: existing.quest_id,
              usedAt: existing.created_at
            }
          }
        },
        { status: 409 }
      );
    }

    const providerResult = await verifyImageWithProvider(
      buffer,
      session.userId,
      questId || null,
      questTitle || null,
      file.type || "image/jpeg"
    );

    if (!providerResult.verified) {
      return NextResponse.json(
        {
          error: {
            code: "verification-failed",
            message: providerResult.details || "Photo verification failed.",
            details: { warnings: providerResult.warnings, provider: providerResult.provider }
          }
        },
        { status: 422 }
      );
    }

    await savePhotoHash(imageHash, session.userId, questId || null);

    return NextResponse.json({ verified: true, warnings: providerResult.warnings ?? [], questId, questTitle });
  } catch (error) {
    console.error("Photo verification error:", error);
    return NextResponse.json(
      { error: { code: "internal", message: "Server error during photo verification." } },
      { status: 500 }
    );
  }
}
