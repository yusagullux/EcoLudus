"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButton } from "@/components/game-ui";
import { useAuth } from "@/lib/useAuth";

export default function ResendVerificationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleResend() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Could not resend.");
      setMessage(data.message || "Check your email to verify your account.");
    } catch (err) {
      setError((err as Error).message || "Could not resend.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="font-serif text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>Resend verification</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        We&apos;ll send a new verification link to {user?.email ?? "your email"}.
      </p>

      {error && <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>}
      {message && <p className="mt-4 text-sm font-semibold" style={{ color: "var(--text-accent)" }}>{message}</p>}

      <div className="mt-8 flex flex-col gap-3">
        <button type="button" onClick={handleResend} disabled={pending} className={primaryButton}>
          {pending ? "Sending…" : "Resend verification email"}
        </button>
        <Link href="/dashboard" className="text-center text-sm font-bold" style={{ color: "var(--text-muted)" }}>Back to dashboard</Link>
      </div>
    </main>
  );
}