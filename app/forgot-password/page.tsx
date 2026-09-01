"use client";

import Link from "next/link";
import { useState } from "react";
import { inputClass, primaryButton } from "@/components/game-ui";
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

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="font-serif text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>Reset your password</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {sent ? (
        <p className="mt-6 text-sm font-semibold" style={{ color: "var(--text-accent)" }}>
          If the email exists, a reset link was sent.
        </p>
      ) : (
        <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
          {error && (
            <p className="text-sm font-semibold text-rose-600">{error}</p>
          )}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
          <HCaptchaWidget onToken={setCaptchaToken} onExpired={() => setCaptchaToken("")} />
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <div className="mt-6">
        <Link href="/login" className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>Back to log in</Link>
      </div>
    </main>
  );
}