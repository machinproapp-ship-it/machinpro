"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { BrandWordmark } from "@/components/BrandWordmark";
import { useParams } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useVisitorPublicT } from "@/lib/visitorPublicLocale";

export default function VisitorCheckoutPage() {
  const params = useParams();
  const routeId = typeof params.projectId === "string" ? params.projectId : "";
  const visitorId = typeof params.visitorId === "string" ? params.visitorId : "";
  const t = useVisitorPublicT();
  const lx = t as Record<string, string>;

  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [status, setStatus] = useState<string>("");
  const [companyName, setCompanyName] = useState("");
  const [bye, setBye] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    if (!routeId || !visitorId) return;
    let cancelled = false;
    void (async () => {
      try {
        const vRes = await fetch(`/api/visitors/log/${encodeURIComponent(visitorId)}`);
        const vj = (await vRes.json()) as {
          visitor_name?: string;
          check_in?: string;
          status?: string;
          company_id?: string;
          project_id?: string | null;
          error?: string;
        };
        if (!vRes.ok) {
          if (!cancelled) setError(vj.error ?? t.visitors_error ?? "Error");
          return;
        }
        const belongs =
          (vj.company_id && vj.company_id === routeId) ||
          (vj.project_id && vj.project_id === routeId);
        if (!belongs) {
          if (!cancelled) setError(t.visitors_error ?? "Error");
          return;
        }
        if (vj.company_id) {
          const cRes = await fetch(`/api/visitors/company/${vj.company_id}`);
          const cj = (await cRes.json()) as { name?: string };
          if (!cancelled && cRes.ok) setCompanyName(cj.name ?? "");
        }
        if (!cancelled) {
          setVisitorName(vj.visitor_name ?? "");
          setCheckIn(vj.check_in ?? "");
          setStatus(vj.status ?? "");
          if (vj.status === "checked_out") setBye(true);
        }
      } catch {
        if (!cancelled) setError(t.visitors_error ?? "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId, visitorId, t.visitors_error]);

  const confirmCheckout = async () => {
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/visitors/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(j.error ?? t.visitors_error ?? "Error");
        setCheckoutLoading(false);
        return;
      }
      setBye(true);
    } catch {
      setError(t.visitors_error ?? "Error");
    }
    setCheckoutLoading(false);
  };

  const backHref = `/visit/${encodeURIComponent(routeId)}`;

  if (!routeId || !visitorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <p className="text-zinc-600 dark:text-zinc-400">{t.visitors_error ?? "Error"}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error && !visitorName) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-zinc-950 px-4">
        <p className="text-zinc-700 dark:text-zinc-300 text-center">{error}</p>
        <Link
          href={backHref}
          className="min-h-[44px] inline-flex items-center rounded-xl bg-amber-600 text-white px-6 py-3 text-sm font-semibold"
        >
          {t.visitors_checkin ?? "Check-in"}
        </Link>
      </div>
    );
  }

  if (bye) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
        <BrandLogoImage src="/logo.png" alt="" boxClassName="h-12 w-12" sizes="48px" />
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white text-center">
          {lx.visitor_checkout_success ?? t.visitors_goodbye ?? "Goodbye"}
        </h1>
        <p className="text-lg font-medium text-zinc-800 dark:text-zinc-200">{visitorName}</p>
        <p className="text-zinc-600 dark:text-zinc-400 text-center text-sm">
          {t.visitors_checkout_done ?? "Thank you"}
        </p>
        <Link
          href={backHref}
          className="min-h-[44px] inline-flex items-center rounded-xl border border-zinc-300 dark:border-zinc-600 px-6 py-3 text-sm font-medium"
        >
          {t.visitors_checkin ?? "Check-in"}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogoImage
              src="/logo.png"
              alt=""
              boxClassName="h-10 w-10 shrink-0"
              sizes="40px"
            />
            <div className="min-w-0">
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                <BrandWordmark tone="inherit" className="inline text-xs" />
              </p>
              <p className="font-semibold truncate">{companyName || "—"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-600"
            aria-label={t.darkMode ?? "Theme"}
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
          {t.visitors_checkout ?? "Check-out"}
        </h1>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 space-y-3">
          <p className="text-lg font-semibold">{visitorName}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t.visitors_checkin ?? "Check-in"}: {checkIn ? new Date(checkIn).toLocaleString() : "—"}
          </p>
          {status === "checked_out" && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {t.visitors_status_out ?? "Out"}
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center" role="alert">
            {error}
          </p>
        )}

        {status === "checked_in" && (
          <button
            type="button"
            onClick={() => void confirmCheckout()}
            disabled={checkoutLoading}
            className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-3 text-sm"
          >
            {checkoutLoading
              ? (t.visitors_loading ?? "…")
              : (lx.visitor_checkout_submit ?? t.visitors_confirm_checkout ?? "Confirm exit")}
          </button>
        )}
      </main>
    </div>
  );
}
