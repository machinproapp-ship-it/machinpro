"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScheduleEntry } from "@/types/homePage";
import type { FormInstance, FormTemplate } from "@/types/forms";
import type { ProjectTask } from "@/types/projectTask";
import type { MainSection } from "@/types/shared";
import { formatTimeHm, formatTodayYmdInTimeZone } from "@/lib/dateUtils";
import { WorkerHoursCard } from "@/components/WorkerHoursCard";
import {
  elapsedMinutesSinceClockStart,
  formatCompletedWorkFromHmPair,
  formatWorkDurationCompact,
  trafficLightClassFromElapsedHours,
} from "@/lib/clockDisplay";

const L = (d: Record<string, string>, k: string, fb: string) => d[k] ?? fb;

export type WorkerHubProps = {
  variant: "schedule" | "forms";
  labels: Record<string, string>;
  dateLocale: string;
  timeZone: string;
  profileId?: string | null;
  legacyEmployeeId?: string | null;
  userAuthId?: string | null;
  scheduleEntries: ScheduleEntry[];
  projects: { id: string; name: string }[];
  clockEntries: Array<{
    id: string;
    employeeId: string;
    date: string;
    clockIn: string;
    clockOut?: string;
    projectId?: string;
    clockInAtIso?: string;
    clockOutAtIso?: string | null;
  }>;
  formInstances: FormInstance[];
  formTemplates: FormTemplate[];
  projectTasks: ProjectTask[];
  canViewSchedule: boolean;
  canFillForms: boolean;
  canReportProduction: boolean;
  onNavigate: (section: MainSection) => void;
  onOpenFormInstance: (instanceId: string) => void;
  /** Abre el detalle del turno (obra, dirección, compañeros y fichaje). */
  onOpenShift?: (date: string, entryId: string) => void;
  /** Ficha la salida del fichaje abierto de hoy. */
  onClockOut?: () => void;
  /** Muestra el acceso a las inspecciones de equipos. */
  canInspect?: boolean;
  onOpenInspections?: () => void;
  /** Moneda de la empresa si el trabajador no tiene una propia en su ficha. */
  companyCurrency?: string | null;
  /** Cómo cobra el trabajador: con salario fijo no se ficha ni se cuentan horas. */
  payType?: "fixed" | "hourly" | "production" | null;
  /** Equipos pendientes de inspeccionar en mis obras. */
  inspectionsDueCount?: number;
  /** Tiene el módulo Operaciones (si no, no se le ofrece ir allí). */
  canOpenSite?: boolean;
};

/** Suma días a una fecha YYYY-MM-DD sin depender de la zona horaria del navegador. */
function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Lunes de la semana de esa fecha. */
function mondayOfYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = domingo
  return addDaysYmd(ymd, dow === 0 ? -6 : 1 - dow);
}

function matchesEmployee(
  ids: string[],
  profileId?: string | null,
  legacyId?: string | null
): boolean {
  if (!ids.length) return false;
  const set = new Set(ids.map(String));
  if (profileId && set.has(profileId)) return true;
  if (legacyId && set.has(legacyId)) return true;
  return false;
}

