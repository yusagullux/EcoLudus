// Thin structured logger for server-side code. Emits one JSON object per line
// to stdout/stderr so Vercel/serverless logs are greppable and machine-parseable.
// Dependency-light by design (no winston/pino): just a level, timestamp, message,
// and optional context object. In development it pretty-prints for readability.
//
// Client code should NOT import this — it writes to stdout and references env
// vars that only exist server-side. For client logging keep using console.*.

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function configuredLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return raw in LEVEL_ORDER ? (raw as LogLevel) : "info";
}

const isDev = process.env.NODE_ENV !== "production";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[configuredLevel()];
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString()
  };
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) entry[key] = value;
    }
  }

  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  if (isDev) {
    // Pretty-print in dev: keep the JSON shape but indented, plus a colored tag.
    const tag = level.toUpperCase().padEnd(5);
    const ctx = context ? " " + JSON.stringify(context) : "";
    stream.write(`${tag} ${message}${ctx}\n`);
  } else {
    stream.write(JSON.stringify(entry) + "\n");
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context)
};

// Convenience: log an Error object with its stack under a stable key, so a downstream
// aggregator (Sentry, etc.) can group on it. Falls back to stringifying non-Error throws.
export function logError(message: string, error: unknown, context?: Record<string, unknown>): void {
  const ctx: Record<string, unknown> = { ...context };
  if (error instanceof Error) {
    ctx.errorName = error.name;
    ctx.stack = error.stack;
  } else if (error !== undefined) {
    ctx.error = String(error);
  }
  write("error", message, ctx);
  captureForSentry(error, message, context);
}

/**
 * Forward an error to Sentry if (and only if) it has been initialized via
 * instrumentation.ts (SENTRY_DSN set). Otherwise a no-op. Kept separate from
 * {@link logError} so non-error logs don't create Sentry events.
 */
export async function reportError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  captureForSentry(error, "reportError", context);
}

function captureForSentry(error: unknown, message: string, context?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) return;
  // Lazy-import so the logger stays usable in environments where the
  // @sentry/nextjs package is present but not configured at runtime.
  import("@sentry/nextjs")
    .then((Sentry) => {
      const err = error instanceof Error ? error : new Error(String(error));
      if (context) Sentry.captureException(err, { extra: { message, ...context } });
      else Sentry.captureException(err, { extra: { message } });
    })
    // Swallow — logging must never throw. The structured log line above is the
    // durable record if Sentry ingest fails.
    .catch(() => {});
}