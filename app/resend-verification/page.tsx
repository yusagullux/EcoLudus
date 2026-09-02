"use client";

import Link from "next/link";
import { useState } from "react";
import { MarketingShell } from "@/components/marketing-shell";
import { AuthStatusCard, Icons } from "@/components/auth-status-card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { primaryButton, secondaryButton } from "@/components/game-ui";
import { useAuth } from "@/lib/useAuth";

export default function ResendVerificationPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ captchaToken })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.code || "auth/internal-error");
      setSent(true);
    } catch (err) {
      const code = err instanceof Error ? err.message : "auth/internal-error";
      const mapped: Record<string, string> = {
        "auth/captcha-failed": "Please complete the security check and try again.",
        "auth/email-not-verified": "Your email is not verified yet.",
        "auth/unauthenticated": "Please log in to resend the verification email.",
        "auth/too-many-requests": "Too many attempts. Please wait a moment before trying again."
      };
      setError(mapped[code] ?? "We couldn't send the email. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <MarketingShell>
        <AuthStatusCard
          tone="success"
          icon={Icons.check}
          eyebrow="Email sent"
          title="Check your inbox."
          body={
            <>
              We sent a fresh verification link to{" "}
              <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                {user?.email ?? "your email"}
              </span>
              . Click the button inside to confirm your address.
            </>
          }
        >
          <Link href="/dashboard" className={`w-full ${secondaryButton}`}>
            Back to dashboard
          </Link>
        </AuthStatusCard>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <AuthStatusCard
        tone="accent"
        icon={Icons.mail}
        eyebrow="Resend verification"
        title="Confirm your email."
        body={
          <>
            We&apos;ll send a new verification link to{" "}
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>
              {user?.email ?? "your email"}
            </span>
            . Click it to unlock your rewards and missions.
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={handleResend}>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <button type="submit" disabled={pending} className={`w-full ${primaryButton}`}>
            {pending ? "Sending…" : "Resend verification email"}
          </button>
        </form>
        <Link href="/" className={`w-full ${secondaryButton}`}>
          Back to home
        </Link>
      </AuthStatusCard>
    </MarketingShell>
  );
}