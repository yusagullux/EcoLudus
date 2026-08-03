"use client";

import { useAuth } from "@/lib/useAuth";
import { useTeamTemplates } from "@/lib/useCatalog";
import { useToast } from "@/lib/toast";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type { TeamMissionTemplate } from "@/lib/catalog";
import {
  PageHero,
  Panel,
  Pill,
  MetricCard,
  ProgressBar,
  primaryButton,
  secondaryButton,
  inputClass,
  heroAccents,
} from "@/components/game-ui";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton, CardGridSkeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SegmentedControl } from "@/components/ui/segmented-control";

// Difficulty chips stay semantically colored (green/amber/red) but ride themed
// surfaces via color-mix so they remain readable in dark/aurora/liquid instead
// of the old bg-emerald-50/amber-50/rose-50 which washed out on dark themes.
const difficultyChip: Record<string, { background: string; color: string }> = {
  Easy:   { background: "color-mix(in srgb, #2f9e54 16%, var(--bg-panel))", color: "#2f9e54" },
  Medium: { background: "color-mix(in srgb, #c98a0e 18%, var(--bg-panel))", color: "#c98a0e" },
  Hard:   { background: "color-mix(in srgb, #db5a36 18%, var(--bg-panel))", color: "#db5a36" },
};

// Eco reward chip — green-tinted, themed. XP rewards use the neutral Pill.
const ecoChipStyle = {
  background: "color-mix(in srgb, #2f9e54 14%, var(--bg-panel))",
  color: "#2f9e54",
} as const;

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
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  // Mission templates (titles, icons, xp/eco/needed) are loaded from the
  // server's read API and are display-only — the /api/teams `assign` route
  // re-validates the template by id and ignores any client-supplied values,
  // so a client cannot start a mission with inflated rewards. SWR caches them.
  const { templates: rawTemplates } = useTeamTemplates();
  const templates = rawTemplates as TeamMissionTemplate[];

  // Team progress proof states
  const [activeProofMission, setActiveProofMission] = useState<any | null>(null);
  const [proofType, setProofType] = useState<"text" | "photo">("text");
  const [teamTextProof, setTeamTextProof] = useState("");
  const [teamPhotoFile, setTeamPhotoFile] = useState<File | null>(null);
  const [teamPhotoPreview, setTeamPhotoPreview] = useState<string | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  const fetchTeamData = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/teams", { credentials: "include" });
      const data = await response.json();

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
      console.error("Failed to fetch team data:", error);
      setJoined(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [user?.uid]);

  const closeModals = () => {
    setShowCreateModal(false);
    setShowJoinModal(false);
    setInputVal("");
  };

  const handleCreateTeam = async () => {
    if (!inputVal.trim() || !user?.uid) return;
    const teamName = inputVal.trim();

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
        await fetchTeamData();
      } else {
        toast.error(data.error?.message || data.error?.code || "Failed to create team");
      }
    } catch (error) {
      console.error("Create team error:", error);
      toast.error("Failed to create team");
    }
  };

  const handleJoinTeam = async () => {
    if (!inputVal.trim() || !user?.uid) return;

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
        await fetchTeamData();
      } else {
        toast.error(data.error?.code || "Failed to join team");
      }
    } catch (error) {
      console.error("Join team error:", error);
      toast.error("Failed to join team");
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
        await fetchTeamData();
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
      await fetchTeamData();
    } catch (error: any) {
      console.error("Submit progress error:", error);
      setProofError(error.message || "Failed to submit progress.");
    } finally {
      setSubmittingProof(false);
    }
  };

  if (loading) {
    return <PageSkeleton metricCount={4} panels={[{ rows: 3 }, { rows: 3 }, { rows: 3 }]} heroChips={2} />;
  }

  const memberCount = team?.stats?.members || 0;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Hero ── */}
      <PageHero
        eyebrow="Cooperative play"
        title="Team Hub"
        description="Collaborate on eco goals with your squad."
        accent={heroAccents.team}
      >
        {joined ? (
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-center">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-moss-300">Members</div>
              <div className="mt-1 font-serif text-xl font-bold leading-none text-white">{memberCount}</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-center">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-moss-300">Shared XP</div>
              <div className="mt-1 font-serif text-xl font-bold leading-none text-white">{(team?.stats?.xp || 0).toLocaleString()}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowCreateModal(true)} className={primaryButton}>
              Create Team
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-cream-100 transition hover:bg-white/20 active:scale-[0.97]"
            >
              Join via Code
            </button>
          </div>
        )}
      </PageHero>

      {/* ── Empty state ── */}
      {!joined ? (
        <EmptyState
          icon="👥"
          title="You're not part of a team yet"
          description="Create a cozy squad or join with a 6-character code."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => setShowCreateModal(true)} className={primaryButton}>
                Start a Team
              </button>
              <button onClick={() => setShowJoinModal(true)} className={secondaryButton}>
                Have a Code?
              </button>
            </div>
          }
        />
      ) : (
        <>
          {/* ── Team Overview ── */}
          <Panel
            eyebrow="Your team"
            title={team?.name || "Team"}
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { navigator.clipboard?.writeText(team?.code || ""); toast.show("Code copied!"); }}
                  className={secondaryButton}
                >
                  Copy Code
                </button>
                <button
                  onClick={handleLeaveTeam}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-rose-300/60 bg-rose-500/10 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-rose-600 transition hover:bg-rose-500/20 active:scale-[0.97]"
                  style={{ color: "rgb(224 36 36 / 0.85)" }}
                >
                  Leave Team
                </button>
              </div>
            }
          >
            <div className="flex flex-wrap gap-2">
              <Pill>Code: {team?.code || "N/A"}</Pill>
              <span
                className="inline-flex items-center rounded-full bg-forest-950 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-cream-100"
              >
                {team?.role || "member"}
              </span>
            </div>

            {/* Stats grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="XP Shared" value={(team?.stats?.xp || 0).toLocaleString()} accent="#4CAF50" />
              <MetricCard label="EcoPoints Shared" value={(team?.stats?.eco || 0).toLocaleString()} accent="#06B6D4" />
              <MetricCard label="Missions Cleared" value={team?.stats?.missions || 0} accent="#F59E0B" />
              <MetricCard label="Active Members" value={team?.stats?.members || 0} accent="#8B5CF6" />
            </div>

            {/* Members */}
            <div className="mt-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Members</p>
              <div className="flex flex-col divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-default)" }}>
                {team?.members?.length > 0 ? team.members.map((m: any, i: number) => (
                  <Link key={i} href={`/profile/${m.id}`} className="flex items-center justify-between px-4 py-3 transition hover:opacity-80" style={{ background: "var(--bg-panel)" }}>
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name || "Member"} src={m.profileImage} size={32} />
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {m.role === "leader" ? "👑 " : ""}{m.name}
                      </span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>{(m.xp || 0).toLocaleString()} XP</span>
                  </Link>
                )) : (
                  <div className="px-4 py-4 text-sm text-center" style={{ color: "var(--text-muted)" }}>No members yet</div>
                )}
              </div>
            </div>
          </Panel>

          {/* ── Active Missions ── */}
          <Panel
            eyebrow="Active missions"
            title="Team Missions"
            action={<Pill>{activeMissions.length}/3 active</Pill>}
          >
            {activeMissions.length === 0 ? (
              <EmptyState
                variant="plain"
                icon="🎯"
                title="No active missions yet"
                description="Assign one from the library below!"
              />
            ) : (
              <div className="flex flex-col gap-3">
                {activeMissions.map((m) => {
                  const pct = Math.round(((m.done || 0) / (m.needed || 1)) * 100);
                  const isSubmitting = submittingId === m.id;
                  return (
                    <div key={m.id} className="rounded-xl border p-5" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <p className="font-serif text-lg font-bold" style={{ color: "var(--text-primary)" }}>{m.icon} {m.title}</p>
                        <div className="flex gap-2">
                          <Pill>+{m.xp} XP</Pill>
                          <span className="rounded-lg px-2.5 py-1 text-xs font-bold" style={ecoChipStyle}>+{m.eco} Eco</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar value={pct} />
                        <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{m.done}/{m.needed}</span>
                      </div>
                      <button
                        onClick={() => {
                          setActiveProofMission(m);
                          setProofType("text");
                          setTeamTextProof("");
                          setTeamPhotoFile(null);
                          setTeamPhotoPreview(null);
                          setProofError(null);
                        }}
                        disabled={isSubmitting}
                        className={`mt-4 ${primaryButton}`}
                      >
                        {isSubmitting ? "Submitting…" : "Submit Progress"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* ── Mission Library ── */}
          <Panel eyebrow="Mission library" title="Assign New Mission">
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.length === 0 ? (
                <CardGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 col-span-full" />
              ) : templates.map((t) => {
                const isAssigning = assigningId === t.id;
                const isAlreadyActive = activeMissions.some((m) => m.mission_id === t.id);
                const chip = difficultyChip[t.difficulty];
                return (
                  <div key={t.id} className="flex flex-col gap-3 rounded-xl border p-4 transition" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                    <div>
                      <p className="font-serif text-base font-bold" style={{ color: "var(--text-primary)" }}>{t.icon} {t.title}</p>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {chip ? (
                        <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={chip}>
                          {t.difficulty}
                        </span>
                      ) : (
                        <Pill>{t.difficulty}</Pill>
                      )}
                      <Pill>+{t.xp} XP</Pill>
                      <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold" style={ecoChipStyle}>+{t.eco} Eco</span>
                      <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold" style={{ background: "var(--bg-panel)", color: "var(--text-muted)" }}>{t.needed} teammates</span>
                    </div>
                    <button
                      onClick={() => handleAssignMission(t)}
                      disabled={isAssigning || isAlreadyActive || activeMissions.length >= 3}
                      className={`mt-auto ${primaryButton}`}
                    >
                      {isAssigning ? "Assigning…" : isAlreadyActive ? "Already Active" : activeMissions.length >= 3 ? "Limit Reached" : "Assign"}
                    </button>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* ── Team Leaderboard ── */}
          <Panel eyebrow="Ranking" title="Team Leaderboard" className="overflow-hidden">
            <div className="-mx-5 -my-5 divide-y sm:-mx-6 sm:-my-6" style={{ borderColor: "var(--border-subtle)" }}>
              {[...(team?.members || [])].sort((a: any, b: any) => (b.xp || 0) - (a.xp || 0)).map((m: any, i: number) => (
                <Link key={i} href={`/profile/${m.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:opacity-80 sm:px-6" style={{ borderColor: "var(--border-subtle)" }}>
                  <span className="w-6 text-center font-serif text-base font-black" style={{ color: "var(--text-muted)" }}>#{i + 1}</span>
                  <Avatar name={m.name || "Member"} src={m.profileImage} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{m.name}</p>
                    <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{m.role}</p>
                  </div>
                  <span className="font-serif text-base font-bold" style={{ color: "var(--text-secondary)" }}>{(m.xp || 0).toLocaleString()} XP</span>
                </Link>
              ))}
              {(!team?.members || team.members.length === 0) && (
                <div className="px-6 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>No members to rank yet</div>
              )}
            </div>
          </Panel>
        </>
      )}

      {/* ── Create / Join Modal ── */}
      <Dialog
        open={showCreateModal || showJoinModal}
        onClose={closeModals}
        title={showCreateModal ? "Create a Team" : "Join a Team"}
        description={showCreateModal ? "Name your squad so friends can recognize it." : "Enter the 6-character invite code."}
        footer={
          <>
            <button onClick={closeModals} className={secondaryButton}>Cancel</button>
            <button
              onClick={showCreateModal ? handleCreateTeam : handleJoinTeam}
              className={primaryButton}
            >
              {showCreateModal ? "Create" : "Join"}
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
        title="Submit Progress Proof"
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
              {submittingProof ? "Verifying…" : "Submit Proof"}
            </button>
          </>
        }
      >
        <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
          Proof for: <strong style={{ color: "var(--text-primary)" }}>&ldquo;{activeProofMission?.title}&rdquo;</strong>
        </p>

        {/* Tab selector */}
        <SegmentedControl
          ariaLabel="Proof type"
          value={proofType}
          onChange={(v) => { setProofType(v as "text" | "photo"); setProofError(null); }}
          options={[
            { value: "text", label: "Text Description" },
            { value: "photo", label: "Photo Upload" }
          ]}
        />

        {proofType === "text" ? (
          <div className="mt-5">
            <label htmlFor="team-text-proof" className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
              Describe what you completed (min 8 characters)
            </label>
            <textarea
              id="team-text-proof"
              value={teamTextProof}
              onChange={(e) => setTeamTextProof(e.target.value)}
              placeholder="e.g. I commuted to work by bicycle today instead of driving."
              rows={4}
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none resize-none transition focus:shadow-[0_0_0_3px_rgba(67,101,63,0.14)]"
              style={{ borderColor: "var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)" }}
            />
            <p
              className="mt-1 text-right text-[10px] font-bold"
              style={{ color: teamTextProof.trim().length >= 8 ? "var(--text-accent, #43653f)" : "#e0593a" }}
            >
              {teamTextProof.trim().length}/8 min characters
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            <label className="block text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
              Select a photo showing completion
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => document.getElementById("team-photo-camera")?.click()}
                className="flex-1 rounded-xl border py-3 text-xs font-bold transition"
                style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)", color: "var(--text-primary)" }}>
                📸 Take Photo
              </button>
              <button type="button" onClick={() => document.getElementById("team-photo-gallery")?.click()}
                className="flex-1 rounded-xl border py-3 text-xs font-bold transition"
                style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)", color: "var(--text-primary)" }}>
                🖼️ Gallery
              </button>
              {teamPhotoFile && (
                <button type="button" onClick={() => { setTeamPhotoFile(null); setTeamPhotoPreview(null); }}
                  className="rounded-xl border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-xs font-bold transition"
                  style={{ color: "rgb(220 60 50)" }}>
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
              <div className="mt-2 overflow-hidden rounded-xl border p-2 text-center" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
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
    </div>
  );
}