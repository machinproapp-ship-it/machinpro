"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { detectGeo, type GeoDetect } from "@/lib/geoTier";
import { ALL_TRANSLATIONS, type Language } from "@/lib/i18n";

const STORAGE_KEY = "machinpro_cookie_consent";

/** Defer cookie bar so hero (logo + headline) can become LCP, not this paragraph. */
const LANDING_BANNER_DEFER_MS = 150;

function cookieTextKey(geo: GeoDetect): string {
  if (geo.region === "uk") return "cookie_uk_gdpr_text";
  if (geo.region === "eu") return "cookie_gdpr_text";
  if (geo.country === "MX") return "cookie_lfpdppp_text";
  if (geo.country === "US" && geo.usState === "CA") return "cookie_ccpa_text";
  if (geo.region === "northam") return "cookie_pipeda_text";
  if (geo.region === "latam_norte" || geo.region === "latam_sur") return "cookie_latam_text";
  return "cookie_latam_text";
}

function readStoredLanguage(): Language {
  try {
    const s = localStorage.getItem("machinpro_language");
    if (s && typeof s === "string" && s in ALL_TRANSLATIONS) return s as Language;
    const nav = navigator.language?.slice(0, 2).toLowerCase();
    if (nav && nav in ALL_TRANSLATIONS) return nav as Language;
  } catch {
    /* ignore */
  }
  return "es";
}

function hasConsentChoice(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "all" || v === "essential";
  } catch {
    return false;
  }
}

export function CookieConsent() {
  const pathname = usePathname();
  const onLanding = pathname === "/landing" || pathname.startsWith("/landing/");
  const [paintReady, setPaintReady] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [geo, setGeo] = useState<GeoDetect | null>(null);
  const [lang, setLang] = useState<Language>("es");

  useEffect(() => {
    if (!onLanding) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setPaintReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [onLanding]);

  useEffect(() => {
    if (!onLanding || !paintReady) return;
    if (hasConsentChoice()) return;

    setLang(readStoredLanguage());

    let cancelled = false;
    const deferTimer = window.setTimeout(() => {
      if (!cancelled) setShowBanner(true);
    }, LANDING_BANNER_DEFER_MS);

    void detectGeo().then((g) => {
      if (!cancelled) setGeo(g);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(deferTimer);
    };
  }, [onLanding, paintReady]);

  const t = useMemo(() => {
    const pack = (ALL_TRANSLATIONS as Record<string, Record<string, string>>)[lang];
    return (pack ?? ALL_TRANSLATIONS.en) as Record<string, string>;
  }, [lang]);
  const tx = (k: string, fb: string) => t[k] ?? fb;

  const messageKey = geo ? cookieTextKey(geo) : "cookie_pipeda_text";
  const regional = tx(messageKey, "");
  const simple = tx("cookie_message", "");
  const body = simple.trim() !== "" ? simple : regional || tx("cookie_banner_text", "");

  const persist = (mode: "all" | "essential") => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("mp:cookie-consent-changed"));
    setShowBanner(false);
  };

  if (!onLanding || !showBanner) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/95 sm:p-4"
      role="region"
      aria-label={tx("cookie_banner_text", "Cookies")}
    >
      <div className="pointer-events-auto mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-xs leading-snug text-slate-700 dark:text-slate-300 sm:text-sm sm:leading-relaxed">
          {body}
        </p>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <button
            type="button"
            className="min-h-[44px] rounded-xl bg-[#1a4f5e] px-4 text-sm font-semibold text-white hover:bg-[#134e5e] dark:bg-teal-800 dark:hover:bg-teal-700"
            onClick={() => persist("all")}
          >
            {tx("cookie_accept", "") || tx("cookie_accept_all", "Accept all")}
          </button>
          <button
            type="button"
            className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => persist("essential")}
          >
            {tx("cookie_necessary", "") || tx("cookie_essential_only", "Essential only")}
          </button>
          <Link
            href="/legal/privacy"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#b8860b] px-4 text-sm font-semibold text-[#b8860b] hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            {tx("cookie_learn_more", "") || tx("cookie_view_policy", "Privacy policy")}
          </Link>
        </div>
      </div>
    </div>
  );
}
