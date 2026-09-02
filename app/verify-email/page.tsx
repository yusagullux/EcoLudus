import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { VerifyEmailResult } from "./verify-result";

export const metadata: Metadata = {
  title: "Verify email · EcoLudus",
  description: "Confirm your email address to finish setting up your EcoLudus account."
};

export default function VerifyEmailPage() {
  return (
    <MarketingShell>
      <Suspense>
        <VerifyEmailResult />
      </Suspense>
    </MarketingShell>
  );
}