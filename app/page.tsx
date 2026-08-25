import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { LiveStatsCard } from "@/components/live-stats-card";
import { GardenPreview } from "@/components/garden-preview";
import { FadeIn, StaggerContainer, StaggerItem } from "@/lib/animations";

// The root URL is the canonical homepage. `/landing` is a permanent redirect
// here (kept for inbound links/bookmarks), so the indexed, linkable surface is
// `https://ecoludus.com/` — no redirect tax on every first visitor.
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

const features = [
  {
    index: "01",
    title: "Daily eco missions",
    text: "Complete short, meaningful sustainability habits with a clearer, more motivating dashboard."
  },
  {
    index: "02",
    title: "Rewarded progress",
    text: "Earn XP, EcoPoints, rare plants, and pets through a calmer, easier-to-scan experience."
  },
  {
    index: "03",
    title: "Team momentum",
    text: "Collaborate on eco goals with friends while keeping the same mission and leaderboard systems."
  },
  {
    index: "04",
    title: "Measured impact",
    text: "Track carbon reduction, category growth, and progress insights in a more premium visual style."
  }
];

const mockups = [
  { src: "/screenshot-virtual-garden.png", alt: "Real screenshot of the EcoLudus virtual garden with planted sunflowers and unlockable tiles", label: "Virtual garden", caption: "Grow a living collection" },
  { src: "/screenshot-daily-missions.png", alt: "Real screenshot of the EcoLudus dashboard showing today's eco quests and progress stats", label: "Daily missions", caption: "Verified, rewarded habits" },
  { src: "/screenshot-carbon-tracker.png", alt: "Real screenshot of the EcoLudus impact tracker showing CO₂ savings and category breakdown", label: "Impact tracker", caption: "See your CO₂ savings" }
];

