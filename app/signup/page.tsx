import { AuthCard } from "@/components/auth-card";
import { MarketingShell } from "@/components/marketing-shell";

export default function SignupPage() {
  return (
    <MarketingShell ctaHref="/login" ctaLabel="Log in">
      <AuthCard mode="signup" />
    </MarketingShell>
  );
}
