// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { PageHero, Panel, primaryButton, secondaryButton } from "@/components/game-ui";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();

  // Email preferences — default true (opted in)
  const [weeklyReport, setWeeklyReport] = useState<boolean>(
    profile?.emailWeeklyReport !== false
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!user?.uid || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/users/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emailWeeklyReport: weeklyReport })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to save settings.");
      }

      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Account"
        title="Settings"
        description="Manage your notification preferences and account options."
      />

      <Panel eyebrow="Notifications" title="Email Preferences">
        <div className="flex flex-col gap-4">
          <label className="flex cursor-pointer items-start gap-4 rounded-xl p-4 transition hover:bg-[#f4f7ef]">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={weeklyReport}
                onChange={(e) => setWeeklyReport(e.target.checked)}
                className="sr-only"
              />
              <div
                onClick={() => setWeeklyReport((v) => !v)}
                className={`flex h-5 w-9 items-center rounded-full transition-colors ${
                  weeklyReport ? "bg-forest-950" : "bg-forest-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    weeklyReport ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-extrabold text-forest-950">Weekly Impact Report</p>
              <p className="mt-0.5 text-xs font-semibold text-forest-700/60">
                Receive a personalised weekly email every Monday with your XP earned, CO₂
                reduced, trees planted, and rank movement.
              </p>
            </div>
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          {saved && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
              ✓ Settings saved.
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className={primaryButton}>
              {saving ? "Saving..." : "Save preferences"}
            </button>
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Account info" title="Your Account">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl bg-[#f4f7ef] px-4 py-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-forest-700/60">Email</p>
            <p className="text-sm font-extrabold text-forest-950">{user?.email ?? "—"}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[#f4f7ef] px-4 py-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-forest-700/60">User ID</p>
            <p className="font-mono text-[11px] text-forest-700/50 truncate max-w-[200px]">{user?.uid ?? "—"}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
