import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Friends | EcoLudus",
  description: "Add players, send cheers, and complete social quests."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}