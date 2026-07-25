import { describe, it, expect } from "vitest";
import {
  getTrustMultiplier,
  getManualReviewProbability,
  calculateTrustUpdate,
  type TrustUpdateInput
} from "../trust-system";
import type { PrivateMissionVerificationResult } from "../private-mission-verification";

function makeVerification(
  overrides: Partial<PrivateMissionVerificationResult> = {}
): PrivateMissionVerificationResult {
  return {
    status: "APPROVED",
    confidence: 80,
    realism_score: 80,
    reasoning: "looks legit",
    risk_flags: [],
    provider: "test",
    ...overrides
  };
}

describe("getTrustMultiplier", () => {
  it("steps down across the trust tiers", () => {
    expect(getTrustMultiplier(100)).toBe(1);
    expect(getTrustMultiplier(75)).toBe(1);
    expect(getTrustMultiplier(74)).toBe(0.9);
    expect(getTrustMultiplier(45)).toBe(0.9);
    expect(getTrustMultiplier(44)).toBe(0.65);
    expect(getTrustMultiplier(25)).toBe(0.65);
    expect(getTrustMultiplier(24)).toBe(0.4);
    expect(getTrustMultiplier(0)).toBe(0.4);
  });
});

describe("getManualReviewProbability", () => {
  it("increases with lower trust and with risk flags", () => {
    expect(getManualReviewProbability(80, 0)).toBeCloseTo(0.03, 2);
    expect(getManualReviewProbability(50, 0)).toBeCloseTo(0.1, 2);
    expect(getManualReviewProbability(30, 0)).toBeCloseTo(0.25, 2);
    expect(getManualReviewProbability(10, 0)).toBeCloseTo(0.45, 2);
    // Each risk flag adds 0.08.
    expect(getManualReviewProbability(10, 3)).toBeCloseTo(0.45 + 0.24, 2);
  });

  it("is capped at 0.95", () => {
    expect(getManualReviewProbability(0, 100)).toBeLessThanOrEqual(0.95);
  });
});

describe("calculateTrustUpdate", () => {
  const baseInput = (
    verification: PrivateMissionVerificationResult,
    overrides: Partial<TrustUpdateInput> = {}
  ): TrustUpdateInput => ({
    currentTrustScore: 50,
    verification,
    missionVarietyCount: 1,
    recentSubmissionCount: 1,
    ...overrides
  });

  it("rewards an approved, realistic, varied submission", () => {
    const result = calculateTrustUpdate(
      baseInput(makeVerification({ status: "APPROVED", realism_score: 90, risk_flags: [] }),
        { missionVarietyCount: 3 })
    );
    // +2.5 approved +1 realism>=85 +0.75 variety>=3 = +4.25
    expect(result.delta).toBeCloseTo(4.25, 2);
    expect(result.nextScore).toBeCloseTo(54.25, 2);
    expect(result.reason).toContain("approved realistic submission");
  });

  it("penalizes a flagged submission with risk flags", () => {
    const result = calculateTrustUpdate(
      baseInput(makeVerification({ status: "FLAGGED", realism_score: 10, risk_flags: ["a", "b", "c"] }),
        { recentSubmissionCount: 8 })
    );
    // -5.5 flagged -2 realism<45 -2 high frequency -2.25 (3 risk flags) = -11.75
    expect(result.delta).toBeLessThan(0);
    expect(result.nextScore).toBe(38.25); // clamp rounds 50 - 11.75 = 38.25
    expect(result.reason).toContain("flagged suspicious submission");
    expect(result.reason).toContain("risk flags present");
    expect(result.reason).toContain("high recent submission frequency");
  });

  it("clamps the score to [0, 100]", () => {
    const low = calculateTrustUpdate(
      baseInput(makeVerification({ status: "FLAGGED", realism_score: 0, risk_flags: ["a", "b", "c", "d", "e", "f"] }),
        { currentTrustScore: 1, recentSubmissionCount: 8 })
    );
    expect(low.nextScore).toBe(0);
    expect(low.delta).toBeLessThanOrEqual(0);
  });
});