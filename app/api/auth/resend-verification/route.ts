import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createVerificationToken } from "@/lib/auth-tokens";
import { sendEmail, appUrl } from "@/lib/email";
import { buildVerificationEmailHtml, buildVerificationEmailText } from "@/lib/email-templates/auth-emails";
import { rateLimit } from "@/lib/rate-limit";

// POST — session-gated. If already verified, 200 noop. Otherwise create a new
// token + email. Rate-limited 3/hr per IP.
export async function POST(request: Request) {
  const limit = rateLimit(request, "auth-resend", 3, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "auth/too-many-attempts", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "auth/unauthenticated", message: "Sign in to continue." } },
      { status: 401 }
    );
  }

  if (session.emailVerified) {
    return NextResponse.json({ message: "Email already verified." });
  }

  try {
    const rawToken = await createVerificationToken(session.userId);
    const verifyUrl = `${appUrl()}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
    const displayName = session.email.split("@")[0];
    await sendEmail({
      to: session.email,
      toName: displayName,
      subject: "Verify your email — EcoLudus",
      html: buildVerificationEmailHtml({ displayName, email: session.email, verifyUrl }),
      text: buildVerificationEmailText({ displayName, email: session.email, verifyUrl })
    });

    return NextResponse.json({ message: "Check your email to verify your account." });
  } catch (error) {
    console.error("resend-verification error:", error);
    return NextResponse.json(
      { error: { code: "auth/internal-error", message: "Could not resend verification email." } },
      { status: 500 }
    );
  }
}