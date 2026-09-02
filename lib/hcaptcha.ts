const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify";

export function isHCaptchaConfigured() {
  return Boolean(
    process.env.HCAPTCHA_SECRET_KEY?.trim() &&
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim()
  );
}

// Dev bypass: hCaptcha's widget misbehaves on localhost (emits a
// "localhost detected" error that can clear the token before submit), and
// local dev doesn't need bot protection. Skip siteverify for localhost
// requests outside production. NEVER active in production — production keeps
// the full siteverify check.
function isLocalDevRequest(request: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return true;
  try {
    const hostname = new URL(request.url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
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

  // Local dev: no bot protection needed, and the widget errors on localhost.
  if (isLocalDevRequest(request)) {
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
