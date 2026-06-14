// @ts-nocheck
"use client";

import { useAuth } from "@/lib/useAuth";
import { useState, useEffect } from "react";

const missionTemplates = [
  { id: "t1", title: "Recycle 15 Plastic Bottles", desc: "Split the work and recycle at least 15 plastic bottles as a team.", icon: "♻️", difficulty: "Easy", xp: 240, eco: 140, needed: 3 },
  { id: "t2", title: "Clean One Shared Area", desc: "Pick a park block or stairwell and leave it visibly better.", icon: "🧹", difficulty: "Easy", xp: 260, eco: 160, needed: 3 },
  { id: "t3", title: "Commute Sustainably", desc: "At least 3 teammates bike, walk or take transit instead of a car.", icon: "🚶", difficulty: "Medium", xp: 300, eco: 180, needed: 3 },
  { id: "t4", title: "Save 50 Liters of Water", desc: "Collectively save about 50 liters through shorter showers.", icon: "💧", difficulty: "Medium", xp: 320, eco: 190, needed: 3 },
  { id: "t5", title: "Night Power Down", desc: "Unplug unused chargers/devices across at least 3 households.", icon: "🔌", difficulty: "Easy", xp: 220, eco: 130, needed: 2 },
  { id: "t6", title: "Plant or Care for 3 Greens", desc: "Plant seeds or tend to three different plants as a joint effort.", icon: "🌱", difficulty: "Easy", xp: 210, eco: 120, needed: 3 },
];

const difficultyColor: Record<string, string> = {
  Easy: "bg-emerald-50 text-emerald-700",
  Medium: "bg-amber-50 text-amber-700",
  Hard: "bg-rose-50 text-rose-700",
};

