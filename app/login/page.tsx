import { AuthCard } from "@/components/auth-card";
import { MarketingShell } from "@/components/marketing-shell";

export default function LoginPage() {
  return (
    <MarketingShell ctaHref="/signup" ctaLabel="Create profile">
      <AuthCard mode="login" />
    </MarketingShell>
  );
}
