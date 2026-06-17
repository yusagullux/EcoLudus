"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { useTheme, type Theme } from "@/lib/useTheme";
import { PageHero, Panel, primaryButton, inputClass } from "@/components/game-ui";

const THEMES: { value: Theme; label: string; desc: string; preview: string }[] = [
  {
    value: "light",
    label: "Light",
    desc: "Calm forest greens on warm cream",
    preview: "linear-gradient(135deg,#e8eee0,#faf8f0,#e2ebda)"
  },
  {
    value: "dark",
    label: "Dark",
    desc: "Deep forest night mode",
    preview: "linear-gradient(135deg,#0c1a0e,#111c12,#0e1810)"
  },
  {
    value: "liquid",
    label: "Liquid",
    desc: "Ocean-depth glassmorphism",
    preview: "linear-gradient(160deg,#0f2b4a,#1a3d5c,#0d3d3a,#0f2b1e)"
  }
];

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl md:bottom-6"
      style={{
        background: type === "success" ? "var(--bg-sidebar)" : "#ef4444",
        color: "var(--text-sidebar, #fcf9f2)"
      }}
    >
      {message}
    </div>
  );
}

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [weeklyReport, setWeeklyReport] = useState(true);

  // UI states
  const [savingProfile, setSavingProfile] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Populate from profile once loaded
  useEffect(() => {
    if (profile) {
      setDisplayName(String(profile.displayName || user?.email?.split("@")[0] || ""));
      setWeeklyReport(profile.emailWeeklyReport !== false);
    }
  }, [profile, user]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  async function handleSaveProfile() {
    if (!user?.uid || savingProfile) return;
    const name = displayName.trim();
    if (!name || name.length < 2) {
      showToast("Name must be at least 2 characters.", "error");
      return;
    }
    if (name.length > 32) {
      showToast("Name must be 32 characters or fewer.", "error");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch("/api/users/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayName: name, emailWeeklyReport: weeklyReport })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Save failed");
      await refreshProfile();
      showToast("Settings saved!");
    } catch (err: unknown) {
      showToast((err as Error).message || "Could not save settings.", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Account"
        title="Settings"
        description="Update your profile, choose a theme, and manage notifications."
      />

      {/* ── Profile ── */}
      <Panel eyebrow="Profile" title="Your Info">
        <div className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="display-name"
              className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Display name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={32}
              className={inputClass}
            />
            <p className="mt-1 text-right text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
              {displayName.trim().length}/32
            </p>
          </div>

          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: "var(--bg-panel-alt)" }}
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
              Email
            </p>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{user?.email ?? "—"}</p>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile || displayName.trim().length < 2}
            className={primaryButton}
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </div>
      </Panel>

      {/* ── Theme ── */}
      <Panel eyebrow="Appearance" title="Theme">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const active = theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className="group flex flex-col overflow-hidden rounded-2xl border-2 text-left transition hover:-translate-y-0.5"
                style={{
                  borderColor: active ? "var(--text-accent, #43653f)" : "var(--border-default)",
                  background: "var(--bg-panel)"
                }}
                aria-pressed={active}
              >
                {/* Preview swatch */}
                <div
                  className="h-16 w-full"
                  style={{ background: t.preview }}
                />
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
                      {t.label}
                    </p>
                    {active && (
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black"
                        style={{ background: "var(--text-accent, #43653f)", color: "#fff" }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                    {t.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* ── Notifications ── */}
      <Panel eyebrow="Notifications" title="Email Preferences">
        <label className="flex cursor-pointer items-start gap-4 rounded-xl p-3 transition hover:opacity-80">
          {/* Toggle */}
          <div className="relative mt-0.5 shrink-0">
            <div
              onClick={() => setWeeklyReport((v) => !v)}
              className="flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors"
              style={{ background: weeklyReport ? "var(--text-accent, #43653f)" : "var(--border-default)" }}
              role="checkbox"
              aria-checked={weeklyReport}
              tabIndex={0}
              onKeyDown={(e) => e.key === " " && setWeeklyReport((v) => !v)}
            >
              <span
                className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                style={{ transform: weeklyReport ? "translateX(18px)" : "translateX(2px)" }}
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
              Weekly Impact Report
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              A personalised email every Monday with your XP, CO₂ reduced, trees planted, and rank movement.
            </p>
          </div>
        </label>

        <div className="mt-3">
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className={primaryButton}
          >
            {savingProfile ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </Panel>

      {/* ── Account info ── */}
      <Panel eyebrow="Account" title="Details">
        <div className="flex flex-col gap-2">
          {[
            { label: "User ID", value: user?.uid ?? "—", mono: true },
            { label: "Email", value: user?.email ?? "—", mono: false }
          ].map(({ label, value, mono }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "var(--bg-panel-alt)" }}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                {label}
              </p>
              <p
                className={`max-w-[200px] truncate text-sm font-bold ${mono ? "font-mono text-[11px]" : ""}`}
                style={{ color: "var(--text-secondary)" }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
