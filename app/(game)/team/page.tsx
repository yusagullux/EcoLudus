"use client";

import { useAuth } from "@/lib/useAuth";
import { useTeamTemplates } from "@/lib/useCatalog";
import { useToast } from "@/lib/toast";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import {
  BarChart3,
  Camera,
  Check,
  Copy,
  Crown,
  Droplets,
  Footprints,
  Image as ImageIcon,
  Plug,
  Recycle,
  Sparkles,
  Sprout,
  Target,
  Trash2,
  Users,
  Utensils,
  type LucideIcon
} from "lucide-react";
import type { TeamMissionTemplate } from "@/lib/catalog";
import {
  PageHeader,
  Panel,
  Pill,
  ProgressBar,
  RankMedallion,
  primaryButton,
  secondaryButton,
  inputClass,
} from "@/components/game-ui";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PanelSkeleton, CardGridSkeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StaggerContainer, StaggerItem } from "@/lib/animations";

// Difficulty chips ride themed surfaces via color-mix so they remain readable
// on dark/aurora/liquid — semantically green/amber/red per difficulty.
const difficultyChip: Record<string, { background: string; border: string; color: string }> = {
  Easy:   {
    background: "color-mix(in srgb, var(--accent-green) 16%, var(--bg-panel))",
    border: "color-mix(in srgb, var(--accent-green) 30%, var(--border-default))",
    color: "var(--accent-green-text)"
  },
  Medium: {
    background: "color-mix(in srgb, var(--text-warning) 18%, var(--bg-panel))",
    border: "color-mix(in srgb, var(--text-warning) 32%, var(--border-default))",
    color: "var(--text-warning)"
  },
  Hard:   {
    background: "color-mix(in srgb, var(--text-error) 18%, var(--bg-panel))",
    border: "color-mix(in srgb, var(--text-error) 32%, var(--border-default))",
    color: "var(--text-error)"
  },
};

// Mission templates carry icon strings that mix emoji and two-letter codes.
// Map the known emoji to themed lucide glyphs; anything unmapped renders as
// a quiet uppercase monogram tile — never a bare emoji.
const MISSION_ICONS: Record<string, LucideIcon | undefined> = {
  "♻️": Recycle,
  "🧹": Sparkles,
  "🚶": Footprints,
  "💧": Droplets,
  "🔌": Plug,
  "🌱": Sprout,
  "🍽️": Utensils,
  "🚯": Trash2,
  "📊": BarChart3
};

// Uppercase 2–3 letter monogram for icon strings without a mapped glyph
// (covers the template data's pre-baked codes like "CP"/"RK").
function missionMonogram(icon: string, title: string) {
  const trimmed = (icon || "").trim();
  if (/^[a-z]{2,3}$/i.test(trimmed)) return trimmed.toUpperCase();
  return ((title || "").match(/\p{L}|\d/gu) ?? []).slice(0, 2).join("").toUpperCase();
}

// Shared mission glyph tile: lucide glyph when mapped, monogram otherwise.
// `tint` lets active-mission cards ride the mission's difficulty chip colors.
function MissionGlyph({
  icon,
  title,
  tint = {
    background: "color-mix(in srgb, var(--text-accent) 12%, var(--bg-panel))",
    color: "var(--text-accent)"
  }
}: {
  icon: string;
  title: string;
  tint?: { background: string; color: string };
}) {
  const Glyph = MISSION_ICONS[icon];
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.875rem]"
      style={tint}
      aria-hidden="true"
    >
      {Glyph ? (
        <Glyph className="h-5 w-5" strokeWidth={2.2} />
      ) : (
        <span className="fg-botlabel text-[0.625rem]">{missionMonogram(icon, title)}</span>
      )}
    </span>
  );
}

