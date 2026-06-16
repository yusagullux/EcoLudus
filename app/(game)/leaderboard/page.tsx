// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { PageHero, Panel, Pill } from "@/components/game-ui";

const badgeList = [
  { level: 1, name: "Cat", image: "/images/ecoquests-badges/cat-badge-removedbg.png" },
  { level: 2, name: "Fox", image: "/images/ecoquests-badges/fox-badge-removedbg.png" },
  { level: 3, name: "Rabbit", image: "/images/ecoquests-badges/rabbit-badge-removedbg.png" },
  { level: 4, name: "Deer", image: "/images/ecoquests-badges/deer-badge-removedbg.png" },
  { level: 5, name: "Wolf", image: "/images/ecoquests-badges/wolf-badge-removedbg.png" },
  { level: 6, name: "Bear", image: "/images/ecoquests-badges/bear-badge-removedbg.png" },
  { level: 7, name: "Eagle", image: "/images/ecoquests-badges/eagle-badge-removedbg.png" },
  { level: 8, name: "Tiger", image: "/images/ecoquests-badges/tiger-badge-removedbg.png" },
  { level: 9, name: "Lion", image: "/images/ecoquests-badges/lion-badge-removedbg.png" }
];

function getBadge(level: number) {
  return badgeList[Math.min(Math.max(level, 1), 9) - 1];
}

const medalLabel = ["1st", "2nd", "3rd"];
const medalColors = ["#9a6b1f", "#5d6f7a", "#8a4f25"];

type Player = {
  id: string;
  displayName: string;
  xp: number;
  level: number;
  ecoPoints: number;
};

type Team = {
  id: string;
  name: string;
  joinCode: string;
  totalXP: number;
  totalEco: number;
  memberCount: number;
  missionsCompleted: number;
};

