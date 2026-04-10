"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { TextWithBrandMarks } from "@/components/BrandWordmark";
import { InstallPWABanner } from "@/components/InstallPWABanner";
import { useAppLocale } from "@/hooks/useAppLocale";
import { postAuthAudit } from "@/lib/postAuthAudit";
import { supabase } from "@/lib/supabase";

type Phase = "idle" | "loading" | "sent" | "error";

export default function ForgotPasswordPage() {
  const { t } = useAppLocale();
  const tl = t as Record<string, string>;
  const l = (k: string, fb: string) => tl[k] ?? fb;

  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [logoSrc, setLogoSrc] = useState("/logo-source.png");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  }, []);

  const siteBase =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")) ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "https://machin.pro";
  const redirectTo = `${siteBase}/reset-password`;

  const submit = async () => {
    if (!supabase || !email.trim()) return;
    setPhase("loading");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) {
        setPhase("error");
        return;
      }
      await postAuthAudit({
        action: "auth_password_reset_requested",
        email: email.trim(),
      });
      setPhase("sent");
    } catch {
      setPhase("error");
    }
  };

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-[#0f3a45] via-[#134e5e] to-[#1a4f5e] dark:from-[#071a20] dark:via-[#0c2f38] dark:to-[#0f3a45]">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/95 dark:bg-slate-900/90 dark:border-slate-700 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex justify-center">
              <BrandLogoImage
                src={logoSrc}
                alt=""
                boxClassName="h-24 w-24"
                sizes="96px"
                priority
                onError={() => setLogoSrc("/icons/icon-192x192.png")}
              />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              <TextWithBrandMarks text={l("forgot_password_title", "")} tone="onLight" />
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {l("forgot_password_subtitle", "")}
            </p>
          </div>

          {phase === "sent" ? (
            <div className="space-y-4 text-center">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {l("forgot_password_sent", "")}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{l("forgot_password_sent_desc", "")}</p>
              <Link
                href="/login"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-3 text-sm font-medium text-zinc-800 dark:text-zinc-100"
              >
                {l("forgot_password_back_to_login", "")}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {l("forgot_password_email_label", "")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && phase !== "loading" && void submit()}
                  disabled={phase === "loading"}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                  autoComplete="email"
                />
              </div>
              {phase === "error" ? (
                <p className="text-sm text-red-600 dark:text-red-400 text-center">
                  {l("forgot_password_error", "")}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={phase === "loading" || !email.trim()}
                className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors min-h-[44px]"
              >
                {phase === "loading" ? l("login_submit_loading", "…") : l("forgot_password_submit", "")}
              </button>
              <p className="text-center text-sm">
                <Link
                  href="/login"
                  className="font-medium text-amber-700 dark:text-amber-400 underline decoration-amber-600/40 underline-offset-2"
                >
                  {l("forgot_password_back_to_login", "")}
                </Link>
              </p>
            </div>
          )}
        </div>
        <p className="mt-8 text-sm font-medium tracking-wide text-white/80 dark:text-teal-200/80">
          {l("login_brand_footer", "machin.pro")}
        </p>
      </div>
      <InstallPWABanner labels={t} isDark={dark} />
    </>
  );
}
