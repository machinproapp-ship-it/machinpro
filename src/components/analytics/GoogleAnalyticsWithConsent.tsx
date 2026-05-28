"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

const CONSENT_STORAGE_KEY = "machinpro_cookie_consent";

export function GoogleAnalyticsWithConsent() {
  const [consented, setConsented] = useState(false);
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  useEffect(() => {
    const check = () => {
      try {
        const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
        setConsented(stored === "all");
      } catch {
        setConsented(false);
      }
    };
    check();
    window.addEventListener("storage", check);
    window.addEventListener("mp:cookie-consent-changed", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("mp:cookie-consent-changed", check);
    };
  }, []);

  if (!gaId || !consented) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
