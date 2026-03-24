"use client";

import Link from "next/link";
import { LegalSimpleFooter } from "@/components/LegalSimpleFooter";
import { LegalSimpleNav } from "@/components/LegalSimpleNav";
import { useAppLocale } from "@/hooks/useAppLocale";

const SECTIONS = [
  { titleKey: "legal_privacy_h_intro", bodyKey: "legal_privacy_intro" },
  { titleKey: "legal_privacy_h_gdpr", bodyKey: "legal_gdpr" },
  { titleKey: "legal_privacy_h_uk", bodyKey: "legal_uk_gdpr" },
  { titleKey: "legal_privacy_h_pipeda", bodyKey: "legal_pipeda" },
  { titleKey: "legal_privacy_h_mx", bodyKey: "legal_lfpdppp" },
  { titleKey: "legal_privacy_h_ccpa", bodyKey: "legal_ccpa" },
  { titleKey: "legal_privacy_h_latam", bodyKey: "legal_latam_privacy" },
  { titleKey: "legal_privacy_h_providers", bodyKey: "legal_providers" },
] as const;

export default function LegalPrivacyPage() {
  const { tx } = useAppLocale();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <LegalSimpleNav />
      <main className="mx-auto max-w-3xl px-4 py-10 pb-20">
        <h1 className="text-3xl font-bold text-[#1a4f5e] dark:text-teal-400">
          {tx("legal_privacy_title", "Privacy policy")}
        </h1>
        <div className="mt-10 space-y-10">
          {SECTIONS.map(({ titleKey, bodyKey }) => (
            <section key={bodyKey}>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{tx(titleKey, "")}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                {tx(bodyKey, "")}
              </p>
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm">
          <Link href="/legal/terms" className="font-semibold text-[#1a4f5e] underline dark:text-teal-400">
            {tx("legal_footer_terms_link", "Terms of service")}
          </Link>
        </p>
      </main>
      <LegalSimpleFooter />
    </div>
  );
}
