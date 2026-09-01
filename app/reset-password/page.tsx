"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { inputClass, primaryButton } from "@/components/game-ui";

function ResetPasswordContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
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
      if (!res.ok) {
        throw new Error(data?.error?.message || "Could not reset password.");
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message || "Could not reset password.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <Shell title="Invalid link" body="This reset link is missing a token.">
        <Link href="/forgot-password" className={linkBtn}>Request a new reset link</Link>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell title="Password updated" body="Your password has been changed. Please log in with your new password.">
        <Link href="/login" className={`${linkBtn} text-center`}>Continue to log in</Link>
      </Shell>
    );
  }

  return (
    <Shell title="Set a new password" body="Choose a new password for your EcoLudus account.">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (at least 6 characters)"
          className={inputClass}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className={inputClass}
        />
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
    </Shell>
  );
}

const linkBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] transition hover:opacity-90";

function Shell({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="font-serif text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{body}</p>
      <div className="mt-8 flex flex-col gap-3">{children}</div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}