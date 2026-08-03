"use client";

import { type ReactNode } from "react";

/**
 * Themed divided list. Replaces the 7+ hand-rolled divided-list surfaces
 * (dashboard quests, habits missions, impact milestones/notifications,
 * leaderboard rankings, team members, friends board, garden plant status).
 * Each row has a leading slot, a title/subtitle block, and a trailing slot.
 *
 * Use <DividedList>{rows}</DividedList> and pass <ListRow …/> children, or
 * any custom row — the divider is applied between children via border-t on
 * all but the first child wrapper.
 */
export function DividedList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <ul className={`divide-y ${className}`} style={{ borderColor: "var(--border-subtle)" }}>
      {children}
    </ul>
  );
}

type ListRowProps = {
  /** Leading icon/avatar slot. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned slot (badge, action, value). */
  trailing?: ReactNode;
  /** Make the whole row a button. */
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
};

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  disabled = false,
  className = "",
  children
}: ListRowProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <li className="border-t first:border-t-0" style={{ borderColor: "var(--border-subtle)" }}>
      <Tag
        type={onClick ? "button" : undefined}
        onClick={onClick}
        disabled={onClick ? disabled : undefined}
        className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition ${onClick ? "hover:bg-[var(--bg-panel-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset" : ""} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
      >
        {leading && <span className="flex shrink-0 items-center justify-center">{leading}</span>}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block text-xs leading-5" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </span>
          )}
          {children}
        </span>
        {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      </Tag>
    </li>
  );
}