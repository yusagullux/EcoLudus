import type { NextConfig } from "next";

// Content-Security-Policy. Permissive-but-present as a first pass; ratchet
// down after runtime testing. Covers the real external surface:
//   - Leaflet JS + CSS from unpkg (/ecomap) and CARTO map tiles
//   - Supabase Storage public avatar images
//   - Vercel Analytics (va.vercel-scripts.com)
//   - next/font (self-hosted) and Tailwind v4 + styled-jsx (inline styles)
// External integrations (Gemini, Climatiq, Ecologi, SendGrid, Overpass) run
// server-side only, so they do not appear in the browser connect-src.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  // Next.js injects inline runtime/hydration scripts; JSON-LD is inline. Using
  // 'unsafe-inline' until a per-request nonce strategy is added.
  `script-src 'self' 'unsafe-inline' https://unpkg.com https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https://*.cartocdn.com https://*.openstreetmap.org https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://va.vercel-scripts.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // X-Frame-Options is redundant with frame-ancestors 'none' but kept for legacy browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation=(self) is required by /ecomap check-in; everything else denied.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=()"
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Serve AVIF (preferred) and WebP for any next/image usage. The decorative
  // backgrounds under public/images are already shipped as .webp directly;
  // this configures the optimizer for when pages adopt next/image.
  images: {
    formats: ["image/avif", "image/webp"]
  },
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/favicon.png",
        permanent: true
      }
    ];
  },
  async headers() {
    return [
      {
        // Security headers apply to every route (pages, API, static assets).
        source: "/(.*)",
        headers: securityHeaders
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/css/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800"
          }
        ]
      },
      {
        source: "/js/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800"
          }
        ]
      },
      {
        source: "/quests.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400"
          }
        ]
      }
    ];
  }
};

export default nextConfig;