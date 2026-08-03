import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Insights | EcoLudus",
  description: "Charts and trends across your eco habits and progress."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}