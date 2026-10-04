"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useQuests } from "@/lib/useQuests";
import { useToast } from "@/lib/toast";
import { Avatar } from "@/components/avatar";
import { CategoryIcon, categoryToken } from "@/components/category-icon";
import { Dialog } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Camera, Clock, Coins, Flame, Image as ImageIcon, Smartphone, Sprout } from "lucide-react";
import {
  LevelProgressRing,
  MiniShelf,
  Panel,
  Pill,
  QuestCard,
  StreakFlame,
  type QuestCardState,
  type Rarity,
  primaryButton,
  secondaryButton,
  inputClass
} from "@/components/game-ui";
import { requiredXP } from "@/lib/level-system";
import { GROW_DURATION, HARVEST_COOLDOWN_MS } from "@/lib/garden-config";
import { PLANT_IMAGES } from "@/lib/ui-shared";
import { AnimatedNumber, RewardGlow, StaggerContainer, StaggerItem } from "@/lib/animations";

const CATEGORIES = [
  { name: "Recycling" },
  { name: "Energy Saving" },
  { name: "Transportation" },
  { name: "Water Saving" },
  { name: "Clean-Up Missions" },
  { name: "Gardening & Nature" },
  { name: "Sustainable Living" }
];

// Category accents resolve through categoryToken() — the shared category
// palette in components/category-icon.tsx — so the dashboard can never drift
// from the insights charts / habits / collection hues.
function accentForCategory(name: string): string {
  return categoryToken(name).hex;
}

// Matching ink (text) var for an accent — "var(--accent-teal)" →
// "var(--accent-teal-text)"; keeps the same fallback as accentForCategory.
function accentInkForCategory(name: string): string {
  const accent = accentForCategory(name).match(/--accent-[a-z]+/)?.[0];
  return accent ? `var(${accent}-text)` : "var(--text-accent)";
}

// Level medallion path — mirrors the landing rewards showcase. XP thresholds
// come from the REAL curve (requiredXP(n) = total XP needed to reach level
// n + 1), so the teaser copy is always truthful even if the table grows.
const BADGE_PATH = [
  { animal: "rabbit", name: "Rabbit", level: 2 },
  { animal: "cat", name: "Cat", level: 3 },
  { animal: "deer", name: "Deer", level: 4 },
  { animal: "fox", name: "Fox", level: 5 },
  { animal: "wolf", name: "Wolf", level: 6 },
  { animal: "bear", name: "Bear", level: 7 },
  { animal: "eagle", name: "Eagle", level: 8 },
  { animal: "lion", name: "Lion", level: 9 },
  { animal: "tiger", name: "Tiger", level: 10 }
];

