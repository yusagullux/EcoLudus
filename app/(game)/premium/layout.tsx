import type { Metadata } from "next";

export const metadata: Metadata = {
  // Private, session-gated surface — keep the bare URL out of SERPs
  // (robots.txt Disallow alone still allows URL-only listings).
  robots: { index: false, follow: false },
  title: "Premium | EcoLudus",
  description: "EcoLudus Pro and Team plans."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}