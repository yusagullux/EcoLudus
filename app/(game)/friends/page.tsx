"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Check, Heart, HeartHandshake, Sparkles, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import { getAllUsers } from "@/lib/auth-client";
import { PageHeader, Panel, Pill, ProgressBar, RankMedallion, primaryButton, secondaryButton, inputClass } from "@/components/game-ui";
import { RowListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/avatar";
import { StaggerContainer, StaggerItem, AnimatedNumber } from "@/lib/animations";

function friendKey(friend: any) {
  return friend?.id || friend?.uid || friend?.email;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getClaimedSocialRewards(profile: any) {
  return Array.isArray(profile?.claimedSocialRewards) ? profile.claimedSocialRewards : [];
}

function getSocialStats(profile: any) {
  return {
    cheersGiven: Number(profile?.socialStats?.cheersGiven ?? 0),
    cheersToday: Number(profile?.socialStats?.cheersToday ?? 0),
    lastCheerDate: String(profile?.socialStats?.lastCheerDate ?? "")
  };
}

const SOCIAL_QUESTS = [
  {
    id: "first_friend",
    title: "Add your first friend",
    description: "Build your social garden by adding one player.",
    target: 1,
    metric: "friends",
    xp: 35,
    eco: 20
  },
  {
    id: "give_three_cheers",
    title: "Give 3 cheers",
    description: "Encourage friends three times.",
    target: 3,
    metric: "cheersGiven",
    xp: 55,
    eco: 30
  },
  {
    id: "squad_of_five",
    title: "Form a squad of 5",
    description: "Add five friends to unlock a bigger social bonus.",
    target: 5,
    metric: "friends",
    xp: 100,
    eco: 75
  }
];

// Friendly glyph per challenge card (display-only — progress math is unchanged).
const CHALLENGE_ICONS: Record<string, typeof UserPlus> = {
  first_friend: UserPlus,
  give_three_cheers: HeartHandshake,
  squad_of_five: Users
};

// One-page shared ghost button: quiet text on hover, keeps 44px target.
// Accept stays the filled primary — the pair must read as distinct actions.
const ghostButton =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-transparent px-4 text-sm font-bold text-ink-muted transition hover:bg-surface-alt hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent";

// Heart-burst cheer button: a round 44px icon button that pops when a cheer
// goes out. Cap spent → spent wash, no pop (display only; the cap itself is
// owned by the server + the existing cheerFriend handler).
function CheerButton({
  onCheer,
  name = "friend",
  disabled = false,
  active = false
}: {
  onCheer: () => void;
  /** Friend name for the accessible label. */
  name?: string;
  disabled?: boolean;
  active?: boolean;
}) {
  const reduced = useReducedMotion();
  const bursting = active && !reduced;

  return (
    <motion.button
      type="button"
      onClick={onCheer}
      animate={bursting ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      disabled={disabled}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${active ? "animate-pulse" : ""}`}
      style={
        disabled
          ? { background: "var(--bg-panel-alt)", border: "1px solid var(--border-subtle)" }
          : {
              background: "color-mix(in srgb, var(--accent-gold) 14%, var(--bg-panel))",
              border: "1px solid color-mix(in srgb, var(--accent-gold) 30%, var(--border-default))"
            }
      }
      aria-label={disabled ? `Daily cheer limit reached — no cheers left for ${name}` : `Cheer ${name}`}
      title={disabled ? "Daily cheer limit reached" : "Send a cheer"}
    >
      <Heart
        className={`h-[1.15rem] w-[1.15rem] ${disabled ? "" : "fill-current"}`}
        strokeWidth={2.2}
        style={{ color: disabled ? "var(--text-muted)" : "var(--accent-gold-text)" }}
      />
    </motion.button>
  );
}

// Friendly small character card for a (candidate) player row.
function PlayerStrip({
  id,
  name,
  image,
  level,
  xp,
  caption,
  action
}: {
  id: string;
  name: string;
  image?: string | null;
  level?: number;
  xp?: number;
  caption?: string;
  action?: ReactNode;
}) {
  return (
    <article className="flex items-center gap-3 rounded-[1rem] border border-line bg-surface-alt p-3.5">
      <Link href={`/profile/${id}`} className="group flex min-w-0 flex-1 items-center gap-3">
        <div className="relative shrink-0">
          <Avatar name={name || "Eco Explorer"} src={image} size={44} />
          {typeof level === "number" && level > 0 && (
            <span
              className="absolute -bottom-1 -right-1 flex h-5 items-center justify-center rounded-full px-1 font-serif text-[0.625rem] font-extrabold leading-none text-ink"
              style={{ background: "var(--bg-panel)", border: "1px solid var(--border-default)" }}
              aria-label={`Level ${level}`}
            >
              {level}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p
            className="truncate font-serif text-[0.9375rem] font-bold text-ink transition-colors group-hover:text-accent"
            title={name}
          >
            {name}
          </p>
          {caption && <p className="truncate text-xs font-semibold text-ink-muted">{caption}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {typeof level === "number" && level > 0 && (
              <span className="fg-chip fg-chip-xp">Lv {level}</span>
            )}
            {typeof xp === "number" && xp > 0 && (
              <Pill>{xp.toLocaleString()} XP</Pill>
            )}
          </div>
        </div>
      </Link>
      {action && <div className="shrink-0">{action}</div>}
    </article>
  );
}

// Compact meta strip cell (the page's only stat row — 3 max before content).
// Module-scope so React reconciles instead of remounting these cells on every
// parent re-render (component-body declaration restarted their AnimatedNumber
// count-up on each search keystroke).
function MetaStat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 px-1 text-center sm:text-left" title={hint}>
      <p className="text-micro leading-tight text-ink-muted">{label}</p>
      <p className="mt-0.5 font-serif text-xl font-bold leading-none text-ink">{value}</p>
    </div>
  );
}

export default function FriendsPage() {
  const { user, profile, setProfile, refreshProfile } = useAuth();
  const toast = useToast();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  // Tracks which friend is currently being cheered to prevent concurrent submissions.
  const cheeringRef = useRef<string | null>(null);
  const [cheeringId, setCheeringId] = useState<string | null>(null);
  // Tracks which player id has an in-flight add/accept/decline so we can show a
  // loading state on just that button (and block double-submits).
  const [busyId, setBusyId] = useState<string | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<any | null>(null);

  const friends = useMemo(() => Array.isArray(profile?.friends) ? profile.friends : [], [profile]);
  const socialStats = getSocialStats(profile);
  const claimedSocialRewards = getClaimedSocialRewards(profile);

  const friendRequests = Array.isArray(profile?.friendRequests) ? profile.friendRequests : [];
  const sentRequests = Array.isArray(profile?.sentRequests) ? profile.sentRequests : [];
  const friendRequestsSet = new Set(friendRequests.map((r: any) => r.id || r.uid));
  const sentRequestsSet = new Set(sentRequests);

  // setProfile is recreated each render from context; keep a ref so the refresh
  // effect below can depend only on stable data rather than an unstable callback.
  const setProfileRef = useRef(setProfile);
  useEffect(() => {
    setProfileRef.current = setProfile;
  }, [setProfile]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayers() {
      if (!user?.uid) {
        if (!cancelled) setLoading(false);
        return;
      }
      setLoading(true);
      const result = await getAllUsers();
      if (!cancelled) {
        setPlayers(result.success ? result.data || [] : []);
        setLoading(false);
      }
    }

    loadPlayers();
    return () => { cancelled = true; };
  }, [user?.uid]);

  // Refresh stale XP/level snapshots stored in profile.friends using live data.
  // We only write back when values actually changed to avoid unnecessary saves.
  useEffect(() => {
    if (players.length === 0 || !profile || !user?.uid) return;

    const currentFriends: any[] = Array.isArray(profile?.friends) ? profile.friends : [];
    const liveMap = new Map(players.map((p: any) => [p.id, p]));
    const refreshed = currentFriends.map((f: any) => {
      const live = liveMap.get(f.id || f.uid);
      if (!live) return f;
      return {
        ...f,
        displayName: live.displayName ?? f.displayName,
        xp: Number(live.xp ?? f.xp ?? 0),
        level: Number(live.level ?? f.level ?? 1),
        ecoPoints: Number(live.ecoPoints ?? f.ecoPoints ?? 0)
      };
    });

    const changed = refreshed.some((r: any, i: number) =>
      r.xp !== currentFriends[i]?.xp || r.level !== currentFriends[i]?.level
    );
    if (changed && typeof setProfileRef.current === "function") {
      setProfileRef.current({ ...profile, friends: refreshed });
    }
  }, [players, profile, user?.uid]);

  const candidates = useMemo(() => {
    const friendIds = new Set(friends.map(friendKey));
    const normalized = query.trim().toLowerCase();
    const filtered = players
      .filter((player) => player.id !== user?.uid)
      .filter((player) => !friendIds.has(player.id))
      .filter((player) => {
        if (!normalized) return true;
        return String(player.displayName || "").toLowerCase().includes(normalized)
          || String(player.id || "").toLowerCase().includes(normalized);
      });
    // When the search box is empty, surface 3 "recommended" players — highest
    // XP first — so the section reads as a suggestion list rather than a dump
    // of everyone. When searching, keep up to 8 matches.
    if (!normalized) {
      return filtered
        .slice()
        .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0))
        .slice(0, 3);
    }
    return filtered.slice(0, 8);
  }, [players, query, user?.uid, friends]);

  const sendFriendRequest = async (player: any) => {
    if (!user?.uid || !profile || busyId) return;
    setBusyId(player.id);

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "request", targetUserId: player.id })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error?.message || (typeof data.error === "string" ? data.error : "Could not send friend request."));
        return;
      }

      // The API may auto-accept if the target already sent us a request
      if (data.message === "Friend request accepted") {
        toast.success(`You and ${player.displayName || "player"} are now friends!`);
        void refreshProfile();
      } else {
        const nextSent = [...sentRequests, player.id];
        if (typeof setProfile === "function") {
          setProfile({ ...profile, sentRequests: nextSent });
        }
        toast.success(`Friend request sent to ${player.displayName || "player"}.`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not send friend request.");
    } finally {
      setBusyId(null);
    }
  };

  const acceptFriendRequest = async (request: any) => {
    if (!user?.uid || !profile || busyId) return;
    const id = request.id || request.uid;
    setBusyId(id);

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "accept", targetUserId: id })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error?.message || (typeof data.error === "string" ? data.error : "Could not accept friend request."));
        return;
      }

      // Refresh the full profile from server to get clean state
      toast.success(`Accepted friend request from ${request.displayName || "player"}.`);
      void refreshProfile();
    } catch (err) {
      console.error(err);
      toast.error("Could not accept friend request.");
    } finally {
      setBusyId(null);
    }
  };

  const declineFriendRequest = async (request: any) => {
    if (!user?.uid || !profile || busyId) return;
    const id = request.id || request.uid;
    setBusyId(id);

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "decline", targetUserId: id })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error?.message || (typeof data.error === "string" ? data.error : "Could not decline friend request."));
        return;
      }

      const nextRequests = friendRequests.filter((r: any) => (r.id || r.uid) !== id);
      const nextSent = sentRequests.filter((sid) => sid !== id);
      if (typeof setProfile === "function") {
        setProfile({ ...profile, friendRequests: nextRequests, sentRequests: nextSent });
      }
      toast.show(`Declined friend request from ${request.displayName || "player"}.`);
    } catch (err) {
      console.error(err);
      toast.error("Could not decline friend request.");
    } finally {
      setBusyId(null);
    }
  };

  const cheerFriend = async (friend: any) => {
    if (!user?.uid || !profile) return;
    const key = friendKey(friend);

    // In-flight guard — prevents spamming before the async round-trip completes.
    if (cheeringRef.current !== null) return;
    cheeringRef.current = key;
    setCheeringId(key);

    try {
      // The cap, the friend-relationship check, the XP/eco grant, and the
      // one-shot Impact to both users are all owned by the server route.
      const res = await fetch("/api/friends/cheer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: friend.id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error?.message || "Could not send cheer. Please try again.");
        return;
      }
      toast.success(`Cheered ${friend.displayName || "friend"}: +${data.xpAwarded} XP, +${data.ecoAwarded} Eco.`);
      void refreshProfile();
    } finally {
      cheeringRef.current = null;
      setCheeringId(null);
    }
  };

  const claimSocialQuest = async (quest: any, progress: number) => {
    if (!user?.uid || !profile || progress < quest.target || claimedSocialRewards.includes(quest.id)) return;

    // The progress check, re-claim guard, and reward grant are owned by the
    // server so they can't be forged. The route re-derives progress from
    // stored state (cheersGiven / friends count).
    const res = await fetch("/api/friends/claim-quest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId: quest.id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      toast.error(data?.error?.message || "Could not claim reward. Please try again.");
      return;
    }
    toast.success(`${quest.title} claimed: +${data.xpAwarded} XP, +${data.ecoAwarded} Eco.`);
    void refreshProfile();
  };

  const removeFriend = async (friend: any) => {
    if (!user?.uid || !profile) return;

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "remove", targetUserId: friendKey(friend) })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error?.message || (typeof data.error === "string" ? data.error : "Could not remove friend."));
        return;
      }

      // Refresh full profile for clean state (server also cleans stale request artifacts)
      toast.show("Friend removed.");
      void refreshProfile();
    } catch (err) {
      console.error(err);
      toast.error("Could not remove friend.");
    } finally {
      setFriendToRemove(null);
    }
  };

  const myXp = Number(profile?.xp ?? 0);
  const myLevel = Number(profile?.level ?? 1);
  const myEcoPoints = Number(profile?.ecoPoints ?? 0);
  const averageFriendLevel = friends.length
    ? Math.round(friends.reduce((sum, friend) => sum + Number(friend.level || 1), 0) / friends.length)
    : 0;
  // Derived from current render of profile — safe to use for display only (not for cap logic in the handler).
  const cheersTodayDisplay = socialStats.lastCheerDate === todayKey() ? socialStats.cheersToday : 0;

  return (
    <StaggerContainer className="flex flex-col gap-5 overflow-x-hidden" as="div">
      <StaggerItem as="div">
        <PageHeader
          title="Friends"
          description="Add players, send cheers, and complete social challenges that turn encouragement into progress."
        />
      </StaggerItem>

      {/* One compact meta strip (replaces the old stat wall) */}
      <StaggerItem as="div">
        <div className="flex items-center justify-between gap-2 rounded-[1.25rem] border border-line-soft bg-surface-alt px-4 py-4 sm:px-6">
          <MetaStat label="Friends" value={<AnimatedNumber value={friends.length} />} />
          <div className="h-8 w-px bg-line-soft" aria-hidden="true" />
          <MetaStat label="Cheers given" value={<AnimatedNumber value={socialStats.cheersGiven} />} />
          <div className="h-8 w-px bg-line-soft" aria-hidden="true" />
          <MetaStat
            label="Cheers today"
            value={<AnimatedNumber value={cheersTodayDisplay} />}
            hint={`${cheersTodayDisplay} of 5 daily cheers used`}
          />
          <div className="hidden sm:block sm:h-8 sm:w-px sm:bg-line-soft" aria-hidden="true" />
          {/* 4th cell folds away on phones — keeps the strip under 3 stats above the fold */}
          <div className="hidden sm:block min-w-0">
            <MetaStat label="Your level" value={myLevel} hint={`Level ${myLevel} — ahead of an average friend level of ${averageFriendLevel}`} />
          </div>
        </div>
      </StaggerItem>

      <StaggerItem as="section">
        <Panel eyebrow="Social quests" title="Friend challenges">
          <div className="grid gap-3 lg:grid-cols-3">
            {SOCIAL_QUESTS.map((quest) => {
              const progress = quest.metric === "friends" ? friends.length : socialStats.cheersGiven;
              const pct = Math.min(100, Math.round((progress / quest.target) * 100));
              const claimed = claimedSocialRewards.includes(quest.id);
              const ready = progress >= quest.target && !claimed;
              const Icon = CHALLENGE_ICONS[quest.id] ?? Sparkles;
              return (
                <article key={quest.id} className="relative flex flex-col rounded-[1.25rem] border border-line bg-surface-alt p-4">
                  {claimed && (
                    <span
                      className="fg-stamp absolute right-3 top-3 h-11 w-11 text-[0.55rem]"
                      style={{
                        transform: "rotate(-10deg)",
                        borderColor: "color-mix(in srgb, var(--accent-green) 55%, var(--border-default))",
                        color: "var(--accent-green-text)"
                      }}
                      aria-hidden="true"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      Claimed
                    </span>
                  )}
                  <div className="flex items-start gap-3 pe-14">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.875rem]"
                      style={{
                        background: "color-mix(in srgb, var(--accent-violet) 14%, var(--bg-panel))",
                        color: "var(--accent-violet-text)"
                      }}
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-serif text-base font-extrabold leading-tight text-ink">{quest.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{quest.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <ProgressBar value={pct} color={claimed ? "var(--accent-green)" : "var(--text-accent)"} />
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted">
                      <span className="font-serif text-sm font-extrabold text-ink">{Math.min(progress, quest.target)}</span>
                      /{quest.target}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => claimSocialQuest(quest, progress)}
                    className={`mt-4 w-full ${ready ? primaryButton : secondaryButton}`}
                  >
                    {claimed ? "Reward claimed" : ready ? `Claim +${quest.xp} XP` : `Reward: +${quest.xp} XP`}
                  </button>
                </article>
              );
            })}
          </div>
        </Panel>
      </StaggerItem>

      {friendRequests.length > 0 && (
        <StaggerItem as="section">
          <Panel eyebrow="Pending connections" title="Friend requests">
            <div className="grid gap-3 sm:grid-cols-2">
              {friendRequests.map((req: any) => (
                <article
                  key={req.id || req.uid}
                  className="flex flex-col gap-3 rounded-[1rem] border border-line bg-surface-alt p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <Link href={`/profile/${req.id || req.uid}`} className="group flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={req.displayName || "Anonymous"} src={req.profileImage} size={44} />
                    <div className="min-w-0">
                      <p
                        className="truncate font-serif text-[0.9375rem] font-bold text-ink transition-colors group-hover:text-accent"
                        title={req.displayName || "Anonymous"}
                      >
                        {req.displayName || "Anonymous"}
                      </p>
                      <p className="text-xs font-semibold text-ink-muted">Wants to add you</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="fg-chip fg-chip-xp">Lv {req.level || 1}</span>
                        <Pill>{Number(req.xp || 0).toLocaleString()} XP</Pill>
                      </div>
                    </div>
                  </Link>
                  <div className="grid grid-cols-2 gap-2 shrink-0 sm:flex sm:w-auto">
                    <button
                      type="button"
                      onClick={() => acceptFriendRequest(req)}
                      disabled={busyId === (req.id || req.uid)}
                      className={`w-full sm:w-auto ${primaryButton}`}
                    >
                      {busyId === (req.id || req.uid) ? "Accepting…" : "Accept"}
                    </button>
                    <button
                      type="button"
                      onClick={() => declineFriendRequest(req)}
                      disabled={busyId === (req.id || req.uid)}
                      className={`w-full sm:w-auto ${ghostButton}`}
                    >
                      {busyId === (req.id || req.uid) ? "Declining…" : "Decline"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </StaggerItem>
      )}

      <StaggerItem as="section">
        <Panel id="find-players" eyebrow={query.trim() ? "Search results" : "Recommended"} title="Find players">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={`${inputClass} pr-12`}
                placeholder="Search by name or email"
                aria-label="Search by name or email"
              />
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X className="h-4 w-4" strokeWidth={2.2} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {loading ? (
              <div className="col-span-full"><RowListSkeleton rows={4} variant="avatar" /></div>
            ) : candidates.length > 0 ? (
              candidates.map((player) => {
                const isSent = sentRequestsSet.has(player.id);
                const isIncoming = friendRequestsSet.has(player.id);

                return (
                  <PlayerStrip
                    key={player.id}
                    id={player.id}
                    name={player.displayName || "Eco Explorer"}
                    image={player.profileImage}
                    level={Number(player.level || 1)}
                    xp={Number(player.xp || 0)}
                    caption="EcoLudus player"
                    action={
                      isSent ? (
                        <button type="button" disabled className={secondaryButton}>
                          <span className="inline-flex items-center gap-1.5">
                            <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" /> Sent
                          </span>
                        </button>
                      ) : isIncoming ? (
                        <button
                          type="button"
                          onClick={() => acceptFriendRequest(player)}
                          disabled={busyId === player.id}
                          className={primaryButton}
                        >
                          {busyId === player.id ? "Accepting…" : "Accept"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sendFriendRequest(player)}
                          disabled={busyId === player.id}
                          className={primaryButton}
                        >
                          {busyId === player.id ? "Sending…" : "Add"}
                        </button>
                      )
                    }
                  />
                );
              })
            ) : (
              <div className="col-span-full">
                <EmptyState
                  variant="plain"
                  title={query.trim() ? "No matching players found." : "No other players to recommend yet — check back soon!"}
                />
              </div>
            )}
          </div>
        </Panel>
      </StaggerItem>

      <StaggerItem as="section">
        <Panel eyebrow="Your circle" title="Friend board">
          {friends.length === 0 ? (
            <EmptyState
              variant="card"
              icon={<UserPlus className="h-8 w-8" strokeWidth={2} />}
              title="No friends yet"
              description="Add fellow players to compare stats, send cheers, and complete social quests together."
              action={<Link href="/friends#find-players" className={primaryButton}>Find players to add</Link>}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {friends
                .slice()
                .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0))
                .map((friend, index) => {
                  const cheers = Number(friend.cheers || 0);
                  return (
                    <article
                      key={friendKey(friend)}
                      className="flex flex-col gap-3 rounded-[1.25rem] border border-line bg-surface-alt p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <RankMedallion rank={index + 1} size={36} />
                        <Link href={`/profile/${friendKey(friend)}`} className="group flex min-w-0 flex-1 items-center gap-3">
                          <Avatar
                            name={friend.displayName || friend.email || "Eco Explorer"}
                            src={friend.profileImage}
                            size={44}
                          />
                          <div className="min-w-0">
                            <p
                              className="truncate font-serif text-[0.9375rem] font-bold text-ink transition-colors group-hover:text-accent"
                              title={friend.displayName || friend.email}
                            >
                              {friend.displayName || friend.email}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="fg-chip fg-chip-xp">Lv {friend.level || 1}</span>
                              <Pill>{Number(friend.xp || 0).toLocaleString()} XP</Pill>
                              {cheers > 0 && (
                                <Pill>
                                  {cheers} cheer{cheers === 1 ? "" : "s"}
                                </Pill>
                              )}
                            </div>
                            <p className="mt-1 text-[0.6875rem] font-semibold text-ink-muted">
                              {Number(friend.xp || 0) <= myXp ? "You lead" : "Ahead of you"}
                            </p>
                          </div>
                        </Link>
                      </div>
                      <div className="flex items-center justify-end gap-2 ps-9">
                        <CheerButton
                          onCheer={() => cheerFriend(friend)}
                          name={friend.displayName || friend.email || "friend"}
                          disabled={cheersTodayDisplay >= 5 || cheeringId !== null}
                          active={cheeringId === friendKey(friend)}
                        />
                        <button
                          type="button"
                          onClick={() => setFriendToRemove(friend)}
                          className={ghostButton}
                          aria-label={`Remove ${(friend.displayName || friend.email || "friend") as string}`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <UserMinus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" /> Remove
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </Panel>
      </StaggerItem>

      <ConfirmDialog
        open={friendToRemove !== null}
        title="Remove friend?"
        message={`Are you sure you want to remove ${friendToRemove?.displayName || friendToRemove?.email || "this friend"} from your friends list?`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        danger
        onConfirm={() => friendToRemove && removeFriend(friendToRemove)}
        onClose={() => setFriendToRemove(null)}
      />
    </StaggerContainer>
  );
}