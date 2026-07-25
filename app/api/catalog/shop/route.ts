import { NextResponse } from "next/server";
import { getShopCatalog } from "@/lib/catalog-server";
import { logError } from "@/lib/logger";

// Public read-only shop catalog. Prices are not secret (they're shown on the
// shop page), so this needs no session. The buy route re-validates the price
// server-side by id, so this response is display-only — a client cannot buy
// at a cheaper price even if it tampers with what it renders.
export async function GET() {
  try {
    const catalog = await getShopCatalog();
    return NextResponse.json({ catalog });
  } catch (error) {
    logError("Catalog shop read error", error);
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}