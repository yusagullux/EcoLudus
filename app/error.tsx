"use client";

import { useEffect } from "react";
import Link from "next/link";

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
    <section className="mx-auto flex min-h-[100vh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-5 py-20 text-center sm:px-8" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      <div
        className="flex h-24 w-24 items-center justify-center rounded-[28px] border text-5xl shadow-[0_18px_38px_rgba(16,33,20,0.16)]"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-panel)" }}
        aria-hidden="true"
      >
        ⚠️
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-balance font-serif text-4xl font-extrabold leading-tight sm:text-5xl" style={{ color: "var(--text-primary)" }}>
          Something went wrong
        </h1>
        <p className="mx-auto max-w-md text-base leading-7" style={{ color: "var(--text-secondary)" }}>
          An unexpected error occurred while loading this page. Your progress is safe — try again, or head back to familiar ground.
        </p>
        {error?.digest && (
          <p className="mx-auto text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            Reference: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="mk-btn-primary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(16,33,20,0.1)] transition hover:-translate-y-0.5"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="mk-btn-ghost inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-[0_10px_26px_rgba(16,33,20,0.07)] backdrop-blur transition hover:-translate-y-0.5"
        >
          Go to dashboard
        </Link>
        <Link
          href="/landing"
          className="inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition hover:opacity-80"
          style={{ color: "var(--text-muted)" }}
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}