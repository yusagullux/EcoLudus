"use client";

import { useEffect, useRef } from "react";

type HCaptchaWidgetProps = {
  onToken: (token: string) => void;
  onExpired: () => void;
};

type HCaptchaApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => number;
  reset: (widgetId?: number) => void;
};

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
  }
}

const SCRIPT_ID = "hcaptcha-script";

// hCaptcha only accepts "light" | "dark" — "auto" is invalid and throws
// "Cannot find theme with name: auto", which used to trip the error-callback
// and wipe the solved token. Pick from the user's OS preference instead.
function pickTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function HCaptchaWidget({ onToken, onExpired }: HCaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      return;
    }

    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.hcaptcha || widgetIdRef.current !== undefined) {
        return;
      }

      widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: onToken,
        "expired-callback": onExpired,
        // Non-destructive error handler. hCaptcha emits transient errors
        // (e.g. "localhost detected" in dev) that previously aliased to
        // onExpired and cleared a solved token, leaving submissions with an
        // empty captchaToken -> 403 auth/captcha-failed. Log only; a genuinely
        // invalid/expired token still surfaces at submit via the server check.
        "error-callback": (error: unknown) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[hCaptcha] widget error:", error);
          }
        },
        theme: pickTheme()
      });
    };

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (window.hcaptcha) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener("load", renderWidget);
    } else {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      existingScript?.removeEventListener("load", renderWidget);
    };
  }, [onExpired, onToken, siteKey]);

  if (!siteKey) {
    return null;
  }

  return <div ref={containerRef} className="min-h-[78px]" aria-label="Security verification" />;
}
