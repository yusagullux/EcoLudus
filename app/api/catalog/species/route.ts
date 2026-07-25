import { NextResponse } from "next/server";
import { getPetCatalog, getSeedCatalog } from "@/lib/catalog-server";

// Public read-only species catalog (pets + seeds). Like /api/catalog/shop,
// this is display-only — names/images aren't secret, and the hatch/chest
// routes re-validate rewards server-side, so a client can't forge anything by
// tampering with what it renders. Pets and seeds live as constants in
// lib/catalog.ts (no DB table — they have no runtime-editable values).
export async function GET() {
  try {
    return NextResponse.json({
      pets: getPetCatalog(),
      seeds: getSeedCatalog()
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "internal-error" } },
      { status: 500 }
    );
  }
}