"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/useAuth";
import { useQuests } from "@/lib/useQuests";
import { useToast } from "@/lib/toast";
import { HeroMetric, PageHero, Panel, Pill, ProgressBar, StatGrid, primaryButton, secondaryButton, inputClass } from "@/components/game-ui";
import { CategoryIcon } from "@/components/category-icon";
import PhotoVerification from "@/components/photo-verification";
import { Dialog } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ErrorBanner } from "@/components/ui/error-banner";
import { requiredXP } from "@/lib/level-system";
import { StaggerContainer, StaggerItem, FadeIn } from "@/lib/animations";

const CATEGORIES = [
  { name: "Recycling", image: "/images/forest.webp", color: "#2f6b46" },
  { name: "Energy Saving", image: "/images/background.webp", color: "#9a6b1f" },
  { name: "Transportation", image: "/images/mountains.webp", color: "#2f5f86" },
  { name: "Water Saving", image: "/images/nature.webp", color: "#237482" },
  { name: "Clean-Up Missions", image: "/images/night.webp", color: "#62508f" },
  { name: "Gardening & Nature", image: "/images/plants/bamboo.png", color: "#4c7a3b" },
  { name: "Sustainable Living", image: "/images/plants/lotus.png", color: "#3e8c7c" }
];

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
  const toast = useToast();

  const { quests: questsData } = useQuests();
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
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [streakReward, setStreakReward] = useState<{ day: number; label: string } | null>(null);


  // ── NOTE: the set-state-in-effect / exhaustive-deps warnings in the effects
  // below are known and intentionally deferred. This project runs the React
  // Compiler (react-hooks/preserve-manual-memoization), which REJECTS manual
  // useMemo/useState-lazy workarounds with "Existing memoization could not be
  // preserved" errors — verified while fixing the collection page. The only
  // safe fix is the wholesale Phase 4 rewrite of this quest-sync effect, which
  // is out of scope for a piecemeal lint pass. Leaving as-is intentionally.
  // Sync / Initialize daily quests based on profile and questsData
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
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
          requiresProof: quest.requiresProof !== false,
          requiresPhoto: Boolean(quest.requiresPhoto),
          description: quest.description || "Complete this small eco-friendly action."
        });
      });
    });

    const isResetNeeded = !lastReset || currentDailyQuestIds.length === 0 || isAfterMidnightUTC(lastReset);

    if (isResetNeeded) {
      async function resetDaily() {
        setLoadingQuests(true);

        // ── Streak milestone rewards (server-granted) ───────────────────────
        // Eco/egg streak rewards are granted by /api/streak/apply so they can't
        // be forged from the client.
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

        // ── Daily quest selection (server-side) ─────────────────────────────
        // /api/quests/daily picks the 5 daily quests under a row lock and writes
        // the set + reset bookkeeping atomically, so the daily set can no longer
        // be rigged client-side to the highest-XP quests. Idempotent within a UTC
        // day. We just ask and refresh.
        try {
          const res = await fetch("/api/quests/daily", { method: "POST" });
          if (res.ok) {
            await refreshProfile();
          }
        } catch (err) {
          console.error("Error selecting daily quests:", err);
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
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

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

  const displayName = String(profile?.displayName || user?.email?.split("@")[0] || "Eco Explorer");
  const xp = Number(profile?.xp ?? 0);
  const ecoPoints = Number(profile?.ecoPoints ?? 0);
  const level = Number(profile?.level ?? 1);
  const carbonReduced = Number(profile?.carbonReduced ?? 0);
  const missionsCompleted = Number(profile?.missionsCompleted ?? 0);
  const completedQuests = (profile?.completedQuests || []) as string[];
  // Streak is shown as a compact 🔥 + count badge in the hero (not a full card).
  // The streak still advances server-side via /api/streak/apply on dashboard load,
  // and milestone rewards surface through the Streak Reward popup below.
  const currentStreak = Number(profile?.currentStreak ?? 0);
  const longestStreak = Number(profile?.longestStreak ?? currentStreak);
  const streakMilestones = [3, 7, 14, 30];
  const nextStreakMilestone = streakMilestones.find((day) => day > currentStreak) ?? currentStreak + 7;
  const previousStreakMilestone = streakMilestones.filter((day) => day <= currentStreak).slice(-1)[0] ?? 0;
  const streakProgress = Math.min(100, Math.max(0, Math.round(((currentStreak - previousStreakMilestone) / Math.max(1, nextStreakMilestone - previousStreakMilestone)) * 100)));
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

    if (!verifiedQuestIds.includes(quest.id) && !selectedQuestIds.includes(quest.id) && quest.requiresProof !== false) {
      setActiveTextVerifyQuest(quest);
      // Photo is the primary proof method; text remains available as an
      // accessible fallback when taking a photo is not practical.
      setProofType(questRequiresPhoto(questsData, quest.id) ? "photo" : "text");
      setTextProof("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setVerificationError(null);
      return;
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
      toast.success(`✓ Proof verified${confidence}. Quest checked!`);
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

    // Double check that proof is verified for every proof-required quest in the
    // selection. Honor-system quests (requiresProof === false) skip this.
    const unverified = selectedQuests.filter((q) => q.requiresProof !== false && !verifiedQuestIds.includes(q.id));
    if (unverified.length > 0) {
      const quest = unverified[0];
      toast.show(`Please verify proof for "${quest.title}" first.`);
      setActiveTextVerifyQuest(quest);
      setProofType(questRequiresPhoto(questsData, quest.id) ? "photo" : "text");
      setTextProof("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setVerificationError(null);
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
      toast.success(
        result.bonusChest?.name
          ? `Daily clear bonus: ${result.bonusChest.name} found!`
          : `Completed ${selectedQuests.length} mission${selectedQuests.length === 1 ? "" : "s"}: +${result.totals.xp + (result.totals.companionXpBonus || 0)} XP, +${result.totals.ecoPoints} EcoPoints, ${Number(result.totals.carbonReduced || 0).toFixed(1)} kg CO2`
      );
      setVerifiedQuestIds((ids) => ids.filter((id) => !completedIds.includes(id)));
    } catch (error) {
      console.error("Mission completion error:", error);
      toast.error(error instanceof Error ? error.message : "Unable to complete missions. Please try again.");
    } finally {
      setPendingCompletion(false);
    }
  };

  if (loading || loadingQuests) {
    // Skeleton that mirrors the real dashboard layout (hero + metric grid + quest
    // panel) so the page reserves the same space up front — no layout shift once
    // useAuth and the daily quests resolve. White-on-dark bars suit the dark hero
    // gradient; panel-alt bars shimmer against the panel surface.
    return (
      <div className="flex flex-col gap-5" aria-busy="true" role="status" aria-live="polite">
        <span className="sr-only">Loading your dashboard…</span>

        {/* Hero skeleton */}
        <div className="relative overflow-hidden rounded-[22px] p-6 sm:p-8" style={{ background: "var(--bg-hero)" }}>
          <div className="flex flex-col gap-4">
            <div className="h-3 w-24 animate-pulse rounded-full bg-white/25" />
            <div className="h-8 w-2/3 animate-pulse rounded-lg bg-white/25" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded bg-white/15" />
            <div className="mt-2 flex flex-wrap gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 w-20 animate-pulse rounded-xl bg-white/15" />
              ))}
            </div>
          </div>
        </div>

        {/* Metric card grid skeleton */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[18px] p-5"
              style={{ background: "var(--bg-panel)", border: "1px solid var(--border-subtle)" }}
            >
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--bg-panel-alt)]" />
              <div className="mt-3 h-6 w-16 animate-pulse rounded bg-[var(--bg-panel-alt)]" />
            </div>
          ))}
        </div>

        {/* Quest panel skeleton */}
        <div className="rounded-[18px] p-6" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-subtle)" }}>
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--bg-panel-alt)]" />
          <div className="mt-5 flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-[var(--bg-panel-alt)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
        <PageHero
          eyebrow="Today's quest hub"
          title={<>Welcome back, <span className="break-words" title={displayName}>{displayName}</span></>}
          description={`${completedToday} of ${quests.length} missions complete today. Keep the rhythm focused and visible.`}
        >
          <div className="flex flex-col items-end gap-2">
            {/* Compact streak indicator — fire + day count, not a full card.
                The streak still advances server-side via /api/streak/apply, and
                milestone rewards pop up below; this is just a glanceable badge. */}
            <div
              className="w-full max-w-[260px] rounded-2xl border p-3 text-left"
              style={{ borderColor: "color-mix(in srgb, var(--text-warning) 32%, transparent)", background: "linear-gradient(135deg, color-mix(in srgb, var(--text-warning) 20%, transparent), color-mix(in srgb, var(--bg-panel-alt) 18%, transparent))" }}
              title="Consecutive days you've logged in. Keep it alive for milestone rewards."
            >
              <span className="text-sm leading-none font-black" aria-hidden="true">✦</span>
              <span className="streak-badge-text text-xs font-bold uppercase tracking-wider">
                {currentStreak}-day streak
              </span>
              <div className="mt-3 flex gap-1.5" aria-hidden="true">
                {Array.from({ length: 7 }, (_, index) => (
                  <span key={index} className="h-2 flex-1 rounded-full" style={{ background: index < Math.min(currentStreak, 7) ? "var(--text-warning)" : "rgba(255,255,255,0.22)" }} />
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-white/75">
                <span>{nextStreakMilestone - currentStreak} days to next reward</span>
                <span>{streakProgress}%</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <HeroMetric label="XP" value={xp} hint="Experience points — earned from every completed quest. Level is derived from your total XP." />
              <HeroMetric label="EcoPoints" value={ecoPoints} hint="EcoPoints are the in-app currency earned from quests — spend them in the Plant Shop." />
              <HeroMetric label="Level" value={level} />
              <HeroMetric label="Quests Today" value={`${completedToday}/${quests.length}`} hint="Missions completed today." />
              {activePet && <HeroMetric label="Pet" value={activePet.name} />}
            </div>
          </div>
        </PageHero>
      </StaggerItem>

      <StaggerItem as="div">
        <StatGrid
          className="grid-cols-2 gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1"
          items={[
            { label: "Current Level", value: `Level ${level}`, accent: "var(--text-accent)" },
            { label: "Missions Done", value: missionsCompleted, accent: "var(--text-accent)" },
            { label: "CO2 Reduced", value: `${(+carbonReduced || 0).toFixed(1)} kg`, accent: "var(--text-accent)" }
          ]}
        />
      </StaggerItem>

      {/* Streak reward popup — fires on login when /api/streak/apply grants a
          milestone. The streak progress panel itself lives on the Insights page
          (see app/(game)/insights/page.tsx); this popup is just the "you earned
          a streak reward" notification, so it stays on the landing page. */}
      {streakReward && (
        <Dialog
          open
          onClose={() => setStreakReward(null)}
          size="sm"
          footer={<button type="button" onClick={() => setStreakReward(null)} className={`w-full ${primaryButton}`}>Claim & Continue</button>}
        >
          <div className="flex flex-col items-center text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="font-serif text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Streak Reward!</h3>
            <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>{streakReward.label}</p>
          </div>
        </Dialog>
      )}

      <StaggerItem as="section">
        <Panel
          eyebrow="Level progress"
          title={`Level ${level} to ${level + 1}`}
          action={<Pill active>{pct}%</Pill>}
        >
        <ProgressBar value={pct} color="var(--text-accent)" />
        <div className="mt-3 flex justify-between text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          <span>{(xp - curXP).toLocaleString()} XP earned this level</span>
          <span>{nextXP === Infinity ? "Max level" : `${(nextXP - curXP).toLocaleString()} XP total`}</span>
        </div>
      </Panel>
      </StaggerItem>

      {activePet && (
        <StaggerItem as="section">
          <Panel eyebrow="Companion boost" title={`${activePet.name} is adventuring with you`} action={<Pill active>Bond {activePetBond}%</Pill>}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                Completing daily quests grows your active pet's bond. A cared-for companion can discover bonus XP during missions.
              </p>
              <div className="min-w-[180px]">
                <ProgressBar value={activePetBond} color="var(--text-accent)" />
              </div>
            </div>
          </Panel>
        </StaggerItem>
      )}

      <StaggerItem as="section">
        <Panel
          eyebrow="Daily missions"
          title="Today's Quests"
          action={<Pill>Resets in {formatTime(timeLeft)}</Pill>}
          className="overflow-hidden"
        >
        <StaggerContainer className="-mx-5 -mt-5 divide-y divide-[var(--border-subtle)] sm:-mx-6 sm:-mt-6" as="div" staggerDelay={0.04}>
          {quests.map((quest) => {
            const isSelected = selectedQuestIds.includes(quest.id);
            const isVerified = verifiedQuestIds.includes(quest.id);
            return (
              <StaggerItem
                key={quest.id}
                as="div"
                className={`flex items-start gap-4 px-5 py-5 transition hover:bg-[var(--bg-panel-alt)] sm:px-6 ${quest.done ? "opacity-55" : ""}`}
                style={{ background: isSelected && !quest.done ? "var(--sidebar-active-bg)" : "transparent" }}
              >
                <label className="flex cursor-pointer items-start gap-4 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={quest.done || isSelected}
                    disabled={quest.done || pendingCompletion}
                    onChange={() => toggleSelection(quest)}
                    aria-label={`${quest.done ? "Completed" : "Mark complete"}: ${quest.title}`}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded accent-[var(--text-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-accent)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: quest.categoryColor }} />
                      <span className="text-xs font-extrabold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>{quest.category}</span>
                    </div>
                    <p className={`mt-1 text-base font-extrabold leading-snug ${quest.done ? "line-through" : ""}`} style={{ color: "var(--text-primary)" }}>{quest.title}</p>
                    <p className="mt-1.5 max-w-2xl text-sm leading-5" style={{ color: "var(--text-muted)" }}>{quest.description}</p>
                  </div>
                </label>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <Pill>+{quest.xp} XP</Pill>
                    <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>+{quest.eco} Eco</span>
                  </div>
                  {!quest.done && quest.requiresProof !== false && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTextVerifyQuest(quest);
                        setProofType(questRequiresPhoto(questsData, quest.id) ? "photo" : "text");
                        setTextProof("");
                        setPhotoFile(null);
                        setPhotoPreview(null);
                        setVerificationError(null);
                      }}
                      className="mt-1 min-h-11 rounded-full px-3 py-2 text-[10px] font-extrabold tracking-[0.02em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-accent)]"
                      style={isVerified
                        ? { background: "var(--sidebar-active-bg)", color: "var(--text-sidebar-muted)" }
                        : { background: "color-mix(in srgb, var(--text-warning) 12%, var(--bg-panel-alt))", color: "var(--text-warning)" }}
                    >
                      {isVerified ? "Proof verified" : "Add proof"}
                    </button>
                  )}
                  {!quest.done && quest.requiresProof === false && isSelected && (
                    <span className="mt-1 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Ready to complete
                    </span>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        <button
          type="button"
          onClick={completeSelectedMissions}
          disabled={selectedQuests.length === 0 || pendingCompletion}
          className={`mt-5 w-full ${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {pendingCompletion ? "Completing..." : selectedQuests.length > 0 ? `Complete ${selectedQuests.length} Selected Mission${selectedQuests.length === 1 ? "" : "s"}` : "Select Missions to Complete"}
        </button>
      </Panel>
      </StaggerItem>

      {/* ── Proof Verification Modal (Text + Photo) ── */}
      {activeTextVerifyQuest && (
        <Dialog
          open
          onClose={() => {
            setActiveTextVerifyQuest(null);
            setTextProof("");
            setPhotoFile(null);
            setPhotoPreview(null);
            setVerificationError(null);
          }}
          size="lg"
          footer={
            <>
              <button
                type="button"
                onClick={handleVerifyProof}
                disabled={
                  verifyingText ||
                  (proofType === "text" && textProof.trim().length < 8) ||
                  (proofType === "photo" && !photoFile)
                }
                className={`flex-1 ${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {verifyingText ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[color-mix(in_srgb,var(--text-sidebar)_40%,transparent)] border-t-[var(--text-sidebar)]" />
                    Reviewing proof...
                  </span>
                ) : (
                  "Submit Proof"
                )}
              </button>
              <button
                type="button"
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
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="pr-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Quest verification</p>
              <h3 className="mt-1 font-serif text-xl font-bold" style={{ color: "var(--text-primary)" }}>Verify proof for: {activeTextVerifyQuest.title}</h3>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                {questRequiresPhoto(questsData, activeTextVerifyQuest.id)
                  ? "A photo is the best proof — but if you can't take one, you can describe it in text."
                  : "You can verify with either text or a photo."}
              </p>
            </div>

            {/* Proof type tabs */}
            <SegmentedControl
              ariaLabel="Proof type"
              value={proofType}
              onChange={(v) => { setProofType(v as "text" | "photo"); setVerificationError(null); }}
              options={[
                { value: "text", label: "✏️ Text Proof" },
                { value: "photo", label: "📷 Photo Proof" }
              ]}
            />

            {proofType === "text" ? (
              <div>
                <label htmlFor="quest-text-proof" className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
                  Briefly describe what you did
                </label>
                <textarea
                  id="quest-text-proof"
                  value={textProof}
                  onChange={(e) => setTextProof(e.target.value)}
                  placeholder="e.g. I collected 5 plastic bottles from my kitchen and sorted them into the recycling bin..."
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
                <p className="mt-1 text-right text-[10px] font-bold" style={{ color: textProof.trim().length >= 8 ? "var(--text-accent)" : "var(--text-error)" }}>
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
                      className="rounded-xl border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 transition-all hover:bg-rose-500/20"
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
                  <div className="overflow-hidden rounded-xl border p-2 text-center" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel-alt)" }}>
                    <Image
                      src={photoPreview}
                      alt="Preview"
                      unoptimized
                      width={320}
                      height={160}
                      className="mx-auto h-40 w-full max-w-xs rounded-lg object-cover"
                    />
                  </div>
                )}
              </div>
            )}

            {verificationError && <ErrorBanner>{verificationError}</ErrorBanner>}
          </div>
        </Dialog>
      )}

      {completedPopup && (
        <Dialog
          open
          onClose={() => setCompletedPopup(null)}
          size="lg"
          footer={<button type="button" onClick={() => setCompletedPopup(null)} className={secondaryButton}>Close</button>}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-sidebar)] text-2xl font-extrabold text-[var(--text-sidebar)]">✓</div>
            <div>
              <h3 className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>Mission complete!</h3>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{completedPopup}</p>
            </div>
          </div>
        </Dialog>
      )}


      <StaggerItem as="section">
        <Panel eyebrow="Quest progress" title="Category Progress">
          <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" as="div" staggerDelay={0.05}>
            {categoryProgress.map(({ name, image, color, done, total }) => {
              const progress = Math.round((done / total) * 100);
              return (
                <StaggerItem key={name} as="article" className="rounded-2xl border p-4 transition hover:-translate-y-0.5" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
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
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </Panel>
      </StaggerItem>

    </StaggerContainer>
  );
}
