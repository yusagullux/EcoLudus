"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import { getAllUsers } from "@/lib/auth-client";
import { HeroMetric, PageHero, Panel, Pill, StatGrid, primaryButton, secondaryButton, dangerButton, inputClass, heroAccents } from "@/components/game-ui";
import { RowListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/avatar";
import { StaggerContainer, StaggerItem } from "@/lib/animations";

function friendKey(friend: any) {
  return friend?.id || friend?.uid || friend?.email;
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

export default function FriendsPage() {
  const { user, profile, setProfile, refreshProfile } = useAuth();
  const toast = useToast();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  // Tracks which friend is currently being cheered to prevent concurrent submissions.
  const cheeringRef = useRef<string | null>(null);
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
      setLoading(true);
      const result = await getAllUsers();
      if (!cancelled) {
        setPlayers(result.success ? result.data || [] : []);
        setLoading(false);
      }
    }

    loadPlayers();
    return () => { cancelled = true; };
  }, []);

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
    return players
      .filter((player) => player.id !== user?.uid)
      .filter((player) => !friendIds.has(player.id))
      .filter((player) => {
        if (!normalized) return true;
        return String(player.displayName || "").toLowerCase().includes(normalized)
          || String(player.id || "").toLowerCase().includes(normalized);
      })
      .slice(0, 8);
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
        await refreshProfile();
        toast.success(`You and ${player.displayName || "player"} are now friends!`);
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
      await refreshProfile();
      toast.success(`Accepted friend request from ${request.displayName || "player"}.`);
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
      await refreshProfile();
      toast.success(`Cheered ${friend.displayName || "friend"}: +${data.xpAwarded} XP, +${data.ecoAwarded} Eco.`);
    } finally {
      cheeringRef.current = null;
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
    await refreshProfile();
    toast.success(`${quest.title} claimed: +${data.xpAwarded} XP, +${data.ecoAwarded} Eco.`);
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
      await refreshProfile();
      toast.show("Friend removed.");
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
      <PageHero eyebrow="Social garden" title="Friends" description="Add players, send cheers, and complete social quests that turn encouragement into progress." accent={heroAccents.friends}>
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Friends" value={friends.length} />
          <HeroMetric label="Your Level" value={myLevel} />
          <HeroMetric label="Cheers" value={socialStats.cheersGiven} />
        </div>
      </PageHero>
      </StaggerItem>

      <StaggerItem as="div">
      <StatGrid
        items={[
          { label: "Your XP", value: myXp.toLocaleString(), accent: "var(--text-accent)" },
          { label: "Your EcoPoints", value: myEcoPoints.toLocaleString(), accent: "var(--text-accent)" },
          { label: "Friends Added", value: friends.length, accent: "var(--text-accent)" },
          { label: "Cheers Today", value: `${cheersTodayDisplay}/5`, accent: "var(--text-accent)" }
        ]}
      />
      </StaggerItem>

      <StaggerItem as="section">
      <Panel eyebrow="Social quests" title="Friend Challenges">
        <div className="grid gap-3 lg:grid-cols-3">
          {SOCIAL_QUESTS.map((quest) => {
            const progress = quest.metric === "friends" ? friends.length : socialStats.cheersGiven;
            const pct = Math.min(100, Math.round((progress / quest.target) * 100));
            const claimed = claimedSocialRewards.includes(quest.id);
            const ready = progress >= quest.target && !claimed;
            return (
              <article key={quest.id} className="rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-base font-bold" style={{ color: "var(--text-primary)" }}>{quest.title}</p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{quest.description}</p>
                  </div>
                  <Pill active={ready || claimed}>{claimed ? "Claimed" : `${progress}/${quest.target}`}</Pill>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--border-subtle)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ready ? "var(--text-accent)" : "var(--text-muted)" }} />
                </div>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => claimSocialQuest(quest, progress)}
                  className={`mt-4 w-full ${ready ? primaryButton : secondaryButton}`}
                >
                  {claimed ? "Reward Claimed" : ready ? `Claim +${quest.xp} XP` : `Reward: +${quest.xp} XP`}
                </button>
              </article>
            );
          })}
        </div>
      </Panel>
      </StaggerItem>

      {friendRequests.length > 0 && (
        <StaggerItem as="section">
        <Panel eyebrow="Pending connections" title="Friend Requests">
          <div className="grid gap-3 sm:grid-cols-2">
            {friendRequests.map((req: any) => (
              <article key={req.id || req.uid} className="flex items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                <Link href={`/profile/${req.id || req.uid}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
                  <Avatar name={req.displayName || "Anonymous"} src={req.profileImage} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-serif text-base font-bold" title={req.displayName || "Anonymous"} style={{ color: "var(--text-primary)" }}>{req.displayName || "Anonymous"}</p>
                    <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>Wants to add you</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill>Lv {req.level || 1}</Pill>
                      <Pill>{Number(req.xp || 0).toLocaleString()} XP</Pill>
                    </div>
                  </div>
                </Link>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => acceptFriendRequest(req)}
                    disabled={busyId === (req.id || req.uid)}
                    className={primaryButton}
                  >
                    {busyId === (req.id || req.uid) ? "Accepting…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => declineFriendRequest(req)}
                    disabled={busyId === (req.id || req.uid)}
                    className={secondaryButton}
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
      <Panel id="find-players" eyebrow="Add friends" title="Find Players">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${inputClass} pr-10`}
              placeholder="Search by name or email"
              aria-label="Search by name or email"
            />
            {query.trim() && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-sm transition hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
                aria-label="Clear search"
                title="Clear search"
              >
                ✕
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
                <article key={player.id} className="flex items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                  <Link href={`/profile/${player.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
                    <Avatar name={player.displayName} src={player.profileImage} size={44} />
                    <div className="min-w-0">
                      <p className="truncate font-serif text-base font-bold" title={player.displayName} style={{ color: "var(--text-primary)" }}>{player.displayName}</p>
                      <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>EcoLudus player</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill>Lv {player.level || 1}</Pill>
                        <Pill>{Number(player.xp || 0).toLocaleString()} XP</Pill>
                      </div>
                    </div>
                  </Link>
                  <div className="shrink-0">
                    {isSent ? (
                      <button type="button" disabled className={secondaryButton}>
                        Sent
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
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>No matching players found.</p>
          )}
        </div>
      </Panel>
      </StaggerItem>

      <StaggerItem as="section">
      <Panel eyebrow="Compare stats" title="Friend Board">
        {friends.length === 0 ? (
          <EmptyState
            variant="card"
            icon="🌱"
            title="No friends yet"
            description="Add fellow players to compare stats, send cheers, and complete social quests together."
            action={<Link href="/friends#find-players" className={primaryButton}>Find players to add</Link>}
          />
        ) : (
          <div className="flex flex-col divide-y overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-default)" }}>
            {friends
              .slice()
              .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0))
              .map((friend, index) => (
                <div key={friendKey(friend)} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel-alt)" }}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-serif text-lg font-black" style={{ background: "var(--bg-panel)", color: "var(--text-primary)" }}>
                      #{index + 1}
                    </span>
                    <Link href={`/profile/${friendKey(friend)}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                      <Avatar name={friend.displayName || friend.email || "Eco Explorer"} src={friend.profileImage} size={40} />
                      <div className="min-w-0">
                        <p className="truncate font-serif text-base font-bold" style={{ color: "var(--text-primary)" }} title={friend.displayName || friend.email}>{friend.displayName || friend.email}</p>
                        <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                          Level {friend.level || 1} - {Number(friend.xp || 0).toLocaleString()} XP - {Number(friend.cheers || 0)} cheer{Number(friend.cheers || 0) === 1 ? "" : "s"} sent
                        </p>
                      </div>
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill active={Number(friend.xp || 0) <= myXp}>{Number(friend.xp || 0) <= myXp ? "You lead" : "Ahead"}</Pill>
                    <button
                      type="button"
                      onClick={() => cheerFriend(friend)}
                      disabled={cheersTodayDisplay >= 5}
                      className={cheersTodayDisplay >= 5 ? secondaryButton : primaryButton}
                      title={cheersTodayDisplay >= 5 ? "Daily cheer limit reached" : undefined}
                    >
                      {cheersTodayDisplay >= 5 ? "Limit reached" : "Cheer"}
                    </button>
                    <button type="button" onClick={() => setFriendToRemove(friend)} className={secondaryButton}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
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
