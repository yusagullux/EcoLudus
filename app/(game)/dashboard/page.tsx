"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { HeroMetric, MetricCard, PageHero, Panel, Pill, ProgressBar, primaryButton, secondaryButton, inputClass } from "@/components/game-ui";
import { CategoryIcon } from "@/components/category-icon";
import PhotoVerification from "@/components/photo-verification";
import { updateUserProfile } from "@/lib/auth-client";
import { requiredXP } from "@/lib/level-system";

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
  APPROVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "✓", label: "Approved" },
  PARTIAL:  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   icon: "◐", label: "Partial Credit" },
  REJECTED: { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    icon: "✗", label: "Rejected" },
  FLAGGED:  { bg: "bg-red-50",     text: "text-red-800",     border: "border-red-300",     icon: "⚑", label: "Flagged" },
};

const CATEGORIES = [
  { name: "Recycling", image: "/images/forest.webp", color: "#2f6b46" },
  { name: "Energy Saving", image: "/images/background.webp", color: "#9a6b1f" },
  { name: "Transportation", image: "/images/mountains.webp", color: "#2f5f86" },
  { name: "Water Saving", image: "/images/nature.webp", color: "#237482" },
  { name: "Clean-Up Missions", image: "/images/night.webp", color: "#62508f" },
  { name: "Gardening & Nature", image: "/images/plants/bamboo.png", color: "#4c7a3b" },
  { name: "Sustainable Living", image: "/images/plants/lotus.png", color: "#3e8c7c" }
];

const CATEGORY_IMAGES: Record<string, string> = {
  recycling: "/images/forest.webp",
  energy_saving: "/images/background.webp",
  transportation: "/images/mountains.webp",
  water_saving: "/images/nature.webp",
  cleanup_missions: "/images/night.webp",
  gardening_nature: "/images/forest.webp",
  sustainable_living: "/images/mountains.webp"
};

const MAX_PROOF_PHOTO_BYTES = 10 * 1024 * 1024;
const MIN_PROOF_PHOTO_BYTES = 5 * 1024;
const ACCEPTED_PROOF_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Whether a quest requires a photo proof (vs. allowing text). Derived from the
// `requiresPhoto` flag on the quest definition in /public/quests.json — the
// quest catalog is the single source of truth, so adding a photo quest no
// longer needs a code change here.
function questRequiresPhoto(questsData: { categories?: Array<{ quests?: Array<{ id: string; requiresPhoto?: boolean }> }> } | null, id: string) {
  if (!questsData?.categories) return false;
  for (const category of questsData.categories) {
    for (const quest of category.quests ?? []) {
      if (quest.id === id) return Boolean(quest.requiresPhoto);
    }
  }
  return false;
}

function getTimeUntilNextReset(lastResetTime: string | null): number {
  // Resets at midnight UTC each day, not on a rolling 24h window from last reset.
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return Math.max(0, tomorrow.getTime() - now.getTime());
}

