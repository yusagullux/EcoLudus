import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail } from "@/lib/email";

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