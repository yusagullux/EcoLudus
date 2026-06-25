// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { getAllUsers, updateUserProfile } from "@/public/js/auth.js";
import { HeroMetric, MetricCard, PageHero, Panel, Pill, primaryButton, secondaryButton, inputClass } from "@/components/game-ui";

function friendKey(friend: any) {
  return friend?.id || friend?.uid || friend?.email;
}

export default function FriendsPage() {
  const { user, profile, setProfile } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");

  const friends = Array.isArray(profile?.friends) ? profile.friends : [];
  const friendIds = new Set(friends.map(friendKey));

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
    return () => {
      cancelled = true;
    };
  }, []);

  const candidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return players
      .filter((player) => player.id !== user?.uid)
      .filter((player) => !friendIds.has(player.id))
      .filter((player) => {
        if (!normalized) return true;
        return String(player.displayName || "").toLowerCase().includes(normalized)
          || String(player.email || "").toLowerCase().includes(normalized);
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
        email: player.email,
        displayName: player.displayName,
        xp: Number(player.xp || 0),
        level: Number(player.level || 1),
        ecoPoints: Number(player.ecoPoints || 0),
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

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Social garden" title="Friends" description="Add other EcoLudus players and compare progress across quests, levels, and EcoPoints.">
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Friends" value={friends.length} />
          <HeroMetric label="Your Level" value={myLevel} />
          <HeroMetric label="Avg Level" value={averageFriendLevel || "-"} />
        </div>
      </PageHero>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Your XP" value={myXp.toLocaleString()} accent="#2f6b46" />
        <MetricCard label="Your EcoPoints" value={myEcoPoints.toLocaleString()} accent="#9a6b1f" />
        <MetricCard label="Friends Added" value={friends.length} accent="#2f5f86" />
        <MetricCard label="Best Friend Level" value={friends.length ? Math.max(...friends.map((friend) => Number(friend.level || 1))) : "-"} accent="#62508f" />
      </div>

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
                  <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{player.email}</p>
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
                        Level {friend.level || 1} - {Number(friend.xp || 0).toLocaleString()} XP - {Number(friend.ecoPoints || 0).toLocaleString()} EP
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Pill active={Number(friend.xp || 0) <= myXp}>{Number(friend.xp || 0) <= myXp ? "You lead" : "Ahead"}</Pill>
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
