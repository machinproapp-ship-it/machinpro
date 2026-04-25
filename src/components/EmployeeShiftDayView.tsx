"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Briefcase, Clock, Coffee, MapPin, Users, X } from "lucide-react";
import type { ProjectTask } from "@/types/projectTask";
import type { DailyFieldReport } from "@/types/dailyFieldReport";
import { supabase } from "@/lib/supabase";
import { insertSignature } from "@/lib/dailyReportsDb";
import { userFacingErrorMessage } from "@/lib/userFacingError";
import { ClockInProjectPicker, type ClockInAssignedProject } from "@/components/ClockInProjectPicker";
import { formatDateLong, formatTime, formatTimeHm, resolveUserTimezone } from "@/lib/dateUtils";
import {
  elapsedMinutesSinceClockStart,
  formatCompletedWorkFromHmPair,
  formatWorkDurationCompact,
  shiftGoalMinutesFromSchedule,
  trafficLightClassFromElapsedHours,
} from "@/lib/clockDisplay";
import { ClockRingTimer, type ClockRingPaymentType } from "@/components/clock/ClockRingTimer";
import { WorkerProductionTodaySection } from "@/components/WorkerProductionTodaySection";
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
  clockInAtIso?: string;
  clockOutAtIso?: string | null;
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

function localIsoFromDateAndHm(dateYmd: string, hm: string): string {
  const parts = dateYmd.split("-").map((x) => parseInt(x, 10));
  const y = parts[0] ?? 0;
  const mo = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const hmParts = hm.split(":").map((x) => parseInt(x, 10));
  const h = hmParts[0] ?? 0;
  const mi = hmParts[1] ?? 0;
  return new Date(y, mo - 1, d, h, mi, 0, 0).toISOString();
}

