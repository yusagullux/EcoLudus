"use client";

import { motion, useReducedMotion } from "motion/react";
import { Coins, Flame, Sprout } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useQuests } from "@/lib/useQuests";
import { PageHeader, Panel, Pill, LevelProgressRing } from "@/components/game-ui";
import { StaggerContainer, StaggerItem } from "@/lib/animations";
import { getLevelProgress, requiredXP } from "@/lib/level-system";
import { CategoryIcon, categoryToken } from "@/components/category-icon";

// Ids/names only — the fill color for each category is resolved through the
// shared token map in category-icon.tsx (single source for the palette).
// color is derived (categoryToken) after this list is built, so it's omitted here.
const CATEGORIES_FALLBACK: Omit<CategoryProgress, "color">[] = [
  { id: "recycling", name: "Recycling", done: 0, total: 1 },
  { id: "energy_saving", name: "Energy Saving", done: 0, total: 1 },
  { id: "transportation", name: "Transportation", done: 0, total: 1 },
  { id: "water_saving", name: "Water Saving", done: 0, total: 1 },
  { id: "cleanup_missions", name: "Clean-Up Missions", done: 0, total: 1 },
  { id: "gardening", name: "Gardening & Nature", done: 0, total: 1 },
  { id: "sustainable_living", name: "Sustainable Living", done: 0, total: 1 }
];

type CategoryProgress = {
  id: string;
  name: string;
  color: string;
  done: number;
  total: number;
};

// Tint helper — mix any theme var into the current panel color.
const wash = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, var(--bg-panel))`;

// ── Streak ring ──────────────────────────────────────────────
// The hero medallion: progress-to-next-milestone ring in accent gold with the
// streak count inside. Animates like the kit's LevelProgressRing (skipped under
// reduced motion).
function StreakRing({ streak, progress, longest }: { streak: number; progress: number; longest: number }) {
  const reduced = useReducedMotion();
  const size = 132;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, progress));
  const targetOffset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${streak}-day streak, best ${longest} days, ${clamped}% to the next milestone`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: "var(--border-subtle)" }}
        />
        {reduced ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              stroke: "var(--accent-gold)",
              strokeDasharray: circumference,
              strokeDashoffset: targetOffset
            }}
          />
        ) : (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ stroke: "var(--accent-gold)", strokeDasharray: circumference }}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: targetOffset }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <Flame
          className="h-6 w-6"
          strokeWidth={2.4}
          style={{ color: "var(--accent-gold)" }}
          aria-hidden="true"
        />
        <span className="font-serif text-4xl font-black leading-none text-ink">
          {streak}
        </span>
        <span className="text-[0.625rem] font-bold text-ink-muted">
          day{streak === 1 ? "" : "s"}
        </span>
      </span>
    </div>
  );
}

