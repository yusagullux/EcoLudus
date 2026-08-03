import type { Metadata, Viewport } from "next";
import { Baloo_2, Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const headingFont = Baloo_2({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap"
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const viewport: Viewport = {
  themeColor: "#102016",
  width: "device-width",
  initialScale: 1
};

export const metadata: Metadata = {
  metadataBase: new URL("https://ecoludus.com"),
  title: "EcoLudus | Sustainable Habits & Rewards",
  description: "Play, protect, and grow. EcoLudus is a gamified environmental sustainability platform that turns eco-friendly habits into a rewarding daily ritual.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EcoLudus"
  },
  openGraph: {
    title: "EcoLudus | Gamified Sustainability",
    description: "Turn eco actions into rewards. Grow your virtual collection and track your carbon footprint in a modern nature-inspired experience.",
    url: "https://ecoludus.com",
    siteName: "EcoLudus",
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "EcoLudus | Sustainable Habits & Rewards",
    description: "Turn eco actions into rewards and grow your virtual collection in a modern nature-inspired experience."
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" }
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Runs synchronously in <head> before the body paints, so the stored theme is
  // applied to <html data-theme> with no flash of the default (light) theme.
  // Mirrors lib/useTheme.tsx's STORAGE_KEY / valid-theme list. The
  // suppressHydrationWarning on <html> below silences the expected mismatch
  // between the server-rendered <html> (no data-theme) and the client <html>
  // (data-theme set by this script before hydration).
  const themeInitScript = `(function(){try{var t=localStorage.getItem("ecoludus.theme");var v=["light","dark","liquid","dawn","bloom","aurora"];if(!t||v.indexOf(t)<0)t="light";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "EcoLudus",
    "url": "https://ecoludus.com",
    "description": "Gamified environmental sustainability platform. Turn eco-friendly habits into daily rewards.",
    "applicationCategory": "LifestyleApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">{children}<Analytics /></body>
    </html>
  );
}
