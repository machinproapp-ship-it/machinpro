"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { VacationRequestRow } from "@/types/homePage";
import type { ClockEntry } from "@/components/OperationsModule";
import {
  dateLocaleForUser,
  formatDateMedium,
  formatTime,
  resolveUserTimezone,
} from "@/lib/dateUtils";

function useLazyVisible(rootMargin = "80px") {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);
  return { ref, visible };
}

function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-zinc-200 dark:bg-slate-600" />
      ))}
    </div>
  );
}

function hoursBetweenDay(clockIn: string, clockOut?: string): number | null {
  if (!clockOut) return null;
  try {
    const a = new Date(clockIn).getTime();
    const b = new Date(clockOut).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.max(0, (b - a) / 3_600_000);
  } catch {
    return null;
  }
}

type Labels = Record<string, string>;

export function EmployeeDetailClockSection(props: {
  employeeId: string;
  labels: Labels;
  clockEntries: ClockEntry[];
  language: string;
  countryCode: string;
  timeZone: string;
}) {
  const { employeeId, labels: tl, clockEntries, language, countryCode, timeZone } = props;
  const L = (k: string, fb?: string) => tl[k] ?? fb ?? "";
  const { ref, visible } = useLazyVisible();
  const tz = timeZone ?? resolveUserTimezone(null);
  const dateLoc = dateLocaleForUser(language, countryCode);

  const rows = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffYmd = cutoff.toISOString().slice(0, 10);
    return clockEntries
      .filter((c) => c.employeeId === employeeId && (c.date ?? "").slice(0, 10) >= cutoffYmd)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [clockEntries, employeeId]);

  const visibleRows = rows.slice(0, 10);
  const monthPrefix = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const monthHours = useMemo(() => {
    let h = 0;
    for (const c of rows) {
      if (!(c.date ?? "").startsWith(monthPrefix)) continue;
      const hrs = hoursBetweenDay(c.clockIn, c.clockOut);
      if (hrs != null) h += hrs;
    }
    return Math.round(h * 10) / 10;
  }, [rows, monthPrefix]);

  return (
    <section ref={ref} className="scroll-mt-4 border-t border-zinc-100 pt-5 dark:border-slate-800">
      <h5 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {L("employee_detail_clocks", "Clock entries")}
      </h5>
      {!visible ? (
        <SkeletonBlock />
      ) : rows.length === 0 ? (
        <p className="text-sm italic text-zinc-400 dark:text-zinc-500">{L("dashboard_trend_neutral", "—")}</p>
      ) : (
        <>
          <div className="mb-3 rounded-xl bg-zinc-50 px-4 py-3 dark:bg-slate-800/50">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{L("timesheet_total_month", "Month total")}</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {monthHours}
              <span className="text-sm font-medium text-zinc-500"> h</span>
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-slate-800 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">{L("timesheet_date_from", "Date")}</th>
                  <th className="px-3 py-2 font-medium">{L("audit_action_clock_in", "In")}</th>
                  <th className="px-3 py-2 font-medium">{L("audit_action_clock_out", "Out")}</th>
                  <th className="px-3 py-2 font-medium">{L("timesheet_hours", "Hours")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
                {visibleRows.map((c) => {
                  const hrs = hoursBetweenDay(c.clockIn, c.clockOut);
                  const dStr = (c.date ?? "").slice(0, 10);
                  return (
                    <tr key={c.id ?? `${c.date}-${c.clockIn}`} className="text-zinc-800 dark:text-zinc-200">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {dStr ? formatDateMedium(new Date(dStr + "T12:00:00"), dateLoc, tz) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatTime(c.clockIn, dateLoc, tz)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {c.clockOut ? formatTime(c.clockOut, dateLoc, tz) : "—"}
                      </td>
                      <td className="px-3 py-2">{hrs != null ? `${Math.round(hrs * 10) / 10}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > 10 ? (
            <p className="mt-2 text-xs text-zinc-500">{L("notifications_view_all", "See all")}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function EmployeeDetailTimesheetSection(props: {
  labels: Labels;
  clockEntries: ClockEntry[];
  employeeId: string;
}) {
  const { labels: tl, clockEntries, employeeId } = props;
  const L = (k: string, fb?: string) => tl[k] ?? fb ?? "";
  const { ref, visible } = useLazyVisible();

  const weeks = useMemo(() => {
    const byWeek = new Map<string, number>();
    for (const c of clockEntries) {
      if (c.employeeId !== employeeId) continue;
      const d = (c.date ?? "").slice(0, 10);
      if (!d) continue;
      const wk = isoWeekKey(d);
      const hrs = hoursBetweenDay(c.clockIn, c.clockOut);
      if (hrs == null) continue;
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + hrs);
    }
    return [...byWeek.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 5)
      .map(([wk, hours]) => ({ wk, hours: Math.round(hours * 10) / 10 }));
  }, [clockEntries, employeeId]);

  return (
    <section ref={ref} className="scroll-mt-4 border-t border-zinc-100 pt-5 dark:border-slate-800">
      <h5 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {L("employee_detail_timesheets", "Timesheets")}
      </h5>
      {!visible ? (
        <SkeletonBlock lines={4} />
      ) : weeks.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{L("schedule_no_sheets", "No timesheets")}</p>
      ) : (
        <ul className="space-y-2">
          {weeks.map((w) => (
            <li
              key={w.wk}
              className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-slate-700"
            >
              <span className="text-sm text-zinc-700 dark:text-zinc-200">{w.wk}</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                {w.hours} h · {L("timesheet_submitted", "Submitted")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function isoWeekKey(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setHours(12, 0, 0, 0);
  const oneJan = new Date(dt.getFullYear(), 0, 1);
  const dayOff = (oneJan.getDay() + 6) % 7;
  const week1 = new Date(dt.getFullYear(), 0, 1 - dayOff);
  const n = Math.ceil(((dt.getTime() - week1.getTime()) / 86_400_000 + 1) / 7);
  return `${dt.getFullYear()}-W${String(n).padStart(2, "0")}`;
}

export function EmployeeDetailVacationSection(props: {
  companyId?: string | null;
  employeeUserId: string | null;
  labels: Labels;
  vacationRequests: VacationRequestRow[];
  vacationAllowance?: number;
}) {
  const { companyId, employeeUserId, labels: tl, vacationRequests, vacationAllowance = 0 } = props;
  const L = (k: string, fb?: string) => tl[k] ?? fb ?? "";
  const { ref, visible } = useLazyVisible();
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [remote, setRemote] = useState<VacationRequestRow[] | null>(null);

  useEffect(() => {
    if (!visible || !employeeUserId || !supabase) return;
    let cancelled = false;
    void (async () => {
      try {
        let rq = supabase
          .from("vacation_requests")
          .select("*")
          .eq("user_id", employeeUserId)
          .order("start_date", { ascending: false })
          .limit(40);
        if (companyId) rq = rq.eq("company_id", companyId);
        const { data, error } = await rq;
        if (cancelled) return;
        if (error) {
          setLoadErr(error.message);
          setRemote([]);
          return;
        }
        setRemote((data ?? []) as VacationRequestRow[]);
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e instanceof Error ? e.message : String(e));
          setRemote([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, employeeUserId, companyId]);

  const merged = useMemo(() => {
    const list =
      remote !== null ? remote : employeeUserId ? vacationRequests.filter((v) => v.user_id === employeeUserId) : [];
    return [...list].sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
  }, [remote, vacationRequests, employeeUserId]);

  const yearPrefix = new Date().getFullYear().toString();
  const usedThisYear = useMemo(() => {
    let days = 0;
    for (const v of merged) {
      if (v.status !== "approved") continue;
      if (!(v.start_date ?? "").startsWith(yearPrefix)) continue;
      days += Math.max(0, v.total_days ?? 0);
    }
    return days;
  }, [merged, yearPrefix]);

  const recent3 = merged.slice(0, 3);

  return (
    <section ref={ref} className="scroll-mt-4 border-t border-zinc-100 pt-5 dark:border-slate-800">
      <h5 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {L("employee_detail_vacations", "Vacations")}
      </h5>
      {!visible ? (
        <SkeletonBlock />
      ) : (
        <>
          <div className="mb-3 rounded-xl bg-zinc-50 px-4 py-3 dark:bg-slate-800/50">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{L("vacations_days_remaining", "Days remaining")}</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {Math.max(0, vacationAllowance - usedThisYear)} / {vacationAllowance}{" "}
              <span className="text-sm font-normal text-zinc-500">
                ({L("vacations_days_used", "Used")}: {usedThisYear})
              </span>
            </p>
          </div>
          {loadErr ? <p className="text-xs text-amber-600 dark:text-amber-400">{loadErr}</p> : null}
          <ul className="space-y-2">
            {recent3.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2 dark:border-slate-700"
              >
                <span className="text-xs text-zinc-600 dark:text-zinc-300">
                  {v.start_date} – {v.end_date}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    v.status === "approved"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : v.status === "rejected"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  }`}
                >
                  {v.status === "approved"
                    ? L("vacations_approved", "Approved")
                    : v.status === "rejected"
                      ? L("vacations_rejected", "Rejected")
                      : L("vacations_pending", "Pending")}
                </span>
              </li>
            ))}
          </ul>
          {!employeeUserId ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">{L("employee_detail_no_login", "No linked user account")}</p>
          ) : recent3.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">{L("employee_detail_no_vacation_requests", "—")}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function EmployeeDetailSwpSection(props: {
  companyId: string | null;
  employeeUserId: string | null;
  labels: Labels;
  onOpenSecuritySwp?: () => void;
}) {
  const { companyId, employeeUserId, labels: tl, onOpenSecuritySwp } = props;
  const L = (k: string, fb?: string) => tl[k] ?? fb ?? "";
  const { ref, visible } = useLazyVisible();
  const [loading, setLoading] = useState(false);
  const [signedTitles, setSignedTitles] = useState<string[]>([]);
  const [pendingTitles, setPendingTitles] = useState<string[]>([]);

  useEffect(() => {
    if (!visible || !companyId || !employeeUserId || !supabase) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data: swps, error: e1 } = await supabase
          .from("safe_work_procedures")
          .select("id, title")
          .eq("company_id", companyId)
          .is("deleted_at", null);
        const { data: sigs, error: e2 } = await supabase
          .from("swp_signatures")
          .select("swp_id")
          .eq("company_id", companyId)
          .eq("user_id", employeeUserId);
        if (cancelled) return;
        if (e1 || e2) {
          setSignedTitles([]);
          setPendingTitles([]);
          return;
        }
        const signedIds = new Set((sigs ?? []).map((s: { swp_id: string }) => s.swp_id));
        const titles = (swps ?? []) as { id: string; title: string }[];
        const signed = titles.filter((w) => signedIds.has(w.id)).map((w) => w.title);
        const pending = titles.filter((w) => !signedIds.has(w.id)).map((w) => w.title);
        setSignedTitles(signed);
        setPendingTitles(pending);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, companyId, employeeUserId]);

  return (
    <section ref={ref} className="scroll-mt-4 border-t border-zinc-100 pt-5 dark:border-slate-800">
      <h5 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {L("employee_detail_swps", "Signed procedures")}
      </h5>
      {!visible ? (
        <SkeletonBlock />
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="sr-only">…</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">{L("swp_signed", "Signed")}</p>
            {signedTitles.length === 0 ? (
              <p className="text-sm text-zinc-400">{L("swp_not_signed", "—")}</p>
            ) : (
              <ul className="list-inside list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                {signedTitles.map((title, i) => (
                  <li key={`${title}-${i}`}>{title}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">{L("swp_pending", "Pending signature")}</p>
            {pendingTitles.length === 0 ? (
              <p className="text-sm text-zinc-400">—</p>
            ) : (
              <ul className="space-y-2">
                {pendingTitles.map((title, i) => (
                  <li
                    key={`${title}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-slate-600"
                  >
                    <span className="text-sm">{title}</span>
                    <button
                      type="button"
                      onClick={() => onOpenSecuritySwp?.()}
                      className="min-h-[44px] shrink-0 rounded-lg bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-500"
                    >
                      {L("swp_sign", "Sign")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
