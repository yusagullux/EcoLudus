import type { Metadata } from "next";

// Per-page tab title. The dashboard page is a client component ("use client"),
// so it can't export metadata itself — this co-located server layout owns the
// title for the segment.
export const metadata: Metadata = {
  title: "Dashboard | EcoLudus",
  description: "Your daily quest hub — track missions, streaks, XP, and weekly impact."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}