function IndividualLeaderboard({ users, currentUserId }: { users: Player[]; currentUserId?: string }) {
  const sorted = [...users].sort((a, b) => b.xp - a.xp);
  const podium = [sorted[1], sorted[0], sorted[2]];
  const podiumRank = [2, 1, 3];

  if (sorted.length === 0) {
    return (
      <Panel>
        <div className="p-8 text-center text-forest-700">No players yet. Be the first to join!</div>
      </Panel>
    );
  }

  return (
    <>
      {/* Podium */}
      {sorted.length >= 2 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {podium.map((player, index) => {
            if (!player) return <div key={index} />;
            const rank = podiumRank[index];
            const badge = getBadge(player.level);
            const isGold = rank === 1;
            return (
              <article
                key={player.id}
                className={`flex flex-col items-center gap-3 rounded-[22px] border p-5 text-center shadow-[0_18px_48px_rgba(26,45,29,0.07)] transition hover:-translate-y-0.5 ${
                  isGold
                    ? "border-[#e6d3a6] bg-[#fbf4df] sm:-mt-3 sm:pb-7 sm:pt-7"
                    : "border-[#dfe7d7] bg-[#fffefa]"
                }`}
              >
                <span
                  className="font-serif text-3xl font-extrabold"
                  style={{ color: medalColors[rank - 1] }}
                >
                  {medalLabel[rank - 1]}
                </span>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
                  <img
                    src={badge.image}
                    alt={`${badge.name} badge`}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </span>
                <div>
                  <p className="font-serif text-lg font-extrabold leading-snug text-forest-950">
                    {player.displayName}
                  </p>
                  <p className="text-xs font-semibold text-forest-700/58">
                    {badge.name}, Lvl {player.level}
                  </p>
                </div>
                <p
                  className="font-serif text-xl font-extrabold"
                  style={{ color: medalColors[rank - 1] }}
                >
                  {player.xp.toLocaleString()} XP
                </p>
              </article>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <Panel
        eyebrow="Full list"
        title="Rankings"
        action={<Pill>{sorted.length} players</Pill>}
        className="overflow-hidden"
      >
        <div className="-mx-5 -my-5 overflow-x-auto sm:-mx-6 sm:-my-6">
          <div className="min-w-[580px]">
            <div className="grid grid-cols-[56px_1fr_100px_130px] items-center gap-4 border-b border-[#e7ecdf] bg-[#f4f7ef] px-5 py-3">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">#</span>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">Player</span>
              <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">Level</span>
              <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">XP</span>
            </div>

            {sorted.map((player, index) => {
              const rank = index + 1;
              const badge = getBadge(player.level);
              const isCurrentUser = currentUserId && player.id === currentUserId;
              const isTop3 = rank <= 3;
              return (
                <div
                  key={player.id}
                  className={`grid grid-cols-[56px_1fr_100px_130px] items-center gap-4 border-b border-[#edf1e8] px-5 py-4 last:border-0 transition hover:bg-[#f7f9f2] ${
                    isCurrentUser ? "bg-[#eef5ea]" : "bg-[#fffefa]"
                  }`}
                >
                  <div
                    className="text-center font-serif text-xl font-extrabold"
                    style={{ color: isTop3 ? medalColors[rank - 1] : "#8fa083" }}
                  >
                    {rank}
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f4f7ef] p-1.5">
                      <img
                        src={badge.image}
                        alt={`${badge.name} badge`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-forest-950">
                        {player.displayName}
                        {isCurrentUser ? " (You)" : ""}
                      </p>
                      <p className="text-xs font-semibold text-forest-700/56">{badge.name} Badge</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Pill>Lv {player.level}</Pill>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-lg font-extrabold text-forest-800">
                      {player.xp.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-forest-700/48">XP</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </>
  );
}

function TeamLeaderboard({ teams }: { teams: Team[] }) {
  if (teams.length === 0) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 py-12 text-center text-forest-700/60">
          <span className="text-4xl">🌿</span>
          <p className="text-sm font-bold">No teams yet.</p>
          <p className="text-xs">Create or join a team to compete here.</p>
        </div>
      </Panel>
    );
  }

  const sorted = [...teams].sort((a, b) => b.totalXP - a.totalXP);

  return (
    <Panel
      eyebrow="Team competition"
      title="Team Rankings"
      action={<Pill>{sorted.length} teams</Pill>}
      className="overflow-hidden"
    >
      <div className="-mx-5 -my-5 overflow-x-auto sm:-mx-6 sm:-my-6">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[56px_1fr_100px_120px_100px] items-center gap-4 border-b border-[#e7ecdf] bg-[#f4f7ef] px-5 py-3">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">#</span>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">Team</span>
            <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">Members</span>
            <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">Missions</span>
            <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">Team XP</span>
          </div>

          {sorted.map((team, index) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            return (
              <div
                key={team.id}
                className="grid grid-cols-[56px_1fr_100px_120px_100px] items-center gap-4 border-b border-[#edf1e8] bg-[#fffefa] px-5 py-4 last:border-0 transition hover:bg-[#f7f9f2]"
              >
                <div
                  className="text-center font-serif text-xl font-extrabold"
                  style={{ color: isTop3 ? medalColors[rank - 1] : "#8fa083" }}
                >
                  {rank}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-forest-950">{team.name}</p>
                  <p className="text-xs font-semibold text-forest-700/56">Code: {team.joinCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-forest-800">{team.memberCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-forest-800">{team.missionsCompleted}</p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-base font-extrabold text-forest-800">
                    {team.totalXP.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold text-forest-700/48">XP</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"individual" | "team">("individual");
  const [users, setUsers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamsFetched, setTeamsFetched] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch("/api/users");
        const data = await response.json();
        setUsers(data.users || []);
      } catch (error) {
        console.error("Failed to fetch users:", error);
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, []);

  useEffect(() => {
    if (tab !== "team" || teamsFetched) return;

    async function fetchTeams() {
      setLoadingTeams(true);
      try {
        const response = await fetch("/api/stats/team-aggregate", { credentials: "include" });
        const data = await response.json();
        setTeams(data.teams || []);
        setTeamsFetched(true);
      } catch (error) {
        console.error("Failed to fetch team stats:", error);
        setTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    }
    fetchTeams();
  }, [tab, teamsFetched]);

  const isLoading = tab === "individual" ? loadingUsers : loadingTeams;

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Global rankings"
        title="Leaderboard"
        description="Top EcoLudus players and teams ranked by XP earned and missions completed."
      />

      {/* Tab selector */}
      <div className="flex rounded-xl bg-[#f4f7ef] p-1">
        {(["individual", "team"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2.5 text-center text-xs font-extrabold uppercase tracking-wider transition ${
              tab === t
                ? "bg-white text-forest-950 shadow-sm"
                : "text-forest-600 hover:text-forest-900"
            }`}
          >
            {t === "individual" ? "👤 Individual" : "🌿 Team"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Panel>
          <div className="p-8 text-center text-forest-700">Loading leaderboard...</div>
        </Panel>
      ) : tab === "individual" ? (
        <IndividualLeaderboard users={users} currentUserId={user?.uid} />
      ) : (
        <TeamLeaderboard teams={teams} />
      )}
    </div>
  );
}
