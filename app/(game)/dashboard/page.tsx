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
  const [verifiedQuestIds, setVerifiedQuestIds] = useState<string[]>([]);
  const [activeTextVerifyQuest, setActiveTextVerifyQuest] = useState<any | null>(null);
  const [proofType, setProofType] = useState<"text" | "photo">("text");
  const [textProof, setTextProof] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [verifyingText, setVerifyingText] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [completedPopup, setCompletedPopup] = useState<string | null>(null);
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const [toast, setToast] = useState("");
  const [timeLeft, setTimeLeft] = useState<number>(0);

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
          requiresProof: true
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

    if (!verifiedQuestIds.includes(quest.id)) {
      if (!selectedQuestIds.includes(quest.id)) {
        // Trigger modal for verification first
        setActiveTextVerifyQuest(quest);
        setProofType("text");
        setTextProof("");
        setPhotoFile(null);
        setPhotoPreview(null);
        setVerificationError(null);
        return;
      }
    }

    setSelectedQuestIds((current) =>
      current.includes(quest.id) ? current.filter((id) => id !== quest.id) : [...current, quest.id]
    );
  };

  const handleVerifyProof = async () => {
    if (!activeTextVerifyQuest || verifyingText) return;

    // Validate based on proof type
    if (proofType === "text" && textProof.trim().length < 8) return;
    if (proofType === "photo" && !photoFile) return;

    setVerifyingText(true);
    setVerificationError(null);

    try {
      let bodyPayload: any = { questId: activeTextVerifyQuest.id };

      if (proofType === "photo" && photoFile) {
        const photoData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Failed to read photo."));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(photoFile);
        });
        bodyPayload.photoProof = photoData;
        bodyPayload.mimeType = photoFile.type;
      } else {
        bodyPayload.textProof = textProof.trim();
      }

      const response = await fetch("/api/quests/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || "Verification failed.");
      }

      setVerifiedQuestIds((current) => Array.from(new Set([...current, activeTextVerifyQuest.id])));
      setSelectedQuestIds((current) => Array.from(new Set([...current, activeTextVerifyQuest.id])));
      showToast("Proof verified. Quest checked!");
      setTextProof("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setActiveTextVerifyQuest(null);
    } catch (err: any) {
      setVerificationError(err.message || "An error occurred during verification.");
    } finally {
      setVerifyingText(false);
    }
  };

  const completeSelectedMissions = async () => {
    if (!user?.uid || !profile || selectedQuests.length === 0 || pendingCompletion) return;

    // Double check that text proof is verified for all quests in selection
    const unverified = selectedQuests.filter((q) => !verifiedQuestIds.includes(q.id));
    if (unverified.length > 0) {
      showToast(`Please verify proof for "${unverified[0].title}" first.`);
      setActiveTextVerifyQuest(unverified[0]);
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
      setVerifiedQuestIds((ids) => ids.filter((id) => !completedIds.includes(id)));
    } catch (error) {
      console.error("Mission completion error:", error);
      showToast("Unable to complete missions. Please try again.");
    } finally {
      setPendingCompletion(false);
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
            const isVerified = verifiedQuestIds.includes(quest.id);
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
                  {!quest.done && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveTextVerifyQuest(quest);
                        setProofType("text");
                        setTextProof("");
                        setPhotoFile(null);
                        setPhotoPreview(null);
                        setVerificationError(null);
                      }}
                      className={`mt-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider transition ${
                        isVerified
                          ? "bg-[#eef5ea] text-forest-700"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      }`}
                    >
                      {isVerified ? "Verified" : "Verify proof"}
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

      {/* ── Proof Verification Modal (Text + Photo) ── */}
      {activeTextVerifyQuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#dce6d8] bg-[#fffefa] p-6 shadow-[0_24px_70px_rgba(16,33,20,0.25)]">
            <button
              onClick={() => {
                setActiveTextVerifyQuest(null);
                setTextProof("");
                setPhotoFile(null);
                setPhotoPreview(null);
                setVerificationError(null);
              }}
              className="absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-forest-100 text-forest-900 hover:bg-forest-200 transition text-lg font-bold"
              aria-label="Close modal"
            >
              ×
            </button>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-500">Quest verification</p>
                <h3 className="mt-1 font-serif text-xl font-bold text-forest-950">Verify proof for: {activeTextVerifyQuest.title}</h3>
              </div>

              {/* Proof type tabs */}
              <div className="flex rounded-xl bg-forest-50 p-1">
                <button
                  type="button"
                  onClick={() => { setProofType("text"); setVerificationError(null); }}
                  className={`flex-1 rounded-lg py-2 text-center text-xs font-extrabold uppercase tracking-wider transition ${
                    proofType === "text" ? "bg-white text-forest-900 shadow-sm" : "text-forest-600 hover:text-forest-900"
                  }`}
                >
                  ✏️ Text Proof
                </button>
                <button
                  type="button"
                  onClick={() => { setProofType("photo"); setVerificationError(null); }}
                  className={`flex-1 rounded-lg py-2 text-center text-xs font-extrabold uppercase tracking-wider transition ${
                    proofType === "photo" ? "bg-white text-forest-900 shadow-sm" : "text-forest-600 hover:text-forest-900"
                  }`}
                >
                  📷 Photo Proof
                </button>
              </div>

              {proofType === "text" ? (
                <div>
                  <label htmlFor="quest-text-proof" className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-forest-700/70">
                    Describe what you did to complete this quest
                  </label>
                  <textarea
                    id="quest-text-proof"
                    value={textProof}
                    onChange={(e) => setTextProof(e.target.value)}
                    placeholder="e.g. I collected 5 plastic bottles from my kitchen and sorted them into the recycling bin..."
                    rows={4}
                    className={`${inputClass} resize-none`}
                  />
                  <p className={`mt-1 text-right text-[10px] font-bold ${textProof.trim().length >= 8 ? "text-forest-600" : "text-rose-500"}`}>
                    {textProof.trim().length}/8 min characters
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <label className="block text-[11px] font-extrabold uppercase tracking-[0.16em] text-forest-700/70">
                    Upload a photo showing quest completion
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById("quest-photo-file-picker")?.click()}
                      className={`flex-1 rounded-xl border border-forest-200 bg-white py-3 text-xs font-bold text-forest-900 hover:border-forest-400 transition-all`}
                    >
                      {photoFile ? "Change Photo" : "Choose Photo"}
                    </button>
                    {photoFile && (
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 hover:border-rose-300 transition-all"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    id="quest-photo-file-picker"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        setPhotoFile(file);
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === "string") {
                            setPhotoPreview(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="sr-only"
                  />
                  {photoPreview && (
                    <div className="overflow-hidden rounded-xl border border-forest-100 bg-forest-50 p-2 text-center">
                      <img src={photoPreview} alt="Preview" className="mx-auto max-h-40 rounded-lg object-cover" />
                    </div>
                  )}
                </div>
              )}

              {verificationError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                  {verificationError}
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleVerifyProof}
                  disabled={
                    verifyingText ||
                    (proofType === "text" && textProof.trim().length < 8) ||
                    (proofType === "photo" && !photoFile)
                  }
                  className={`flex-1 ${primaryButton}`}
                >
                  {verifyingText ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream-100/40 border-t-cream-100" />
                      Reviewing proof...
                    </span>
                  ) : (
                    "Submit Proof"
                  )}
                </button>
                <button
                  onClick={() => {
                    setActiveTextVerifyQuest(null);
                    setTextProof("");
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    setVerificationError(null);
                  }}
                  className={secondaryButton}
                >
                  Cancel
                </button>
              </div>
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
