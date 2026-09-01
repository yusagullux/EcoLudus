"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/components/game-ui";
import { HCaptchaWidget } from "@/components/hcaptcha-widget";
import { useAuth } from "@/lib/useAuth";

export default function DeleteAccountPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (confirmation !== "DELETE") {
      setError("Type DELETE to confirm.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, confirmation: "DELETE", captchaToken })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Could not delete account.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Could not delete account.");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="font-serif text-3xl font-extrabold text-rose-600">Delete account</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        This permanently deletes your account, profile, missions, collection, and team membership for{" "}
        <span className="font-bold">{user?.email ?? "your account"}</span>. This cannot be undone.
      </p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={handleDelete}>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
            Password
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
            Type DELETE to confirm
          </label>
          <input
            type="text"
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
            className={inputClass}
          />
        </div>
        <HCaptchaWidget onToken={setCaptchaToken} onExpired={() => setCaptchaToken("")} />
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={pending || confirmation !== "DELETE"}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-rose-600 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Permanently delete my account"}
        </button>
      </form>

      <div className="mt-6">
        <Link href="/settings" className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>Cancel and go back</Link>
      </div>
    </main>
  );
}