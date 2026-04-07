"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { TextWithBrandMarks } from "@/components/BrandWordmark";
import { supabase } from "@/lib/supabase";

export type LoginDemoAccount = {
  email: string;
  password: string;
  label: string;
  /** Tailwind ring / border accent e.g. ring-amber-400/80 */
  accentClass: string;
};

export default function LoginScreen({
  onLogin,
  labels,
  demoAccounts = [],
}: {
  onLogin: () => void;
  labels: Record<string, string>;
  demoAccounts?: LoginDemoAccount[];
}) {
  const l = (k: string, fb: string) => labels[k] ?? fb;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logoSrc, setLogoSrc] = useState("/logo-source.png");

  const handleLogin = async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    } else {
      onLogin();
    }
    setLoading(false);
  };

  return (
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
            <TextWithBrandMarks text={l("login_title", "MachinPro")} tone="onLight" />
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {l("login_subtitle", "")}
          </p>
        </div>

        {demoAccounts.length > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 text-center">
              {l("login_demo_section", "")}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {demoAccounts.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className={`flex min-h-[44px] items-center gap-2 rounded-xl border-2 bg-white px-3 py-2 text-left text-xs font-semibold text-zinc-800 shadow-sm transition hover:brightness-95 dark:bg-slate-800 dark:text-zinc-100 ${d.accentClass}`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                    aria-hidden
                  >
                    {d.label.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="max-w-[8rem] truncate">{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {l("login_email_label", "Email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
              placeholder={l("login_email_placeholder", "")}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {l("login_password_label", "Password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
              placeholder={l("login_password_placeholder", "")}
              autoComplete="current-password"
            />
          </div>

          {error ? <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p> : null}

          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loading || !email || !password}
            className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors min-h-[44px]"
          >
            {loading ? l("login_submit_loading", "…") : l("login_submit", "Sign in")}
          </button>
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            <Link
              href="/register"
              className="font-medium text-amber-700 dark:text-amber-400 underline decoration-amber-600/40 underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
            >
              {l("login_create_account", "Create an account")}
            </Link>
          </p>
        </div>
      </div>

      <p className="mt-8 text-sm font-medium tracking-wide text-white/80 dark:text-teal-200/80">
        {l("login_brand_footer", "machin.pro")}
      </p>
    </div>
  );
}
