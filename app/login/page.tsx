import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Log in | EcoLudus",
  description: "Log in to EcoLudus to resume your daily eco missions, grow your garden, and track your carbon impact.",
  alternates: { canonical: "/login" }
};

export default function LoginPage() {
  return (
    <MarketingShell ctaHref="/signup" ctaLabel="Create profile">
      <AuthCard mode="login" />
    </MarketingShell>
  );
}
