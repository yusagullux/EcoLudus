// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  HeroMetric,
  MetricCard,
  PageHero,
  Panel,
  Pill,
  primaryButton,
  secondaryButton,
  inputClass
} from "@/components/game-ui";

type Mission = {
  id: string;
  title: string;
  category: string;
  base_xp: number;
  repeat_window_seconds: number;
  metadata: {
    preferredBeforeAfter?: boolean;
    unitHint?: string;
  };
};

type VerificationResult = {
  status: "APPROVED" | "PARTIAL" | "REJECTED" | "FLAGGED";
  confidence: number;
  realism_score: number;
  reasoning: string;
  risk_flags: string[];
};

type SubmissionResult = {
  submission: { id: string; status: string };
  verification: VerificationResult;
  rewards: {
    xpAwarded: number;
    baseXp: number;
    trustMultiplier: number;
  };
  trust: {
    previousScore: number;
    nextScore: number;
    delta: number;
  };
};

const VERDICT_STYLES: Record<
  string,
  { bg: string; text: string; border: string; icon: string; label: string }
> = {
  APPROVED: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: "✓",
    label: "Approved"
  },
  PARTIAL: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: "◐",
    label: "Partial Credit"
  },
  REJECTED: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    icon: "✗",
    label: "Rejected"
  },
  FLAGGED: {
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-300",
    icon: "⚑",
    label: "Flagged"
  }
};

const CATEGORY_COLORS: Record<string, string> = {
  water: "#237482",
  health: "#2f5f86",
  wellbeing: "#62508f",
  energy: "#9a6b1f",
  habits: "#2f6b46"
};

