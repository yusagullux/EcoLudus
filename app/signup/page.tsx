import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Create your profile | EcoLudus",
  description: "Sign up for EcoLudus and turn eco-friendly habits into a rewarding daily ritual with quests, a virtual garden, and real impact tracking.",
  alternates: { canonical: "/signup" }
};

export default function SignupPage() {
  return (
    <MarketingShell ctaHref="/login" ctaLabel="Log in">
      <AuthCard mode="signup" />
    </MarketingShell>
  );
}
