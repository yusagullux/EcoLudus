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
        "error-callback": onExpired,
        theme: "auto"
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
