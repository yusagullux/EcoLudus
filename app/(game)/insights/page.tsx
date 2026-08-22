"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useQuests } from "@/lib/useQuests";
import { PageHero, Panel, Pill, ProgressBar, StatGrid, heroAccents } from "@/components/game-ui";
import { StaggerContainer, StaggerItem } from "@/lib/animations";
import { CategoryIcon } from "@/components/category-icon";

const CATEGORIES_FALLBACK = [
  { id: "recycling", name: "Recycling", image: "/images/forest.webp", color: "var(--text-accent)", done: 0, total: 1 },
  { id: "energy_saving", name: "Energy Saving", image: "/images/background.webp", color: "var(--text-warning)", done: 0, total: 1 },
  { id: "transportation", name: "Transportation", image: "/images/mountains.webp", color: "var(--text-accent)", done: 0, total: 1 },
  { id: "water_saving", name: "Water Saving", image: "/images/nature.webp", color: "var(--text-accent)", done: 0, total: 1 },
  { id: "cleanup_missions", name: "Clean-Up Missions", image: "/images/night.webp", color: "var(--text-accent)", done: 0, total: 1 },
  { id: "gardening", name: "Gardening & Nature", image: "/images/plants/bamboo.png", color: "var(--text-accent)", done: 0, total: 1 },
  { id: "sustainable_living", name: "Sustainable Living", image: "/images/plants/lotus.png", color: "var(--text-accent)", done: 0, total: 1 }
];

const categoryImages: Record<string, string> = {
  recycling: "/images/forest.webp",
  energy_saving: "/images/background.webp",
  transportation: "/images/mountains.webp",
  water_saving: "/images/nature.webp",
  cleanup_missions: "/images/night.webp",
  gardening: "/images/plants/bamboo.png",
  sustainable_living: "/images/plants/lotus.png"
};

