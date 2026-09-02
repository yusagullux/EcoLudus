import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyHCaptcha, isHCaptchaConfigured } from "@/lib/hcaptcha";

const originalFetch = global.fetch;

afterEach(() => {
  vi.unstubAllEnvs();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("verifyHCaptcha dev bypass", () => {
  it("returns true for a localhost request outside production, even with an empty token", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("HCAPTCHA_SECRET_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "sitekey");
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response('{"success":false}', { status: 200 }));
    const req = new Request("http://localhost:3000/api/auth/signup", { method: "POST" });
    const ok = await verifyHCaptcha(undefined, req);
    expect(ok).toBe(true);
    // Bypassed entirely — siteverify must not be called.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns true for 127.0.0.1 outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("HCAPTCHA_SECRET_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "sitekey");
    const ok = await verifyHCaptcha("", new Request("http://127.0.0.1:3000/api/auth/login"));
    expect(ok).toBe(true);
  });

  it("still runs siteverify in production for a real host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HCAPTCHA_SECRET_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "sitekey");
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response('{"success":true}', { status: 200 }));
    const req = new Request("https://ecoludus.com/api/auth/signup", { method: "POST" });
    const ok = await verifyHCaptcha("valid-token", req);
    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty token in production (no bypass)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HCAPTCHA_SECRET_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "sitekey");
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response('{"success":false}', { status: 200 }));
    const ok = await verifyHCaptcha(undefined, new Request("https://ecoludus.com/api/auth/signup"));
    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns true with no configured keys (captcha disabled)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HCAPTCHA_SECRET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "");
    expect(await verifyHCaptcha(undefined, new Request("https://ecoludus.com/api/auth/signup"))).toBe(true);
  });
});

describe("isHCaptchaConfigured", () => {
  it("is true only when both keys are present", () => {
    vi.stubEnv("HCAPTCHA_SECRET_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "sitekey");
    expect(isHCaptchaConfigured()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "");
    expect(isHCaptchaConfigured()).toBe(false);
  });
});