function hmForTimeInput(raw: string): string {
  const s = String(raw ?? "").trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [a, b] = s.split(":");
    return `${a!.padStart(2, "0")}:${b}`;
  }
  return "09:00";
}

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
  onClockBreakToggle,
  onClockProjectSwitch,
  clockProjectSwitchOptions = [],
  clockBreakActive = false,
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
  clockCorrectionAllowed = false,
  companyId: companyIdProp,
  productionAccessToken = null,
  companyCurrency = "CAD",
  onClockCorrectionApplied,
  employeePaymentType = "hourly",
  clockGoalMinutes: clockGoalMinutesProp,
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
  /** AH-41: fichaje activo Supabase UUID — pausa / cambio de obra */
  onClockBreakToggle?: () => void | Promise<void>;
  onClockProjectSwitch?: (projectId: string) => void | Promise<void>;
  /** Proyectos asignados distintos al proyecto activo del fichaje */
  clockProjectSwitchOptions?: Array<{ id: string; name: string; projectCode?: string }>;
  clockBreakActive?: boolean;
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
  clockCorrectionAllowed?: boolean;
  companyId?: string | null;
  /** Bearer token para registrar producción (misma empresa). */
  productionAccessToken?: string | null;
  companyCurrency?: string;
  onClockCorrectionApplied?: (entryId: string, clockInIso: string, clockOutIso: string) => void;
  /** Aligned with employee pay settings — drives fichaje hero layout */
  employeePaymentType?: ClockRingPaymentType;
  /** Planned shift length in minutes (progress ring goal). Defaults from schedule start/end. */
  clockGoalMinutes?: number;
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
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [corrOpen, setCorrOpen] = useState(false);
  const [corrIn, setCorrIn] = useState("09:00");
  const [corrOut, setCorrOut] = useState("18:00");
  const [corrNote, setCorrNote] = useState("");
  const [corrBusy, setCorrBusy] = useState(false);
  const [corrErr, setCorrErr] = useState<string | null>(null);

  const canUseAdvancedClock =
    canActClock &&
    !!onClockBreakToggle &&
    !!onClockProjectSwitch &&
    !!clockEntry?.id &&
    !clockEntry.clockOut &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clockEntry.id);

  const clockSwitchDisabled = !canUseAdvancedClock || clockProjectSwitchOptions.length === 0;

  const lx = tl as Record<string, string>;
  const resolvedGoalMinutes =
    clockGoalMinutesProp ??
    (scheduleEntry.type === "shift"
      ? shiftGoalMinutesFromSchedule({
          startTime: scheduleEntry.startTime,
          endTime: scheduleEntry.endTime,
        })
      : 8 * 60);
  const teUuid =
    clockEntry?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clockEntry.id)
      ? clockEntry.id
      : null;
  const canShowCorrection =
    !!clockCorrectionAllowed && !!clockEntry?.clockOut && !!teUuid && !!companyIdProp?.trim();

  const submitCorrection = useCallback(async () => {
    if (!teUuid || !companyIdProp?.trim()) return;
    const note = corrNote.trim();
    if (!note) {
        setCorrErr((tl as Record<string, string>).clock_correction_note ?? "Note required");
      return;
    }
    setCorrBusy(true);
    setCorrErr(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setCorrBusy(false);
        return;
      }
      const clockInIso = localIsoFromDateAndHm(scheduleEntry.date, corrIn);
      const clockOutIso = localIsoFromDateAndHm(scheduleEntry.date, corrOut);
      const res = await fetch("/api/clock/manual-correction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId: companyIdProp,
          timeEntryId: teUuid,
          clockInIso,
          clockOutIso,
          note,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setCorrErr(j.error ?? "Error");
        setCorrBusy(false);
        return;
      }
      onClockCorrectionApplied?.(teUuid, clockInIso, clockOutIso);
      setCorrBusy(false);
      setCorrOpen(false);
    } catch (e) {
      setCorrErr(e instanceof Error ? e.message : "Error");
      setCorrBusy(false);
    }
  }, [
    teUuid,
    companyIdProp,
    corrNote,
    corrIn,
    corrOut,
    scheduleEntry.date,
    tl,
    onClockCorrectionApplied,
  ]);

  useEffect(() => {
    if (!open) setProjectPickerOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !corrOpen || !clockEntry?.clockIn) return;
    setCorrIn(hmForTimeInput(clockEntry.clockIn));
    setCorrOut(hmForTimeInput(clockEntry.clockOut ?? clockEntry.clockIn));
    setCorrNote("");
    setCorrErr(null);
  }, [open, corrOpen, clockEntry?.clockIn, clockEntry?.clockOut]);

  useEffect(() => {
    if (!open || clockEntry?.clockOut || !clockEntry) return;
    setTick((n) => n + 1);
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
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
    void tick;
    if (!clockEntry?.clockIn || clockEntry.clockOut) return null;
    const mins = elapsedMinutesSinceClockStart({
      dateYmd: scheduleEntry.date,
      clockInHm: clockEntry.clockIn,
      clockInAtIso: clockEntry.clockInAtIso,
    });
    const hours = mins / 60;
    const dur = formatWorkDurationCompact(mins, tl as Record<string, string>);
    const cls = trafficLightClassFromElapsedHours(hours);
    const text =
      (tl.clock_working_for as string | undefined)?.replace(/\{time\}/g, dur) ??
      `Trabajando: ${dur}`;
    return { dur, cls, text };
  }, [clockEntry, scheduleEntry.date, tick, tl]);

  const activeClockMinutes = useMemo(() => {
    void tick;
    if (!clockEntry?.clockIn || clockEntry.clockOut) return 0;
    return elapsedMinutesSinceClockStart({
      dateYmd: scheduleEntry.date,
      clockInHm: clockEntry.clockIn,
      clockInAtIso: clockEntry.clockInAtIso,
    });
  }, [clockEntry, scheduleEntry.date, tick]);

  const ringPaymentType: ClockRingPaymentType =
    employeePaymentType === "production" ? "production" : employeePaymentType === "salary" ? "salary" : "hourly";

  const workedCompleted = useMemo(() => {
    if (!clockEntry?.clockIn || !clockEntry.clockOut) return "";
    return formatCompletedWorkFromHmPair(clockEntry.clockIn, clockEntry.clockOut, tl as Record<string, string>);
  }, [clockEntry, tl]);

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
      setSignErr(userFacingErrorMessage(labels, error));
      return;
    }
    onDailyReportSigned?.();
  }, [dailyReport, currentUserProfileId, labels, mySignature, onDailyReportSigned]);

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
              <div className="space-y-3">
                {clockEntry && !clockEntry.clockOut ? (
                  <ClockRingTimer
                    currentMinutes={activeClockMinutes}
                    goalMinutes={resolvedGoalMinutes}
                    isOnBreak={clockBreakActive}
                    paymentType={ringPaymentType}
                    labels={lx}
                    clockInHmDisplay={wallClockLabel(clockEntry.clockIn)}
                    compact={employeePaymentType === "production"}
                  />
                ) : null}
                {!(clockEntry && !clockEntry.clockOut) ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {clockEntry
                      ? clockEntry.clockOut
                        ? `${tl.timeWorked ?? "Tiempo trabajado"}: ${workedCompleted || "—"}`
                        : `${tl.clockInEntry ?? "Entrada"}: ${wallClockLabel(clockEntry.clockIn)}${
                            !clockEntry.clockOut && elapsedLive ? ` · ${elapsedLive.text}` : ""
                          }`
                      : tl.shiftNoClockThatDay ?? ""}
                  </p>
                ) : null}
              </div>
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
                        : ((tl.clock_in_action ?? tl.timeclock_clock_in ?? tl.clockIn ?? "").trim() || "Fichar")}
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
                        : ((tl.clock_in_action ?? tl.timeclock_clock_in ?? tl.clockIn ?? "").trim() || "Fichar")}
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
                          : ((tl.clock_in_action ?? tl.timeclock_clock_in ?? tl.clockIn ?? "").trim() || "Fichar")}
                      </button>
                    ) : null}
                  </div>
                );
              })()
            ) : !clockEntry.clockOut ? (
              <div className="space-y-4">
                <ClockRingTimer
                  currentMinutes={activeClockMinutes}
                  goalMinutes={resolvedGoalMinutes}
                  isOnBreak={clockBreakActive}
                  paymentType={ringPaymentType}
                  labels={lx}
                  clockInHmDisplay={wallClockLabel(clockEntry.clockIn)}
                  compact={employeePaymentType === "production"}
                />

                {employeePaymentType === "production" ? (
                  <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/80">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                      {lx.production_today ?? "Mi producción hoy"}
                    </h3>
                    {companyIdProp?.trim() && productionAccessToken ? (
                      <div className="mt-3">
                        <WorkerProductionTodaySection
                          labels={lx}
                          companyId={companyIdProp.trim()}
                          accessToken={productionAccessToken}
                          timeZone={tz}
                          companyCurrency={companyCurrency}
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {(lx as Record<string, string>).work_orders_need_session ??
                          lx.production_today_placeholder ??
                          ""}
                      </p>
                    )}
                  </section>
                ) : null}

                {canUseAdvancedClock ? (
                  <>
                    <div className="grid w-full grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void onClockBreakToggle?.()}
                        disabled={gpsStatus === "locating"}
                        className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                      >
                        <Coffee className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">
                          {clockBreakActive
                            ? ((tl as Record<string, string>).clock_end_break ?? "End Break")
                            : ((tl as Record<string, string>).clock_break ?? "Break")}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={gpsStatus === "locating" || clockSwitchDisabled}
                        title={
                          clockSwitchDisabled
                            ? ((tl as Record<string, string>).clock_switch_no_projects ??
                              "No other projects available")
                            : undefined
                        }
                        onClick={() => setProjectPickerOpen((o) => !o)}
                        className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-gray-700 px-3 py-3 text-sm font-semibold text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                      >
                        <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">
                          {(tl as Record<string, string>).clock_switch_project ?? "Switch Project"}
                        </span>
                      </button>
                    </div>
                    {projectPickerOpen && clockProjectSwitchOptions.length > 0 ? (
                      <div
                        className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-slate-600 dark:bg-slate-900"
                        role="listbox"
                        aria-label={(tl as Record<string, string>).clock_switch_project ?? "Projects"}
                      >
                        <p className="px-2 pb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {(tl as Record<string, string>).clock_switch_project ?? "Switch Project"}
                        </p>
                        <div className="max-h-[min(40vh,240px)] space-y-1 overflow-y-auto overscroll-contain">
                          {clockProjectSwitchOptions.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="flex min-h-[44px] w-full items-center rounded-lg px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50 dark:text-slate-100 dark:hover:bg-slate-800"
                              onClick={() => {
                                setProjectPickerOpen(false);
                                void onClockProjectSwitch?.(p.id);
                              }}
                            >
                              <span className="break-words">{p.name}</span>
                              {p.projectCode ? (
                                <span className="ms-2 shrink-0 text-xs text-zinc-500">{p.projectCode}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={onClockOut}
                  disabled={gpsStatus === "locating"}
                  className="flex h-14 w-full min-h-[56px] items-center justify-center rounded-xl bg-red-600 px-4 text-lg font-bold text-white hover:bg-red-500 disabled:opacity-60"
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
                  {(tl.clock_total_worked as string | undefined)?.replace(/\{time\}/g, workedCompleted) ??
                    `${tl.timeWorked ?? "Tiempo trabajado"}: ${workedCompleted}`}
                </p>
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">{tl.shiftCompleted ?? "Jornada completada"}</p>
                {canShowCorrection ? (
                  <button
                    type="button"
                    onClick={() => setCorrOpen(true)}
                    className="mt-1 inline-flex min-h-[44px] items-center text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    {lx.clock_reopen ?? "Corregir fichaje"}
                  </button>
                ) : null}
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
                  {signErr && <p className="text-sm text-red-600">{String(signErr)}</p>}
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
      {corrOpen && canShowCorrection ? (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50 touch-none"
            aria-hidden
            onClick={() => {
              if (!corrBusy) setCorrOpen(false);
            }}
          />
          <div className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">{lx.clock_reopen ?? "Corregir fichaje"}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {tl.clockInEntry ?? "Entrada"}
                </label>
                <input
                  type="time"
                  value={corrIn}
                  onChange={(e) => setCorrIn(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {tl.clockOutEntry ?? "Salida"}
                </label>
                <input
                  type="time"
                  value={corrOut}
                  onChange={(e) => setCorrOut(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(tl as Record<string, string>).clock_correction_note ?? "Motivo"}
                </label>
                <textarea
                  value={corrNote}
                  onChange={(e) => setCorrNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              {corrErr ? <p className="text-sm text-red-600">{corrErr}</p> : null}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={corrBusy}
                onClick={() => setCorrOpen(false)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium min-h-[44px]"
              >
                {tl.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                disabled={corrBusy}
                onClick={() => void submitCorrection()}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
              >
                {corrBusy ? "…" : tl.save ?? "Guardar"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
