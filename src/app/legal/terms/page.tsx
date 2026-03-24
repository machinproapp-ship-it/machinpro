"use client";

import Link from "next/link";
import { LegalSimpleFooter } from "@/components/LegalSimpleFooter";
import { LegalSimpleNav } from "@/components/LegalSimpleNav";
import { useAppLocale } from "@/hooks/useAppLocale";

const SECTIONS = [
  { titleKey: "legal_terms_h_identification", bodyKey: "legal_terms_identification" },
  { titleKey: "legal_terms_h_liability", bodyKey: "legal_liability_disclaimer" },
  { titleKey: "legal_terms_h_signatures", bodyKey: "legal_digital_signature" },
  { titleKey: "legal_terms_h_uk", bodyKey: "legal_uk_gdpr" },
  { titleKey: "legal_terms_h_jurisdiction", bodyKey: "legal_jurisdiction" },
  { titleKey: "legal_terms_h_tax", bodyKey: "legal_tax_info" },
  { titleKey: "legal_terms_h_cancel", bodyKey: "legal_cancellation" },
] as const;

export default function LegalTermsPage() {
  const { tx } = useAppLocale();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <LegalSimpleNav />
      <main className="mx-auto max-w-3xl px-4 py-10 pb-20">
        <h1 className="text-3xl font-bold text-[#1a4f5e] dark:text-teal-400">
          {tx("legal_terms_title", "Terms of service")}
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
          <Link href="/legal/privacy" className="font-semibold text-[#1a4f5e] underline dark:text-teal-400">
            {tx("legal_footer_privacy_link", "Privacy policy")}
          </Link>
        </p>
      </main>
      <LegalSimpleFooter />
    </div>
  );
}
