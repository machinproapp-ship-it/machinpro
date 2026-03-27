"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoginScreen, { type LoginDemoAccount } from "@/components/LoginScreen";
import { InstallPWABanner } from "@/components/InstallPWABanner";
import { useAppLocale } from "@/hooks/useAppLocale";
import { supabase, type AuthGetSessionResult } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { t, tx } = useAppLocale();
  const [dark, setDark] = useState(false);

  const loginDemoAccounts = useMemo((): LoginDemoAccount[] => {
    const rawEnv = process.env.NEXT_PUBLIC_LOGIN_DEMOS;
    if (typeof rawEnv !== "string" || !rawEnv.trim()) return [];
    try {
      const raw = JSON.parse(rawEnv) as unknown;
      if (!Array.isArray(raw)) return [];
      return raw
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const o = x as Record<string, unknown>;
          const email = typeof o.email === "string" ? o.email : "";
          const password = typeof o.password === "string" ? o.password : "";
          const label = typeof o.label === "string" ? o.label : email;
          const accentClass =
            typeof o.accentClass === "string" ? o.accentClass : "ring-2 ring-teal-400/60";
          if (!email || !password) return null;
          return { email, password, label, accentClass };
        })
        .filter((x): x is LoginDemoAccount => x !== null);
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    setDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then((result: AuthGetSessionResult) => {
      if (cancelled) return;
      if (result.data.session) router.replace("/");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      <LoginScreen
        onLogin={() => {
          router.replace("/");
        }}
        labels={t as Record<string, string>}
        demoAccounts={loginDemoAccounts}
      />
      <InstallPWABanner labels={t} isDark={dark} />
    </>
  );
}
