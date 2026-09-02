import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, logDevAuthLink } from "@/lib/email";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.stubEnv("BREVO_API_KEY", "test-key");
  vi.stubEnv("BREVO_FROM", "hello@ecoludus.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("returns {ok:false} and does not call fetch when BREVO_API_KEY is missing", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>", text: "t" });
    expect(res.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the Brevo body shape to the Brevo endpoint and returns ok on 2xx", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await sendEmail({ to: "u@example.com", toName: "U", subject: "Verify", html: "<h1/>", text: "verify" });
    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("https://api.brevo.com/v3/smtp/email");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.sender.email).toBe("hello@ecoludus.com");
    expect(body.to[0].email).toBe("u@example.com");
    expect(body.to[0].name).toBe("U");
    expect(body.subject).toBe("Verify");
    expect(body.htmlContent).toBe("<h1/>");
    expect(body.textContent).toBe("verify");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["api-key"]).toBe("test-key");
    expect(headers["content-type"]).toBe("application/json");
  });

  it("returns {ok:false} and swallows on non-2xx (never throws)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("err", { status: 400 }));
    const res = await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>", text: "t" });
    expect(res.ok).toBe(false);
  });
});

describe("logDevAuthLink", () => {
  it("logs the auth URL to the server terminal when send failed and not production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logDevAuthLink("Email verification", "http://localhost:3000/api/auth/verify-email?token=abc", { ok: false });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const out = warnSpy.mock.calls[0][0] as string;
    expect(out).toContain("http://localhost:3000/api/auth/verify-email?token=abc");
    expect(out).toContain("Email verification");
  });

  it("is silent when the email actually sent (ok:true)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logDevAuthLink("Email verification", "http://localhost:3000/api/auth/verify-email?token=abc", { ok: true });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("never logs in production, even when the send failed", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logDevAuthLink("Password reset", "http://localhost:3000/reset-password?token=abc", { ok: false });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});