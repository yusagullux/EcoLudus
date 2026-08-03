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
  const style = isWarning
    ? { borderColor: "#f2e5bb", background: "#fff9e6", color: "#92601b" }
    : { borderColor: "#fecdd3", background: "#fff1f2", color: "#9f1239" };

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${className}`}
      style={style}
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