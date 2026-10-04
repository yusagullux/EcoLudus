"use client";

import { PageHeader, Panel, Pill } from "@/components/game-ui";
import { StaggerContainer, StaggerItem } from "@/lib/animations";
import {
  Award,
  BarChart3,
  Check,
  Clock,
  Mail,
  Palette,
  Plug,
  Sprout,
  TreeDeciduous,
  Users,
  Zap
} from "lucide-react";

// Same generous "friendly game card" radius the kit uses.
const CARD = "rounded-[1.25rem]";

// Tint helper — mix any theme var into the current panel color.
const wash = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, var(--bg-panel))`;

// Gold accent mixes for the highlighted plan — one accent family (gold),
// mixed over the sanctioned tint bases (never var(--bg-card)).
const goldBorder = "color-mix(in srgb, var(--accent-gold) 45%, var(--border-default))";
const goldWash = "color-mix(in srgb, var(--accent-gold) 6%, var(--bg-panel))";

// Feature tags + plan accents come from the shared category palette
// (`bg-cat-*` chips for the tag pills, raw `--accent-*` vars for the icon
// tiles) so this page can't drift from the rest of the app's accent system.
type PremiumFeature = {
  icon: typeof Sprout;
  title: string;
  desc: string;
  tag: string;
  accentVar: string;
  inkVar: string;
  chipClass: string;
};

const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    icon: Palette,
    title: "Exclusive avatars",
    desc: "Unlock animal avatars beyond the base 9 tiers. Stand out on the leaderboard.",
    tag: "Cosmetics",
    accentVar: "var(--accent-violet)",
    inkVar: "var(--accent-violet-text)",
    chipClass: "bg-cat-violet text-cat-violet-ink"
  },
  {
    icon: BarChart3,
    title: "Impact insights",
    desc: "Detailed carbon charts, weekly trends, and a forecast of your CO₂ reduction.",
    tag: "Insights",
    accentVar: "var(--accent-blue)",
    inkVar: "var(--accent-blue-text)",
    chipClass: "bg-cat-blue text-cat-blue-ink"
  },
  {
    icon: Zap,
    title: "Early-access quests",
    desc: "Try brand-new eco challenges 48 hours before they go live for everyone.",
    tag: "Quests",
    accentVar: "var(--accent-gold)",
    inkVar: "var(--accent-gold-text)",
    chipClass: "bg-cat-gold text-cat-gold-ink"
  },
  {
    icon: TreeDeciduous,
    title: "Priority tree planting",
    desc: "Milestone trees go in the ground within 24 hours instead of the nightly window.",
    tag: "Impact",
    accentVar: "var(--accent-green)",
    inkVar: "var(--accent-green-text)",
    chipClass: "bg-cat-green text-cat-green-ink"
  },
  {
    icon: Award,
    title: "Rare badges & drops",
    desc: "Premium-only profile badges and rare plant drops appearing in the shop.",
    tag: "Cosmetics",
    accentVar: "var(--accent-violet)",
    inkVar: "var(--accent-violet-text)",
    chipClass: "bg-cat-violet text-cat-violet-ink"
  },
  {
    icon: Mail,
    title: "Weekly impact reports",
    desc: "A personalised email with your XP, CO₂ savings, rank movement, and a tip.",
    tag: "Insights",
    accentVar: "var(--accent-blue)",
    inkVar: "var(--accent-blue-text)",
    chipClass: "bg-cat-blue text-cat-blue-ink"
  },
  {
    icon: Users,
    title: "Bigger teams",
    desc: "Free teams hold 5 members; premium lifts the cap so more friends can join.",
    tag: "Teams",
    accentVar: "var(--accent-violet)",
    inkVar: "var(--accent-violet-text)",
    chipClass: "bg-cat-violet text-cat-violet-ink"
  },
  {
    icon: Plug,
    title: "Data export & API",
    desc: "Export your carbon data and mission history through a personal API key.",
    tag: "Developer",
    accentVar: "var(--accent-slate)",
    inkVar: "var(--accent-slate-text)",
    chipClass: "bg-cat-slate text-cat-slate-ink"
  }
];

type Plan = {
  name: string;
  price: string;
  period: string;
  inkClass: string;
  highlight?: boolean;
  features: string[];
  cta: string;
};

// All plans ship as display cards: the CTA is a DISABLED span (no handler, no
// checkout) — premium is announced, not purchasable, yet.
const PLANS: Plan[] = [
  {
    name: "Free",
    price: "Free",
    period: "forever",
    inkClass: "text-cat-green-ink",
    features: [
      "5 daily quests",
      "Basic leaderboard",
      "Carbon tracking",
      "Tree planting milestones",
      "Up to 5 team members",
      "3 private habit missions"
    ],
    cta: "Current plan"
  },
  {
    name: "Pro",
    price: "$4",
    period: "per month",
    inkClass: "text-cat-gold-ink",
    highlight: true,
    features: [
      "Everything in Free",
      "Unlimited daily quests",
      "Impact insights",
      "Early-access quests",
      "Priority tree planting",
      "Weekly email reports",
      "Exclusive badges & avatars",
      "Unlimited team members"
    ],
    cta: "Coming soon"
  },
  {
    name: "Team",
    price: "$12",
    period: "per month",
    inkClass: "text-cat-blue-ink",
    features: [
      "Everything in Pro",
      "Up to 20 team members",
      "Team impact reports",
      "Group carbon reports",
      "Data export & API",
      "Priority support"
    ],
    cta: "Coming soon"
  }
];

export default function PremiumPage() {
  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
        <PageHeader
          title="Premium"
          description="Extra tools for a bigger impact. The tiers below are still in the works — the free tier stays free forever."
        />
      </StaggerItem>

      {/* Coming soon band */}
      <StaggerItem as="div">
        <div
          className={`relative overflow-hidden border border-line-soft px-5 py-5 sm:px-6 ${CARD}`}
          style={{ background: wash("var(--text-accent)", 6) }}
        >
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-accent"
              style={{ background: wash("var(--text-accent)", 12) }}
              aria-hidden="true"
            >
              <Sprout className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="font-serif text-base font-bold leading-tight text-ink">
                Premium is still growing
              </p>
              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-ink-soft">
                Everything below is planned for a future release. Until then, nothing changes on the free plan.
              </p>
            </div>
            <span className="hidden shrink-0 rotate-6 sm:inline-flex">
              <Pill active>Coming soon</Pill>
            </span>
          </div>
        </div>
      </StaggerItem>

      {/* Pricing plans — intentional emphasis variation: the Pro card lifts
          slightly and carries a gold accent, so the grid isn't three identical
          cards. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <article
            key={plan.name}
            className={`relative flex h-full flex-col ${CARD} border t-panel p-5 sm:p-6 ${plan.highlight ? "shadow-elev-2" : "border-line shadow-elev-1"}`}
            style={plan.highlight ? { borderColor: goldBorder } : undefined}
          >
              {plan.highlight && (
                <Pill active className="absolute right-4 top-4">
                  Most popular
                </Pill>
              )}
              <p className={`text-sm font-extrabold leading-tight ${plan.inkClass}`}>
                {plan.name}
              </p>
              {/* Price leads; the period rides along as the small qualifier. */}
              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-serif text-4xl font-extrabold leading-none text-ink">{plan.price}</span>
                <span className="pb-0.5 text-xs font-semibold text-ink-muted">{plan.period}</span>
              </div>

              <ul className="mt-5 flex flex-col gap-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs font-semibold text-ink-soft">
                    <span className={`mt-0.5 shrink-0 ${plan.inkClass}`} aria-hidden="true">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Disabled by design — no checkout exists yet. */}
              {plan.name === "Free" ? (
                <span className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-line bg-surface-alt text-xs font-bold text-ink-soft">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> {plan.cta}
                </span>
              ) : (
                <span
                  className={`mt-6 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-dashed bg-surface-alt py-2.5 text-xs font-extrabold text-ink-muted ${plan.highlight ? "text-cat-gold-ink" : "border-line"}`}
                  style={plan.highlight ? {
                    // Gold-only highlight: tint mixed over the panel base (the
                    // sanctioned tint foundation), dashed hairline in gold.
                    background: goldWash,
                    borderColor: goldBorder
                  } : undefined}
                >
                  <Clock className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" /> {plan.cta}
                </span>
              )}
            </article>
        ))}
      </div>

      {/* Feature grid */}
      <StaggerItem as="div">
        <Panel eyebrow="What's coming" title="Premium features">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PREMIUM_FEATURES.map(({ icon: Icon, title, desc, tag, accentVar, inkVar, chipClass }) => (
              <div key={title} className="h-full">
                <div className={`flex h-full flex-col ${CARD} border border-line-soft bg-surface-alt p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ background: wash(accentVar, 12), color: inkVar }}
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-micro ${chipClass}`}>
                      {tag}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-extrabold leading-snug text-ink">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{desc}</p>
                  <div
                    className="mt-auto pt-3.5 text-center text-[0.6875rem] font-bold text-ink-muted"
                    style={{ borderTop: "1px dashed var(--border-subtle)" }}
                    aria-hidden="true"
                  >
                    Locked
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </StaggerItem>

      {/* FAQ */}
      <StaggerItem as="div">
        <Panel eyebrow="Questions" title="FAQ">
          <div className="flex flex-col divide-y divide-line-soft">
            {[
              {
                q: "Will the free tier be limited?",
                a: "No. The free tier stays free, forever. Premium adds extra features on top — it doesn't gate core functionality."
              },
              {
                q: "When does Premium launch?",
                a: "Premium is planned for a future release. Watch the community news for updates."
              },
              {
                q: "Is carbon tracking always real?",
                a: "Yes. Carbon values are always sourced from the Climatiq API or the quest catalog — never estimated or invented."
              },
              {
                q: "Do free users get trees planted?",
                a: "Tree planting milestones are tracked for all users. Real tree planting through our Ecologi partnership is coming soon — premium will make it faster once live."
              }
            ].map(({ q, a }) => (
              <div key={q} className="py-4 first:pt-0 last:pb-0">
                <p className="font-serif text-sm font-bold leading-snug text-ink">{q}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{a}</p>
              </div>
            ))}
          </div>
        </Panel>
      </StaggerItem>
    </StaggerContainer>
  );
}