import { describe, it, expect } from "vitest";
import { isDuplicatePurchase, purchaseKey } from "@/lib/shop-guard";

// Regression guard for the shop double-purchase race (FEEDBACKS.md C1).
// Two rapid clicks on "Buy" used to fire two POST /api/shop/buy calls ~80ms
// apart and BOTH completed (EP deducted twice, item granted twice). The route
// now consults a `lastBuy` marker written into the user's payload inside the
// row-locked transaction — a second purchase of the SAME item within a short
// window is rejected as shop/duplicate-purchase. Intentional repeat purchases
// (a deliberate second buy after ~1s) still go through.

describe("purchaseKey", () => {
  it("keys by mode + itemId for catalog buys", () => {
    expect(purchaseKey({ mode: "eggs", itemId: 3 } as any)).toBe("eggs:3");
  });

  it("keys by mode + dealId for daily deals", () => {
    expect(purchaseKey({ mode: "daily", dealId: "deal-xyz" } as any)).toBe("daily:deal-xyz");
  });
});

describe("isDuplicatePurchase", () => {
  const now = 1_700_000_000_000;

  it("flags a same-item purchase inside the window as a duplicate", () => {
    const profile = { lastBuy: { key: "eggs:3", at: new Date(now - 200).toISOString() } };
    expect(isDuplicatePurchase(profile as any, "eggs:3", now)).toBe(true);
  });

  it("does not flag a different item inside the window", () => {
    const profile = { lastBuy: { key: "eggs:3", at: new Date(now - 200).toISOString() } };
    expect(isDuplicatePurchase(profile as any, "plants:7", now)).toBe(false);
  });

  it("does not flag a same-item purchase outside the window", () => {
    const profile = { lastBuy: { key: "eggs:3", at: new Date(now - 5_000).toISOString() } };
    expect(isDuplicatePurchase(profile as any, "eggs:3", now)).toBe(false);
  });

  it("treats a missing or malformed lastBuy as fresh", () => {
    expect(isDuplicatePurchase({} as any, "eggs:3", now)).toBe(false);
    expect(isDuplicatePurchase({ lastBuy: {} } as any, "eggs:3", now)).toBe(false);
    expect(isDuplicatePurchase({ lastBuy: { key: "eggs:3" } } as any, "eggs:3", now)).toBe(false);
  });
});