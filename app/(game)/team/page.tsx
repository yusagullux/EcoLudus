// @ts-nocheck
"use client";

import { useState } from "react";
import { MetricCard, PageHero, Panel, Pill, ProgressBar, inputClass, primaryButton, secondaryButton } from "@/components/game-ui";

const missionTemplates = [
  { id: "t1", title: "Recycle 15 Plastic Bottles", desc: "Split the work and recycle at least 15 plastic bottles as a team.", mark: "RC", difficulty: "Easy", xp: 240, eco: 140, needed: 3 },
  { id: "t2", title: "Clean One Shared Area", desc: "Pick a park block or stairwell and leave it visibly better.", mark: "CL", difficulty: "Easy", xp: 260, eco: 160, needed: 3 },
  { id: "t3", title: "Commute Sustainably", desc: "At least 3 teammates bike, walk or take transit instead of a car.", mark: "TR", difficulty: "Medium", xp: 300, eco: 180, needed: 3 },
  { id: "t4", title: "Save 50 Liters of Water", desc: "Collectively save about 50 liters through shorter showers.", mark: "WA", difficulty: "Medium", xp: 320, eco: 190, needed: 3 },
  { id: "t5", title: "Night Power Down", desc: "Unplug unused chargers/devices across at least 3 households.", mark: "EN", difficulty: "Easy", xp: 220, eco: 130, needed: 2 },
  { id: "t6", title: "Plant or Care for 3 Greens", desc: "Plant seeds or tend to three different plants as a joint effort.", mark: "GD", difficulty: "Easy", xp: 210, eco: 120, needed: 3 }
];

const mockTeam = {
  name: "Green Guardians",
  code: "GRN7X4",
  role: "leader",
  stats: { xp: 1240, eco: 620, missions: 8, members: 4 },
  members: [
    { name: "You (Leader)", role: "leader", xp: 2480 },
    { name: "EcoWalker", role: "member", xp: 1320 },
    { name: "ForestSpirit", role: "member", xp: 980 },
    { name: "GreenSeed", role: "member", xp: 440 }
  ]
};

const activeMissions = [
  { id: "am1", title: "Recycle 15 Plastic Bottles", mark: "RC", xp: 240, eco: 140, needed: 3, done: 2 }
];

