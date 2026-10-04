"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useTheme, type Theme } from "@/lib/useTheme";
import { PageHeader, Panel, primaryButton, secondaryButton, dangerButton, inputClass } from "@/components/game-ui";
import { StaggerContainer, StaggerItem } from "@/lib/animations";
import { Avatar } from "@/components/avatar";
import { useToast } from "@/lib/toast";

const THEMES: { value: Theme; label: string; desc: string }[] = [
  { value: "light", label: "Light", desc: "Forest greens on warm cream" },
  { value: "dark", label: "Dark", desc: "Deep forest night" },
  { value: "liquid", label: "Liquid", desc: "Ocean glassmorphism" },
  { value: "dawn", label: "Dawn", desc: "Amber & terracotta on cream" },
  { value: "bloom", label: "Bloom", desc: "Magenta & rose on blush" },
  { value: "aurora", label: "Aurora", desc: "Indigo night, teal aurora" }
];

// Downscale an image file to a square of `max` px on a canvas, returned as a
// JPEG blob. Keeps uploads tiny and avoids needing server-side image processing.
function resizeImage(file: File, max: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file is not a valid image."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = max;
        canvas.height = max;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process the image in this browser."));
          return;
        }
        // Cover-fit (center-crop) into the square canvas — matches the Avatar.
        const scale = Math.max(max / img.width, max / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        ctx.drawImage(img, (max - drawW) / 2, (max - drawH) / 2, drawW, drawH);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Could not process the image."));
            return;
          }
          resolve(blob);
        }, "image/jpeg", 0.85);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

type SettingsFormProps = {
  user: ReturnType<typeof useAuth>["user"];
  profile: ReturnType<typeof useAuth>["profile"];
  refreshProfile: ReturnType<typeof useAuth>["refreshProfile"];
};