// Compact banner stat cell (the fold-in home of the old StatGrid tiles).
function BannerStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-input border border-line-soft bg-surface-alt px-3 py-2">
      <p className="text-micro font-semibold leading-tight text-ink-muted">{label}</p>
      <p className="mt-0.5 font-serif text-lg font-bold leading-none text-ink">{value}</p>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<any>(null);
  const [activeMissions, setActiveMissions] = useState<any[]>([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inputVal, setInputVal] = useState("");
  // Busy state for the create/join dialog — blocks double-click/double-Enter
  // duplicate POST /api/teams submissions.
  const [creating, setCreating] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  // Mission templates (titles, icons, xp/eco/needed) are loaded from the
  // server's read API and are display-only — the /api/teams `assign` route
  // re-validates the template by id and ignores any client-supplied values,
  // so a client cannot start a mission with inflated rewards. SWR caches them.
  const { templates: rawTemplates, isLoading: templatesLoading } = useTeamTemplates();
  const templates = rawTemplates as TeamMissionTemplate[];

  // Team progress proof states
  const [activeProofMission, setActiveProofMission] = useState<any | null>(null);
  const [proofType, setProofType] = useState<"text" | "photo">("text");
  const [teamTextProof, setTeamTextProof] = useState("");
  const [teamPhotoFile, setTeamPhotoFile] = useState<File | null>(null);
  const [teamPhotoPreview, setTeamPhotoPreview] = useState<string | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  const loadTeam = useCallback(async (signal?: AbortSignal) => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/teams", { credentials: "include", signal });
      const data = await response.json();
      if (signal?.aborted) return;

      if (data.team) {
        setTeam(data.team);
        setActiveMissions(data.activeMissions || []);
        setJoined(true);
      } else {
        setJoined(false);
        setTeam(null);
        setActiveMissions([]);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("Failed to fetch team data:", error);
      setJoined(false);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Initial team fetch on mount. React Compiler flags setState-in-effect for
  // client data fetching; the alternative is a Suspense/`use` rewrite, which is
  // out of scope for this lint pass. Suppressing intentionally.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const controller = new AbortController();
    loadTeam(controller.signal);
    return () => { controller.abort(); };
  }, [loadTeam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const closeModals = () => {
    setShowCreateModal(false);
    setShowJoinModal(false);
    setInputVal("");
  };

  const handleCreateTeam = async () => {
    if (creating || !inputVal.trim() || !user?.uid) return;
    const teamName = inputVal.trim();
    setCreating(true);

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "create", teamName })
      });
      const data = await response.json();

      if (response.ok) {
        closeModals();
        toast.success(`Team "${teamName}" created! Code: ${data.code}`);
        await loadTeam();
      } else {
        toast.error(data.error?.message || data.error?.code || "Failed to create team");
      }
    } catch (error) {
      console.error("Create team error:", error);
      toast.error("Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinTeam = async () => {
    if (creating || !inputVal.trim() || !user?.uid) return;
    setCreating(true);

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "join", teamCode: inputVal.trim() })
      });
      const data = await response.json();

      if (response.ok) {
        closeModals();
        toast.success(`Joined team "${data.teamName}"!`);
        await loadTeam();
      } else {
        toast.error(data.error?.code || "Failed to join team");
      }
    } catch (error) {
      console.error("Join team error:", error);
      toast.error("Failed to join team");
    } finally {
      setCreating(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!user?.uid) return;

    try {
      const response = await fetch("/api/teams", { method: "DELETE", credentials: "include" });
      if (response.ok) {
        setJoined(false);
        setTeam(null);
        setActiveMissions([]);
        setShowLeaveConfirm(false);
        toast.success("Left the team");
      } else {
        toast.error("Failed to leave team");
      }
    } catch (error) {
      console.error("Leave team error:", error);
      toast.error("Failed to leave team");
    }
  };

  const handleAssignMission = async (t: TeamMissionTemplate) => {
    if (!user?.uid || !team?.id) return;
    if (activeMissions.length >= 3) {
      toast.show("Maximum 3 active missions allowed");
      return;
    }
    const alreadyActive = activeMissions.some((m) => m.mission_id === t.id);
    if (alreadyActive) {
      toast.show(`"${t.title}" is already active`);
      return;
    }

    setAssigningId(t.id);
    try {
      // Only the missionId is sent; the server looks up the template and
      // uses its title/icon/xp/eco/needed, so a client cannot inflate rewards.
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "assign",
          teamId: team.id,
          missionId: t.id
        })
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(`"${t.title}" assigned to team!`);
        await loadTeam();
      } else {
        toast.error(data.error?.message || data.error?.code || "Failed to assign mission");
      }
    } catch (error) {
      console.error("Assign mission error:", error);
      toast.error("Failed to assign mission");
    } finally {
      setAssigningId(null);
    }
  };

  const handleSubmitProgress = async () => {
    if (!user?.uid || !team?.id || !activeProofMission || submittingProof) return;

    setSubmittingProof(true);
    setSubmittingId(activeProofMission.id);
    setProofError(null);

    let photoProof: string | null = null;
    let mimeType: string | null = null;

    if (proofType === "photo" && teamPhotoFile) {
      try {
        photoProof = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to read photo."));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(teamPhotoFile);
        });
        mimeType = teamPhotoFile.type;
      } catch (err: any) {
        setProofError(err.message || "Failed to process photo.");
        setSubmittingProof(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "submit_progress",
          teamId: team.id,
          activeMissionId: activeProofMission.id,
          textProof: proofType === "text" ? teamTextProof.trim() : undefined,
          photoProof,
          mimeType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || "Failed to submit progress.");
      }

      if (data.completed) {
        toast.success("🎉 Mission completed! Rewards granted to all members!");
      } else {
        toast.success("Progress submitted! Keep going!");
      }

      setActiveProofMission(null);
      await loadTeam();
    } catch (error: any) {
      console.error("Submit progress error:", error);
      setProofError(error.message || "Failed to submit progress.");
    } finally {
      setSubmittingProof(false);
      setSubmittingId(null);
    }
  };

  if (loading) {
    // PageHeader-shaped placeholder — no hero band, no stat wall.
    return (
      <div className="flex flex-col gap-5" aria-busy="true" role="status" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <div className="flex flex-col gap-2" aria-hidden="true">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-ink-muted/30" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded bg-ink-muted/20" />
        </div>
        <PanelSkeleton rows={2} />
        <PanelSkeleton rows={3} />
      </div>
    );
  }

  const memberCount = team?.stats?.members || 0;
  const members = Array.isArray(team?.members) ? team.members : [];

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">

      {!joined ? (
        <>
          {/* ── Unjoined: light header + illustrated invite ── */}
          <StaggerItem as="div">
            <PageHeader
              title="Team"
              description="Team up with friends to clear missions together — progress is shared, and so are the rewards."
            />
          </StaggerItem>

          <StaggerItem as="div">
            <EmptyState
              icon={<Users className="h-8 w-8" strokeWidth={2} />}
              title="No team yet"
              description="Start a cozy squad or join one with a 6-character code. Team missions split the work between players."
              action={
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <button type="button" onClick={() => setShowCreateModal(true)} className={primaryButton}>
                    Start a team
                  </button>
                  <button type="button" onClick={() => setShowJoinModal(true)} className={secondaryButton}>
                    Have a code?
                  </button>
                </div>
              }
            />
          </StaggerItem>
        </>
      ) : (
        <>
          {/* ── Team banner ── */}
          <StaggerItem as="section">
            <section className="t-panel shadow-elev-2 overflow-hidden rounded-[1.25rem]">
              <div
                className="border-b border-line-soft p-5 sm:p-7"
                style={{
                  background: "color-mix(in srgb, var(--text-accent) 6%, var(--bg-panel))"
                }}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    {/* Crest roundel */}
                    <span
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem]"
                      style={{
                        background: "color-mix(in srgb, var(--accent-green) 15%, var(--bg-panel))",
                        border: "1px solid color-mix(in srgb, var(--accent-green) 30%, var(--border-default))",
                        color: "var(--accent-green-text)"
                      }}
                      aria-hidden="true"
                    >
                      <Users className="h-6 w-6" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-accent">Your team</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h1 className="truncate font-serif text-2xl font-bold leading-tight text-ink sm:text-3xl">
                          {team?.name || "Team"}
                        </h1>
                        <Pill active className="capitalize">{team?.role || "member"}</Pill>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {/* Join code as a copy-tag: code + clipboard behavior unchanged */}
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard?.writeText(team?.code || ""); toast.show("Code copied!"); }}
                      className="fg-chip min-h-11 px-3.5 transition hover:-translate-y-0.5 active:scale-[0.97]"
                      style={{
                        background: "color-mix(in srgb, var(--text-accent) 9%, var(--bg-panel))",
                        border: "1px dashed color-mix(in srgb, var(--text-accent) 45%, var(--border-default))",
                        color: "var(--text-accent)"
                      }}
                      title="Tap to copy the invite code"
                      aria-label={`Copy invite code ${team?.code || ""}`}
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                      <span className="font-serif text-sm font-extrabold tracking-[0.18em]">
                        {team?.code || "??????"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLeaveConfirm(true)}
                      className="chip-danger inline-flex min-h-11 items-center justify-center rounded-full px-4 text-xs font-bold transition hover:opacity-90 active:scale-[0.97]"
                    >
                      Leave team
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats fold into the banner meta row */}
              <div className="p-5 sm:p-7 sm:pt-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <BannerStat label="Shared XP" value={(team?.stats?.xp || 0).toLocaleString()} />
                  <BannerStat label="EcoPoints shared" value={(team?.stats?.eco || 0).toLocaleString()} />
                  <BannerStat label="Missions cleared" value={team?.stats?.missions || 0} />
                  <BannerStat label="Members" value={memberCount} />
                </div>

                {/* Avatar cluster — detail lives in the member cards below */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center">
                    {members.slice(0, 5).map((m: any, i: number) => (
                      <Avatar
                        key={m.id ?? i}
                        name={m.name || "Member"}
                        src={m.profileImage}
                        size={32}
                        className={i > 0 ? "-ml-2" : ""}
                        style={{ boxShadow: "0 0 0 2px var(--bg-panel)" }}
                      />
                    ))}
                  </div>
                  {memberCount > members.slice(0, 5).length && (
                    <span
                      className="flex h-8 items-center justify-center rounded-full border border-line bg-surface-alt px-2.5 font-serif text-xs font-extrabold text-ink"
                      aria-label={`${memberCount - members.slice(0, 5).length} more members`}
                    >
                      +{memberCount - members.slice(0, 5).length}
                    </span>
                  )}
                  <p className="text-xs font-semibold text-ink-muted">
                    {memberCount === 1 ? "1 member" : `${memberCount} members`}
                  </p>
                </div>
              </div>
            </section>
          </StaggerItem>

          {/* ── Members (friendly member cards) ── */}
          <StaggerItem as="section">
            <Panel eyebrow="Your squad" title="Members">
              <div className="grid gap-3 sm:grid-cols-2">
                {members.length > 0 ? members.map((m: any, i: number) => (
                  <Link
                    key={m.id ?? i}
                    href={`/profile/${m.id}`}
                    className="group flex min-h-[64px] items-center gap-3 rounded-[1rem] border border-line bg-surface-alt p-3 transition hover:-translate-y-0.5 hover:shadow-elev-1"
                  >
                    <div className="relative shrink-0">
                      <Avatar name={m.name || "Member"} src={m.profileImage} size={40} />
                      {m.role === "leader" && (
                        <span
                          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full"
                          style={{ background: "var(--accent-gold)", color: "var(--accent-gold-text)" }}
                          title="Team leader"
                        >
                          <Crown className="h-3 w-3" strokeWidth={2.6} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate font-serif text-sm font-bold text-ink transition-colors group-hover:text-accent"
                        title={m.name}
                      >
                        {m.name}
                      </p>
                      <p className="text-xs capitalize text-ink-muted">
                        {m.role === "leader" ? "Team leader" : "Member"}
                      </p>
                    </div>
                    <span className="fg-chip fg-chip-xp whitespace-nowrap">{(m.xp || 0).toLocaleString()} XP</span>
                  </Link>
                )) : (
                  <p className="text-sm text-ink-muted sm:col-span-2">No members yet</p>
                )}
              </div>
            </Panel>
          </StaggerItem>

          {/* ── Active Missions ── */}
          <StaggerItem as="section">
            <Panel
              eyebrow="Active missions"
              title="Working together"
              action={<Pill>{activeMissions.length}/3 active</Pill>}
            >
              {activeMissions.length === 0 ? (
                <EmptyState
                  variant="plain"
                  icon={<Target className="h-7 w-7" strokeWidth={2} />}
                  title="No missions underway"
                  description="Pick one from the mission library below — teamwork goes further."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {activeMissions.map((m) => {
                    const pct = Math.round(((m.done || 0) / (m.needed || 1)) * 100);
                    const isSubmitting = submittingId === m.id;
                    const goalReached = (m.done || 0) >= (m.needed || 1);
                    // The /api/teams GET payload has no difficulty field; look
                    // up the template (display-only) for the chip + glyph tint.
                    const template = templates.find((t) => t.id === m.mission_id);
                    const chip = template ? difficultyChip[template.difficulty] : undefined;
                    const glyphTint = chip
                      ? { background: chip.background, color: chip.color }
                      : undefined;
                    return (
                      <article key={m.id} className="rounded-[1.25rem] border border-line bg-surface-alt p-4 sm:p-5">
                        <div className="flex items-start gap-3.5">
                          {/* Mission glyph (from the server's template data) */}
                          <MissionGlyph icon={m.icon} title={m.title} tint={glyphTint} />
                          <div className="min-w-0 flex-1">
                            <p className="font-serif text-base font-bold leading-snug text-ink sm:text-lg">{m.title}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {template && (chip ? (
                                <span className="rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold" style={chip}>
                                  {template.difficulty}
                                </span>
                              ) : (
                                <Pill>{template.difficulty}</Pill>
                              ))}
                              <span className="fg-chip fg-chip-xp">+{m.xp} XP</span>
                              <span className="fg-chip fg-chip-coins">+{m.eco} Eco</span>
                            </div>
                          </div>
                          {goalReached && (
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                              style={{
                                background: "color-mix(in srgb, var(--accent-green) 18%, var(--bg-panel))",
                                color: "var(--accent-green-text)"
                              }}
                              title="Goal reached"
                              aria-hidden="true"
                            >
                              <Check className="h-4 w-4" strokeWidth={3} />
                            </span>
                          )}
                        </div>

                        {/* Shared progress: bar + done/needed counts */}
                        <div className="mt-4 flex items-center gap-3">
                          <div className="flex-1">
                            <ProgressBar value={pct} />
                          </div>
                          <p className="shrink-0 text-xs text-ink-muted">
                            <span className="font-serif text-sm font-extrabold text-ink">{m.done || 0}</span>
                            /{m.needed || 1}
                          </p>
                        </div>
                        <p className="mt-1.5 text-xs font-semibold text-ink-muted">
                          {goalReached
                            ? "Goal reached — rewards are on the way"
                            : `${(m.needed || 1) - (m.done || 0)} more contributions to go`}
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveProofMission(m);
                            setProofType("text");
                            setTeamTextProof("");
                            setTeamPhotoFile(null);
                            setTeamPhotoPreview(null);
                            setProofError(null);
                          }}
                          disabled={isSubmitting}
                          className={`mt-4 ${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {isSubmitting ? "Submitting…" : "Submit progress"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </Panel>
          </StaggerItem>

          {/* ── Mission Library ── */}
          <StaggerItem as="section">
            <Panel eyebrow="Mission library" title="Pick your next mission">
              <div className="grid gap-3 sm:grid-cols-2">
                {templatesLoading ? (
                  <CardGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 col-span-full" />
                ) : templates.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      variant="plain"
                      icon={<Target className="h-7 w-7" strokeWidth={2} />}
                      title="No missions available yet"
                      description="Check back soon — new team missions land here."
                    />
                  </div>
                ) : templates.map((t) => {
                  const isAssigning = assigningId === t.id;
                  const isAlreadyActive = activeMissions.some((m) => m.mission_id === t.id);
                  const chip = difficultyChip[t.difficulty];
                  return (
                    <article key={t.id} className="flex flex-col gap-3 rounded-[1.25rem] border border-line bg-surface-alt p-4">
                      <div className="flex items-start gap-3">
                        <MissionGlyph icon={t.icon} title={t.title} />
                        <div className="min-w-0">
                          <p className="font-serif text-[0.9375rem] font-bold leading-snug text-ink sm:text-base">{t.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {chip ? (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold"
                            style={chip}
                          >
                            {t.difficulty}
                          </span>
                        ) : (
                          <Pill>{t.difficulty}</Pill>
                        )}
                        <span className="fg-chip fg-chip-xp">+{t.xp} XP</span>
                        <span className="fg-chip fg-chip-coins">+{t.eco} Eco</span>
                        <Pill>{t.needed} teammates</Pill>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAssignMission(t)}
                        disabled={isAssigning || isAlreadyActive || activeMissions.length >= 3}
                        aria-label={isAlreadyActive ? `"${t.title}" is already active` : activeMissions.length >= 3 ? "Maximum 3 active missions reached" : `Assign ${t.title}`}
                        className={`mt-auto ${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isAssigning ? "Assigning…" : isAlreadyActive ? "Already active" : activeMissions.length >= 3 ? "Limit reached" : "Assign"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </Panel>
          </StaggerItem>

          {/* ── Team Leaderboard ── */}
          <StaggerItem as="section">
            <Panel eyebrow="Ranking" title="Team standings" className="overflow-hidden">
              <div className="-mx-5 -my-5 divide-line-soft divide-y sm:-mx-6 sm:-my-6">
                {[...members].sort((a: any, b: any) => (b.xp || 0) - (a.xp || 0)).map((m: any, i: number) => {
                  // Same isCurrentUser treatment as the leaderboard rows: tinted
                  // back + accent rail + "You" chip.
                  const isCurrentUser = !!user?.uid && m.id === user.uid;
                  return (
                    <Link
                      key={m.id ?? i}
                      href={`/profile/${m.id}`}
                      className="flex items-center gap-3 px-5 py-4 transition hover:bg-surface-alt sm:gap-4 sm:px-6"
                      style={
                        isCurrentUser
                          ? {
                              background: "color-mix(in srgb, var(--text-accent) 8%, var(--bg-panel))",
                              boxShadow: "inset 3px 0 0 var(--text-accent)"
                            }
                          : undefined
                      }
                    >
                      <RankMedallion rank={i + 1} size={36} />
                      <Avatar name={m.name || "Member"} src={m.profileImage} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-bold text-ink">{m.name}</span>
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
                        <p className="text-xs capitalize text-ink-muted">{m.role}</p>
                      </div>
                      <span className="fg-chip fg-chip-xp whitespace-nowrap">{(m.xp || 0).toLocaleString()} XP</span>
                    </Link>
                  );
                })}
                {members.length === 0 && (
                  <div className="px-6 py-6 text-sm text-center text-ink-muted">No members to rank yet</div>
                )}
              </div>
            </Panel>
          </StaggerItem>
        </>
      )}

      {/* ── Create / Join Modal ── */}
      <Dialog
        open={showCreateModal || showJoinModal}
        onClose={closeModals}
        title={showCreateModal ? "Create a team" : "Join a team"}
        description={showCreateModal ? "Name your squad so friends can recognize it." : "Enter the 6-character invite code."}
        footer={
          <>
            <button type="button" onClick={closeModals} disabled={creating} className={secondaryButton}>Cancel</button>
            <button
              type="button"
              onClick={showCreateModal ? handleCreateTeam : handleJoinTeam}
              disabled={creating}
              className={primaryButton}
            >
              {showCreateModal ? (creating ? "Creating…" : "Create") : (creating ? "Joining…" : "Join")}
            </button>
          </>
        }
      >
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (showCreateModal ? handleCreateTeam() : handleJoinTeam())}
          placeholder={showCreateModal ? "e.g. Green Guardians" : "e.g. ECO123"}
          maxLength={showCreateModal ? 40 : 6}
          className={inputClass}
          autoFocus
        />
      </Dialog>

      {/* ── Submit Proof Modal ── */}
      <Dialog
        open={!!activeProofMission}
        onClose={() => setActiveProofMission(null)}
        title="Submit progress proof"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setActiveProofMission(null)} className={secondaryButton}>Cancel</button>
            <button
              type="button"
              onClick={handleSubmitProgress}
              disabled={submittingProof || (proofType === "text" && teamTextProof.trim().length < 8) || (proofType === "photo" && !teamPhotoFile)}
              className={primaryButton}
            >
              {submittingProof ? "Verifying…" : "Submit proof"}
            </button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-muted">
          Proof for: <strong className="text-ink">&ldquo;{activeProofMission?.title}&rdquo;</strong>
        </p>

        {/* Tab selector */}
        <SegmentedControl
          ariaLabel="Proof type"
          value={proofType}
          onChange={(v) => { setProofType(v as "text" | "photo"); setProofError(null); }}
          options={[
            { value: "text", label: "Text description" },
            { value: "photo", label: "Photo upload" }
          ]}
        />

        {proofType === "text" ? (
          <div className="mt-5">
            <label htmlFor="team-text-proof" className="mb-1.5 block text-overline text-ink-muted">
              Describe what you completed (min 8 characters)
            </label>
            <textarea
              id="team-text-proof"
              value={teamTextProof}
              onChange={(e) => setTeamTextProof(e.target.value)}
              placeholder="e.g. I commuted to work by bicycle today instead of driving."
              rows={4}
              className={`${inputClass} resize-none`}
            />
            <p
              className={`mt-1 text-right text-micro ${teamTextProof.trim().length >= 8 ? "text-accent" : "text-status-danger"}`}
            >
              {teamTextProof.trim().length}/8 min characters
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            <label className="block text-overline text-ink-muted">
              Select a photo showing completion
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => document.getElementById("team-photo-camera")?.click()}
                className="min-h-11 flex-1 rounded-input border border-line bg-surface-alt py-3 text-xs font-bold text-ink transition hover:-translate-y-0.5">
                <Camera className="mr-1.5 inline-block h-4 w-4 align-[-2px]" aria-hidden="true" /> Take photo
              </button>
              <button type="button" onClick={() => document.getElementById("team-photo-gallery")?.click()}
                className="min-h-11 flex-1 rounded-input border border-line bg-surface-alt py-3 text-xs font-bold text-ink transition hover:-translate-y-0.5">
                <ImageIcon className="mr-1.5 inline-block h-4 w-4 align-[-2px]" aria-hidden="true" /> Gallery
              </button>
              {teamPhotoFile && (
                <button type="button" onClick={() => { setTeamPhotoFile(null); setTeamPhotoPreview(null); }}
                  className="chip-danger min-h-11 rounded-input border border-line px-4 py-3 text-xs font-bold transition">
                  Clear
                </button>
              )}
            </div>
            <input id="team-photo-camera" type="file" accept="image/*" capture="environment"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setTeamPhotoFile(f); const r = new FileReader(); r.onload = () => { if (typeof r.result === "string") setTeamPhotoPreview(r.result); }; r.readAsDataURL(f); } }}
              className="sr-only" />
            <input id="team-photo-gallery" type="file" accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setTeamPhotoFile(f); const r = new FileReader(); r.onload = () => { if (typeof r.result === "string") setTeamPhotoPreview(r.result); }; r.readAsDataURL(f); } }}
              className="sr-only" />
            {teamPhotoPreview && (
              <div className="mt-2 overflow-hidden rounded-input border border-line bg-surface-alt p-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={teamPhotoPreview} alt="Preview" className="mx-auto h-40 w-full max-w-xs rounded-lg object-cover" />
              </div>
            )}
          </div>
        )}

        {proofError && (
          <ErrorBanner className="mt-4">{proofError}</ErrorBanner>
        )}
      </Dialog>

      <ConfirmDialog
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title="Leave team?"
        message="You’ll lose access to shared missions and team progress. This can’t be undone."
        confirmLabel="Leave team"
        danger
        onConfirm={handleLeaveTeam}
      />
    </StaggerContainer>
  );
}