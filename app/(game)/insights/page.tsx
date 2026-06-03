// @ts-nocheck
"use client";

import { useAuth } from "@/lib/useAuth";
import { MetricCard, PageHero, Panel, Pill, ProgressBar } from "@/components/game-ui";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const questsPerDay = [2, 3, 1, 4, 5, 3, 2];
const maxQPD = Math.max(...questsPerDay);

const categories = [
  { name: "Recycling", mark: "RC", color: "#2f6b46", done: 4, total: 8 },
  { name: "Energy", mark: "EN", color: "#9a6b1f", done: 3, total: 7 },
  { name: "Transportation", mark: "TR", color: "#2f5f86", done: 2, total: 5 },
  { name: "Water Saving", mark: "WA", color: "#237482", done: 5, total: 6 },
  { name: "Clean-Up", mark: "CU", color: "#62508f", done: 1, total: 4 },
  { name: "Gardening", mark: "GD", color: "#4c7a3b", done: 2, total: 4 }
];

const totalDone = categories.reduce((sum, category) => sum + category.done, 0);
const totalAll = categories.reduce((sum, category) => sum + category.total, 0);
const overallPct = Math.round((totalDone / totalAll) * 100);

export default function InsightsPage() {
  const { profile } = useAuth();
  const xp = profile?.xp ?? 0;
  const ecoPoints = profile?.ecoPoints ?? 0;
  const missionsCompleted = profile?.missionsCompleted ?? 0;
  const weeklyTotal = questsPerDay.reduce((a, b) => a + b, 0);
  const todayCount = questsPerDay[questsPerDay.length - 1];

  const summaryCards = [
    { label: "Today's quests", value: `${todayCount}/5`, accent: "#2f6b46" },
    { label: "Quests last 7 days", value: weeklyTotal, accent: "#2f5f86" },
    { label: "Total missions cleared", value: missionsCompleted, accent: "#62508f" },
    { label: "XP earned", value: xp.toLocaleString(), accent: "#9a6b1f" },
    { label: "EcoPoints", value: ecoPoints.toLocaleString(), accent: "#237482" },
    { label: "Overall progress", value: `${overallPct}%`, accent: "#4c7a3b" }
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Weekly analytics" title="Insights" description="A compact view of quest completion, category balance, and reward growth." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <Panel eyebrow="Activity" title="Quest Completion Trend" action={<Pill>7 days</Pill>}>
        <div className="flex h-48 items-end gap-2 sm:gap-3">
          {questsPerDay.map((count, index) => {
            const height = maxQPD > 0 ? (count / maxQPD) * 100 : 0;
            const isToday = index === questsPerDay.length - 1;
            return (
              <div key={weekDays[index]} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-extrabold text-forest-800">{count}</span>
                <div className="flex h-36 w-full items-end rounded-2xl bg-[#f4f7ef] p-1">
                  <div
                    className="w-full rounded-xl transition-all duration-700"
                    style={{
                      height: `${height}%`,
                      minHeight: "8px",
                      background: isToday ? "#102016" : "#9fb78c"
                    }}
                  />
                </div>
                <span className={`text-xs font-extrabold ${isToday ? "text-forest-950" : "text-forest-600/64"}`}>{weekDays[index]}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel eyebrow="Breakdown" title="Category Distribution">
        <div className="flex flex-col gap-4">
          {categories.map(({ name, mark, color, done, total }) => {
            const pct = Math.round((done / total) * 100);
            return (
              <div key={name} className="grid grid-cols-[minmax(112px,160px)_1fr_48px_48px] items-center gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f4f7ef] text-[10px] font-extrabold text-forest-800">{mark}</span>
                  <span className="truncate text-xs font-extrabold text-forest-900">{name}</span>
                </div>
                <ProgressBar value={pct} color={color} />
                <span className="text-right text-xs font-extrabold" style={{ color }}>{pct}%</span>
                <span className="text-right text-xs font-semibold text-forest-700/54">{done}/{total}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel eyebrow="Growth" title="XP & EcoPoints Overview">
        <div className="flex flex-col gap-5">
          {[
            { label: "Total XP", value: xp, color: "#2f6b46", max: 10000 },
            { label: "EcoPoints", value: ecoPoints, color: "#2f5f86", max: 5000 }
          ].map(({ label, value, color, max }) => {
            const pct = Math.min(100, Math.round((value / max) * 100));
            return (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-extrabold text-forest-950">{label}</span>
                  <span className="font-serif text-base font-extrabold" style={{ color }}>{value.toLocaleString()}</span>
                </div>
                <ProgressBar value={pct} color={color} />
                <p className="mt-2 text-right text-xs font-semibold text-forest-700/54">{pct}% of milestone</p>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
