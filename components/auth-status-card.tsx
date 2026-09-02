"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

// ──────────────────────────────────────────────────────────────
// AuthStatusCard — the shared card for the auth "moment" pages:
// verify-email, resend-verification, forgot-password, reset-password,
// delete-account. Mirrors the right-hand panel of <AuthCard/> (eyebrow /
// serif title / body / form / divider-link) and adds a status medallion
// whose tint carries the page's emotional valence. The four unauthenticated
// pages wrap this in <MarketingShell/>; delete-account uses <AuthScene/>.
// ──────────────────────────────────────────────────────────────

export type AuthTone = "success" | "warning" | "danger" | "accent";

const toneColor: Record<AuthTone, string> = {
  success: "var(--text-accent)",
  warning: "var(--text-warning)",
  danger: "var(--text-error)",
  accent: "var(--text-accent)"
};

type AuthStatusCardProps = {
  tone?: AuthTone;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  body?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
};

export function AuthStatusCard({
  tone = "accent",
  icon,
  eyebrow,
  title,
  body,
  children,
  footer
}: AuthStatusCardProps) {
  const color = toneColor[tone];
  const medallionStyle: CSSProperties = {
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
    color
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <div
        className="fade-in rounded-[28px] border px-7 py-10 shadow-[0_24px_70px_rgba(0,0,0,0.1)] backdrop-blur sm:px-9 sm:py-12"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-panel)" }}
      >
        {/* Compact brand row — these pages have no aside panel, so the mark
            stays visible at every breakpoint to anchor the moment. */}
        <div className="mb-7 flex items-center gap-3">
          <div className="relative h-9 w-9 overflow-hidden rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.16)] ring-1 ring-[var(--border-default)]">
            <Image src="/images/logo.png" alt="EcoLudus logo" fill sizes="36px" className="object-cover" />
          </div>
          <div className="leading-none">
            <div className="font-serif text-lg font-semibold tracking-wide" style={{ color: "var(--text-primary)" }}>
              EcoLudus
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
              Forest Edition
            </div>
          </div>
        </div>

        {/* Status medallion — the page's totem. Tint encodes the outcome. */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={medallionStyle}
          aria-hidden="true"
        >
          {icon}
        </div>

        <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
          {eyebrow}
        </p>
        <h1 className="mt-2.5 text-balance font-serif text-3xl font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {body && (
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            {body}
          </p>
        )}

        {children && <div className="mt-7 flex flex-col gap-4">{children}</div>}

        {footer && (
          <div
            className="mt-7 border-t pt-5 text-sm"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Minimal scene for the one authenticated page (delete-account) ──
// The marketing shell's "Log in / Create account" nav is wrong there, so
// this gives just the ambient gradient + a centered slot, no header/footer.
export function AuthScene({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at top right, color-mix(in srgb, var(--text-accent) 18%, transparent), transparent 28%), radial-gradient(circle at 10% 30%, color-mix(in srgb, var(--text-accent) 12%, transparent), transparent 24%)"
          }}
        />
      </div>
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
    </div>
  );
}

// ── Medallion glyphs (24×24, stroke = currentColor so the tone tint shows) ──
const glyph = "h-7 w-7";

export const Icons = {
  check: (
    <svg className={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  clock: (
    <svg className={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  linkOff: (
    <svg className={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 4.6 7" />
      <path d="m3 3 18 18" />
    </svg>
  ),
  mail: (
    <svg className={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  lock: (
    <svg className={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  key: (
    <svg className={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10 13 20 3" />
      <path d="m16 7 3 3" />
      <path d="m18 5 2 2" />
    </svg>
  ),
  alert: (
    <svg className={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
};