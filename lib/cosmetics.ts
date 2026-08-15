import type { CSSProperties } from "react";
import type { CosmeticDef } from "@/lib/catalog";

// Maps a CSS-descriptor cosmetic to React style objects. Frames render as a
// ring (border) + glow (box-shadow); backgrounds render as a gradient layer.
// Avatar consumes these to layer the look without any image assets.
export function cosmeticStyle(
  cosmetic: CosmeticDef | undefined,
  slot: "frame" | "background"
): { frameStyle?: CSSProperties; backgroundStyle?: CSSProperties } {
  if (!cosmetic) return {};
  if (slot === "frame" && cosmetic.frame) {
    const f = cosmetic.frame;
    return {
      frameStyle: {
        border: f.ring,
        boxShadow: f.shadow
      }
    };
  }
  if (slot === "background" && cosmetic.background) {
    return {
      backgroundStyle: {
        background: cosmetic.background.gradient
      }
    };
  }
  return {};
}

// Resolve an equipped cosmetic id to its definition (or undefined). Used by
// Avatar / public profile to render the equipped look.
export function resolveCosmetic(
  catalog: CosmeticDef[],
  id: string | null | undefined
): CosmeticDef | undefined {
  if (!id) return undefined;
  return catalog.find((c) => c.id === id);
}