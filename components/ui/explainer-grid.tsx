"use client";

import { type ReactNode } from "react";

/**
 * 3-card "How it works" explainer grid. Replaces the identical hand-rolled
 * pattern in Habits ("How it works"), Garden ("Garden Rules"), and Impact
 * ("How Tree Planting Will Work"). Theme-aware, collapses 1 → 3 columns.
 */
export type ExplainerItem = {
  icon: ReactNode;
  title: ReactNode;
  desc: ReactNode;
};

export function ExplainerGrid({ items, className = "" }: { items: ExplainerItem[]; className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${className}`}>
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-2xl p-4"
          style={{ background: "var(--bg-panel-alt)", border: "1px solid var(--border-subtle)" }}
        >
          <span
            className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl text-lg"
            style={{ background: "var(--bg-panel)", color: "var(--text-accent)" }}
            aria-hidden="true"
          >
            {item.icon}
          </span>
          <p className="font-serif text-sm font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
            {item.title}
          </p>
          <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
            {item.desc}
          </p>
        </div>
      ))}
    </div>
  );
}