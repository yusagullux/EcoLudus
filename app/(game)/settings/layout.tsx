import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | EcoLudus",
  description: "Manage your account, display name, notifications, and theme."
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}