import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile | EcoLudus",
  description: "Your public EcoLudus profile, stats, and collection book."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}