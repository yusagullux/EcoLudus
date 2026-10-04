"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButton } from "@/components/game-ui";
import { ErrorBanner } from "@/components/ui/error-banner";
import { HCaptchaWidget } from "@/components/hcaptcha-widget";
import {
  clearRememberedSession,
  getRememberedSession,
  saveRememberedSession
} from "@/lib/auth-persistence";

type Mode = "login" | "signup";
type AuthCardProps = { mode: Mode };

const copy = {
  login: {
    eyebrow: "Account Access",
    title: "Return to your daily eco rhythm.",
    subtitle: "Open your missions, team progress, collection, and impact log.",
    submit: "Log In",
    pending: "Opening your garden...",
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
    "auth/invalid-credentials": "Incorrect email or password. Please try again.",
    "auth/invalid-input": "Please check your details and try again.",
    "auth/database-not-configured": "EcoLudus needs its production database configured before login will work.",
    "auth/captcha-failed": "Please complete the security check and try again.",
    "auth/internal-error": "Something went wrong on the server. Please try again.",
    "auth/network-request-failed": "We could not reach EcoLudus. Check your connection and try again.",
    "auth/email-not-verified": "Please verify your email to continue."
  };
  return mapped[message] ?? "Something went wrong. Please try again.";
}

export function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(mode === "login");
  const [error, setError] = useState("");
  const [lastErrorCode, setLastErrorCode] = useState("");
  const [pending, setPending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  // Tracks fields the user has interacted with, so inline validation only
  // appears after they've had a chance to type — not on the initial empty form.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const content = copy[mode];

  // Inline validation — recomputed every render so once a field is touched,
  // the message updates live as they keep typing. Empty values are left to the
  // native `required` attribute so we don't nag before the user starts.
  const emailInvalid = touched.email && email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordInvalid = touched.password && password.length > 0 && password.length < 6;

  useEffect(() => {
    if (mode !== "login" || !getRememberedSession()) {
      return;
    }

    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store"
        });
        const payload = await response.json().catch(() => ({}));

        if (cancelled) {
          return;
        }

        if (response.ok && payload.user) {
          saveRememberedSession(payload.user);
          router.replace("/dashboard");
          router.refresh();
        } else {
          clearRememberedSession();
        }
      } catch {
        if (!cancelled) {
          clearRememberedSession();
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [mode, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLastErrorCode("");
    // Client-side guard: if the fields are invalid, surface the inline errors
    // (by marking them touched) and bail before hitting the network.
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const passwordOk = password.length >= 6;
    if (!emailOk || !passwordOk) {
      setTouched({ email: true, password: true });
      return;
    }
    setPending(true);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          // Only forward a display name on signup — the login route ignores it.
          ...(mode === "signup" && displayName.trim() ? { displayName: displayName.trim() } : {}),
          captchaToken
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.code || "auth/internal-error");
      if (rememberMe && payload.user) {
        saveRememberedSession(payload.user);
      } else {
        clearRememberedSession();
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const code = err instanceof TypeError
        ? "auth/network-request-failed"
        : err instanceof Error
          ? err.message
          : "auth/internal-error";
      setLastErrorCode(code);
      setError(formatClientError(code));
      setPending(false);
    }
  }

  return (
    <section className="mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-6xl px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[0.92fr_1fr] lg:px-0">
      <aside className="mk-hero hidden flex-col justify-between rounded-l-dialog p-12 shadow-elev-3 lg:flex">
        <div>
          <span className="inline-flex rounded-full border border-ink-inverse/15 bg-ink-inverse/10 px-4 py-2 text-overline text-ink-inverse">
            Forest Edition
          </span>
          <h2 className="mt-8 max-w-xl text-balance font-serif text-5xl font-extrabold leading-[1.04] text-ink-inverse">
            Small actions. A living garden. Real impact.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-ink-inverse/70">
            Take on a daily eco mission, verify it with a quick photo check, and watch it grow into XP, EcoPoints, and rare species for your garden. Every verified mission is logged as real CO₂ saved, building a personal record of the difference you make.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Missions", "Daily quests with real proof"],
            ["Teams", "Progress shared with friends"],
            ["Rewards", "XP, EcoPoints, and species"]
          ].map(([title, text]) => (
            <div key={title} className="rounded-card border border-ink-inverse/12 bg-ink-inverse/8 p-4">
              <h3 className="font-serif text-lg font-extrabold text-ink-inverse">{title}</h3>
              <p className="mt-1 text-xs font-semibold text-ink-inverse/60">{text}</p>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex items-center justify-center rounded-dialog border border-line bg-surface px-6 py-12 shadow-elev-2 lg:rounded-l-none lg:px-14">
        <div className="w-full max-w-sm">
          {/* Compact branded header — visible only on mobile/tablet where the
              full aside panel is hidden, so auth isn't a bare card. */}
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="relative h-10 w-10 overflow-hidden rounded-input bg-surface shadow-elev-2 ring-1 ring-line">
              <Image src="/images/logo.png" alt="EcoLudus logo" fill sizes="40px" className="object-cover" />
            </div>
            <div className="leading-none">
              <div className="font-serif text-xl font-semibold tracking-wide text-ink">EcoLudus</div>
              <div className="mt-1 text-overline text-ink-muted">Forest Edition</div>
            </div>
          </div>

          <p className="text-overline text-ink-muted">{content.eyebrow}</p>
          <h1 className="mt-3 text-balance font-serif text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{content.title}</h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">{content.subtitle}</p>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="displayName" className="text-overline text-ink-soft">
                  Display name <span className="font-bold normal-case tracking-normal text-ink-muted">(optional)</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  autoComplete="nickname"
                  maxLength={50}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="e.g. Eco Explorer"
                  className={inputClass}
                />
                <p className="text-xs font-semibold text-ink-muted">
                  Shown on your profile, sidebar, and leaderboard. Leave blank to use your email prefix.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-overline text-ink-soft">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                aria-invalid={emailInvalid || undefined}
                aria-describedby={emailInvalid ? "email-error" : undefined}
                placeholder="you@example.com"
                className={inputClass}
              />
              {emailInvalid && (
                <p id="email-error" className="text-xs font-semibold text-status-danger">
                  Enter a valid email address.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-overline text-ink-soft">
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
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                aria-invalid={passwordInvalid || undefined}
                aria-describedby={passwordInvalid ? "password-error" : undefined}
                placeholder="At least 6 characters"
                className={inputClass}
              />
              {passwordInvalid && (
                <p id="password-error" className="text-xs font-semibold text-status-danger">
                  Password must be at least 6 characters.
                </p>
              )}
            </div>

            {mode === "login" && (
              <div className="flex items-center justify-between">
                <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-ink-soft">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-5 w-5 rounded accent-[var(--text-accent)]"
                  />
                  Remember me
                </label>
                <Link href="/forgot-password" className="inline-flex min-h-11 items-center px-1 text-xs font-bold text-ink-muted transition-colors hover:text-ink">
                  Forgot password?
                </Link>
              </div>
            )}

            {error && <ErrorBanner>{error}</ErrorBanner>}

            {error && lastErrorCode === "auth/email-not-verified" && (
              <Link href="/resend-verification" className="text-xs font-bold text-accent transition-colors hover:text-ink">
                Resend verification email
              </Link>
            )}

            <HCaptchaWidget onToken={setCaptchaToken} onExpired={() => setCaptchaToken("")} />

            <button type="submit" disabled={pending} className={`mt-1 w-full ${primaryButton}`}>
              {pending ? content.pending : content.submit}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-line-soft pt-5 text-sm text-ink-muted">
            <span>{content.altPrompt}</span>
            <Link href={content.altHref} className="font-extrabold text-ink transition-colors hover:text-accent">
              {content.altLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
