"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { detectGeo, type GeoDetect } from "@/lib/geoTier";
import { ALL_TRANSLATIONS, type Language } from "@/lib/i18n";

const STORAGE_KEY = "machinpro_cookie_consent";

function cookieTextKey(geo: GeoDetect): string {
  if (geo.region === "uk") return "cookie_uk_gdpr_text";
  if (geo.region === "eu") return "cookie_gdpr_text";
  if (geo.country === "MX") return "cookie_lfpdppp_text";
  if (geo.country === "US" && geo.usState === "CA") return "cookie_ccpa_text";
  if (geo.region === "northam") return "cookie_pipeda_text";
  if (geo.region === "latam_norte" || geo.region === "latam_sur") return "cookie_latam_text";
  return "cookie_latam_text";
}

export function CookieConsent() {
  const pathname = usePathname();
  const onLanding = pathname === "/landing" || pathname.startsWith("/landing/");
  const [visible, setVisible] = useState(false);
  const [geo, setGeo] = useState<GeoDetect | null>(null);
  const [lang, setLang] = useState<Language>("es");

  useEffect(() => {
    if (!onLanding) return;
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "all" || v === "essential") return;
    } catch {
      /* ignore */
    }
    setVisible(true);
    let cancelled = false;
    void detectGeo().then((g) => {
      if (!cancelled) setGeo(g);
    });
    return () => {
      cancelled = true;
    };
  }, [onLanding]);

  useEffect(() => {
    try {
      const s = localStorage.getItem("machinpro_language");
      if (s && typeof s === "string") setLang(s as Language);
      else {
        const nav = navigator.language?.slice(0, 2).toLowerCase();
        if (nav && nav in ALL_TRANSLATIONS) setLang(nav as Language);
      }
    } catch {
      /* ignore */
    }
  }, []);

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
    setVisible(false);
  };

  if (!onLanding || !visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white/95 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-950/95"
      role="dialog"
      aria-label={tx("cookie_banner_text", "Cookies")}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{body}</p>
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
