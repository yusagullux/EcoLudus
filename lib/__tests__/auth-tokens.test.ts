import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { generateToken, hashToken } from "@/lib/auth-tokens";

describe("auth-tokens", () => {
  it("generateToken returns a unique non-empty string each call", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("hashToken returns the SHA-256 hex of the raw token", () => {
    const raw = "abc-123";
    const expected = createHash("sha256").update(raw).digest("hex");
    expect(hashToken(raw)).toBe(expected);
  });

  it("hashToken is deterministic", () => {
    expect(hashToken("same")).toBe(hashToken("same"));
  });
});