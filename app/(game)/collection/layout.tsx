import type { Metadata } from "next";

export const metadata: Metadata = {
  // Private, session-gated surface — keep the bare URL out of SERPs
  // (robots.txt Disallow alone still allows URL-only listings).
  robots: { index: false, follow: false },
  title: "Collection | EcoLudus",
  description: "Your Pokédex-style collection of discovered plants, eggs, pets, seeds, and chests."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}