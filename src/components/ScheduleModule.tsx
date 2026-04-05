"use client";

import { useState, useMemo, useCallback, useEffect, useReducer } from "react";
import { ClockInProjectPicker, type ClockInAssignedProject } from "@/components/ClockInProjectPicker";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Users,
  X,
  Briefcase,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import { resolveUserTimezone, formatCalendarYmd, formatTimeHm } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";
import { useToast } from "@/components/Toast";
import { csvCell, downloadCsvUtf8, fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";
import { ALL_TRANSLATIONS } from "@/lib/i18n";

export interface SchedEmployee {
  id: string;
  name: string;
  role: string;
  /** admin | supervisor | worker | logistic | custom:<roleId> */
  scheduleRoleKey?: string;
}

export interface SchedProject {
  id: string;
  name: string;
  projectCode?: string;
  locationLat?: number;
  locationLng?: number;
  location?: string;
}

export interface SchedEntry {
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
}

export interface ClockEntryForSchedule {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  locationLat?: number;
  locationLng?: number;
  locationAlert?: boolean;
  locationAlertMeters?: number;
  hadPendingCerts?: boolean;
  projectId?: string;
  projectCode?: string;
}

export interface TimeEntryForSchedule {
  id: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  projectId?: string;
  projectName?: string;
  hoursWorked: number;
  locationAlert?: boolean;
  locationAlertMeters?: number;
  hadPendingCerts?: boolean;
}

export interface TimeSheetForSchedule {
  id: string;
  employeeId: string;
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  entries: TimeEntryForSchedule[];
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export interface ScheduleModuleProps {
  entries: SchedEntry[];
  employees: SchedEmployee[];
  projects: SchedProject[];
  currentUserEmployeeId?: string;
  canWrite: boolean;
  canClockIn?: boolean;
  viewAll: boolean;
  labels: {
    schedule?: string;
    schedule_tab_calendar?: string;
    shift?: string;
    event?: string;
    addEntry?: string;
    noEntries?: string;
    today?: string;
    week?: string;
    clockInTitle?: string;
    clockIn?: string;
    clockOut?: string;
    clockInDone?: string;
    clockInEntry?: string;
    clockOutEntry?: string;
    gpsLocating?: string;
    gpsNoGps?: string;
    gpsOutOfRange?: string;
    projectCodePlaceholder?: string;
    projectCodeNotFound?: string;
    projectCode?: string;
    projectCodeHint?: string;
    useAnotherCode?: string;
    backToMyProjects?: string;
    selectProjectToClock?: string;
    editEntry?: string;
    confirmDeleteShift?: string;
    cancel?: string;
    delete?: string;
    timesheets?: string;
    weekly?: string;
    biweekly?: string;
    monthly?: string;
    regularHours?: string;
    overtimeHours?: string;
    approve?: string;
    reject?: string;
    approved?: string;
    rejected?: string;
    pending?: string;
    january?: string;
    february?: string;
    march?: string;
    april?: string;
    may?: string;
    june?: string;
    july?: string;
    august?: string;
    september?: string;
    october?: string;
    november?: string;
    december?: string;
    monShort?: string;
    tueShort?: string;
    wedShort?: string;
    thuShort?: string;
    friShort?: string;
    satShort?: string;
    sunShort?: string;
    previousMonth?: string;
    nextMonth?: string;
    date?: string;
    project?: string;
    personnel?: string;
    hours?: string;
    outsideZone?: string;
    pendingCertsAtClockIn?: string;
    days?: string;
    schedule_event_company?: string;
    schedule_day_off_collective?: string;
    schedule_personal_leave?: string;
    schedule_event_type?: string;
    schedule_vacation_request?: string;
    schedule_vacation_pending_list?: string;
    schedule_vacation_comment?: string;
    schedule_vacation_calendar_note?: string;
    schedule_legend_meeting?: string;
    schedule_legend_training?: string;
    employees_request_vacation?: string;
    common_other?: string;
    schedule_select_all?: string;
    schedule_deselect_all?: string;
    schedule_filter_by_role?: string;
    schedule_pick_employees?: string;
    schedule_pick_employees_error?: string;
    schedule_search_employees?: string;
    schedule_selected_count?: string;
    schedule_deselect_filter?: string;
    schedule_days_selected?: string;
    export_csv?: string;
    export_pdf?: string;
    export_timesheets?: string;
    export_success?: string;
    export_error?: string;
    schedule_no_sheets?: string;
    schedule_no_shifts_day?: string;
    /** Pestaña Vacaciones (móvil) */
    schedule_tab_vacations?: string;
    admin?: string;
    supervisor?: string;
    worker?: string;
    logistic?: string;
    whFilterAll?: string;
    openInMaps?: string;
    viewMyShift?: string;
  };
  customRoles?: { id: string; name: string }[];
  canApproveVacations?: boolean;
  canRequestVacation?: boolean;
  vacationRequests?: Array<{
    id: string;
    user_id: string;
    start_date: string;
    end_date: string;
    total_days: number;
    status: "pending" | "approved" | "rejected";
    notes?: string | null;
  }>;
  vacationEmployeeNames?: Record<string, string>;
  onApproveVacation?: (id: string, comment: string) => void | Promise<void>;
  onRejectVacation?: (id: string, comment: string) => void | Promise<void>;
  onRequestVacation?: (start: string, end: string, notes: string) => void | Promise<void>;
  onAddEntry?: (entry: Omit<SchedEntry, "id">) => void;
  onUpdateEntry?: (id: string, entry: Omit<SchedEntry, "id">) => void;
  onDeleteEntry?: (id: string) => void;
  clockEntries?: ClockEntryForSchedule[];
  clockInProjectCode?: string;
  setClockInProjectCode?: (v: string) => void;
  gpsStatus?: "idle" | "locating" | "ok" | "alert" | "no_gps";
  clockInAlertMessage?: string | null;
  onDismissClockInAlert?: () => void;
  onClockIn?: (override?: { projectId?: string; projectCode?: string }) => void;
  onClockOut?: () => void;
  /** Proyectos asignados al usuario para fichaje inteligente (sin turno / código libre). */
  assignedClockInProjects?: ClockInAssignedProject[];
  /** full_name/display_name/email y mapeo demo e1… desde page */
  employeeLabels?: Record<string, string>;
  /** AW-6: ids del usuario actual (perfil y/o employee_id) para abrir vista jornada. */
  scheduleSelfIds?: string[];
  /** AW-6: vista completa de jornada (solo turnos propios, !viewAll). */
  onOpenMyShiftView?: (date: string, entryId: string) => void;
  /** BCP 47 + IANA for calendar labels (from `dateLocaleForUser` + `resolveUserTimezone`). */
  dateLocale?: string;
  timeZone?: string;
  /** Nombre empresa para archivos CSV (hojas de horas). */
  companyName?: string;
  /** Fallback slug si no hay nombre de empresa. */
  companyId?: string;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toYMD(date: Date): string {
  return date.toISOString().split("T")[0];
}

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmdToLocalDate(ymd: string): Date {
  const parts = ymd.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const mo = (parts[1] ?? 1) - 1;
  const day = parts[2] ?? 1;
  return new Date(y, mo, day);
}

/** Inclusive range of calendar days (local), sorted ascending. */
function enumerateInclusiveYmd(start: string, end: string): string[] {
  let a = parseYmdToLocalDate(start);
  let b = parseYmdToLocalDate(end);
  if (a.getTime() > b.getTime()) {
    const t = a;
    a = b;
    b = t;
  }
  const out: string[] = [];
  const cur = new Date(a);
  while (cur.getTime() <= b.getTime()) {
    out.push(ymdFromLocalDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

type ShiftFormDatesState = { dates: string[]; rangeAnchor: string | null };

function reduceShiftFormDates(
  state: ShiftFormDatesState,
  action:
    | { type: "click"; ymd: string }
    | { type: "replace"; dates: string[] }
    | { type: "discard_anchor" }
): ShiftFormDatesState {
  if (action.type === "discard_anchor") {
    return state.rangeAnchor == null ? state : { ...state, rangeAnchor: null };
  }
  if (action.type === "replace") {
    const d = [...new Set(action.dates)].filter(Boolean).sort();
    return { dates: d.length ? d : [], rangeAnchor: null };
  }
  const { ymd } = action;
  const { dates, rangeAnchor } = state;
  const s = new Set(dates);
  if (rangeAnchor !== null) {
    if (rangeAnchor === ymd) {
      s.delete(ymd);
      return { dates: [...s].sort(), rangeAnchor: null };
    }
    for (const d of enumerateInclusiveYmd(rangeAnchor, ymd)) s.add(d);
    return { dates: [...s].sort(), rangeAnchor: null };
  }
  if (s.has(ymd)) {
    return { dates, rangeAnchor: ymd };
  }
  s.add(ymd);
  return { dates: [...s].sort(), rangeAnchor: null };
}

// Monday = first column (0). Returns the Monday of the week containing the given date.
function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

// Build 6 rows × 7 days for the month grid (first day = Monday of week containing 1st).
function getCalendarDays(viewYear: number, viewMonth: number): Date[] {
  const first = new Date(viewYear, viewMonth, 1);
  const start = startOfWeekMonday(first);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

const EVENT_COLORS: Record<string, string> = {
  shift: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100",
  meeting: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100",
  vacation: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100",
  training: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-100",
  company_event: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-100",
  collective_off: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  personal_leave: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
};

function entryColor(entry: SchedEntry): string {
  if (entry.type === "shift") return EVENT_COLORS.shift;
  if (entry.type === "vacation") return EVENT_COLORS.vacation;
  return EVENT_COLORS[entry.eventLabel ?? "other"] ?? EVENT_COLORS.other;
}

function entryDotClass(entry: SchedEntry): string {
  if (entry.type === "shift") return "bg-amber-500";
  if (entry.type === "vacation") return "bg-emerald-500";
  const k = entry.eventLabel ?? "other";
  if (k === "meeting") return "bg-blue-500";
  if (k === "training") return "bg-teal-500";
  if (k === "company_event") return "bg-purple-500";
  if (k === "collective_off") return "bg-zinc-400 dark:bg-zinc-500";
  if (k === "personal_leave") return "bg-zinc-500 dark:bg-zinc-400";
  return "bg-zinc-500";
}

/** Text for calendar cell pill (desktop): shift = short project + times; event = type label. */
function calendarCellPillLabel(
  entry: SchedEntry,
  proj: SchedProject | undefined,
  lx: Record<string, string>,
  wallClockLabel: (s: string) => string
): string {
  if (entry.type === "shift") {
    const name = (proj?.name ?? entry.projectCode ?? "").trim();
    const short = name.length > 12 ? `${name.slice(0, 12)}…` : name;
    const t = `${wallClockLabel(entry.startTime)}-${wallClockLabel(entry.endTime)}`;
    return short ? `${short} ${t}` : t;
  }
  return scheduleEntryTypeLabel(entry, lx);
}

/** Human-readable schedule type for calendar (not raw DB keys). */
function scheduleEntryTypeLabel(entry: SchedEntry, lx: Record<string, string>): string {
  if (entry.type === "shift") return lx.schedule_type_shift ?? "Turno";
  if (entry.type === "vacation") return lx.schedule_type_vacation ?? "Vacaciones";
  const ev = entry.eventLabel ?? "other";
  if (ev === "collective_off") return lx.schedule_type_collective_off ?? lx.schedule_day_off_collective ?? "Festivo";
  if (ev === "vacation") return lx.schedule_type_vacation ?? "Vacaciones";
  if (ev === "personal_leave") return lx.schedule_type_personal ?? lx.schedule_personal_leave ?? "Día libre";
  if (ev === "meeting") return lx.schedule_type_meeting ?? lx.schedule_legend_meeting ?? "Reunión";
  if (ev === "training") return lx.schedule_type_training ?? lx.schedule_legend_training ?? "Formación";
  if (ev === "company_event") return lx.schedule_type_company ?? lx.schedule_event_company ?? "Evento empresa";
  if (ev === "event") return lx.schedule_type_event ?? lx.event ?? "Evento";
  if (ev === "shift") return lx.schedule_type_shift ?? "Turno";
  if (ev === "other") return lx.common_other ?? "Otro";
  return ev;
}

// Parse "HH:mm" to decimal hours
function timeToHours(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) + ((m ?? 0) / 60);
}

function hoursBetween(clockIn: string, clockOut: string): number {
  return Math.max(0, timeToHours(clockOut) - timeToHours(clockIn));
}

// Monday of week containing date (YYYY-MM-DD)
function getWeekStart(ymd: string): string {
  const d = new Date(ymd + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

function minYmdForTimesheetPeriod(period: "weekly" | "biweekly" | "monthly"): string {
  const now = new Date();
  if (period === "monthly") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  const days = period === "weekly" ? 7 : 14;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1), 12, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function generateTimeSheetsFromClock(
  clockEntries: ClockEntryForSchedule[],
  projects: SchedProject[]
): TimeSheetForSchedule[] {
  const byEmployeeWeek = new Map<string, ClockEntryForSchedule[]>();
  for (const e of clockEntries) {
    if (!e.clockOut) continue;
    const weekStart = getWeekStart(e.date);
    const key = `${e.employeeId}|${weekStart}`;
    if (!byEmployeeWeek.has(key)) byEmployeeWeek.set(key, []);
    byEmployeeWeek.get(key)!.push(e);
  }
  const sheets: TimeSheetForSchedule[] = [];
  byEmployeeWeek.forEach((entries, key) => {
    const [employeeId, weekStart] = key.split("|");
    const weekEnd = getWeekEnd(weekStart);
    const timeEntries: TimeEntryForSchedule[] = entries.map((e) => {
      const hoursWorked = hoursBetween(e.clockIn, e.clockOut!);
      const proj = projects.find((p) => p.id === e.projectId);
      return {
        id: e.id,
        date: e.date,
        clockIn: e.clockIn,
        clockOut: e.clockOut,
        projectId: e.projectId,
        projectName: proj?.name,
        hoursWorked,
        locationAlert: e.locationAlert,
        locationAlertMeters: e.locationAlertMeters,
        hadPendingCerts: e.hadPendingCerts,
      };
    });
    const totalHours = timeEntries.reduce((s, x) => s + x.hoursWorked, 0);
    const regularHours = Math.min(40, totalHours);
    const overtimeHours = Math.max(0, totalHours - 40);
    sheets.push({
      id: `ts-${key}`,
      employeeId,
      weekStart,
      weekEnd,
      totalHours,
      regularHours,
      overtimeHours,
      entries: timeEntries.sort((a, b) => a.date.localeCompare(b.date)),
      status: "pending",
    });
  });
  return sheets.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

function TimesheetsView({
  clockEntries,
  employees,
  projects,
  currentUserEmployeeId,
  viewAll,
  labels,
  employeeLabels = {},
  companyName = "",
  companyIdFallback = "",
  dateLocale = "es-ES",
  timeZone: sheetTz,
}: {
  clockEntries: ClockEntryForSchedule[];
  employees: SchedEmployee[];
  projects: SchedProject[];
  currentUserEmployeeId?: string;
  viewAll: boolean;
  labels: ScheduleModuleProps["labels"];
  employeeLabels?: Record<string, string>;
  companyName?: string;
  companyIdFallback?: string;
  dateLocale?: string;
  timeZone?: string;
}) {
  const { showToast } = useToast();
  const tz = sheetTz ?? resolveUserTimezone(null);
  const [periodType, setPeriodType] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [sheetStatus, setSheetStatus] = useState<Record<string, { status: "approved" | "rejected"; notes?: string }>>({});
  const [notesDraft, setNotesDraft] = useState("");

  const sheets = useMemo(() => {
    let list = generateTimeSheetsFromClock(clockEntries, projects);
    if (!viewAll && currentUserEmployeeId) {
      list = list.filter((s) => s.employeeId === currentUserEmployeeId);
    }
    if (selectedEmployeeId) {
      list = list.filter((s) => s.employeeId === selectedEmployeeId);
    }
    return list;
  }, [clockEntries, projects, viewAll, currentUserEmployeeId, selectedEmployeeId]);

  const selectedSheet = selectedSheetId ? sheets.find((s) => s.id === selectedSheetId) : null;
  const effectiveStatus = (sheet: TimeSheetForSchedule) =>
    sheetStatus[sheet.id]?.status ?? sheet.status;

  const CIRCLE_R = 20;
  const CIRCLE_C = 2 * Math.PI * CIRCLE_R;

  const getEmployeeName = (id: string) =>
    employeeLabels[id] || employees.find((e) => e.id === id)?.name || id;

  const exportTimesheetsCsv = () => {
    const lx = labels as Record<string, string>;
    try {
      const minD = minYmdForTimesheetPeriod(periodType);
      const headers = [
        lx.personnel ?? "Employee",
        lx.date ?? "Date",
        lx.hours ?? "Hours",
        lx.project ?? "Project",
        labels.pending ?? "Status",
      ];
      const lines = [headers.map((h) => csvCell(h)).join(",")];
      for (const sheet of sheets) {
        const status = effectiveStatus(sheet);
        const statusLabel =
          status === "approved"
            ? (labels.approved ?? status)
            : status === "rejected"
              ? (labels.rejected ?? status)
              : (labels.pending ?? status);
        for (const ent of sheet.entries) {
          if (ent.date < minD) continue;
          lines.push(
            [
              csvCell(getEmployeeName(sheet.employeeId)),
              csvCell(formatCalendarYmd(ent.date, dateLocale, tz)),
              csvCell(String(ent.hoursWorked)),
              csvCell(ent.projectName ?? "—"),
              csvCell(statusLabel),
            ].join(",")
          );
        }
      }
      const slug = fileSlugCompany(companyName, companyIdFallback || "co");
      downloadCsvUtf8(`hojas_horas_${slug}_${filenameDateYmd()}.csv`, lines);
      showToast("success", lx.export_success ?? "Export completed");
    } catch {
      showToast("error", lx.export_error ?? "Export error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {labels.weekly ?? "Semanal"} / {labels.biweekly ?? "Quincenal"} / {labels.monthly ?? "Mensual"}
        </span>
        {["weekly", "biweekly", "monthly"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriodType(p as "weekly" | "biweekly" | "monthly")}
            className={`rounded-lg border px-3 py-2 text-sm min-h-[44px] ${
              periodType === p
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                : "border-zinc-200 dark:border-slate-700 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {p === "weekly" ? (labels.weekly ?? "Semanal") : p === "biweekly" ? (labels.biweekly ?? "Quincenal") : (labels.monthly ?? "Mensual")}
          </button>
        ))}
        {viewAll && (
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full min-h-[44px] max-w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm sm:w-auto sm:max-w-none"
          >
            <option value="">{(labels as Record<string, string>).personnel ?? "Todos"}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {employeeLabels[e.id] || e.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => exportTimesheetsCsv()}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-slate-700 px-3 py-2 text-sm font-medium min-h-[44px] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-slate-800"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {(labels as Record<string, string>).export_timesheets ??
            (labels as Record<string, string>).export_csv ??
            "CSV"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sheets.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 col-span-full">
            {(labels as Record<string, string>).empty_state_timesheets ?? labels.noEntries ?? ""}
          </p>
        ) : (
          sheets.map((sheet) => {
            const status = effectiveStatus(sheet);
            const progress = Math.min(sheet.totalHours / 40, 1);
            const dashOffset = CIRCLE_C * (1 - progress);
            const strokeColor = sheet.totalHours > 40 ? "#ef4444" : "#f59e0b";
            return (
              <div
                key={sheet.id}
                role="button"
                tabIndex={0}
                onClick={() => { setSelectedSheetId(sheet.id); setNotesDraft(sheetStatus[sheet.id]?.notes ?? ""); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setSelectedSheetId(sheet.id); setNotesDraft(sheetStatus[sheet.id]?.notes ?? ""); } }}
                className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <p className="font-semibold text-zinc-900 dark:text-white">{getEmployeeName(sheet.employeeId)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{sheet.weekStart} – {sheet.weekEnd}</p>
                <div className="flex items-center gap-4 mt-3">
                  <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
                    <circle cx="28" cy="28" r={CIRCLE_R} fill="none" stroke="#e5e7eb" strokeWidth="4" />
                    <circle
                      cx="28"
                      cy="28"
                      r={CIRCLE_R}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="4"
                      strokeDasharray={CIRCLE_C}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 28 28)"
                    />
                    <text x="28" y="32" textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" className="text-zinc-900 dark:text-zinc-100">
                      {sheet.totalHours}h
                    </text>
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{labels.regularHours ?? "Horas regulares"}: {sheet.regularHours}h</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{labels.overtimeHours ?? "Horas extra"}: {sheet.overtimeHours}h</p>
                    <span className={`inline-flex mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {status === "approved" ? (labels.approved ?? "Aprobado") : status === "rejected" ? (labels.rejected ?? "Rechazado") : (labels.pending ?? "Pendiente")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedSheet && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={() => setSelectedSheetId(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(95vw,calc(100%-2rem))] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl max-h-[90vh] overflow-y-auto sm:p-6">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h3 className="min-w-0 text-base font-semibold text-zinc-900 dark:text-white sm:text-lg">
                {getEmployeeName(selectedSheet.employeeId)} · {selectedSheet.weekStart} – {selectedSheet.weekEnd}
              </h3>
              <button type="button" onClick={() => setSelectedSheetId(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left py-2 font-medium text-zinc-700 dark:text-zinc-300">{(labels as Record<string, string>).date ?? "Fecha"}</th>
                  <th className="text-left py-2 font-medium text-zinc-700 dark:text-zinc-300">{(labels as Record<string, string>).project ?? "Proyecto"}</th>
                  <th className="text-left py-2 font-medium text-zinc-700 dark:text-zinc-300">{labels.clockInEntry ?? "Entrada"}</th>
                  <th className="text-left py-2 font-medium text-zinc-700 dark:text-zinc-300">{labels.clockOutEntry ?? "Salida"}</th>
                  <th className="text-right py-2 font-medium text-zinc-700 dark:text-zinc-300">{(labels as Record<string, string>).hours ?? "Horas"}</th>
                </tr>
              </thead>
              <tbody>
                {selectedSheet.entries.map((ent) => (
                  <tr key={ent.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">{ent.date}</td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">
                      <span>{ent.projectName ?? "—"}</span>
                      {(ent.locationAlert ?? ent.hadPendingCerts) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ent.locationAlert && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              {(labels as Record<string, string>).outsideZone ?? "Fuera de zona"}
                              {ent.locationAlertMeters != null && ` (${ent.locationAlertMeters}m)`}
                            </span>
                          )}
                          {ent.hadPendingCerts && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              {(labels as Record<string, string>).pendingCertsAtClockIn ?? "Certs pendientes al fichar"}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2">{formatTimeHm(ent.clockIn, dateLocale, tz)}</td>
                    <td className="py-2">{ent.clockOut ? formatTimeHm(ent.clockOut, dateLocale, tz) : "—"}</td>
                    <td className="py-2 text-right font-medium">{ent.hoursWorked.toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">
              Total: {selectedSheet.totalHours.toFixed(1)}h ({labels.regularHours ?? "Reg."}: {selectedSheet.regularHours.toFixed(1)}h, {labels.overtimeHours ?? "Extra"}: {selectedSheet.overtimeHours.toFixed(1)}h)
            </p>
            {viewAll && (
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notas</label>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={2}
                  className="w-full max-w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSheetStatus((s) => ({ ...s, [selectedSheet.id]: { status: "approved", notes: notesDraft } }));
                      setSelectedSheetId(null);
                    }}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-medium min-h-[44px]"
                  >
                    {labels.approve ?? "Aprobar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSheetStatus((s) => ({ ...s, [selectedSheet.id]: { status: "rejected", notes: notesDraft } }));
                      setSelectedSheetId(null);
                    }}
                    className="rounded-lg bg-red-600 hover:bg-red-500 text-white px-4 py-2 text-sm font-medium min-h-[44px]"
                  >
                    {labels.reject ?? "Rechazar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ScheduleModule({
  entries,
  employees,
  projects,
  currentUserEmployeeId,
  canWrite,
  canClockIn = false,
  viewAll,
  labels,
  canApproveVacations = false,
  canRequestVacation = false,
  vacationRequests = [],
  vacationEmployeeNames = {},
  onApproveVacation,
  onRejectVacation,
  onRequestVacation,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  clockEntries = [],
  clockInProjectCode = "",
  setClockInProjectCode,
  gpsStatus = "idle",
  clockInAlertMessage = null,
  onDismissClockInAlert,
  onClockIn,
  onClockOut,
  assignedClockInProjects = [],
  customRoles = [],
  employeeLabels = {},
  scheduleSelfIds = [],
  onOpenMyShiftView,
  dateLocale = "es-ES",
  timeZone: scheduleTimeZoneProp,
  companyName = "",
  companyId = "",
}: ScheduleModuleProps) {
  const lx = labels as Record<string, string>;
  const scheduleTz = scheduleTimeZoneProp ?? resolveUserTimezone(null);
  void useMachinProDisplayPrefs();
  const wallClockLabel = (s: string) =>
    /^\d{1,2}:\d{2}$/.test(String(s).trim()) ? formatTimeHm(s, dateLocale, scheduleTz) : s;
  const today = new Date();
  const todayYmd = toYMD(today);
  const todayEntry = clockEntries.find(
    (e) =>
      e.employeeId === (currentUserEmployeeId ?? "") &&
      e.date === todayYmd
  );
  const [scheduleSubTab, setScheduleSubTab] = useState<
    "calendar" | "timesheets" | "vacations"
  >("calendar");
  const showVacationsTab = canRequestVacation || canApproveVacations;
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [deleteConfirmEntryId, setDeleteConfirmEntryId] = useState<string | null>(null);
  const [clockInManualNeeded, setClockInManualNeeded] = useState(true);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };
  const goToToday = () => {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setSelectedDay(todayYmd);
  };

  const [fType, setFType] = useState<"shift" | "event">("shift");
  const [fEmployeeIds, setFEmployeeIds] = useState<string[]>([]);
  const [formEmployeeSearch, setFormEmployeeSearch] = useState("");
  const [formRoleFilterKey, setFormRoleFilterKey] = useState<string>("all");
  const [fProjectId, setFProjectId] = useState("");
  const [{ dates: fDates, rangeAnchor: shiftFormRangeAnchorYmd }, dispatchShiftFormDates] = useReducer(
    reduceShiftFormDates,
    undefined,
    (): ShiftFormDatesState => ({ dates: [toYMD(today)], rangeAnchor: null })
  );
  /** Mes visible del calendario del formulario (sustituye formPickerMonth/Year). */
  const [shiftFormCalMonth, setShiftFormCalMonth] = useState(() => today.getMonth());
  const [shiftFormCalYear, setShiftFormCalYear] = useState(() => today.getFullYear());
  const [fStart, setFStart] = useState("07:00");
  const [fEnd, setFEnd] = useState("16:00");
  const [fNotes, setFNotes] = useState("");
  const [fLabel, setFLabel] = useState("meeting");
  const [vacReqStart, setVacReqStart] = useState("");
  const [vacReqEnd, setVacReqEnd] = useState("");
  const [vacReqNote, setVacReqNote] = useState("");
  const [vacAdminComment, setVacAdminComment] = useState<Record<string, string>>({});

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const shiftFormCalendarDays = useMemo(
    () => getCalendarDays(shiftFormCalYear, shiftFormCalMonth),
    [shiftFormCalYear, shiftFormCalMonth]
  );

  const monthNameKey = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][viewMonth] as keyof typeof labels;
  const monthName =
    (labels[monthNameKey] as string) ??
    new Intl.DateTimeFormat(dateLocale, { timeZone: scheduleTz, month: "long" }).format(new Date(viewYear, viewMonth, 1));

  const shiftFormCalMonthNameKey = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ][shiftFormCalMonth] as keyof typeof labels;
  const shiftFormCalMonthName =
    (labels[shiftFormCalMonthNameKey] as string) ??
    new Intl.DateTimeFormat(dateLocale, { timeZone: scheduleTz, month: "long" }).format(
      new Date(shiftFormCalYear, shiftFormCalMonth, 1)
    );

  const visibleEntries = useMemo(() => {
    if (viewAll) return entries;
    return entries.filter((e) =>
      (e.employeeIds ?? []).includes(currentUserEmployeeId ?? "")
    );
  }, [entries, viewAll, currentUserEmployeeId]);

  const entriesForDay = (ymd: string) =>
    visibleEntries.filter((e) => e.date === ymd);

  const getProject = (id?: string) => projects.find((p) => p.id === id);
  const getEmployee = (id: string) => employees.find((e) => e.id === id);
  const resolveSchedulePerson = useCallback(
    (id: string) => employeeLabels[id] ?? getEmployee(id)?.name ?? id,
    [employeeLabels, employees]
  );
  const formatEntryAssignees = useCallback(
    (entry: SchedEntry) =>
      (entry.employeeIds ?? []).map((id) => resolveSchedulePerson(id)).filter(Boolean).join(", "),
    [resolveSchedulePerson]
  );

  const isSelfShift = useCallback(
    (entry: SchedEntry) =>
      entry.type === "shift" &&
      scheduleSelfIds.length > 0 &&
      (entry.employeeIds ?? []).some((id) => scheduleSelfIds.includes(id)),
    [scheduleSelfIds]
  );

  const mapsUrl = (proj: SchedProject) =>
    proj.locationLat != null && proj.locationLng != null
      ? `https://maps.google.com/?q=${proj.locationLat},${proj.locationLng}`
      : `https://maps.google.com/?q=${encodeURIComponent(proj.location ?? proj.name)}`;

  const toggleEmployee = (id: string) =>
    setFEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  /** "Todos" + roles custom deduplicados por nombre (sin chips legacy duplicados). */
  const roleChips = useMemo(() => {
    const l = labels as Record<string, string>;
    const grouped = new Map<string, { label: string; matchingCustomRoleIds: string[] }>();
    for (const r of customRoles) {
      const label = r.name.trim();
      if (!label) continue;
      const k = label.toLowerCase();
      const g = grouped.get(k);
      if (g) {
        if (!g.matchingCustomRoleIds.includes(r.id)) g.matchingCustomRoleIds.push(r.id);
      } else {
        grouped.set(k, { label, matchingCustomRoleIds: [r.id] });
      }
    }
    const chips: { key: string; label: string; matchingCustomRoleIds: string[] }[] = [
      { key: "all", label: l.whFilterAll ?? "Todos", matchingCustomRoleIds: [] },
    ];
    const sortedKeys = [...grouped.keys()].sort((a, b) =>
      (grouped.get(a)!.label ?? "").localeCompare(grouped.get(b)!.label ?? "", undefined, {
        sensitivity: "base",
      })
    );
    for (const k of sortedKeys) {
      const g = grouped.get(k)!;
      chips.push({ key: `g:${k}`, label: g.label, matchingCustomRoleIds: g.matchingCustomRoleIds });
    }
    return chips;
  }, [labels, customRoles]);

  useEffect(() => {
    if (!roleChips.some((c) => c.key === formRoleFilterKey)) setFormRoleFilterKey("all");
  }, [roleChips, formRoleFilterKey]);

  const activeRoleChip = useMemo(
    () => roleChips.find((c) => c.key === formRoleFilterKey) ?? roleChips[0]!,
    [roleChips, formRoleFilterKey]
  );

  const scheduleEmployeeRoleLabel = useCallback(
    (emp: SchedEmployee) => {
      const l = labels as Record<string, string>;
      const key = emp.scheduleRoleKey ?? "";
      if (key.startsWith("custom:")) {
        const id = key.slice("custom:".length);
        const cr = customRoles.find((r) => r.id === id);
        return (cr?.name ?? emp.role ?? "").trim() || "—";
      }
      if (key === "admin") return (l.admin ?? emp.role ?? "").trim() || "—";
      if (key === "supervisor") return (l.supervisor ?? emp.role ?? "").trim() || "—";
      if (key === "logistic") return (l.logistic ?? emp.role ?? "").trim() || "—";
      if (key === "worker") return (l.worker ?? emp.role ?? "").trim() || "—";
      return (emp.role ?? "").trim() || "—";
    },
    [customRoles, labels]
  );

  const employeeMatchesRoleChip = (emp: SchedEmployee, chip: (typeof roleChips)[0]) => {
    if (chip.key === "all") return true;
    const srk = emp.scheduleRoleKey ?? "";
    if (!srk.startsWith("custom:")) return false;
    const rid = srk.slice("custom:".length);
    return chip.matchingCustomRoleIds.includes(rid);
  };

  const filteredFormEmployees = useMemo(() => {
    const q = formEmployeeSearch.trim().toLowerCase();
    return employees.filter((emp) => {
      if (!employeeMatchesRoleChip(emp, activeRoleChip)) return false;
      if (!q) return true;
      const name = (emp.name ?? "").toLowerCase();
      const roleRaw = (emp.role ?? "").toLowerCase();
      const roleLbl = scheduleEmployeeRoleLabel(emp).toLowerCase();
      return name.includes(q) || roleRaw.includes(q) || roleLbl.includes(q);
    });
  }, [employees, formEmployeeSearch, activeRoleChip, scheduleEmployeeRoleLabel]);

  const addFilteredEmployeesToSelection = useCallback(() => {
    setFEmployeeIds((prev) => {
      const s = new Set(prev);
      for (const e of filteredFormEmployees) s.add(e.id);
      return [...s];
    });
  }, [filteredFormEmployees]);

  const resetForm = () => {
    setFType("shift");
    setFEmployeeIds([]);
    setFProjectId("");
    dispatchShiftFormDates({ type: "replace", dates: [toYMD(today)] });
    setShiftFormCalMonth(today.getMonth());
    setShiftFormCalYear(today.getFullYear());
    setFStart("07:00");
    setFEnd("16:00");
    setFNotes("");
    setFLabel("meeting");
    setFormEmployeeSearch("");
    setFormRoleFilterKey("all");
    setFormOpen(false);
    setEditingEntryId(null);
  };

  const openEditForm = (entry: SchedEntry) => {
    if (entry.type === "vacation") return;
    setFType(entry.type === "event" ? "event" : "shift");
    setFEmployeeIds([...entry.employeeIds]);
    setFProjectId(entry.projectId ?? "");
    dispatchShiftFormDates({ type: "replace", dates: [entry.date] });
    const ed = parseYmdToLocalDate(entry.date);
    setShiftFormCalMonth(ed.getMonth());
    setShiftFormCalYear(ed.getFullYear());
    setFStart(entry.startTime);
    setFEnd(entry.endTime);
    setFNotes(entry.notes ?? "");
    setFLabel(entry.eventLabel ?? "meeting");
    setFormEmployeeSearch("");
    setFormRoleFilterKey("all");
    setEditingEntryId(entry.id);
    setFormOpen(true);
  };

  const shiftFormCalPrevMonth = () => {
    dispatchShiftFormDates({ type: "discard_anchor" });
    if (shiftFormCalMonth === 0) {
      setShiftFormCalMonth(11);
      setShiftFormCalYear((y) => y - 1);
    } else {
      setShiftFormCalMonth((m) => m - 1);
    }
  };

  const shiftFormCalNextMonth = () => {
    dispatchShiftFormDates({ type: "discard_anchor" });
    if (shiftFormCalMonth === 11) {
      setShiftFormCalMonth(0);
      setShiftFormCalYear((y) => y + 1);
    } else {
      setShiftFormCalMonth((m) => m + 1);
    }
  };

  const handleSave = () => {
    if (fEmployeeIds.length === 0) return;
    if (fType === "shift" && !fProjectId) return;

    const uniqueDates = [...new Set(fDates)].filter(Boolean).sort();
    if (uniqueDates.length === 0) return;

    const proj = projects.find((p) => p.id === fProjectId);
    const basePayload = {
      type: fType,
      employeeIds: fEmployeeIds,
      projectId: fType === "shift" ? fProjectId : undefined,
      projectCode: fType === "shift" ? proj?.projectCode : undefined,
      startTime: fStart,
      endTime: fEnd,
      notes: fNotes || undefined,
      eventLabel: fType === "event" ? fLabel : undefined,
      createdBy: currentUserEmployeeId ?? "admin",
    };
    if (editingEntryId) {
      onUpdateEntry?.(editingEntryId, { ...basePayload, date: uniqueDates[0]! });
    } else {
      for (const date of uniqueDates) {
        onAddEntry?.({ ...basePayload, date });
      }
    }
    resetForm();
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmEntryId) {
      onDeleteEntry?.(deleteConfirmEntryId);
      setDeleteConfirmEntryId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          {labels.schedule ?? ALL_TRANSLATIONS.en.schedule}
        </h2>
        {canWrite && scheduleSubTab === "calendar" && (
          <button
            type="button"
            onClick={() => {
              setEditingEntryId(null);
              dispatchShiftFormDates({ type: "replace", dates: [toYMD(today)] });
              setShiftFormCalMonth(today.getMonth());
              setShiftFormCalYear(today.getFullYear());
              setFormEmployeeSearch("");
              setFormRoleFilterKey("all");
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-600 dark:bg-amber-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-amber-500 min-h-[44px] min-w-[44px]"
          >
            <Plus className="h-4 w-4" />
            {labels.addEntry ?? "Añadir turno"}
          </button>
        )}
      </div>

      <HorizontalScrollFade
        className="border-b border-zinc-200 dark:border-zinc-700"
        variant="inherit"
      >
        <div
          className="flex flex-nowrap gap-2 overflow-x-auto pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0"
          role="tablist"
          aria-label={labels.schedule ?? ALL_TRANSLATIONS.en.schedule}
        >
          <button
            type="button"
            role="tab"
            aria-selected={scheduleSubTab === "calendar"}
            onClick={() => setScheduleSubTab("calendar")}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium min-h-[44px] border-b-2 transition-colors ${
              scheduleSubTab === "calendar"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {labels.schedule_tab_calendar ?? ALL_TRANSLATIONS.en.schedule_tab_calendar}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scheduleSubTab === "timesheets"}
            onClick={() => setScheduleSubTab("timesheets")}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium min-h-[44px] border-b-2 transition-colors ${
              scheduleSubTab === "timesheets"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {labels.timesheets ?? "Hojas de horas"}
          </button>
          {showVacationsTab ? (
            <button
              type="button"
              role="tab"
              aria-selected={scheduleSubTab === "vacations"}
              onClick={() => setScheduleSubTab("vacations")}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium min-h-[44px] border-b-2 transition-colors ${
                scheduleSubTab === "vacations"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {lx.schedule_tab_vacations ?? lx.schedule_type_vacation ?? lx.schedule_vacation_request ?? "Vacaciones"}
            </button>
          ) : null}
        </div>
      </HorizontalScrollFade>

      {scheduleSubTab === "vacations" && showVacationsTab && (
        <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
          {onRequestVacation && canRequestVacation && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {(labels as Record<string, string>).schedule_vacation_request ?? "Solicitud de vacaciones"}
              </h4>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <input
                  type="date"
                  value={vacReqStart}
                  onChange={(e) => setVacReqStart(e.target.value)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px] min-w-[44px]"
                  aria-label={(labels as Record<string, string>).date ?? "Fecha inicio"}
                />
                <input
                  type="date"
                  value={vacReqEnd}
                  onChange={(e) => setVacReqEnd(e.target.value)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px] min-w-[44px]"
                  aria-label={(labels as Record<string, string>).date ?? "Fecha fin"}
                />
                <input
                  type="text"
                  value={vacReqNote}
                  onChange={(e) => setVacReqNote(e.target.value)}
                  placeholder={(labels as Record<string, string>).schedule_vacation_comment ?? "Nota (opcional)"}
                  className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!vacReqStart || !vacReqEnd) return;
                    void onRequestVacation?.(vacReqStart, vacReqEnd, vacReqNote);
                    setVacReqNote("");
                  }}
                  className="rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-medium min-h-[44px] min-w-[44px]"
                >
                  {(labels as Record<string, string>).employees_request_vacation ?? "Solicitar vacaciones"}
                </button>
              </div>
            </div>
          )}
          {canApproveVacations && vacationRequests.filter((v) => v.status === "pending").length > 0 && (
            <div className="space-y-2 border-t border-zinc-200 dark:border-slate-700 pt-4">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {(labels as Record<string, string>).schedule_vacation_pending_list ?? "Solicitudes pendientes"}
              </h4>
              <ul className="space-y-3">
                {vacationRequests
                  .filter((v) => v.status === "pending")
                  .map((v) => (
                    <li
                      key={v.id}
                      className="rounded-lg border border-zinc-200 dark:border-slate-700 p-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
                    >
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {vacationEmployeeNames[v.user_id] ?? "—"}
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-400">
                          {v.start_date} → {v.end_date} · {v.total_days}{" "}
                          {(labels as Record<string, string>).days ?? "días"}
                        </p>
                        {v.notes ? <p className="text-xs text-zinc-500 mt-1">{v.notes}</p> : null}
                        <input
                          type="text"
                          value={vacAdminComment[v.id] ?? ""}
                          onChange={(e) =>
                            setVacAdminComment((prev) => ({ ...prev, [v.id]: e.target.value }))
                          }
                          placeholder={(labels as Record<string, string>).schedule_vacation_comment ?? "Comentario"}
                          className="mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs min-h-[44px]"
                        />
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void onApproveVacation?.(v.id, vacAdminComment[v.id] ?? "")}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-sm min-h-[44px] min-w-[44px]"
                        >
                          {labels.approve ?? "Aprobar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onRejectVacation?.(v.id, vacAdminComment[v.id] ?? "")}
                          className="rounded-lg bg-red-600 hover:bg-red-500 text-white px-3 py-2 text-sm min-h-[44px] min-w-[44px]"
                        >
                          {labels.reject ?? "Rechazar"}
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {scheduleSubTab === "calendar" && (
        <>
          <div className="mb-4 flex w-full min-w-0 flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="shrink-0 rounded-lg border border-zinc-200 dark:border-slate-700 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] sm:min-w-0"
              aria-label={labels.previousMonth ?? "Previous"}
            >
              <span className="sm:hidden" aria-hidden>
                ←
              </span>
              <span className="hidden sm:inline">
                ← {labels.previousMonth ?? "Anterior"}
              </span>
            </button>
            <h3 className="order-first w-full min-w-0 text-center text-sm font-semibold capitalize text-zinc-900 dark:text-white sm:order-none sm:flex-1 sm:text-lg sm:truncate">
              {monthName} {viewYear}
            </h3>
            <button
              type="button"
              onClick={nextMonth}
              className="shrink-0 rounded-lg border border-zinc-200 dark:border-slate-700 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] sm:min-w-0"
              aria-label={labels.nextMonth ?? "Next"}
            >
              <span className="sm:hidden" aria-hidden>
                →
              </span>
              <span className="hidden sm:inline">
                {labels.nextMonth ?? "Siguiente"} →
              </span>
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="shrink-0 rounded-lg border border-amber-300 dark:border-amber-600 px-2.5 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 min-h-[44px] min-w-[44px] sm:min-w-0"
              aria-label={labels.today ?? "Today"}
            >
              {labels.today ?? "Hoy"}
            </button>
          </div>

          <HorizontalScrollFade className="-mx-4 px-0 sm:mx-0 sm:px-0">
            <div className="w-full min-w-0 overflow-x-auto px-2 sm:overflow-visible sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0">
            <div className="grid w-full min-w-0 grid-cols-7 gap-0.5 sm:gap-1">
              {["monShort", "tueShort", "wedShort", "thuShort", "friShort", "satShort", "sunShort"].map((key, i) => (
                <div
                  key={key}
                  className="py-1 text-center text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 sm:text-xs"
                >
                  {(labels as Record<string, string>)[key] ?? "L M X J V S D".split(" ")[i]}
                </div>
              ))}
              {calendarDays.map((day) => {
                const ymd = toYMD(day);
                const isCurrentMonth = day.getMonth() === viewMonth;
                const isToday = ymd === todayYmd;
                const isSelected = selectedDay === ymd;
                const dayEntries = entriesForDay(ymd);
                const mobileExtra = dayEntries.length > 2 ? dayEntries.length - 2 : 0;
                const desktopExtra = dayEntries.length > 3 ? dayEntries.length - 3 : 0;
                const moreDesktopText =
                  desktopExtra > 0
                    ? (lx.schedule_calendar_more ?? "+{n} más").replace("{n}", String(desktopExtra))
                    : "";
                const openDayPanel = () => {
                  const dayList = entriesForDay(ymd);
                  const myShifts = !viewAll && onOpenMyShiftView ? dayList.filter(isSelfShift) : [];
                  if (myShifts.length === 1) {
                    onOpenMyShiftView!(ymd, myShifts[0]!.id);
                    return;
                  }
                  setSelectedDay(ymd);
                };
                return (
                  <div
                    key={ymd}
                    role="button"
                    tabIndex={0}
                    onClick={openDayPanel}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDayPanel();
                      }
                    }}
                    className={`rounded-lg border p-1 sm:p-2 h-[52px] min-h-[52px] sm:h-24 sm:min-h-[96px] flex flex-col gap-0.5 cursor-pointer hover:ring-2 hover:ring-amber-400/50 transition-shadow sm:rounded-xl ${
                      !isCurrentMonth ? "opacity-40" : ""
                    } ${
                      isToday
                        ? "border-amber-400 dark:border-amber-500 bg-amber-500/10 dark:bg-amber-900/10"
                        : isSelected
                          ? "border-amber-500 dark:border-amber-400 shadow-md ring-1 ring-amber-400/50"
                          : "border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <p className={`text-xs font-semibold shrink-0 ${isToday ? "text-amber-600 dark:text-amber-400" : "text-zinc-600 dark:text-zinc-400"}`}>
                      {day.getDate()}
                    </p>
                    <div className="flex min-h-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden">
                      <div className="flex flex-wrap items-center justify-center gap-1 sm:hidden">
                        {dayEntries.slice(0, 2).map((entry) => (
                          <span
                            key={entry.id}
                            className={`h-2 w-2 shrink-0 rounded-full ${entryDotClass(entry)}`}
                            aria-hidden
                          />
                        ))}
                        {mobileExtra > 0 && (
                          <span className="text-[10px] font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
                            +{mobileExtra}
                          </span>
                        )}
                      </div>
                      <div className="hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                        {dayEntries.slice(0, 3).map((entry) => {
                          const proj = getProject(entry.projectId);
                          const pillText = calendarCellPillLabel(entry, proj, lx, wallClockLabel);
                          return (
                            <div
                              key={entry.id}
                              role={!viewAll && onOpenMyShiftView && isSelfShift(entry) ? "button" : undefined}
                              tabIndex={!viewAll && onOpenMyShiftView && isSelfShift(entry) ? 0 : undefined}
                              onClick={(e) => {
                                if (!viewAll && onOpenMyShiftView && isSelfShift(entry)) {
                                  e.stopPropagation();
                                  onOpenMyShiftView(ymd, entry.id);
                                }
                              }}
                              onKeyDown={
                                !viewAll && onOpenMyShiftView && isSelfShift(entry)
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onOpenMyShiftView(ymd, entry.id);
                                      }
                                    }
                                  : undefined
                              }
                              className={`min-w-0 truncate rounded px-1 py-0.5 text-[10px] leading-tight ${entryColor(entry)}`}
                              title={`${entry.startTime}–${entry.endTime} ${pillText}`}
                            >
                              {pillText}
                            </div>
                          );
                        })}
                        {desktopExtra > 0 && (
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{moreDesktopText}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </HorizontalScrollFade>

          <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            {[
              { key: "shift", label: lx.schedule_type_shift ?? labels.shift ?? "Turno" },
              { key: "meeting", label: lx.schedule_type_meeting ?? lx.schedule_legend_meeting ?? "Reunión" },
              { key: "company_event", label: lx.schedule_event_company ?? "Evento empresa" },
              { key: "collective_off", label: lx.schedule_type_collective_off ?? lx.schedule_day_off_collective ?? "Festivo" },
              { key: "vacation", label: lx.schedule_type_vacation ?? lx.schedule_vacation_request ?? "Vacaciones" },
              { key: "personal_leave", label: lx.schedule_type_personal ?? lx.schedule_personal_leave ?? "Día libre" },
              { key: "training", label: lx.schedule_type_training ?? lx.schedule_legend_training ?? "Formación" },
              { key: "other", label: lx.common_other ?? "Otro" },
            ].map(({ key, label }) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded border inline-block ${EVENT_COLORS[key]}`} />
                {label}
              </span>
            ))}
          </div>
        </>
      )}

      {scheduleSubTab === "timesheets" && (
        <TimesheetsView
          clockEntries={clockEntries}
          employees={employees}
          projects={projects}
          currentUserEmployeeId={currentUserEmployeeId ?? undefined}
          viewAll={viewAll}
          labels={labels}
          employeeLabels={employeeLabels}
          companyName={companyName}
          companyIdFallback={companyId}
          dateLocale={dateLocale}
          timeZone={scheduleTz}
        />
      )}

      {selectedDay !== null && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 touch-none"
            aria-hidden
            onClick={() => setSelectedDay(null)}
          />
          <div className="fixed z-50 inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 shadow-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:bottom-auto sm:max-w-md sm:rounded-none sm:rounded-l-2xl sm:max-h-full">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {new Intl.DateTimeFormat(dateLocale, {
                  timeZone: scheduleTz,
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date(`${selectedDay}T12:00:00`))}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {entriesForDay(selectedDay).length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                  {(labels as Record<string, string>).schedule_no_shifts_day ??
                    labels.noEntries ??
                    "No shifts on this day"}
                </p>
              ) : (
                <ul className="space-y-3">
                  {[...entriesForDay(selectedDay)]
                    .sort(
                      (a, b) =>
                        a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
                    )
                    .map((entry) => {
                    const proj = getProject(entry.projectId);
                    return (
                      <li
                        key={entry.id}
                        className={`rounded-xl border p-4 ${entryColor(entry)}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {entry.type === "shift" && (proj?.name || entry.projectCode) && (
                              <p className="flex items-center gap-1.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                                <Briefcase className="h-4 w-4 shrink-0" />
                                <span className="truncate">{proj?.name ?? entry.projectCode}</span>
                              </p>
                            )}
                            <p
                              className={`font-medium text-zinc-800 dark:text-zinc-200 ${
                                entry.type === "shift" && (proj?.name || entry.projectCode)
                                  ? "mt-1 text-sm"
                                  : "text-base font-semibold text-zinc-900 dark:text-zinc-100"
                              }`}
                            >
                              {formatTimeHm(entry.startTime, dateLocale, scheduleTz)} →{" "}
                              {formatTimeHm(entry.endTime, dateLocale, scheduleTz)}
                            </p>
                            {entry.type !== "shift" && (
                              <p className="mt-1 text-sm">
                                {entry.notes?.trim()
                                  ? `${scheduleEntryTypeLabel(entry, lx)} — ${entry.notes}`
                                  : scheduleEntryTypeLabel(entry, lx)}
                              </p>
                            )}
                          </div>
                          {canWrite && entry.type !== "vacation" && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openEditForm(entry); }}
                                className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                title={labels.editEntry ?? "Editar turno"}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmEntryId(entry.id); }}
                                className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                title={labels["delete"] ?? "Eliminar"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          {formatEntryAssignees(entry)}
                        </p>
                        {entry.notes && entry.type === "shift" && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                            {entry.notes}
                          </p>
                        )}
                        {entry.type === "shift" && proj && (proj.locationLat != null || proj.location) && (
                          <a
                            href={mapsUrl(proj)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline min-h-[44px] items-center"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            {(labels as Record<string, string>).openInMaps ?? "Maps"}
                          </a>
                        )}
                        {!viewAll && onOpenMyShiftView && isSelfShift(entry) && selectedDay && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenMyShiftView(selectedDay, entry.id);
                              setSelectedDay(null);
                            }}
                            className="mt-3 w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold"
                          >
                            {(labels as Record<string, string>).viewMyShift ?? "Ver mi jornada"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {selectedDay === todayYmd && canClockIn && (
                <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-slate-700 space-y-4">
                  <h4 className="text-base font-semibold text-zinc-900 dark:text-white">
                    {labels.clockInTitle ?? "Fichaje de hoy"}
                  </h4>
                  {todayEntry && (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ✓ {labels.clockInEntry ?? "Entrada"}: {wallClockLabel(todayEntry.clockIn)}
                      </span>
                      {todayEntry.clockOut && (
                        <span className="text-zinc-500 dark:text-zinc-400">
                          · {labels.clockOutEntry ?? "Salida"}: {wallClockLabel(todayEntry.clockOut)}
                        </span>
                      )}
                      {todayEntry.locationAlert && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {(labels as Record<string, string>).outsideZone ?? "Fuera de zona"}
                          {todayEntry.locationAlertMeters != null && ` (${Math.round(todayEntry.locationAlertMeters)}m)`}
                        </span>
                      )}
                      {todayEntry.hadPendingCerts && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {(labels as Record<string, string>).pendingCertsAtClockIn ?? "Certs pendientes al fichar"}
                        </span>
                      )}
                    </div>
                  )}
                  {!todayEntry && setClockInProjectCode && (
                    <>
                      <ClockInProjectPicker
                        lx={lx}
                        assignedProjects={assignedClockInProjects}
                        clockInProjectCode={clockInProjectCode}
                        setClockInProjectCode={setClockInProjectCode}
                        onSelectProjectClockIn={(p) =>
                          onClockIn?.({
                            projectId: p.id,
                            projectCode: p.projectCode,
                          })
                        }
                        onManualClockInNeededChange={setClockInManualNeeded}
                      />
                      {clockInManualNeeded && clockInProjectCode ? (
                        (() => {
                          const found = projects.find(
                            (p) =>
                              (p.projectCode ?? "").toUpperCase() ===
                              clockInProjectCode.trim().toUpperCase()
                          );
                          return found ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 -mt-1">
                              ✓ {found.name}
                            </p>
                          ) : (
                            <p className="text-xs text-red-500 dark:text-red-400 -mt-1">
                              {labels.projectCodeNotFound ?? "Código no encontrado"}
                            </p>
                          );
                        })()
                      ) : null}
                    </>
                  )}
                  <div className="grid grid-cols-1 gap-3 place-items-center max-md:w-full">
                    {!todayEntry ? (
                      clockInManualNeeded ? (
                        <button
                          type="button"
                          onClick={() => onClockIn?.()}
                          disabled={gpsStatus === "locating"}
                          className="flex h-20 w-20 max-w-full items-center justify-center rounded-full bg-emerald-600 text-center text-sm font-semibold leading-tight text-white transition-colors hover:bg-emerald-500 disabled:opacity-60 md:h-14 md:w-full md:rounded-2xl md:text-base"
                        >
                          {gpsStatus === "locating"
                            ? (labels.gpsLocating ?? "Obteniendo ubicación…")
                            : (labels.clockIn ?? "Fichar Entrada")}
                        </button>
                      ) : null
                    ) : !todayEntry.clockOut ? (
                      <button
                        type="button"
                        onClick={onClockOut}
                        disabled={gpsStatus === "locating"}
                        className="flex h-20 w-20 max-w-full items-center justify-center rounded-full bg-red-500 text-center text-sm font-semibold leading-tight text-white transition-colors hover:bg-red-600 disabled:opacity-60 md:h-14 md:w-full md:rounded-2xl md:text-base"
                      >
                        {gpsStatus === "locating"
                          ? (labels.gpsLocating ?? "Obteniendo ubicación…")
                          : (labels.clockOut ?? "Fichar Salida")}
                      </button>
                    ) : (
                      <div className="flex min-h-[3.5rem] w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-3 text-center font-semibold text-emerald-600 dark:bg-zinc-800 dark:text-emerald-400 md:min-h-[3.5rem]">
                        ✓ {labels.clockInDone ?? "Jornada completada"}
                      </div>
                    )}
                  </div>
                  {clockInAlertMessage && (
                    <div className="rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start justify-between gap-2">
                      <p className="text-sm text-amber-800 dark:text-amber-200">{clockInAlertMessage}</p>
                      {onDismissClockInAlert && (
                        <button
                          type="button"
                          onClick={onDismissClockInAlert}
                          className="shrink-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-lg leading-none hover:bg-amber-200/50 dark:hover:bg-amber-800/30 text-amber-700 dark:text-amber-300"
                          aria-label={(labels as Record<string, string>).common_close ?? "Close"}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}
                  {gpsStatus === "no_gps" && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {labels.gpsNoGps ?? "GPS no disponible — fichaje registrado sin ubicación"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {formOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 touch-none"
            aria-hidden
            onClick={resetForm}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(95vw,calc(100%-2rem))] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xl max-h-[min(90dvh,90vh)] overflow-y-auto max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:left-0 max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl max-md:pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {editingEntryId
                  ? (labels.editEntry ?? "Editar turno")
                  : (labels.addEntry ?? "Añadir turno / evento")}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(["shift", "event"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFType(t)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors min-h-[44px] ${
                      fType === t
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                        : "border-zinc-200 dark:border-slate-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {t === "shift"
                      ? (labels.shift ?? "Turno")
                      : (labels.event ?? "Evento")}
                  </button>
                ))}
              </div>

              {fType === "event" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {(labels as Record<string, string>).schedule_event_type ?? "Tipo de evento"}
                  </label>
                  <select
                    value={fLabel}
                    onChange={(e) => setFLabel(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                  >
                    <option value="meeting">{lx.schedule_type_meeting ?? lx.schedule_legend_meeting ?? "Reunión"}</option>
                    <option value="company_event">{lx.schedule_type_company ?? lx.schedule_event_company ?? "Evento empresa"}</option>
                    <option value="collective_off">{lx.schedule_type_collective_off ?? lx.schedule_day_off_collective ?? "Festivo"}</option>
                    {!(canRequestVacation && onRequestVacation) ? (
                      <option value="vacation">{lx.schedule_type_vacation ?? lx.schedule_vacation_request ?? "Vacaciones"}</option>
                    ) : null}
                    <option value="personal_leave">{lx.schedule_type_personal ?? lx.schedule_personal_leave ?? "Día libre"}</option>
                    <option value="training">{lx.schedule_type_training ?? lx.schedule_legend_training ?? "Formación"}</option>
                    <option value="other">{lx.common_other ?? "Otro"}</option>
                  </select>
                </div>
              )}

              {fType === "shift" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {(labels as Record<string, string>).project ?? "Proyecto"} *
                  </label>
                  <select
                    value={fProjectId}
                    onChange={(e) => setFProjectId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                  >
                    <option value="">Seleccionar proyecto…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode ? `[${p.projectCode}] ` : ""}
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {(labels as Record<string, string>).schedule_pick_employees ?? "Empleados"} *
                </label>
                <input
                  type="search"
                  value={formEmployeeSearch}
                  onChange={(e) => setFormEmployeeSearch(e.target.value)}
                  placeholder={(labels as Record<string, string>).schedule_search_employees ?? ""}
                  className="mb-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] placeholder:text-zinc-400"
                  autoComplete="off"
                />
                <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {(
                    (labels as Record<string, string>).schedule_selected_count ?? "{n} selected"
                  ).replace("{n}", String(fEmployeeIds.length))}
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 dark:border-slate-700 p-1.5">
                  {filteredFormEmployees.length === 0 ? (
                    <p className="px-2 py-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      {(labels as Record<string, string>).noEntries ?? ""}
                    </p>
                  ) : (
                    filteredFormEmployees.map((emp) => {
                      const initial = (emp.name?.trim()?.[0] ?? "?").toUpperCase();
                      const roleLine = scheduleEmployeeRoleLabel(emp);
                      const checked = fEmployeeIds.includes(emp.id);
                      return (
                        <label
                          key={emp.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors min-h-[44px] ${
                            checked
                              ? "border-amber-500 bg-amber-500/10 dark:border-amber-400 dark:bg-amber-500/15"
                              : "border-transparent hover:bg-zinc-50 dark:hover:bg-slate-800/80"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleEmployee(emp.id)}
                            className="h-4 w-4 shrink-0 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-800"
                          />
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-slate-700 dark:text-zinc-200">
                            {initial}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {emp.name}
                            </p>
                            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{roleLine}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="mb-1 mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={addFilteredEmployeesToSelection}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm min-h-[44px] text-zinc-700 dark:text-zinc-200"
                  >
                    {(labels as Record<string, string>).schedule_select_all ?? ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFEmployeeIds([])}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm min-h-[44px] text-zinc-700 dark:text-zinc-200"
                  >
                    {(labels as Record<string, string>).schedule_deselect_all ?? ""}
                  </button>
                </div>
                <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {(labels as Record<string, string>).schedule_filter_by_role ?? ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {roleChips.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setFormRoleFilterKey(c.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium min-h-[44px] transition-colors ${
                        formRoleFilterKey === c.key
                          ? "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-900/25 dark:text-amber-100"
                          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:text-zinc-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {fEmployeeIds.length === 0 && (
                  <p className="mt-1 text-xs text-red-500">
                    {(labels as Record<string, string>).schedule_pick_employees_error ?? ""}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {(labels as Record<string, string>).schedule_date_label ?? "Fecha"} *
                </label>
                <div className="rounded-xl border border-zinc-200 dark:border-slate-700 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={shiftFormCalPrevMonth}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-zinc-200 dark:border-slate-600"
                      aria-label={labels.previousMonth ?? "Previous"}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-center text-sm font-semibold capitalize text-zinc-900 dark:text-white">
                      {shiftFormCalMonthName} {shiftFormCalYear}
                    </span>
                    <button
                      type="button"
                      onClick={shiftFormCalNextMonth}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-zinc-200 dark:border-slate-600"
                      aria-label={labels.nextMonth ?? "Next"}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 sm:text-xs">
                    {(["monShort", "tueShort", "wedShort", "thuShort", "friShort", "satShort", "sunShort"] as const).map(
                      (key, i) => (
                        <div key={key}>{(labels as Record<string, string>)[key] ?? ["L", "M", "X", "J", "V", "S", "D"][i]}</div>
                      )
                    )}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-0.5">
                    {shiftFormCalendarDays.map((day) => {
                      const ymd = ymdFromLocalDate(day);
                      const inMonth = day.getMonth() === shiftFormCalMonth;
                      const selected = fDates.includes(ymd);
                      const isAnchor = shiftFormRangeAnchorYmd === ymd && selected;
                      return (
                        <button
                          key={`${ymd}-${day.getTime()}`}
                          type="button"
                          onClick={() => inMonth && dispatchShiftFormDates({ type: "click", ymd })}
                          disabled={!inMonth}
                          className={`flex aspect-square min-h-[36px] max-h-10 items-center justify-center rounded-lg text-xs font-medium sm:text-sm ${
                            !inMonth
                              ? "pointer-events-none opacity-30"
                              : selected
                                ? `bg-amber-500 text-white dark:bg-amber-600 ${isAnchor ? "ring-2 ring-amber-800 ring-offset-1 dark:ring-amber-300 dark:ring-offset-slate-900" : ""}`
                                : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-slate-800 dark:text-zinc-100 dark:hover:bg-slate-700"
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {(
                      (labels as Record<string, string>).schedule_days_selected ??
                      lx.schedule_dates_selected_count ??
                      "{n} día(s) seleccionado(s)"
                    ).replace("{n}", String(fDates.length))}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Inicio *
                  </label>
                  <input
                    type="time"
                    value={fStart}
                    onChange={(e) => setFStart(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Fin *
                  </label>
                  <input
                    type="time"
                    value={fEnd}
                    onChange={(e) => setFEnd(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Notas
                </label>
                <textarea
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
              >
                {labels.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  fEmployeeIds.length === 0 ||
                  (fType === "shift" && !fProjectId) ||
                  (!editingEntryId && fDates.length === 0)
                }
                className="rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
              >
                Guardar
              </button>
            </div>
          </div>
        </>
      )}

      {deleteConfirmEntryId !== null && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50"
            aria-hidden
            onClick={() => setDeleteConfirmEntryId(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <p className="text-zinc-700 dark:text-zinc-300 mb-6">
              {labels.confirmDeleteShift ?? "¿Eliminar este turno? Esta acción no se puede deshacer"}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmEntryId(null)}
                className="rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
              >
                {labels.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
              >
                {labels.delete ?? "Eliminar"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
