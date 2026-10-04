import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { HeroSection } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { MissionsShowcase } from "@/components/landing/missions";
import { GardenShowcase } from "@/components/landing/garden";
import { RewardsShowcase } from "@/components/landing/rewards";
import { ImpactShowcase } from "@/components/landing/impact";
import { CommunitySection } from "@/components/landing/community";
import { FinalCta } from "@/components/landing/final-cta";
import { GardenPreview } from "@/components/garden-preview";

// The root URL is the canonical homepage. `/landing` is a permanent redirect
// here (kept for inbound links/bookmarks), so the indexed, linkable surface is
// `https://ecoludus.com/` — no redirect tax on every first visitor.
//
// Visual identity: the "Field Guide" system — see
// docs/superpowers/specs/2026-10-01-landing-visual-redesign.md. Section
// components live in components/landing/.
export const metadata: Metadata = {
  title: "EcoLudus | Sustainable Habits, Real Impact",
  description:
    "EcoLudus turns eco-friendly habits into a rewarding daily ritual. Complete quests, grow a virtual garden, collect species, and track your carbon footprint.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "EcoLudus | Sustainable Habits, Real Impact",
    description:
      "Turn eco actions into rewards. Complete daily eco missions, grow a virtual garden, collect species, and track your carbon footprint.",
    url: "https://ecoludus.com",
    siteName: "EcoLudus",
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "EcoLudus | Sustainable Habits, Real Impact",
    description:
      "Turn eco actions into rewards and grow your virtual collection in a modern nature-inspired experience."
  }
};

export default function HomePage() {
  return (
    <MarketingShell ctaHref="/signup" ctaLabel="Start growing">
      <div className="flex flex-col gap-24 pb-8 pt-8 sm:gap-28 lg:gap-32">
        <HeroSection />
        <HowItWorks />
        <MissionsShowcase />
        <GardenShowcase />
        <RewardsShowcase />
        <ImpactShowcase />
        <CommunitySection />
        <section id="preview" aria-label="Interactive garden preview">
          <GardenPreview />
        </section>
        <FinalCta />
      </div>
    </MarketingShell>
  );
}