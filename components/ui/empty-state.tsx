"use client";

import { type ReactNode } from "react";

/**
 * Consistent empty state: an icon/emoji, a title, an optional description, and
 * an optional CTA. Replaces the ~18 ad-hoc empty-state variants across game pages
 * (which ranged from full illustration+CTA down to plain text).
 *
 * Defaults to a dashed-bordered card; pass `variant="plain"` for an inline
 * (borderless) treatment inside a Panel that already provides a container.
 */
type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: "card" | "plain";
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "card",
  className = ""
}: EmptyStateProps) {
  const body = (
    <div className="flex flex-col items-center text-center">
      {icon && (
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ background: "var(--bg-panel-alt)" }} aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="font-serif text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
        {title}
      </p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-6" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );

  if (variant === "plain") {
    return <div className={`py-8 ${className}`}>{body}</div>;
  }

  return (
    <div
      className={`rounded-2xl border border-dashed px-6 py-10 ${className}`}
      style={{ borderColor: "var(--border-default)" }}
    >
      {body}
    </div>
  );
}