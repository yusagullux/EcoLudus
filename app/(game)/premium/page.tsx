"use client";

import { PageHero, Panel, Pill, heroAccents } from "@/components/game-ui";
import { StaggerContainer, StaggerItem } from "@/lib/animations";

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
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
      <PageHero
        eyebrow="Unlock more impact"
        title="Premium"
        description="Supercharge your eco journey with advanced features. Premium tiers are coming soon."
        accent={heroAccents.premium}
      />
      </StaggerItem>

      <StaggerItem as="div">

      {/* Coming soon banner */}
      <div
        className="rounded-2xl border px-5 py-4"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>Premium is in development</p>
            <p className="mt-0.5 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              All features below are planned for a future release. Free tier remains free forever.
            </p>
          </div>
        </div>
      </div>
      </StaggerItem>

      {/* Pricing plans */}
      <StaggerContainer className="grid gap-4 sm:grid-cols-3" as="div">
        {PLANS.map((plan) => (
          <StaggerItem key={plan.name} as="div">
          <article
            className="flex h-full flex-col rounded-[22px] border p-6"
            style={{
              borderColor: plan.highlight ? "var(--text-accent)" : "var(--border-default)",
              background: "var(--bg-panel)",
              boxShadow: plan.highlight ? "var(--shadow-lift)" : "var(--shadow-card)"
            }}
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
              <span className="font-serif text-4xl font-extrabold" style={{ color: "var(--text-primary)" }}>{plan.price}</span>
              <span className="mb-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{plan.period}</span>
            </div>

            <ul className="mt-5 flex flex-col gap-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  <span className="mt-0.5 shrink-0 text-[10px]" style={{ color: plan.color }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            {plan.name === "Free" ? (
              <span
                className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold"
                style={{ background: "var(--bg-panel-alt)", color: "var(--text-muted)" }}
              >
                <span aria-hidden>✓</span> {plan.cta}
              </span>
            ) : (
              <span
                className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-extrabold tracking-[0.02em]"
                style={
                  plan.highlight
                    ? { borderColor: "color-mix(in srgb, var(--text-accent) 40%, transparent)", background: "color-mix(in srgb, var(--text-accent) 8%, var(--bg-panel-alt))", color: "var(--text-accent)" }
                    : { borderColor: "var(--border-default)", background: "var(--bg-panel-alt)", color: "var(--text-muted)" }
                }
              >
                <span aria-hidden>🚧</span> {plan.cta}
              </span>
            )}
          </article>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Feature grid */}
      <StaggerItem as="div">
      <Panel eyebrow="What's coming" title="Premium Features">
        <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" as="div">
          {PREMIUM_FEATURES.map(({ icon, title, desc, tag, color }) => (
            <StaggerItem key={title} as="div">
            <div
              className="relative overflow-hidden rounded-2xl border p-4"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel-alt)" }}
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
              <p className="mt-3 text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{title}</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="h-px flex-1" style={{ background: "var(--border-default)" }} />
                <span className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Locked
                </span>
                <span className="h-px flex-1" style={{ background: "var(--border-default)" }} />
              </div>
            </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Panel>
      </StaggerItem>

      {/* FAQ */}
      <StaggerItem as="div">
      <Panel eyebrow="Questions" title="FAQ">
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--border-subtle)" }}>
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
              a: "Tree planting milestones are tracked for all users. Real tree planting via our Ecologi partnership is coming soon — premium will make it faster once live."
            }
          ].map(({ q, a }) => (
            <div key={q} className="py-4 first:pt-0 last:pb-0">
              <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{q}</p>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{a}</p>
            </div>
          ))}
        </div>
      </Panel>
      </StaggerItem>
    </StaggerContainer>
  );
}