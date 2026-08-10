"use client";

import { useState, useEffect, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { PageHero, Panel, Pill, heroAccents } from "@/components/game-ui";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { RowListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/avatar";
import { StaggerContainer, StaggerItem, TabPanel } from "@/lib/animations";

const medalLabel = ["1st", "2nd", "3rd"];
const medalColors = ["var(--text-warning)", "var(--text-accent)", "var(--text-warning)"];

// Responsive grid-column templates for the ranking tables. Each template is
// used twice (header row + every data row) so keeping them as named constants
// means a column change lands in one place and the header/row can't drift
// out of sync. The mobile (3-col) layout drops the redundant columns; the
// sm: layout restores them. `grid` is added by the caller so the same const
// works for both the header and the row.
const INDIV_COLS = "grid-cols-[40px_1fr_auto] gap-3 sm:grid-cols-[56px_1fr_100px_130px] sm:gap-4";
const TEAM_COLS = "grid-cols-[40px_1fr_auto] gap-3 sm:grid-cols-[56px_1fr_100px_120px_100px] sm:gap-4";

// Shared top-3 podium card. Individual and team leaderboards render the same
// medal-bordered shell — only the body (avatar vs. team emoji + name line) and
// the wrapper element (Link vs. div) differ, so those are passed in. Collapses
// two near-identical ~30-line cards into one.
function PodiumCard({
  rank,
  xp,
  as: Tag = "div",
  href,
  hover = false,
  children
}: {
  rank: number;
  xp: number;
  as?: ElementType;
  href?: string;
  hover?: boolean;
  children: ReactNode;
}) {
  const isGold = rank === 1;
  return (
    <Tag
      {...(href ? { href } : {})}
      className={`flex flex-col items-center gap-3 rounded-[20px] border p-5 text-center transition ${isGold ? "sm:-mt-3 sm:pb-7 sm:pt-7" : ""} ${hover ? "hover:-translate-y-0.5" : ""}`}
      style={{
        borderColor: isGold ? "var(--text-warning)" : "var(--border-default)",
        background: "var(--bg-panel)",
        boxShadow: isGold ? "var(--shadow-lift), 0 0 0 2px color-mix(in srgb, var(--text-warning) 18%, transparent)" : "var(--shadow-card)"
      }}
    >
      <span className="font-serif text-3xl font-extrabold" style={{ color: medalColors[rank - 1] }}>
        {medalLabel[rank - 1]}
      </span>
      {children}
      <p className="font-serif text-xl font-extrabold" style={{ color: medalColors[rank - 1] }}>
        {xp.toLocaleString()} XP
      </p>
    </Tag>
  );
}

type Player = {
  id: string;
  displayName: string;
  xp: number;
  level: number;
  ecoPoints: number;
  profileImage?: string | null;
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
        <EmptyState variant="plain" title="No players yet. Be the first to join!" />
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
            return (
              <PodiumCard key={player.id} as={Link} href={`/profile/${player.id}`} hover rank={rank} xp={player.xp}>
                <Avatar name={player.displayName} src={player.profileImage} size={64} className="shadow-sm" />
                <div>
                  <p className="font-serif text-lg font-extrabold leading-snug" style={{ color: "var(--text-primary)" }}>
                    {player.displayName}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    Lvl {player.level}
                  </p>
                </div>
              </PodiumCard>
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
          <div className="sm:min-w-[580px]">
            <div className={`grid ${INDIV_COLS} border-b px-5 py-3`} style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel-alt)" }}>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>#</span>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Player</span>
              <span className="hidden text-right text-[10px] font-extrabold uppercase tracking-[0.16em] sm:block" style={{ color: "var(--text-muted)" }}>Level</span>
              <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>XP</span>
            </div>

            {sorted.map((player, index) => {
              const rank = index + 1;
              const isCurrentUser = currentUserId && player.id === currentUserId;
              const isTop3 = rank <= 3;
              return (
                <Link
                  key={player.id}
                  href={`/profile/${player.id}`}
                  className={`grid ${INDIV_COLS} items-center border-b px-5 py-4 last:border-0 transition hover:opacity-80`}
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: isCurrentUser ? "var(--sidebar-active-bg)" : "var(--bg-panel)"
                  }}
                >
                  <div
                    className="text-center font-serif text-xl font-extrabold"
                    style={{ color: isTop3 ? medalColors[rank - 1] : "var(--text-muted)" }}
                  >
                    {rank}
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={player.displayName} src={player.profileImage} size={44} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
                        {player.displayName}
                        {isCurrentUser ? " (You)" : ""}
                      </p>
                      <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Lvl {player.level}</p>
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <Pill>Lv {player.level}</Pill>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
                      {player.xp.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>XP</p>
                  </div>
                </Link>
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
        <EmptyState
          variant="plain"
          icon="🌿"
          title="No teams yet."
          description="Create or join a team to compete here."
        />
      </Panel>
    );
  }

  const sorted = [...teams].sort((a, b) => b.totalXP - a.totalXP);
  const teamPodium = [sorted[1], sorted[0], sorted[2]];
  const teamPodiumRank = [2, 1, 3];

  return (
    <>
      {/* Podium */}
      {sorted.length >= 2 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {teamPodium.map((team, index) => {
            if (!team) return <div key={index} />;
            const rank = teamPodiumRank[index];
            return (
              <PodiumCard key={team.id} rank={rank} xp={team.totalXP}>
                <span className="text-4xl" aria-hidden>🌿</span>
                <div>
                  <p className="font-serif text-lg font-extrabold leading-snug" style={{ color: "var(--text-primary)" }}>
                    {team.name}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
              </PodiumCard>
            );
          })}
        </div>
      )}

      <Panel
        eyebrow="Team competition"
        title="Team Rankings"
        action={<Pill>{sorted.length} teams</Pill>}
        className="overflow-hidden"
      >
      <div className="-mx-5 -my-5 overflow-x-auto sm:-mx-6 sm:-my-6">
        <div className="sm:min-w-[600px]">
          <div className={`grid ${TEAM_COLS} border-b px-5 py-3`} style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel-alt)" }}>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>#</span>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Team</span>
            <span className="hidden text-right text-[10px] font-extrabold uppercase tracking-[0.16em] sm:block" style={{ color: "var(--text-muted)" }}>Members</span>
            <span className="hidden text-right text-[10px] font-extrabold uppercase tracking-[0.16em] sm:block" style={{ color: "var(--text-muted)" }}>Missions</span>
            <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Team XP</span>
          </div>

          {sorted.map((team, index) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            return (
              <div
                key={team.id}
                className={`grid ${TEAM_COLS} items-center border-b px-5 py-4 last:border-0 transition`}
                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel)" }}
              >
                <div
                  className="text-center font-serif text-xl font-extrabold"
                  style={{ color: isTop3 ? medalColors[rank - 1] : "var(--text-muted)" }}
                >
                  {rank}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{team.name}</p>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-extrabold" style={{ color: "var(--text-secondary)" }}>{team.memberCount}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-extrabold" style={{ color: "var(--text-secondary)" }}>{team.missionsCompleted}</p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-base font-extrabold" style={{ color: "var(--text-primary)" }}>
                    {team.totalXP.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>XP</p>
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
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
      <PageHero
        eyebrow="Global rankings"
        title="Leaderboard"
        description="Top EcoLudus players and teams ranked by XP earned and missions completed."
        accent={heroAccents.leaderboard}
      />
      </StaggerItem>

      {/* Tab selector */}
      <StaggerItem as="div">
      <SegmentedControl
        ariaLabel="Leaderboard view"
        value={tab}
        onChange={(v) => setTab(v as "individual" | "team")}
        options={[
          { value: "individual", label: "👤 Individual" },
          { value: "team", label: "🌿 Team" }
        ]}
      />
      </StaggerItem>

      <StaggerItem as="div">
      <TabPanel activeKey={isLoading ? "loading" : tab}>
      {isLoading ? (
        <Panel>
          <RowListSkeleton rows={8} variant="row" />
        </Panel>
      ) : tab === "individual" ? (
        <IndividualLeaderboard users={users} currentUserId={user?.uid} />
      ) : (
        <TeamLeaderboard teams={teams} />
      )}
      </TabPanel>
      </StaggerItem>
    </StaggerContainer>
  );
}
