import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Reset password · EcoLudus",
  description: "Choose a new password for your EcoLudus account."
};

export default function ResetPasswordPage() {
  return (
    <MarketingShell>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </MarketingShell>
  );
}