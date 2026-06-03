"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButton } from "@/components/game-ui";

type Mode = "login" | "signup";
type AuthCardProps = { mode: Mode };

const copy = {
  login: {
    eyebrow: "Account Access",
    title: "Return to your daily eco rhythm.",
    subtitle: "Open your missions, team progress, collection, and impact dashboard.",
    submit: "Log In",
    pending: "Opening dashboard...",
    altPrompt: "New here?",
    altLabel: "Create a profile",
    altHref: "/signup"
  },
  signup: {
    eyebrow: "New Profile",
    title: "Start building a greener routine.",
    subtitle: "Create your profile, earn EcoPoints, and grow your collection through daily action.",
    submit: "Join EcoLudus",
    pending: "Setting up profile...",
    altPrompt: "Already a member?",
    altLabel: "Log in",
    altHref: "/login"
  }
} as const;

function formatClientError(message: string) {
  const mapped: Record<string, string> = {
    "auth/email-already-in-use": "This email is already in use. Try logging in instead.",
    "auth/user-not-found": "No profile found for that email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-input": "Please check your details and try again.",
    "auth/internal-error": "Something went wrong on the server. Please try again."
  };
  return mapped[message] ?? "Something went wrong. Please try again.";
}

export function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const content = copy[mode];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.code || "auth/internal-error");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "auth/internal-error";
      setError(formatClientError(message));
      setPending(false);
    }
  }

  return (
    <section className="mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-6xl px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[0.92fr_1fr] lg:px-0">
      <aside className="hidden flex-col justify-between rounded-l-[28px] bg-[linear-gradient(145deg,#102016_0%,#203b29_58%,#5f7c52_100%)] p-12 text-cream-100 shadow-[0_30px_90px_rgba(16,33,20,0.2)] lg:flex">
        <div>
          <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.24em] text-moss-200">
            Forest Edition
          </span>
          <h1 className="mt-8 max-w-xl text-balance font-serif text-5xl font-extrabold leading-[1.04] text-cream-100">
            A focused operating room for sustainable habits.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-cream-100/68">
            Quiet surfaces, strong hierarchy, and measured contrast keep the product useful while giving it a more distinctive identity.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Missions", "Daily actions"],
            ["Teams", "Shared progress"],
            ["Rewards", "EcoPoints"]
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <h3 className="font-serif text-lg font-extrabold text-cream-100">{title}</h3>
              <p className="mt-1 text-xs font-semibold text-cream-100/58">{text}</p>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex items-center justify-center rounded-[28px] border border-[#dfe7d7] bg-[#fffefa]/94 px-6 py-12 shadow-[0_24px_70px_rgba(16,33,20,0.1)] backdrop-blur lg:rounded-l-none lg:px-14">
        <div className="w-full max-w-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-forest-700/72">{content.eyebrow}</p>
          <h1 className="mt-3 text-balance font-serif text-4xl font-extrabold leading-tight text-forest-950">{content.title}</h1>
          <p className="mt-3 text-sm leading-6 text-forest-800/72">{content.subtitle}</p>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-extrabold uppercase tracking-[0.14em] text-forest-800">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-extrabold uppercase tracking-[0.14em] text-forest-800">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                className={inputClass}
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={pending} className={`mt-1 w-full ${primaryButton}`}>
              {pending ? content.pending : content.submit}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-[#e7ecdf] pt-5 text-sm text-forest-700">
            <span>{content.altPrompt}</span>
            <Link href={content.altHref} className="font-extrabold text-forest-950 transition hover:text-forest-700">
              {content.altLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