// The keyed remount unit. Deliberately kept SMALL: only the panels that own
// form state derived from the profile (Profile + Notifications). Static
// panels (theme, account details, danger zone) live in the unkeyed outer
// render, so a save-triggered remount cannot replay the page entrance.
function SettingsForm({ user, profile, refreshProfile }: SettingsFormProps) {
  // Profile fields are initialized from the profile prop. The parent remounts
  // this component with a key derived from the relevant profile fields, so we
  // never need a setState-in-effect to sync form state.
  const [displayName, setDisplayName] = useState(String(profile?.displayName || user?.email?.split("@")[0] || ""));
  const [weeklyReport, setWeeklyReport] = useState(profile?.emailWeeklyReport !== false);

  // UI states
  const [savingProfile, setSavingProfile] = useState(false);
  const toast = useToast();

  // Profile picture
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileImage = typeof profile?.profileImage === "string" ? (profile.profileImage as string) : null;
  const avatarName = displayName || user?.email?.split("@")[0] || "Explorer";

  // Shared POST — the server accepts partial bodies, so each panel sends only
  // what it owns. The notifications panel must never depend on the display
  // name: users are allowed to sign up with a blank name (email-prefix
  // fallback), so gating preferences on name length would lock them out of
  // saving entirely.
  async function persistSettings(body: Record<string, unknown>) {
    if (!user?.uid || savingProfile) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/users/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Save failed");
      toast.success("Settings saved!");
      void refreshProfile();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not save settings.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveProfile() {
    const name = displayName.trim();
    if (!name || name.length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }
    if (name.length > 32) {
      toast.error("Name must be 32 characters or fewer.");
      return;
    }
    await persistSettings({ displayName: name, emailWeeklyReport: weeklyReport });
  }

  // Preferences-only save (no name validation) — used by the notifications panel.
  async function handleSavePreferences() {
    await persistSettings({ emailWeeklyReport: weeklyReport });
  }

  // Resize the chosen image to 256×256 on a canvas and upload it as a JPEG,
  // so we never store a huge raw photo. Falls back to the original bytes if
  // canvas isn't available.
  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user?.uid || uploadingPicture) return;
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setUploadingPicture(true);
    try {
      const blob = await resizeImage(file, 256);
      const form = new FormData();
      form.append("file", blob, "avatar.jpg");

      const res = await fetch("/api/users/avatar", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || "Upload failed.");
      }
      toast.success("Profile picture updated!");
      void refreshProfile();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not upload picture.");
    } finally {
      setUploadingPicture(false);
    }
  }

  async function handleRemovePicture() {
    if (!user?.uid || uploadingPicture || !profileImage) return;
    setUploadingPicture(true);
    try {
      const res = await fetch("/api/users/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ profileImage: null })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Remove failed.");
      toast.success("Profile picture removed.");
      void refreshProfile();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not remove picture.");
    } finally {
      setUploadingPicture(false);
    }
  }

  return (
    <>
      {/* ── Profile ── */}
      <Panel eyebrow="Profile" title="Your Info">
        <div className="flex flex-col gap-4">
          {/* Profile picture */}
          <div className="flex items-center gap-4">
            <Avatar name={avatarName} src={profileImage} size={80} />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPicture}
                  className={primaryButton}
                >
                  {uploadingPicture ? "Uploading…" : profileImage ? "Change picture" : "Add picture"}
                </button>
                {profileImage && (
                  <button
                    type="button"
                    onClick={handleRemovePicture}
                    disabled={uploadingPicture}
                    className={secondaryButton}
                  >
                    Remove picture
                  </button>
                )}
              </div>
              <p className="text-xs text-ink-muted">
                PNG, JPEG, or WebP. We resize it to a square automatically.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePictureChange}
                className="hidden"
              />
            </div>
          </div>

          <div>
            <label htmlFor="display-name" className="mb-1.5 block text-overline text-ink-muted">
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
            <p className="mt-1 text-right text-micro text-ink-muted">
              {displayName.trim().length}/32
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={savingProfile || displayName.trim().length < 2}
            className={primaryButton}
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </div>
      </Panel>

      {/* ── Notifications ── */}
      <Panel eyebrow="Notifications" title="Email Preferences">
        {/* Whole row is a single role="switch" button so the entire target is
            clickable and keyboard-accessible. The previous markup nested this
            <button> inside a <label>, which is invalid HTML (a <label> cannot
            wrap interactive content) and caused a double-toggle: a native
            <button> already activates on Space/Enter, and the manual onKeyDown
            handler fired a second toggle, leaving the state unchanged. The name
            comes from the visible title via aria-labelledby and the description
            via aria-describedby. Focus styling comes from the theme-aware
            :focus-visible outline in globals.css. */}
        <button
          type="button"
          role="switch"
          aria-checked={weeklyReport}
          aria-labelledby="weekly-report-label"
          aria-describedby="weekly-report-desc"
          onClick={() => setWeeklyReport((v) => !v)}
          className="flex w-full cursor-pointer items-start gap-4 rounded-input p-3 text-left transition-colors hover:bg-surface-alt"
        >
          <span
            className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${weeklyReport ? "bg-accent" : ""}`}
            style={
              weeklyReport
                ? undefined
                : {
                    // ON keeps the solid accent; OFF uses a faint accent tint
                    // over the panel so the track never disappears into the
                    // page background on dark themes (bg-line does).
                    background: "color-mix(in srgb, var(--text-accent) 10%, var(--bg-panel-alt))"
                  }
            }
            aria-hidden="true"
          >
            {/* Knob: 16px in a 36px track with 2px padding either side → 16px
                travel. Positioned with `transform` (not `left`) so
                `transition-transform` actually animates the slide — the old
                `left`-based version jumped because `transition-transform`
                can't animate the `left` property. Symmetric 2px inset on
                all sides. The hairline inset border keeps an ink-inverse knob
                legible on light tracks too. */}
            <span
              className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-ink-inverse transition-transform duration-200 ease-out"
              style={{
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 35%, transparent)",
                transform: weeklyReport ? "translateX(16px)" : "translateX(0)"
              }}
            />
          </span>
          <span className="flex flex-col">
            <span id="weekly-report-label" className="text-sm font-extrabold text-ink">
              Weekly Impact Report
            </span>
            <span id="weekly-report-desc" className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              A personalised email every Monday with your XP, CO₂ reduced, trees planted, and rank movement.
            </span>
          </span>
        </button>

        <div className="mt-3">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={savingProfile}
            className={primaryButton}
          >
            {savingProfile ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </Panel>
    </>
  );
}

function profileFormKey(profile: SettingsFormProps["profile"], user: SettingsFormProps["user"]): string {
  // Remount the form whenever the server-side profile fields we edit change,
  // so the form stays in sync without a setState-in-effect anti-pattern.
  if (!profile) return "settings-loading";
  const displayName = String(profile.displayName || user?.email?.split("@")[0] || "");
  return `settings-${user?.uid || "anon"}-${displayName}-${String(profile.emailWeeklyReport)}-${typeof profile.profileImage}`;
}

export default function SettingsPage() {
  const { user, profile, refreshProfile, emailVerified } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    // Page-level stagger lives OUTSIDE the keyed SettingsForm, so a
    // save-triggered remount (avatar upload, name save) replays nothing —
    // only the state-owning panels inside the keyed unit re-render.
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
        <PageHeader
          title="Settings"
          description="Update your name, picture, theme, and which emails we send you."
        />
      </StaggerItem>

      {/* Keyed remount boundary stays BELOW the page stagger. */}
      <StaggerItem as="div" className="flex flex-col gap-5">
        <SettingsForm
          key={profileFormKey(profile, user)}
          user={user}
          profile={profile}
          refreshProfile={refreshProfile}
        />
      </StaggerItem>

      {/* ── Theme ── */}
      <StaggerItem as="div">
      <Panel eyebrow="Appearance" title="Theme">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const active = theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className={`group relative flex h-full w-full flex-col overflow-hidden rounded-[1.25rem] border-2 bg-surface text-left transition hover:-translate-y-0.5 active:scale-[0.98] ${active ? "border-accent" : "border-line shadow-elev-1"}`}
                style={active ? {
                  // Sanctioned color-mix: a soft accent ring + lift halo on the
                  // chosen theme card — friendlier than the old drop-shadow box.
                  boxShadow: "0 0 0 3px color-mix(in srgb, var(--text-accent) 26%, transparent), 0 12px 28px color-mix(in srgb, var(--text-accent) 18%, transparent)"
                } : undefined}
                aria-pressed={active}
              >
                {active && (
                  <span
                    className="absolute right-2.5 top-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-accent shadow-sm"
                    aria-hidden="true"
                  >
                    <Check
                      className="h-3 w-3"
                      strokeWidth={3.2}
                      style={{ color: "var(--text-sidebar)" }}
                    />
                  </span>
                )}

                {/*
                  Truthful preview: scope this subtree to the theme being shown
                  so it renders the theme's REAL page gradient, hero, panel,
                  accent, and text — not an arbitrary stand-in gradient.
                */}
                <div
                  data-theme={t.value}
                  className="relative h-24 w-full shrink-0 overflow-hidden"
                  style={{ background: "var(--bg-page)" }}
                >
                  {/* mini hero strip */}
                  <div className="absolute inset-x-0 top-0 h-8" style={{ background: "var(--bg-hero)" }} />
                  {/* mini panel card */}
                  <div
                    className="absolute inset-x-2.5 bottom-2.5 rounded-lg border p-2"
                    style={{ background: "var(--bg-panel)", borderColor: "var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: "var(--text-accent)" }} />
                      <span className="h-1.5 w-12 rounded-full" style={{ background: "var(--text-secondary)" }} />
                    </div>
                    <div className="mt-1.5 flex flex-col gap-1">
                      <span className="h-1 w-full rounded-full" style={{ background: "var(--text-muted)" }} />
                      <span className="h-1 w-2/3 rounded-full" style={{ background: "var(--text-muted)" }} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <p className="text-sm font-extrabold text-ink">
                    {t.label}
                  </p>
                  {/* Reserve exactly two lines so short and long descriptions
                      occupy the same space → every card is the same height. */}
                  <p className="mt-0.5 line-clamp-2 min-h-[2rem] text-xs font-semibold leading-snug text-ink-muted">
                    {t.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Panel>
      </StaggerItem>

      {/* ── Account info ── */}
      <StaggerItem as="div">
      <Panel eyebrow="Account" title="Details">
        <div className="flex flex-col gap-2">
          {[
            { label: "User ID", value: user?.uid ?? "—", mono: true },
            { label: "Email", value: user?.email ?? "—", mono: false },
            { label: "Email verified", value: emailVerified ? "Yes" : "No — action required", mono: false }
          ].map(({ label, value, mono }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-input bg-surface-alt px-4 py-3"
            >
              <p className="text-micro text-ink-muted">
                {label}
              </p>
              <p className={`max-w-[200px] truncate text-sm font-bold text-ink-soft ${mono ? "font-mono text-xs" : ""}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </Panel>
      </StaggerItem>

      {/* ── Danger zone ── */}
      <StaggerItem as="div">
      <Panel eyebrow="Danger zone" title="Delete account">
        <div
          className="flex flex-col gap-3 rounded-input border p-4"
          style={{
            // Quiet red: a 5% wash over the panel + a softened edge. Present
            // enough to signal severity, calm enough not to shout.
            background: "color-mix(in srgb, var(--text-error) 5%, var(--bg-panel))",
            borderColor: "color-mix(in srgb, var(--text-error) 20%, var(--border-default))"
          }}
        >
          <p className="text-sm leading-6 text-ink-soft">
            Permanently delete your account and all your garden data. This cannot be undone.
          </p>
          {!emailVerified && (
            <p className="text-xs font-semibold text-ink-muted">
              Your email isn&apos;t verified yet — you can still resend the verification link below.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!emailVerified && (
              <Link href="/resend-verification" className={secondaryButton}>Resend verification</Link>
            )}
            <Link href="/delete-account" className={dangerButton}>
              Delete account
            </Link>
          </div>
        </div>
      </Panel>
      </StaggerItem>
    </StaggerContainer>
  );
}