export function WorkerHub({
  variant,
  labels: lx,
  dateLocale,
  timeZone,
  profileId,
  legacyEmployeeId,
  userAuthId,
  scheduleEntries,
  projects,
  clockEntries,
  formInstances,
  formTemplates,
  projectTasks,
  canViewSchedule,
  canFillForms,
  canReportProduction,
  onNavigate,
  onOpenFormInstance,
  onOpenShift,
  onClockOut,
  canInspect,
  onOpenInspections,
  companyCurrency,
  payType,
  canOpenSite = false,
  inspectionsDueCount = 0,
}: WorkerHubProps) {
  const tracksTime = payType !== "fixed";
  const todayYmd = formatTodayYmdInTimeZone(timeZone);
  const [clockTick, setClockTick] = useState(0);
  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekDays = useMemo(() => {
    const monday = addDaysYmd(mondayOfYmd(todayYmd), weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
  }, [todayYmd, weekOffset]);

  const myEntriesByDay = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    if (!canViewSchedule) return map;
    const days = new Set(weekDays);
    for (const e of scheduleEntries) {
      if (!days.has(e.date)) continue;
      if (!matchesEmployee(e.employeeIds ?? [], profileId, legacyEmployeeId)) continue;
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    return map;
  }, [scheduleEntries, weekDays, canViewSchedule, profileId, legacyEmployeeId]);

  const dayFmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(dateLocale, { weekday: "short", day: "numeric", timeZone: "UTC" });
    } catch {
      return new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", timeZone: "UTC" });
    }
  }, [dateLocale]);
  const rangeFmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short", timeZone: "UTC" });
    } catch {
      return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
    }
  }, [dateLocale]);
  const ymdToUtcDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

  const todayShifts = useMemo(() => {
    if (!canViewSchedule) return [];
    return scheduleEntries.filter(
      (e) =>
        e.date === todayYmd &&
        e.type === "shift" &&
        matchesEmployee(e.employeeIds ?? [], profileId, legacyEmployeeId)
    );
  }, [scheduleEntries, todayYmd, canViewSchedule, profileId, legacyEmployeeId]);

  const todayClock = useMemo(() => {
    return clockEntries.find(
      (c) =>
        c.date === todayYmd &&
        (c.employeeId === profileId || (!!legacyEmployeeId && c.employeeId === legacyEmployeeId))
    );
  }, [clockEntries, todayYmd, profileId, legacyEmployeeId]);

  /** Fichaje que se quedó abierto otro día (no se fichó la salida). */
  const staleOpenClock = useMemo(() => {
    return clockEntries
      .filter(
        (c) =>
          !c.clockOut &&
          c.date < todayYmd &&
          (c.employeeId === profileId || (!!legacyEmployeeId && c.employeeId === legacyEmployeeId))
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [clockEntries, todayYmd, profileId, legacyEmployeeId]);

  useEffect(() => {
    const active =
      !!todayClock?.clockIn &&
      !todayClock.clockOut &&
      todayClock.date === todayYmd;
    if (!active) return;
    setClockTick((n) => n + 1);
    const id = window.setInterval(() => setClockTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [todayClock, todayYmd]);

  const liveWorking = useMemo(() => {
    void clockTick;
    if (!todayClock?.clockIn || todayClock.clockOut) return null;
    const mins = elapsedMinutesSinceClockStart({
      dateYmd: todayClock.date,
      clockInHm: todayClock.clockIn,
      clockInAtIso: todayClock.clockInAtIso,
    });
    const hours = mins / 60;
    const dur = formatWorkDurationCompact(mins, lx as Record<string, string>);
    const cls = trafficLightClassFromElapsedHours(hours);
    const line =
      (lx.clock_working_for as string | undefined)?.replace(/\{time\}/g, dur) ?? `Working for ${dur}`;
    return { dur, cls, line };
  }, [todayClock, clockTick, lx]);

  const pendingForms = useMemo(() => {
    if (!canFillForms || !userAuthId) return [];
    const tplName = (id: string) => formTemplates.find((t) => t.id === id)?.name ?? id;
    return formInstances.filter(
      (i) =>
        i.createdBy === userAuthId && (i.status === "draft" || i.status === "in_progress")
    ).map((i) => ({ id: i.id, title: tplName(i.templateId), projectId: i.projectId }));
  }, [formInstances, formTemplates, canFillForms, userAuthId]);

  const myProductionTasks = useMemo(() => {
    if (!canReportProduction) return [];
    return projectTasks.filter(
      (t) =>
        (t.status === "pending" || t.status === "in_progress") &&
        (t.assignedToEmployeeId === profileId ||
          (!!legacyEmployeeId && t.assignedToEmployeeId === legacyEmployeeId))
    );
  }, [projectTasks, canReportProduction, profileId, legacyEmployeeId]);

  if (variant === "forms" && !canViewSchedule) {
    return (
      <div className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          {L(lx, "my_forms", L(lx, "worker_view_my_forms", "Mis formularios"))}
        </h2>
        {pendingForms.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {L(lx, "forms_empty", L(lx, "no_entries", L(lx, "noEntries", "Sin entradas")))}
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingForms.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="flex min-h-[44px] w-full flex-col items-start rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-100 dark:hover:bg-slate-700"
                  onClick={() => onOpenFormInstance(f.id)}
                >
                  <span>{f.title}</span>
                  {f.projectId ? (
                    <span className="mt-0.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      {projectNameById.get(f.projectId) ?? f.projectId}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2">
      {canViewSchedule ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 sm:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                {weekOffset === 0
                  ? L(lx, "worker_week_title", "Mi semana")
                  : `${rangeFmt.format(ymdToUtcDate(weekDays[0]!))} – ${rangeFmt.format(ymdToUtcDate(weekDays[6]!))}`}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {L(lx, "worker_week_hint", "Toca un día para ver la obra y lo que tienes que hacer.")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setWeekOffset((n) => n - 1)}
                aria-label={L(lx, "worker_week_prev", "Semana anterior")}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:text-zinc-200 dark:hover:bg-slate-800"
              >
                ←
              </button>
              {weekOffset !== 0 ? (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="h-11 rounded-lg border border-amber-500 px-3 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                >
                  {L(lx, "today", "Hoy")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setWeekOffset((n) => n + 1)}
                aria-label={L(lx, "worker_week_next", "Semana siguiente")}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:text-zinc-200 dark:hover:bg-slate-800"
              >
                →
              </button>
            </div>
          </div>
          <ul className="space-y-1.5">
            {weekDays.map((ymd) => {
              const entries = myEntriesByDay.get(ymd) ?? [];
              const shifts = entries.filter((e) => e.type === "shift");
              const other = entries.find((e) => e.type !== "shift");
              const isToday = ymd === todayYmd;
              const isPast = ymd < todayYmd;
              const first = shifts[0];
              const dayLabel = dayFmt.format(ymdToUtcDate(ymd));
              const base = `flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm ${
                isToday
                  ? "border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/30"
                  : "border-zinc-200 bg-zinc-50/60 dark:border-slate-700 dark:bg-slate-800/40"
              } ${isPast && !isToday ? "opacity-70" : ""}`;
              const dayCol = (
                <span
                  className={`w-16 shrink-0 text-xs font-semibold uppercase ${
                    isToday ? "text-amber-700 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {isToday ? L(lx, "today", "Hoy") : dayLabel}
                </span>
              );
              if (!first) {
                return (
                  <li key={ymd}>
                    <div className={base}>
                      {dayCol}
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {other
                          ? other.type === "vacation"
                            ? L(lx, "schedule_type_vacation", "Vacaciones")
                            : other.eventLabel || other.notes || L(lx, "schedule_type_event", "Evento")
                          : L(lx, "worker_day_off", "Libre")}
                      </span>
                    </div>
                  </li>
                );
              }
              return (
                <li key={ymd}>
                  <button
                    type="button"
                    disabled={!onOpenShift}
                    onClick={() => onOpenShift?.(ymd, first.id)}
                    className={`${base} hover:border-amber-400 disabled:cursor-default`}
                  >
                    {dayCol}
                    <span className="min-w-0 flex-1">
                      {shifts.map((sh) => (
                        <span key={sh.id} className="block">
                          <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {sh.projectId ? projectNameById.get(sh.projectId) ?? sh.projectCode ?? "—" : sh.projectCode ?? "—"}
                          </span>
                          <span className="block text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                            {formatTimeHm(sh.startTime, dateLocale, timeZone)} → {formatTimeHm(sh.endTime, dateLocale, timeZone)}
                          </span>
                        </span>
                      ))}
                    </span>
                    {onOpenShift ? (
                      <span className="shrink-0 text-amber-700 dark:text-amber-400" aria-hidden>
                        →
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {canViewSchedule && tracksTime ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
          <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-white">
            {L(lx, "my_clockin", L(lx, "worker_view_my_clock", "Mi fichaje"))}
          </h2>
          {staleOpenClock ? (
            <p className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {L(
                lx,
                "clock_stale_open_notice",
                "Your clock-in from {date} was never closed. Ask your manager to correct it."
              ).replace(/\{date\}/g, staleOpenClock.date)}
            </p>
          ) : null}
          {!todayClock ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {L(lx, "clock_none_today", "You haven't clocked in today.")}
              </p>
              {todayShifts.length > 0 && onOpenShift ? (
                <button
                  type="button"
                  onClick={() => onOpenShift(todayShifts[0]!.date, todayShifts[0]!.id)}
                  className="min-h-[44px] w-full rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  {L(lx, "clockIn", "Clock in")}
                </button>
              ) : null}
            </div>
          ) : (
            <dl className="space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 dark:text-zinc-400">{L(lx, "clockInEntry", "Entrada")}</dt>
                <dd className="tabular-nums font-medium">{todayClock.clockIn}</dd>
              </div>
              {liveWorking ? (
                <p className={`text-sm font-medium ${liveWorking.cls}`}>{liveWorking.line}</p>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 dark:text-zinc-400">{L(lx, "clockOutEntry", "Salida")}</dt>
                <dd className="tabular-nums font-medium">{todayClock.clockOut ?? "—"}</dd>
              </div>
              {!todayClock.clockOut && onClockOut ? (
                <button
                  type="button"
                  onClick={onClockOut}
                  className="mt-2 min-h-[44px] w-full rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500"
                >
                  {L(lx, "clockOut", "Clock out")}
                </button>
              ) : null}
              {todayClock.clockOut ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {(lx.clock_total_worked as string | undefined)?.replace(
                    /\{time\}/g,
                    formatCompletedWorkFromHmPair(
                      todayClock.clockIn,
                      todayClock.clockOut,
                      lx as Record<string, string>
                    )
                  ) ??
                    `Total: ${formatCompletedWorkFromHmPair(
                      todayClock.clockIn,
                      todayClock.clockOut,
                      lx as Record<string, string>
                    )}`}
                </p>
              ) : null}
            </dl>
          )}
        </section>
      ) : null}

      {canViewSchedule && tracksTime && userAuthId ? (
        <WorkerHoursCard
          userAuthId={userAuthId}
          labels={lx}
          timeZone={timeZone}
          dateLocale={dateLocale}
          fallbackCurrency={companyCurrency}
        />
      ) : null}

      {canInspect && onOpenInspections ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                {L(lx, "worker_inspections_title", "Inspect before use")}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {inspectionsDueCount > 0
                  ? L(lx, "worker_inspections_due", "{n} pending in your sites").replace(/\{n\}/g, String(inspectionsDueCount))
                  : L(lx, "worker_inspections_hint", "Harness, tools, vehicles… check them before you start.")}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenInspections}
              className="min-h-[44px] rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-500"
            >
              {L(lx, "inspect", "Inspect")}
            </button>
          </div>
        </section>
      ) : null}

      {canFillForms && pendingForms.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 sm:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              {L(lx, "my_forms", L(lx, "worker_view_my_forms", "Mis formularios"))}
            </h2>
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-slate-800"
              onClick={() => onNavigate("forms")}
            >
              {L(lx, "forms", "Formularios")}
            </button>
          </div>
          {pendingForms.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {L(lx, "forms_empty", L(lx, "no_entries", L(lx, "noEntries", "Sin formularios pendientes")))}
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {pendingForms.slice(0, 6).map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="flex min-h-[44px] w-full flex-col items-start rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-100 dark:hover:bg-slate-700"
                    onClick={() => onOpenFormInstance(f.id)}
                  >
                    {f.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {canReportProduction ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 sm:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              {L(lx, "worker_view_my_production", "Mi producción")}
            </h2>
            {canOpenSite ? (
              <button
                type="button"
                className="min-h-[44px] rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-slate-800"
                onClick={() => onNavigate("site")}
              >
                {L(lx, "site", "Operaciones")}
              </button>
            ) : null}
          </div>
          {myProductionTasks.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {L(lx, "work_order_empty", "Sin tareas")}
            </p>
          ) : (
            <ul className="space-y-2">
              {myProductionTasks.slice(0, 8).map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{t.title}</span>
                  <span className="text-xs text-zinc-500">
                    {projectNameById.get(t.projectId) ?? t.projectId}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
