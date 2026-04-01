"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Circle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { MainSection } from "@/types/shared";

const DISMISS_KEY = "machinpro_getting_started_dismissed";

export interface GettingStartedWidgetProps {
  companyId: string;
  labels: Record<string, string>;
  onNavigateAppSection: (section: MainSection) => void;
}

export function GettingStartedWidget({ companyId, labels, onNavigateAppSection }: GettingStartedWidgetProps) {
  const L = (k: string, fb: string) => labels[k] ?? fb;
  const [dismissed, setDismissed] = useState(false);
  const [steps, setSteps] = useState<boolean[] | null>(null);
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      setDismissed(v === "1" || v === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!supabase || !companyId) {
      setLoading(false);
      setEligible(false);
      setSteps(null);
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setLoading(false);
      setEligible(false);
      setSteps(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/onboarding/getting-started?companyId=${encodeURIComponent(companyId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setEligible(false);
        setSteps(null);
        return;
      }
      const j = (await res.json()) as { steps?: boolean[]; onboardingComplete?: boolean };
      if (j.onboardingComplete !== true) {
        setEligible(false);
        setSteps(null);
        return;
      }
      setEligible(true);
      setSteps(Array.isArray(j.steps) ? j.steps : null);
    } catch {
      setEligible(false);
      setSteps(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void fetchStatus();
    const id = window.setInterval(() => void fetchStatus(), 45000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (dismissed || loading || !eligible || !steps) return null;

  const done = steps.filter(Boolean).length;
  const total = steps.length;
  if (done >= total) return null;

  const progressPct = Math.round((done / total) * 100);

  const progressLabel = L("getting_started_progress", "{done} of {total} steps completed")
    .replace("{done}", String(done))
    .replace("{total}", String(total));

  const items: { done: boolean; label: string; section: MainSection }[] = [
    { done: steps[0] ?? false, label: L("getting_started_step1", ""), section: "settings" },
    { done: steps[1] ?? false, label: L("getting_started_step2", ""), section: "employees" },
    { done: steps[2] ?? false, label: L("getting_started_step3", ""), section: "site" },
    { done: steps[3] ?? false, label: L("getting_started_step4", ""), section: "schedule" },
    { done: steps[4] ?? false, label: L("getting_started_step5", ""), section: "site" },
  ];

  return (
    <section
      className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/30 sm:p-5"
      aria-labelledby="getting-started-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="getting-started-title" className="text-base font-semibold text-amber-950 dark:text-amber-100">
            {L("getting_started_title", "Getting started")}
          </h2>
          <p className="mt-1 text-sm text-amber-900/85 dark:text-amber-200/90">
            {L("getting_started_subtitle", "")}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[44px] shrink-0 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
        >
          {L("getting_started_dismiss", "Dismiss")}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
          <span>{progressLabel}</span>
          <span className="tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200/80 dark:bg-amber-900/50">
          <div
            className="h-full rounded-full bg-[#f97316] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onNavigateAppSection(item.section)}
              className="flex w-full min-h-[44px] items-start gap-3 rounded-lg px-2 py-2 text-left text-sm text-amber-950 hover:bg-amber-100/80 dark:text-amber-100 dark:hover:bg-amber-900/40 sm:items-center"
            >
              <span className="mt-0.5 shrink-0 sm:mt-0" aria-hidden>
                {item.done ? (
                  <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-5 w-5 text-amber-600/70 dark:text-amber-400/80" />
                )}
              </span>
              <span className={item.done ? "text-amber-800/80 line-through dark:text-amber-200/70" : ""}>
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
