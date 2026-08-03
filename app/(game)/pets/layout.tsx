import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pets | EcoLudus",
  description: "Your companion pets — hatch, name, and grow their bond."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}