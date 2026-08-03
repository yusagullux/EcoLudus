// Central shared types. The most important is `UserProfile` — the shape of the
// `users.payload` jsonb blob, which holds almost all per-user game state. It is
// written by `buildInitialProfile` (signup) and grown by the lib modules
// (impact-service, private-missions, rewards-sync, trust-system, streak,
// quest-proof, document-store, the settings route). Keep this as the single
// source of truth pages and routes import from instead of `Record<string,
// unknown>`.
//
// Notes on style: the nested collections (plants, eggs, chests, hatchings,
// animals, currentDailyQuests, etc.) are deliberately typed as `unknown[]`
// here rather than fully modelled. Phase 4 task #22 types the pages that read
// them; narrowing these is left to that pass so this central type doesn't block
// on modelling every game collection up front. The scalar fields that logic
// branches on (xp, level, trustScore, impact, streak counters, dates) are
// strictly typed.

export type QuestProofMethod = "text" | "photo";

export type VerifiedQuestProof = {
  questId: string;
  method: QuestProofMethod;
  verifiedAt: string;
  resetKey: string | null;
  confidence: number;
  provider?: string | null;
  warnings?: string[];
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type TeamStats = {
  missionsCompleted: number;
  xpEarned: number;
  ecoEarned: number;
  approvalsGiven: number;
};

export type NotificationPreferences = {
  dailyReminderEnabled: boolean;
  reminderHour: number;
  teamUpdates: boolean;
  questTips: boolean;
};

export type ReminderMetadata = {
  lastReminderDate: string | null;
  pendingReminderId: string | null;
};

/** Milestone flags written by rewards-sync. Keys are `milestone_<type>_<value>`. */
export type MilestoneFlags = Partial<{
  milestone_level_5: boolean;
  milestone_level_10: boolean;
  milestone_carbon_10: boolean;
  milestone_carbon_50: boolean;
  milestone_missions_50: boolean;
  milestone_missions_100: boolean;
}>;

/**
 * The full per-user game-state object stored in `users.payload` (jsonb).
 * Field order roughly follows `buildInitialProfile` plus the late-added
 * fields grown by lib modules. All fields are optional in the type because
 * older rows / the file-store may predate some of them — readers must
 * default (e.g. `profile.trustScore ?? 50`). The signup function always
 * writes the `buildInitialProfile` baseline, so newly-created rows have
 * every baseline field.
 */
export interface UserProfile {
  // ── Identity ──────────────────────────────────────────────────────────────
  email: string;
  displayName: string;
  /** Optional avatar URL (data: URL or Supabase path). Absent until first set. */
  profileImage?: string | null;

  // ── Progression ───────────────────────────────────────────────────────────
  xp: number;
  level: number;
  ecoPoints: number;
  badges: unknown[];
  missionsCompleted: number;
  /** Quest ids (or {id, completedAt} entries) the user has ever finished. */
  completedQuests: unknown[];
  /** Today's rolled daily quest set. */
  currentDailyQuests: unknown[];
  /** Quest ids completed within the current daily window. */
  dailyQuestsCompleted: unknown[];
  questCompletionCount: Record<string, number>;
  dailyQuestCompletions: Record<string, number>;
  lastQuestResetTime: string;
  lastQuestCompletionTime: string | null;
  allQuestsCompleted: boolean;
  allQuestsCompletedCount: number;
  allQuestsCompletedDate: string | null;

  // ── Impact / carbon (unified gamification spine) ───────────────────────────
  /** Lifetime Impact — running total, ledgered in impact_events. */
  impact?: number;
  impactBySource?: Record<string, number>;
  carbonReduced?: number;
  treesPlanted?: number;

  // ── Trust (private-mission verification) ──────────────────────────────────
  trustScore?: number;
  lastPrivateMissionAt?: string | null;

  // ── Collections / pets / garden ────────────────────────────────────────────
  plants: unknown[];
  eggs: unknown[];
  chests: unknown[];
  hatchings: unknown[];
  animals: unknown[];
  activePet: string | null;
  /** Seeds dropped by chests (`{ name, rarity, image, count }`). Collection-book Pokédex reads this. */
  seeds?: unknown[];

  // ── Streaks ───────────────────────────────────────────────────────────────
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string;
  /** Day index of the last streak-milestone reward granted (anti-double-grant). */
  lastStreakRewardDay?: number;

  // ── Social / team ─────────────────────────────────────────────────────────
  friends: string[];
  bestRank: number | null;
  teamId: string | null;
  teamRole: string | null;
  teamStats: TeamStats;

  // ── Notifications & preferences ────────────────────────────────────────────
  notifications?: NotificationItem[];
  notificationPreferences: NotificationPreferences;
  reminderMetadata: ReminderMetadata;
  /** Opt-in to the weekly impact email cron. */
  emailWeeklyReport?: boolean;

  // ── Quest proof ledger (photo/text verification results per quest) ─────────
  verifiedQuestProofs?: Record<string, VerifiedQuestProof>;

  // ── Milestones (real-tree planting flags) ────────────────────────────────
  // Keys are `milestone_<type>_<value>`; each is set true once the milestone's
  // trees are planted. See lib/rewards-sync.ts MILESTONES.
  milestone_level_5?: boolean;
  milestone_level_10?: boolean;
  milestone_carbon_10?: boolean;
  milestone_carbon_50?: boolean;
  milestone_missions_50?: boolean;
  milestone_missions_100?: boolean;

  // ── Insights / misc ───────────────────────────────────────────────────────
  insightSnapshots: unknown[];
  createdAt: string;
}

/** Helper for sites that read the raw jsonb and want to narrow loosely. */
export function isUserProfile(value: unknown): value is UserProfile {
  return typeof value === "object" && value !== null && "email" in value && "xp" in value;
}