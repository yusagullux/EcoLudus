"use client";

import { type ReactNode } from "react";

/**
 * Inline themed error / warning banner. Replaces the ~5 identical rose banners
 * and ~4 amber banners hand-rolled across dashboard, habits, team, and
 * photo-verification.
 *
 * Use inside forms/modals for synchronous validation failures. For async
 * failures that aren't tied to a form field, prefer `useToast().error(...)`.
 */
type ErrorBannerProps = {
  children: ReactNode;
  variant?: "error" | "warning";
  /** Render as a list of bullet points instead of plain text. */
  items?: ReactNode[];
  className?: string;
};

export function ErrorBanner({ children, variant = "error", items, className = "" }: ErrorBannerProps) {
  const isWarning = variant === "warning";

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${className}`}
      style={{
        background: "var(--bg-panel-alt)",
        borderColor: "var(--border-default)",
        color: isWarning ? "var(--text-warning)" : "var(--text-error)"
      }}
      role={isWarning ? "note" : "alert"}
    >
      {items && items.length > 0 ? (
        <>
          <p className="font-bold">{children}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 font-medium">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </>
      ) : (
        children
      )}
    </div>
  );
}