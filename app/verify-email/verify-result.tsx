"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthStatusCard, Icons, type AuthTone } from "@/components/auth-status-card";
import { primaryButton, secondaryButton } from "@/components/game-ui";

type State = {
  tone: AuthTone;
  icon: keyof typeof Icons;
  eyebrow: string;
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
};

const STATES: Record<string, State> = {
  success: {
    tone: "success",
    icon: "check",
    eyebrow: "Email confirmed",
    title: "You're verified.",
    body: "Your email is confirmed and your account is ready. Log in to start building your greener routine.",
    primary: { label: "Continue to log in", href: "/login" },
    secondary: { label: "Back to home", href: "/" }
  },
  expired: {
    tone: "warning",
    icon: "clock",
    eyebrow: "Link expired",
    title: "That link has expired.",
    body: "Verification links are single-use and expire after a while for your security. Request a fresh one and we'll send it right away.",
    primary: { label: "Resend verification email", href: "/resend-verification" },
    secondary: { label: "Back to home", href: "/" }
  },
  invalid: {
    tone: "danger",
    icon: "linkOff",
    eyebrow: "Link not valid",
    title: "That link doesn't work.",
    body: "The verification link is malformed or already used. Request a new one to confirm your email.",
    primary: { label: "Resend verification email", href: "/resend-verification" },
    secondary: { label: "Back to home", href: "/" }
  }
};

export function VerifyEmailResult() {
  const params = useSearchParams();
  const status = params.get("status");
  const state = STATES[status ?? ""] ?? STATES.invalid;

  return (
    <AuthStatusCard
      tone={state.tone}
      icon={Icons[state.icon]}
      eyebrow={state.eyebrow}
      title={state.title}
      body={state.body}
    >
      <Link href={state.primary.href} className={`w-full ${primaryButton}`}>
        {state.primary.label}
      </Link>
      <Link href={state.secondary.href} className={`w-full ${secondaryButton}`}>
        {state.secondary.label}
      </Link>
    </AuthStatusCard>
  );
}