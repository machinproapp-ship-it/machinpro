"use client";

import Link from "next/link";
import type { PPPPricingResult } from "@/hooks/usePPPPricing";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { BrandWordmark, TextWithBrandMarks } from "@/components/BrandWordmark";
import { PppLandingFooterBar } from "@/components/PppLandingFooter";

type TxFn = (key: string, fallback: string) => string;

export function LandingPageFooter({
  tx,
  ppp,
  scrollToId,
}: {
  tx: TxFn;
  ppp: PPPPricingResult;
  scrollToId: (id: string) => void;
}) {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-12 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl">
        <PppLandingFooterBar tx={tx} ppp={ppp} />
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-9 w-9" sizes="36px" />
              <BrandWordmark tone="onLight" className="text-lg font-bold tracking-tight" />
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              {tx("landing_footer_desc", "Construction SaaS")}
            </p>
          </div>
          <div className="flex flex-wrap gap-10 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">{tx("landing_footer_nav", "Navigate")}</p>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_home", "Home")}
              </button>
              <button
                type="button"
                onClick={() => scrollToId("caracteristicas")}
                className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_features", "Features")}
              </button>
              <button
                type="button"
                onClick={() => scrollToId("pricing")}
                className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_pricing", "Pricing")}
              </button>
              <button
                type="button"
                onClick={() => scrollToId("contact")}
                className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_contact_link", "Contact")}
              </button>
              <Link
                href="/help"
                className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_help", "Help center")}
              </Link>
              <Link
                href="/about"
                className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_about", "About MachinPro")}
              </Link>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">{tx("landing_footer_legal", "Legal")}</p>
              <Link
                href="/legal/terms"
                className="block min-h-[44px] py-2 text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_terms", "Terms")}
              </Link>
              <Link
                href="/legal/privacy"
                className="block min-h-[44px] py-2 text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_privacy", "Privacy")}
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 dark:border-slate-800 sm:flex-row">
          <p className="text-center text-xs text-slate-500 dark:text-slate-500">
            <TextWithBrandMarks
              text={tx("landing_footer_copyright", "© 2026 MachinPro · machin.pro")}
              tone="inherit"
              className="inline"
            />
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-900"
            >
              {tx("landing_social_x", "X")}
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-900"
            >
              {tx("landing_social_li", "in")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
