"use client";

import Link from "next/link";
import { useState } from "react";
import { MarketingShell } from "@/components/marketing-shell";
import { AuthStatusCard, Icons } from "@/components/auth-status-card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { inputClass, primaryButton, secondaryButton } from "@/components/game-ui";
import { HCaptchaWidget } from "@/components/hcaptcha-widget";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return;
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), captchaToken })
      });
      const data = await res.json().catch(() => ({}));
      // Surface captcha failure specifically — the only non-success path that
      // reveals an error. For all other responses (200, 400 invalid input, etc.)
      // keep the anti-enumeration behavior: never reveal whether the email exists.
      if (!res.ok && data?.error?.code === "auth/captcha-failed") {
        setError("Please complete the security check and try again.");
        return;
      }
      setSent(true);
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
          eyebrow="Check your email"
          title="Reset link sent."
          body={
            <>
              If an account exists for{" "}
              <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                {email.trim().toLowerCase()}
              </span>
              , a password reset link is on its way. It expires in 60 minutes.
            </>
          }
        >
          <Link href="/login" className={`w-full ${secondaryButton}`}>
            Back to log in
          </Link>
        </AuthStatusCard>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <AuthStatusCard
        tone="accent"
        icon={Icons.lock}
        eyebrow="Forgot password"
        title="Reset your password."
        body="Enter your email and we'll send you a secure link to choose a new password."
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <HCaptchaWidget onToken={setCaptchaToken} onExpired={() => setCaptchaToken("")} />
          <button type="submit" disabled={pending} className={`w-full ${primaryButton}`}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <Link href="/login" className={`w-full ${secondaryButton}`}>
          Back to log in
        </Link>
      </AuthStatusCard>
    </MarketingShell>
  );
}