"use client";

import { useState } from "react";
import Image from "next/image";
import { Pill } from "@/components/game-ui";
import { PET_EMOJI } from "@/lib/ui-shared";
import type { Rarity } from "@/components/game-ui";

// Shared species card tile. Used by the Collection Book (interactive owner
// view) and the PublicProfileView (read-only view) so the two surfaces render
// identical locked/discovered states from one source of truth. The caller
// provides the surrounding article card, badges, and any action buttons.

export type CollectionMode = "plants" | "eggs" | "animals" | "seeds" | "chests";

export type CollectionEntry = {
  id: string | number;
  name: string;
  rarity: Rarity;
  image: string;
};

export function CollectionCardImage({
  entry,
  discovered,
  mode,
  priority = false,
  eager = false
}: {
  entry: CollectionEntry;
  discovered: boolean;
  mode: CollectionMode;
  priority?: boolean;
  eager?: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  if (!discovered) {
    return (
      <Image
        src={entry.image}
        alt="Locked species — not yet discovered"
        fill
        sizes="(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 220px"
        priority={priority}
        loading={priority || eager ? "eager" : undefined}
        onError={() => setImgError(true)}
        className="object-cover transition duration-300"
        style={{ filter: "grayscale(1) brightness(0.7)", opacity: 0.75 }}
      />
    );
  }

  if (mode === "animals" && imgError) {
    return (
      <div className="flex h-full w-full items-center justify-center text-5xl select-none transition duration-300 group-hover:scale-110 drop-shadow-sm">
        {PET_EMOJI[entry.name] || "🐾"}
      </div>
    );
  }

  return (
    <Image
      src={entry.image}
      alt={entry.name}
      fill
      sizes="(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 220px"
      priority={priority}
      loading={priority || eager ? "eager" : undefined}
      onError={() => setImgError(true)}
      className="object-cover transition duration-300 group-hover:scale-110"
    />
  );
}

export function CollectionCardLockedHint() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-full px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
      style={{ background: "color-mix(in srgb, var(--text-primary) 70%, transparent)", color: "var(--text-inverse)" }}
    >
      Complete quests to unlock
    </div>
  );
}

export function CollectionRarityBadge({ rarity, className }: { rarity: Rarity; className?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${className ?? ""}`}
    >
      {rarity}
    </span>
  );
}

export function CollectionCountBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span className="absolute bottom-2 right-2 z-10">
      <Pill active>×{count}</Pill>
    </span>
  );
}