function isAfterMidnightUTC(lastResetTime: string | null): boolean {
  if (!lastResetTime) return true;
  const lastReset = new Date(lastResetTime);
  const now = new Date();
  // Compare UTC date strings — if the day has rolled over, a reset is needed.
  const lastDate = `${lastReset.getUTCFullYear()}-${lastReset.getUTCMonth()}-${lastReset.getUTCDate()}`;
  const nowDate  = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  return lastDate !== nowDate;
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
  const [streakReward, setStreakReward] = useState<{ day: number; label: string } | null>(null);
  // Read-only "Impact this week" — the first visible surface for the spine.
  const [weekImpact, setWeekImpact] = useState<number | null>(null);

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

  // Load weekly Impact (the spine's first visible surface) on mount.
  useEffect(() => {
    async function loadImpact() {
      try {
        const res = await fetch("/api/stats/impact");
        if (res.ok) {
          const data = await res.json();
          if (typeof data?.weekImpact === "number") {
            setWeekImpact(data.weekImpact);
          }
        }
      } catch (err) {
        console.error("Error loading weekly impact:", err);
      }
    }
    loadImpact();
  }, []);


  // ── NOTE: the set-state-in-effect / exhaustive-deps warnings in the effects
  // below are known and intentionally deferred. This project runs the React
  // Compiler (react-hooks/preserve-manual-memoization), which REJECTS manual
  // useMemo/useState-lazy workarounds with "Existing memoization could not be
  // preserved" errors — verified while fixing the collection page. The only
  // safe fix is the wholesale Phase 4 rewrite of this quest-sync effect, which
  // is out of scope for a piecemeal lint pass. Leaving as-is intentionally.
  // Sync / Initialize daily quests based on profile and questsData
  useEffect(() => {
    if (!profile || !questsData || !user?.uid) return;

    const lastReset = profile.lastQuestResetTime as string | undefined;
    const currentDailyQuestIds = (profile.currentDailyQuests || []) as string[];
    const dailyQuestsCompleted = (profile.dailyQuestsCompleted || []) as string[];

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
          requiresProof: true,
          requiresPhoto: Boolean(quest.requiresPhoto)
        });
      });
    });

    const isResetNeeded = !lastReset || currentDailyQuestIds.length === 0 || isAfterMidnightUTC(lastReset);

    if (isResetNeeded) {
      async function resetDaily() {
        setLoadingQuests(true);
        const completedQuestIds = (profile!.completedQuests || []) as string[];
        let available = allMappedQuests.filter((q: any) => !completedQuestIds.includes(q.id));
        if (available.length === 0) {
          available = allMappedQuests;
        }
        const shuffled = [...available].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 5);
        const selectedIds = selected.map((q: any) => q.id);

        // ── Streak milestone rewards (server-granted) ───────────────────────
        // Eco/egg streak rewards are granted by /api/streak/apply so they can't
        // be forged from the client. The route runs the streak counter + milestone
        // logic and returns the granted milestone (if any) for the toast. Quest
        // *selection* (below) still happens client-side; only the *reward* moved.
        try {
          const streakRes = await fetch("/api/streak/apply", { method: "POST" });
          if (streakRes.ok) {
            const streakData = await streakRes.json();
            if (streakData?.granted) {
              setStreakReward({ day: streakData.granted.day, label: streakData.granted.label });
            }
          }
        } catch (err) {
          console.error("Error applying streak rewards:", err);
        }

        const profileUpdates: Record<string, unknown> = {
          lastQuestResetTime: new Date().toISOString(),
          currentDailyQuests: selectedIds,
          dailyQuestsCompleted: [],
          verifiedQuestProofs: {}
        };

        try {
          const result = await updateUserProfile(user!.uid, profileUpdates);
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

  useEffect(() => {
    if (!profile) {
      setVerifiedQuestIds([]);
      return;
    }

    const proofs = profile.verifiedQuestProofs && typeof profile.verifiedQuestProofs === "object"
      ? profile.verifiedQuestProofs as Record<string, any>
      : {};
    const resetKey = typeof profile.lastQuestResetTime === "string" ? profile.lastQuestResetTime : null;
    const currentDailyQuestIds = Array.isArray(profile.currentDailyQuests) ? profile.currentDailyQuests.map(String) : [];
    const dailyQuestsCompleted = Array.isArray(profile.dailyQuestsCompleted) ? profile.dailyQuestsCompleted.map(String) : [];
    const verifiedIds = currentDailyQuestIds.filter((questId) => {
      if (dailyQuestsCompleted.includes(questId)) return false;
      const proof = proofs[questId];
      return proof?.verifiedAt && proof?.resetKey === resetKey;
    });

    setVerifiedQuestIds(verifiedIds);
  }, [profile]);

  useEffect(() => {
    if (!activeTextVerifyQuest) return;

    const requiresPhoto = questRequiresPhoto(questsData, activeTextVerifyQuest.id);
    setProofType(requiresPhoto ? "photo" : "text");
    setVerificationError(null);
  }, [activeTextVerifyQuest, questsData]);

  // Live ticking reset timer (counts down to midnight UTC)
  useEffect(() => {
    const updateTimer = () => setTimeLeft(getTimeUntilNextReset(null));
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

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
  const xp = Number(profile?.xp ?? 0);
  const ecoPoints = Number(profile?.ecoPoints ?? 0);
  const level = Number(profile?.level ?? 1);
  const carbonReduced = Number(profile?.carbonReduced ?? 0);
  const missionsCompleted = Number(profile?.missionsCompleted ?? 0);
  const completedQuests = (profile?.completedQuests || []) as string[];
  const currentStreak = Number(profile?.currentStreak ?? 0);
  const longestStreak = Number(profile?.longestStreak ?? 0);
  const profileAnimals = Array.isArray(profile?.animals) ? profile.animals : [];
  const activePetId = profile?.activePet || profileAnimals.find((pet: any) => pet.active)?.id;
  const activePet = profileAnimals.find((pet: any) => pet.id === activePetId) || null;
  const activePetBond = Number(activePet?.bond ?? 0);

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

  const handleProofPhotoSelected = (file: File | null) => {
    setVerificationError(null);

    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    const fileType = file.type.toLowerCase();
    if (!ACCEPTED_PROOF_PHOTO_TYPES.includes(fileType)) {
      setPhotoFile(null);
      setPhotoPreview(null);
      setVerificationError("Please upload a JPEG, PNG, WebP, HEIC, or HEIF photo.");
      return;
    }

    if (file.size > MAX_PROOF_PHOTO_BYTES) {
      setPhotoFile(null);
      setPhotoPreview(null);
      setVerificationError("Image too large. Maximum size is 10MB.");
      return;
    }

    if (file.size < MIN_PROOF_PHOTO_BYTES) {
      setPhotoFile(null);
      setPhotoPreview(null);
      setVerificationError("The uploaded file appears to be empty or corrupt. Please upload a real photo.");
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
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
        // Show Gemini's reasoning if available, otherwise use a friendly message
        const reason = data?.error?.message;
        const isRejection = response.status === 422;
        throw new Error(
          reason
            ? reason
            : isRejection
            ? "Proof not accepted. Please provide a more specific description of what you did."
            : "Verification failed. Please try again."
        );
      }

      const confidence = data.confidence ? ` (${data.confidence}% confidence)` : "";
      setVerifiedQuestIds((current) => Array.from(new Set([...current, activeTextVerifyQuest.id])));
      setSelectedQuestIds((current) => Array.from(new Set([...current, activeTextVerifyQuest.id])));
      showToast(`✓ Proof verified${confidence}. Quest checked!`);
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
        throw new Error(result?.error?.message || result?.error?.code || "Failed to complete selected missions.");
      }

      setQuests((items) => items.map((item) => (completedIds.includes(item.id) ? { ...item, done: true } : item)));
      setSelectedQuestIds([]);
      await refreshProfile();
      const completedTitles = selectedQuests.map((quest) => quest.title).join(", ");
      const companionLine = result.companion?.name
        ? ` ${result.companion.name} gained bond${result.totals.companionXpBonus ? ` and found +${result.totals.companionXpBonus} bonus XP` : ""}.`
        : "";
      const bonusChestLine = result.bonusChest?.name
        ? ` Daily clear bonus: ${result.bonusChest.name} added to your Collection.`
        : "";
      setCompletedPopup(`Mission complete! ${selectedQuests.length} mission${selectedQuests.length === 1 ? "" : "s"} finished: ${completedTitles}.${companionLine}${bonusChestLine}`);
      showToast(
        result.bonusChest?.name
          ? `Daily clear bonus: ${result.bonusChest.name} found!`
          : `Completed ${selectedQuests.length} mission${selectedQuests.length === 1 ? "" : "s"}: +${result.totals.xp + (result.totals.companionXpBonus || 0)} XP, +${result.totals.ecoPoints} EcoPoints, ${Number(result.totals.carbonReduced || 0).toFixed(1)} kg CO2`
      );
      setVerifiedQuestIds((ids) => ids.filter((id) => !completedIds.includes(id)));
    } catch (error) {
      console.error("Mission completion error:", error);
      showToast(error instanceof Error ? error.message : "Unable to complete missions. Please try again.");
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
          <HeroMetric label="Streak" value={`${currentStreak}d`} />
          <HeroMetric label="Impact this week" value={weekImpact === null ? "—" : weekImpact.toLocaleString()} />
          {activePet && <HeroMetric label="Pet" value={activePet.name} />}
        </div>
      </PageHero>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Current Level" value={`Level ${level}`} accent="#2f6b46" />
        <MetricCard label="Missions Done" value={missionsCompleted} accent="#2f5f86" />
        <MetricCard label="CO2 Reduced" value={`${(+carbonReduced || 0).toFixed(1)} kg`} accent="#237482" />
        <MetricCard label="Login Streak" value={`${currentStreak} day${currentStreak === 1 ? "" : "s"}`} accent="#9a6b1f" />
      </div>

      <Panel eyebrow="Daily rhythm" title="Active Streak" action={<Pill active>Best {longestStreak}d</Pill>}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {currentStreak > 0 ? `${currentStreak} day streak` : "Start your first streak"}
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Log in each day to keep your eco momentum alive.
            </p>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }).map((_, index) => (
              <span
                key={index}
                className="h-8 w-8 rounded-full border"
                style={{
                  borderColor: "var(--border-default)",
                  background: index < Math.min(currentStreak, 7) ? "var(--pill-active-bg)" : "var(--bg-panel-alt)"
                }}
                aria-label={index < currentStreak ? "Streak day active" : "Future streak day"}
              />
            ))}
          </div>
        </div>

        {/* Upcoming streak milestones */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { day: 3,  icon: "✨", label: "+20 Eco",        color: "#9a6b1f" },
            { day: 7,  icon: "🥚", label: "Common Egg",     color: "#2f5f86" },
            { day: 14, icon: "🥚", label: "Rare Egg",       color: "#62508f" },
            { day: 30, icon: "🐉", label: "Legendary Egg",  color: "#c97c20" }
          ].map(({ day, icon, label, color }) => {
            const reached = currentStreak >= day;
            const claimed = Number(profile?.lastStreakRewardDay ?? 0) >= day;
            return (
              <div key={day} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: reached ? color : "var(--border-default)", background: claimed ? `${color}18` : "var(--bg-panel-alt)", opacity: claimed ? 0.6 : 1 }}>
                <span className="text-base">{icon}</span>
                <div>
                  <p className="font-extrabold" style={{ color: reached ? color : "var(--text-muted)" }}>Day {day}</p>
                  <p className="font-semibold" style={{ color: "var(--text-muted)" }}>{claimed ? "Claimed" : label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Streak reward popup */}
      {streakReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[24px] border p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.3)]"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-panel)" }}>
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="font-serif text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Streak Reward!</h3>
            <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>{streakReward.label}</p>
            <button onClick={() => setStreakReward(null)} className={`mt-6 w-full ${primaryButton}`}>Claim & Continue</button>
          </div>
        </div>
      )}

      <Panel
        eyebrow="Level progress"
        title={`Level ${level} to ${level + 1}`}
        action={<Pill active>{pct}%</Pill>}
      >
        <ProgressBar value={pct} color="#2f6b46" />
        <div className="mt-3 flex justify-between text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          <span>{(xp - curXP).toLocaleString()} XP earned this level</span>
          <span>{nextXP === Infinity ? "Max level" : `${(nextXP - curXP).toLocaleString()} XP total`}</span>
        </div>
      </Panel>

      {activePet && (
        <Panel eyebrow="Companion boost" title={`${activePet.name} is adventuring with you`} action={<Pill active>Bond {activePetBond}%</Pill>}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
              Completing daily quests grows your active pet's bond. A cared-for companion can discover bonus XP during missions.
            </p>
            <div className="min-w-[180px]">
              <ProgressBar value={activePetBond} color="#9a6b1f" />
            </div>
          </div>
        </Panel>
      )}

      <Panel
        eyebrow="Daily missions"
        title="Today's Quests"
        action={<Pill>Resets in {formatTime(timeLeft)}</Pill>}
        className="overflow-hidden"
      >
        <div className="-mx-5 -mt-5 divide-y divide-[var(--border-subtle)] sm:-mx-6 sm:-mt-6">
          {quests.map((quest) => {
            const isSelected = selectedQuestIds.includes(quest.id);
            const isVerified = verifiedQuestIds.includes(quest.id);
            return (
              <label
                key={quest.id}
                className={`flex cursor-pointer items-start gap-4 px-5 py-4 transition sm:px-6 ${quest.done ? "opacity-55" : ""}`}
                style={{ background: isSelected && !quest.done ? "var(--sidebar-active-bg)" : "transparent" }}
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
                    <span className="text-xs font-extrabold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>{quest.category}</span>
                  </div>
                  <p className={`mt-1 text-sm font-extrabold ${quest.done ? "line-through" : ""}`} style={{ color: "var(--text-primary)" }}>{quest.title}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <Pill>+{quest.xp} XP</Pill>
                    <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>+{quest.eco} Eco</span>
                  </div>
                  {!quest.done && (
                    <button
                      type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveTextVerifyQuest(quest);
                        setProofType(questRequiresPhoto(questsData, quest.id) ? "photo" : "text");
                        setTextProof("");
                        setPhotoFile(null);
                        setPhotoPreview(null);
                        setVerificationError(null);
                      }}
                      className="mt-1 min-h-11 rounded-full px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider transition"
                      style={isVerified
                        ? { background: "var(--sidebar-active-bg)", color: "var(--text-sidebar-muted)" }
                        : { background: "#fef3c7", color: "#92400e" }}
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
        <div className="relative w-full max-w-lg overflow-hidden rounded-[24px] border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.25)]" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel)" }}>
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
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Quest verification</p>
                <h3 className="mt-1 font-serif text-xl font-bold" style={{ color: "var(--text-primary)" }}>Verify proof for: {activeTextVerifyQuest.title}</h3>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                  {questRequiresPhoto(questsData, activeTextVerifyQuest.id)
                    ? "This quest needs a photo proof upload."
                    : "You can verify with either text or a photo."}
                </p>
              </div>

              {/* Proof type tabs */}
              <div className="flex rounded-xl p-1" style={{ background: "var(--bg-panel-alt)" }}>
                <button
                  type="button"
                  disabled={questRequiresPhoto(questsData, activeTextVerifyQuest.id)}
                  onClick={() => { setProofType("text"); setVerificationError(null); }}
                  className="min-h-11 flex-1 rounded-lg py-2 text-center text-xs font-extrabold uppercase tracking-wider transition"
                  style={proofType === "text"
                    ? { background: "var(--bg-panel)", color: "var(--text-primary)" }
                    : questRequiresPhoto(questsData, activeTextVerifyQuest.id)
                    ? { color: "var(--text-muted)", opacity: 0.45 }
                    : { color: "var(--text-muted)" }}
                >
                  ✏️ Text Proof
                </button>
                <button
                  type="button"
                  onClick={() => { setProofType("photo"); setVerificationError(null); }}
                  className="min-h-11 flex-1 rounded-lg py-2 text-center text-xs font-extrabold uppercase tracking-wider transition"
                  style={proofType === "photo"
                    ? { background: "var(--bg-panel)", color: "var(--text-primary)" }
                    : { color: "var(--text-muted)" }}
                >
                  📷 Photo Proof
                </button>
              </div>

              {proofType === "text" ? (
                <div>
                  <label htmlFor="quest-text-proof" className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
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
                  <p className={`mt-1 text-right text-[10px] font-bold ${textProof.trim().length >= 8 ? "" : "text-rose-500"}`} style={textProof.trim().length >= 8 ? { color: "var(--text-accent, #43653f)" } : undefined}>
                    {textProof.trim().length}/8 min characters
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <label className="block text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
                    Upload a photo showing quest completion
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById("quest-photo-camera")?.click()}
                      className="flex-1 rounded-xl border py-3 text-xs font-bold transition-all"
                      style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-panel-alt)" }}
                    >
                      📸 Take Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById("quest-photo-gallery")?.click()}
                      className="flex-1 rounded-xl border py-3 text-xs font-bold transition-all"
                      style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-panel-alt)" }}
                    >
                      🖼️ Gallery
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
                  {/* Camera input (opens native camera on mobile) */}
                  <input
                    id="quest-photo-camera"
                    type="file"
                    accept={ACCEPTED_PROOF_PHOTO_TYPES.join(",")}
                    capture="environment"
                    onChange={(e) => {
                      handleProofPhotoSelected(e.target.files?.[0] || null);
                      e.currentTarget.value = "";
                    }}
                    className="sr-only"
                  />
                  {/* Gallery input (opens photo library) */}
                  <input
                    id="quest-photo-gallery"
                    type="file"
                    accept={ACCEPTED_PROOF_PHOTO_TYPES.join(",")}
                    onChange={(e) => {
                      handleProofPhotoSelected(e.target.files?.[0] || null);
                      e.currentTarget.value = "";
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-[24px] border p-6 shadow-[0_28px_70px_rgba(0,0,0,0.3)]" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel)" }}>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-950 text-2xl font-extrabold text-cream-100">✓</div>
              <div>
                <h3 className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>Mission complete!</h3>
                <p className="mt-1 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{completedPopup}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCompletedPopup(null)}
              className="mt-5 inline-flex rounded-full bg-forest-950 px-5 py-2.5 text-sm font-extrabold text-cream-100 hover:bg-forest-800 transition"
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
              <article key={name} className="reveal-card rounded-2xl border p-4 transition hover:-translate-y-0.5" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl" style={{ background: "var(--bg-panel)" }}>
                      <CategoryIcon name={name} color={color} className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{name}</p>
                      <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{done}/{total} quests</p>
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
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl" style={{ background: "var(--bg-sidebar)", color: "var(--text-sidebar)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
