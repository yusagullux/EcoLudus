import { ImageResponse } from "next/og";
import { sql } from "@/lib/db";
import { calculateLevel } from "@/lib/level-system";

// Dynamic Open Graph image for public profiles. Renders a 1200×630 branded
// card showing the explorer's display name, level, badge, and core stats.
// Runs at the edge, so it fetches from Postgres (or the local JSON fallback in
// dev) and does not depend on the client session.

export const alt = "EcoLudus public profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = { id: string };

export default async function ProfileOpenGraphImage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  let displayName = "Eco Explorer";
  let xp = 0;
  let missionsCompleted = 0;
  let carbonReduced = 0;
  let currentStreak = 0;

  try {
    const result = await sql<{ payload: Record<string, unknown> }>(
      "select payload from users where id = $1 limit 1",
      [id]
    );
    const p = result.rows[0]?.payload ?? {};
    displayName = String(p.displayName ?? "Eco Explorer");
    xp = Number(p.xp ?? 0);
    missionsCompleted = Number(p.missionsCompleted ?? 0);
    carbonReduced = Number(p.carbonReduced ?? 0);
    currentStreak = Number(p.currentStreak ?? 0);
  } catch {
    // Fall back to defaults if the DB is unavailable.
  }

  const level = calculateLevel(xp);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #102016 0%, #203b29 55%, #3d5d33 100%)",
          color: "#f4f1ea",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          position: "relative"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -140,
            right: -80,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(146,196,120,0.22), transparent 70%)",
            display: "flex"
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "rgba(255,255,255,0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40
            }}
          >
            🌿
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 1 }}>EcoLudus</div>
            <div style={{ fontSize: 14, letterSpacing: 6, textTransform: "uppercase", color: "#b9c9a8" }}>
              Public Profile
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.02, letterSpacing: -1 }}>
            {displayName}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#e6f0d8",
                background: "rgba(255,255,255,0.10)",
                padding: "10px 18px",
                borderRadius: 999
              }}
            >
              Level {level}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {[
            { label: "Missions", value: String(missionsCompleted) },
            { label: "CO₂ reduced", value: `${Number(carbonReduced).toFixed(1)} kg` },
            { label: "Streak", value: `${currentStreak}d` }
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#b9c9a8" }}>
                {label}
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#f4f1ea" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
