import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";

// Social share card (og:image + twitter image) for the root segment — Next
// wires this file into the metadata tree at build time, so `/` and the auth
// pages get a real preview image without a hand-maintained binary in public/.
// Styling follows the "Field Guide" identity: forest-dark panel, cream ink,
// mission-chip row.

export const alt = "EcoLudus — daily eco missions with real-world impact";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  // Inlined as a data URI — satori can't read the filesystem itself, and
  // bundler asset imports aren't supported inside ImageResponse.
  const faviconPath = path.join(process.cwd(), "public", "favicon.png");
  const faviconDataUri = `data:image/png;base64,${readFileSync(faviconPath).toString("base64")}`;

  const chips = ["Daily quests", "Virtual garden", "Real impact"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          backgroundColor: "#f0f4e8",
          color: "#102016",
          fontFamily: "sans-serif",
        }}
      >
        {/* Text panel */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "76px 64px 76px 88px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                overflow: "hidden",
                display: "flex",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={faviconDataUri} width={64} height={64} alt="" />
            </div>
            <div
              style={{
                fontSize: 42,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              EcoLudus
            </div>
          </div>

          <div
            style={{
              marginTop: 48,
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: "-0.02em",
            }}
          >
            Play. Protect. Grow.
          </div>

          <div
            style={{
              marginTop: 26,
              fontSize: 28,
              lineHeight: 1.4,
              color: "#3f5347",
              maxWidth: 560,
            }}
          >
            Turn eco-friendly habits into a rewarding daily ritual — quests,
            a garden that grows, and impact that counts.
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
            {chips.map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "12px 24px",
                  border: "2px solid #d3ddc6",
                  borderRadius: 999,
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#3f5347",
                  backgroundColor: "#ffffff",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Forest panel with the garden motif */}
        <div
          style={{
            width: 400,
            display: "flex",
            backgroundColor: "#102016",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            {[
              { size: 150, color: "#8fd08f" },
              { size: 108, color: "#5aa86b" },
              { size: 78, color: "#c9e4b4" },
            ].map((dot, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: i === 1 ? "flex-start" : "flex-end",
                  marginLeft: i === 0 ? 40 : i === 1 ? -60 : 90,
                  marginRight: i === 0 ? 0 : 0,
                }}
              >
                <div
                  style={{
                    width: dot.size,
                    height: dot.size,
                    borderRadius: dot.size / 2,
                    backgroundColor: dot.color,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}