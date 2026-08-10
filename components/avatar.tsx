"use client";

import { useState } from "react";
import Image from "next/image";

// Shared avatar. Replaces the old level-badge image that used to double as the
// user's avatar everywhere (sidebar, profile, leaderboard). Shows the user's
// uploaded profile picture (a Supabase Storage public URL stored in
// `payload.profileImage`) and falls back to an initials circle when there is no
// picture (or the image fails to load). Uses next/image with `unoptimized` so
// remote Supabase URLs need no remote-pattern config while still benefiting
// from the Next.js image component (and silencing the no-img lint rule).

const AVATAR_COLORS = [
  "#2f6b46", "#2f5f86", "#62508f", "#9a6b1f",
  "#237482", "#4c7a3b", "#8a4f25", "#5d6f7a"
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initialOf(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  return trimmed[0].toUpperCase();
}

type AvatarProps = {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  // Extra inline style (e.g. overrides). The colored ring is derived from name.
  style?: React.CSSProperties;
};

export function Avatar({ name, src, size = 40, className, style }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const displayName = name || "?";
  const hasImage = Boolean(src) && !errored;
  const dim = { width: size, height: size };

  if (hasImage) {
    return (
      <Image
        src={src as string}
        alt={displayName}
        width={size}
        height={size}
        unoptimized
        loading="lazy"
        onError={() => setErrored(true)}
        className={`shrink-0 overflow-hidden rounded-full object-cover ${className ?? ""}`}
        style={{ ...dim, ...style }}
      />
    );
  }

  return (
    <div
      aria-label={displayName}
      className={`flex shrink-0 items-center justify-center rounded-full font-serif font-extrabold select-none ${className ?? ""}`}
      style={{
        ...dim,
        background: colorForName(displayName),
        color: "#fcf9f2",
        fontSize: Math.max(11, Math.round(size * 0.42)),
        ...style
      }}
    >
      {initialOf(displayName)}
    </div>
  );
}