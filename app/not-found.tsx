import Link from "next/link";
import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Page not found | EcoLudus",
  description: "This page doesn't exist. Find your way back to EcoLudus."
};

// Root 404 boundary — rendered by Next.js for any unmatched URL under the root
// layout (e.g. /nonexistent-page). Wrapped in the marketing shell so a mistyped
// link still lands on a branded, navigable surface instead of a bare 404.
export default function NotFound() {
  return (
    <MarketingShell ctaHref="/signup" ctaLabel="Create profile">
      <section className="mx-auto flex min-h-[calc(100vh-220px)] w-full max-w-3xl flex-col items-center justify-center gap-6 px-5 py-20 text-center sm:px-8">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-[28px] border text-5xl font-black shadow-[0_18px_38px_rgba(16,33,20,0.16)]"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
          aria-hidden="true"
        >
          404
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-balance font-serif text-4xl font-extrabold leading-tight sm:text-5xl" style={{ color: "var(--text-primary)" }}>
            This page has wandered off the trail
          </h1>
          <p className="mx-auto max-w-md text-base leading-7" style={{ color: "var(--text-secondary)" }}>
            The page you were looking for doesn&rsquo;t exist or may have moved. Let&rsquo;s get you back to your eco routine.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/landing"
            className="mk-btn-primary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(16,33,20,0.1)] transition hover:-translate-y-0.5"
          >
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className="mk-btn-ghost inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-[0_10px_26px_rgba(16,33,20,0.07)] backdrop-blur transition hover:-translate-y-0.5"
          >
            Go to dashboard
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}