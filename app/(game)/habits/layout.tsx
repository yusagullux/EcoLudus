import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Habits | EcoLudus",
  description: "Build and track your sustainable daily habits."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}