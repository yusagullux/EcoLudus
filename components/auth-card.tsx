"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

type AuthCardProps = {
  mode: Mode;
};

const copy = {
  login: {
    eyebrow: "Welcome Back",
    title: "Step into your forest journey.",
    subtitle: "Log in to continue your daily missions, team progress, and collection growth.",
    submit: "Log In",
    pending: "Opening your dashboard...",
    altPrompt: "Need a fresh start?",
    altLabel: "Create your profile",
    altHref: "/signup"
  },
  signup: {
    eyebrow: "Get Started",
    title: "Create a calm, greener ritual.",
    subtitle: "Start tracking eco actions, unlock rewards, and grow your collection with a more polished experience.",
    submit: "Join EcoLudus",
    pending: "Preparing your forest hub...",
    altPrompt: "Already exploring EcoLudus?",
    altLabel: "Log in instead",
    altHref: "/login"
  }
} as const;

function formatClientError(message: string) {
  const mapped: Record<string, string> = {
    "auth/email-already-in-use": "This email is already in use. Try logging in instead.",
    "auth/user-not-found": "We couldn’t find a profile for that email.",
    "auth/wrong-password": "The password looks incorrect. Please try again.",
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
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error?.code || "auth/internal-error");
      }

      router.push("/html/dashboard.html");
      router.refresh();
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "auth/internal-error";
      setError(formatClientError(message));
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl items-center px-5 pb-14 pt-4 sm:px-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:px-10">
      <div className="hidden pr-10 lg:block">
        <div className="rounded-[2rem] border border-white/70 bg-white/55 p-8 shadow-[0_30px_80px_rgba(20,42,25,0.14)] backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-forest-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cream-100">
            Forest theme
          </div>
          <h1 className="mt-8 max-w-lg font-serif text-6xl leading-[0.95] text-forest-950">
            A calmer sustainability space, redesigned for everyday momentum.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-forest-900/78">
            Cleaner spacing, warmer tones, and a smoother flow make EcoLudus feel more premium while keeping the same
            missions, rewards, and community features you already use.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              ["Daily rhythm", "Track quests and progress with less friction."],
              ["Natural palette", "Forest greens, bark tones, and soft light surfaces."],
              ["Faster flow", "Sharper UI hierarchy and leaner interactions."]
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-3xl border border-forest-900/8 bg-gradient-to-b from-white to-[#eff3e8] p-5 shadow-[0_18px_40px_rgba(23,48,29,0.08)]"
              >
                <h2 className="font-serif text-2xl text-forest-900">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-forest-900/72">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/75 bg-white/80 p-6 shadow-[0_30px_90px_rgba(16,33,20,0.16)] backdrop-blur-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-forest-700">{content.eyebrow}</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-forest-950 sm:text-5xl">{content.title}</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-forest-900/75">{content.subtitle}</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold text-forest-900">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-forest-900/12 bg-[#fbfcf8] px-4 py-3.5 text-forest-950 outline-none ring-0 placeholder:text-forest-900/35 focus:border-forest-600 focus:bg-white focus:shadow-[0_0_0_4px_rgba(95,155,103,0.12)]"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-forest-900">
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
                className="w-full rounded-2xl border border-forest-900/12 bg-[#fbfcf8] px-4 py-3.5 text-forest-950 outline-none ring-0 placeholder:text-forest-900/35 focus:border-forest-600 focus:bg-white focus:shadow-[0_0_0_4px_rgba(95,155,103,0.12)]"
                placeholder="At least 6 characters"
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-full items-center justify-center rounded-full bg-forest-900 px-6 py-3.5 text-sm font-semibold tracking-[0.08em] text-cream-100 shadow-[0_18px_45px_rgba(16,33,20,0.26)] hover:-translate-y-0.5 hover:bg-forest-800 disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? content.pending : content.submit}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-forest-900/10 pt-6 text-sm text-forest-900/75">
            <span>{content.altPrompt}</span>
            <Link href={content.altHref} className="font-semibold text-forest-700 hover:text-forest-900">
              {content.altLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
