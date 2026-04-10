"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { TextWithBrandMarks } from "@/components/BrandWordmark";
import { InstallPWABanner } from "@/components/InstallPWABanner";
import { useAppLocale } from "@/hooks/useAppLocale";
import { postAuthAudit } from "@/lib/postAuthAudit";
import { supabase, type AuthGetSessionResult } from "@/lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type Phase = "loading" | "form" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useAppLocale();
  const tl = t as Record<string, string>;
  const l = (k: string, fb: string) => tl[k] ?? fb;

  const [phase, setPhase] = useState<Phase>("loading");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [logoSrc, setLogoSrc] = useState("/logo-source.png");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let resolved = false;
    let timeoutId: number | undefined;

    const tryForm = (session: Session | null) => {
      if (resolved) return;
      if (session?.user) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        setPhase("form");
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "PASSWORD_RECOVERY") tryForm(session);
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") tryForm(session);
    });

    void supabase.auth.getSession().then((r: AuthGetSessionResult) => {
      tryForm(r.data.session);
      if (!resolved) {
        timeoutId = window.setTimeout(() => {
          if (!resolved) setPhase("error");
        }, 12000);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (phase !== "success") return;
    const t = window.setTimeout(() => router.replace("/dashboard"), 3000);
    return () => clearTimeout(t);
  }, [phase, router]);

  const submit = async () => {
    if (!supabase) return;
    setMsg("");
    if (pw.length < 8) {
      setMsg(l("reset_password_too_short", "Password must be at least 8 characters"));
      return;
    }
    if (pw !== pw2) {
      setMsg(l("reset_password_mismatch", "Passwords do not match"));
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setPhase("error");
        setBusy(false);
        return;
      }
      const token = data.user ? (await supabase.auth.getSession()).data.session?.access_token : null;
      await postAuthAudit({
        action: "auth_password_reset_completed",
        accessToken: token,
      });
      setPhase("success");
    } catch {
      setPhase("error");
    }
    setBusy(false);
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
              <TextWithBrandMarks text={l("reset_password_title", "")} tone="onLight" />
            </h1>
          </div>

          {phase === "loading" ? (
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">{l("login_submit_loading", "…")}</p>
          ) : null}

          {phase === "form" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {l("reset_password_new_password", "")}
                </label>
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {l("reset_password_confirm_password", "")}
                </label>
                <input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !busy && void submit()}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                  autoComplete="new-password"
                />
              </div>
              {msg ? <p className="text-sm text-red-600 dark:text-red-400 text-center">{msg}</p> : null}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || !pw || !pw2}
                className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors min-h-[44px]"
              >
                {busy ? l("login_submit_loading", "…") : l("reset_password_submit", "")}
              </button>
            </div>
          ) : null}

          {phase === "success" ? (
            <p className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {l("reset_password_success", "")}
            </p>
          ) : null}

          {phase === "error" ? (
            <p className="text-center text-sm text-red-600 dark:text-red-400">{l("reset_password_error", "")}</p>
          ) : null}
        </div>
        <p className="mt-8 text-sm font-medium tracking-wide text-white/80 dark:text-teal-200/80">
          {l("login_brand_footer", "machin.pro")}
        </p>
      </div>
      <InstallPWABanner labels={t} isDark={dark} />
    </>
  );
}
