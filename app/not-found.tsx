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
          className="flex h-24 w-24 items-center justify-center rounded-dialog border border-line bg-surface text-5xl font-black text-ink shadow-elev-3"
          aria-hidden="true"
        >
          404
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="text-balance font-serif text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            This page has wandered off the trail
          </h1>
          <p className="mx-auto max-w-md text-base leading-7 text-ink-soft">
            The link may be mistyped or the page may have moved. Let&rsquo;s get you back on the trail.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="mk-btn-primary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
          >
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Go to dashboard
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}