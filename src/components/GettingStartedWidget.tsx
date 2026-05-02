"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { MainSection } from "@/types/shared";
import { s } from "@/lib/safeReactString";

const ONBOARDING_COMPLETE_KEY = "machinpro_onboarding_complete";

export interface GettingStartedWidgetProps {
  companyId: string;
  labels: Record<string, string>;
  onNavigateAppSection: (section: MainSection) => void;
  refreshToken?: number;
}

type ApiItem = { id: number; done: boolean; section: MainSection };

export function GettingStartedWidget({
  companyId,
  labels,
  onNavigateAppSection,
  refreshToken = 0,
}: GettingStartedWidgetProps) {
  const L = (k: string, fb: string) => labels[k] ?? fb;
  const [minimized, setMinimized] = useState(false);
  const [items, setItems] = useState<ApiItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [removedAfterComplete, setRemovedAfterComplete] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const celebrationStartedRef = useRef(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true") {
        setRemovedAfterComplete(true);
      }
    } catch {
      /* */
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!supabase || !companyId) {
      setLoading(false);
      setItems(null);
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setLoading(false);
      setItems(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/onboarding/getting-started?companyId=${encodeURIComponent(companyId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setItems(null);
        return;
      }
      const j = (await res.json()) as { items?: ApiItem[] };
      setItems(Array.isArray(j.items) ? j.items : null);
    } catch {
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void fetchStatus();
    const id = window.setInterval(() => void fetchStatus(), 60_000);
    return () => window.clearInterval(id);
  }, [fetchStatus]);

  useEffect(() => {
    if (refreshToken > 0) void fetchStatus();
  }, [refreshToken, fetchStatus]);

  const done = items ? items.filter((x) => x.done).length : 0;
  const total = items?.length ?? 0;
  const allDone = Boolean(items?.length && items.every((x) => x.done));

  /** All steps complete: celebration 3s then hide forever */
  useEffect(() => {
    if (!allDone || removedAfterComplete || celebrationStartedRef.current) return;
    celebrationStartedRef.current = true;
    setCelebrate(true);
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      try {
        localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
      } catch {
        /* */
      }
      setRemovedAfterComplete(true);
      setCelebrate(false);
    }, 3000);
    return () => {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [allDone, removedAfterComplete]);

  if (removedAfterComplete) return null;

  if (loading || !items?.length) return null;

  const progressPct = Math.round((done / total) * 100);
  const progressLabel = `${done} / ${total}`;

  const titleFor = (id: number) => {
    if (id === 6) {
      return L("onboarding_compliance", L(`onboarding_step${id}`, ""));
    }
    return L(`onboarding_step${id}`, "");
  };

  const hintFor = (id: number) => {
    if (id === 6) {
      return L("onboarding_compliance_sub", L(`onboarding_step${id}_sub`, ""));
    }
    return L(`onboarding_step${id}_sub`, "");
  };

  const emojiFor = (id: number) =>
    (
      ({
        1: "🏢",
        2: "👤",
        3: "👥",
        4: "🔐",
        5: "📅",
        6: "📋",
        7: "🏗️",
        8: "🧑‍🤝‍🧑",
        9: "📦",
        10: "⚠️",
      }) as Record<number, string>
    )[id] ?? "•";

  if (celebrate && allDone) {
    return (
      <section
        id="getting-started-widget"
        className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm transition-opacity duration-300 dark:border-emerald-800/60 dark:bg-emerald-950/30 sm:p-5"
        aria-live="polite"
      >
        <p className="break-words text-sm font-semibold text-emerald-800 dark:text-emerald-200">
          {L("onboarding_complete_msg", L("onboarding_complete", "All done!"))}
        </p>
      </section>
    );
  }

  if (minimized) {
    return (
      <section
        id="getting-started-widget"
        className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/30"
      >
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg px-2 text-left"
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-amber-950 dark:text-amber-100">
              {L("onboarding_getting_started_title", "Getting started")}
            </p>
            <p className="text-xs text-amber-900/85 dark:text-amber-200/90">{s(progressLabel)}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        </button>
      </section>
    );
  }

  return (
    <section
      id="getting-started-widget"
      className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/30 sm:p-5"
      aria-labelledby="onboarding-checklist-title"
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 id="onboarding-checklist-title" className="break-words text-base font-semibold text-amber-950 dark:text-amber-100">
            {L("onboarding_getting_started_title", "Getting started")}
          </h2>
          <p className="mt-1 text-sm text-amber-900/85 dark:text-amber-200/90">
            {L("onboarding_getting_started_subtitle", "Complete these steps to get started")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="min-h-[44px] shrink-0 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
        >
          {L("onboarding_dismiss", "Minimize")}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
          <span className="tabular-nums">{s(progressLabel)}</span>
          <span className="tabular-nums">{s(progressPct)}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-200/80 dark:bg-amber-900/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-amber-200/70 bg-white/80 p-3 dark:border-amber-800/40 dark:bg-amber-950/20"
          >
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 shrink-0 text-lg leading-none" aria-hidden>
                  {item.done ? (
                    <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                  ) : (
                    <span>{emojiFor(item.id)}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`break-words text-sm font-medium ${item.done ? "text-amber-800/80 line-through dark:text-amber-200/70" : "text-amber-950 dark:text-amber-100"}`}
                  >
                    {s(titleFor(item.id))}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-amber-900/80 dark:text-amber-200/80">{s(hintFor(item.id))}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateAppSection(item.section)}
                className="min-h-[44px] w-full shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60 sm:w-auto sm:min-w-[5rem]"
              >
                {L("onboarding_go", "Go")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
