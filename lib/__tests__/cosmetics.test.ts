import { describe, expect, it } from "vitest";
import { cosmeticStyle, resolveCosmetic } from "@/lib/cosmetics";
import { COSMETIC_CATALOG } from "@/lib/catalog";

describe("cosmeticStyle", () => {
  it("returns a frame ring + shadow style for a frame cosmetic", () => {
    const frame = COSMETIC_CATALOG.find((c) => c.id === "frame-gold")!;
    const { frameStyle } = cosmeticStyle(frame, "frame");
    expect(frameStyle?.boxShadow).toContain("#fbbf24");
    expect(frameStyle?.boxShadow).toContain("0 0 14px");
    expect(frameStyle?.border).toContain("3px solid #fbbf24");
  });

  it("returns a gradient background style for a background cosmetic", () => {
    const bg = COSMETIC_CATALOG.find((c) => c.id === "bg-sunset")!;
    const { backgroundStyle } = cosmeticStyle(bg, "background");
    expect(backgroundStyle?.background).toContain("linear-gradient");
    expect(backgroundStyle?.background).toContain("#fca5a5");
  });

  it("returns empty styles for undefined cosmetic", () => {
    const { frameStyle, backgroundStyle } = cosmeticStyle(undefined, "frame");
    expect(frameStyle).toBeUndefined();
    expect(backgroundStyle).toBeUndefined();
  });

  it("returns empty when slot does not match the cosmetic's slot", () => {
    const frame = COSMETIC_CATALOG.find((c) => c.id === "frame-gold")!;
    const { backgroundStyle } = cosmeticStyle(frame, "background");
    expect(backgroundStyle).toBeUndefined();
  });
});

describe("resolveCosmetic", () => {
  it("resolves an equipped id to its definition", () => {
    expect(resolveCosmetic(COSMETIC_CATALOG, "frame-prism")?.name).toBe("Prism Frame");
  });
  it("returns undefined for null/undefined/unknown id", () => {
    expect(resolveCosmetic(COSMETIC_CATALOG, null)).toBeUndefined();
    expect(resolveCosmetic(COSMETIC_CATALOG, undefined)).toBeUndefined();
    expect(resolveCosmetic(COSMETIC_CATALOG, "nope")).toBeUndefined();
  });
});