import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team | EcoLudus",
  description: "Your team missions, shared progress, and members."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}