// ── 7-day stem chart ─────────────────────────────────────────
// One column = one day: a thin stem whose height follows quests completed,
// topped with a sprout that grows (size + ink depth) with the day's count.
// Today's stem is the accent ink. Pure CSS/inline styles — no chart lib.
function Stem({ count, max, isToday }: { count: number; max: number; isToday: boolean }) {
  const heightPct = Math.max((count / max) * 100, 3);
  const sprout = count === 0 ? 12 : Math.min(22, 12 + (count / max) * 12);
  const ink = isToday
    ? "var(--text-accent)"
    : count === 0
    ? "var(--border-default)"
    : `color-mix(in srgb, var(--accent-green) ${35 + Math.round((count / max) * 65)}%, var(--bg-panel))`;

  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-micro font-bold text-ink-muted">{count}</span>
      <div className="flex h-28 w-full flex-col items-center justify-end gap-0.5" aria-hidden="true">
        <Sprout
          className="shrink-0 transition-[height,width]"
          style={{ height: sprout, width: sprout, color: ink }}
          strokeWidth={2.2}
        />
        <span
          className="w-2.5 rounded-full"
          style={{ height: `${heightPct}%`, minHeight: "5px", background: ink }}
        />
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const { profile } = useAuth();
  const { quests: questsData } = useQuests();

  const xp = Number(profile?.xp ?? 0);
  const ecoPoints = Number(profile?.ecoPoints ?? 0);
  const missionsCompleted = Number(profile?.missionsCompleted ?? 0);
  const currentStreak = Number(profile?.currentStreak ?? 0);
  const longestStreak = Number(profile?.longestStreak ?? currentStreak);
  const streakMilestones = [3, 7, 14, 30];
  const nextStreakMilestone = streakMilestones.find((day) => day > currentStreak) ?? currentStreak + 7;
  const previousStreakMilestone = streakMilestones.filter((day) => day <= currentStreak).slice(-1)[0] ?? 0;
  const streakProgress = Math.min(100, Math.max(0, Math.round(((currentStreak - previousStreakMilestone) / Math.max(1, nextStreakMilestone - previousStreakMilestone)) * 100)));

  // Profile collection fields are jsonb-derived; narrow them to typed locals so
  // the chart math below type-checks. The element types are loose (`unknown`)
  // because the payload is an untyped jsonb blob.
  const dailyQuestCompletions = (profile?.dailyQuestCompletions ?? {}) as Record<string, unknown[]>;
  const dailyQuestsCompleted = (profile?.dailyQuestsCompleted ?? []) as unknown[];
  const currentDailyQuests = (profile?.currentDailyQuests ?? []) as unknown[];
  const completedQuests = (profile?.completedQuests ?? []) as string[];

  // Calculate dynamic weekly trends from user's completions (last 7 days)
  const today = new Date();
  const questsPerDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dateKey = d.toISOString().slice(0, 10);
    return dailyQuestCompletions[dateKey]?.length ?? 0;
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toLocaleDateString("en-US", { weekday: "short" });
  });

  const maxQPD = Math.max(...questsPerDay, 1);
  const weeklyTotal = questsPerDay.reduce((a, b) => a + b, 0);
  const todayCount = dailyQuestsCompleted.length;
  const dailyTotal = currentDailyQuests.length;

  // Compute category progress dynamically. Colors always resolve through
  // categoryToken() — the shared category palette — never a per-page copy.
  const categoriesProgress: CategoryProgress[] = (
    questsData
      ? questsData.categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          done: c.quests.filter((q: any) => completedQuests.includes(q.id)).length,
          total: c.quests.length
        }))
      : CATEGORIES_FALLBACK
  ).map((c: Omit<CategoryProgress, "color">) => ({ ...c, color: categoryToken(c.id).hex }));

  const totalDone = categoriesProgress.reduce((sum, c) => sum + c.done, 0);
  const totalAll = categoriesProgress.reduce((sum, c) => sum + c.total, 0);
  const overallPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  // Growth toward the next level — read from the REAL curve in level-system.
  const levelProgress = getLevelProgress(xp);
  const level = levelProgress.level;
  const nextLevelAt = requiredXP(level);

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
        <PageHeader
          title="Adventure almanac"
          description="A living record of your quests, streaks, and growing rewards."
          tint
        />
      </StaggerItem>

      {/* ── Journey hero: the streak ledger ── */}
      <StaggerItem as="section">
        <Panel
          eyebrow="The journey so far"
          title="Daily streak"
          action={
            <span className="fg-chip fg-chip-coins">
              Next reward at {nextStreakMilestone} days
            </span>
          }
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
            <StreakRing streak={currentStreak} progress={streakProgress} longest={longestStreak} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span
                  className="fg-chip"
                  style={{
                    background: wash("var(--accent-gold)", 12),
                    borderColor: "color-mix(in srgb, var(--accent-gold) 28%, var(--border-default))",
                    color: "var(--accent-gold-text)"
                  }}
                >
                  Best streak: {longestStreak} days
                </span>
                <Pill>
                  {nextStreakMilestone - currentStreak} day{nextStreakMilestone - currentStreak === 1 ? "" : "s"} to go
                </Pill>
              </div>
              <div role="group" aria-label="Streak reward milestones" className="mt-3 grid grid-cols-4 gap-2">
                {streakMilestones.map((milestone) => {
                  const reached = currentStreak >= milestone;
                  return <div
                    key={milestone}
                    className={`rounded-input border px-2 py-2 text-center ${reached ? "text-status-warning" : "text-ink-muted"}`}
                    style={{
                      borderColor: reached
                        ? "color-mix(in srgb, var(--text-warning) 45%, transparent)"
                        : "var(--border-subtle)",
                      background: reached
                        ? "color-mix(in srgb, var(--text-warning) 12%, var(--bg-panel-alt))"
                        : "var(--bg-panel-alt)"
                    }}
                  ><span className="block text-xs font-black">{milestone}</span><span className="text-micro">days</span></div>;
                })}
              </div>
              <p className="mt-2.5 text-center text-xs font-semibold text-ink-muted sm:text-left">
                {streakProgress}% of the way to the {nextStreakMilestone}-day milestone.
              </p>
            </div>
          </div>
        </Panel>
      </StaggerItem>

      {/* ── 7-day trend as planted stems ── */}
      <StaggerItem as="section">
        <Panel
          eyebrow="This week"
          title="7-day forage trend"
          action={<Pill active>{todayCount}/{dailyTotal} today</Pill>}
        >
          <div className="flex items-end gap-1.5 sm:gap-2.5">
            {questsPerDay.map((count, index) => (
              <div key={weekDays[index]} className="flex min-w-0 flex-1">
                <Stem
                  count={count}
                  max={maxQPD}
                  isToday={index === questsPerDay.length - 1}
                />
              </div>
            ))}
          </div>
          <div className="fg-trail mt-0.5" aria-hidden="true" />
          <div className="mt-1 flex gap-1.5 sm:gap-2.5">
            {weekDays.map((day, index) => {
              const isToday = index === weekDays.length - 1;
              return (
                <span
                  key={day}
                  className={`flex-1 text-center text-micro font-bold ${isToday ? "text-accent" : "text-ink-muted"}`}
                >
                  {day}
                </span>
              );
            })}
          </div>
        </Panel>
      </StaggerItem>

      {/* ── Category distribution as a planted bed ── */}
      <StaggerItem as="section">
        <Panel
          eyebrow="Planted bed"
          title="Category blooms"
          action={<Pill>{totalDone}/{totalAll} quests</Pill>}
        >
          <div className="relative pb-6 pt-2">
            <div className="relative z-10 flex flex-wrap items-end justify-center gap-x-3 gap-y-5 sm:gap-x-5">
              {categoriesProgress.map(({ name, color, done, total }) => {
                const share = totalDone > 0 ? done / totalDone : 0;
                const size = done === 0 ? 38 : 44 + Math.round(share * 34);
                return (
                  <div
                    key={name}
                    className="flex w-[72px] flex-col items-center gap-1 text-center sm:w-20"
                    title={`${name}: ${done} of ${total} quests`}
                  >
                    <span
                      className="flex items-center justify-center rounded-full"
                      style={{
                        width: size,
                        height: size,
                        background: wash(color, 16),
                        border: `1px solid color-mix(in srgb, ${color} 32%, var(--border-default))`,
                        color
                      }}
                    >
                      <CategoryIcon name={name} color={color} className="h-1/2 w-1/2" />
                    </span>
                    <span className="text-xs font-extrabold leading-none text-ink">
                      {done}<span className="font-bold text-ink-muted">/{total}</span>
                    </span>
                    <span className="text-[0.625rem] font-bold leading-tight text-ink-muted">
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* soil band the bed sits on */}
            <div
              className="absolute bottom-0 left-0 right-0 h-10"
              style={{
                background: wash("var(--accent-sage)", 9),
                borderTop: `2px dashed color-mix(in srgb, var(--accent-sage) 35%, var(--border-subtle))`,
                borderRadius: "0 0 var(--radius-card) var(--radius-card)"
              }}
              aria-hidden="true"
            />
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-ink-muted">
            {totalDone} of {totalAll} quests tended so far — {overallPct}% overall.
          </p>
        </Panel>
      </StaggerItem>

      {/* ── XP & EcoPoints: growth arc to the next level ── */}
      <StaggerItem as="section">
        <Panel
          eyebrow="Rewards earned"
          title="Growing toward the next level"
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
            <LevelProgressRing level={level} xp={xp} size={112} />
            <div className="min-w-0 flex-1">
              <p className="text-center text-sm leading-relaxed text-ink-soft sm:text-left">
                You are {levelProgress.xpIntoLevel.toLocaleString()} XP into level {level} —
                {" "}{levelProgress.xpToNextLevel.toLocaleString()} XP more and level {level + 1} unlocks at{" "}
                {nextLevelAt.toLocaleString()} total XP. The real curve, no shortcuts: growth quickens as you climb.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="fg-chip fg-chip-coins text-sm">
                  <Coins className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                  {ecoPoints.toLocaleString()} EcoPoints
                </span>
                <Pill>
                  {missionsCompleted} mission{missionsCompleted === 1 ? "" : "s"} cleared
                </Pill>
                <span className="fg-chip fg-chip-xp text-sm">{weeklyTotal} quests this week</span>
              </div>
              <p className="mt-2 text-center text-xs font-semibold text-ink-muted sm:text-left">
                Spend EcoPoints in the Plant Shop — they never expire.
              </p>
            </div>
          </div>
        </Panel>
      </StaggerItem>
    </StaggerContainer>
  );
}