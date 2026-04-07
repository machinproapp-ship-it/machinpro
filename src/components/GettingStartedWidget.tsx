"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Circle, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { MainSection } from "@/types/shared";

const ONBOARDING_COMPLETE_KEY = "machinpro_onboarding_complete";

export interface GettingStartedWidgetProps {
  companyId: string;
  labels: Record<string, string>;
  onNavigateAppSection: (section: MainSection) => void;
}

export function GettingStartedWidget({ companyId, labels, onNavigateAppSection }: GettingStartedWidgetProps) {
  const L = (k: string, fb: string) => labels[k] ?? fb;
  const [minimized, setMinimized] = useState(false);
  const [steps, setSteps] = useState<boolean[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [justCompleted, setJustCompleted] = useState(false);
  const completionMarkedRef = useRef(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
      if (v === "1" || v === "true") {
        completionMarkedRef.current = true;
      }
    } catch {
      completionMarkedRef.current = false;
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!supabase || !companyId) {
      setLoading(false);
      setSteps(null);
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setLoading(false);
      setSteps(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/onboarding/getting-started?companyId=${encodeURIComponent(companyId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setSteps(null);
        return;
      }
      const j = (await res.json()) as { steps?: boolean[] };
      setSteps(Array.isArray(j.steps) ? j.steps : null);
    } catch {
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

  const completeOnboarding = useCallback(() => {
    if (completionMarkedRef.current) return;
    completionMarkedRef.current = true;
    try {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    } catch {
      /* ignore */
    }
    setJustCompleted(true);
    window.setTimeout(() => setJustCompleted(false), 3800);
  }, []);

  if (loading || !steps) return null;
  const done = steps.filter(Boolean).length;
  const total = steps.length;
  if (done >= total) {
    if (!completionMarkedRef.current) {
      completeOnboarding();
      return (
        <section
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/30 sm:p-5"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            {L("onboarding_complete", "Everything is ready! Your company is set up.")}
          </p>
        </section>
      );
    }
    if (justCompleted) {
      return (
        <section
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/30 sm:p-5"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            {L("onboarding_complete", "Everything is ready! Your company is set up.")}
          </p>
        </section>
      );
    }
    return null;
  }
  if (completionMarkedRef.current) return null;

  const progressPct = Math.round((done / total) * 100);
  const progressLabel = `${done} / ${total}`;

  const items: { done: boolean; title: string; hint: string; section: MainSection }[] = [
    {
      done: steps[0] ?? false,
      title: L("onboarding_step_company", "Complete your company profile"),
      hint: `${L("settings", "Settings")} -> ${L("settings_company", "Company")}`,
      section: "settings",
    },
    {
      done: steps[1] ?? false,
      title: L("onboarding_step_employee", "Add your first employee"),
      hint: `${L("office", "Central")} -> ${L("employees_title", "Employees")}`,
      section: "employees",
    },
    {
      done: steps[2] ?? false,
      title: L("onboarding_step_project", "Create your first project"),
      hint: `${L("office", "Central")} -> ${L("projects", "Projects")}`,
      section: "office",
    },
    {
      done: steps[3] ?? false,
      title: L("onboarding_step_roles", "Set your team roles"),
      hint: `${L("office", "Central")} -> ${L("roles", "Roles")}`,
      section: "office",
    },
    {
      done: steps[4] ?? false,
      title: L("onboarding_step_clock", "Register your first clock-in"),
      hint: `${L("schedule", "Schedule")} -> ${L("clockIn", "Clock-in")}`,
      section: "schedule",
    },
  ];

  if (minimized) {
    return (
      <section className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/30">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg px-2 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{L("onboarding_title", "Set up your MachinPro")}</p>
            <p className="text-xs text-amber-900/85 dark:text-amber-200/90">{progressLabel}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
        </button>
      </section>
    );
  }

  return (
    <section
      className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/30 sm:p-5"
      aria-labelledby="onboarding-checklist-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="onboarding-checklist-title" className="text-base font-semibold text-amber-950 dark:text-amber-100">
            {L("onboarding_title", "Set up your MachinPro")}
          </h2>
          <p className="mt-1 text-sm text-amber-900/85 dark:text-amber-200/90">
            {L("onboarding_subtitle", "Complete these steps to get started")}
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
          <li key={i} className="rounded-lg border border-amber-200/70 bg-white/80 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
            <div className="flex items-start gap-3 sm:items-center">
              <span className="mt-0.5 shrink-0 sm:mt-0" aria-hidden>
                {item.done ? (
                  <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-5 w-5 text-amber-600/70 dark:text-amber-400/80" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${item.done ? "text-amber-800/80 line-through dark:text-amber-200/70" : "text-amber-950 dark:text-amber-100"}`}>
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">{item.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateAppSection(item.section)}
                className="min-h-[44px] shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
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
