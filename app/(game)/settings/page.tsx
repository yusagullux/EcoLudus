"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { useTheme, type Theme } from "@/lib/useTheme";
import { PageHero, Panel, primaryButton, inputClass, heroAccents } from "@/components/game-ui";
import { StaggerContainer, StaggerItem } from "@/lib/animations";
import { Avatar } from "@/components/avatar";
import { useToast } from "@/lib/toast";

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
  },
  {
    value: "dawn",
    label: "Dawn",
    desc: "Warm amber & terracotta on cream",
    preview: "linear-gradient(135deg,#fbeed8,#fff6ec,#f7e4cd)"
  },
  {
    value: "bloom",
    label: "Bloom",
    desc: "Floral magenta & rose on blush",
    preview: "linear-gradient(135deg,#fdeaf3,#fff5f8,#f8dce9)"
  },
  {
    value: "aurora",
    label: "Aurora",
    desc: "Indigo night with teal aurora glow",
    preview: "linear-gradient(135deg,#0a0f2e,#10183a,#0c1230)"
  }
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
  theme: Theme;
  setTheme: (t: Theme) => void;
};

function SettingsForm({ user, profile, refreshProfile, theme, setTheme }: SettingsFormProps) {
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

  async function handleSaveProfile() {
    if (!user?.uid || savingProfile) return;
    const name = displayName.trim();
    if (!name || name.length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }
    if (name.length > 32) {
      toast.error("Name must be 32 characters or fewer.");
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
      toast.success("Settings saved!");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not save settings.");
    } finally {
      setSavingProfile(false);
    }
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
      await refreshProfile();
      toast.success("Profile picture updated!");
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
      await refreshProfile();
      toast.success("Profile picture removed.");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Could not remove picture.");
    } finally {
      setUploadingPicture(false);
    }
  }

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
      <PageHero
        eyebrow="Account"
        title="Settings"
        description="Update your profile, choose a theme, and manage notifications."
        accent={heroAccents.settings}
      />
      </StaggerItem>

      {/* ── Profile ── */}
      <StaggerItem as="div">
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
                    className="inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] transition hover:opacity-80"
                    style={{ background: "var(--bg-panel-alt)", color: "var(--text-muted)" }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
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
            type="button"
            onClick={handleSaveProfile}
            disabled={savingProfile || displayName.trim().length < 2}
            className={primaryButton}
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </div>
      </Panel>
      </StaggerItem>

      {/* ── Theme ── */}
      <StaggerItem as="div">
      <Panel eyebrow="Appearance" title="Theme">
        <StaggerContainer className="grid grid-cols-1 gap-3 sm:grid-cols-3" as="div">
          {THEMES.map((t) => {
            const active = theme === t.value;
            return (
              <StaggerItem key={t.value} as="div">
              <button
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
                        style={{ background: "var(--text-accent, #43653f)", color: "var(--text-inverse)" }}
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
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </Panel>
      </StaggerItem>

      {/* ── Notifications ── */}
      <StaggerItem as="div">
      <Panel eyebrow="Notifications" title="Email Preferences">
        {/* Whole row is a single role="switch" button so the entire target is
            clickable and keyboard-accessible. The previous markup nested this
            <button> inside a <label>, which is invalid HTML (a <label> cannot
            wrap interactive content) and caused a double-toggle: a native
            <button> already activates on Space/Enter, and the manual onKeyDown
            handler fired a second toggle, leaving the state unchanged. The name
            comes from the visible title via aria-labelledby and the description
            via aria-describedby. */}
        <button
          type="button"
          role="switch"
          aria-checked={weeklyReport}
          aria-labelledby="weekly-report-label"
          aria-describedby="weekly-report-desc"
          onClick={() => setWeeklyReport((v) => !v)}
          className="flex w-full cursor-pointer items-start gap-4 rounded-xl p-3 text-left transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            background: "transparent",
            // @ts-expect-error CSS custom property for ring offset color
            "--tw-ring-offset-color": "var(--bg-panel)"
          }}
        >
          <span
            className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200"
            style={{ background: weeklyReport ? "var(--text-accent, #43653f)" : "var(--border-default)" }}
            aria-hidden="true"
          >
            {/* Knob: 16px in a 36px track with 2px padding either side → 16px
                travel. Positioned with `transform` (not `left`) so
                `transition-transform` actually animates the slide — the old
                `left`-based version jumped because `transition-transform`
                can't animate the `left` property. Symmetric 2px inset on
                all sides. */}
            <span
              className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full shadow transition-transform duration-200 ease-out"
              style={{
                background: "var(--text-inverse)",
                transform: weeklyReport ? "translateX(16px)" : "translateX(0)"
              }}
            />
          </span>
          <span className="flex flex-col">
            <span id="weekly-report-label" className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
              Weekly Impact Report
            </span>
            <span id="weekly-report-desc" className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              A personalised email every Monday with your XP, CO₂ reduced, trees planted, and rank movement.
            </span>
          </span>
        </button>

        <div className="mt-3">
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className={primaryButton}
          >
            {savingProfile ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </Panel>
      </StaggerItem>

      {/* ── Account info ── */}
      <StaggerItem as="div">
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
      </StaggerItem>
    </StaggerContainer>
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
  const { user, profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <SettingsForm
      key={profileFormKey(profile, user)}
      user={user}
      profile={profile}
      refreshProfile={refreshProfile}
      theme={theme}
      setTheme={setTheme}
    />
  );
}
