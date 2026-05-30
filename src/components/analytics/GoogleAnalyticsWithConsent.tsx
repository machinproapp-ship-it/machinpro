"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const CONSENT_STORAGE_KEY = "machinpro_cookie_consent";
const GOOGLE_ADS_ID = "AW-18195523780";

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

  return (
    <>
      <Script
        id="machinpro-gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
            gtag('config', '${GOOGLE_ADS_ID}');
          `,
        }}
      />
      <Script
        id="machinpro-gtag-js"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
    </>
  );
}
