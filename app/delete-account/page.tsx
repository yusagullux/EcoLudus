"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthScene, AuthStatusCard, Icons } from "@/components/auth-status-card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { inputClass, secondaryButton, dangerButton } from "@/components/game-ui";
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
    <AuthScene>
      <AuthStatusCard
        tone="danger"
        icon={Icons.alert}
        eyebrow="Danger zone"
        title="Delete your account."
        body={
          <>
            This permanently deletes your account, profile, missions, collection, and team membership for{" "}
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>
              {user?.email ?? "your account"}
            </span>
            . This cannot be undone.
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={handleDelete}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
              Password
            </label>
            <input
              id="password"
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
            <label htmlFor="confirm" className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
              Type DELETE to confirm
            </label>
            <input
              id="confirm"
              type="text"
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
              className={inputClass}
            />
          </div>
          <HCaptchaWidget onToken={setCaptchaToken} onExpired={() => setCaptchaToken("")} />
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <button
            type="submit"
            disabled={pending || confirmation !== "DELETE"}
            className={`w-full ${dangerButton}`}
          >
            {pending ? "Deleting…" : "Permanently delete my account"}
          </button>
        </form>
        <Link href="/settings" className={`w-full ${secondaryButton}`}>
          Cancel and go back
        </Link>
      </AuthStatusCard>
    </AuthScene>
  );
}