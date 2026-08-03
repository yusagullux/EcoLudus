import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Premium | EcoLudus",
  description: "EcoLudus Pro and Team plans."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}