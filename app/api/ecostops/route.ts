import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

// ── Seed stops (used when table is empty / file-store mode) ──────────────────
const SEED_STOPS = [
  { id: "stop_hyde_park",      name: "Hyde Park Meadow",        type: "park",             lat: 51.5073, lng: -0.1657, xpReward: 45, ecoReward: 25, cooldownHours: 24, description: "A large green space in central London perfect for a nature walk." },
  { id: "stop_recycling_w2",   name: "Recycling Hub W2",        type: "recycling",         lat: 51.5120, lng: -0.1778, xpReward: 35, ecoReward: 20, cooldownHours: 12, description: "Community recycling point accepting glass, plastic, and paper." },
  { id: "stop_garden_camden",  name: "Camden Community Garden", type: "community_garden",  lat: 51.5390, lng: -0.1426, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Volunteer-run urban garden with seasonal planting sessions." },
  { id: "stop_repair_brixton", name: "Brixton Repair Café",     type: "repair_cafe",       lat: 51.4613, lng: -0.1156, xpReward: 60, ecoReward: 35, cooldownHours: 48, description: "Fix clothes, electronics and furniture instead of replacing them." },
  { id: "stop_bike_kings",     name: "Kings Cross Bike Hub",    type: "bike_station",      lat: 51.5308, lng: -0.1238, xpReward: 30, ecoReward: 18, cooldownHours: 8,  description: "Bike parking and minor repair tools available for free." },
  { id: "stop_trail_richmond", name: "Richmond Nature Trail",   type: "nature_trail",      lat: 51.4613, lng: -0.3037, xpReward: 50, ecoReward: 28, cooldownHours: 24, description: "3km marked trail through ancient woodland and riverside meadow." },
  { id: "stop_park_victoria",  name: "Victoria Park",           type: "park",             lat: 51.5362, lng: -0.0394, xpReward: 40, ecoReward: 22, cooldownHours: 24, description: "East London's largest park with nature zones and community events." },
  { id: "stop_recycling_ec1",  name: "Clerkenwell Eco Point",   type: "recycling",         lat: 51.5240, lng: -0.1058, xpReward: 35, ecoReward: 20, cooldownHours: 12, description: "Multi-stream recycling including batteries and small electronics." },
  { id: "stop_garden_peck",    name: "Peckham Rooftop Garden",  type: "community_garden",  lat: 51.4736, lng: -0.0693, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Rooftop growing space with workshops on urban food growing." },
  { id: "stop_trail_epping",   name: "Epping Forest Entry",     type: "nature_trail",      lat: 51.6520, lng: 0.0431,  xpReward: 65, ecoReward: 40, cooldownHours: 48, description: "Ancient royal forest — one of the largest public open spaces near London." }
];

type Stop = typeof SEED_STOPS[number];

// Haversine distance in metres
function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── GET /api/ecostops?lat=X&lng=Y&radius=N ────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat    = parseFloat(searchParams.get("lat") ?? "NaN");
  const lng    = parseFloat(searchParams.get("lng") ?? "NaN");
  const radius = parseFloat(searchParams.get("radius") ?? "5000"); // metres, default 5km

  // Always return the seed stops (in production you'd query a DB table).
  // Filter by radius when a location is provided.
  const stops: Stop[] = isNaN(lat) || isNaN(lng)
    ? SEED_STOPS
    : SEED_STOPS.filter(s => distM(lat, lng, s.lat, s.lng) <= radius);

  return NextResponse.json({ stops, total: stops.length });
}

// ── POST /api/ecostops (check-in) ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Auth
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { code: "auth/unauthenticated", message: "Not signed in." } }, { status: 401 });
    }
    const userId = session.userId;

    const body = await req.json().catch(() => null);
    if (!body?.stopId) {
      return NextResponse.json({ success: false, error: { code: "ecostop/missing-stop-id", message: "stopId is required." } }, { status: 400 });
    }

    const stop = SEED_STOPS.find(s => s.id === body.stopId);
    if (!stop) {
      return NextResponse.json({ success: false, error: { code: "ecostop/not-found", message: "EcoStop not found." } }, { status: 404 });
    }

    // Proof validation
    const hasTextProof  = typeof body.textProof === "string" && body.textProof.trim().length >= 8;
    const hasPhotoProof = typeof body.photoProof === "string" && body.photoProof.length > 100;
    if (!hasTextProof && !hasPhotoProof) {
      return NextResponse.json({ success: false, error: { code: "ecostop/missing-proof", message: "A text description (8+ chars) or photo is required." } }, { status: 422 });
    }

    // Load user to check cooldown and apply rewards
    const userResult = await sql<{ id: string; email: string; payload: Record<string, unknown> }>(
      "SELECT id, email, payload FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    if (!userResult.rows[0]) {
      return NextResponse.json({ success: false, error: { code: "auth/user-not-found" } }, { status: 404 });
    }
    const user = userResult.rows[0];
    const payload = user.payload ?? {};

    // Cooldown check — per-stop, per-user
    const checkins: Array<{ stopId: string; checkedInAt: string }> = Array.isArray(payload.ecoMapCheckins) ? payload.ecoMapCheckins as any : [];
    const lastCheckin = [...checkins].reverse().find(c => c.stopId === stop.id);
    if (lastCheckin) {
      const elapsed = Date.now() - new Date(lastCheckin.checkedInAt).getTime();
      if (elapsed < stop.cooldownHours * 3_600_000) {
        const remainH = Math.ceil((stop.cooldownHours * 3_600_000 - elapsed) / 3_600_000);
        return NextResponse.json({ success: false, error: { code: "ecostop/on-cooldown", message: `You already checked in here. Come back in ~${remainH}h.` } }, { status: 429 });
      }
    }

    // Grant rewards
    const xpAwarded  = stop.xpReward;
    const ecoAwarded = stop.ecoReward;
    const nextXp      = Number(payload.xp ?? 0) + xpAwarded;
    const nextEco     = Number(payload.ecoPoints ?? 0) + ecoAwarded;
    const nextLevel   = calculateLevelServer(nextXp);
    const newCheckin  = { stopId: stop.id, checkedInAt: new Date().toISOString() };
    const nextCheckins = [...checkins, newCheckin].slice(-200); // keep last 200

    const nextPayload = {
      ...payload,
      xp: nextXp,
      level: nextLevel,
      ecoPoints: nextEco,
      ecoMapCheckins: nextCheckins,
      missionsCompleted: Number(payload.missionsCompleted ?? 0) + 1
    };

    await sql(
      `INSERT INTO users (id, email, password_hash, payload)
       VALUES ($1, $2, COALESCE((SELECT password_hash FROM users WHERE id = $1), ''), $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET email = excluded.email, payload = excluded.payload, updated_at = now()`,
      [userId, user.email, JSON.stringify(nextPayload)]
    );

    return NextResponse.json({ success: true, xpAwarded, ecoAwarded, stopName: stop.name });
  } catch (err: any) {
    console.error("EcoStop check-in error:", err);
    return NextResponse.json({ success: false, error: { code: "internal", message: err.message ?? "Server error" } }, { status: 500 });
  }
}

// Simple level calculator (mirrors lib/level-system.ts, no import needed here)
function calculateLevelServer(xp: number): number {
  let level = 1;
  while (xp >= 100 * level + 25 * level * level) level++;
  return level;
}
