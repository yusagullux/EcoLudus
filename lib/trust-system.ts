import type { PrivateMissionVerificationResult } from "./private-mission-verification";

export type TrustUpdateInput = {
  currentTrustScore: number;
  verification: PrivateMissionVerificationResult;
  missionVarietyCount: number;
  recentSubmissionCount: number;
};

export type TrustUpdateResult = {
  previousScore: number;
  nextScore: number;
  delta: number;
  reason: string;
};

function clampTrust(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

export function getTrustMultiplier(trustScore: number) {
  if (trustScore >= 75) return 1;
  if (trustScore >= 45) return 0.9;
  if (trustScore >= 25) return 0.65;
  return 0.4;
}

export function getManualReviewProbability(trustScore: number, riskFlagCount: number) {
  const trustComponent = trustScore >= 75 ? 0.03 : trustScore >= 45 ? 0.1 : trustScore >= 25 ? 0.25 : 0.45;
  return Math.min(0.95, trustComponent + riskFlagCount * 0.08);
}

export function calculateTrustUpdate(input: TrustUpdateInput): TrustUpdateResult {
  const previousScore = clampTrust(input.currentTrustScore);
  let delta = 0;
  const reasons: string[] = [];

  if (input.verification.status === "APPROVED") {
    delta += 2.5;
    reasons.push("approved realistic submission");
  } else if (input.verification.status === "PARTIAL") {
    delta += 0.5;
    reasons.push("partially verified submission");
  } else if (input.verification.status === "REJECTED") {
    delta -= 4;
    reasons.push("rejected low-confidence submission");
  } else {
    delta -= 5.5;
    reasons.push("flagged suspicious submission");
  }

  if (input.verification.realism_score >= 85) delta += 1;
  if (input.verification.realism_score < 45) delta -= 2;
  if (input.missionVarietyCount >= 3) delta += 0.75;
  if (input.recentSubmissionCount >= 8) {
    delta -= 2;
    reasons.push("high recent submission frequency");
  }
  if (input.verification.risk_flags.length > 0) {
    delta -= Math.min(4, input.verification.risk_flags.length * 0.75);
    reasons.push("risk flags present");
  }

  const nextScore = clampTrust(previousScore + delta);

  return {
    previousScore,
    nextScore,
    delta: Math.round((nextScore - previousScore) * 100) / 100,
    reason: reasons.join("; ")
  };
}
