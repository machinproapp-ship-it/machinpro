"use client";

import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { BrandWordmark } from "@/components/BrandWordmark";
import { useAppLocale } from "@/hooks/useAppLocale";

export function LegalSimpleFooter() {
  const { tx } = useAppLocale();

  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Link href="/landing" className="flex items-center gap-2 min-h-[44px]">
              <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-8 w-8" sizes="32px" />
              <BrandWordmark tone="onLight" className="text-base font-bold tracking-tight" />
            </Link>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{tx("landing_footer_desc", "")}</p>
          </div>
          <div className="flex flex-wrap gap-8 text-sm">
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">{tx("landing_footer_nav", "")}</p>
              <Link
                href="/landing"
                className="block min-h-[44px] py-2 text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_home", "")}
              </Link>
              <Link
                href="/landing#features"
                className="block min-h-[44px] py-2 text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_features", "")}
              </Link>
              <Link
                href="/landing#pricing"
                className="block min-h-[44px] py-2 text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_pricing", "")}
              </Link>
              <Link
                href="/landing#contact"
                className="block min-h-[44px] py-2 text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_contact_link", "")}
              </Link>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">{tx("landing_footer_legal", "")}</p>
              <Link
                href="/legal/terms"
                className="block min-h-[44px] py-2 text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_terms", "")}
              </Link>
              <Link
                href="/legal/privacy"
                className="block min-h-[44px] py-2 text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
              >
                {tx("landing_footer_privacy", "")}
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row">
          <p className="text-center text-xs text-slate-500 dark:text-slate-500">
            {tx("landing_footer_copyright", "")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-900"
            >
              {tx("landing_social_x", "")}
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-900"
            >
              {tx("landing_social_li", "")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
