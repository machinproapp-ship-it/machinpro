"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { useAppLocale } from "@/hooks/useAppLocale";
import { useAuth } from "@/lib/AuthContext";
import type { Language } from "@/types/shared";

export default function NotFound() {
  const { tx, language, setLanguage } = useAppLocale();
  const { session, profile, loading } = useAuth();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (profile?.locale && profile.locale !== language) {
      setLanguage(profile.locale as Language);
    }
  }, [profile?.locale, language, setLanguage]);

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
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-[#0f3a45] via-[#134e5e] to-[#1a4f5e] dark:from-[#071a20] dark:via-[#0c2f38] dark:to-[#0f3a45]">
      <div className="absolute right-4 top-4 z-10">
        <button
          type="button"
          onClick={toggleDark}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
          aria-label={dark ? tx("lightMode", "Light mode") : tx("settingsDarkMode", "Dark mode")}
        >
          {dark ? "☀" : "☾"}
        </button>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:py-20">
        <div className="mb-8 flex justify-center">
          <BrandLogoImage
            src="/logo-source.png"
            alt=""
            boxClassName="h-20 w-20 sm:h-24 sm:w-24"
            sizes="(max-width: 768px) 80px, 96px"
            priority
          />
        </div>

        <p
          className="text-7xl font-bold leading-none tracking-tight text-[#f97316] sm:text-8xl lg:text-9xl"
          aria-hidden
        >
          404
        </p>

        <h1 className="mt-6 max-w-xl text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
          {tx("not_found_title", "Page not found")}
        </h1>

        <p className="mt-4 max-w-md text-base leading-relaxed text-teal-100/95 sm:text-lg">
          {tx("not_found_subtitle", "The page you are looking for does not exist or has been moved.")}
        </p>

        <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#f97316] px-6 py-3 text-center text-base font-semibold text-white shadow-lg transition-colors hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 sm:w-auto"
          >
            {tx("not_found_home", "Back to home")}
          </Link>
          {!loading && session ? (
            <Link
              href="/app"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border-2 border-white/80 bg-transparent px-6 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            >
              {tx("not_found_dashboard", "Go to dashboard")}
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
