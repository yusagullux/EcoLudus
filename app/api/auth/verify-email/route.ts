import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/auth-tokens";
import { sql } from "@/lib/db";

// GET (email link click). Consumes the token (single-use), marks the user
// verified, bumps token_version (revokes other sessions), and redirects to the
// status page. No session required — the token is the credential.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?status=invalid", request.url));
  }

  try {
    const consumed = await consumeVerificationToken(token);

    if (consumed.status === "invalid") {
      return NextResponse.redirect(new URL("/verify-email?status=invalid", request.url));
    }
    if (consumed.status === "expired") {
      return NextResponse.redirect(new URL("/verify-email?status=expired", request.url));
    }

    // ok — mark verified + bump token_version (kills sessions issued before
    // verification, e.g. the one set at signup on another device).
    await sql(
      "update users set email_verified = true, token_version = token_version + 1 where id = $1",
      [consumed.userId]
    );

    return NextResponse.redirect(new URL("/verify-email?status=success", request.url));
  } catch (error) {
    console.error("verify-email error:", error);
    return NextResponse.redirect(new URL("/verify-email?status=invalid", request.url));
  }
}