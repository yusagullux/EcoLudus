// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { HeroMetric, MetricCard, PageHero, Panel, Pill, ProgressBar, primaryButton, secondaryButton, inputClass } from "@/components/game-ui";
import PhotoVerification from "@/components/photo-verification";
import { updateUserProfile } from "@/public/js/auth.js";
import { requiredXP } from "@/public/js/levels.js";

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
  APPROVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "✓", label: "Approved" },
  PARTIAL:  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   icon: "◐", label: "Partial Credit" },
  REJECTED: { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    icon: "✗", label: "Rejected" },
  FLAGGED:  { bg: "bg-red-50",     text: "text-red-800",     border: "border-red-300",     icon: "⚑", label: "Flagged" },
};

const CATEGORIES = [
  { name: "Recycling", image: "/images/forest.png", color: "#2f6b46" },
  { name: "Energy Saving", image: "/images/background.png", color: "#9a6b1f" },
  { name: "Transportation", image: "/images/mountains.png", color: "#2f5f86" },
  { name: "Water Saving", image: "/images/nature.png", color: "#237482" },
  { name: "Clean-Up Missions", image: "/images/night.png", color: "#62508f" },
  { name: "Gardening & Nature", image: "/images/plants/bamboo.png", color: "#4c7a3b" },
  { name: "Sustainable Living", image: "/images/plants/lotus.png", color: "#3e8c7c" }
];

const CATEGORY_IMAGES: Record<string, string> = {
  recycling: "/images/forest.png",
  energy_saving: "/images/background.png",
  transportation: "/images/mountains.png",
  water_saving: "/images/nature.png",
  cleanup_missions: "/images/night.png",
  gardening_nature: "/images/forest.png",
  sustainable_living: "/images/mountains.png"
};

function checkIfQuestRequiresPhoto(id: string) {
  const photoQuestIds = [
    "recycling_2", "recycling_3", "recycling_4",
    "cleanup_1", "cleanup_2", "cleanup_3",
    "gardening_1", "gardening_2", "gardening_3",
    "water_2"
  ];
  return photoQuestIds.includes(id);
}

function getTimeUntilNextReset(lastResetTime: string | null) {
  if (!lastResetTime) return 0;
  const now = new Date().getTime();
  const lastResetTimestamp = new Date(lastResetTime).getTime();
  const hoursInMilliseconds = 24 * 60 * 60 * 1000;
  const nextResetTimestamp = lastResetTimestamp + hoursInMilliseconds;
  return Math.max(0, nextResetTimestamp - now);
}

