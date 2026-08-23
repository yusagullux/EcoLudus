const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify";

export function isHCaptchaConfigured() {
  return Boolean(
    process.env.HCAPTCHA_SECRET_KEY?.trim() &&
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim()
  );
}

export async function verifyHCaptcha(token: string | undefined, request: Request) {
  const secret = process.env.HCAPTCHA_SECRET_KEY?.trim();

  // Keep local development usable before the deployment secrets are configured.
  // Production fails closed so captcha cannot be bypassed by omitting the token.
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  if (!token?.trim()) {
    return false;
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const remoteIp = forwardedFor || request.headers.get("x-real-ip")?.trim();
  const body = new URLSearchParams({
    secret,
    response: token.trim(),
    ...(remoteIp ? { remoteip: remoteIp } : {}),
    ...(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY
      ? { sitekey: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY.trim() }
      : {})
  });

  try {
    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store"
    });
    const result = await response.json().catch(() => null);
    return response.ok && result?.success === true;
  } catch {
    return false;
  }
}
