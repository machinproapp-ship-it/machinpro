"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { GeoTier } from "@/lib/geoTier";

export type SubscriptionPlan = "trial" | "starter" | "pro" | "enterprise";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export interface SubscriptionRow {
  id: string;
  company_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billing_period: "monthly" | "annual" | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  seats_limit: number | null;
  projects_limit: number | null;
  storage_limit_gb: number | null;
  geo_tier: number | null;
}

export interface SubscriptionAlert {
  type: "trial_ending" | "past_due";
  message: string;
}

export function useSubscription(companyId: string | null | undefined) {
  const [row, setRow] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!supabase || !companyId) {
      setRow(null);
      setLoading(false);
      return;
    }
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (qErr) {
      setError(qErr.message);
      setRow(null);
    } else {
      setRow(data as SubscriptionRow | null);
    }
    if (!silent) setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      void refresh({ silent: true });
    }, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const isActive = useMemo(() => {
    const s = row?.status;
    return s === "active" || s === "trialing";
  }, [row?.status]);

  const isTrial = useMemo(() => row?.status === "trialing" || row?.plan === "trial", [row?.status, row?.plan]);

  const trialDaysLeft = useMemo(() => {
    if (!row?.trial_ends_at) return null;
    const end = new Date(row.trial_ends_at).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return 0;
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  }, [row?.trial_ends_at]);

  const canAddUser = useCallback(
    (currentCount: number) => {
      const limit = row?.seats_limit;
      if (limit == null || limit >= 999_000) return true;
      return currentCount < limit;
    },
    [row?.seats_limit]
  );

  const canAddProject = useCallback(
    (currentCount: number) => {
      const limit = row?.projects_limit;
      if (limit == null || limit >= 999_000) return true;
      return currentCount < limit;
    },
    [row?.projects_limit]
  );

  const alerts = useMemo((): SubscriptionAlert[] => {
    const out: SubscriptionAlert[] = [];
    if (row?.status === "past_due") {
      out.push({
        type: "past_due",
        message: "past_due",
      });
    }
    if (row?.status === "trialing" && trialDaysLeft != null && trialDaysLeft > 0 && trialDaysLeft <= 7) {
      out.push({
        type: "trial_ending",
        message: "trial_ending",
      });
    }
    return out;
  }, [row?.status, trialDaysLeft]);

  const geoTier = useMemo((): GeoTier => {
    const g = row?.geo_tier;
    if (g === 1 || g === 2 || g === 3) return g;
    return 1;
  }, [row?.geo_tier]);

  return {
    subscription: row,
    loading,
    error,
    refresh,
    isActive,
    isTrial,
    trialDaysLeft,
    canAddUser,
    canAddProject,
    alerts,
    geoTier,
  };
}
