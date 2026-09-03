import { logger, logError } from "@/lib/logger";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export type SendEmailInput = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = { ok: boolean };

// Brevo-only transactional sender (plain fetch, no SDK). Distinct from the
// SendGrid weekly-report cron. Failures are logged and swallowed — callers
// never throw on email outage, and provider errors are never surfaced to the
// client. No-op (returns {ok:false}) when BREVO_API_KEY is missing (dev).
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("BREVO_API_KEY not configured — skipping email send");
    return { ok: false };
  }

  // BREVO_FROM must be a sender validated in the Brevo account — Brevo rejects
  // the send ("sender is not valid") for anything else, and the request still
  // consumes an API call. Warn loudly when we have to fall back so a missing
  // env var on a new deployment is diagnosable instead of silently eaten.
  const from = process.env.BREVO_FROM?.trim();
  if (!from) {
    logger.warn(
      "BREVO_FROM is not set — falling back to hello@ecoludus.com, which will be rejected by Brevo until that sender is validated. Set BREVO_FROM to a validated sender."
    );
  }
  const fromName = process.env.BREVO_FROM_NAME?.trim() || "EcoLudus";

  const body = {
    sender: { name: fromName, email: from ?? "hello@ecoludus.com" },
    to: [{ email: input.to, name: input.toName ?? input.to }],
    subject: input.subject,
    htmlContent: input.html,
    textContent: input.text
  };

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    if (!response.ok) {
      // Log without the body (credentials/PII never logged).
      logError(`Brevo send failed: ${response.status} ${response.statusText}`, new Error(`Brevo HTTP ${response.status}`));
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    logError("Brevo send threw", error);
    return { ok: false };
  }
}

// Dev-only fallback: when an auth email can't be delivered (no/invalid Brevo
// key, unverified sender, etc.) in non-production, print the verification /
// reset link to the server terminal so local devs can complete the flow
// end-to-end without a working mail provider. Never logs to the client and
// never runs in production — respects the "swallow provider errors" contract.
export function logDevAuthLink(label: string, url: string, sendResult: SendEmailResult): void {
  if (sendResult.ok) return;
  if (process.env.NODE_ENV === "production") return;
  // Multi-line + box chars so it's easy to spot in a noisy dev terminal.
  console.warn(
    `\n┌─ ${label} (dev fallback — email delivery failed) ─────────────\n` +
    `│  ${url}\n` +
    `└──────────────────────────────────────────────────────────────\n`
  );
}

// Build an absolute verify/reset URL from APP_URL (default localhost:3000).
export function appUrl(): string {
  return (process.env.APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000");
}