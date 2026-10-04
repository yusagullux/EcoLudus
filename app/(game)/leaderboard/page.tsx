"use client";

import { useState, useEffect, type CSSProperties, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import { User, Users } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { PageHeader, Panel, Pill, RankMedallion } from "@/components/game-ui";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { RowListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/avatar";
import { StaggerContainer, StaggerItem, TabPanel } from "@/lib/animations";

// RankMedallion comes from the kit — its "row"/"podium" size aliases replace
// this page's former local copy (podium = 44px).

// Responsive grid-column templates for the ranking tables. Each template is
// used twice (header row + every data row) so keeping them as named constants
// means a column change lands in one place and the header/row can't drift
// out of sync. The mobile (3-col) layout drops the redundant columns; the
// sm: layout restores them. `grid` is added by the caller so the same const
// works for both the header and the row.
const INDIV_COLS = "grid-cols-[40px_1fr_auto] gap-3 sm:grid-cols-[56px_1fr_100px_130px] sm:gap-4";
const TEAM_COLS = "grid-cols-[40px_1fr_auto] gap-3 sm:grid-cols-[56px_1fr_100px_120px_100px] sm:gap-4";

// Gold halo behind the #1 podium card (sanctioned color-mix — the amber glow
// rings the medallion seat rather than washing the whole card).
const GOLD_HALO: CSSProperties = {
  borderColor: "color-mix(in srgb, var(--accent-gold) 35%, var(--border-default))",
  boxShadow:
    "var(--shadow-lift), 0 0 0 2px color-mix(in srgb, var(--accent-gold) 22%, transparent), 0 0 36px color-mix(in srgb, var(--accent-gold) 16%, transparent)"
};

// Mobile podium ordering: cards render in DOM order 2-1-3 (desktop staircase),
// but stacked phones should read 1-2-3 top-down. Desktop resets to source
// order so the staircase (and the gold card's -mt lift) is preserved.
const PODIUM_ORDER: Record<number, string> = {
  1: "order-1 sm:order-none",
  2: "order-2 sm:order-none",
  3: "order-3"
};

// Shared top-3 podium card. Individual and team leaderboards render the same
// medal-stamped shell — only the body (avatar vs. team crest + name line) and
// the wrapper element (Link vs. div) differ, so those are passed in. Collapses
// two near-identical cards into one.
function PodiumCard({
  rank,
  xp,
  as: Tag = "div",
  href,
  hover = false,
  className = "",
  children
}: {
  rank: number;
  xp: number;
  as?: ElementType;
  href?: string;
  hover?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const isGold = rank === 1;
  return (
    <Tag
      {...(href ? { href } : {})}
      className={`relative flex flex-col items-center gap-3 rounded-[1.25rem] border bg-surface p-5 text-center transition ${isGold ? "shadow-elev-2 sm:-mt-3 sm:pb-7 sm:pt-7" : "border-line shadow-elev-1"} ${hover ? "hover:-translate-y-0.5" : ""} ${className}`}
      style={isGold ? GOLD_HALO : undefined}
    >
      <RankMedallion rank={rank} size="podium" />
      {children}
      <p
        className="font-serif text-xl font-extrabold"
        style={{ color: isGold ? "var(--accent-gold-text)" : "var(--text-accent)" }}
      >
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
  totalXP: number;
  totalEco: number;
  memberCount: number;
  missionsCompleted: number;
};

function IndividualLeaderboard({ users, currentUserId }: { users: Player[]; currentUserId?: string }) {
  const sorted = [...users].sort((a, b) => b.xp - a.xp);
  const podium = [sorted[1], sorted[0], sorted[2]];
  const podiumRank = [2, 1, 3];
  // Spec keeps your row highlighted rather than pinned; when you sit outside
  // the visible top-3, this chip scrolls to your row below.
  const myRank = currentUserId ? sorted.findIndex((p) => p.id === currentUserId) + 1 : 0;

  if (sorted.length === 0) {
    return (
      <Panel>
        <EmptyState variant="plain" title="No players yet. Be the first to join!" />
      </Panel>
    );
  }

  return (
    <>
      {myRank > 3 && (
        <a
          href="#your-row"
          className="w-fit rounded-full transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
        >
          <Pill active>You&rsquo;re #{myRank}</Pill>
        </a>
      )}

      {/* Podium */}
      {sorted.length >= 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {podium.map((player, index) => {
            if (!player) return <div key={index} />;
            const rank = podiumRank[index];
            return (
              <PodiumCard key={player.id} as={Link} href={`/profile/${player.id}`} hover rank={rank} xp={player.xp} className={PODIUM_ORDER[rank]}>
                <div className="relative">
                  <Avatar name={player.displayName} src={player.profileImage} size={72} className="shadow-sm" />
                  {rank === 1 && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-2 rounded-full"
                      style={{ background: "color-mix(in srgb, var(--accent-gold) 14%, transparent)" }}
                    />
                  )}
                </div>
                <div>
                  <p className="font-serif text-lg font-extrabold leading-snug text-ink">
                    {player.displayName}
                  </p>
                  <p className="text-xs font-semibold text-ink-muted">
                    Lv {player.level}
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
            <div className={`grid ${INDIV_COLS} border-b border-line-soft bg-surface-alt px-5 py-3`}>
              <span className="text-micro font-semibold text-ink-muted">Rank</span>
              <span className="text-micro font-semibold text-ink-muted">Player</span>
              <span className="hidden text-right text-micro font-semibold text-ink-muted sm:block">Level</span>
              <span className="text-right text-micro font-semibold text-ink-muted">XP</span>
            </div>

            {sorted.map((player, index) => {
              const rank = index + 1;
              const isCurrentUser = currentUserId && player.id === currentUserId;
              return (
                <Link
                  key={player.id}
                  id={isCurrentUser ? "your-row" : undefined}
                  href={`/profile/${player.id}`}
                  className={`grid ${INDIV_COLS} items-center border-b border-line-soft px-5 py-4 last:border-0 transition hover:bg-surface-alt ${isCurrentUser ? "scroll-mt-24" : ""}`}
                  style={
                    isCurrentUser
                      ? {
                          background: "color-mix(in srgb, var(--text-accent) 8%, var(--bg-panel))",
                          boxShadow: "inset 3px 0 0 var(--text-accent)"
                        }
                      : undefined
                  }
                >
                  <RankMedallion rank={rank} />
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={player.displayName} src={player.profileImage} size={44} />
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-extrabold text-ink">{player.displayName}</span>
                        {isCurrentUser && (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold leading-none"
                            style={{
                              background: "color-mix(in srgb, var(--text-accent) 14%, var(--bg-panel))",
                              color: "var(--text-accent)"
                            }}
                          >
                            You
                          </span>
                        )}
                      </p>
                      {/* Level lives in the Level column at sm+; this line shows
                          the other tracked stat so it isn't a duplicate. */}
                      <p className="text-xs font-semibold text-ink-muted">{(player.ecoPoints || 0).toLocaleString()} Eco</p>
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <Pill>Lv {player.level}</Pill>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-lg font-extrabold text-ink">
                      {player.xp.toLocaleString()}
                    </p>
                    <p className="text-micro text-ink-muted">XP</p>
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
      {sorted.length >= 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {teamPodium.map((team, index) => {
            if (!team) return <div key={index} />;
            const rank = teamPodiumRank[index];
            return (
              <PodiumCard key={team.id} rank={rank} xp={team.totalXP} className={PODIUM_ORDER[rank]}>
                {/* Team crest roundel on the podium seat */}
                <span
                  className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-[1.25rem]"
                  style={{
                    background: "color-mix(in srgb, var(--accent-green) 14%, var(--bg-panel))",
                    border: "1px solid color-mix(in srgb, var(--accent-green) 30%, var(--border-default))",
                    color: "var(--accent-green-text)"
                  }}
                  aria-hidden="true"
                >
                  <Users className="h-7 w-7" strokeWidth={2.2} />
                </span>
                <div>
                  <p className="font-serif text-lg font-extrabold leading-snug text-ink">
                    {team.name}
                  </p>
                  <p className="text-xs font-semibold text-ink-muted">
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
        title="Team rankings"
        action={<Pill>{sorted.length} teams</Pill>}
        className="overflow-hidden"
      >
      <div className="-mx-5 -my-5 overflow-x-auto sm:-mx-6 sm:-my-6">
        <div className="sm:min-w-[600px]">
          <div className={`grid ${TEAM_COLS} border-b border-line-soft bg-surface-alt px-5 py-3`}>
            <span className="text-micro font-semibold text-ink-muted">Rank</span>
            <span className="text-micro font-semibold text-ink-muted">Team</span>
            <span className="hidden text-right text-micro font-semibold text-ink-muted sm:block">Members</span>
            <span className="hidden text-right text-micro font-semibold text-ink-muted sm:block">Missions</span>
            <span className="text-right text-micro font-semibold text-ink-muted">Team XP</span>
          </div>

          {sorted.map((team, index) => {
            const rank = index + 1;
            // Team rows are display-only (not links) — no hover treatment.
            return (
              <div
                key={team.id}
                className={`grid ${TEAM_COLS} items-center border-b border-line-soft px-5 py-4 last:border-0`}
              >
                <RankMedallion rank={rank} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-ink">{team.name}</p>
                  <p className="text-xs font-semibold text-ink-muted">
                    {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-extrabold text-ink-soft">{team.memberCount}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-extrabold text-ink-soft">{team.missionsCompleted}</p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-base font-extrabold text-ink">
                    {team.totalXP.toLocaleString()}
                  </p>
                  <p className="text-micro text-ink-muted">XP</p>
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

  // Guard against unauthenticated mounts: useAuth() redirects unauth visitors
  // to /login, but this effect would otherwise fire /api/users first and log a
  // 401. Skipping while there's no uid also keeps the skeleton up until auth
  // resolves, so we never flash an empty list before the redirect.
  useEffect(() => {
    let cancelled = false;
    async function fetchUsers() {
      if (!user?.uid) return;
      try {
        const response = await fetch("/api/users");
        const data = await response.json();
        if (!cancelled) setUsers(data.users || []);
      } catch (error) {
        console.error("Failed to fetch users:", error);
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }
    fetchUsers();
    return () => { cancelled = true; };
  }, [user?.uid]);

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
        <PageHeader
          title="Leaderboard"
          description="Top players and teams, ranked by XP earned and missions completed."
        />
      </StaggerItem>

      {/* Tab selector */}
      <StaggerItem as="div">
        <SegmentedControl
          ariaLabel="Leaderboard view"
          value={tab}
          onChange={(v) => setTab(v as "individual" | "team")}
          options={[
            {
              value: "individual",
              label: (
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" /> Players
                </span>
              )
            },
            {
              value: "team",
              label: (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" /> Teams
                </span>
              )
            }
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
            <div className="flex flex-col gap-5">
              <IndividualLeaderboard users={users} currentUserId={user?.uid} />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <TeamLeaderboard teams={teams} />
            </div>
          )}
        </TabPanel>
      </StaggerItem>
    </StaggerContainer>
  );
}