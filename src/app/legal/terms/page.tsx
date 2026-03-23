"use client";

import Link from "next/link";
import { LegalSimpleNav } from "@/components/LegalSimpleNav";
import { useAppLocale } from "@/hooks/useAppLocale";

const KEYS = [
  "legal_terms_p1",
  "legal_terms_p2",
  "legal_terms_p3",
  "legal_terms_p4",
  "legal_terms_p5",
  "legal_terms_p6",
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
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {KEYS.map((k) => (
            <p key={k}>{tx(k, "")}</p>
          ))}
        </div>
        <p className="mt-10 text-sm">
          <Link href="/legal/privacy" className="font-semibold text-[#1a4f5e] underline dark:text-teal-400">
            {tx("legal_footer_privacy_link", "Privacy policy")}
          </Link>
        </p>
      </main>
    </div>
  );
}
