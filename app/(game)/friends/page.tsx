// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { getAllUsers, updateUserProfile } from "@/public/js/auth.js";
import { HeroMetric, MetricCard, PageHero, Panel, Pill, primaryButton, secondaryButton, inputClass } from "@/components/game-ui";
import { calculateLevel } from "@/lib/level-system";

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
  const { user, profile, setProfile } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  // Tracks which friend is currently being cheered to prevent concurrent submissions.
  const cheeringRef = useRef<string | null>(null);

  const friends = Array.isArray(profile?.friends) ? profile.friends : [];
  const friendIds = new Set(friends.map(friendKey));
  const socialStats = getSocialStats(profile);
  const claimedSocialRewards = getClaimedSocialRewards(profile);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayers() {
      setLoading(true);
      const result = await getAllUsers();
      if (!cancelled) {
        const livePlayers: any[] = result.success ? result.data || [] : [];
        setPlayers(livePlayers);

        // Refresh stale XP/level snapshots stored in profile.friends using live data.
        // We do this in the effect so the friend board always shows current stats.
        if (livePlayers.length > 0 && profile && user?.uid) {
          const liveMap = new Map(livePlayers.map((p: any) => [p.id, p]));
          const currentFriends: any[] = Array.isArray(profile?.friends) ? profile.friends : [];
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
          // Only write back if something actually changed to avoid unnecessary saves.
          const changed = refreshed.some((r: any, i: number) =>
            r.xp !== currentFriends[i]?.xp || r.level !== currentFriends[i]?.level
          );
          if (changed && typeof setProfile === "function") {
            setProfile({ ...profile, friends: refreshed });
          }
        }

        setLoading(false);
      }
    }

    loadPlayers();
    return () => { cancelled = true; };
  }, []);

  const candidates = useMemo(() => {
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
  }, [players, query, user?.uid, friendIds]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const addFriend = async (player: any) => {
    if (!user?.uid || !profile) return;

    const nextFriends = [
      ...friends,
      {
        id: player.id,
        displayName: player.displayName,
        xp: Number(player.xp || 0),
        level: Number(player.level || 1),
        ecoPoints: Number(player.ecoPoints || 0),
        cheers: 0,
        addedAt: new Date().toISOString()
      }
    ];

    const result = await updateUserProfile(user.uid, { friends: nextFriends });
    if (!result.success) {
      showToast("Could not add friend. Please try again.");
      return;
    }

    if (typeof setProfile === "function") {
      setProfile({ ...profile, friends: nextFriends });
    }
    showToast(`${player.displayName || "Friend"} added.`);
  };

  const cheerFriend = async (friend: any) => {
    if (!user?.uid || !profile) return;
    const key = friendKey(friend);

    // In-flight guard — prevents spamming before the async round-trip completes.
    if (cheeringRef.current !== null) return;
    cheeringRef.current = key;

    try {
      // Read cheersToday fresh from the *current* profile reference rather than
      // the stale closure value captured at render time — this is what prevents
      // the rapid-click bypass.
      const currentSocialStats = getSocialStats(profile);
      const today = todayKey();
      const sameDay = currentSocialStats.lastCheerDate === today;
      const cheersToday = sameDay ? currentSocialStats.cheersToday : 0;

      if (cheersToday >= 5) {
        showToast("Daily cheer limit reached. Come back tomorrow.");
        return;
      }

      const nextFriends = friends.map((item) => {
        if (friendKey(item) !== key) return item;
        return {
          ...item,
          cheers: Number(item.cheers ?? 0) + 1,
          lastCheeredAt: new Date().toISOString()
        };
      });
      const xpReward = 10;
      const ecoReward = 3;
      const nextXp = Number(profile.xp ?? 0) + xpReward;
      const updates = {
        friends: nextFriends,
        xp: nextXp,
        level: calculateLevel(nextXp),
        ecoPoints: Number(profile.ecoPoints ?? 0) + ecoReward,
        socialStats: {
          ...profile.socialStats,
          cheersGiven: currentSocialStats.cheersGiven + 1,
          cheersToday: cheersToday + 1,
          lastCheerDate: today
        }
      };

      const result = await updateUserProfile(user.uid, updates);
      if (!result.success) {
        showToast("Could not send cheer. Please try again.");
        return;
      }
      if (typeof setProfile === "function") {
        setProfile({ ...profile, ...updates });
      }
      showToast(`Cheered ${friend.displayName || "friend"}: +${xpReward} XP, +${ecoReward} Eco.`);
    } finally {
      cheeringRef.current = null;
    }
  };

  const claimSocialQuest = async (quest: any, progress: number) => {
    if (!user?.uid || !profile || progress < quest.target || claimedSocialRewards.includes(quest.id)) return;
    const nextClaimed = [...claimedSocialRewards, quest.id];
    const nextXp = Number(profile.xp ?? 0) + quest.xp;
    const updates = {
      claimedSocialRewards: nextClaimed,
      xp: nextXp,
      level: calculateLevel(nextXp),
      ecoPoints: Number(profile.ecoPoints ?? 0) + quest.eco
    };

    const result = await updateUserProfile(user.uid, updates);
    if (!result.success) {
      showToast("Could not claim reward. Please try again.");
      return;
    }
    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...updates });
    }
    showToast(`${quest.title} claimed: +${quest.xp} XP, +${quest.eco} Eco.`);
  };

  const removeFriend = async (friend: any) => {
    if (!user?.uid || !profile) return;
    const nextFriends = friends.filter((item) => friendKey(item) !== friendKey(friend));
    const result = await updateUserProfile(user.uid, { friends: nextFriends });
    if (!result.success) {
      showToast("Could not remove friend. Please try again.");
      return;
    }
    if (typeof setProfile === "function") {
      setProfile({ ...profile, friends: nextFriends });
    }
    showToast("Friend removed.");
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
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Social garden" title="Friends" description="Add players, send cheers, and complete social quests that turn encouragement into progress.">
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Friends" value={friends.length} />
          <HeroMetric label="Your Level" value={myLevel} />
          <HeroMetric label="Cheers" value={socialStats.cheersGiven} />
        </div>
      </PageHero>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Your XP" value={myXp.toLocaleString()} accent="#2f6b46" />
        <MetricCard label="Your EcoPoints" value={myEcoPoints.toLocaleString()} accent="#9a6b1f" />
        <MetricCard label="Friends Added" value={friends.length} accent="#2f5f86" />
        <MetricCard label="Cheers Today" value={`${cheersTodayDisplay}/5`} accent="#62508f" />
      </div>

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
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ready ? "#9a6b1f" : "#2f6b46" }} />
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

      <Panel eyebrow="Add friends" title="Find Players">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass}
            placeholder="Search by name or email"
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {loading ? (
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Loading players...</p>
          ) : candidates.length > 0 ? (
            candidates.map((player) => (
              <article key={player.id} className="flex items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                <div className="min-w-0">
                  <p className="truncate font-serif text-base font-bold" style={{ color: "var(--text-primary)" }}>{player.displayName}</p>
                  <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>EcoLudus player</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill>Lv {player.level || 1}</Pill>
                    <Pill>{Number(player.xp || 0).toLocaleString()} XP</Pill>
                  </div>
                </div>
                <button type="button" onClick={() => addFriend(player)} className={primaryButton}>
                  Add
                </button>
              </article>
            ))
          ) : (
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>No matching players found.</p>
          )}
        </div>
      </Panel>

      <Panel eyebrow="Compare stats" title="Friend Board">
        {friends.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
            <p className="font-serif text-xl font-bold" style={{ color: "var(--text-primary)" }}>No friends yet</p>
            <p className="mt-1 text-sm">Search above to build your friend board.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-default)" }}>
            {friends
              .slice()
              .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0))
              .map((friend, index) => (
                <div key={friendKey(friend)} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel-alt)" }}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl font-serif text-lg font-black" style={{ background: "var(--bg-panel)", color: "var(--text-primary)" }}>
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-serif text-base font-bold" style={{ color: "var(--text-primary)" }}>{friend.displayName || friend.email}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Level {friend.level || 1} - {Number(friend.xp || 0).toLocaleString()} XP - {Number(friend.cheers || 0)} cheers sent
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Pill active={Number(friend.xp || 0) <= myXp}>{Number(friend.xp || 0) <= myXp ? "You lead" : "Ahead"}</Pill>
                    <button
                      type="button"
                      onClick={() => cheerFriend(friend)}
                      disabled={cheersTodayDisplay >= 5}
                      className={primaryButton}
                      title={cheersTodayDisplay >= 5 ? "Daily cheer limit reached" : undefined}
                    >
                      Cheer
                    </button>
                    <button type="button" onClick={() => removeFriend(friend)} className={secondaryButton}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Panel>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl" style={{ background: "var(--bg-sidebar)", color: "var(--text-sidebar)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
