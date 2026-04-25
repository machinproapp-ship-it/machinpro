"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScheduleEntry } from "@/types/homePage";
import type { FormInstance, FormTemplate } from "@/types/forms";
import type { ProjectTask } from "@/types/projectTask";
import type { MainSection } from "@/types/shared";
import { formatTimeHm, formatTodayYmdInTimeZone } from "@/lib/dateUtils";
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
};

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
}: WorkerHubProps) {
  const todayYmd = formatTodayYmdInTimeZone(timeZone);
  const [clockTick, setClockTick] = useState(0);
  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

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
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              {L(lx, "worker_view_my_shift", "Mi turno hoy")}
            </h2>
          </div>
          {todayShifts.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {L(lx, "schedule_no_shifts_day", "No hay turno hoy")}
            </p>
          ) : (
            <ul className="space-y-2">
              {todayShifts.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/25"
                >
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {s.projectId ? projectNameById.get(s.projectId) ?? s.projectCode ?? "—" : s.projectCode ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {formatTimeHm(s.startTime, dateLocale, timeZone)} →{" "}
                    {formatTimeHm(s.endTime, dateLocale, timeZone)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {canViewSchedule ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
          <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-white">
            {L(lx, "my_clockin", L(lx, "worker_view_my_clock", "Mi fichaje"))}
          </h2>
          {!todayClock ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {L(lx, "no_entries", L(lx, "noEntries", "Sin fichajes hoy"))}
            </p>
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

      {canFillForms ? (
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
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-slate-800"
              onClick={() => onNavigate("site")}
            >
              {L(lx, "site", "Operaciones")}
            </button>
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
