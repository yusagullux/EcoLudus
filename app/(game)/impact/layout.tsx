import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impact | EcoLudus",
  description: "Your carbon footprint reductions and real-world tree-planting milestones."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}