export default function TeamPage() {
  const { user } = useAuth();
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<any>(null);
  const [activeMissions, setActiveMissions] = useState<any[]>([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [toast, setToast] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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
      const response = await fetch(`/api/teams?userId=${user.uid}`);
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

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
        body: JSON.stringify({ action: "create", userId: user.uid, teamName })
      });
      const data = await response.json();

      if (response.ok) {
        closeModals();
        showToast(`Team "${teamName}" created! Code: ${data.code}`);
        await fetchTeamData();
      } else {
        showToast(data.error?.message || data.error?.code || "Failed to create team");
      }
    } catch (error) {
      console.error("Create team error:", error);
      showToast("Failed to create team");
    }
  };

  const handleJoinTeam = async () => {
    if (!inputVal.trim() || !user?.uid) return;

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", userId: user.uid, teamCode: inputVal.trim() })
      });
      const data = await response.json();

      if (response.ok) {
        closeModals();
        showToast(`Joined team "${data.teamName}"!`);
        await fetchTeamData();
      } else {
        showToast(data.error?.code || "Failed to join team");
      }
    } catch (error) {
      console.error("Join team error:", error);
      showToast("Failed to join team");
    }
  };

  const handleLeaveTeam = async () => {
    if (!user?.uid) return;

    try {
      const response = await fetch(`/api/teams?userId=${user.uid}`, { method: "DELETE" });
      if (response.ok) {
        setJoined(false);
        setTeam(null);
        setActiveMissions([]);
        showToast("Left the team");
      } else {
        showToast("Failed to leave team");
      }
    } catch (error) {
      console.error("Leave team error:", error);
      showToast("Failed to leave team");
    }
  };

  const handleAssignMission = async (t: typeof missionTemplates[0]) => {
    if (!user?.uid || !team?.id) return;
    if (activeMissions.length >= 3) {
      showToast("Maximum 3 active missions allowed");
      return;
    }
    const alreadyActive = activeMissions.some((m) => m.mission_id === t.id);
    if (alreadyActive) {
      showToast(`"${t.title}" is already active`);
      return;
    }

    setAssigningId(t.id);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          userId: user.uid,
          teamId: team.id,
          missionId: t.id,
          title: t.title,
          icon: t.icon,
          xp: t.xp,
          eco: t.eco,
          needed: t.needed
        })
      });
      const data = await response.json();

      if (response.ok) {
        showToast(`"${t.title}" assigned to team!`);
        await fetchTeamData();
      } else {
        showToast(data.error?.message || data.error?.code || "Failed to assign mission");
      }
    } catch (error) {
      console.error("Assign mission error:", error);
      showToast("Failed to assign mission");
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
        body: JSON.stringify({
          action: "submit_progress",
          userId: user.uid,
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
        showToast("🎉 Mission completed! Rewards granted to all members!");
      } else {
        showToast("Progress submitted! Keep going!");
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
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-forest-500">Loading team data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-forest-950 px-8 py-8 text-cream-100">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_top_right,rgba(167,196,132,0.12),transparent_60%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-moss-300">Cooperative play</p>
            <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">Team Hub</h1>
            <p className="mt-1 text-sm text-cream-100/60">Collaborate on eco goals with your squad.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!joined ? (
              <>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-xl bg-cream-100 px-5 py-2.5 text-sm font-bold tracking-wide text-forest-950 hover:bg-white active:scale-[0.98] transition-all"
                >
                  Create Team
                </button>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="rounded-xl border border-white/25 bg-white/8 px-5 py-2.5 text-sm font-bold tracking-wide text-cream-100 hover:bg-white/12 transition-all"
                >
                  Join via Code
                </button>
              </>
            ) : (
              <button
                onClick={handleLeaveTeam}
                className="rounded-xl border border-white/25 bg-white/8 px-5 py-2.5 text-sm font-semibold text-cream-100/80 hover:bg-white/12 transition-all"
              >
                Leave Team
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Empty state ── */}
      {!joined ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-forest-200 bg-white p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-2xl">👥</div>
          <div>
            <p className="font-serif text-xl font-bold text-forest-950">You're not part of a team yet</p>
            <p className="mt-1 text-sm text-forest-500 max-w-xs mx-auto">Create a cozy squad or join with a 6-character code.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-xl bg-forest-950 px-5 py-2.5 text-sm font-bold tracking-wide text-cream-100 hover:bg-forest-800 active:scale-[0.98] transition-all"
            >
              Start a Team
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              className="rounded-xl border border-forest-200 bg-white px-5 py-2.5 text-sm font-bold text-forest-900 hover:border-forest-400 transition-all"
            >
              Have a Code?
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Team Overview ── */}
          <div className="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-500">Your team</p>
                <h2 className="mt-0.5 font-serif text-2xl font-bold text-forest-950">{team?.name || "Team"}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-forest-100 bg-forest-50 px-3 py-1 text-xs font-bold text-forest-700">
                    Code: {team?.code || "N/A"}
                  </span>
                  <span className="rounded-lg bg-forest-950 px-3 py-1 text-xs font-bold uppercase text-cream-100">
                    {team?.role || "member"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(team?.code || ""); showToast("Code copied!"); }}
                className="self-start rounded-xl border border-forest-200 bg-white px-4 py-2 text-xs font-bold text-forest-900 hover:border-forest-400 transition-all"
              >
                Copy Code
              </button>
            </div>

            {/* Stats grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "XP Shared", value: (team?.stats?.xp || 0).toLocaleString(), accent: "#4CAF50" },
                { label: "EcoPoints Shared", value: (team?.stats?.eco || 0).toLocaleString(), accent: "#06B6D4" },
                { label: "Missions Cleared", value: team?.stats?.missions || 0, accent: "#F59E0B" },
                { label: "Active Members", value: team?.stats?.members || 0, accent: "#8B5CF6" },
              ].map(({ label, value, accent }) => (
                <div key={label} className="rounded-xl border border-forest-100 bg-forest-50 p-3" style={{ borderLeft: `3px solid ${accent}` }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest-500">{label}</p>
                  <p className="mt-1 font-serif text-2xl font-bold text-forest-950">{value}</p>
                </div>
              ))}
            </div>

            {/* Members */}
            <div className="mt-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-forest-500">Members</p>
              <div className="flex flex-col divide-y divide-forest-50 overflow-hidden rounded-xl border border-forest-100">
                {team?.members?.length > 0 ? team.members.map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-white px-4 py-3 hover:bg-forest-50/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-50 text-base">
                        {m.role === "leader" ? "👑" : "🌿"}
                      </div>
                      <span className="text-sm font-semibold text-forest-950">{m.name}</span>
                    </div>
                    <span className="text-xs font-bold text-forest-700">{(m.xp || 0).toLocaleString()} XP</span>
                  </div>
                )) : (
                  <div className="px-4 py-4 text-sm text-forest-400 text-center">No members yet</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Active Missions ── */}
          <div className="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-500">Active missions</p>
                <h2 className="mt-0.5 font-serif text-xl font-bold text-forest-950">Team Missions</h2>
              </div>
              <span className="rounded-lg border border-forest-100 bg-forest-50 px-3 py-1.5 text-xs font-bold text-forest-600">
                {activeMissions.length}/3 active
              </span>
            </div>
            {activeMissions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-forest-400">
                <span className="text-3xl">🎯</span>
                <p className="text-sm">No active missions yet. Assign one from the library below!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {activeMissions.map((m) => {
                  const pct = Math.round(((m.done || 0) / (m.needed || 1)) * 100);
                  const isSubmitting = submittingId === m.id;
                  return (
                    <div key={m.id} className="rounded-xl border border-forest-100 bg-forest-50/60 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <p className="font-serif text-lg font-bold text-forest-950">{m.icon} {m.title}</p>
                        <div className="flex gap-2">
                          <span className="rounded-lg bg-forest-100 px-2.5 py-1 text-xs font-bold text-forest-700">+{m.xp} XP</span>
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">+{m.eco} Eco</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-forest-100">
                          <div className="h-full rounded-full bg-forest-700 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-forest-600">{m.done}/{m.needed}</span>
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
                        className="mt-4 rounded-xl bg-forest-950 px-5 py-2.5 text-xs font-bold tracking-wide text-cream-100 hover:bg-forest-800 active:scale-[0.98] transition-all"
                      >
                        Submit Progress
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Mission Library ── */}
          <div className="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-500">Mission library</p>
            <h2 className="mt-0.5 mb-5 font-serif text-xl font-bold text-forest-950">Assign New Mission</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {missionTemplates.map((t) => {
                const isAssigning = assigningId === t.id;
                const isAlreadyActive = activeMissions.some((m) => m.mission_id === t.id);
                return (
                  <div key={t.id} className="flex flex-col gap-3 rounded-xl border border-forest-100 bg-forest-50/60 p-4 hover:bg-forest-50 transition-colors">
                    <div>
                      <p className="font-serif text-base font-bold text-forest-950">{t.icon} {t.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-forest-500">{t.desc}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${difficultyColor[t.difficulty] ?? "bg-forest-50 text-forest-700"}`}>
                        {t.difficulty}
                      </span>
                      <span className="rounded-lg bg-forest-100 px-2.5 py-1 text-[10px] font-bold text-forest-700">+{t.xp} XP</span>
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">+{t.eco} Eco</span>
                      <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">{t.needed} teammates</span>
                    </div>
                    <button
                      onClick={() => handleAssignMission(t)}
                      disabled={isAssigning || isAlreadyActive || activeMissions.length >= 3}
                      className="mt-auto rounded-xl bg-forest-950 px-4 py-2.5 text-xs font-bold tracking-wide text-cream-100 hover:bg-forest-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAssigning ? "Assigning…" : isAlreadyActive ? "Already Active" : activeMissions.length >= 3 ? "Limit Reached" : "Assign"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Team Leaderboard ── */}
          <div className="rounded-2xl border border-forest-100 bg-white shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-forest-50">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-500">Ranking</p>
              <h2 className="mt-0.5 font-serif text-xl font-bold text-forest-950">Team Leaderboard</h2>
            </div>
            <div className="divide-y divide-forest-50">
              {[...(team?.members || [])].sort((a: any, b: any) => (b.xp || 0) - (a.xp || 0)).map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-4 px-6 py-3.5 hover:bg-forest-50/60 transition-colors">
                  <span className="w-6 text-center font-serif text-base font-black text-forest-300">#{i + 1}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-50 text-base">
                    {m.role === "leader" ? "👑" : "🌿"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-forest-950">{m.name}</p>
                    <p className="text-xs capitalize text-forest-400">{m.role}</p>
                  </div>
                  <span className="font-serif text-base font-bold text-forest-700">{(m.xp || 0).toLocaleString()} XP</span>
                </div>
              ))}
              {(!team?.members || team.members.length === 0) && (
                <div className="px-6 py-6 text-sm text-forest-400 text-center">No members to rank yet</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {(showCreateModal || showJoinModal) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/60 p-4 backdrop-blur-sm"
          onClick={closeModals}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-7 shadow-[0_24px_60px_rgba(16,33,20,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-2xl font-bold text-forest-950">
              {showCreateModal ? "Create a Team" : "Join a Team"}
            </h3>
            <p className="mt-2 text-sm text-forest-500">
              {showCreateModal ? "Name your squad so friends can recognize it." : "Enter the 6-character invite code."}
            </p>
            <input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (showCreateModal ? handleCreateTeam() : handleJoinTeam())}
              placeholder={showCreateModal ? "e.g. Green Guardians" : "e.g. ECO123"}
              maxLength={showCreateModal ? 40 : 6}
              className="mt-5 w-full rounded-xl border border-forest-200 bg-white px-4 py-3 text-sm text-forest-950 placeholder:text-forest-300 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/15"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={closeModals}
                className="rounded-xl border border-forest-200 px-5 py-2.5 text-sm font-semibold text-forest-900 hover:border-forest-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreateTeam : handleJoinTeam}
                className="rounded-xl bg-forest-950 px-5 py-2.5 text-sm font-bold tracking-wide text-cream-100 hover:bg-forest-800 active:scale-[0.98] transition-all"
              >
                {showCreateModal ? "Create" : "Join"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit Proof Modal ── */}
      {activeProofMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-[0_24px_60px_rgba(16,33,20,0.18)]">
            <h3 className="font-serif text-2xl font-bold text-forest-950">
              Submit Progress Proof
            </h3>
            <p className="mt-2 text-sm text-forest-500">
              Provide proof for completing progress on: <strong className="text-forest-900">"{activeProofMission.title}"</strong>.
            </p>

            {/* Tab selector */}
            <div className="mt-5 flex rounded-xl bg-forest-50 p-1">
              <button
                type="button"
                onClick={() => { setProofType("text"); setProofError(null); }}
                className={`flex-1 rounded-lg py-2 text-center text-xs font-extrabold uppercase tracking-wider transition ${proofType === "text" ? "bg-white text-forest-900 shadow-sm" : "text-forest-600 hover:text-forest-900"}`}
              >
                Text Description
              </button>
              <button
                type="button"
                onClick={() => { setProofType("photo"); setProofError(null); }}
                className={`flex-1 rounded-lg py-2 text-center text-xs font-extrabold uppercase tracking-wider transition ${proofType === "photo" ? "bg-white text-forest-900 shadow-sm" : "text-forest-600 hover:text-forest-900"}`}
              >
                Photo Upload
              </button>
            </div>

            {proofType === "text" ? (
              <div className="mt-5">
                <label htmlFor="team-text-proof" className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-forest-700/70">
                  Describe what you completed (min 8 characters)
                </label>
                <textarea
                  id="team-text-proof"
                  value={teamTextProof}
                  onChange={(e) => setTeamTextProof(e.target.value)}
                  placeholder="e.g. I commuted to work by bicycle today instead of driving."
                  rows={4}
                  className="w-full rounded-xl border border-forest-200 bg-white px-4 py-3 text-sm text-forest-950 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/15 resize-none"
                />
                <p className={`mt-1 text-right text-[10px] font-bold ${teamTextProof.trim().length >= 8 ? "text-forest-600" : "text-rose-500"}`}>
                  {teamTextProof.trim().length}/8 min characters
                </p>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                <label className="block text-[11px] font-extrabold uppercase tracking-[0.16em] text-forest-700/70">
                  Select a photo showing completion
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById("team-photo-camera")?.click()}
                    className="flex-1 rounded-xl border border-forest-200 bg-white py-3 text-xs font-bold text-forest-900 hover:border-forest-400 transition-all"
                  >
                    📸 Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById("team-photo-gallery")?.click()}
                    className="flex-1 rounded-xl border border-forest-200 bg-white py-3 text-xs font-bold text-forest-900 hover:border-forest-400 transition-all"
                  >
                    🖼️ Gallery
                  </button>
                  {teamPhotoFile && (
                    <button
                      type="button"
                      onClick={() => { setTeamPhotoFile(null); setTeamPhotoPreview(null); }}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 hover:border-rose-300 transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {/* Camera input (opens native camera on mobile) */}
                <input
                  id="team-photo-camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) {
                      setTeamPhotoFile(file);
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string") {
                          setTeamPhotoPreview(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="sr-only"
                />
                {/* Gallery input (opens photo library) */}
                <input
                  id="team-photo-gallery"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) {
                      setTeamPhotoFile(file);
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string") {
                          setTeamPhotoPreview(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="sr-only"
                />
                {teamPhotoPreview && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-forest-100 bg-forest-50 p-2 text-center">
                    <img src={teamPhotoPreview} alt="Preview" className="mx-auto max-h-40 rounded-lg object-cover" />
                  </div>
                )}
              </div>
            )}

            {proofError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                {proofError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveProofMission(null)}
                className="rounded-xl border border-forest-200 px-5 py-2.5 text-sm font-semibold text-forest-900 hover:border-forest-400 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitProgress}
                disabled={
                  submittingProof ||
                  (proofType === "text" && teamTextProof.trim().length < 8) ||
                  (proofType === "photo" && !teamPhotoFile)
                }
                className="rounded-xl bg-forest-950 px-5 py-2.5 text-sm font-bold tracking-wide text-cream-100 hover:bg-forest-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingProof ? "Verifying…" : "Submit Proof"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-forest-950 px-5 py-3 text-sm font-semibold text-cream-100 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          {toast}
        </div>
      )}
    </div>
  );
}
