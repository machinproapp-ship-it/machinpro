"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useSubscription } from "@/lib/useSubscription";
import { buildPricingUpgradeUrl } from "@/lib/pricingUrls";

const LS_KEY = "machinpro_trial_banner_snooze_until";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

export interface TrialExpiryBannerProps {
  companyId: string | null | undefined;
  labels: Record<string, string>;
}

export function TrialExpiryBanner({ companyId, labels }: TrialExpiryBannerProps) {
  const L = (k: string, fb: string) => labels[k] ?? fb;
  const { subscription: row, trialDaysLeft, isTrial } = useSubscription(companyId ?? null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const until = parseInt(raw, 10);
      if (Number.isFinite(until) && Date.now() < until) {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const visible = useMemo(() => {
    if (!companyId || !row || dismissed) return false;
    if (!isTrial && row.status !== "trialing") return false;
    if (trialDaysLeft == null) return false;
    return trialDaysLeft <= 7;
  }, [companyId, row, dismissed, isTrial, trialDaysLeft]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const upgradeHref = useMemo(() => {
    if (typeof window === "undefined") return "/pricing";
    return buildPricingUpgradeUrl({
      origin: window.location.origin,
      planKey: row?.plan ?? null,
      billingPeriod: row?.billing_period ?? null,
    });
  }, [row?.plan, row?.billing_period]);

  if (!visible) return null;

  const expired = trialDaysLeft !== null && trialDaysLeft <= 0;
  const bannerText = expired
    ? L("trial_expired_banner", "Your trial has expired. Upgrade to keep access.")
    : L("trial_expiry_banner", "Your trial expires in {days} days.").replace(
        /\{days\}/g,
        String(Math.max(0, trialDaysLeft ?? 0))
      );

  return (
    <div
      role="region"
      aria-live="polite"
      className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-orange-400/80 bg-orange-50 px-4 py-3 shadow-sm dark:border-orange-700/70 dark:bg-orange-950/40 sm:items-center sm:justify-between sm:gap-4"
    >
      <p className="min-w-0 flex-1 text-sm font-semibold text-orange-950 dark:text-orange-50">{bannerText}</p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={upgradeHref}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
        >
          {L("trial_expiry_upgrade", "Upgrade now")}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-orange-300 bg-white p-2 text-orange-900 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-100 dark:hover:bg-orange-900/50"
          aria-label={L("dismiss", "Dismiss")}
        >
          <X className="h-5 w-5 shrink-0" aria-hidden />
        </button>
      </div>
    </div>
  );
}