// Garden readiness — same shared rules (lib/garden-config.ts) as the garden
// page and the harvest route, so the greeting's "plots ready" line is honest.
function isPlotReady(tile: any, nowMs: number): boolean {
  const rarity = (["common", "uncommon", "rare", "epic", "legendary"] as const).includes(tile?.rarity)
    ? (tile.rarity as Rarity)
    : "common";
  const placedAt = Number(tile?.placedAt ?? 0);
  const lastHarvestAt = Number(tile?.lastHarvestAt ?? 0);
  const bloomAt = placedAt + (GROW_DURATION[rarity] ?? GROW_DURATION.common);
  const coolAt = lastHarvestAt + HARVEST_COOLDOWN_MS;
  return nowMs >= Math.max(bloomAt, coolAt);
}

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

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user, profile, loading, refreshProfile, emailVerified } = useAuth();
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
  // "Now" clock for the garden teaser's harvest-ready count (Date.now() is not
  // render-pure, so it lives in an effect like the reset ticker). 0 = not set;
  // render-side consumers fall back until it lands.
  const [nowMs, setNowMs] = useState<number>(0);


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

    const isResetNeeded = !lastReset || currentDailyQuestIds.length === 0 || isAfterMidnightUTC(lastReset);

    // Unverified accounts are soft-gated: streak/apply and quests/daily return
    // 401 auth/email-not-verified, so don't call them — the unverified banner
    // above explains what to do. (When no reset is needed, the mapping below
    // still renders any already-selected daily quests.)
    if (isResetNeeded && !emailVerified) {
      setQuests([]);
      setLoadingQuests(false);
      return;
    }

    // Flatten all quests from quests.json categories
    const allMappedQuests: any[] = [];
    questsData.categories.forEach((category: any) => {
      category.quests.forEach((quest: any) => {
        allMappedQuests.push({
          id: quest.id,
          title: quest.shortName || quest.description,
          category: category.name,
          xp: quest.xp || 35,
          eco: quest.ecoCoins || 25,
          carbon: quest.carbonFootprintReduction || 0.5,
          requiresProof: quest.requiresProof !== false,
          requiresPhoto: Boolean(quest.requiresPhoto),
          description: quest.description || "Complete this small eco-friendly action."
        });
      });
    });

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

  // Display-only clock for the garden "plots ready" line (minute cadence is
  // plenty — readiness changes at 48h/8h boundaries).
  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    updateNow();
    const interval = setInterval(updateNow, 60_000);
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
  // The streak advances server-side via /api/streak/apply on dashboard load,
  // and milestone rewards surface through the Streak Reward popup below.
  const currentStreak = Number(profile?.currentStreak ?? 0);
  const longestStreak = Number(profile?.longestStreak ?? currentStreak);
  const profileAnimals = Array.isArray(profile?.animals) ? profile.animals : [];
  const activePetId = profile?.activePet || profileAnimals.find((pet: any) => pet.active)?.id;
  const activePet = profileAnimals.find((pet: any) => pet.id === activePetId) || null;
  const activePetBond = Number(activePet?.bond ?? 0);

  const completedToday = quests.filter((quest) => quest.done).length;
  const selectedQuests = quests.filter((quest) => selectedQuestIds.includes(quest.id) && !quest.done);

  // ── Display-only derivations (greeting, teasers, impact) ────────────────
  const profileImage = typeof profile?.profileImage === "string" ? profile.profileImage : null;

  // Level medallion teaser: first rung the user has NOT reached yet
  // (a badge's level is reached at requiredXP(badge.level - 1) total XP).
  const nextBadge = BADGE_PATH.find((b) => requiredXP(b.level - 1) > xp) ?? null;
  const earnedTiger = nextBadge === null && BADGE_PATH.length > 0;
  const lastBadge = BADGE_PATH[BADGE_PATH.length - 1];
  const xpToNextBadge = nextBadge ? Math.max(0, requiredXP(nextBadge.level - 1) - xp) : 0;

  // Garden teaser: owned plants as a deduped shelf + harvest-ready plot count.
  const gardenState = profile?.garden && typeof profile.garden === "object"
    ? (profile.garden as Record<string, any>)
    : {};
  const gardenTileValues = Object.values(gardenState);
  const readyPlots = nowMs === 0 ? 0 : gardenTileValues.filter((tile) => isPlotReady(tile, nowMs)).length;

  const plantList = Array.isArray(profile?.plants) ? profile.plants : [];
  const shelfItems = (() => {
    const byName = new Map<string, { name: string; image: string; count: number; rarity?: string }>();
    for (const plant of plantList) {
      const name = String(plant?.name ?? "").trim();
      if (!name) continue;
      const image = PLANT_IMAGES[name] ?? (typeof plant?.image === "string" ? plant.image : null) ?? "/images/plants/sunflower.png";
      const existing = byName.get(name);
      if (existing) existing.count += Math.max(1, Number(plant?.count ?? 1));
      else byName.set(name, { name, image, count: Math.max(1, Number(plant?.count ?? 1)), rarity: typeof plant?.rarity === "string" ? plant.rarity : undefined });
    }
    return Array.from(byName.values());
  })();
  const speciesGrown = shelfItems.length;

  const activePetImage = (() => {
    if (!activePet) return null;
    const name = String(activePet.name ?? "").trim();
    if (typeof activePet.image === "string" && activePet.image) return activePet.image;
    return name ? `/images/pets/${name.toLowerCase()}.png` : "/images/pets/cat.png";
  })();

  // Impact comparison: 0.5 kg CO₂ ≈ ~30 smartphone charges.
  const phoneCharges = Math.round((carbonReduced / 0.5) * 30);

  // Today's haul — totals across every mission completed today, for the
  // celebratory completion popup (derived at render, so the completion
  // handler itself stays byte-identical).
  const todayHaul = quests.reduce(
    (acc, quest) =>
      quest.done
        ? {
            xp: acc.xp + Number(quest.xp || 0),
            eco: acc.eco + Number(quest.eco || 0),
            carbon: acc.carbon + Number(quest.carbon || 0)
          }
        : acc,
    { xp: 0, eco: 0, carbon: 0 }
  );

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

    // Unverified accounts can't submit proof — /api/quests/verify would 401.
    if (!emailVerified) {
      setVerificationError("Verify your email first, then submit proof again.");
      return;
    }

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
      const levelUpLine = Array.isArray(result.levelUpRewardDetails) && result.levelUpRewardDetails.length > 0
        ? ` Level up rewards: ${result.levelUpRewardDetails.map((r: any) => `${r.icon || "🎁"} ${r.label}`).join(", ")}.`
        : "";
      setCompletedPopup(`Mission complete! ${selectedQuests.length} mission${selectedQuests.length === 1 ? "" : "s"} finished: ${completedTitles}.${companionLine}${bonusChestLine}${levelUpLine}`);
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
    // Skeleton that mirrors the new home composition (greeting row + dominant
    // mission stack + progress strip + teasers) so the page reserves the same
    // space up front — no layout shift once useAuth and the daily quests
    // resolve. Shared token-based skeletons render consistently in all six
    // themes.
    return (
      <div className="flex flex-col gap-5" aria-busy="true" role="status" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <div className="flex items-center gap-4 px-1" aria-hidden="true">
          <div className="h-[68px] w-[68px] shrink-0 animate-pulse rounded-full bg-ink-muted/20" />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="h-6 w-52 max-w-full animate-pulse rounded bg-ink-muted/25" />
            <div className="h-3.5 w-40 max-w-full animate-pulse rounded bg-ink-muted/15" />
          </div>
        </div>
        <PanelSkeleton rows={5} />
        <PanelSkeleton rows={1} />
        <PanelSkeleton rows={2} />
      </div>
    );
  }

  // Warm one-liner that reflects the day's actual state: harvestable garden
  // plots first, then the daily mission situation.
  const warmStatusLine = readyPlots > 0
    ? `Your garden has ${readyPlots} plot${readyPlots === 1 ? "" : "s"} ready to harvest.`
    : quests.length === 0
    ? "Fresh missions arrive with the daily reset."
    : completedToday < quests.length
    ? `${quests.length - completedToday} mission${quests.length - completedToday === 1 ? "" : "s"} are still open today.`
    : "All of today's missions are cleared — see you after the reset.";

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      {/* ── 1. Greeting row — no hero panel ─────────────────────────── */}
      <StaggerItem as="div" className="flex items-center gap-4 px-0.5">
        <span className="relative grid h-[68px] w-[68px] shrink-0 place-items-center">
          <span className="absolute inset-0" aria-hidden="true">
            <LevelProgressRing level={level} xp={xp} size={68} showLabel={false} />
          </span>
          <Avatar name={displayName} src={profileImage} size={50} className="relative" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-balance font-serif text-2xl font-bold leading-tight text-ink sm:text-[1.65rem]">
            {timeOfDayGreeting()}, <span className="break-words" title={displayName}>{displayName}</span>
          </h1>
          <p className="mt-1 text-sm leading-snug text-ink-soft">{warmStatusLine}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Streak chip — gold flame on the fg-chip family */}
            <span className="fg-chip fg-chip-coins">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              Streak {currentStreak} day{(currentStreak === 1 ? "" : "s")}
            </span>
          </div>
        </div>
      </StaggerItem>

      {/* ── 2. Today's missions — the dominant stack ─────────────────── */}
      <StaggerItem as="section">
        <Panel
          title="Today's missions"
          action={
            <div className="flex items-center gap-2">
              {quests.length > 0 && <Pill active>{completedToday} of {quests.length} done</Pill>}
              <Pill>
                <Clock className="h-3 w-3" aria-hidden="true" />
                Resets in {formatTime(timeLeft)}
              </Pill>
            </div>
          }
        >
          {/* Fragile: the empty state's negative margins mirror Panel's own
              `p-5 sm:p-6` body padding so it bleeds edge-to-edge — if Panel's
              padding changes, update both together. */}
          {quests.length === 0 ? (
            <div className="-mx-5 -mt-5 sm:-mx-6 sm:-mt-6">
              <EmptyState
                variant="plain"
                icon={<Sprout className="h-8 w-8" strokeWidth={1.8} />}
                title="No missions today"
                description="Fresh quests arrive with the daily reset — check back soon."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {quests.map((quest) => {
                const isSelected = selectedQuestIds.includes(quest.id);
                const isVerified = verifiedQuestIds.includes(quest.id);
                const accent = accentForCategory(quest.category);
                const state: QuestCardState = quest.done
                  ? "done"
                  : isVerified
                  ? "verified"
                  : isSelected
                  ? "selected"
                  : quest.requiresProof !== false
                  ? "proof"
                  : "idle";
                const questCard = (
                  <QuestCard
                    title={quest.done ? <span className="line-through">{quest.title}</span> : quest.title}
                    description={quest.description}
                    category={quest.category}
                    categoryIcon={
                      <CategoryIcon name={quest.category} color={accent} className="h-5 w-5" />
                    }
                    iconColor={accent}
                    state={state}
                    requiresPhoto={Boolean(quest.requiresPhoto)}
                    proofLabel={quest.requiresPhoto ? "Photo proof" : "Add proof"}
                    onClick={quest.done || pendingCompletion ? undefined : () => toggleSelection(quest)}
                    disabled={quest.done || pendingCompletion}
                    rewards={
                      <>
                        <span className="fg-chip fg-chip-xp">+{quest.xp} XP</span>
                        <span className="fg-chip fg-chip-coins">+{quest.eco} EP</span>
                        <span className="fg-chip fg-chip-carbon">
                          −{Number(quest.carbon || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂
                        </span>
                      </>
                    }
                  />
                );

                return (
                  <div key={quest.id}>
                    {questCard}
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={completeSelectedMissions}
            disabled={selectedQuests.length === 0 || pendingCompletion}
            className={`mt-5 w-full ${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {pendingCompletion ? "Completing..." : selectedQuests.length > 0 ? `Complete ${selectedQuests.length} mission${selectedQuests.length === 1 ? "" : "s"}` : "Select missions to complete"}
          </button>
        </Panel>
      </StaggerItem>

      {/* ── 3. Progress strip — level ring + streak + next medallion ── */}
      <StaggerItem as="section">
        <Panel>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <LevelProgressRing level={level} xp={xp} size={64} />
            <StreakFlame streak={currentStreak} longest={longestStreak} />
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <span className="fg-chip fg-chip-coins" title="EcoPoints are the in-app currency earned from quests — spend them in the Plant Shop.">
                <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                {ecoPoints.toLocaleString()} EcoPoints
              </span>
              <span className="text-xs font-semibold text-ink-muted">
                {missionsCompleted} mission{missionsCompleted === 1 ? "" : "s"} completed
              </span>
            </div>
          </div>

          {/* Next medallion teaser — real badge art, real curve numbers */}
          <div
            className="mt-4 flex items-center gap-3 rounded-[0.875rem] px-3 py-2.5"
            style={{
              background: "color-mix(in srgb, var(--accent-gold) 6%, var(--bg-panel))",
              border: "1px solid color-mix(in srgb, var(--accent-gold) 22%, var(--border-default))"
            }}
          >
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full shadow-elev-1" style={{ background: "color-mix(in srgb, var(--accent-green) 6%, var(--bg-panel))" }}>
              <Image
                src={earnedTiger ? "/images/ecoquests-badges/tiger-badge-removedbg.png" : `/images/ecoquests-badges/${nextBadge!.animal}-badge-removedbg.png`}
                alt={`${nextBadge ? nextBadge.name : lastBadge.name} medallion`}
                fill
                sizes="44px"
                className="object-cover scale-110"
              />
            </div>
            {earnedTiger ? (
              <p className="min-w-0 text-sm font-semibold leading-snug text-ink">
                Every medallion earned — {lastBadge.name} and all nine behind it.
              </p>
            ) : (
              <p className="min-w-0 text-sm font-semibold leading-snug text-ink">
                <span className="font-bold text-accent">{nextBadge!.name} medallion</span>{" "}
                at {requiredXP(nextBadge!.level - 1).toLocaleString()} XP total —
                only {xpToNextBadge.toLocaleString()} more to go.
              </p>
            )}
          </div>
        </Panel>
      </StaggerItem>

      {/* ── 4. Garden & companion teaser ────────────────────────────── */}
      <StaggerItem as="section">
        <Panel>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Garden shelf */}
            <div
              className="flex flex-col gap-3 rounded-[0.875rem] p-3.5"
              style={{
                background: "color-mix(in srgb, var(--accent-green) 6%, var(--bg-panel))",
                border: "1px solid color-mix(in srgb, var(--accent-green) 20%, var(--border-default))"
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-base font-bold leading-tight text-ink">Your garden</p>
                  <p className="mt-0.5 text-xs font-semibold text-ink-muted">
                    {speciesGrown === 0
                      ? "No species planted yet"
                      : `${speciesGrown} species grown`}
                  </p>
                </div>
                <Link
                  href="/garden"
                  className="min-h-11 shrink-0 rounded-full px-3.5 py-2.5 text-sm font-bold text-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-95"
                  style={{ background: "color-mix(in srgb, var(--accent-green) 14%, var(--bg-panel))" }}
                >
                  Visit garden
                </Link>
              </div>
              <MiniShelf
                items={shelfItems.slice(0, 8).map((plant) => ({
                  src: plant.image,
                  alt: plant.name,
                  count: plant.count
                }))}
                emptyHint="Buy plants in the shop"
              />
            </div>

            {/* Companion bubble */}
            <div
              className="flex flex-col gap-3 rounded-[0.875rem] p-3.5"
              style={{
                background:
                  typeof activePet === "object" && activePet
                    ? "color-mix(in srgb, var(--accent-blue) 6%, var(--bg-panel))"
                    : "color-mix(in srgb, var(--text-accent) 6%, var(--bg-panel))",
                border:
                  typeof activePet === "object" && activePet
                    ? "1px solid color-mix(in srgb, var(--accent-blue) 20%, var(--border-default))"
                    : "1px dashed color-mix(in srgb, var(--text-accent) 30%, var(--border-default))"
              }}
            >
              {activePet ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface"
                      >
                        <Image
                          src={activePetImage ?? "/images/pets/cat.png"}
                          alt={`${activePet.name} portrait`}
                          width={44}
                          height={44}
                          sizes="44px"
                          className="h-full w-full object-cover"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-serif text-base font-bold leading-tight text-ink" title={activePet.name}>
                          {activePet.name}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-ink-muted">Bond {activePetBond}%</p>
                      </div>
                    </div>
                    <Link
                      href="/pets"
                      className="min-h-11 shrink-0 rounded-full px-3.5 py-2.5 text-sm font-bold text-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-95"
                      style={{ background: "color-mix(in srgb, var(--accent-blue) 14%, var(--bg-panel))" }}
                    >
                      Visit pets
                    </Link>
                  </div>
                  <p className="text-xs leading-5 text-ink-muted">
                    Completing daily quests grows your companion&apos;s bond — a cared-for pet can find bonus XP during missions.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-serif text-base font-bold leading-tight text-ink">No companion yet</p>
                      <p className="mt-0.5 text-xs font-semibold text-ink-muted">Eggs from chests hatch into pets</p>
                    </div>
                    <Link
                      href="/pets"
                      className="min-h-11 shrink-0 rounded-full px-3.5 py-2.5 text-sm font-bold text-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-95"
                      style={{ background: "color-mix(in srgb, var(--text-accent) 12%, var(--bg-panel))" }}
                    >
                      Visit pets
                    </Link>
                  </div>
                  <p className="text-xs leading-5 text-ink-muted">
                    Open a chest to find a species egg, wait for the hatch, then raise your first companion.
                  </p>
                </>
              )}
            </div>
          </div>
        </Panel>
      </StaggerItem>

      {/* ── 5. Impact line ──────────────────────────────────────────── */}
      <StaggerItem as="section">
        <div
          className="fg-panel-alt flex items-center gap-3 p-4"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "color-mix(in srgb, var(--accent-teal) 14%, var(--bg-panel))",
              color: "var(--accent-teal-text)"
            }}
            aria-hidden="true"
          >
            <Smartphone className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <p className="min-w-0 text-sm leading-6 text-ink-soft">
            {carbonReduced > 0 ? (
              <>
                <strong className="font-serif text-base font-bold text-ink">
                  {carbonReduced.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂
                </strong>{" "}
                cut so far — about{" "}
                <span className="font-bold" style={{ color: "var(--accent-teal-text)" }}>
                  {phoneCharges.toLocaleString()} phone charge{phoneCharges === 1 ? "" : "s"}
                </span>{" "}
                worth of energy saved.
              </>
            ) : (
              <>
                <strong className="font-serif text-base font-bold text-ink">Your impact tally starts today</strong>{" "}
                — every verified mission logs real CO₂ savings here.
              </>
            )}
          </p>
        </div>
      </StaggerItem>

      {/* ── 6. Quest progress (kept, demoted to a slim chip row) ────── */}
      <StaggerItem as="section">
        <Panel title="Quest progress">
          <div className="flex flex-wrap items-center gap-2">
            {categoryProgress.map(({ name, done, total }) => {
              const accent = accentForCategory(name);
              return (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-ink"
                  style={{
                    background: `color-mix(in srgb, ${accent} 10%, var(--bg-panel))`,
                    border: "1px solid color-mix(in srgb, var(--border-default))"
                  }}
                >
                  <CategoryIcon name={name} color={accent} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{name}</span>
                  <span className="font-extrabold" style={{ color: accentInkForCategory(name) }}>{done}/{total}</span>
                </span>
              );
            })}
          </div>
        </Panel>
      </StaggerItem>

      {/* ── Streak reward popup — fires on login when /api/streak/apply grants
          a milestone. The streak progress panel itself lives on the Insights
          page; this popup is just the "you earned a streak reward"
          notification, so it stays on the home page. */}
      {streakReward && (
        <Dialog
          open
          onClose={() => setStreakReward(null)}
          size="sm"
          labelledby="streak-reward-title"
          footer={<button type="button" onClick={() => setStreakReward(null)} className={`w-full ${primaryButton}`}>Claim & Continue</button>}
        >
          <div
            className="relative overflow-hidden rounded-[1.25rem] border border-line px-5 py-9 text-center"
            style={{ background: "color-mix(in srgb, var(--accent-gold) 7%, var(--bg-panel))" }}
          >
            <RewardGlow />
            <div className="relative flex flex-col items-center">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--accent-gold) 16%, var(--bg-panel))",
                  border: "1px solid color-mix(in srgb, var(--accent-gold) 30%, var(--border-default))",
                  color: "var(--accent-gold-text)"
                }}
                aria-hidden="true"
              >
                <Flame className="h-7 w-7" strokeWidth={2.1} />
              </span>
              <h3 id="streak-reward-title" className="mt-4 font-serif text-2xl font-bold text-ink">Streak reward!</h3>
              <p className="mt-2 text-sm font-semibold text-ink-muted">{streakReward.label}</p>
            </div>
          </div>
        </Dialog>
      )}

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
          labelledby="proof-dialog-title"
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
              <p className="text-overline text-ink-muted">Quest verification</p>
              <h3 id="proof-dialog-title" className="mt-1 font-serif text-xl font-bold text-ink">Verify proof for: {activeTextVerifyQuest.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
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
                { value: "text", label: "Text proof" },
                { value: "photo", label: "Photo proof" }
              ]}
            />

            {proofType === "text" ? (
              <div>
                <label htmlFor="quest-text-proof" className="mb-1.5 block text-overline text-ink-muted">
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
                <p className={`mt-1 text-right text-xs font-bold ${textProof.trim().length >= 8 ? "text-accent" : "text-status-danger"}`}>
                  {textProof.trim().length}/8 min characters
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="block text-overline text-ink-muted">
                  Upload a photo showing quest completion
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById("quest-photo-camera")?.click()}
                    className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-input border border-line bg-surface-alt py-3 text-xs font-bold text-ink transition hover:bg-surface active:scale-[0.98]"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById("quest-photo-gallery")?.click()}
                    className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-input border border-line bg-surface-alt py-3 text-xs font-bold text-ink transition hover:bg-surface active:scale-[0.98]"
                  >
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    Gallery
                  </button>
                  {photoFile && (
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                      className="chip-danger rounded-input min-h-11 px-4 py-3 text-xs font-bold transition active:scale-[0.98]"
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
                  <div className="overflow-hidden rounded-card border border-line-soft bg-surface-alt p-2 text-center">
                    <Image
                      src={photoPreview}
                      alt="Preview"
                      unoptimized
                      width={320}
                      height={160}
                      sizes="(max-width: 420px) 100vw, 320px"
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

      {/* ── Completion popup → celebratory reward card ── */}
      {completedPopup && (
        <Dialog
          open
          onClose={() => setCompletedPopup(null)}
          size="lg"
          labelledby="completion-popup-title"
          footer={<button type="button" onClick={() => setCompletedPopup(null)} className={secondaryButton}>Close</button>}
        >
          <div
            className="relative overflow-hidden rounded-[1.25rem] border border-line px-5 py-9 text-center"
            style={{ background: "color-mix(in srgb, var(--accent-gold) 6%, var(--bg-panel))" }}
          >
            <RewardGlow />
            <div className="relative flex flex-col items-center">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full shadow-elev-2"
                style={{ background: "var(--accent-green)", color: "var(--text-sidebar)" }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5 L9.5 18 L20 6.5" />
                </svg>
              </span>
              <h3 id="completion-popup-title" className="mt-3 font-serif text-2xl font-bold text-ink">Mission complete!</h3>
              {completedToday > 0 && (
                <>
                  <p className="mt-1 text-xs font-semibold text-ink-muted">Today&apos;s haul so far</p>
                  <p className="mt-1 font-serif text-4xl font-bold leading-none text-ink">
                    <AnimatedNumber value={todayHaul.xp} startFrom={0} duration={900} />
                    <span className="ml-1.5 align-middle text-sm font-bold text-accent">XP</span>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    <span className="fg-chip fg-chip-xp">+{todayHaul.xp.toLocaleString()} XP</span>
                    <span className="fg-chip fg-chip-coins">+{todayHaul.eco.toLocaleString()} EP</span>
                    <span className="fg-chip fg-chip-carbon">
                      −{todayHaul.carbon.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂
                    </span>
                  </div>
                </>
              )}
              <p className="mt-4 text-sm leading-6 text-ink-muted">{completedPopup}</p>
            </div>
          </div>
        </Dialog>
      )}
    </StaggerContainer>
  );
}