export default function TeamPage() {
  const [joined, setJoined] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Cooperative play" title="Team Hub" description="Collaborate on eco goals, share progress, and keep group momentum visible.">
        <div className="flex flex-wrap gap-3">
          {!joined ? (
            <>
              <button onClick={() => setShowCreateModal(true)} className={primaryButton}>Create Team</button>
              <button onClick={() => setShowJoinModal(true)} className={secondaryButton}>Join via Code</button>
            </>
          ) : (
            <button
              onClick={() => {
                setJoined(false);
                showToast("Left the team.");
              }}
              className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/8 px-5 py-2.5 text-xs font-extrabold uppercase tracking-[0.1em] text-cream-100 transition hover:-translate-y-0.5 hover:bg-white/12"
            >
              Leave Team
            </button>
          )}
        </div>
      </PageHero>

      {!joined ? (
        <Panel className="min-h-[320px]">
          <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-100 text-xl font-extrabold text-forest-800">TM</span>
            <div>
              <h2 className="font-serif text-3xl font-extrabold text-forest-950">You are not part of a team yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-forest-800/66">Create a squad or join an existing one with a 6-character code.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => setShowCreateModal(true)} className={primaryButton}>Start a Team</button>
              <button onClick={() => setShowJoinModal(true)} className={secondaryButton}>Have a Code?</button>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <Panel
            eyebrow="Your team"
            title={mockTeam.name}
            action={<button onClick={() => { navigator.clipboard?.writeText(mockTeam.code); showToast("Code copied!"); }} className={secondaryButton}>Copy Code</button>}
          >
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Pill>Code: {mockTeam.code}</Pill>
              <Pill active>{mockTeam.role}</Pill>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="XP Shared" value={mockTeam.stats.xp.toLocaleString()} accent="#2f6b46" />
              <MetricCard label="Eco Shared" value={mockTeam.stats.eco.toLocaleString()} accent="#237482" />
              <MetricCard label="Cleared" value={mockTeam.stats.missions} accent="#9a6b1f" />
              <MetricCard label="Members" value={mockTeam.stats.members} accent="#62508f" />
            </div>
            <div className="mt-6 grid gap-2">
              {mockTeam.members.map((member, index) => (
                <div key={index} className="flex items-center justify-between rounded-2xl border border-[#dfe7d7] bg-[#f7f9f2] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-extrabold text-forest-800">{member.role === "leader" ? "LD" : "MB"}</span>
                    <span className="text-sm font-extrabold text-forest-950">{member.name}</span>
                  </div>
                  <span className="text-xs font-extrabold text-forest-700">{member.xp.toLocaleString()} XP</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Active missions" title="Team Missions" action={<Pill>{activeMissions.length}/3 active</Pill>}>
            {activeMissions.map((mission) => {
              const pct = Math.round((mission.done / mission.needed) * 100);
              return (
                <article key={mission.id} className="rounded-2xl border border-[#dfe7d7] bg-[#f7f9f2] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xs font-extrabold text-forest-800">{mission.mark}</span>
                      <p className="font-serif text-xl font-extrabold text-forest-950">{mission.title}</p>
                    </div>
                    <div className="flex gap-2">
                      <Pill>+{mission.xp} XP</Pill>
                      <Pill>+{mission.eco} Eco</Pill>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1"><ProgressBar value={pct} color="#2f6b46" /></div>
                    <span className="text-xs font-extrabold text-forest-700">{mission.done}/{mission.needed} submissions</span>
                  </div>
                  <button onClick={() => showToast("Progress submitted!")} className={`mt-4 ${primaryButton}`}>Submit Progress</button>
                </article>
              );
            })}
          </Panel>

          <Panel eyebrow="Mission library" title="Assign New Mission">
            <div className="grid gap-4 sm:grid-cols-2">
              {missionTemplates.map((template) => (
                <article key={template.id} className="flex flex-col gap-3 rounded-2xl border border-[#dfe7d7] bg-[#f7f9f2] p-4 transition hover:-translate-y-0.5 hover:bg-white">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-extrabold text-forest-800 shadow-sm">{template.mark}</span>
                    <div>
                      <p className="font-serif text-lg font-extrabold leading-tight text-forest-950">{template.title}</p>
                      <p className="mt-1 text-xs leading-5 text-forest-800/64">{template.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill>{template.difficulty}</Pill>
                    <Pill>+{template.xp} XP</Pill>
                    <Pill>+{template.eco} Eco</Pill>
                    <Pill>{template.needed} teammates</Pill>
                  </div>
                  <button onClick={() => showToast(`"${template.title}" assigned!`)} className={`mt-auto ${primaryButton}`}>Assign</button>
                </article>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Ranking" title="Team Leaderboard">
            <div className="grid gap-2">
              {[...mockTeam.members].sort((a, b) => b.xp - a.xp).map((member, index) => (
                <div key={index} className="flex items-center gap-4 rounded-2xl border border-[#dfe7d7] bg-[#f7f9f2] px-4 py-3">
                  <span className="w-8 text-center font-serif text-xl font-extrabold text-forest-700/48">#{index + 1}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-extrabold text-forest-800">{member.role === "leader" ? "LD" : "MB"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-extrabold text-forest-950">{member.name}</p>
                    <p className="text-xs font-semibold capitalize text-forest-700/54">{member.role}</p>
                  </div>
                  <span className="font-serif text-lg font-extrabold text-forest-800">{member.xp.toLocaleString()} XP</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {(showCreateModal || showJoinModal) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => { setShowCreateModal(false); setShowJoinModal(false); setInputVal(""); }}
        >
          <div className="w-full max-w-md rounded-[28px] border border-[#dfe7d7] bg-[#fffefa] p-8 shadow-[0_40px_90px_rgba(16,33,20,0.24)]" onClick={(event) => event.stopPropagation()}>
            <h3 className="font-serif text-3xl font-extrabold text-forest-950">{showCreateModal ? "Create a Team" : "Join a Team"}</h3>
            <p className="mt-2 text-sm leading-6 text-forest-800/66">{showCreateModal ? "Name your squad so friends can recognize it." : "Enter the 6-character invite code."}</p>
            <input value={inputVal} onChange={(event) => setInputVal(event.target.value)} placeholder={showCreateModal ? "Example: Green Guardians" : "Example: ECO123"} maxLength={showCreateModal ? 40 : 6} className={`mt-5 ${inputClass}`} />
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setShowCreateModal(false); setShowJoinModal(false); setInputVal(""); }} className={secondaryButton}>Cancel</button>
              <button
                onClick={() => {
                  if (!inputVal.trim()) return;
                  const submittedValue = inputVal;
                  setJoined(true);
                  setShowCreateModal(false);
                  setShowJoinModal(false);
                  setInputVal("");
                  showToast(showCreateModal ? `Team "${submittedValue}" created!` : "Joined the team!");
                }}
                className={primaryButton}
              >
                {showCreateModal ? "Create" : "Join"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-forest-950 px-6 py-3 text-sm font-extrabold text-cream-100 shadow-[0_20px_44px_rgba(16,33,20,0.3)]">
          {toast}
        </div>
      )}
    </div>
  );
}
