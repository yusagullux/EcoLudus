// @ts-nocheck
import type { CSSProperties } from "react";
import type { SVGProps } from "react";

/**
 * Hand-coded SVG category icons (no external/stock images).
 * Used in place of the old landscape stock-photo thumbnails across the
 * dashboard, insights, and profile pages.
 */

type IconKey =
  | "recycling"
  | "energy"
  | "transport"
  | "water"
  | "cleanup"
  | "gardening"
  | "sustainable"
  | "default";

const stroke: SVGProps<SVGGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

function normalizeKey(idOrName: string): IconKey {
  const v = (idOrName || "").toLowerCase().trim();
  if (!v) return "default";
  if (v.includes("recycl")) return "recycling";
  if (v.includes("energy")) return "energy";
  if (v.includes("transport")) return "transport";
  if (v.includes("water")) return "water";
  if (v.includes("clean")) return "cleanup";
  if (v.includes("garden")) return "gardening";
  if (v.includes("sustain")) return "sustainable";
  return "default";
}

function Icon({ k }: { k: IconKey }) {
  switch (k) {
    case "recycling":
      // Two-arc cycle with chevron arrowheads.
      return (
        <g {...stroke}>
          <path d="M6 12 A6 6 0 0 1 18 12" />
          <path d="M16.5 9 L18 12 L19.5 9" />
          <path d="M18 12 A6 6 0 0 1 6 12" />
          <path d="M7.5 15 L6 12 L4.5 15" />
        </g>
      );
    case "energy":
      // Lightning bolt.
      return <path fill="currentColor" stroke="none" d="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 Z" />;
    case "transport":
      // Simple car silhouette + wheels.
      return (
        <g {...stroke}>
          <path d="M3 13 L5 8 H17 L19 13 V17 H3 Z" />
          <circle cx="7.5" cy="17" r="2" />
          <circle cx="16.5" cy="17" r="2" />
        </g>
      );
    case "water":
      // Teardrop.
      return (
        <path
          fill="currentColor"
          stroke="none"
          d="M12 2 C12 2 6 9 6 14 a6 6 0 0 0 12 0 C18 9 12 2 12 2 Z"
        />
      );
    case "cleanup":
      // Trash bin.
      return (
        <g {...stroke}>
          <path d="M4 6 H20" />
          <path d="M9 6 V4 H15 V6" />
          <path d="M6 8 L7 20 H17 L18 8" />
          <path d="M10 9 V19" />
          <path d="M14 9 V19" />
        </g>
      );
    case "gardening":
      // Sprout with two leaves.
      return (
        <g {...stroke}>
          <path d="M12 21 V11" />
          <path d="M12 11 C12 7 9 5 5 5 C5 9 9 11 12 11" />
          <path d="M12 11 C12 7 15 5 19 5 C19 9 15 11 12 11" />
        </g>
      );
    case "sustainable":
      // Leaf with vein.
      return (
        <g>
          <path fill="currentColor" stroke="none" d="M5 21 C5 12 12 6 21 5 C21 14 14 21 5 21 Z" />
          <path {...stroke} d="M5 21 C9 17 13 13 21 5" />
        </g>
      );
    default:
      // Fallback leaf.
      return (
        <g>
          <path fill="currentColor" stroke="none" d="M5 21 C5 12 12 6 21 5 C21 14 14 21 5 21 Z" />
          <path {...stroke} d="M5 21 C9 17 13 13 21 5" />
        </g>
      );
  }
}

export function categoryIconKey(idOrName: string): IconKey {
  return normalizeKey(idOrName);
}

type CategoryIconProps = {
  /** Category id or display name, e.g. "recycling" or "Energy Saving". */
  id?: string;
  name?: string;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

export function CategoryIcon({ id, name, color = "currentColor", className, style }: CategoryIconProps) {
  const key = normalizeKey(id ?? name ?? "");
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ color, display: "block", ...style }}
    >
      <Icon k={key} />
    </svg>
  );
}

export default CategoryIcon;