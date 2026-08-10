import { ImageResponse } from "next/og";

// Dynamic Open Graph image (1200×630) for every route at/below the app root.
// Next.js auto-injects the generated <meta property="og:image"> and
// <meta name="twitter:image"> tags from this file, so the summary_large_image
// Twitter card and OG previews render a real branded card instead of nothing.
// Kept dependency-free (system fonts, flexbox only) so it renders fast in the
// edge image runtime with no font fetch.

export const alt = "EcoLudus — gamified sustainability. Play, protect, and grow a greener tomorrow.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #102016 0%, #203b29 55%, #3d5d33 100%)",
          color: "#f4f1ea",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          position: "relative"
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(146,196,120,0.28), transparent 70%)",
            display: "flex"
          }}
        />

        {/* Brand row */}
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
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 1 }}>EcoLudus</div>
            <div style={{ fontSize: 15, letterSpacing: 6, textTransform: "uppercase", color: "#b9c9a8" }}>
              Forest Edition
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 920 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -1 }}>
            Play, protect, and grow a greener tomorrow.
          </div>
          <div style={{ fontSize: 30, fontWeight: 500, color: "#d6e2c6", lineHeight: 1.3 }}>
            Daily eco missions · virtual garden · real impact tracking.
          </div>
        </div>

        {/* Footer stat row */}
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {["Free to join", "AI-verified proof", "Track your CO₂ savings"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 24,
                fontWeight: 600,
                color: "#eef3e4"
              }}
            >
              <span style={{ color: "#9bc478", fontSize: 28 }}>✓</span>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}