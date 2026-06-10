import Link from "next/link";
import Image from "next/image";
import { MarketingShell } from "@/components/marketing-shell";

const features = [
  {
    title: "Daily eco missions",
    text: "Complete short, meaningful sustainability habits with a clearer, more motivating dashboard."
  },
  {
    title: "Rewarded progress",
    text: "Earn XP, EcoPoints, rare plants, and pets through a calmer, easier-to-scan experience."
  },
  {
    title: "Team momentum",
    text: "Collaborate on eco goals with friends while keeping the same mission and leaderboard systems."
  },
  {
    title: "Measured impact",
    text: "Track carbon reduction, category growth, and progress insights in a more premium visual style."
  }
];

export default function LandingPage() {
  return (
    <MarketingShell ctaHref="/login" ctaLabel="Enter EcoLudus">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 pb-14 pt-6 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-forest-900/10 bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-forest-700 shadow-[0_14px_34px_rgba(16,33,20,0.08)] backdrop-blur">
              Calm forest theme
            </div>
            <h1 className="mt-6 font-serif text-5xl leading-[0.92] text-forest-950 sm:text-6xl lg:text-7xl">
              Play, protect, and grow in a more beautiful sustainability experience.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-forest-900/78 sm:text-xl">
              EcoLudus turns eco-friendly habits into a rewarding daily ritual with missions, collections, leaderboards,
              teams, and progress tracking wrapped in a modern nature-inspired design.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-forest-900 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-cream-100 shadow-[0_24px_54px_rgba(16,33,20,0.22)] hover:-translate-y-0.5 hover:bg-forest-800"
              >
                Start your journey
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-forest-900/12 bg-white/78 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-forest-900 shadow-[0_20px_40px_rgba(16,33,20,0.08)] backdrop-blur hover:-translate-y-0.5 hover:bg-white"
              >
                Continue exploring
              </Link>
            </div>

          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(239,243,232,0.82))] p-5 shadow-[0_35px_90px_rgba(16,33,20,0.16)] backdrop-blur-xl">
              <div className="rounded-[1.5rem] bg-[linear-gradient(180deg,#26472e_0%,#16301d_100%)] p-6 text-cream-100 shadow-inner">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-moss-300">Today&apos;s pulse</p>
                    <h2 className="mt-3 font-serif text-3xl">Forest dashboard</h2>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                    <div className="text-xs uppercase tracking-[0.22em] text-moss-300">CO₂ reduced</div>
                    <div className="mt-2 text-3xl font-semibold">18.4kg</div>
                  </div>
                </div>
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  {[
                    ["XP", "2,480"],
                    ["EcoPoints", "1,160"],
                    ["Level", "6"]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-3xl border border-white/10 bg-white/8 px-4 py-5">
                      <div className="text-xs uppercase tracking-[0.2em] text-moss-300">{label}</div>
                      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/8 p-5">
                  <div className="flex items-center justify-between text-sm text-moss-300">
                    <span>Daily missions</span>
                    <span>3 / 5 complete</span>
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-white/10">
                    <div className="h-3 w-3/5 rounded-full bg-[linear-gradient(90deg,#d8ead0,#7cb082)]" />
                  </div>
                  <div className="mt-5 grid gap-3 text-sm">
                    {["Reusable bottle refill", "Walk instead of drive", "Sort household recycling"].map((task) => (
                      <div key={task} className="flex items-center justify-between rounded-2xl bg-black/10 px-4 py-3">
                        <span>{task}</span>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em]">active</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>



        {/* App Previews Mockups */}
        <section className="py-10">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-4xl text-forest-950">A beautiful way to save the planet.</h2>
            <p className="mt-4 text-lg font-medium text-forest-900">Track, complete, and grow with our stunning interfaces.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="overflow-hidden rounded-[2rem] border border-forest-900/10 shadow-[0_24px_50px_rgba(16,33,20,0.1)]">
              <Image src="/mockup-virtual-garden.png" alt="Virtual Garden" width={600} height={800} className="w-full object-cover" />
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-forest-900/10 shadow-[0_24px_50px_rgba(16,33,20,0.1)]">
              <Image src="/mockup-daily-missions.png" alt="Daily Missions" width={600} height={800} className="w-full object-cover" />
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-forest-900/10 shadow-[0_24px_50px_rgba(16,33,20,0.1)]">
              <Image src="/mockup-carbon-tracker.png" alt="Carbon Tracker" width={600} height={800} className="w-full object-cover" />
            </div>
          </div>
        </section>

        <section id="about" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_28px_70px_rgba(16,33,20,0.12)] backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-forest-800">About EcoLudus</p>
            <h2 className="mt-4 font-serif text-4xl text-forest-950">A gentler path to visible environmental action.</h2>
            <p className="mt-5 text-base leading-8 font-medium text-forest-900/90">
              EcoLudus makes sustainability feel tangible. Complete daily missions, track your impact, grow your virtual
              collection, and stay motivated through a peaceful, modern experience designed to make good habits stick.
            </p>
          </div>
          <div id="features" className="grid gap-5 md:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[2rem] border border-white/70 bg-white/72 p-6 shadow-[0_24px_60px_rgba(16,33,20,0.1)] backdrop-blur transition-transform hover:-translate-y-1"
              >
                <h3 className="font-serif text-3xl text-forest-950">{feature.title}</h3>
                <p className="mt-4 text-sm font-medium leading-7 text-forest-900/90">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>



        <section
          id="experience"
          className="rounded-[2.5rem] border border-white/70 bg-[linear-gradient(135deg,rgba(23,48,29,0.97),rgba(46,99,54,0.92))] px-6 py-10 text-cream-100 shadow-[0_35px_90px_rgba(16,33,20,0.2)] sm:px-10"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss-300">Redesigned experience</p>
              <h2 className="mt-4 font-serif text-4xl sm:text-5xl">The same mission system, now with a calmer premium feel.</h2>
              <p className="mt-5 text-base leading-8 text-cream-100/78">
                Better spacing, stronger hierarchy, smoother interactions, and a richer natural palette make the full
                product easier to use without changing the features your users already know.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-cream-100 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-forest-900 hover:-translate-y-0.5 hover:bg-white"
            >
              Explore the full version
            </Link>
          </div>
        </section>
      </section>
    </MarketingShell>
  );
}