export default function DashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();

  const [questsData, setQuestsData] = useState<any>(null);
  const [quests, setQuests] = useState<any[]>([]);
  const [loadingQuests, setLoadingQuests] = useState(true);

  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [photoVerifiedForQuestIds, setPhotoVerifiedForQuestIds] = useState<string[]>([]);
  const [activePhotoVerifyQuest, setActivePhotoVerifyQuest] = useState<any | null>(null);
  const [completedPopup, setCompletedPopup] = useState<string | null>(null);
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const [toast, setToast] = useState("");
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Private missions state
  const [privateMissions, setPrivateMissions] = useState<any[] | null>(null);
  const [loadingPrivateMissions, setLoadingPrivateMissions] = useState(true);
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");
  const [beforeValue, setBeforeValue] = useState<string>("");
  const [afterValue, setAfterValue] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(5);
  const [submittingHabit, setSubmittingHabit] = useState(false);
  const [habitVerificationResult, setHabitVerificationResult] = useState<any | null>(null);

  // Load quests.json on mount
  useEffect(() => {
    async function loadQuests() {
      try {
        const res = await fetch("/quests.json");
        if (res.ok) {
          const data = await res.json();
          setQuestsData(data);
        }
      } catch (err) {
        console.error("Error loading quests.json:", err);
      }
    }
    loadQuests();
  }, []);

  // Load private missions on mount
  useEffect(() => {
    async function loadPrivateMissions() {
      try {
        const res = await fetch("/api/private-missions");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setPrivateMissions(data.missions || []);
            if (data.missions && data.missions.length > 0) {
              setSelectedMissionId(data.missions[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Error loading private missions:", err);
      } finally {
        setLoadingPrivateMissions(false);
      }
    }
    loadPrivateMissions();
  }, []);

  // Sync / Initialize daily quests based on profile and questsData
  useEffect(() => {
    if (!profile || !questsData || !user?.uid) return;

    const lastReset = profile.lastQuestResetTime;
    const currentDailyQuestIds = profile.currentDailyQuests || [];
    const dailyQuestsCompleted = profile.dailyQuestsCompleted || [];

    // Flatten all quests from quests.json categories
    const allMappedQuests: any[] = [];
    questsData.categories.forEach((category: any) => {
      category.quests.forEach((quest: any) => {
        allMappedQuests.push({
          id: quest.id,
          title: quest.shortName || quest.description,
          category: category.name,
          categoryColor: category.color || "#4CAF50",
          xp: quest.xp || 35,
          eco: quest.ecoCoins || 25,
          carbon: quest.carbonFootprintReduction || 0.5,
          requiresPhoto: checkIfQuestRequiresPhoto(quest.id)
        });
      });
    });

    const isResetNeeded = !lastReset || currentDailyQuestIds.length === 0 || getTimeUntilNextReset(lastReset) <= 0;

    if (isResetNeeded) {
      async function resetDaily() {
        setLoadingQuests(true);
        const completedQuestIds = profile.completedQuests || [];
        let available = allMappedQuests.filter((q: any) => !completedQuestIds.includes(q.id));
        if (available.length === 0) {
          available = allMappedQuests;
        }
        const shuffled = [...available].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 5);
        const selectedIds = selected.map((q: any) => q.id);

        try {
          const result = await updateUserProfile(user.uid, {
            lastQuestResetTime: new Date().toISOString(),
            currentDailyQuests: selectedIds,
            dailyQuestsCompleted: []
          });
          if (result.success) {
            await refreshProfile();
          }
        } catch (err) {
          console.error("Error resetting daily quests in database:", err);
        } finally {
          setLoadingQuests(false);
        }
      }
      resetDaily();
    } else {
      // Map current daily quests
      const todayQuests = allMappedQuests
        .filter((q: any) => currentDailyQuestIds.includes(q.id))
        .map((q: any) => ({
          ...q,
          done: dailyQuestsCompleted.includes(q.id)
        }));
      
      setQuests(todayQuests);
      setLoadingQuests(false);
    }
  }, [profile, questsData, user?.uid]);

  // Live ticking reset timer
  useEffect(() => {
    if (!profile?.lastQuestResetTime) return;

    const updateTimer = () => {
      const remaining = getTimeUntilNextReset(profile.lastQuestResetTime);
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [profile?.lastQuestResetTime]);

  const formatTime = (ms: number) => {
    if (ms <= 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const displayName = profile?.displayName || user?.email?.split("@")[0] || "Explorer";
  const xp = profile?.xp ?? 0;
  const ecoPoints = profile?.ecoPoints ?? 0;
  const level = profile?.level ?? 1;
  const carbonReduced = profile?.carbonReduced ?? 0;
  const missionsCompleted = profile?.missionsCompleted ?? 0;
  const completedQuests = profile?.completedQuests || [];

  const curXP = level <= 1 ? 0 : requiredXP(level - 1);
  const nextXP = requiredXP(level);
  const pct = Math.min(100, Math.max(0, Math.round(((xp - curXP) / (nextXP - curXP)) * 100)));
  const completedToday = quests.filter((quest) => quest.done).length;
  const selectedQuests = quests.filter((quest) => selectedQuestIds.includes(quest.id) && !quest.done);
  
  // Calculate dynamic category progress using quests.json & user's completedQuests list
  const categoryProgress = CATEGORIES.map((cat) => {
    const jsonCategory = questsData?.categories?.find(
      (c: any) => c.name === cat.name || c.id === cat.name.toLowerCase().replace(" ", "_")
    );
    const total = jsonCategory?.quests?.length || 1;
    const done = jsonCategory?.quests?.filter((q: any) => completedQuests.includes(q.id)).length || 0;
    return { ...cat, done, total };
  });

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const toggleSelection = (quest: any) => {
    if (quest.done || pendingCompletion) return;

    if (quest.requiresPhoto && !photoVerifiedForQuestIds.includes(quest.id)) {
      if (!selectedQuestIds.includes(quest.id)) {
        // Trigger modal for verification first
        setActivePhotoVerifyQuest(quest);
        return;
      }
    }

    setSelectedQuestIds((current) =>
      current.includes(quest.id) ? current.filter((id) => id !== quest.id) : [...current, quest.id]
    );
  };

  const markPhotoVerified = (questId: string) => {
    setPhotoVerifiedForQuestIds((current) => Array.from(new Set([...current, questId])));
    setSelectedQuestIds((current) => Array.from(new Set([...current, questId])));
    showToast("Photo verified. Mission checked!");
  };

  const completeSelectedMissions = async () => {
    if (!user?.uid || !profile || selectedQuests.length === 0 || pendingCompletion) return;

    // Double check that photo proof is verified for all photo-based quests in selection
    const unverified = selectedQuests.filter((q) => q.requiresPhoto && !photoVerifiedForQuestIds.includes(q.id));
    if (unverified.length > 0) {
      showToast(`Please verify photo proof for "${unverified[0].title}" first.`);
      setActivePhotoVerifyQuest(unverified[0]);
      return;
    }

    setPendingCompletion(true);
    const completedIds = selectedQuests.map((quest) => quest.id);

    try {
      const response = await fetch("/api/quests/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questIds: completedIds })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result?.error?.code || "Failed to complete selected missions.");
      }

      setQuests((items) => items.map((item) => (completedIds.includes(item.id) ? { ...item, done: true } : item)));
      setSelectedQuestIds([]);
      await refreshProfile();
      const completedTitles = selectedQuests.map((quest) => quest.title).join(", ");
      setCompletedPopup(`Mission complete! ${selectedQuests.length} mission${selectedQuests.length === 1 ? "" : "s"} finished: ${completedTitles}`);
      showToast(
        `Completed ${selectedQuests.length} mission${selectedQuests.length === 1 ? "" : "s"}: +${result.totals.xp} XP, +${result.totals.ecoPoints} EcoPoints, ${Number(result.totals.carbonReduced || 0).toFixed(1)} kg CO2`
      );
      setPhotoVerifiedForQuestIds((ids) => ids.filter((id) => !completedIds.includes(id)));
    } catch (error) {
      console.error("Mission completion error:", error);
      showToast("Unable to complete missions. Please try again.");
    } finally {
      setPendingCompletion(false);
    }
  };

  const selectedMission = privateMissions?.find((m: any) => m.id === selectedMissionId) ?? null;

  const submitHabitMission = async () => {
    if (!user?.uid || !selectedMissionId || description.trim().length < 8 || submittingHabit) return;

    setSubmittingHabit(true);
    setHabitVerificationResult(null);

    try {
      const response = await fetch("/api/private-missions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          missionId: selectedMissionId,
          userId: user.uid,
          beforeValue: beforeValue.trim() || undefined,
          afterValue: afterValue.trim() || undefined,
          description: description.trim(),
          confidence,
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        const code = result?.error?.code || "unknown";
        if (code === "missions/rate-limited") {
          showToast("Too many submissions. Please wait before trying again.");
        } else if (code === "missions/duplicate-window") {
          showToast("You already submitted this recently. Try a different mission.");
        } else {
          showToast(result?.error?.message || "Submission failed. Try again.");
        }
        return;
      }

      setHabitVerificationResult(result);
      await refreshProfile();

      if (result.verification?.status === "APPROVED") {
        showToast(`Habit verified! +${result.rewards?.xpAwarded ?? 0} XP awarded.`);
      } else if (result.verification?.status === "PARTIAL") {
        showToast(`Partial credit: +${result.rewards?.xpAwarded ?? 0} XP awarded.`);
      } else {
        showToast(`Submission reviewed: ${result.verification?.status?.toLowerCase() || "complete"}.`);
      }

      // Reset form fields for next submission
      setDescription("");
      setBeforeValue("");
      setAfterValue("");
      setConfidence(5);
    } catch (error) {
      console.error("Habit submission error:", error);
      showToast("Unable to submit. Please try again.");
    } finally {
      setSubmittingHabit(false);
    }
  };

  if (loading || loadingQuests) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <div className="logo-breathe h-14 w-14 overflow-hidden rounded-2xl bg-white shadow-[0_18px_38px_rgba(16,33,20,0.16)] ring-1 ring-forest-900/10">
          <img src="/images/logo.png" alt="EcoLudus logo" className="h-full w-full object-cover" />
        </div>
        <p className="text-sm font-semibold text-forest-800">Synchronizing daily quest rhythm...</p>
      </div>
    );
  }

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
        action={<Pill>Resets in {formatTime(timeLeft)}</Pill>}
        className="overflow-hidden"
      >
        <div className="-mx-5 -mt-5 divide-y divide-[#e7ecdf] sm:-mx-6 sm:-mt-6">
          {quests.map((quest) => {
            const isSelected = selectedQuestIds.includes(quest.id);
            const isPhotoVerified = photoVerifiedForQuestIds.includes(quest.id);
            return (
              <label
                key={quest.id}
                className={`flex cursor-pointer items-start gap-4 px-5 py-4 transition hover:bg-[#f4f7ef] sm:px-6 ${quest.done ? "opacity-60" : ""} ${isSelected && !quest.done ? "bg-[#eef5ea]" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={quest.done || isSelected}
                  disabled={quest.done || pendingCompletion}
                  onChange={() => toggleSelection(quest)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-forest-800"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: quest.categoryColor }} />
                    <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-forest-700/70">{quest.category}</span>
                  </div>
                  <p className={`mt-1 text-sm font-extrabold text-forest-950 ${quest.done ? "line-through" : ""}`}>{quest.title}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <Pill>+{quest.xp} XP</Pill>
                    <span className="text-[11px] font-bold text-forest-700/56">+{quest.eco} Eco</span>
                  </div>
                  {quest.requiresPhoto && !quest.done && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActivePhotoVerifyQuest(quest);
                      }}
                      className={`mt-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider transition ${
                        isPhotoVerified
                          ? "bg-[#eef5ea] text-forest-700"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      }`}
                    >
                      {isPhotoVerified ? "Verified" : "Verify proof"}
                    </button>
                  )}
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

      {/* ── Photo Verification Popup Modal ── */}
      {activePhotoVerifyQuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#dce6d8] bg-[#fffefa] p-1 shadow-[0_24px_70px_rgba(16,33,20,0.25)]">
            <button
              onClick={() => setActivePhotoVerifyQuest(null)}
              className="absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-forest-100 text-forest-900 hover:bg-forest-200 transition text-lg font-bold"
              aria-label="Close modal"
            >
              ×
            </button>
            <div className="p-5">
              <PhotoVerification
                questId={activePhotoVerifyQuest.id}
                questTitle={activePhotoVerifyQuest.title}
                verified={photoVerifiedForQuestIds.includes(activePhotoVerifyQuest.id)}
                onVerified={(id) => {
                  markPhotoVerified(id);
                  setTimeout(() => setActivePhotoVerifyQuest(null), 1200);
                }}
              />
            </div>
          </div>
        </div>
      )}

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

      {/* ── Private Habit Mission Logging Panel ── */}
      <Panel
        eyebrow="AI-Verified habits"
        title="Log a Private Habit Mission"
        action={<Pill>Gemini AI</Pill>}
      >
        {loadingPrivateMissions ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest-300 border-t-forest-800" />
            <span className="ml-3 text-sm font-semibold text-forest-700">Loading missions...</span>
          </div>
        ) : !privateMissions || privateMissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d6e0d0] bg-[#f9fbf5] px-6 py-10 text-center">
            <p className="text-sm font-semibold text-forest-700/70">No habit missions available yet.</p>
            <p className="mt-1 text-xs text-forest-600/50">Private missions will appear here once configured.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Mission Selector */}
            <div>
              <label htmlFor="habit-mission-select" className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-forest-700/70">
                Select Mission
              </label>
              <select
                id="habit-mission-select"
                value={selectedMissionId}
                onChange={(e) => {
                  setSelectedMissionId(e.target.value);
                  setHabitVerificationResult(null);
                }}
                className={`${inputClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%234a6b52%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_16px_center] bg-no-repeat pr-10`}
              >
                {privateMissions.map((mission: any) => (
                  <option key={mission.id} value={mission.id}>
                    {mission.title} — {mission.category} (+{mission.base_xp} XP)
                  </option>
                ))}
              </select>
            </div>

            {/* Before / After Values */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="habit-before" className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-forest-700/70">
                  Before Value <span className="font-medium normal-case tracking-normal text-forest-500/50">(optional)</span>
                </label>
                <input
                  id="habit-before"
                  type="text"
                  value={beforeValue}
                  onChange={(e) => setBeforeValue(e.target.value)}
                  placeholder="e.g. 3 bags of waste"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="habit-after" className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-forest-700/70">
                  After Value <span className="font-medium normal-case tracking-normal text-forest-500/50">(optional)</span>
                </label>
                <input
                  id="habit-after"
                  type="text"
                  value={afterValue}
                  onChange={(e) => setAfterValue(e.target.value)}
                  placeholder="e.g. 1 bag recycled, 2 composted"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="habit-description" className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-forest-700/70">
                Describe What You Did
              </label>
              <textarea
                id="habit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your habit in detail (min 8 characters)..."
                rows={3}
                className={`${inputClass} resize-none`}
              />
              <p className={`mt-1 text-right text-[10px] font-bold ${description.trim().length >= 8 ? "text-forest-600" : "text-rose-500"}`}>
                {description.trim().length}/8 min
              </p>
            </div>

            {/* Confidence Stars */}
            <div>
              <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-forest-700/70">
                Self-Confidence <span className="font-medium normal-case tracking-normal text-forest-500/50">(how sure are you?)</span>
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setConfidence(star)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all duration-200 ${
                      star <= confidence
                        ? "scale-110 bg-amber-100 text-amber-500 shadow-[0_4px_12px_rgba(180,130,20,0.15)]"
                        : "bg-[#f0f3ea] text-forest-400/40 hover:bg-[#e8eee1] hover:text-amber-400"
                    }`}
                    aria-label={`Confidence ${star} of 5`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-xs font-bold text-forest-700/60">{confidence}/5</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={submitHabitMission}
              disabled={submittingHabit || description.trim().length < 8 || !selectedMissionId}
              className={`w-full ${primaryButton}`}
            >
              {submittingHabit ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream-100/40 border-t-cream-100" />
                  Analyzing with Gemini AI...
                </span>
              ) : (
                "Verify & Log Habit"
              )}
            </button>

            {/* ── Gemini Loading Shimmer ── */}
            {submittingHabit && (
              <div className="overflow-hidden rounded-2xl border border-[#dfe7d7] bg-gradient-to-br from-[#f4f7ef] to-[#e8f0e0] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-950 text-lg text-cream-100 shadow-md">
                    ✦
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-forest-950">Gemini AI is analyzing your submission...</p>
                    <p className="mt-0.5 text-xs text-forest-600/70">Checking realism, consistency, and credibility.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 animate-pulse rounded-full bg-forest-200/60" style={{ width: "85%" }} />
                  <div className="h-3 animate-pulse rounded-full bg-forest-200/40" style={{ width: "65%", animationDelay: "0.15s" }} />
                  <div className="h-3 animate-pulse rounded-full bg-forest-200/30" style={{ width: "45%", animationDelay: "0.3s" }} />
                </div>
              </div>
            )}

            {/* ── Gemini Verification Results Card ── */}
            {habitVerificationResult && !submittingHabit && (() => {
              const v = habitVerificationResult.verification;
              const r = habitVerificationResult.rewards;
              const t = habitVerificationResult.trust;
              const style = VERDICT_STYLES[v?.status] || VERDICT_STYLES.REJECTED;

              return (
                <div className={`overflow-hidden rounded-2xl border ${style.border} ${style.bg} shadow-[0_12px_36px_rgba(26,45,29,0.08)]`}>
                  {/* Verdict Header */}
                  <div className="flex items-center justify-between border-b border-inherit px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-black ${style.bg} ${style.text} ring-2 ring-current/20`}>
                        {style.icon}
                      </span>
                      <div>
                        <h4 className={`text-base font-extrabold ${style.text}`}>{style.label}</h4>
                        <p className="text-[11px] font-bold text-forest-600/50">Gemini AI Verification</p>
                      </div>
                    </div>
                    {r?.xpAwarded > 0 && (
                      <div className="rounded-full bg-forest-950 px-4 py-1.5 text-xs font-extrabold text-cream-100 shadow-md">
                        +{r.xpAwarded} XP
                      </div>
                    )}
                  </div>

                  {/* Scores Row */}
                  <div className="grid grid-cols-3 divide-x divide-inherit border-b border-inherit">
                    <div className="px-4 py-3 text-center">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-forest-700/60">Realism</p>
                      <p className={`mt-1 font-serif text-2xl font-extrabold ${style.text}`}>{v?.realism_score ?? "—"}</p>
                    </div>
                    <div className="px-4 py-3 text-center">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-forest-700/60">Confidence</p>
                      <p className={`mt-1 font-serif text-2xl font-extrabold ${style.text}`}>{v?.confidence ?? "—"}%</p>
                    </div>
                    <div className="px-4 py-3 text-center">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-forest-700/60">Trust Δ</p>
                      <p className={`mt-1 font-serif text-2xl font-extrabold ${(t?.delta ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {(t?.delta ?? 0) >= 0 ? "+" : ""}{t?.delta ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  {v?.reasoning && (
                    <div className="border-b border-inherit px-5 py-4">
                      <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-forest-700/60">AI Reasoning</p>
                      <p className="text-sm leading-relaxed text-forest-800">{v.reasoning}</p>
                    </div>
                  )}

                  {/* Risk Flags */}
                  {v?.risk_flags && v.risk_flags.length > 0 && (
                    <div className="px-5 py-4">
                      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-rose-600/70">Risk Flags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {v.risk_flags.map((flag: string, i: number) => (
                          <span key={i} className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                            ⚠ {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rewards Summary Footer */}
                  {r && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-inherit bg-white/50 px-5 py-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-forest-700/50">Rewards:</span>
                      <Pill active={r.xpAwarded > 0}>+{r.xpAwarded} XP</Pill>
                      {r.levelRewards?.ecoCoins > 0 && <Pill>+{r.levelRewards.ecoCoins} Eco</Pill>}
                      <span className="ml-auto text-[10px] font-bold text-forest-600/50">
                        Trust: {t?.nextScore ?? "—"}/100
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Panel>

      <Panel eyebrow="Quest progress" title="Category Progress">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categoryProgress.map(({ name, image, color, done, total }) => {
            const progress = Math.round((done / total) * 100);
            return (
              <article key={name} className="reveal-card rounded-2xl border border-[#dfe7d7] bg-[#f7f9f2] p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_38px_rgba(26,45,29,0.08)]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
                      <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
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
