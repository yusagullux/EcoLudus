import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Garden | EcoLudus",
  description: "Plant seeds and grow your virtual garden over time."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}