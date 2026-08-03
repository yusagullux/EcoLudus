import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collection | EcoLudus",
  description: "Your Pokédex-style collection of discovered plants, eggs, pets, seeds, and chests."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}