"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRY_CONFIG, type CountryConfig } from "@/lib/countryConfig";
import type { PPPPricingResult } from "@/hooks/usePPPPricing";

type TxFn = (key: string, fallback: string) => string;

export function PppLandingFooterBar({
  tx,
  ppp,
}: {
  tx: TxFn;
  ppp: PPPPricingResult;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const countries = useMemo(
    () =>
      Object.values(COUNTRY_CONFIG).sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "")
      ),
    []
  );

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  if (!ppp.pricingReady || ppp.loadingGeo) return null;

  const cc = ppp.effectiveCountryCode;
  const cfg: CountryConfig | undefined = COUNTRY_CONFIG[cc];
  const flag = cfg?.flag ?? "🌍";
  const countryLabel = cfg?.name ?? cc;

  const countryLine = (
    tx("ppp_country_label", "Showing prices for {{country}}") || ""
  ).replace(/\{\{country\}\}/g, `${flag} ${countryLabel}`);

  const wrongLink = tx("ppp_wrong_country", "Not your country?");
  const selectTitle = tx("ppp_select_country", "Select region");

  return (
    <div className="mb-6 flex flex-col items-center gap-2 text-center sm:mb-8" ref={wrapRef}>
      <p className="max-w-2xl text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
        <span className="text-slate-600 dark:text-slate-300">{countryLine}</span>
        <span className="mx-1.5 text-slate-400">·</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-[44px] items-center gap-1 font-medium text-[#1a4f5e] underline decoration-[#1a4f5e]/40 underline-offset-2 hover:text-orange-600 dark:text-teal-400 dark:decoration-teal-400/40 dark:hover:text-teal-300"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {wrongLink}
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </p>
      {open ? (
        <div
          className="relative z-20 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="listbox"
          aria-label={selectTitle}
        >
          <p className="px-2 pb-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">{selectTitle}</p>
          <div className="max-h-[min(50vh,280px)] overflow-y-auto overscroll-contain">
            <button
              type="button"
              className="flex w-full min-h-[44px] items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => {
                ppp.setCountryOverride(null);
                setOpen(false);
              }}
            >
              {tx("landing_country_auto", "Automatic (detect)")}
            </button>
            {countries.map((c) => (
              <button
                key={c.code}
                type="button"
                className="flex w-full min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => {
                  ppp.setCountryOverride(c.code);
                  setOpen(false);
                }}
              >
                <span aria-hidden>{c.flag}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
