// Duplicate-purchase guard for /api/shop/buy (FEEDBACKS.md C1).
//
// A rapid double-click on "Buy" fires two POST /api/shop/buy requests ~80ms
// apart. The route validates affordability inside the row-locked transaction,
// so both purchases are individually valid — meaning both complete and the
// user pays twice for one click-intent. The route records the last purchase
// in the user's payload (`lastBuy`) and consults this guard on the next
// request: the SAME item bought again within DUPLICATE_BUY_WINDOW_MS is
// rejected with `shop/duplicate-purchase`. Window is deliberately short so a
// deliberate second buy (≈1s+ later) still goes through.
//
// Payload-based on purpose: no new SQL query, so the file-DB fallback needs
// no matching `fileSql` branch (see CLAUDE.md data-layer note).

export const DUPLICATE_BUY_WINDOW_MS = 1200;

export type BuyRef = { mode: string; itemId?: number | string; dealId?: string };

export function purchaseKey(req: BuyRef): string {
  return `${req.mode}:${req.dealId ?? req.itemId ?? ""}`;
}

export function isDuplicatePurchase(
  profile: Record<string, unknown> | null | undefined,
  key: string,
  nowMs: number
): boolean {
  const last = profile?.lastBuy as { key?: unknown; at?: unknown } | undefined;
  if (!last || typeof last.key !== "string" || typeof last.at !== "string") return false;
  if (last.key !== key) return false;
  const at = Date.parse(last.at);
  if (Number.isNaN(at)) return false;
  return nowMs - at >= 0 && nowMs - at < DUPLICATE_BUY_WINDOW_MS;
}