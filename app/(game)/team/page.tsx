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

  useEffect(() => {
    async function fetchTeamData() {
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
        }
      } catch (error) {
        console.error("Failed to fetch team data:", error);
        setJoined(false);
      } finally {
        setLoading(false);
      }
    }

    fetchTeamData();
  }, [user?.uid]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowJoinModal(false);
    setInputVal("");
  };

  const handleCreateTeam = async () => {
    if (!inputVal.trim() || !user?.uid) return;

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", userId: user.uid, teamName: inputVal.trim() })
      });
      const data = await response.json();

      if (response.ok) {
        setJoined(true);
        closeModals();
        showToast(`Team "${inputVal}" created! Code: ${data.code}`);
        // Refresh team data
        const teamResponse = await fetch(`/api/teams?userId=${user.uid}`);
        const teamData = await teamResponse.json();
        if (teamData.team) {
          setTeam(teamData.team);
          setActiveMissions(teamData.activeMissions || []);
        }
      } else {
        showToast(data.error?.code || "Failed to create team");
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
        setJoined(true);
        closeModals();
        showToast(`Joined team "${data.teamName}"!`);
        // Refresh team data
        const teamResponse = await fetch(`/api/teams?userId=${user.uid}`);
        const teamData = await teamResponse.json();
        if (teamData.team) {
          setTeam(teamData.team);
          setActiveMissions(teamData.activeMissions || []);
        }
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
                {team?.members?.map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-white px-4 py-3 hover:bg-forest-50/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-50 text-base">
                        {m.role === "leader" ? "👑" : "🌿"}
                      </div>
                      <span className="text-sm font-semibold text-forest-950">{m.name}</span>
                    </div>
                    <span className="text-xs font-bold text-forest-700">{m.xp.toLocaleString()} XP</span>
                  </div>
                ))}
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
            <div className="flex flex-col gap-3">
              {activeMissions.map((m) => {
                const pct = Math.round((m.done / m.needed) * 100);
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
                      onClick={() => showToast("Progress submitted!")}
                      className="mt-4 rounded-xl bg-forest-950 px-5 py-2.5 text-xs font-bold tracking-wide text-cream-100 hover:bg-forest-800 active:scale-[0.98] transition-all"
                    >
                      Submit Progress
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Mission Library ── */}
          <div className="rounded-2xl border border-forest-100 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-500">Mission library</p>
            <h2 className="mt-0.5 mb-5 font-serif text-xl font-bold text-forest-950">Assign New Mission</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {missionTemplates.map((t) => (
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
                    onClick={() => showToast(`"${t.title}" assigned!`)}
                    className="mt-auto rounded-xl bg-forest-950 px-4 py-2.5 text-xs font-bold tracking-wide text-cream-100 hover:bg-forest-800 active:scale-[0.98] transition-all"
                  >
                    Assign
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Team Leaderboard ── */}
          <div className="rounded-2xl border border-forest-100 bg-white shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-forest-50">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-500">Ranking</p>
              <h2 className="mt-0.5 font-serif text-xl font-bold text-forest-950">Team Leaderboard</h2>
            </div>
            <div className="divide-y divide-forest-50">
              {[...(team?.members || [])].sort((a: any, b: any) => b.xp - a.xp).map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-4 px-6 py-3.5 hover:bg-forest-50/60 transition-colors">
                  <span className="w-6 text-center font-serif text-base font-black text-forest-300">#{i + 1}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-50 text-base">
                    {m.role === "leader" ? "👑" : "🌿"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-forest-950">{m.name}</p>
                    <p className="text-xs capitalize text-forest-400">{m.role}</p>
                  </div>
                  <span className="font-serif text-base font-bold text-forest-700">{m.xp.toLocaleString()} XP</span>
                </div>
              ))}
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

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-forest-950 px-5 py-3 text-sm font-semibold text-cream-100 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          {toast}
        </div>
      )}
    </div>
  );
}