function CategoryDot({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? "#4c7a3b";
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

function ConfidenceSelector({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const labels = ["Very Low", "Low", "Medium", "High", "Very High"];
  return (
    <div className="flex gap-1.5">
      {labels.map((label, i) => {
        const v = i + 1;
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            title={label}
            onClick={() => onChange(v)}
            className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition ${
              active
                ? "bg-forest-950 text-cream-100 shadow-sm"
                : "bg-forest-50 text-forest-700 hover:bg-forest-100"
            }`}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

export default function HabitsPage() {
  const { user, profile, refreshProfile } = useAuth();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);

  // Form state
  const [beforeValue, setBeforeValue] = useState("");
  const [afterValue, setAfterValue] = useState("");
  const [description, setDescription] = useState("");
  const [confidence, setConfidence] = useState(3);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    async function loadMissions() {
      try {
        const res = await fetch("/api/private-missions", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setMissions(data.missions ?? []);
        }
      } catch (err) {
        console.error("Error loading habits:", err);
      } finally {
        setLoadingMissions(false);
      }
    }
    loadMissions();
  }, []);

  function openMission(mission: Mission) {
    setActiveMission(mission);
    setBeforeValue("");
    setAfterValue("");
    setDescription("");
    setConfidence(3);
    setSubmitError(null);
    setResult(null);
  }

  function closeModal() {
    setActiveMission(null);
    setResult(null);
    setSubmitError(null);
  }

  async function handleSubmit() {
    if (!activeMission || !user?.uid || submitting) return;

    if (description.trim().length < 8) {
      setSubmitError("Please describe what you did (min 8 characters).");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const body: Record<string, unknown> = {
        missionId: activeMission.id,
        userId: user.uid,
        description: description.trim(),
        confidence,
        timestamp: new Date().toISOString()
      };

      if (beforeValue.trim()) body.beforeValue = beforeValue.trim();
      if (afterValue.trim()) body.afterValue = afterValue.trim();

      const res = await fetch("/api/private-missions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errCode = data?.error?.code ?? "";
        const msg =
          errCode === "missions/duplicate-window"
            ? "You already submitted this habit today. Come back tomorrow!"
            : errCode === "missions/rate-limited"
            ? "You're submitting too fast. Please slow down."
            : data?.error?.message || "Submission failed. Please try again.";
        setSubmitError(msg);
        return;
      }

      setResult(data);
      await refreshProfile();

      if (data.verification?.status === "APPROVED") {
        showToast(`Habit logged! +${data.rewards.xpAwarded} XP earned.`);
      } else if (data.verification?.status === "PARTIAL") {
        showToast(`Partial credit: +${data.rewards.xpAwarded} XP. See feedback below.`);
      } else {
        showToast("Submission reviewed — see feedback below.");
      }
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  const trustScore = Number(profile?.trustScore ?? 50);
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;

  const trustLabel =
    trustScore >= 75
      ? "High Trust"
      : trustScore >= 45
      ? "Moderate Trust"
      : trustScore >= 25
      ? "Building Trust"
      : "Low Trust";

  const trustColor =
    trustScore >= 75
      ? "#2f6b46"
      : trustScore >= 45
      ? "#9a6b1f"
      : trustScore >= 25
      ? "#2f5f86"
      : "#c0392b";

  if (loadingMissions) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <div className="logo-breathe h-14 w-14 overflow-hidden rounded-2xl bg-white shadow-[0_18px_38px_rgba(16,33,20,0.16)] ring-1 ring-forest-900/10">
          <img
            src="/images/logo.png"
            alt="EcoLudus logo"
            className="h-full w-full object-cover"
          />
        </div>
        <p className="text-sm font-semibold text-forest-800">Loading habit missions...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Daily habits"
        title="Habit Tracker"
        description="Log your daily eco habits. Each verified submission earns XP and builds your trust score."
      >
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="XP" value={xp.toLocaleString()} />
          <HeroMetric label="Level" value={level} />
          <HeroMetric
            label={trustLabel}
            value={`${Math.round(trustScore)}/100`}
          />
        </div>
      </PageHero>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard
          label="Trust Score"
          value={`${Math.round(trustScore)}/100`}
          accent={trustColor}
        />
        <MetricCard label="XP Earned" value={xp.toLocaleString()} accent="#2f6b46" />
        <MetricCard label="Level" value={`Level ${level}`} accent="#2f5f86" />
      </div>

      <Panel
        eyebrow="Available habits"
        title="Today's Habit Missions"
        action={<Pill>{missions.length} missions</Pill>}
      >
        {missions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-forest-700/60">
            <span className="text-4xl">🌱</span>
            <p className="text-sm font-bold">No habit missions available right now.</p>
          </div>
        ) : (
          <div className="-mx-5 -mt-5 divide-y divide-[#e7ecdf] sm:-mx-6 sm:-mt-6">
            {missions.map((mission) => {
              const color = CATEGORY_COLORS[mission.category] ?? "#4c7a3b";
              const unitHint = mission.metadata?.unitHint ?? "";
              const wantsBeforeAfter = mission.metadata?.preferredBeforeAfter ?? false;
              return (
                <div
                  key={mission.id}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-[#f4f7ef] sm:px-6"
                >
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-forest-700/60">
                      {mission.category}
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold text-forest-950">
                      {mission.title}
                    </p>
                    {unitHint && (
                      <p className="mt-0.5 text-xs font-semibold text-forest-700/50">
                        Measure in: {unitHint}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Pill>+{mission.base_xp} XP</Pill>
                    <button
                      type="button"
                      onClick={() => openMission(mission)}
                      className="rounded-full bg-forest-950 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-cream-100 transition hover:bg-forest-800"
                    >
                      Log habit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel eyebrow="How it works" title="About Habit Verification">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: "✏️",
              title: "Describe your action",
              desc: "Write what you did specifically — the more detail, the better your verification score."
            },
            {
              icon: "🤖",
              title: "AI reviews it",
              desc: "Your submission is checked for realism, consistency, and behavioral plausibility."
            },
            {
              icon: "⭐",
              title: "Earn XP & trust",
              desc: "Approved submissions give full XP. Trust score grows over time and unlocks multipliers."
            }
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rounded-2xl bg-[#f4f7ef] p-4">
              <div className="mb-2 text-2xl">{icon}</div>
              <p className="text-sm font-extrabold text-forest-950">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-forest-700/62">{desc}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── Submission Modal ── */}
      {activeMission && !result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#dce6d8] bg-[#fffefa] p-6 shadow-[0_24px_70px_rgba(16,33,20,0.25)]">
            <button
              onClick={closeModal}
              className="absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-forest-100 text-forest-900 hover:bg-forest-200 transition text-lg font-bold"
              aria-label="Close"
            >
              ×
            </button>

            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-500">
                  Log habit
                </p>
                <h3 className="mt-1 font-serif text-xl font-bold text-forest-950">
                  {activeMission.title}
                </h3>
                <p className="mt-1 text-xs font-semibold text-forest-700/54">
                  Category: {activeMission.category} · Base reward: {activeMission.base_xp} XP
                </p>
              </div>

              {activeMission.metadata?.preferredBeforeAfter && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-forest-700/70">
                      Before{activeMission.metadata.unitHint ? ` (${activeMission.metadata.unitHint})` : ""}
                    </label>
                    <input
                      type="text"
                      value={beforeValue}
                      onChange={(e) => setBeforeValue(e.target.value)}
                      placeholder={`e.g. 20 ${activeMission.metadata.unitHint ?? ""}`}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-forest-700/70">
                      After{activeMission.metadata.unitHint ? ` (${activeMission.metadata.unitHint})` : ""}
                    </label>
                    <input
                      type="text"
                      value={afterValue}
                      onChange={(e) => setAfterValue(e.target.value)}
                      placeholder={`e.g. 12 ${activeMission.metadata.unitHint ?? ""}`}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-forest-700/70">
                  Describe what you did *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`e.g. I ${activeMission.title.toLowerCase()} today by...`}
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
                <p
                  className={`mt-1 text-right text-[10px] font-bold ${
                    description.trim().length >= 8 ? "text-forest-600" : "text-rose-500"
                  }`}
                >
                  {description.trim().length}/8 min characters
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em] text-forest-700/70">
                  Self-confidence (1 = very unsure, 5 = very sure)
                </label>
                <ConfidenceSelector value={confidence} onChange={setConfidence} />
              </div>

              {submitError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                  {submitError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || description.trim().length < 8}
                  className={`flex-1 ${primaryButton}`}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream-100/40 border-t-cream-100" />
                      Verifying...
                    </span>
                  ) : (
                    "Submit & Verify"
                  )}
                </button>
                <button onClick={closeModal} className={secondaryButton}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Result Modal ── */}
      {activeMission && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[#dce6d8] bg-[#fffefa] p-6 shadow-[0_24px_70px_rgba(16,33,20,0.25)]">
            <div className="flex flex-col gap-5">
              {/* Verdict header */}
              {(() => {
                const style =
                  VERDICT_STYLES[result.verification.status] ?? VERDICT_STYLES.REJECTED;
                return (
                  <div
                    className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${style.bg} ${style.border}`}
                  >
                    <span className={`text-3xl font-extrabold ${style.text}`}>
                      {style.icon}
                    </span>
                    <div>
                      <p className={`text-sm font-extrabold ${style.text}`}>
                        {style.label}
                      </p>
                      <p className={`mt-0.5 text-xs font-semibold ${style.text} opacity-80`}>
                        {result.verification.confidence}% confidence ·{" "}
                        {result.verification.realism_score}% realism
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className={`text-xl font-extrabold ${style.text}`}>
                        +{result.rewards.xpAwarded} XP
                      </p>
                      <p className={`text-[10px] font-bold ${style.text} opacity-70`}>
                        of {result.rewards.baseXp} base XP
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Gemini reasoning */}
              <div className="rounded-xl bg-[#f4f7ef] px-4 py-3">
                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-600">
                  Verification feedback
                </p>
                <p className="text-xs leading-relaxed text-forest-900">
                  {result.verification.reasoning}
                </p>
                {result.verification.risk_flags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.verification.risk_flags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700"
                      >
                        {flag.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Trust delta */}
              <div className="grid grid-cols-3 divide-x divide-[#e7ecdf] rounded-xl border border-[#e7ecdf] bg-white text-center">
                <div className="py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-forest-600">
                    Trust before
                  </p>
                  <p className="mt-0.5 text-sm font-extrabold text-forest-950">
                    {result.trust.previousScore.toFixed(1)}
                  </p>
                </div>
                <div className="py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-forest-600">
                    Change
                  </p>
                  <p
                    className={`mt-0.5 text-sm font-extrabold ${
                      result.trust.delta >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {result.trust.delta >= 0 ? "+" : ""}
                    {result.trust.delta.toFixed(1)}
                  </p>
                </div>
                <div className="py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-forest-600">
                    Trust now
                  </p>
                  <p className="mt-0.5 text-sm font-extrabold text-forest-950">
                    {result.trust.nextScore.toFixed(1)}
                  </p>
                </div>
              </div>

              <button
                onClick={closeModal}
                className={`w-full ${primaryButton}`}
              >
                Done
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
