"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Clock, MapPin, Users, X } from "lucide-react";
import type { ProjectTask } from "@/types/projectTask";
import type { DailyFieldReport } from "@/types/dailyFieldReport";
import { supabase } from "@/lib/supabase";
import { insertSignature } from "@/lib/dailyReportsDb";

/** Alineado con ScheduleEntry en page.tsx (evita import circular). */
export type EmployeeShiftScheduleEntry = {
  id: string;
  type: "shift" | "event" | "vacation";
  employeeIds: string[];
  projectId?: string;
  projectCode?: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  createdBy: string;
  eventLabel?: string;
};

export type EmployeeShiftClockEntry = {
  id: string;
  employeeId: string;
  projectId?: string;
  projectCode?: string;
  date: string;
  clockIn: string;
  clockOut?: string;
};

export type EmployeeShiftDayViewProject = {
  id: string;
  name: string;
  projectCode?: string;
  location?: string;
  locationLat?: number;
  locationLng?: number;
};

type Labels = Record<string, string>;

function localeFromLanguage(language: string): string {
  const m: Record<string, string> = {
    es: "es-ES",
    en: "en-GB",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
  };
  return m[language] ?? "es-ES";
}

function formatWorkedFromClock(clockIn: string, clockOut: string): string {
  const [ih, im] = clockIn.split(":").map((x) => parseInt(x, 10));
  const [oh, om] = clockOut.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(ih) || !Number.isFinite(im) || !Number.isFinite(oh) || !Number.isFinite(om)) return "";
  let start = ih * 60 + im;
  let end = oh * 60 + om;
  if (end < start) end += 24 * 60;
  const diff = end - start;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h ${m}m`;
}

function buildBriefingSummary(report: DailyFieldReport, tl: Labels): string {
  const parts: string[] = [];
  const cond = report.siteConditions?.trim();
  if (cond) parts.push(cond);
  const hz = report.hazards
    .map((h) => h.description?.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (hz.length) parts.push(hz.join(" · "));
  if (report.ppeSelected?.length) {
    const ppe = tl.dailyReportPpeGlobal ?? "PPE";
    parts.push(`${ppe}: ${report.ppeSelected.join(", ")}`);
  }
  return parts.join("\n\n") || (tl.dailyReportSectionHeader ?? "");
}

export function EmployeeShiftDayView({
  open,
  onClose,
  language,
  labels,
  scheduleEntry,
  project,
  clockEntry,
  canActClock,
  gpsStatus,
  clockInAlertMessage,
  onDismissClockInAlert,
  onClockIn,
  onClockOut,
  tasks,
  onToggleProjectTask,
  dailyReport,
  currentUserProfileId,
  currentUserDisplayName,
  colleagueNames,
  onDailyReportSigned,
}: {
  open: boolean;
  onClose: () => void;
  language: string;
  labels: Labels;
  scheduleEntry: EmployeeShiftScheduleEntry;
  project: EmployeeShiftDayViewProject | null;
  clockEntry: EmployeeShiftClockEntry | undefined;
  canActClock: boolean;
  gpsStatus: "idle" | "locating" | "ok" | "alert" | "no_gps";
  clockInAlertMessage: string | null;
  onDismissClockInAlert?: () => void;
  onClockIn: () => void;
  onClockOut: () => void;
  tasks: ProjectTask[];
  onToggleProjectTask: (taskId: string, completed: boolean) => void;
  dailyReport: DailyFieldReport | null;
  currentUserProfileId: string | null;
  currentUserDisplayName: string;
  colleagueNames: string[];
  onDailyReportSigned?: () => void;
}) {
  const tl = labels;
  const locale = localeFromLanguage(language);
  const [tick, setTick] = useState(0);
  const [signBusy, setSignBusy] = useState(false);
  const [signErr, setSignErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || clockEntry?.clockOut || !clockEntry) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, clockEntry]);

  const dateLabel = useMemo(() => {
    const d = new Date(scheduleEntry.date + "T12:00:00");
    return d.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [scheduleEntry.date, locale]);

  const mapsUrl = useMemo(() => {
    if (!project) return null;
    if (project.locationLat != null && project.locationLng != null) {
      return `https://maps.google.com/?q=${project.locationLat},${project.locationLng}`;
    }
    if (project.location) {
      return `https://maps.google.com/?q=${encodeURIComponent(project.location)}`;
    }
    return `https://maps.google.com/?q=${encodeURIComponent(project.name)}`;
  }, [project]);

  const elapsedLive = useMemo(() => {
    if (!clockEntry?.clockIn || clockEntry.clockOut) return "";
    const [h, m] = clockEntry.clockIn.split(":").map((x) => parseInt(x, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
    const start = new Date();
    start.setHours(h, m, 0, 0);
    let ms = Date.now() - start.getTime();
    if (ms < 0) ms = 0;
    const hh = Math.floor(ms / 3_600_000);
    const mm = Math.floor((ms % 3_600_000) / 60_000);
    const ss = Math.floor((ms % 60_000) / 1000);
    return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, [clockEntry, tick]);

  const workedCompleted = useMemo(() => {
    if (!clockEntry?.clockIn || !clockEntry.clockOut) return "";
    return formatWorkedFromClock(clockEntry.clockIn, clockEntry.clockOut);
  }, [clockEntry]);

  const mySignature = useMemo(() => {
    if (!dailyReport || !currentUserProfileId) return null;
    return dailyReport.signatures.find((s) => s.employeeId === currentUserProfileId) ?? null;
  }, [dailyReport, currentUserProfileId]);

  const handleSignReport = useCallback(async () => {
    if (!dailyReport || !currentUserProfileId || dailyReport.status !== "published" || mySignature) return;
    setSignBusy(true);
    setSignErr(null);
    const id = crypto.randomUUID();
    const { error } = await insertSignature(supabase, {
      id,
      reportId: dailyReport.id,
      employeeId: currentUserProfileId,
      method: "tap",
      signatureData: null,
    });
    setSignBusy(false);
    if (error) {
      setSignErr(error.message);
      return;
    }
    onDailyReportSigned?.();
  }, [dailyReport, currentUserProfileId, mySignature, onDailyReportSigned]);

  const signedAtLabel = useMemo(() => {
    if (!mySignature?.signedAt) return "";
    const d = new Date(mySignature.signedAt);
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }, [mySignature, locale]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed z-[70] inset-0 sm:inset-4 md:inset-8 flex flex-col rounded-none sm:rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border-0 sm:border border-zinc-200 dark:border-slate-700 shadow-2xl max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)]"
        role="dialog"
        aria-labelledby="employee-shift-day-title"
      >
        <header className="shrink-0 border-b border-zinc-200 dark:border-slate-700 px-4 py-3 flex items-start gap-3 bg-white dark:bg-slate-900">
          <div className="flex-1 min-w-0">
            <p id="employee-shift-day-title" className="text-lg font-bold text-zinc-900 dark:text-white capitalize">
              {tl.shiftView ?? "Mi jornada"}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-0.5 capitalize">{dateLabel}</p>
            {project && (
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-2 flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                <span className="truncate">{project.name}</span>
              </p>
            )}
            {scheduleEntry.type === "shift" && (
              <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300 mt-1 flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0" aria-hidden />
                {scheduleEntry.startTime} → {scheduleEntry.endTime}
              </p>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline min-h-[44px]"
              >
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {(tl as Record<string, string>).openInMaps ?? "Maps"}
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
            aria-label={tl.nav_back ?? "Close"}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
          {/* Fichaje */}
          <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3 bg-zinc-50/80 dark:bg-slate-950/40">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" aria-hidden />
              {tl.myClockIn ?? "Mi fichaje"}
            </h2>
            {!canActClock ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {clockEntry
                  ? clockEntry.clockOut
                    ? `${tl.timeWorked ?? "Tiempo trabajado"}: ${workedCompleted || "—"}`
                    : `${tl.clockInEntry ?? "Entrada"}: ${clockEntry.clockIn}`
                  : tl.shiftNoClockThatDay ?? ""}
              </p>
            ) : !clockEntry ? (
              <button
                type="button"
                onClick={onClockIn}
                disabled={gpsStatus === "locating"}
                className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-base"
              >
                {gpsStatus === "locating" ? (tl.gpsLocating ?? "…") : (tl.clockIn ?? "Fichar entrada")}
              </button>
            ) : !clockEntry.clockOut ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {tl.clockInEntry ?? "Entrada"}: <span className="font-mono font-medium">{clockEntry.clockIn}</span>
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {tl.timeWorked ?? "Tiempo trabajado"}:{" "}
                  <span className="font-mono font-semibold text-zinc-900 dark:text-white">{elapsedLive}</span>
                </p>
                <button
                  type="button"
                  onClick={onClockOut}
                  disabled={gpsStatus === "locating"}
                  className="w-full min-h-[48px] rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold text-base"
                >
                  {gpsStatus === "locating" ? (tl.gpsLocating ?? "…") : (tl.clockOut ?? "Terminar jornada")}
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-zinc-700 dark:text-zinc-300">
                  {tl.clockInEntry ?? "Entrada"}:{" "}
                  <span className="font-mono">{clockEntry.clockIn}</span> · {tl.clockOutEntry ?? "Salida"}:{" "}
                  <span className="font-mono">{clockEntry.clockOut}</span>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {tl.timeWorked ?? "Tiempo trabajado"}:{" "}
                  <span className="font-semibold text-zinc-900 dark:text-white">{workedCompleted}</span>
                </p>
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">{tl.shiftCompleted ?? "Jornada completada"}</p>
              </div>
            )}
            {clockInAlertMessage && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 flex justify-between gap-2">
                <p className="text-sm text-amber-900 dark:text-amber-100">{clockInAlertMessage}</p>
                {onDismissClockInAlert && (
                  <button type="button" onClick={onDismissClockInAlert} className="shrink-0 min-w-[44px] min-h-[44px] text-amber-800">
                    ×
                  </button>
                )}
              </div>
            )}
            {gpsStatus === "no_gps" && canActClock && (
              <p className="text-xs text-zinc-500">{tl.gpsNoGps ?? ""}</p>
            )}
          </section>

          {/* Tareas */}
          <section>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">{tl.myTasksToday ?? "Tareas"}</h2>
            {tasks.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                {tl.shiftNoTasksToday ?? "No hay tareas asignadas para hoy"}
              </p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 rounded border-zinc-300 dark:border-zinc-600"
                      checked={task.status === "completed"}
                      onChange={(e) => onToggleProjectTask(task.id, e.target.checked)}
                      aria-label={task.title}
                    />
                    <span className={`text-sm ${task.status === "completed" ? "line-through text-zinc-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Parte diario */}
          {dailyReport && dailyReport.status === "published" && (
            <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{tl.dailyReport ?? "Parte diario"}</h2>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">{buildBriefingSummary(dailyReport, tl)}</p>
              {mySignature ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  {(tl.shiftSignedAtTime ?? "Firmado a las {time}").replace("{time}", signedAtLabel)}
                </p>
              ) : currentUserProfileId ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSignReport()}
                    disabled={signBusy}
                    className="w-full min-h-[48px] rounded-xl border-2 border-amber-500 text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50"
                  >
                    {signBusy ? "…" : tl.signReport ?? "Firmar parte"}
                  </button>
                  {signErr && <p className="text-sm text-red-600">{signErr}</p>}
                </>
              ) : null}
            </section>
          )}

          {/* Compañeros */}
          {colleagueNames.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden />
                {tl.colleaguesOnSite ?? "Compañeros en obra"}
              </h2>
              <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
                {colleagueNames.map((n, i) => (
                  <li key={`${n}-${i}`}>{n}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
