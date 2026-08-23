const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify";

export function isHCaptchaConfigured() {
  return Boolean(
    process.env.HCAPTCHA_SECRET_KEY?.trim() &&
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim()
  );
}

export async function verifyHCaptcha(token: string | undefined, request: Request) {
  const secret = process.env.HCAPTCHA_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim();

  // CAPTCHA is enabled only when both sides of the integration are configured.
  // A public site key is compiled into the client bundle, so a deployment with
  // only HCAPTCHA_SECRET_KEY set renders no widget but would otherwise reject
  // every login and signup request with captcha-failed.
  if (!secret || !siteKey) {
    return true;
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
    sitekey: siteKey
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
