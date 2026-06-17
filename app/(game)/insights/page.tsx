// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { MetricCard, PageHero, Panel, Pill, ProgressBar } from "@/components/game-ui";

const CATEGORIES_FALLBACK = [
  { id: "recycling", name: "Recycling", image: "/images/forest.png", color: "#2f6b46", done: 0, total: 1 },
  { id: "energy_saving", name: "Energy Saving", image: "/images/background.png", color: "#9a6b1f", done: 0, total: 1 },
  { id: "transportation", name: "Transportation", image: "/images/mountains.png", color: "#2f5f86", done: 0, total: 1 },
  { id: "water_saving", name: "Water Saving", image: "/images/nature.png", color: "#237482", done: 0, total: 1 },
  { id: "cleanup_missions", name: "Clean-Up Missions", image: "/images/night.png", color: "#62508f", done: 0, total: 1 },
  { id: "gardening", name: "Gardening & Nature", image: "/images/plants/bamboo.png", color: "#4c7a3b", done: 0, total: 1 },
  { id: "sustainable_living", name: "Sustainable Living", image: "/images/plants/lotus.png", color: "#3e8c7c", done: 0, total: 1 }
];

const categoryImages: Record<string, string> = {
  recycling: "/images/forest.png",
  energy_saving: "/images/background.png",
  transportation: "/images/mountains.png",
  water_saving: "/images/nature.png",
  cleanup_missions: "/images/night.png",
  gardening: "/images/plants/bamboo.png",
  sustainable_living: "/images/plants/lotus.png"
};

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
          id: c.id,
          name: c.name,
          image: categoryImages[c.id] || "/images/forest.png",
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
        <div className="flex h-44 items-end gap-1.5 sm:gap-2.5">
          {questsPerDay.map((count, index) => {
            const height = (count / maxQPD) * 100;
            const isToday = index === questsPerDay.length - 1;
            return (
              <div key={weekDays[index]} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-extrabold" style={{ color: "var(--text-primary)" }}>{count}</span>
                <div className="flex h-32 w-full items-end rounded-xl p-1" style={{ background: "var(--bg-panel-alt)" }}>
                  <div
                    className="w-full rounded-lg transition-all duration-700"
                    style={{
                      height: `${Math.max(height, 4)}%`,
                      minHeight: "6px",
                      background: isToday ? "var(--text-primary)" : "var(--text-accent, #43653f)",
                      opacity: isToday ? 1 : 0.55
                    }}
                  />
                </div>
                <span className="text-[10px] font-extrabold" style={{ color: isToday ? "var(--text-primary)" : "var(--text-muted)" }}>{weekDays[index]}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel eyebrow="Breakdown" title="Category Distribution">
        <div className="flex flex-col gap-3">
          {categoriesProgress.map(({ name, image, color, done, total }) => {
            const pct = Math.round((done / total) * 100);
            return (
              <div key={name} className="grid grid-cols-[minmax(120px,160px)_1fr_44px_44px] items-center gap-3 rounded-xl px-2 py-1.5 transition" style={{ background: "transparent" }}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: "var(--bg-panel-alt)" }}>
                    <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </span>
                  <span className="truncate text-xs font-extrabold" style={{ color: "var(--text-primary)" }}>{name}</span>
                </div>
                <ProgressBar value={pct} color={color} />
                <span className="text-right text-xs font-extrabold" style={{ color }}>{pct}%</span>
                <span className="text-right text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{done}/{total}</span>
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
    </div>
  );
}
