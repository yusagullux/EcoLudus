import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth";
import { privateMissionSubmissionSchema, submitPrivateMission } from "@/lib/private-missions";

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "Sign in before submitting a private mission." } },
      { status: 401 }
    );
  }

  try {
    const body = privateMissionSubmissionSchema.parse(await request.json());

    if (body.userId !== session.userId) {
      return NextResponse.json(
        { error: { code: "auth/user-mismatch", message: "Mission submissions must belong to the signed-in user." } },
        { status: 403 }
      );
    }

    const result = await submitPrivateMission(body, {
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent")
    });

    if ("error" in result && result.error) {
      const { status, ...error } = result.error;
      return NextResponse.json({ error }, { status });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "invalid-argument", details: error.flatten() } },
        { status: 400 }
      );
    }

    console.error("Private mission submission error:", error);
    return NextResponse.json(
      { error: { code: "internal-error", message: "Private mission submission failed." } },
      { status: 500 }
    );
  }
}
