// @ts-nocheck
"use client";

import { PageHero, Panel, Pill } from "@/components/game-ui";

const PREMIUM_FEATURES = [
  {
    icon: "🎨",
    title: "Custom Avatars",
    desc: "Unlock exclusive animal avatars beyond the base 9 tiers. Stand out on the leaderboard.",
    tag: "Cosmetics",
    color: "#62508f"
  },
  {
    icon: "📊",
    title: "Advanced Analytics",
    desc: "Detailed carbon impact charts, weekly trend breakdowns, and personal CO₂ reduction forecasting.",
    tag: "Insights",
    color: "#2f5f86"
  },
  {
    icon: "⚡",
    title: "Early Access Quests",
    desc: "Get new eco challenges 48 hours before they go live for free users.",
    tag: "Quests",
    color: "#9a6b1f"
  },
  {
    icon: "🌳",
    title: "Priority Tree Planting",
    desc: "Trees are planted within 24 hours of reaching a milestone instead of the nightly cron window.",
    tag: "Impact",
    color: "#2f6b46"
  },
  {
    icon: "🏅",
    title: "Exclusive Badges",
    desc: "Premium-only profile badges and rare plant drops in the shop.",
    tag: "Cosmetics",
    color: "#237482"
  },
  {
    icon: "📧",
    title: "Weekly Impact Reports",
    desc: "Personalized email digests with your XP, CO₂ savings, rank movement, and tips.",
    tag: "Insights",
    color: "#4c7a3b"
  },
  {
    icon: "👥",
    title: "Unlimited Team Members",
    desc: "Free tier is capped at 5 per team. Premium removes this limit.",
    tag: "Teams",
    color: "#62508f"
  },
  {
    icon: "🔌",
    title: "API Access",
    desc: "Export your carbon data and mission history via a personal API key.",
    tag: "Developer",
    color: "#5d6f7a"
  }
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    color: "#2f6b46",
    features: [
      "5 daily quests",
      "Basic leaderboard",
      "Carbon tracking",
      "Tree planting milestones",
      "Up to 5 team members",
      "3 private habit missions"
    ],
    cta: "Current plan",
    disabled: true
  },
  {
    name: "Pro",
    price: "$4",
    period: "per month",
    color: "#9a6b1f",
    highlight: true,
    features: [
      "Everything in Free",
      "Unlimited daily quests",
      "Advanced analytics",
      "Early access quests",
      "Priority tree planting",
      "Weekly email reports",
      "Exclusive badges & avatars",
      "Unlimited team members"
    ],
    cta: "Coming soon",
    disabled: true
  },
  {
    name: "Team",
    price: "$12",
    period: "per month",
    color: "#2f5f86",
    features: [
      "Everything in Pro",
      "Up to 20 team members",
      "Team analytics dashboard",
      "Corporate carbon reports",
      "API access",
      "Priority support"
    ],
    cta: "Coming soon",
    disabled: true
  }
];

export default function PremiumPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Unlock more impact"
        title="Premium"
        description="Supercharge your eco journey with advanced features. Coming soon — join the waitlist."
      />

      {/* Coming soon banner */}
      <div className="rounded-2xl border border-[#e6d3a6] bg-[#fbf4df] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="text-sm font-extrabold text-[#76511a]">Premium is in development</p>
            <p className="mt-0.5 text-xs font-semibold text-[#76511a]/70">
              All features below are planned for a future release. Free tier remains free forever.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing plans */}
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <article
            key={plan.name}
            className={`flex flex-col rounded-[22px] border p-6 shadow-[0_12px_32px_rgba(26,45,29,0.06)] ${
              plan.highlight
                ? "border-[#e6d3a6] bg-[#fbf4df] ring-2 ring-[#c99a3a]/20"
                : "border-[#dfe7d7] bg-[#fffefa]"
            }`}
          >
            {plan.highlight && (
              <div className="mb-3">
                <Pill active>Most popular</Pill>
              </div>
            )}
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: plan.color }}>
              {plan.name}
            </p>
            <div className="mt-2 flex items-end gap-1.5">
              <span className="font-serif text-4xl font-extrabold text-forest-950">{plan.price}</span>
              <span className="mb-1 text-xs font-semibold text-forest-700/54">{plan.period}</span>
            </div>

            <ul className="mt-5 flex flex-col gap-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-xs font-semibold text-forest-800">
                  <span className="mt-0.5 shrink-0 text-[10px]" style={{ color: plan.color }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              disabled={plan.disabled}
              className={`mt-6 w-full rounded-xl py-2.5 text-xs font-extrabold uppercase tracking-wider transition ${
                plan.highlight
                  ? "bg-[#9a6b1f]/10 text-[#76511a] cursor-not-allowed"
                  : "bg-forest-50 text-forest-700 cursor-not-allowed"
              }`}
            >
              {plan.cta}
            </button>
          </article>
        ))}
      </div>

      {/* Feature grid */}
      <Panel eyebrow="What's coming" title="Premium Features">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PREMIUM_FEATURES.map(({ icon, title, desc, tag, color }) => (
            <div
              key={title}
              className="relative overflow-hidden rounded-2xl border border-[#dfe7d7] bg-[#f7f9f2] p-4 opacity-75"
            >
              <div className="absolute right-3 top-3">
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white"
                  style={{ background: color }}
                >
                  {tag}
                </span>
              </div>
              <p className="text-2xl">{icon}</p>
              <p className="mt-3 text-sm font-extrabold text-forest-950">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-forest-700/62">{desc}</p>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="h-px flex-1 bg-[#e7ecdf]" />
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-forest-700/38">
                  Locked
                </span>
                <span className="h-px flex-1 bg-[#e7ecdf]" />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* FAQ */}
      <Panel eyebrow="Questions" title="FAQ">
        <div className="flex flex-col divide-y divide-[#e7ecdf]">
          {[
            {
              q: "Will the free tier be limited?",
              a: "No. The free tier stays free, forever. Premium adds extra features on top — it doesn't gate core functionality."
            },
            {
              q: "When does Premium launch?",
              a: "We're targeting a launch alongside Phase 3 of EcoLudus. Follow the roadmap in the community."
            },
            {
              q: "Is carbon tracking always real?",
              a: "Yes. Carbon values are always sourced from the Climatiq API or the quest catalog — never estimated or fabricated."
            },
            {
              q: "Do free users get trees planted?",
              a: "Yes. Tree planting milestones are available to all users. Premium just makes it happen faster."
            }
          ].map(({ q, a }) => (
            <div key={q} className="py-4 first:pt-0 last:pb-0">
              <p className="text-sm font-extrabold text-forest-950">{q}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-forest-700/62">{a}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
