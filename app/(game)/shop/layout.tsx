import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plant Shop | EcoLudus",
  description: "Spend EcoPoints on plants, eggs, and chests."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}