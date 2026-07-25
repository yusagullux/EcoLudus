// Next.js instrumentation hook — runs once in the Node.js runtime when the
// server starts. Used to initialize Sentry (and any other startup-time
// observability) before any request is handled.
//
// Sentry is fully opt-in: it only initializes when SENTRY_DSN is set, so the
// app carries no external dependency on a Sentry account in dev or on Vercel
// projects that haven't configured one. The heavy `@sentry/nextjs` import is
// behind the DSN gate so cold starts without Sentry pay nothing.

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  // Dynamic import keeps Sentry out of the module graph when it isn't configured.
  const Sentry = await import("@sentry/nextjs");

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Tune sample rates via env; default to 100% traces in dev, 10% in prod.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? (process.env.NODE_ENV === "production" ? 0.1 : 1.0)),
    // Don't send PII. Next.js request data can include cookies; disable.
    sendDefaultPii: false,
    // Silent the logger hook so we keep our own structured logger as the source
    // of truth for app logs; Sentry is for error capture only here.
    integrations: []
  });
}