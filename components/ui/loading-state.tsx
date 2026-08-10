"use client";

import Image from "next/image";
import { type ReactNode } from "react";

/**
 * Consistent loading indicator. Replaces the ~11 ad-hoc loading variants across
 * game pages (logo-breathe spinner, plain centered text, inline <p>, full Panel).
 *
 * variant="full"  — full-height centered spinner + caption (page-level loading).
 * variant="inline" — inline spinner + caption (fits inside a Panel / grid cell).
 * variant="panel"  — Panel-shaped placeholder block (for card/grid skeletons).
 */
type LoadingStateProps = {
  label?: ReactNode;
  variant?: "full" | "inline" | "panel";
  className?: string;
};

export function LoadingState({ label = "Loading…", variant = "full", className = "" }: LoadingStateProps) {
  if (variant === "inline") {
    return (
      <div className={`flex items-center justify-center gap-2.5 py-6 ${className}`}>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" style={{ color: "var(--text-accent)" }} aria-hidden="true" />
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div
        className={`flex flex-col items-center gap-3 rounded-[18px] p-8 ${className} animate-pulse`}
        style={{ background: "var(--bg-panel)", border: "1px solid var(--border-subtle)" }}
        aria-busy="true"
      >
        <div className="h-10 w-10 rounded-2xl" style={{ background: "var(--bg-panel-alt)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
    );
  }

  return (
    <div className={`flex min-h-[400px] flex-col items-center justify-center gap-4 ${className}`} aria-busy="true" role="status" aria-live="polite">
      <div
        className="logo-breathe relative h-14 w-14 overflow-hidden rounded-2xl shadow-[0_18px_38px_rgba(0,0,0,0.16)] ring-1 ring-[var(--border-default)]"
        style={{ background: "var(--bg-panel)" }}
      >
        <Image src="/images/logo.png" alt="EcoLudus logo" fill sizes="56px" className="object-cover" />
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}