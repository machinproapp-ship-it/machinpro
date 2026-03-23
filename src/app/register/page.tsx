"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppLocale } from "@/hooks/useAppLocale";
import { supabase } from "@/lib/supabase";

export default function RegisterPublicPage() {
  const { tx } = useAppLocale();
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void supabase?.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) router.replace("/");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const toggleDark = () => {
    const next = !document.documentElement.classList.contains("dark");
    if (next) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("machinpro_dark_mode", "1");
      } catch {
        /* ignore */
      }
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("machinpro_dark_mode", "0");
      } catch {
        /* ignore */
      }
    }
    setDark(next);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-[#0f3a45] via-[#134e5e] to-[#1a4f5e] dark:from-[#071a20] dark:via-[#0c2f38] dark:to-[#0f3a45]">
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleDark}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20"
          aria-label="Theme"
        >
          {dark ? "☀" : "☾"}
        </button>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 dark:bg-slate-900/90 dark:border-slate-700 p-8 shadow-2xl backdrop-blur-sm text-center space-y-6">
        <div className="flex justify-center">
          <Image src="/logo-source.png" alt="" width={88} height={88} className="h-[88px] w-[88px] object-contain" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {tx("register_public_title", "Request access")}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {tx("register_public_body", "")}
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/landing"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#f97316] px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
          >
            {tx("register_public_cta_landing", "Homepage")}
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {tx("register_public_login", "Log in")}
          </Link>
        </div>
      </div>
      <p className="mt-8 text-sm font-medium text-white/80 dark:text-teal-200/80">
        {tx("login_brand_footer", "machin.pro")}
      </p>
    </div>
  );
}
