import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { MarketingShell } from "@/components/marketing-shell";
import { LiveStatsCard } from "@/components/live-stats-card";
import { GardenPreview } from "@/components/garden-preview";

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
  { src: "/mockup-virtual-garden.png", alt: "Virtual Garden", label: "Virtual garden", caption: "Grow a living collection" },
  { src: "/mockup-daily-missions.png", alt: "Daily Missions", label: "Daily missions", caption: "Verified, rewarded habits" },
  { src: "/mockup-carbon-tracker.png", alt: "Carbon Tracker", label: "Impact tracker", caption: "See your CO₂ savings" }
];

export default function LandingPage() {
  return (
    <MarketingShell ctaHref="/login" ctaLabel="Sign in">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pt-14">
        {/* ── Hero ── */}
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-forest-900/10 bg-white/75 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-forest-700 shadow-[0_10px_28px_rgba(16,33,20,0.06)] backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest-600" />
              </span>
              Gamified sustainability, made daily
            </div>
            <h1 className="mt-6 text-balance font-serif text-5xl leading-[0.95] text-forest-950 sm:text-6xl lg:text-[4.25rem]">
              Play, protect, and grow a greener tomorrow.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-forest-900/75 sm:text-xl">
              EcoLudus turns eco-friendly habits into a rewarding daily ritual — missions, collections, leaderboards,
              teams, and progress tracking, wrapped in a calm nature-inspired design.
            </p>
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-forest-900 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-cream-100 shadow-[0_18px_44px_rgba(16,33,20,0.22)] transition-all hover:-translate-y-0.5 hover:bg-forest-800"
              >
                Start your journey
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-forest-900/12 bg-white/80 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-forest-900 shadow-[0_14px_32px_rgba(16,33,20,0.07)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-forest-900/20 hover:bg-white"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-xs text-forest-900/55">Free to join · No credit card · Track your CO₂ savings</p>
          </div>

          <div className="relative">
            <Suspense fallback={
              <div className="rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(239,243,232,0.82))] p-5 shadow-[0_35px_90px_rgba(16,33,20,0.16)] backdrop-blur-xl">
                <div className="rounded-[1.5rem] bg-[linear-gradient(180deg,#26472e_0%,#16301d_100%)] p-6 text-cream-100 shadow-inner text-center py-12">
                  <p className="text-moss-300">Loading live data...</p>
                </div>
              </div>
            }>
              <LiveStatsCard />
            </Suspense>
          </div>
        </div>

        {/* App Previews Mockups */}
        <section className="py-2">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest-700/70">A tour of the experience</p>
            <h2 className="mt-3 font-serif text-4xl text-forest-950 sm:text-5xl">A calmer way to save the planet.</h2>
            <p className="mt-4 text-lg font-medium text-forest-900/80">Track, complete, and grow with interfaces designed to make good habits stick.</p>
          </div>
          <div className="grid items-start gap-6 md:grid-cols-3">
            {mockups.map((m, i) => (
              <figure
                key={m.src}
                className={`group overflow-hidden rounded-[2rem] border border-forest-900/10 shadow-[0_24px_50px_rgba(16,33,20,0.1)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_32px_64px_rgba(16,33,20,0.16)] ${i === 1 ? "md:translate-y-6" : ""}`}
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-forest-50">
                  <Image src={m.src} alt={m.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
                <figcaption className="flex items-center justify-between border-t border-forest-900/8 bg-white/70 px-5 py-4 backdrop-blur">
                  <div>
                    <p className="font-serif text-base font-semibold text-forest-950">{m.label}</p>
                    <p className="text-xs text-forest-900/60">{m.caption}</p>
                  </div>
                  <span className="font-serif text-sm font-bold text-forest-700/50">0{i + 1}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* About + Features */}
        <section id="about" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
          <div className="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_28px_70px_rgba(16,33,20,0.1)] backdrop-blur sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-forest-700/70">About EcoLudus</p>
            <h2 className="mt-4 font-serif text-4xl text-forest-950 sm:text-[2.75rem] sm:leading-[1.05]">A gentler path to visible environmental action.</h2>
            <p className="mt-5 text-base leading-8 font-medium text-forest-900/85">
              EcoLudus makes sustainability feel tangible. Complete daily missions, track your impact, grow your virtual
              collection, and stay motivated through a peaceful, modern experience designed to make good habits stick.
            </p>
            <div className="mt-7 flex items-center gap-6 border-t border-forest-900/8 pt-6">
              <div>
                <p className="font-serif text-3xl font-bold text-forest-950">100%</p>
                <p className="text-xs text-forest-900/60">Free to join</p>
              </div>
              <div className="h-10 w-px bg-forest-900/10" />
              <div>
                <p className="font-serif text-3xl font-bold text-forest-950">AI</p>
                <p className="text-xs text-forest-900/60">Proof verification</p>
              </div>
            </div>
          </div>
          <div id="features" className="grid gap-5 sm:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/72 p-6 shadow-[0_24px_60px_rgba(16,33,20,0.08)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_70px_rgba(16,33,20,0.12)]"
              >
                <span className="font-serif text-sm font-bold text-forest-700/40">{feature.index}</span>
                <h3 className="mt-3 font-serif text-2xl text-forest-950">{feature.title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-forest-900/85">{feature.text}</p>
                <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-forest-700 transition-all duration-300 group-hover:w-full" />
              </article>
            ))}
          </div>
        </section>

        {/* Garden Preview */}
        <section>
          <GardenPreview />
        </section>

        {/* Experience CTA */}
        <section
          id="experience"
          className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-[linear-gradient(135deg,rgba(23,48,29,0.97),rgba(46,99,54,0.92))] px-6 py-12 text-cream-100 shadow-[0_35px_90px_rgba(16,33,20,0.2)] sm:px-12 sm:py-14"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-moss-300/10 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-moss-300">Redesigned experience</p>
              <h2 className="mt-4 font-serif text-4xl sm:text-5xl">The same mission system, now with a calmer premium feel.</h2>
              <p className="mt-5 text-base leading-8 text-cream-100/78">
                Better spacing, stronger hierarchy, smoother interactions, and a richer natural palette make the full
                product easier to use without changing the features your users already know.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-cream-100 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-forest-900 transition-all hover:-translate-y-0.5 hover:bg-white"
            >
              Explore the full version
            </Link>
          </div>
        </section>
      </section>
    </MarketingShell>
  );
}
