"use client";

import { useState, useEffect, useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Bot,
  Check,
  Droplets,
  Flag,
  HeartPulse,
  Leaf,
  Pencil,
  Repeat,
  Smile,
  Sprout,
  Star,
  X,
  Zap,
  type LucideIcon
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/lib/toast";
import {
  PageHeader,
  Panel,
  Pill,
  primaryButton,
  secondaryButton,
  inputClass
} from "@/components/game-ui";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
// VERDICT_STYLES stays the single source for verdict labels/mapping; the
// logbook styling below re-inks it with theme status vars instead of the
// banner treatment it ships with.
import { VERDICT_STYLES, type VerdictKey } from "@/lib/ui-shared";
import { StaggerContainer, StaggerItem } from "@/lib/animations";

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

// Logbook identity: each entry gets a category tint tile from the [data-theme]
// category palette (theme vars only — never hexes) plus a matching lucide glyph.
const CATEGORY_ACCENT: Record<string, { hex: string; icon: LucideIcon }> = {
  water: { hex: "var(--accent-teal)", icon: Droplets },
  health: { hex: "var(--accent-blue)", icon: HeartPulse },
  wellbeing: { hex: "var(--accent-slate)", icon: Smile },
  energy: { hex: "var(--accent-gold)", icon: Zap },
  habits: { hex: "var(--accent-sage)", icon: Sprout }
};

function categoryAccent(category: string): { hex: string; icon: LucideIcon } {
  return CATEGORY_ACCENT[category] ?? CATEGORY_ACCENT.habits;
}

// Tint helper — mix any theme var into the current panel color.
const wash = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, var(--bg-panel))`;

// Human repeat-window hint for the logbook entry ("every 2 days" etc.).
function repeatHint(seconds: number): string | null {
  if (!seconds || seconds <= 0) return null;
  if (seconds % 86400 === 0) {
    const d = seconds / 86400;
    return d === 1 ? "Repeats daily" : `Every ${d} days`;
  }
  if (seconds % 3600 === 0) {
    const h = seconds / 3600;
    return `Every ${h} hour${h === 1 ? "" : "s"}`;
  }
  const m = Math.round(seconds / 60);
  return `Every ${m} min`;
}

// Trust ink shifts from gold (low) toward green (high) via color-mix — a pure
// theme-var gradient hint, no hardcoded hexes in any of the 6 palettes.
function trustInk(score: number): string {
  return `color-mix(in srgb, var(--accent-green) ${Math.max(0, Math.min(100, score))}%, var(--accent-gold))`;
}

// ── Trust leaf gauge ─────────────────────────────────────────
// 0–100 trust shown as a meter of small leaf segments: filled leaves carry the
// gold→green trust ink, empty leaves stay a faint wash of the same ink.
function TrustLeafGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const segments = 10;
  const filled = Math.round(clamped / segments);
  const ink = trustInk(clamped);

  return (
    <div className="flex items-center gap-3" role="img" aria-label={`Trust ${Math.round(clamped)} of 100`}>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.875rem]"
        style={{ background: wash("var(--accent-green)", 12), color: "var(--accent-green-text)" }}
        aria-hidden="true"
      >
        <Leaf className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="fg-botlabel">Trust</p>
          <p className="text-xs font-extrabold text-ink">
            {Math.round(clamped)}<span className="font-bold text-ink-muted">/100</span>
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex flex-1 gap-0.5" aria-hidden="true">
            {Array.from({ length: segments }, (_, i) => (
              <Leaf
                key={i}
                className="h-4 w-4"
                strokeWidth={2}
                style={i < filled ? { color: ink, fill: wash(trustInk(clamped), 55) } : { color: "color-mix(in srgb, var(--text-secondary) 30%, transparent)", fill: "color-mix(in srgb, var(--text-secondary) 12%, transparent)" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Logbook entry card ───────────────────────────────────────
// One habit = one entry card: tinted category tile, title, repeat-window
// hint, XP chip, and a 48px "Log habit" button (full-width on phones).
function LogEntryCard({ mission, onLog }: { mission: Mission; onLog: () => void }) {
  const accent = categoryAccent(mission.category).hex;
  const Icon = categoryAccent(mission.category).icon;
  const hint = repeatHint(mission.repeat_window_seconds);

  return (
    <article
      className="rounded-card border p-3.5 shadow-elev-1 transition hover:-translate-y-0.5 hover:shadow-elev-2 sm:p-4"
      style={{
        background: wash(accent, 5),
        borderColor: `color-mix(in srgb, ${accent} 22%, var(--border-default))`
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.875rem]"
          style={{ background: wash(accent, 14), color: accent }}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[0.9375rem] font-bold leading-snug text-ink">
            {mission.title}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] font-bold text-ink-muted">
            <span>{mission.category}</span>
            {hint && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
                {hint}
              </span>
            )}
            {mission.metadata?.unitHint && <span>Measure in: {mission.metadata.unitHint}</span>}
          </p>
        </div>
        <span className="fg-chip fg-chip-xp shrink-0">+{mission.base_xp} XP</span>
      </div>
      <button
        type="button"
        onClick={onLog}
        className={`mt-3 w-full sm:ml-14 sm:w-auto ${primaryButton}`}
      >
        Log habit
      </button>
    </article>
  );
}

// ── Confidence selector ──────────────────────────────────────
// Same 1–5 value/contract as before, restyled as 5 friendly confidence buttons
// with the picked level spelled out underneath.
const CONFIDENCE_LABELS = ["Very unsure", "Low", "Fairly sure", "Sure", "Very sure"];

function ConfidenceSelector({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const active = value >= 1 && value <= 5 ? CONFIDENCE_LABELS[value - 1] : "";
  return (
    <div>
      <div className="flex gap-1.5">
        {CONFIDENCE_LABELS.map((label, i) => {
          const v = i + 1;
          const on = value === v;
          return (
            <button
              key={v}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={on}
              onClick={() => onChange(v)}
              className={`min-h-11 flex-1 rounded-input border py-2 font-serif text-sm font-bold transition active:scale-95 ${
                on
                  ? "border-transparent shadow-elev-1"
                  : "border-line-soft bg-surface-alt text-ink-muted hover:bg-surface"
              }`}
              style={on
                ? { background: "var(--pill-active-bg)", color: "var(--pill-active-text)" }
                : undefined}
            >
              {v}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-right text-micro text-ink-muted" aria-live="polite">
        {active}
      </p>
    </div>
  );
}

// ── Verdict stamp ────────────────────────────────────────────
// The logbook's ink stamp: an uppercase verdict inside a double ring, rotated
// ~-8deg, inked by the theme status vars. Pops in with a spring unless reduced
// motion is on.
const VERDICT_INK: Record<VerdictKey, { ink: string; glyph: LucideIcon }> = {
  APPROVED: { ink: "var(--text-success)", glyph: Check },
  PARTIAL: { ink: "var(--text-warning)", glyph: Star },
  REJECTED: { ink: "var(--text-error)", glyph: X },
  FLAGGED: { ink: "var(--text-error)", glyph: Flag }
};

function VerdictStamp({ status }: { status: VerificationResult["status"] }) {
  const reduced = useReducedMotion();
  const verdict = VERDICT_STYLES[status] ?? VERDICT_STYLES.REJECTED;
  const { ink, glyph: Glyph } = VERDICT_INK[status] ?? VERDICT_INK.REJECTED;

  const stamp = (
    // `transform: none` overrides the .fg-stamp base rotation so the parent
    // motion wrapper owns the single rotate; under reduced motion the wrapper
    // is skipped and the base -8deg transform is restored here.
    <span
      className="fg-stamp relative h-24 w-24 gap-0.5"
      style={{ color: ink, borderColor: ink, transform: reduced ? "rotate(-8deg)" : "none" }}
    >
      <span
        className="pointer-events-none absolute inset-1.5 rounded-full border border-dashed"
        style={{ borderColor: `color-mix(in srgb, ${ink} 55%, transparent)` }}
        aria-hidden="true"
      />
      <Glyph className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" />
      <span className="max-w-[72px] text-center font-sans text-[0.5625rem] font-extrabold leading-tight tracking-[0.08em]">
        {verdict.label}
      </span>
    </span>
  );

  if (reduced) return stamp;

  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className="inline-block origin-center"
      style={{ rotate: -8 }}
    >
      {stamp}
    </motion.span>
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

  // Accessible names for the two modal dialogs (see aria-labelledby below).
  const dialogId = useId();
  const submitTitleId = `${dialogId}-submission-title`;
  const resultTitleId = `${dialogId}-result-title`;

  const toast = useToast();

  // Guard against unauthenticated mounts: useAuth() redirects unauth visitors
  // to /login, but this effect would otherwise fire /api/private-missions first
  // and log a 401. Skipping while there's no uid also keeps the skeleton up
  // until auth resolves, so we never flash an empty list before the redirect.
  useEffect(() => {
    let cancelled = false;
    async function loadMissions() {
      if (!user?.uid) return;
      try {
        const res = await fetch("/api/private-missions", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setMissions(data.missions ?? []);
        }
      } catch (err) {
        console.error("Error loading habits:", err);
      } finally {
        if (!cancelled) setLoadingMissions(false);
      }
    }
    loadMissions();
    return () => { cancelled = true; };
  }, [user?.uid]);

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
        toast.success(`Habit logged! +${data.rewards.xpAwarded} XP earned.`);
      } else if (data.verification?.status === "PARTIAL") {
        toast.success(`Partial credit: +${data.rewards.xpAwarded} XP. See feedback below.`);
      } else {
        toast.show("Submission reviewed — see feedback below.");
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const trustScore = Number(profile?.trustScore ?? 50);
  const xp = Number(profile?.xp ?? 0);
  const level = Number(profile?.level ?? 1);

  if (loadingMissions) {
    return <PageSkeleton metricCount={0} hero={false} panels={[{ rows: 5 }, { rows: 3 }]} />;
  }

  return (
    <>
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
        <PageHeader
          title="Your eco-habit logbook"
          description="Log today's eco habits. Each verified entry earns XP and builds your trust."
          action={
            <div className="w-full rounded-card border border-line-soft bg-surface-alt px-4 py-3 sm:w-72">
              <TrustLeafGauge score={trustScore} />
            </div>
          }
        />
      </StaggerItem>

      <StaggerItem as="section">
        <Panel
          eyebrow="Today's forage"
          title="Habit missions"
          action={
            <div className="flex max-w-full flex-wrap items-center justify-start gap-1.5 sm:justify-end">
              <span className="fg-chip fg-chip-xp">{xp.toLocaleString()} XP</span>
              <span className="fg-chip fg-chip-coins">Level {level}</span>
              <Pill>{missions.length} available</Pill>
            </div>
          }
        >
          {missions.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={<Sprout className="h-7 w-7" strokeWidth={2} />}
              title="No habit missions available right now."
              description="New entries get added to the logbook — check back soon."
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {missions.map((mission) => (
                <LogEntryCard
                  key={mission.id}
                  mission={mission}
                  onLog={() => openMission(mission)}
                />
              ))}
            </div>
          )}
        </Panel>
      </StaggerItem>

      <StaggerItem as="section">
        <Panel eyebrow="How it works" title="About habit verification">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Pencil,
                title: "Describe your action",
                desc: "Write what you did specifically — the more detail, the better your verification score."
              },
              {
                icon: Bot,
                title: "AI reviews it",
                desc: "Your submission is checked for realism, consistency, and behavioral plausibility."
              },
              {
                icon: Star,
                title: "Earn XP & trust",
                desc: "Approved submissions earn XP that scales with your trust score — it starts at 40% and grows to full XP as your history builds."
              }
            ].map(({ icon: StepIcon, title, desc }) => (
              <div
                key={title}
                className="rounded-card border border-line-soft bg-surface-alt p-4"
              >
                <span
                  className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-[0.875rem]"
                  style={{ background: wash("var(--text-accent)", 12), color: "var(--text-accent)" }}
                  aria-hidden="true"
                >
                  <StepIcon className="h-4.5 w-4.5" strokeWidth={2.2} />
                </span>
                <p className="text-sm font-bold text-ink">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{desc}</p>
              </div>
            ))}
          </div>
        </Panel>
      </StaggerItem>
    </StaggerContainer>

      {/* ── Submission Modal ── */}
      {activeMission && !result && (
        <Dialog
          open
          onClose={closeModal}
          size="lg"
          labelledby={submitTitleId}
          footer={
            <>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || description.trim().length < 8}
                className={`flex-1 ${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[color-mix(in_srgb,var(--text-sidebar)_40%,transparent)] border-t-[var(--text-sidebar)]" />
                    Verifying...
                  </span>
                ) : (
                  "Submit & Verify"
                )}
              </button>
              <button type="button" onClick={closeModal} className={secondaryButton}>
                Cancel
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input"
                  style={{
                    background: wash(categoryAccent(activeMission.category).hex, 14),
                    color: categoryAccent(activeMission.category).hex
                  }}
                  aria-hidden="true"
                >
                  {(() => {
                    const TileIcon = categoryAccent(activeMission.category).icon;
                    return <TileIcon className="h-4.5 w-4.5" strokeWidth={2.2} />;
                  })()}
                </span>
                <div className="min-w-0">
                  <p className="fg-botlabel">Logbook entry · {activeMission.category}</p>
                  <h3
                    id={submitTitleId}
                    className="mt-0.5 font-serif text-xl font-bold leading-tight text-ink"
                  >
                    {activeMission.title}
                  </h3>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="fg-chip fg-chip-xp">{activeMission.base_xp} base XP</span>
                {activeMission.metadata?.unitHint && (
                  <Pill>Measure in {activeMission.metadata.unitHint}</Pill>
                )}
              </div>
            </div>

            {activeMission.metadata?.preferredBeforeAfter && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-ink-muted">
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
                  <label className="mb-1 block text-xs font-bold text-ink-muted">
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
              <label className="mb-1.5 block text-xs font-bold text-ink-muted">
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
                className={`mt-1 text-right text-micro font-bold ${description.trim().length >= 8 ? "text-accent" : "text-status-danger"}`}
              >
                {description.trim().length}/8 min characters
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink-muted">
                How sure are you?
              </label>
              <ConfidenceSelector value={confidence} onChange={setConfidence} />
            </div>

            {submitError && <ErrorBanner>{submitError}</ErrorBanner>}
          </div>
        </Dialog>
      )}

      {/* ── Result Modal ── */}
      {activeMission && result && (
        <Dialog
          open
          onClose={closeModal}
          size="lg"
          labelledby={resultTitleId}
          footer={<button type="button" onClick={closeModal} className={`w-full ${primaryButton}`}>Done</button>}
        >
          <div className="flex flex-col gap-5">
            {/* Verdict header — rotated ink stamp + outcome facts */}
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
              <VerdictStamp status={result.verification.status} />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p id={resultTitleId} className="fg-botlabel">
                  Verification result
                </p>
                <p className="mt-0.5 text-xs font-semibold text-ink-soft">
                  {result.verification.confidence}% confidence ·{" "}
                  {result.verification.realism_score}% realism
                </p>
                <div className="mt-2.5 flex items-center justify-center gap-2 sm:justify-start">
                  <span className="fg-chip fg-chip-xp text-sm">
                    +{result.rewards.xpAwarded} XP
                  </span>
                  <span className="text-[0.6875rem] font-bold text-ink-muted">
                    of {result.rewards.baseXp} base XP
                  </span>
                </div>
              </div>
            </div>

            {/* Gemini reasoning */}
            <div className="rounded-card border border-line-soft bg-surface-alt px-4 py-3.5">
              <p className="fg-botlabel mb-1.5">
                Verification notes
              </p>
              <p className="text-xs leading-relaxed text-ink">
                {result.verification.reasoning}
              </p>
              {result.verification.risk_flags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {result.verification.risk_flags.map((flag) => (
                    <span
                      key={flag}
                      className="chip-danger rounded-full px-2 py-0.5 text-micro font-bold"
                    >
                      {flag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Trust before / delta / now — the delta is the emphasized chip */}
            <div className="grid grid-cols-3 items-stretch gap-2 text-center">
              <div className="rounded-card border border-line-soft bg-surface-alt py-3">
                <p className="fg-botlabel">Before</p>
                <p className="mt-1 font-serif text-lg font-bold leading-none text-ink-soft">
                  {result.trust.previousScore.toFixed(1)}
                </p>
              </div>
              <div
                className="rounded-card border py-2"
                style={{
                  borderColor: `color-mix(in srgb, ${result.trust.delta >= 0 ? "var(--text-success)" : "var(--text-error)"} 35%, var(--border-default))`,
                  background: wash(result.trust.delta >= 0 ? "var(--text-success)" : "var(--text-error)", 10)
                }}
              >
                <p className="fg-botlabel" style={{ color: "var(--text-muted)" }}>Change</p>
                <p
                  className="mt-1 font-serif text-xl font-black leading-none"
                  style={{ color: result.trust.delta >= 0 ? "var(--text-success)" : "var(--text-error)" }}
                >
                  {result.trust.delta >= 0 ? "+" : ""}
                  {result.trust.delta.toFixed(1)}
                </p>
              </div>
              <div className="rounded-card border border-line-soft bg-surface-alt py-3">
                <p className="fg-botlabel">Now</p>
                <p className="mt-1 font-serif text-lg font-bold leading-none text-ink">
                  {result.trust.nextScore.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}