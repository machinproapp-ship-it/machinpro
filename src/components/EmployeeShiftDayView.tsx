"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Clock, MapPin, Users, X } from "lucide-react";
import type { ProjectTask } from "@/types/projectTask";
import type { DailyFieldReport } from "@/types/dailyFieldReport";
import { supabase } from "@/lib/supabase";
import { insertSignature } from "@/lib/dailyReportsDb";
import { ClockInProjectPicker, type ClockInAssignedProject } from "@/components/ClockInProjectPicker";
import { formatDateLong, formatTime, formatTimeHm, resolveUserTimezone } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";

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
  assignedClockInProjects = [],
  clockInProjectCode = "",
  setClockInProjectCode,
  clockProjectsForHint = [],
  tasks,
  onToggleProjectTask,
  dailyReport,
  currentUserProfileId,
  currentUserDisplayName,
  colleagueNames,
  onDailyReportSigned,
  timeZone: timeZoneProp,
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
  onClockIn: (override?: { projectId?: string; projectCode?: string }) => void;
  onClockOut: () => void;
  assignedClockInProjects?: ClockInAssignedProject[];
  clockInProjectCode?: string;
  setClockInProjectCode?: (v: string) => void;
  /** Para validar código libre (nombre de obra). */
  clockProjectsForHint?: Array<{ id: string; name: string; projectCode?: string }>;
  tasks: ProjectTask[];
  onToggleProjectTask: (taskId: string, completed: boolean) => void;
  dailyReport: DailyFieldReport | null;
  currentUserProfileId: string | null;
  currentUserDisplayName: string;
  colleagueNames: string[];
  onDailyReportSigned?: () => void;
  timeZone?: string;
}) {
  const tl = labels;
  const locale = localeFromLanguage(language);
  const tz = timeZoneProp ?? resolveUserTimezone(null);
  void useMachinProDisplayPrefs();
  const wallClockLabel = (s: string) =>
    /^\d{1,2}:\d{2}$/.test(String(s).trim()) ? formatTimeHm(s, locale, tz) : s;
  const [tick, setTick] = useState(0);
  const [signBusy, setSignBusy] = useState(false);
  const [signErr, setSignErr] = useState<string | null>(null);
  const [shiftClockManual, setShiftClockManual] = useState(true);

  useEffect(() => {
    if (!open || clockEntry?.clockOut || !clockEntry) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, clockEntry]);

  const dateLabel = useMemo(() => {
    const d = new Date(scheduleEntry.date + "T12:00:00");
    return formatDateLong(d, locale, tz);
  }, [scheduleEntry.date, locale, tz]);

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
    return formatTime(mySignature.signedAt, locale, tz);
  }, [mySignature, locale, tz]);

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 49,
  };

  const panelStyle: CSSProperties = isDesktop
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(800px, 90vw)",
        minWidth: 640,
        minHeight: 500,
        maxHeight: "90vh",
        overflowY: "auto",
        zIndex: 50,
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
      }
    : {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100dvh",
        overflowY: "auto",
        zIndex: 50,
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
      };

  if (!open) return null;

  return (
    <>
      <div style={overlayStyle} aria-hidden onClick={onClose} />
      <div
        style={panelStyle}
        className="border border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-labelledby="employee-shift-day-title"
      >
        <header className="sticky top-0 z-10 flex shrink-0 items-start gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="min-w-0 flex-1 pe-2">
            <p id="employee-shift-day-title" className="text-lg font-bold capitalize text-zinc-900 dark:text-white">
              {tl.shiftView ?? "Mi jornada"}
            </p>
            <p className="mt-0.5 text-sm capitalize text-zinc-600 dark:text-zinc-300">{dateLabel}</p>
            {project && (
              <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                <span className="break-words">{project.name}</span>
              </p>
            )}
            {scheduleEntry.type === "shift" && (
              <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300 mt-1 flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0" aria-hidden />
                {wallClockLabel(scheduleEntry.startTime)} → {wallClockLabel(scheduleEntry.endTime)}
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
            className="sticky top-0 flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
            aria-label={tl.nav_back ?? "Close"}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="space-y-6 px-4 py-4">
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
                    : `${tl.clockInEntry ?? "Entrada"}: ${wallClockLabel(clockEntry.clockIn)}`
                  : tl.shiftNoClockThatDay ?? ""}
              </p>
            ) : !clockEntry ? (
              (() => {
                const shiftHasProject = !!(
                  scheduleEntry.projectId || scheduleEntry.projectCode?.trim()
                );
                if (shiftHasProject) {
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        onClockIn({
                          projectId: scheduleEntry.projectId,
                          projectCode: scheduleEntry.projectCode,
                        })
                      }
                      disabled={gpsStatus === "locating"}
                      className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-base"
                    >
                      {gpsStatus === "locating"
                        ? (tl.gpsLocating ?? "…")
                        : (tl.clockIn ?? "Fichar entrada")}
                    </button>
                  );
                }
                if (!setClockInProjectCode) {
                  return (
                    <button
                      type="button"
                      onClick={() => onClockIn()}
                      disabled={gpsStatus === "locating"}
                      className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-base"
                    >
                      {gpsStatus === "locating"
                        ? (tl.gpsLocating ?? "…")
                        : (tl.clockIn ?? "Fichar entrada")}
                    </button>
                  );
                }
                const lx = tl as Record<string, string>;
                return (
                  <div className="space-y-3">
                    <ClockInProjectPicker
                      lx={lx}
                      assignedProjects={assignedClockInProjects}
                      clockInProjectCode={clockInProjectCode}
                      setClockInProjectCode={setClockInProjectCode}
                      onSelectProjectClockIn={(p) =>
                        onClockIn({ projectId: p.id, projectCode: p.projectCode })
                      }
                      onManualClockInNeededChange={setShiftClockManual}
                    />
                    {shiftClockManual && clockInProjectCode
                      ? (() => {
                          const found = clockProjectsForHint.find(
                            (p) =>
                              (p.projectCode ?? "").toUpperCase() ===
                              clockInProjectCode.trim().toUpperCase()
                          );
                          return found ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              ✓ {found.name}
                            </p>
                          ) : (
                            <p className="text-xs text-red-500 dark:text-red-400">
                              {lx.projectCodeNotFound ?? ""}
                            </p>
                          );
                        })()
                      : null}
                    {shiftClockManual ? (
                      <button
                        type="button"
                        onClick={() => onClockIn()}
                        disabled={gpsStatus === "locating"}
                        className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-base"
                      >
                        {gpsStatus === "locating"
                          ? (tl.gpsLocating ?? "…")
                          : (tl.clockIn ?? "Fichar entrada")}
                      </button>
                    ) : null}
                  </div>
                );
              })()
            ) : !clockEntry.clockOut ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {tl.clockInEntry ?? "Entrada"}:{" "}
                  <span className="font-mono font-medium">{wallClockLabel(clockEntry.clockIn)}</span>
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
                  <span className="font-mono">{wallClockLabel(clockEntry.clockIn)}</span> ·{" "}
                  {tl.clockOutEntry ?? "Salida"}:{" "}
                  <span className="font-mono">{wallClockLabel(clockEntry.clockOut ?? "")}</span>
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