type CategoryProgress = {
  id: string;
  name: string;
  image: string;
  color: string;
  done: number;
  total: number;
};

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

  // Compute category progress dynamically
  const categoriesProgress: CategoryProgress[] = questsData
    ? questsData.categories.map((c: any) => {
        const done = c.quests.filter((q: any) => completedQuests.includes(q.id)).length;
        const total = c.quests.length;
        return {
          id: c.id,
          name: c.name,
          image: categoryImages[c.id] || "/images/forest.webp",
          color: c.color ? `color-mix(in srgb, ${c.color} 80%, var(--text-accent))` : "var(--text-accent)",
          done,
          total
        };
      })
    : CATEGORIES_FALLBACK;

  const totalDone = categoriesProgress.reduce((sum, c) => sum + c.done, 0);
  const totalAll = categoriesProgress.reduce((sum, c) => sum + c.total, 0);
  const overallPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  const summaryCards = [
    { label: "Today's quests", value: `${todayCount}/${dailyTotal}`, accent: "var(--text-accent)" },
    { label: "Quests last 7 days", value: weeklyTotal, accent: "var(--text-accent)" },
    { label: "Total missions cleared", value: missionsCompleted, accent: "var(--text-accent)" },
    { label: "XP earned", value: xp.toLocaleString(), accent: "var(--text-accent)" },
    { label: "EcoPoints", value: ecoPoints.toLocaleString(), accent: "var(--text-accent)" },
    { label: "Overall progress", value: `${overallPct}%`, accent: "var(--text-accent)" }
  ];

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
      <PageHero eyebrow="Weekly analytics" title="Insights" description="A dynamic view of quest completion, category balance, and reward growth." accent={heroAccents.insights} />
      </StaggerItem>

      <StaggerItem as="div">
      <StatGrid className="grid-cols-2 gap-3 sm:grid-cols-3" items={summaryCards} />
      </StaggerItem>

      <StaggerItem as="div">
      <Panel eyebrow="Keep the rhythm" title="Daily streak" action={<Pill active>{currentStreak} day{currentStreak === 1 ? "" : "s"}</Pill>}>
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border text-3xl font-black" style={{ borderColor: "color-mix(in srgb, var(--text-warning) 42%, transparent)", background: "color-mix(in srgb, var(--text-warning) 18%, var(--bg-panel-alt))", color: "var(--text-warning)" }} aria-hidden="true">✦</div>
            <div>
              <p className="font-serif text-3xl font-black" style={{ color: "var(--text-primary)" }}>{currentStreak}<span className="ml-1 text-sm font-bold" style={{ color: "var(--text-muted)" }}>days</span></p>
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Best streak: {longestStreak} days</p>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
              <span style={{ color: "var(--text-primary)" }}>Next reward at {nextStreakMilestone} days</span>
              <span style={{ color: "var(--text-warning)" }}>{streakProgress}%</span>
            </div>
            <ProgressBar value={streakProgress} color="var(--text-warning)" />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Streak reward milestones">
              {streakMilestones.map((milestone) => {
                const reached = currentStreak >= milestone;
                return <div key={milestone} className="rounded-xl border px-2 py-2 text-center" style={{ borderColor: reached ? "color-mix(in srgb, var(--text-warning) 45%, transparent)" : "var(--border-subtle)", background: reached ? "color-mix(in srgb, var(--text-warning) 12%, var(--bg-panel-alt))" : "var(--bg-panel-alt)" }}><span className="block text-xs font-black" style={{ color: reached ? "var(--text-warning)" : "var(--text-muted)" }}>{milestone}</span><span className="text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>days</span></div>;
              })}
            </div>
          </div>
        </div>
      </Panel>
      </StaggerItem>

      <StaggerItem as="div">
      <Panel eyebrow="Activity" title="Quest Completion Trend" action={<Pill>7 days</Pill>}>
        <StaggerContainer className="flex h-44 items-end gap-1.5 sm:gap-2.5" as="div">
          {questsPerDay.map((count, index) => {
            const height = (count / maxQPD) * 100;
            const isToday = index === questsPerDay.length - 1;
            return (
              <StaggerItem key={weekDays[index]} as="div" className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-extrabold" style={{ color: "var(--text-primary)" }}>{count}</span>
                <div className="flex h-32 w-full items-end rounded-xl p-1" aria-hidden="true" style={{ background: "var(--bg-panel-alt)" }}>
                  <div
                    className="w-full rounded-lg transition-all duration-700"
                    style={{
                      height: `${Math.max(height, 4)}%`,
                      minHeight: "6px",
                      background: isToday ? "var(--text-primary)" : "var(--text-accent)",
                      opacity: isToday ? 1 : 0.55
                    }}
                  />
                </div>
                <span className="text-[10px] font-extrabold" style={{ color: isToday ? "var(--text-primary)" : "var(--text-muted)" }}>{weekDays[index]}</span>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </Panel>
      </StaggerItem>

      <StaggerItem as="div">
      <Panel eyebrow="Breakdown" title="Category Distribution">
        <StaggerContainer className="flex flex-col gap-3" as="div">
          {categoriesProgress.map(({ name, image, color, done, total }) => {
            const pct = Math.round((done / total) * 100);
            return (
              <StaggerItem key={name} as="div" className="flex flex-col gap-1.5 rounded-xl px-2 py-1.5 transition sm:grid sm:grid-cols-[minmax(120px,160px)_1fr_44px_44px] sm:items-center sm:gap-3">
                <div className="flex min-w-0 items-center justify-between gap-2 sm:contents">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: "var(--bg-panel-alt)" }}>
                      <CategoryIcon name={name} color={color} className="h-5 w-5" />
                    </span>
                    <span className="truncate text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>{name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:hidden">
                    <span className="text-xs font-extrabold" style={{ color }}>{pct}%</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{done}/{total}</span>
                  </div>
                </div>
                <ProgressBar value={pct} color={color} />
                <span className="hidden text-right text-xs font-extrabold sm:block" style={{ color }}>{pct}%</span>
                <span className="hidden text-right text-xs font-semibold sm:block" style={{ color: "var(--text-muted)" }}>{done}/{total}</span>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </Panel>
      </StaggerItem>

      <StaggerItem as="div">
      <Panel eyebrow="Growth" title="XP & EcoPoints Overview">
        <div className="flex flex-col gap-5">
          {[
            { label: "Total XP", value: xp, color: "var(--text-accent)", max: 10000 },
            { label: "EcoPoints", value: ecoPoints, color: "var(--text-accent)", max: 5000 }
          ].map(({ label, value, color, max }) => {
            const pct = Math.min(100, Math.round((value / max) * 100));
            return (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{label}</span>
                  <span className="font-serif text-base font-extrabold" style={{ color }}>{value.toLocaleString()}</span>
                </div>
                <ProgressBar value={pct} color={color} />
                <p className="mt-1.5 text-right text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{pct}% of milestone</p>
              </div>
            );
          })}
        </div>
      </Panel>
      </StaggerItem>
    </StaggerContainer>
  );
}
