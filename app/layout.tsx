import type { Metadata, Viewport } from "next";
import { Baloo_2, Manrope } from "next/font/google";
import "./globals.css";

const headingFont = Baloo_2({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800"]
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"]
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
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "EcoLudus Dashboard Preview"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "EcoLudus | Sustainable Habits & Rewards",
    description: "Turn eco actions into rewards and grow your virtual collection in a modern nature-inspired experience.",
    images: ["/og-image.jpg"]
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
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
