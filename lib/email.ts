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

  const from = process.env.BREVO_FROM?.trim() || "hello@ecoludus.com";
  const fromName = process.env.BREVO_FROM_NAME?.trim() || "EcoLudus";

  const body = {
    sender: { name: fromName, email: from },
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
      logError(`Brevo send failed: ${response.status} ${response.statusText}`);
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    logError("Brevo send threw", error);
    return { ok: false };
  }
}

// Build an absolute verify/reset URL from APP_URL (default localhost:3000).
export function appUrl(): string {
  return (process.env.APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000");
}