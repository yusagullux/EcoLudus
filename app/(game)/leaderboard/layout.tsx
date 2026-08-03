import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard | EcoLudus",
  description: "Top EcoLudus players by XP and eco impact."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}