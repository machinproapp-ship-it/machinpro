"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { TextWithBrandMarks } from "@/components/BrandWordmark";
import { postAuthAudit } from "@/lib/postAuthAudit";
import { supabase } from "@/lib/supabase";
import type { Factor } from "@supabase/supabase-js";

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
  const [awaitingMfa, setAwaitingMfa] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [rateBlocked, setRateBlocked] = useState(false);
  const [rateResetSec, setRateResetSec] = useState(0);
  const [attemptsLeftHint, setAttemptsLeftHint] = useState<number | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const syncSessionRevFromUser = async () => {
    const { data: uwrap } = await supabase.auth.getUser();
    const u = uwrap.user;
    if (!u?.id) return;
    const meta = u.app_metadata as Record<string, unknown> | undefined;
    const rev = Number(meta?.machinpro_session_rev ?? 0);
    if (!Number.isFinite(rev)) return;
    try {
      localStorage.setItem(`machinpro_session_rev_${u.id}`, String(rev));
    } catch {
      /* ignore */
    }
  };

  const clearRateLimit = async () => {
    const em = email.trim().toLowerCase();
    if (!em) return;
    try {
      await fetch(`${origin}/api/auth/rate-limit`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
    } catch {
      /* ignore */
    }
  };

  const completeLoginSuccess = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token ?? null;
    await syncSessionRevFromUser();
    await postAuthAudit({ action: "auth_login", accessToken: token });
    await clearRateLimit();
    onLogin();
  };

  const handleLogin = async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    setRateBlocked(false);
    setAttemptsLeftHint(null);

    const em = email.trim().toLowerCase();
    try {
      const rl = await fetch(`${origin}/api/auth/rate-limit?email=${encodeURIComponent(em)}`);
      const rj = (await rl.json()) as { blocked?: boolean; attemptsLeft?: number; resetIn?: number };
      if (rj.blocked) {
        setRateBlocked(true);
        setRateResetSec(typeof rj.resetIn === "number" ? rj.resetIn : 0);
        setLoading(false);
        return;
      }
      if (typeof rj.attemptsLeft === "number" && rj.attemptsLeft < 5) {
        setAttemptsLeftHint(rj.attemptsLeft);
      }
    } catch {
      /* continue login if rate-limit unreachable */
    }

    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signErr) {
      try {
        await fetch(`${origin}/api/auth/rate-limit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: em }),
        });
      } catch {
        /* ignore */
      }
      setError(signErr.message);
      setLoading(false);
      return;
    }

    const { data: facData, error: facErr } = await supabase.auth.mfa.listFactors();
    if (facErr) {
      setError(facErr.message);
      setLoading(false);
      return;
    }
    const totpVerified = (facData?.totp ?? []).filter((f: Factor) => f.status === "verified");
    if (totpVerified.length > 0) {
      setMfaFactorId(totpVerified[0].id);
      setAwaitingMfa(true);
      setMfaCode("");
      setLoading(false);
      return;
    }

    await completeLoginSuccess();
    setLoading(false);
  };

  const handleMfaSubmit = async () => {
    if (!supabase || !mfaFactorId) return;
    setLoading(true);
    setError("");
    const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode.trim(),
    });
    if (vErr) {
      setError(l("mfa_error", "Incorrect code. Please try again"));
      setLoading(false);
      return;
    }
    setAwaitingMfa(false);
    setMfaFactorId(null);
    await completeLoginSuccess();
    setLoading(false);
  };

  const blockedMinutes = Math.max(1, Math.ceil(rateResetSec / 60));
  const blockedDesc = l("login_blocked_desc", "Try again in {n} minutes").replace(
    "{n}",
    String(blockedMinutes)
  );
  const attemptsDesc =
    attemptsLeftHint !== null
      ? l("login_attempts_left", "Attempts remaining: {n}").replace("{n}", String(attemptsLeftHint))
      : "";

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

        {awaitingMfa ? (
          <div className="space-y-4">
            <h2 className="text-center text-lg font-semibold text-zinc-900 dark:text-white">
              {l("login_mfa_title", "")}
            </h2>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("login_mfa_code_label", "")}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                onKeyDown={(e) => e.key === "Enter" && void handleMfaSubmit()}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{String(error)}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleMfaSubmit()}
              disabled={loading || mfaCode.trim().length < 6}
              className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors min-h-[44px]"
            >
              {loading ? l("login_submit_loading", "…") : l("login_mfa_submit", "")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("login_email_label", "Email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
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
                onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                placeholder={l("login_password_placeholder", "")}
                autoComplete="current-password"
              />
            </div>

            {rateBlocked ? (
              <div className="rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                <p className="font-semibold text-center">{l("login_blocked", "")}</p>
                <p className="text-center mt-1">{blockedDesc}</p>
              </div>
            ) : null}
            {!rateBlocked && attemptsDesc ? (
              <p className="text-sm text-amber-800 dark:text-amber-200 text-center">{attemptsDesc}</p>
            ) : null}
            {error && !rateBlocked ? (
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{String(error)}</p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading || !email || !password || rateBlocked}
              className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors min-h-[44px]"
            >
              {loading ? l("login_submit_loading", "…") : l("login_submit", "Sign in")}
            </button>
            <p className="text-center text-sm">
              <Link
                href="/forgot-password"
                className="font-medium text-amber-700 dark:text-amber-400 underline decoration-amber-600/40 underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
              >
                {l("login_forgot_password", "")}
              </Link>
            </p>
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              <Link
                href="/register"
                className="font-medium text-amber-700 dark:text-amber-400 underline decoration-amber-600/40 underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
              >
                {l("login_create_account", "Create an account")}
              </Link>
            </p>
          </div>
        )}
      </div>

      <p className="mt-8 text-sm font-medium tracking-wide text-white/80 dark:text-teal-200/80">
        {l("login_brand_footer", "machin.pro")}
      </p>
    </div>
  );
}
