// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { MetricCard, PageHero, Panel, Pill, ProgressBar } from "@/components/game-ui";

const CATEGORIES_FALLBACK = [
  { name: "Recycling", mark: "RC", color: "#2f6b46", done: 0, total: 1 },
  { name: "Energy Saving", mark: "EN", color: "#9a6b1f", done: 0, total: 1 },
  { name: "Transportation", mark: "TR", color: "#2f5f86", done: 0, total: 1 },
  { name: "Water Saving", mark: "WA", color: "#237482", done: 0, total: 1 },
  { name: "Clean-Up Missions", mark: "CU", color: "#62508f", done: 0, total: 1 },
  { name: "Gardening & Nature", mark: "GD", color: "#4c7a3b", done: 0, total: 1 },
  { name: "Sustainable Living", mark: "SL", color: "#3e8c7c", done: 0, total: 1 }
];

export default function InsightsPage() {
  const { profile } = useAuth();
  const [questsData, setQuestsData] = useState<any>(null);

  // Load quests data
  useEffect(() => {
    async function loadQuests() {
      try {
        const res = await fetch("/quests.json");
        if (res.ok) {
          const data = await res.json();
          setQuestsData(data);
        }
      } catch (err) {
        console.error("Error loading quests.json in insights:", err);
      }
    }
    loadQuests();
  }, []);

  const xp = profile?.xp ?? 0;
  const ecoPoints = profile?.ecoPoints ?? 0;
  const missionsCompleted = profile?.missionsCompleted ?? 0;

  // Calculate dynamic weekly trends from user's completions (last 7 days)
  const today = new Date();
  const questsPerDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dateKey = d.toISOString().slice(0, 10);
    return profile?.dailyQuestCompletions?.[dateKey]?.length ?? 0;
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toLocaleDateString("en-US", { weekday: "short" });
  });

  const maxQPD = Math.max(...questsPerDay, 1);
  const weeklyTotal = questsPerDay.reduce((a, b) => a + b, 0);
  const todayCount = profile?.dailyQuestsCompleted?.length ?? 0;
  const dailyTotal = profile?.currentDailyQuests?.length ?? 5;

  // Compute category progress dynamically
  const categoriesProgress = questsData
    ? questsData.categories.map((c: any) => {
        const done = c.quests.filter((q: any) => profile?.completedQuests?.includes(q.id)).length;
        const total = c.quests.length;
        return {
          name: c.name,
          mark: c.name.substring(0, 2).toUpperCase(),
          color: c.color || "#4CAF50",
          done,
          total
        };
      })
    : CATEGORIES_FALLBACK;

  const totalDone = categoriesProgress.reduce((sum, c) => sum + c.done, 0);
  const totalAll = categoriesProgress.reduce((sum, c) => sum + c.total, 0);
  const overallPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  const summaryCards = [
    { label: "Today's quests", value: `${todayCount}/${dailyTotal}`, accent: "#2f6b46" },
    { label: "Quests last 7 days", value: weeklyTotal, accent: "#2f5f86" },
    { label: "Total missions cleared", value: missionsCompleted, accent: "#62508f" },
    { label: "XP earned", value: xp.toLocaleString(), accent: "#9a6b1f" },
    { label: "EcoPoints", value: ecoPoints.toLocaleString(), accent: "#237482" },
    { label: "Overall progress", value: `${overallPct}%`, accent: "#4c7a3b" }
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Weekly analytics" title="Insights" description="A dynamic view of quest completion, category balance, and reward growth." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <Panel eyebrow="Activity" title="Quest Completion Trend" action={<Pill>7 days</Pill>}>
        <div className="flex h-48 items-end gap-2 sm:gap-3">
          {questsPerDay.map((count, index) => {
            const height = (count / maxQPD) * 100;
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
          {categoriesProgress.map(({ name, mark, color, done, total }) => {
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
