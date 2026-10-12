"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatTodayYmdInTimeZone } from "@/lib/dateUtils";

/**
 * Horas del trabajador en su periodo de pago (semanal, quincenal o mensual, según su ficha)
 * y lo acordado con la empresa (tarifa por hora o salario). Solo lee sus propios datos.
 */

type Period = "weekly" | "biweekly" | "monthly";

type ProfilePay = {
  pay_type: string | null;
  pay_amount: number | null;
  pay_period: string | null;
  hourly_rate: number | null;
  pay_currency: string | null;
};

type EntryRow = {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  total_minutes: number | null;
  status: string | null;
};

const L = (d: Record<string, string>, k: string, fb: string) => d[k] ?? fb;

function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayMon0(ymd: string): number {
  const wd = new Date(ymd + "T12:00:00Z").getUTCDay();
  return (wd + 6) % 7;
}

/** Periodo actual. Las quincenas se cuentan desde un lunes fijo para que no cambien cada día. */
export function currentPayPeriod(period: Period, todayYmd: string): { start: string; end: string } {
  if (period === "monthly") {
    const [y, m] = todayYmd.split("-").map(Number) as [number, number];
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { start, end: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
  }
  const monday = addDaysYmd(todayYmd, -weekdayMon0(todayYmd));
  if (period === "weekly") return { start: monday, end: addDaysYmd(monday, 6) };
  const anchor = "2026-01-05";
  const days = Math.round((Date.parse(monday + "T12:00:00Z") - Date.parse(anchor + "T12:00:00Z")) / 86400000);
  const idx = Math.floor(days / 14);
  const start = addDaysYmd(anchor, idx * 14);
  return { start, end: addDaysYmd(start, 13) };
}

function ymdInZone(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(iso)
    );
  } catch {
    return iso.slice(0, 10);
  }
}

function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