export default function HomePage() {
  return (
    <MarketingShell ctaHref="/login" ctaLabel="Sign in">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pt-14">
        {/* ── Hero ── */}
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
          <FadeIn as="div" className="max-w-3xl">
            <div className="mk-surface inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--text-accent)" }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--text-accent)" }} />
              </span>
              <span className="mk-c-accent">Gamified sustainability, made daily</span>
            </div>
            <h1 className="mk-c-primary mt-6 text-balance font-serif text-5xl leading-[0.95] sm:text-6xl lg:text-[4.25rem]">
              Play, protect, and grow a greener tomorrow.
            </h1>
            <p className="mk-c-secondary mt-6 max-w-2xl text-lg leading-8 sm:text-xl">
              EcoLudus turns eco-friendly habits into a rewarding daily ritual — missions, collections, leaderboards,
              teams, and progress tracking, wrapped in a calm nature-inspired design.
            </p>
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
              <Link
                href="/signup"
                className="mk-btn-primary inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] transition-all hover:-translate-y-0.5"
              >
                Start your journey
              </Link>
              <Link
                href="/login"
                className="mk-btn-ghost inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] transition-all hover:-translate-y-0.5"
              >
                Sign in
              </Link>
            </div>
            <p className="mk-c-muted mt-5 text-xs">Free to join · No credit card · Track your CO₂ savings</p>
          </FadeIn>

          <FadeIn as="div" className="relative" delay={0.15}>
            <Suspense fallback={
              <div className="mk-surface rounded-[2rem] p-5">
                <div className="mk-hero rounded-[1.5rem] p-6 py-12 text-center shadow-inner">
                  <p className="mk-c-sidebar-muted">Loading live data...</p>
                </div>
              </div>
            }>
              <LiveStatsCard />
            </Suspense>
          </FadeIn>
        </div>

        {/* App Previews Mockups */}
        <section className="py-2">
          <FadeIn as="div" className="mb-12 max-w-2xl">
            <p className="mk-c-muted text-xs font-bold uppercase tracking-[0.2em]">A tour of the experience</p>
            <h2 className="mk-c-primary mt-3 font-serif text-4xl sm:text-5xl">A calmer way to save the planet.</h2>
            <p className="mk-c-secondary mt-4 text-lg font-medium">Track, complete, and grow with interfaces designed to make good habits stick.</p>
          </FadeIn>
          <StaggerContainer as="div" className="grid items-start gap-6 md:grid-cols-3" staggerDelay={0.1} inView>
            {mockups.map((m, i) => (
              <StaggerItem
                as="figure"
                key={m.src}
                className={`mk-surface group overflow-hidden rounded-[2rem] transition-all duration-300 hover:-translate-y-1.5 ${i === 1 ? "md:translate-y-6" : ""}`}
              >
                <div className="mk-bg-alt relative aspect-[3/4] overflow-hidden">
                  <Image src={m.src} alt={m.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
                <figcaption className="mk-bd-subtle flex items-center justify-between border-t px-5 py-4">
                  <div>
                    <p className="mk-c-primary font-serif text-base font-semibold">{m.label}</p>
                    <p className="mk-c-muted text-xs">{m.caption}</p>
                  </div>
                  <span className="mk-c-accent font-serif text-sm font-bold opacity-60">0{i + 1}</span>
                </figcaption>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>

        {/* About + Features */}
        <section id="about" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
          <FadeIn as="div" className="mk-surface rounded-[2rem] p-8 sm:p-10">
            <p className="mk-c-muted text-xs font-bold uppercase tracking-[0.22em]">About EcoLudus</p>
            <h2 className="mk-c-primary mt-4 font-serif text-4xl sm:text-[2.75rem] sm:leading-[1.05]">A gentler path to visible environmental action.</h2>
            <p className="mk-c-secondary mt-5 text-base leading-8 font-medium">
              EcoLudus makes sustainability feel tangible. Complete daily missions, track your impact, grow your virtual
              collection, and stay motivated through a peaceful, modern experience designed to make good habits stick.
            </p>
            <div className="mk-bd-subtle mt-7 flex items-center gap-6 border-t pt-6">
              <div>
                <p className="mk-c-primary font-serif text-3xl font-bold">100%</p>
                <p className="mk-c-muted text-xs">Free to join</p>
              </div>
              <div className="mk-bd h-10 w-px border-l" />
              <div>
                <p className="mk-c-primary font-serif text-3xl font-bold">AI</p>
                <p className="mk-c-muted text-xs">Proof verification</p>
              </div>
            </div>
          </FadeIn>
          <StaggerContainer as="div" id="features" className="grid gap-5 sm:grid-cols-2" staggerDelay={0.08} inView>
            {features.map((feature) => (
              <StaggerItem
                as="article"
                key={feature.title}
                className="mk-surface group relative overflow-hidden rounded-[2rem] p-6 transition-all duration-300 hover:-translate-y-1"
              >
                <span className="mk-c-accent font-serif text-sm font-bold opacity-50">{feature.index}</span>
                <h3 className="mk-c-primary mt-3 font-serif text-2xl">{feature.title}</h3>
                <p className="mk-c-secondary mt-3 text-sm font-medium leading-7">{feature.text}</p>
                <span className="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-300 group-hover:w-full" style={{ background: "var(--text-accent)" }} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>

        {/* Garden Preview */}
        <FadeIn as="section">
          <GardenPreview />
        </FadeIn>

        {/* Experience CTA */}
        <FadeIn
          as="section"
          id="experience"
          className="mk-hero relative overflow-hidden rounded-[2.5rem] px-6 py-12 shadow-[var(--shadow-lift)] sm:px-12 sm:py-14"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full opacity-10 blur-3xl" style={{ background: "var(--text-accent)" }} />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mk-c-accent text-xs font-semibold uppercase tracking-[0.22em]">Redesigned experience</p>
              <h2 className="mk-c-sidebar mt-4 font-serif text-4xl sm:text-5xl">The same mission system, now with a calmer premium feel.</h2>
              <p className="mk-c-sidebar-muted mt-5 text-base leading-8">
                Better spacing, stronger hierarchy, smoother interactions, and a richer natural palette make the full
                product easier to use without changing the features your users already know.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex shrink-0 items-center justify-center rounded-full px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] transition-all hover:-translate-y-0.5"
              style={{ background: "var(--text-sidebar)", color: "var(--bg-sidebar)" }}
            >
              Explore the full version
            </Link>
          </div>
        </FadeIn>
      </section>
    </MarketingShell>
  );
}