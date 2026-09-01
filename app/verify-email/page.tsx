"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VerifyEmailContent() {
  const params = useSearchParams();
  const status = params.get("status");

  const map: Record<string, { title: string; body: string }> = {
    success: { title: "Email verified", body: "Your account is active. You can now log in and start your eco journey." },
    invalid: { title: "Invalid link", body: "This verification link is invalid or was already used." },
    expired: { title: "Link expired", body: "This verification link has expired. Request a new one." }
  };

  const content = map[status ?? "invalid"] ?? map.invalid;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="font-serif text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>{content.title}</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{content.body}</p>
      <div className="mt-8 flex flex-col gap-3">
        {status === "success" && (
          <Link href="/login" className={`${primaryButtonLink} text-center`}>Continue to log in</Link>
        )}
        {(status === "expired" || status === "invalid") && (
          <Link href="/resend-verification" className={`${primaryButtonLink} text-center`}>Resend verification email</Link>
        )}
        <Link href="/" className="text-center text-sm font-bold" style={{ color: "var(--text-muted)" }}>Back to home</Link>
      </div>
    </main>
  );
}

const primaryButtonLink =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] transition hover:opacity-90";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}