export function WorkerHoursCard({
  userAuthId,
  labels: lx,
  timeZone,
  dateLocale,
  fallbackCurrency,
}: {
  userAuthId: string;
  labels: Record<string, string>;
  timeZone: string;
  dateLocale: string;
  fallbackCurrency?: string | null;
}) {
  const [pay, setPay] = useState<ProfilePay | null>(null);
  const [entries, setEntries] = useState<EntryRow[] | null>(null);
  const [tick, setTick] = useState(0);
  const [production, setProduction] = useState<{ units: number; approved: number; pending: number; reports: number } | null>(null);
  const todayYmd = formatTodayYmdInTimeZone(timeZone);

  const period: Period = useMemo(() => {
    const p = String(pay?.pay_period ?? "").toLowerCase();
    if (p === "biweekly" || p === "monthly" || p === "weekly") return p;
    return "weekly";
  }, [pay?.pay_period]);
  const periodKnown = !!pay?.pay_period;
  const range = useMemo(() => currentPayPeriod(period, todayYmd), [period, todayYmd]);

  useEffect(() => {
    let alive = true;
    void supabase
      .from("user_profiles")
      .select("pay_type, pay_amount, pay_period, hourly_rate, pay_currency")
      .eq("id", userAuthId)
      .maybeSingle()
      .then(({ data }: { data: ProfilePay | null }) => {
        if (alive) setPay(data ?? null);
      });
    return () => {
      alive = false;
    };
  }, [userAuthId]);

  useEffect(() => {
    let alive = true;
    // Un día de margen a cada lado por las zonas horarias; se filtra después por fecha local.
    const from = new Date(addDaysYmd(range.start, -1) + "T00:00:00Z").toISOString();
    const to = new Date(addDaysYmd(range.end, 2) + "T00:00:00Z").toISOString();
    void supabase
      .from("time_entries")
      .select("id, clock_in_at, clock_out_at, total_minutes, status")
      .eq("user_id", userAuthId)
      .gte("clock_in_at", from)
      .lt("clock_in_at", to)
      .order("clock_in_at", { ascending: true })
      .then(({ data }: { data: EntryRow[] | null }) => {
        if (alive) setEntries(data ?? []);
      });
    return () => {
      alive = false;
    };
  }, [userAuthId, range.start, range.end, tick]);

  // Pago por producción: lo producido en el periodo (aprobado y pendiente de aprobar)
  useEffect(() => {
    if (String(pay?.pay_type ?? "").toLowerCase() !== "production") {
      setProduction(null);
      return;
    }
    let alive = true;
    void supabase
      .from("production_reports")
      .select("total_units, total_cost, status, deleted_at")
      .eq("employee_id", userAuthId)
      .gte("report_date", range.start)
      .lte("report_date", range.end)
      .then(({ data }: { data: { total_units: number | null; total_cost: number | null; status: string | null; deleted_at: string | null }[] | null }) => {
        if (!alive) return;
        let units = 0;
        let approved = 0;
        let pending = 0;
        let reports = 0;
        for (const r of data ?? []) {
          if (r.deleted_at) continue;
          reports += 1;
          units += Number(r.total_units ?? 0);
          const amount = Number(r.total_cost ?? 0);
          if (String(r.status ?? "").toLowerCase() === "approved") approved += amount;
          else pending += amount;
        }
        setProduction({ units, approved, pending, reports });
      });
    return () => {
      alive = false;
    };
  }, [pay?.pay_type, userAuthId, range.start, range.end]);

  // Refresco cada minuto mientras haya un fichaje abierto hoy
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { totalMins, byDay } = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const e of entries ?? []) {
      const day = ymdInZone(e.clock_in_at, timeZone);
      if (day < range.start || day > range.end) continue;
      let mins = 0;
      if (e.clock_out_at) {
        mins =
          e.total_minutes != null
            ? Number(e.total_minutes)
            : Math.max(0, (Date.parse(e.clock_out_at) - Date.parse(e.clock_in_at)) / 60000);
      } else if (day === todayYmd) {
        mins = Math.max(0, (Date.now() - Date.parse(e.clock_in_at)) / 60000);
      } else {
        continue; // fichaje sin cerrar de otro día: no se cuenta hasta que lo corrijan
      }
      total += mins;
      map.set(day, (map.get(day) ?? 0) + mins);
    }
    return { totalMins: total, byDay: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
  }, [entries, range.start, range.end, todayYmd, timeZone]);

  const currency = pay?.pay_currency || fallbackCurrency || "CAD";
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(dateLocale, { style: "currency", currency }).format(n);
    } catch {
      return `${n.toFixed(2)} ${currency}`;
    }
  };
  const fmtDay = (ymd: string) => {
    try {
      return new Intl.DateTimeFormat(dateLocale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
        new Date(ymd + "T12:00:00Z")
      );
    } catch {
      return ymd;
    }
  };

  const payType = String(pay?.pay_type ?? "").toLowerCase();
  const rate =
    payType === "hourly"
      ? Number(pay?.hourly_rate ?? 0) > 0
        ? Number(pay?.hourly_rate)
        : Number(pay?.pay_amount ?? 0) > 0
          ? Number(pay?.pay_amount)
          : null
      : null;
  const periodLabel =
    period === "monthly"
      ? L(lx, "payroll_period_monthly", "Monthly")
      : period === "biweekly"
        ? L(lx, "payroll_period_biweekly", "Biweekly")
        : L(lx, "payroll_period_weekly", "Weekly");

  if (payType === "fixed" || payType === "salary") return null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 sm:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
          {payType === "production" ? L(lx, "worker_production_title", "My production") : L(lx, "worker_hours_title", "My hours")}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {periodLabel} · {fmtDay(range.start)} – {fmtDay(range.end)}
        </p>
      </div>

      {entries == null ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">…</p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{fmtHours(totalMins)}</p>
          {rate != null ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {L(lx, "worker_hours_rate", "Agreed rate: {rate}/h").replace("{rate}", money(rate))} ·{" "}
              <span className="font-semibold">
                {L(lx, "worker_hours_estimate", "Estimated: {amount}").replace(
                  "{amount}",
                  money(Math.round((totalMins / 60) * rate * 100) / 100)
                )}
              </span>
            </p>
          ) : payType === "fixed" || payType === "salary" ? (
            Number(pay?.pay_amount ?? 0) > 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {L(lx, "worker_hours_salary", "Agreed salary: {amount}").replace("{amount}", money(Number(pay?.pay_amount)))}
              </p>
            ) : null
          ) : payType === "production" ? (
            <div className="mt-1 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
              {production ? (
                <>
                  <p>
                    {L(lx, "worker_production_units", "Production this period: {units} units").replace(
                      "{units}",
                      String(Math.round(production.units * 100) / 100)
                    )}
                  </p>
                  <p className="font-semibold">
                    {L(lx, "worker_production_approved", "Approved: {amount}").replace("{amount}", money(production.approved))}
                    {production.pending > 0
                      ? ` · ${L(lx, "worker_production_pending", "Pending approval: {amount}").replace("{amount}", money(production.pending))}`
                      : ""}
                  </p>
                </>
              ) : null}
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {L(lx, "worker_hours_production", "You are paid by production; hours are for reference.")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {L(lx, "worker_hours_no_rate", "Your company hasn't set your pay in the app yet.")}
            </p>
          )}
          {!periodKnown ? (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {L(lx, "worker_hours_period_unset", "Your pay period isn't set; showing this week.")}
            </p>
          ) : null}
          {byDay.length > 0 ? (
            <ul className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-slate-800">
              {byDay.map(([day, mins]) => (
                <li key={day} className="flex justify-between gap-2 py-1.5">
                  <span className="capitalize text-zinc-600 dark:text-zinc-400">{fmtDay(day)}</span>
                  <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{fmtHours(mins)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {L(lx, "worker_hours_none", "No hours recorded in this period yet.")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
