"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Sprout } from "lucide-react";

// Root error boundary — Next.js renders this for unhandled runtime errors in
// any route segment. It must be a Client Component (error boundaries require
// client-side state/lifecycle). Stays on-brand using theme CSS variables so it
// matches the active theme, and offers a retry (reset()) + a way back to the
// dashboard or home so a crash never leaves the user stranded on a bare screen.
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to the console for debugging in dev; in production the
    // platform's own error reporting picks it up. Kept lightweight — no network
    // call that could itself fail and mask the boundary.
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <section
      className="mx-auto flex min-h-[100vh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-5 py-20 text-center text-ink sm:px-8"
      style={{
        // Sanctioned inline style: `bg-page` has no @theme class mapping — the
        // app background lives on the page body, which this boundary replaces.
        background: "var(--bg-page)"
      }}
    >
      <div
        className="flex h-24 w-24 items-center justify-center rounded-dialog border border-line bg-surface shadow-elev-3"
        aria-hidden="true"
      >
        <Sprout className="h-12 w-12" />
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-balance font-serif text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
          Something went wrong
        </h1>
        <p className="mx-auto max-w-md text-base leading-7 text-ink-soft">
          An unexpected error occurred while loading this page. Your progress is safe — try again, or head back to familiar ground.
        </p>
        {error?.digest && (
          <p className="mx-auto text-xs font-mono text-ink-muted">
            Reference: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="mk-btn-primary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
        >
          Try again
        </button>
        <Link
          href="/"
          className="mk-btn-ghost inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
        >
          Back to home
        </Link>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        Go to dashboard
      </Link>
    </section>
  );
}