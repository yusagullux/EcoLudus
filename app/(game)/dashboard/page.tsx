// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { HeroMetric, MetricCard, PageHero, Panel, Pill, ProgressBar, primaryButton } from "@/components/game-ui";
import PhotoVerification from "@/components/photo-verification";
import { updateUserProfile } from "@/public/js/auth.js";
import { calculateLevel } from "@/public/js/levels.js";

const CATEGORIES = [
  { name: "Recycling", mark: "RC", color: "#2f6b46" },
  { name: "Energy Saving", mark: "EN", color: "#9a6b1f" },
  { name: "Transportation", mark: "TR", color: "#2f5f86" },
  { name: "Water Saving", mark: "WA", color: "#237482" },
  { name: "Clean-Up", mark: "CU", color: "#62508f" },
  { name: "Gardening", mark: "GD", color: "#4c7a3b" }
];

export default function DashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();

  const [quests, setQuests] = useState([
    { id: "recycling_2", title: "Reusable bottle refill", category: "Water Saving", categoryColor: "#237482", xp: 35, eco: 25, carbon: 0.5, done: false, requiresPhoto: true, imageSrc: "/images/forest.png" },
    { id: "transportation_1", title: "Walk instead of drive", category: "Transportation", categoryColor: "#2f5f86", xp: 45, eco: 35, carbon: 1.2, done: false, requiresPhoto: false, imageSrc: "/images/mountains.png" },
    { id: "recycling_3", title: "Sort household recycling", category: "Recycling", categoryColor: "#2f6b46", xp: 40, eco: 30, carbon: 1.5, done: false, requiresPhoto: true, imageSrc: "/images/nature.png" },
    { id: "energy_1", title: "Turn off lights when leaving", category: "Energy Saving", categoryColor: "#9a6b1f", xp: 30, eco: 20, carbon: 0.4, done: false, requiresPhoto: false, imageSrc: "/images/background.png" },
    { id: "recycling_4", title: "Use reusable shopping bag", category: "Sustainable Living", categoryColor: "#4c7a3b", xp: 35, eco: 25, carbon: 0.3, done: false, requiresPhoto: true, imageSrc: "/images/forest.png" }
  ]);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [photoVerifiedForQuestIds, setPhotoVerifiedForQuestIds] = useState<string[]>([]);
  const [completedPopup, setCompletedPopup] = useState<string | null>(null);
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const [toast, setToast] = useState("");

  const displayName = profile?.displayName || user?.email?.split("@")[0] || "Explorer";
  const xp = profile?.xp ?? 0;
  const ecoPoints = profile?.ecoPoints ?? 0;
  const level = profile?.level ?? 1;
  const carbonReduced = profile?.carbonReduced ?? 0;
  const missionsCompleted = profile?.missionsCompleted ?? 0;
  const completedQuests = profile?.completedQuests || [];

  const thresholds = [0, 100, 250, 500, 1000, 2500, 5000, 10000, 50000, Infinity];
  const curXP = thresholds[Math.min(level - 1, 8)];
  const nextXP = thresholds[Math.min(level, 8)];
  const pct = nextXP === Infinity ? 100 : Math.min(100, Math.round(((xp - curXP) / (nextXP - curXP)) * 100));
  const completedToday = quests.filter((quest) => quest.done).length;
  const selectedQuests = quests.filter((quest) => selectedQuestIds.includes(quest.id) && !quest.done);
  const selectedPhotoQuests = selectedQuests.filter((quest) => quest.requiresPhoto);
  const unverifiedPhotoQuests = selectedPhotoQuests.filter((quest) => !photoVerifiedForQuestIds.includes(quest.id));
  const nextPhotoQuestToVerify = unverifiedPhotoQuests[0] ?? null;

  // Calculate category progress from completed quests
  const categoryProgress = CATEGORIES.map(category => {
    const categoryQuests = quests.filter(q => q.category === category.name);
    const total = categoryQuests.length;
    const done = categoryQuests.filter(q => completedQuests.includes(q.id)).length;
    return { ...category, done: done || 0, total: total || 1 };
  });

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const toggleSelection = (questId: string) => {
    setSelectedQuestIds((current) =>
      current.includes(questId) ? current.filter((id) => id !== questId) : [...current, questId]
    );
  };

  const markPhotoVerified = (questId: string) => {
    setPhotoVerifiedForQuestIds((current) => Array.from(new Set([...current, questId])));
    setToast("Photo proof verified. You can now complete this mission.");
  };

  const completeSelectedMissions = async () => {
    if (!user?.uid || !profile || selectedQuests.length === 0 || pendingCompletion) return;

    if (unverifiedPhotoQuests.length > 0) {
      setToast(
        `Verify proof for ${unverifiedPhotoQuests.length} photo-based quest${unverifiedPhotoQuests.length === 1 ? "" : "s"} before completing.`
      );
      return;
    }

    setPendingCompletion(true);
    const completedAt = new Date();
    const dateKey = completedAt.toISOString().slice(0, 10);
    const xpReward = selectedQuests.reduce((sum, quest) => sum + quest.xp, 0);
    const ecoReward = selectedQuests.reduce((sum, quest) => sum + quest.eco, 0);
    const carbonReward = selectedQuests.reduce((sum, quest) => sum + quest.carbon, 0);
    const completedIds = selectedQuests.map((quest) => quest.id);
    const nextXp = (profile.xp || 0) + xpReward;
    const nextCompletedQuests = Array.from(new Set([...(profile.completedQuests || []), ...completedIds]));
    const nextDailyQuestsCompleted = Array.from(new Set([...(profile.dailyQuestsCompleted || []), ...completedIds]));
    const dailyQuestCompletions = {
      ...(profile.dailyQuestCompletions || {}),
      [dateKey]: Array.from(new Set([...(profile.dailyQuestCompletions?.[dateKey] || []), ...completedIds]))
    };

    try {
      await updateUserProfile(user.uid, {
        xp: nextXp,
        ecoPoints: (profile.ecoPoints || 0) + ecoReward,
        level: calculateLevel(nextXp),
        carbonReduced: (profile.carbonReduced || 0) + carbonReward,
        missionsCompleted: (profile.missionsCompleted || 0) + selectedQuests.length,
        completedQuests: nextCompletedQuests,
        dailyQuestsCompleted: nextDailyQuestsCompleted,
        dailyQuestCompletions,
        lastQuestCompletionTime: completedAt.toISOString()
      });
      setQuests((items) => items.map((item) => (completedIds.includes(item.id) ? { ...item, done: true } : item)));
      setSelectedQuestIds([]);
      await refreshProfile();
      const completedTitles = selectedQuests.map((quest) => quest.title).join(", ");
      setCompletedPopup(`Mission complete! ${selectedQuests.length} mission${selectedQuests.length === 1 ? "" : "s"} finished: ${completedTitles}`);
      showToast(`Completed ${selectedQuests.length} mission${selectedQuests.length === 1 ? "" : "s"}: +${xpReward} XP, +${ecoReward} EcoPoints`);
      setPhotoVerifiedForQuestIds((ids) => ids.filter((id) => !completedIds.includes(id)));
    } catch (error) {
      console.error("Mission completion error:", error);
      showToast("Unable to complete missions. Please try again.");
    } finally {
      setPendingCompletion(false);
    }
  };

  if (loading) return null;

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Today's quest hub"
        title={`Welcome back, ${displayName}`}
        description={`${completedToday} of ${quests.length} missions complete today. Keep the rhythm focused and visible.`}
      >
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="XP" value={xp.toLocaleString()} />
          <HeroMetric label="Eco" value={ecoPoints.toLocaleString()} />
          <HeroMetric label="Level" value={level} />
        </div>
      </PageHero>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Current Level" value={`Level ${level}`} accent="#2f6b46" />
        <MetricCard label="Missions Done" value={missionsCompleted} accent="#2f5f86" />
        <MetricCard label="CO2 Reduced" value={`${(+carbonReduced || 0).toFixed(1)} kg`} accent="#237482" />
        <MetricCard label="EcoPoints" value={ecoPoints.toLocaleString()} accent="#9a6b1f" />
      </div>

      <Panel
        eyebrow="Level progress"
        title={`Level ${level} to ${level + 1}`}
        action={<Pill active>{pct}%</Pill>}
      >
        <ProgressBar value={pct} color="#2f6b46" />
        <div className="mt-3 flex justify-between text-xs font-bold text-forest-700/70">
          <span>{(xp - curXP).toLocaleString()} XP earned this level</span>
          <span>{nextXP === Infinity ? "Max level" : `${(nextXP - curXP).toLocaleString()} XP total`}</span>
        </div>
      </Panel>

      <Panel
        eyebrow="Daily missions"
        title="Today's Quests"
        action={<Pill>Resets in 24h</Pill>}
        className="overflow-hidden"
      >
        <div className="-mx-5 -mt-5 divide-y divide-[#e7ecdf] sm:-mx-6 sm:-mt-6">
          {quests.map((quest) => {
            const isSelected = selectedQuestIds.includes(quest.id);
            return (
            <label
              key={quest.id}
              className={`flex cursor-pointer items-start gap-4 px-5 py-4 transition hover:bg-[#f4f7ef] sm:px-6 ${quest.done ? "opacity-60" : ""} ${isSelected && !quest.done ? "bg-[#eef5ea]" : ""}`}
            >
              <input
                type="checkbox"
                checked={quest.done || isSelected}
                disabled={quest.done || pendingCompletion}
                onChange={() => toggleSelection(quest.id)}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-forest-800"
              />
              {quest.imageSrc && (
                <img
                  src={quest.imageSrc}
                  alt={quest.title}
                  className="h-14 w-14 rounded-2xl object-cover shadow-sm"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: quest.categoryColor }} />
                  <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-forest-700/70">{quest.category}</span>
                </div>
                <p className={`mt-1 text-sm font-extrabold text-forest-950 ${quest.done ? "line-through" : ""}`}>{quest.title}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Pill>+{quest.xp} XP</Pill>
                <span className="text-[11px] font-bold text-forest-700/56">+{quest.eco} Eco</span>
              </div>
            </label>
            );
          })}
        </div>

        <button
          onClick={completeSelectedMissions}
          disabled={selectedQuests.length === 0 || pendingCompletion}
          className={`mt-5 w-full ${primaryButton}`}
        >
          {pendingCompletion ? "Completing..." : selectedQuests.length > 0 ? `Complete ${selectedQuests.length} Selected Mission${selectedQuests.length === 1 ? "" : "s"}` : "Select Missions to Complete"}
        </button>
      </Panel>

      {nextPhotoQuestToVerify ? (
        <PhotoVerification
          questId={nextPhotoQuestToVerify.id}
          questTitle={nextPhotoQuestToVerify.title}
          verified={photoVerifiedForQuestIds.includes(nextPhotoQuestToVerify.id)}
          onVerified={markPhotoVerified}
        />
      ) : selectedPhotoQuests.length > 0 && unverifiedPhotoQuests.length === 0 ? (
        <Panel eyebrow="Proof verified" title="All selected photo quests are verified">
          <p className="text-sm text-forest-700">
            {selectedPhotoQuests.length} selected mission{selectedPhotoQuests.length === 1 ? "" : "s"} have valid photo proof and are ready to complete.
          </p>
        </Panel>
      ) : selectedPhotoQuests.length > 0 ? (
        <Panel eyebrow="Proof required" title="Photo proof is required for selected quests">
          <p className="text-sm text-forest-700">
            {selectedPhotoQuests.length} selected mission{selectedPhotoQuests.length === 1 ? "" : "s"} need photo proof before completion.
          </p>
        </Panel>
      ) : null}

      {completedPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/20 bg-[#f8fff5] p-6 shadow-[0_28px_70px_rgba(16,33,20,0.25)]">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-forest-950 text-3xl font-extrabold text-cream-100">✓</div>
              <div>
                <h3 className="text-xl font-extrabold text-forest-950">Mission complete!</h3>
                <p className="mt-2 text-sm leading-6 text-forest-700">{completedPopup}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCompletedPopup(null)}
              className="mt-6 inline-flex rounded-full bg-forest-950 px-5 py-3 text-sm font-extrabold text-cream-100 shadow-[0_12px_24px_rgba(16,33,20,0.2)] hover:bg-forest-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Panel eyebrow="Quest progress" title="Category Progress">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categoryProgress.map(({ name, mark, color, done, total }) => {
            const progress = Math.round((done / total) * 100);
            return (
              <article key={name} className="rounded-2xl border border-[#dfe7d7] bg-[#f7f9f2] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-xs font-extrabold text-forest-800 shadow-sm">
                      {mark}
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-forest-950">{name}</p>
                      <p className="text-xs font-semibold text-forest-700/62">{done}/{total} quests</p>
                    </div>
                  </div>
                  {done === total && <Pill active>Done</Pill>}
                </div>
                <ProgressBar value={progress} color={color} />
                <p className="mt-2 text-right text-xs font-extrabold" style={{ color }}>{progress}%</p>
              </article>
            );
          })}
        </div>
      </Panel>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-forest-950 px-6 py-3 text-sm font-extrabold text-cream-100 shadow-[0_20px_44px_rgba(16,33,20,0.3)]">
          {toast}
        </div>
      )}
    </div>
  );
}
