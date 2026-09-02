"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthStatusCard, Icons } from "@/components/auth-status-card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { inputClass, primaryButton, secondaryButton } from "@/components/game-ui";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <AuthStatusCard
        tone="danger"
        icon={Icons.linkOff}
        eyebrow="Invalid link"
        title="That link won't work."
        body="This reset link is missing its token. Request a new one and we'll send a fresh link to your email."
      >
        <Link href="/forgot-password" className={`w-full ${primaryButton}`}>
          Request a new reset link
        </Link>
      </AuthStatusCard>
    );
  }

  if (done) {
    return (
      <AuthStatusCard
        tone="success"
        icon={Icons.check}
        eyebrow="Password updated"
        title="You're all set."
        body="Your password has been changed. Log in with your new password to continue."
      >
        <Link href="/login" className={`w-full ${primaryButton}`}>
          Continue to log in
        </Link>
      </AuthStatusCard>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.code || "auth/internal-error");
      setDone(true);
    } catch (err) {
      const code = err instanceof Error ? err.message : "auth/internal-error";
      const mapped: Record<string, string> = {
        "auth/invalid-token": "This reset link is invalid or has expired. Request a new one.",
        "auth/too-many-requests": "Too many attempts. Please wait a moment before trying again."
      };
      setError(mapped[code] ?? "We couldn't reset your password. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthStatusCard
      tone="accent"
      icon={Icons.key}
      eyebrow="Reset password"
      title="Choose a new password."
      body="Pick a password you don't use elsewhere. It must be at least 6 characters."
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your new password"
            className={inputClass}
          />
        </div>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <button type="submit" disabled={pending} className={`w-full ${primaryButton}`}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
      <Link href="/forgot-password" className={`w-full ${secondaryButton}`}>
        Request a new reset link
      </Link>
    </AuthStatusCard>
  );
}