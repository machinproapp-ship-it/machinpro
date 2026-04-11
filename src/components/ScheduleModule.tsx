"use client";

import { useState, useMemo, useCallback, useEffect, useReducer } from "react";
import { ClockInProjectPicker, type ClockInAssignedProject } from "@/components/ClockInProjectPicker";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  MapPin,
  Users,
  X,
  Briefcase,
  Pencil,
  Trash2,
  Download,
  AlertTriangle,
} from "lucide-react";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import {
  resolveUserTimezone,
  formatCalendarYmd,
  formatTimeHm,
  formatTodayYmdInTimeZone,
  weekYmdsMondayFirstInTimeZone,
  formatCurrency,
} from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";
import { useToast } from "@/components/Toast";
import { csvCell, downloadCsvUtf8, fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";
import {
  downloadLaborReportDetailCsv,
  downloadLaborReportExecutivePdf,
  type LaborReportDetailRow,
} from "@/lib/laborReportExport";
import { hoursWorkedFromClockFields, laborCostForHours } from "@/lib/laborCosting";
import { ALL_TRANSLATIONS } from "@/lib/i18n";
import { PayrollSchedulePanel } from "@/components/PayrollSchedulePanel";
import { ProductionPayrollSchedulePanel } from "@/components/ProductionPayrollSchedulePanel";
import type { ClockEntryForSchedule } from "@/types/homePage";
import type { ProductionReport } from "@/lib/productionCatalog";

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
  archived?: boolean;
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

export type { ClockEntryForSchedule };

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
  /** Ver el panel de disponibilidad del equipo (además de permisos de horario heredados desde page). */
  canViewTeamAvailability?: boolean;
  /** Botón para añadir turno dentro del panel de disponibilidad. */
  canManageTeamAvailability?: boolean;
  canClockIn?: boolean;
  canManageEmployees?: boolean;
  currentUserProfileId?: string;
  profileToLegacyEmployeeId?: Record<string, string>;
  onManualClockIn?: (p: {
    targetUserId: string;
    date: string;
    time: string;
    projectId?: string | null;
    notes?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onManualClockOut?: (p: {
    targetUserId: string;
    timeEntryId: string;
    date: string;
    time: string;
    notes?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  viewAll: boolean;
  /** Pestaña calendario / turnos (AW: canViewSchedule). */
  canViewScheduleCalendar?: boolean;
  /** Pestaña fichaje (canViewTimeclock / equipo según canManageEmployees). */
  canViewTimeclock?: boolean;
  /** Pestaña hojas de horas (canViewTimesheets). */
  canViewTimesheets?: boolean;
  labels: {
    schedule?: string;
    schedule_tab_calendar?: string;
    clock_tab?: string;
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
    vacations_tab?: string;
    vacations_request?: string;
    vacations_pending?: string;
    vacations_approved?: string;
    vacations_rejected?: string;
    vacations_filter_employee?: string;
    vacations_filter_status?: string;
    vacations_all?: string;
    vacations_days_used?: string;
    vacations_days_remaining?: string;
    vacations_allowance_hint?: string;
    vacations_list_heading?: string;
    timesheet_weekly_summary?: string;
    timesheet_export?: string;
    timesheet_total_month?: string;
    timesheet_date_from?: string;
    timesheet_date_to?: string;
    timesheet_by_project?: string;
    labor_cost_column?: string;
    labor_cost_total?: string;
    labor_hours_worked?: string;
    labor_export_report?: string;
    labor_report_summary?: string;
    labor_cost_filter_week?: string;
    labor_cost_filter_month?: string;
    labor_cost_filter_custom?: string;
    labor_cost_by_employee?: string;
    labor_cost_by_project?: string;
    logistics_filters_toggle?: string;
    admin?: string;
    supervisor?: string;
    worker?: string;
    logistic?: string;
    whFilterAll?: string;
    openInMaps?: string;
    viewMyShift?: string;
    schedule_available?: string;
    schedule_busy?: string;
    schedule_partial?: string;
    schedule_conflict_warning?: string;
    schedule_no_project?: string;
    /** Opción vacía del selector de proyecto en turnos */
    schedule_shift_general_option?: string;
    schedule_team_availability?: string;
    schedule_this_week_btn?: string;
    schedule_prev_week?: string;
    schedule_next_week?: string;
    schedule_availability_this_week?: string;
    /** Leyenda: celda con 2+ turnos el mismo día */
    schedule_availability_2plus?: string;
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
  /** Logo empresa (PDF nómina / informes). */
  companyLogoUrl?: string;
  /** Fallback slug si no hay nombre de empresa. */
  companyId?: string;
  /** Usuario autenticado (Supabase auth id) — vacaciones y filtros “solo mis solicitudes”. */
  currentUserId?: string;
  /** AH-17 */
  canViewTimesheetCosts?: boolean;
  /** AH-19: exportar informes laborales (CSV/PDF). */
  canViewLaborCosting?: boolean;
  timesheetCostCurrency?: string;
  employeeLaborRatesByEmployeeId?: Record<string, number>;
  canViewPayroll?: boolean;
  canManagePayroll?: boolean;
  canExportPayroll?: boolean;
  companyCountryForPayroll?: string;
  productionReports?: ProductionReport[];
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

function shiftEntriesForEmployeeOnDay(
  employeeId: string,
  ymd: string,
  entries: SchedEntry[]
): SchedEntry[] {
  return entries.filter(
    (e) =>
      e.type === "shift" &&
      e.date === ymd &&
      (e.employeeIds ?? []).includes(employeeId)
  );
}

function shiftProjectLabelForEntry(entry: SchedEntry, projects: SchedProject[]): string {
  const p = projects.find((x) => x.id === entry.projectId);
  return (p?.name ?? entry.projectCode ?? "").trim() || "—";
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

const SHIFT_NO_PROJECT_PILL =
  "bg-zinc-100 text-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-100";

function shiftEntryHasProject(entry: SchedEntry): boolean {
  if (entry.type !== "shift") return true;
  return Boolean(
    String(entry.projectId ?? "").trim() || String(entry.projectCode ?? "").trim()
  );
}

function entryColor(entry: SchedEntry): string {
  if (entry.type === "shift") {
    return shiftEntryHasProject(entry) ? EVENT_COLORS.shift : SHIFT_NO_PROJECT_PILL;
  }
  if (entry.type === "vacation") return EVENT_COLORS.vacation;
  return EVENT_COLORS[entry.eventLabel ?? "other"] ?? EVENT_COLORS.other;
}

function entryDotClass(entry: SchedEntry): string {
  if (entry.type === "shift") {
    return shiftEntryHasProject(entry) ? "bg-amber-500" : "bg-zinc-400 dark:bg-zinc-500";
  }
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
    const t = `${wallClockLabel(entry.startTime)}-${wallClockLabel(entry.endTime)}`;
    if (!shiftEntryHasProject(entry)) {
      return `${lx.schedule_no_project ?? "Sin proyecto"} · ${t}`;
    }
    const name = (proj?.name ?? entry.projectCode ?? "").trim();
    const short = name.length > 12 ? `${name.slice(0, 12)}…` : name;
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

function hoursWorkedForScheduleEntry(e: ClockEntryForSchedule): number {
  return hoursWorkedFromClockFields(e);
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

function firstAndLastDayOfCurrentMonthYmd(): [string, string] {
  const n = new Date();
  const y = n.getFullYear();
  const mo = n.getMonth();
  const start = `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  const last = new Date(y, mo + 1, 0);
  const end = `${y}-${String(mo + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return [start, end];
}

const DEFAULT_ANNUAL_VACATION_DAYS = 22;

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
      const hoursWorked = hoursWorkedForScheduleEntry(e);
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

function projectNameForClockEntry(e: ClockEntryForSchedule, projects: SchedProject[]): string {
  const fromEntry = (e.projectName ?? "").trim();
  if (fromEntry) return fromEntry;
  if (e.projectId) {
    const p = projects.find((x) => x.id === e.projectId);
    if (p?.name) return p.name;
  }
  return "—";
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
  showTimesheetCosts = false,
  canViewLaborCosting = false,
  timesheetCostCurrency = "CAD",
  employeeLaborRatesByEmployeeId = {},
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
  showTimesheetCosts?: boolean;
  canViewLaborCosting?: boolean;
  timesheetCostCurrency?: string;
  employeeLaborRatesByEmployeeId?: Record<string, number>;
}) {
  const { showToast } = useToast();
  const tz = sheetTz ?? resolveUserTimezone(null);
  const lx = labels as Record<string, string>;
  const rateFor = (employeeId: string) => employeeLaborRatesByEmployeeId[employeeId] ?? null;

  const monthStartEndYmdInTzLocal = (timeZone: string): [string, string] => {
    const ymd = formatTodayYmdInTimeZone(timeZone);
    const [ys, ms] = ymd.split("-");
    const y = parseInt(ys ?? "0", 10);
    const mo = parseInt(ms ?? "1", 10);
    if (!Number.isFinite(y) || !Number.isFinite(mo)) return [ymd, ymd];
    const lastDay = new Date(y, mo, 0).getDate();
    const start = `${y}-${String(mo).padStart(2, "0")}-01`;
    const end = `${y}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return [start, end];
  };

  const applyLaborWeekRange = () => {
    const week = weekYmdsMondayFirstInTimeZone(tz, 0);
    const start = week[0];
    const end = week[week.length - 1];
    if (start && end) {
      setExportFrom(start);
      setExportTo(end);
    }
  };

  const applyLaborMonthRange = () => {
    const [start, end] = monthStartEndYmdInTzLocal(tz);
    setExportFrom(start);
    setExportTo(end);
  };
  const [exportFrom, setExportFrom] = useState(() => firstAndLastDayOfCurrentMonthYmd()[0]);
  const [exportTo, setExportTo] = useState(() => firstAndLastDayOfCurrentMonthYmd()[1]);
  const [periodType, setPeriodType] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [sheetStatus, setSheetStatus] = useState<Record<string, { status: "approved" | "rejected"; notes?: string }>>({});
  const [notesDraft, setNotesDraft] = useState("");

  const filteredClockForTs = useMemo(() => {
    let list = clockEntries.filter((e) => e.clockOut);
    if (!viewAll && currentUserEmployeeId) {
      list = list.filter((e) => e.employeeId === currentUserEmployeeId);
    }
    if (selectedEmployeeId) {
      list = list.filter((e) => e.employeeId === selectedEmployeeId);
    }
    if (selectedProjectId) {
      list = list.filter((e) => e.projectId === selectedProjectId);
    }
    return list;
  }, [clockEntries, viewAll, currentUserEmployeeId, selectedEmployeeId, selectedProjectId]);

  const minDisplayYmd = useMemo(() => minYmdForTimesheetPeriod(periodType), [periodType]);

  const monthTotalHours = useMemo(() => {
    const [mStart, mEnd] = firstAndLastDayOfCurrentMonthYmd();
    let sum = 0;
    for (const e of filteredClockForTs) {
      if (e.date >= mStart && e.date <= mEnd) {
        sum += hoursWorkedForScheduleEntry(e);
      }
    }
    return sum;
  }, [filteredClockForTs]);

  const monthTotalCost = useMemo(() => {
    if (!showTimesheetCosts) return 0;
    const [mStart, mEnd] = firstAndLastDayOfCurrentMonthYmd();
    let sum = 0;
    for (const e of filteredClockForTs) {
      if (e.date < mStart || e.date > mEnd) continue;
      const h = hoursWorkedForScheduleEntry(e);
      const cost = laborCostForHours(h, rateFor(e.employeeId));
      sum += cost;
    }
    return Math.round(sum * 100) / 100;
  }, [filteredClockForTs, showTimesheetCosts, employeeLaborRatesByEmployeeId]);

  const sheets = useMemo(() => {
    let list = generateTimeSheetsFromClock(filteredClockForTs, projects);
    list = list.filter((s) => s.weekEnd >= minDisplayYmd);
    return list;
  }, [filteredClockForTs, projects, minDisplayYmd]);

  const weeklySummaries = useMemo(() => {
    type Row = {
      employeeId: string;
      weekStart: string;
      weekEnd: string;
      totalHours: number;
      totalCost: number;
      byProject: { name: string; hours: number }[];
    };
    const map = new Map<
      string,
      { employeeId: string; weekStart: string; weekEnd: string; byProject: Map<string, number>; totalCost: number }
    >();
    for (const e of filteredClockForTs) {
      const weekStart = getWeekStart(e.date);
      const weekEnd = getWeekEnd(weekStart);
      const key = `${e.employeeId}|${weekStart}`;
      if (!map.has(key)) {
        map.set(key, { employeeId: e.employeeId, weekStart, weekEnd, byProject: new Map(), totalCost: 0 });
      }
      const row = map.get(key)!;
      const h = hoursWorkedForScheduleEntry(e);
      const c = showTimesheetCosts ? laborCostForHours(h, rateFor(e.employeeId)) : 0;
      row.totalCost += c;
      const pname = projectNameForClockEntry(e, projects);
      const label = pname.trim() && pname !== "—" ? pname : lx.schedule_no_project ?? "—";
      row.byProject.set(label, (row.byProject.get(label) ?? 0) + h);
    }
    const out: Row[] = [];
    map.forEach((v) => {
      let total = 0;
      const byProject: { name: string; hours: number }[] = [];
      v.byProject.forEach((hours, name) => {
        total += hours;
        byProject.push({ name, hours });
      });
      byProject.sort((a, b) => b.hours - a.hours);
      out.push({
        employeeId: v.employeeId,
        weekStart: v.weekStart,
        weekEnd: v.weekEnd,
        totalHours: total,
        totalCost: Math.round(v.totalCost * 100) / 100,
        byProject,
      });
    });
    return out.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.employeeId.localeCompare(b.employeeId));
  }, [filteredClockForTs, projects, lx.schedule_no_project, showTimesheetCosts, employeeLaborRatesByEmployeeId]);

  const selectedSheet = selectedSheetId ? sheets.find((s) => s.id === selectedSheetId) : null;
  const selectedSheetEmployeeRate = selectedSheet ? rateFor(selectedSheet.employeeId) : null;
  const selectedSheetTotalCost =
    selectedSheet && showTimesheetCosts
      ? Math.round(
          selectedSheet.entries.reduce(
            (s, ent) => s + laborCostForHours(ent.hoursWorked, selectedSheetEmployeeRate),
            0
          ) * 100
        ) / 100
      : 0;
  const effectiveStatus = (sheet: TimeSheetForSchedule) =>
    sheetStatus[sheet.id]?.status ?? sheet.status;

  const CIRCLE_R = 20;
  const CIRCLE_C = 2 * Math.PI * CIRCLE_R;

  const getEmployeeName = (id: string) =>
    employeeLabels[id] || employees.find((e) => e.id === id)?.name || id;

  const laborReportPeriodLabel = useMemo(() => {
    const from = exportFrom <= exportTo ? exportFrom : exportTo;
    const to = exportFrom <= exportTo ? exportTo : exportFrom;
    return `${from} – ${to}`;
  }, [exportFrom, exportTo]);

  const buildLaborExportDetailRows = useCallback((): LaborReportDetailRow[] => {
    const from = exportFrom <= exportTo ? exportFrom : exportTo;
    const to = exportFrom <= exportTo ? exportTo : exportFrom;
    const out: LaborReportDetailRow[] = [];
    for (const e of filteredClockForTs) {
      if (!e.clockOut) continue;
      if (e.date < from || e.date > to) continue;
      const h = hoursWorkedForScheduleEntry(e);
      if (h <= 0) continue;
      const cost = laborCostForHours(h, rateFor(e.employeeId));
      out.push({
        employee: getEmployeeName(e.employeeId),
        project: projectNameForClockEntry(e, projects),
        hours: Math.round(h * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        dateYmd: e.date,
      });
    }
    return out;
  }, [filteredClockForTs, exportFrom, exportTo, projects, employeeLabels, employees, employeeLaborRatesByEmployeeId]);

  const exportLaborReportCsvClick = useCallback(() => {
    try {
      const detail = buildLaborExportDetailRows();
      downloadLaborReportDetailCsv({
        rows: detail,
        periodLabel: laborReportPeriodLabel,
        filenameSlug: fileSlugCompany(companyName, companyIdFallback || "co"),
        labels: {
          employee: lx.personnel ?? "Employee",
          project: lx.project ?? "Project",
          hours: lx.hours ?? "Hours",
          cost: lx.labor_cost_column ?? "Cost",
          date: lx.date ?? "Date",
          period: lx.labor_cost_filter_custom ?? "Period",
        },
      });
      showToast("success", lx.export_success ?? "Export completed");
    } catch {
      showToast("error", lx.export_error ?? "Export error");
    }
  }, [
    buildLaborExportDetailRows,
    laborReportPeriodLabel,
    companyName,
    companyIdFallback,
    lx,
    showToast,
  ]);

  const exportLaborReportPdfClick = useCallback(() => {
    try {
      const detail = buildLaborExportDetailRows();
      const byEmp = new Map<string, { hours: number; cost: number }>();
      const byProj = new Map<string, { hours: number; cost: number }>();
      let totalH = 0;
      let totalC = 0;
      for (const r of detail) {
        totalH += r.hours;
        totalC += r.cost;
        const ea = byEmp.get(r.employee) ?? { hours: 0, cost: 0 };
        ea.hours += r.hours;
        ea.cost += r.cost;
        byEmp.set(r.employee, ea);
        const pa = byProj.get(r.project) ?? { hours: 0, cost: 0 };
        pa.hours += r.hours;
        pa.cost += r.cost;
        byProj.set(r.project, pa);
      }
      const byEmployee = [...byEmp.entries()]
        .map(([name, v]) => ({ name, hours: v.hours, cost: Math.round(v.cost * 100) / 100 }))
        .sort((a, b) => b.cost - a.cost);
      const byProject = [...byProj.entries()]
        .map(([name, v]) => ({ name, hours: v.hours, cost: Math.round(v.cost * 100) / 100 }))
        .sort((a, b) => b.cost - a.cost);
      downloadLaborReportExecutivePdf({
        title: lx.labor_report_summary ?? "Cost summary",
        periodLabel: laborReportPeriodLabel,
        summaryHeading: lx.labor_report_summary ?? "Cost summary",
        totalHoursLabel: lx.labor_hours_worked ?? "Hours worked",
        totalCostLabel: lx.labor_cost_total ?? "Total cost",
        byEmployeeHeading: lx.labor_cost_by_employee ?? "By employee",
        byProjectHeading: lx.labor_cost_by_project ?? lx.timesheet_by_project ?? "By project",
        currency: timesheetCostCurrency,
        dateLocale,
        totalHours: Math.round(totalH * 100) / 100,
        totalCost: Math.round(totalC * 100) / 100,
        byEmployee,
        byProject,
        filenameSlug: fileSlugCompany(companyName, companyIdFallback || "co"),
      });
      showToast("success", lx.export_success ?? "Export completed");
    } catch {
      showToast("error", lx.export_error ?? "Export error");
    }
  }, [
    buildLaborExportDetailRows,
    laborReportPeriodLabel,
    lx,
    timesheetCostCurrency,
    dateLocale,
    companyName,
    companyIdFallback,
    showToast,
  ]);

  const exportTimesheetsCsv = () => {
    try {
      const from = exportFrom <= exportTo ? exportFrom : exportTo;
      const to = exportFrom <= exportTo ? exportTo : exportFrom;
      const headers = [
        lx.personnel ?? "Employee",
        lx.date ?? "Date",
        lx.hours ?? "Hours",
        ...(showTimesheetCosts ? [lx.labor_cost_column ?? "Cost"] : []),
        lx.project ?? "Project",
        labels.pending ?? "Status",
      ];
      const lines = [headers.map((h) => csvCell(h)).join(",")];
      const sheetsAll = generateTimeSheetsFromClock(filteredClockForTs, projects);
      for (const sheet of sheetsAll) {
        const status = effectiveStatus(sheet);
        const statusLabel =
          status === "approved"
            ? (labels.approved ?? status)
            : status === "rejected"
              ? (labels.rejected ?? status)
              : (labels.pending ?? status);
        const rowRate = rateFor(sheet.employeeId);
        for (const ent of sheet.entries) {
          if (ent.date < from || ent.date > to) continue;
          const rowCost = showTimesheetCosts ? laborCostForHours(ent.hoursWorked, rowRate) : 0;
          lines.push(
            [
              csvCell(getEmployeeName(sheet.employeeId)),
              csvCell(formatCalendarYmd(ent.date, dateLocale, tz)),
              csvCell(String(ent.hoursWorked)),
              ...(showTimesheetCosts
                ? [csvCell(rowCost > 0 ? String(rowCost) : rowRate != null && rowRate > 0 ? "0" : "—")]
                : []),
              csvCell(ent.projectName ?? "—"),
              csvCell(statusLabel),
            ].join(",")
          );
        }
      }
      const slug = fileSlugCompany(companyName, companyIdFallback || "co");
      downloadCsvUtf8(`hojas_horas_${slug}_${from}_${to}.csv`, lines);
      showToast("success", lx.export_success ?? "Export completed");
    } catch {
      showToast("error", lx.export_error ?? "Export error");
    }
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/80 dark:bg-slate-800/50 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          {lx.timesheet_total_month ?? "Total this month"}:{" "}
          <span className="tabular-nums text-amber-700 dark:text-amber-400">{monthTotalHours.toFixed(1)}h</span>
          {showTimesheetCosts ? (
            <>
              {" · "}
              <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                {lx.labor_cost_total ?? "Cost"}: {formatCurrency(monthTotalCost, timesheetCostCurrency, dateLocale)}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="w-full text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:w-auto">
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
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {viewAll ? (
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            aria-label={lx.personnel ?? "Employee"}
          >
            <option value="">{lx.whFilterAll ?? lx.personnel ?? "Todos"}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {employeeLabels[e.id] || e.name}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm lg:col-span-2"
          aria-label={lx.project ?? "Project"}
        >
          <option value="">{lx.whFilterAll ?? (lx.project ?? "Todos los proyectos")}</option>
          {projects
            .filter((p) => !p.archived)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <span>{lx.timesheet_date_from ?? "Desde"}</span>
          <input
            type="date"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <span>{lx.timesheet_date_to ?? "Hasta"}</span>
          <input
            type="date"
            value={exportTo}
            onChange={(e) => setExportTo(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => exportTimesheetsCsv()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 dark:border-slate-700 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-slate-800"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {lx.timesheet_export ?? lx.export_timesheets ?? lx.export_csv ?? "Export"}
        </button>
      </div>

      {canViewLaborCosting ? (
        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 px-3 py-3 space-y-3">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{lx.labor_export_report ?? "Export report"}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyLaborWeekRange}
              className="min-h-[44px] rounded-lg border border-zinc-300 dark:border-slate-600 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
            >
              {lx.labor_cost_filter_week ?? labels.weekly ?? "Week"}
            </button>
            <button
              type="button"
              onClick={applyLaborMonthRange}
              className="min-h-[44px] rounded-lg border border-zinc-300 dark:border-slate-600 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
            >
              {lx.labor_cost_filter_month ?? labels.monthly ?? "Month"}
            </button>
            <span className="flex min-h-[44px] w-full min-w-0 items-center text-xs text-zinc-600 dark:text-zinc-400 sm:w-auto">
              {lx.labor_cost_filter_custom ?? "Rango"}: {laborReportPeriodLabel}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => exportLaborReportCsvClick()}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-emerald-600/50 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 sm:w-auto"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              {lx.export_csv ?? "CSV"}
            </button>
            <button
              type="button"
              onClick={() => exportLaborReportPdfClick()}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-emerald-600/50 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 sm:w-auto"
            >
              {lx.export_pdf ?? "PDF"}
            </button>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-4">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
          {lx.timesheet_weekly_summary ?? "Weekly summary"}
        </h4>
        {weeklySummaries.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {lx.empty_state_timesheets ?? labels.noEntries ?? ""}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {weeklySummaries.slice(0, 24).map((row) => (
              <li
                key={`${row.employeeId}-${row.weekStart}`}
                className="rounded-lg border border-zinc-100 dark:border-slate-800 p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-zinc-900 dark:text-white">{getEmployeeName(row.employeeId)}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {row.weekStart} – {row.weekEnd}
                  </span>
                </div>
                <p className="mt-1 tabular-nums font-semibold text-amber-700 dark:text-amber-400">{row.totalHours.toFixed(1)}h</p>
                {showTimesheetCosts ? (
                  <p className="mt-0.5 text-xs tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                    {lx.labor_cost_total ?? "Cost"}: {formatCurrency(row.totalCost, timesheetCostCurrency, dateLocale)}
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">{lx.timesheet_by_project ?? "Por proyecto"}</p>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                  {row.byProject.map((bp) => (
                    <li key={bp.name} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{bp.name}</span>
                      <span className="shrink-0 tabular-nums">{bp.hours.toFixed(1)}h</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sheets.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 col-span-full">
            {lx.empty_state_timesheets ?? labels.noEntries ?? ""}
          </p>
        ) : (
          sheets.map((sheet) => {
            const status = effectiveStatus(sheet);
            const progress = Math.min(sheet.totalHours / 40, 1);
            const dashOffset = CIRCLE_C * (1 - progress);
            const strokeColor = sheet.totalHours > 40 ? "#ef4444" : "#f59e0b";
            const sheetLaborCost = showTimesheetCosts
              ? laborCostForHours(sheet.totalHours, rateFor(sheet.employeeId))
              : 0;
            return (
              <div
                key={sheet.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedSheetId(sheet.id);
                  setNotesDraft(sheetStatus[sheet.id]?.notes ?? "");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedSheetId(sheet.id);
                    setNotesDraft(sheetStatus[sheet.id]?.notes ?? "");
                  }
                }}
                className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm transition-shadow hover:shadow-md cursor-pointer"
              >
                <p className="font-semibold text-zinc-900 dark:text-white">{getEmployeeName(sheet.employeeId)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {sheet.weekStart} – {sheet.weekEnd}
                </p>
                <div className="mt-3 flex items-center gap-4">
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
                    <text
                      x="28"
                      y="32"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill="currentColor"
                      className="text-zinc-900 dark:text-zinc-100"
                    >
                      {sheet.totalHours}h
                    </text>
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {labels.regularHours ?? "Horas regulares"}: {sheet.regularHours}h
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {labels.overtimeHours ?? "Horas extra"}: {sheet.overtimeHours}h
                    </p>
                    {showTimesheetCosts ? (
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {lx.labor_cost_total ?? "Cost"}:{" "}
                        {formatCurrency(sheetLaborCost, timesheetCostCurrency, dateLocale)}
                      </p>
                    ) : null}
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        status === "approved"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : status === "rejected"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}
                    >
                      {status === "approved"
                        ? (labels.approved ?? "Aprobado")
                        : status === "rejected"
                          ? (labels.rejected ?? "Rechazado")
                          : (labels.pending ?? "Pendiente")}
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
          <div className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(95vw,calc(100%-2rem))] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:p-6 md:max-w-xl lg:max-w-2xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="min-w-0 text-base font-semibold text-zinc-900 dark:text-white sm:text-lg">
                {getEmployeeName(selectedSheet.employeeId)} · {selectedSheet.weekStart} – {selectedSheet.weekEnd}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSheetId(null)}
                className="min-h-[44px] min-w-[44px] rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 sm:hidden">
              {selectedSheet.entries.map((ent) => (
                <div
                  key={ent.id}
                  className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3 text-sm text-zinc-800 dark:text-zinc-100"
                >
                  <p className="font-medium">{ent.date}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{ent.projectName ?? "—"}</p>
                  <p className="mt-1 text-xs">
                    {formatTimeHm(ent.clockIn, dateLocale, tz)} –{" "}
                    {ent.clockOut ? formatTimeHm(ent.clockOut, dateLocale, tz) : "—"}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">{ent.hoursWorked.toFixed(1)}h</p>
                  {showTimesheetCosts ? (
                    <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {lx.labor_cost_column ?? "Cost"}:{" "}
                      {selectedSheetEmployeeRate != null && selectedSheetEmployeeRate > 0
                        ? formatCurrency(
                            laborCostForHours(ent.hoursWorked, selectedSheetEmployeeRate),
                            timesheetCostCurrency,
                            dateLocale
                          )
                        : "—"}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-0 text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                      {lx.date ?? "Date"}
                    </th>
                    <th className="py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                      {lx.project ?? "Project"}
                    </th>
                    <th className="py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                      {labels.clockInEntry ?? "Entrada"}
                    </th>
                    <th className="py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                      {labels.clockOutEntry ?? "Salida"}
                    </th>
                    <th className="py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">{lx.hours ?? "Horas"}</th>
                    {showTimesheetCosts ? (
                      <th className="py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">
                        {lx.labor_cost_column ?? "Cost"}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {selectedSheet.entries.map((ent) => (
                    <tr key={ent.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 text-zinc-600 dark:text-zinc-400">{ent.date}</td>
                      <td className="py-2 text-zinc-600 dark:text-zinc-400">
                        <span>{ent.projectName ?? "—"}</span>
                        {(ent.locationAlert ?? ent.hadPendingCerts) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {ent.locationAlert && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                {lx.outsideZone ?? "Fuera de zona"}
                                {ent.locationAlertMeters != null && ` (${ent.locationAlertMeters}m)`}
                              </span>
                            )}
                            {ent.hadPendingCerts && (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                {lx.pendingCertsAtClockIn ?? ""}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2">{formatTimeHm(ent.clockIn, dateLocale, tz)}</td>
                      <td className="py-2">{ent.clockOut ? formatTimeHm(ent.clockOut, dateLocale, tz) : "—"}</td>
                      <td className="py-2 text-right font-medium">{ent.hoursWorked.toFixed(1)}h</td>
                      {showTimesheetCosts ? (
                        <td className="py-2 text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                          {selectedSheetEmployeeRate != null && selectedSheetEmployeeRate > 0
                            ? formatCurrency(
                                laborCostForHours(ent.hoursWorked, selectedSheetEmployeeRate),
                                timesheetCostCurrency,
                                dateLocale
                              )
                            : "—"}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">
              Total: {selectedSheet.totalHours.toFixed(1)}h ({labels.regularHours ?? "Reg."}:{" "}
              {selectedSheet.regularHours.toFixed(1)}h, {labels.overtimeHours ?? "Extra"}:{" "}
              {selectedSheet.overtimeHours.toFixed(1)}h)
              {showTimesheetCosts ? (
                <>
                  {" · "}
                  <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {lx.labor_cost_total ?? "Cost"}:{" "}
                    {formatCurrency(selectedSheetTotalCost, timesheetCostCurrency, dateLocale)}
                  </span>
                </>
              ) : null}
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
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSheetStatus((s) => ({ ...s, [selectedSheet.id]: { status: "approved", notes: notesDraft } }));
                      setSelectedSheetId(null);
                    }}
                    className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    {labels.approve ?? "Aprobar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSheetStatus((s) => ({ ...s, [selectedSheet.id]: { status: "rejected", notes: notesDraft } }));
                      setSelectedSheetId(null);
                    }}
                    className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
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
  canViewTeamAvailability = false,
  canManageTeamAvailability = false,
  canClockIn = false,
  canManageEmployees = false,
  currentUserProfileId,
  profileToLegacyEmployeeId = {},
  onManualClockIn,
  onManualClockOut,
  viewAll,
  canViewScheduleCalendar = false,
  canViewTimeclock = false,
  canViewTimesheets = false,
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
  companyLogoUrl,
  companyId = "",
  currentUserId = "",
  canViewTimesheetCosts = false,
  canViewLaborCosting = false,
  timesheetCostCurrency = "CAD",
  employeeLaborRatesByEmployeeId = {},
  canViewPayroll = false,
  canManagePayroll = false,
  canExportPayroll = false,
  companyCountryForPayroll = "CA",
  productionReports = [],
}: ScheduleModuleProps) {
  const lx = labels as Record<string, string>;
  const { showToast } = useToast();
  const scheduleTz = scheduleTimeZoneProp ?? resolveUserTimezone(null);
  void useMachinProDisplayPrefs();
  const wallClockLabel = (s: string) =>
    /^\d{1,2}:\d{2}$/.test(String(s).trim()) ? formatTimeHm(s, dateLocale, scheduleTz) : s;
  const today = new Date();
  const todayYmd = formatTodayYmdInTimeZone(scheduleTz);
  const todayEntry = clockEntries.find((e) => {
    if (e.date !== todayYmd) return false;
    const pid = (currentUserProfileId ?? "").trim();
    const leg = (currentUserEmployeeId ?? "").trim();
    const mapLeg =
      pid && profileToLegacyEmployeeId[pid] ? String(profileToLegacyEmployeeId[pid]) : "";
    return (
      (!!pid && e.employeeId === pid) ||
      (!!leg && e.employeeId === leg) ||
      (!!mapLeg && e.employeeId === mapLeg)
    );
  });
  const showCalendarTab = canViewScheduleCalendar;
  const showClockTab =
    !!canViewTimeclock && (Boolean(canClockIn) || Boolean(canManageEmployees));
  const showTimesheetsTab = canViewTimesheets;
  const showPayrollTab = !!canViewPayroll;
  const [payrollPayMode, setPayrollPayMode] = useState<"hours" | "production">("hours");
  const [scheduleSubTab, setScheduleSubTab] = useState<
    "calendar" | "clock" | "timesheets" | "payroll" | "vacations"
  >("calendar");
  const showVacationsTab = canRequestVacation || canApproveVacations;

  const firstAllowedScheduleSubTab = useMemo(():
    | "calendar"
    | "clock"
    | "timesheets"
    | "payroll"
    | "vacations" => {
    if (showCalendarTab) return "calendar";
    if (showClockTab) return "clock";
    if (showTimesheetsTab) return "timesheets";
    if (showPayrollTab) return "payroll";
    if (showVacationsTab) return "vacations";
    return "calendar";
  }, [showCalendarTab, showClockTab, showTimesheetsTab, showPayrollTab, showVacationsTab]);

  useEffect(() => {
    const allowed = new Set<"calendar" | "clock" | "timesheets" | "payroll" | "vacations">();
    if (showCalendarTab) allowed.add("calendar");
    if (showClockTab) allowed.add("clock");
    if (showTimesheetsTab) allowed.add("timesheets");
    if (showPayrollTab) allowed.add("payroll");
    if (showVacationsTab) allowed.add("vacations");
    if (allowed.size === 0) return;
    if (!allowed.has(scheduleSubTab)) setScheduleSubTab(firstAllowedScheduleSubTab);
  }, [
    showCalendarTab,
    showClockTab,
    showTimesheetsTab,
    showPayrollTab,
    showVacationsTab,
    scheduleSubTab,
    firstAllowedScheduleSubTab,
  ]);
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [deleteConfirmEntryId, setDeleteConfirmEntryId] = useState<string | null>(null);
  const [clockInManualNeeded, setClockInManualNeeded] = useState(true);
  const [schedManualModal, setSchedManualModal] = useState<
    null | { mode: "in" | "out"; targetUserId: string; timeEntryId?: string }
  >(null);
  const [schedManualProjectId, setSchedManualProjectId] = useState("");
  const [schedManualTime, setSchedManualTime] = useState("");
  const [schedManualNotes, setSchedManualNotes] = useState("");
  const [schedManualSaving, setSchedManualSaving] = useState(false);

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
  const [vacFilterUserId, setVacFilterUserId] = useState("");
  const [vacMobileFiltersOpen, setVacMobileFiltersOpen] = useState(false);
  const [vacFilterStatus, setVacFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [teamAvailabilityOpen, setTeamAvailabilityOpen] = useState(true);
  const [availabilityWeekOffset, setAvailabilityWeekOffset] = useState(0);

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

  const vacationBalanceYear = today.getFullYear();

  const approvedVacationDaysByUser = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vacationRequests) {
      if (v.status !== "approved") continue;
      const y = Number(v.start_date.slice(0, 4));
      if (y !== vacationBalanceYear) continue;
      m.set(v.user_id, (m.get(v.user_id) ?? 0) + v.total_days);
    }
    return m;
  }, [vacationRequests, vacationBalanceYear]);

  const vacationFilterUserOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const v of vacationRequests) ids.add(v.user_id);
    if (currentUserId) ids.add(currentUserId);
    return [...ids].sort((a, b) =>
      (vacationEmployeeNames[a] ?? a).localeCompare(vacationEmployeeNames[b] ?? b)
    );
  }, [vacationRequests, vacationEmployeeNames, currentUserId]);

  const filteredVacationRequests = useMemo(() => {
    let list = [...vacationRequests];
    if (!canApproveVacations && currentUserId) {
      list = list.filter((v) => v.user_id === currentUserId);
    }
    if (canApproveVacations && vacFilterUserId) {
      list = list.filter((v) => v.user_id === vacFilterUserId);
    }
    if (vacFilterStatus !== "all") {
      list = list.filter((v) => v.status === vacFilterStatus);
    }
    return list.sort((a, b) => b.start_date.localeCompare(a.start_date) || a.id.localeCompare(b.id));
  }, [vacationRequests, canApproveVacations, currentUserId, vacFilterUserId, vacFilterStatus]);

  const formSelectedDatesSorted = useMemo(
    () => [...new Set(fDates)].filter(Boolean).sort(),
    [fDates]
  );

  const formEmployeeShiftStatus = useMemo(() => {
    const l = labels as Record<string, string>;
    const shiftWord = l.schedule_type_shift ?? labels.shift ?? "Turno";
    const map = new Map<
      string,
      | { kind: "none" }
      | { kind: "free" }
      | { kind: "partial"; title: string }
      | { kind: "busy"; badge: string; title: string }
    >();
    const days = formSelectedDatesSorted;
    for (const emp of employees) {
      if (days.length === 0) {
        map.set(emp.id, { kind: "none" });
        continue;
      }
      const conflicts: { ymd: string; project: string }[] = [];
      for (const ymd of days) {
        const list = shiftEntriesForEmployeeOnDay(emp.id, ymd, entries);
        if (list.length > 0) {
          conflicts.push({ ymd, project: shiftProjectLabelForEntry(list[0]!, projects) });
        }
      }
      const busy = conflicts.length;
      const free = days.length - busy;
      if (busy === 0) map.set(emp.id, { kind: "free" });
      else if (free > 0) {
        map.set(emp.id, {
          kind: "partial",
          title: conflicts
            .map((c) => `${c.project} · ${formatCalendarYmd(c.ymd, dateLocale, scheduleTz)}`)
            .join("; "),
        });
      } else {
        const first = conflicts[0]!;
        const badge = `${shiftWord}: ${first.project} · ${formatCalendarYmd(first.ymd, dateLocale, scheduleTz)}`;
        const title =
          conflicts.length > 1
            ? conflicts
                .map((c) => `${c.project} · ${formatCalendarYmd(c.ymd, dateLocale, scheduleTz)}`)
                .join("; ")
            : badge;
        map.set(emp.id, { kind: "busy", badge, title });
      }
    }
    return map;
  }, [formSelectedDatesSorted, employees, entries, projects, dateLocale, scheduleTz, labels]);

  const formCalendarDayAvailabilityDot = useMemo(() => {
    const m = new Map<string, "busy" | "free">();
    if (fEmployeeIds.length === 0) return m;
    for (const day of shiftFormCalendarDays) {
      const ymd = ymdFromLocalDate(day);
      if (day.getMonth() !== shiftFormCalMonth) continue;
      const anyBusy = fEmployeeIds.some(
        (id) => shiftEntriesForEmployeeOnDay(id, ymd, entries).length > 0
      );
      m.set(ymd, anyBusy ? "busy" : "free");
    }
    return m;
  }, [fEmployeeIds, shiftFormCalendarDays, shiftFormCalMonth, entries]);

  const availabilityWeekYmds = useMemo(
    () => weekYmdsMondayFirstInTimeZone(scheduleTz, availabilityWeekOffset),
    [scheduleTz, todayYmd, availabilityWeekOffset]
  );

  const availabilityWeekRangeLabel = useMemo(() => {
    const a = availabilityWeekYmds[0];
    const b = availabilityWeekYmds[6];
    if (!a || !b) return "";
    return `${formatCalendarYmd(a, dateLocale, scheduleTz)} – ${formatCalendarYmd(b, dateLocale, scheduleTz)}`;
  }, [availabilityWeekYmds, dateLocale, scheduleTz]);

  const teamWeekAvailabilityRows = useMemo(
    () =>
      employees.map((emp) => ({
        emp,
        cells: availabilityWeekYmds.map((ymd) => {
          const list = shiftEntriesForEmployeeOnDay(emp.id, ymd, entries);
          const names = list.map((e) => shiftProjectLabelForEntry(e, projects));
          return { ymd, count: list.length, title: names.join(", ") };
        }),
      })),
    [employees, availabilityWeekYmds, entries, projects]
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
    if (srk.startsWith("custom:")) {
      const rid = srk.slice("custom:".length);
      return chip.matchingCustomRoleIds.includes(rid);
    }
    const chipLabel = chip.label.trim().toLowerCase();
    const empRoleLower = (emp.role ?? "").trim().toLowerCase();
    const legacyMap: Record<string, string[]> = {
      administrador: ["admin", "administrador"],
      administrator: ["admin", "administrador"],
      supervisor: ["supervisor"],
      trabajador: ["worker", "trabajador", "empleado"],
      worker: ["worker", "trabajador", "empleado"],
      employee: ["worker", "trabajador", "empleado"],
      logística: ["logistic", "logística"],
      logistics: ["logistic", "logística"],
    };
    const legacyMatches = legacyMap[chipLabel] ?? [chipLabel];
    return legacyMatches.includes(empRoleLower) || empRoleLower === chipLabel;
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

    const uniqueDates = [...new Set(fDates)].filter(Boolean).sort();
    if (uniqueDates.length === 0) return;

    const proj = fProjectId ? projects.find((p) => p.id === fProjectId) : undefined;
    const basePayload = {
      type: fType,
      employeeIds: fEmployeeIds,
      projectId: fType === "shift" && fProjectId ? fProjectId : undefined,
      projectCode: fType === "shift" && fProjectId ? proj?.projectCode : undefined,
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

  const openNewEntryForm = () => {
    setEditingEntryId(null);
    dispatchShiftFormDates({ type: "replace", dates: [toYMD(today)] });
    setShiftFormCalMonth(today.getMonth());
    setShiftFormCalYear(today.getFullYear());
    setFormEmployeeSearch("");
    setFormRoleFilterKey("all");
    setFormOpen(true);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          {labels.schedule ?? ALL_TRANSLATIONS.en.schedule}
        </h2>
        {canWrite && showCalendarTab && scheduleSubTab === "calendar" && (
          <button
            type="button"
            onClick={openNewEntryForm}
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
          {showCalendarTab ? (
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
          ) : null}
          {showClockTab ? (
            <button
              type="button"
              role="tab"
              aria-selected={scheduleSubTab === "clock"}
              onClick={() => setScheduleSubTab("clock")}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium min-h-[44px] border-b-2 transition-colors ${
                scheduleSubTab === "clock"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {lx.clock_tab ?? lx.clockInTitle ?? "Fichaje"}
            </button>
          ) : null}
          {showTimesheetsTab ? (
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
          ) : null}
          {showPayrollTab ? (
            <button
              type="button"
              role="tab"
              aria-selected={scheduleSubTab === "payroll"}
              onClick={() => setScheduleSubTab("payroll")}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium min-h-[44px] border-b-2 transition-colors ${
                scheduleSubTab === "payroll"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {lx.payroll_title ?? "Payroll"}
            </button>
          ) : null}
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
              {lx.vacations_tab ??
                lx.schedule_tab_vacations ??
                lx.schedule_type_vacation ??
                lx.schedule_vacation_request ??
                "Vacaciones"}
            </button>
          ) : null}
        </div>
      </HorizontalScrollFade>

      {scheduleSubTab === "clock" && showClockTab ? (
        <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-6">
          {canClockIn ? (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {labels.clockInTitle ?? "Fichaje de hoy"}
              </h3>
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
                </>
              )}
              <div className="grid grid-cols-1 gap-3 place-items-center max-md:w-full">
                {!todayEntry ? (
                  clockInManualNeeded ? (
                    <button
                      type="button"
                      onClick={() => onClockIn?.()}
                      disabled={gpsStatus === "locating"}
                      className="flex h-20 w-20 max-w-full items-center justify-center rounded-full bg-emerald-600 text-center text-sm font-semibold leading-tight text-white transition-colors hover:bg-emerald-500 disabled:opacity-60 md:h-14 md:w-full md:rounded-2xl md:text-base min-h-[44px] min-w-[44px]"
                    >
                      {gpsStatus === "locating"
                        ? (labels.gpsLocating ?? "…")
                        : ((((labels as Record<string, string>).clock_in_action) ??
                            ((labels as Record<string, string>).timeclock_clock_in) ??
                            labels.clockIn ??
                            "").trim() || "Fichar")}
                    </button>
                  ) : null
                ) : !todayEntry.clockOut ? (
                  <button
                    type="button"
                    onClick={onClockOut}
                    disabled={gpsStatus === "locating"}
                    className="flex h-20 w-20 max-w-full items-center justify-center rounded-full bg-red-500 text-center text-sm font-semibold leading-tight text-white transition-colors hover:bg-red-600 disabled:opacity-60 md:h-14 md:w-full md:rounded-2xl md:text-base min-h-[44px] min-w-[44px]"
                  >
                    {gpsStatus === "locating"
                      ? (labels.gpsLocating ?? "…")
                      : (labels.clockOut ?? "Fichar Salida")}
                  </button>
                ) : (
                  <div className="flex min-h-[3.5rem] w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-3 text-center font-semibold text-emerald-600 dark:bg-zinc-800 dark:text-emerald-400">
                    ✓ {labels.clockInDone ?? "Jornada completada"}
                  </div>
                )}
              </div>
              {clockInAlertMessage && onDismissClockInAlert ? (
                <div className="rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start justify-between gap-2">
                  <p className="text-sm text-amber-800 dark:text-amber-200">{clockInAlertMessage}</p>
                  <button
                    type="button"
                    onClick={onDismissClockInAlert}
                    className="shrink-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-lg leading-none hover:bg-amber-200/50 dark:hover:bg-amber-800/30"
                    aria-label={lx.common_close ?? "Close"}
                  >
                    ×
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {canManageEmployees && onManualClockIn && onManualClockOut ? (
            <div className="space-y-3 border-t border-zinc-200 dark:border-slate-700 pt-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{lx.personnel ?? "Equipo"}</h3>
              <ul className="space-y-2">
                {employees.map((emp) => {
                  const leg = profileToLegacyEmployeeId[emp.id]
                    ? String(profileToLegacyEmployeeId[emp.id])
                    : "";
                  const row = clockEntries.find(
                    (e) =>
                      e.date === todayYmd &&
                      (e.employeeId === emp.id || (!!leg && e.employeeId === leg))
                  );
                  return (
                    <li
                      key={emp.id}
                      className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-slate-700 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-white truncate">{emp.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {!row
                            ? lx.clock_not_clocked_in ?? "—"
                            : row.clockOut
                              ? `${wallClockLabel(row.clockIn)} – ${wallClockLabel(row.clockOut)}`
                              : `${lx.clock_active_since ?? ""} ${wallClockLabel(row.clockIn)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {!row ? (
                          <button
                            type="button"
                            onClick={() => {
                              const pad2 = (n: number) => String(n).padStart(2, "0");
                              const d = new Date();
                              setSchedManualTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
                              setSchedManualProjectId("");
                              setSchedManualNotes("");
                              setSchedManualModal({ mode: "in", targetUserId: emp.id });
                            }}
                            className="min-h-[44px] rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                          >
                            {lx.clock_manual_in ?? ""}
                          </button>
                        ) : !row.clockOut ? (
                          <button
                            type="button"
                            onClick={() => {
                              const pad2 = (n: number) => String(n).padStart(2, "0");
                              const d = new Date();
                              setSchedManualTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
                              setSchedManualNotes("");
                              setSchedManualModal({
                                mode: "out",
                                targetUserId: emp.id,
                                timeEntryId: row.id,
                              });
                            }}
                            className="min-h-[44px] rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
                          >
                            {lx.clock_manual_out ?? ""}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {schedManualModal && onManualClockIn && onManualClockOut ? (
        <>
          <div
            className="fixed inset-0 z-[55] bg-black/50"
            aria-hidden
            onClick={() => !schedManualSaving && setSchedManualModal(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[56] max-h-[90vh] space-y-3 overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:inset-x-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl md:max-w-lg lg:max-w-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                {schedManualModal.mode === "in" ? lx.clock_manual_in ?? "" : lx.clock_manual_out ?? ""}
              </p>
              <button
                type="button"
                disabled={schedManualSaving}
                onClick={() => setSchedManualModal(null)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label={lx.cancel ?? ""}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {schedManualModal.mode === "in" ? (
              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                {lx.project ?? ""}
                <select
                  value={schedManualProjectId}
                  onChange={(e) => setSchedManualProjectId(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="">{lx.schedule_no_project ?? "—"}</option>
                  {projects
                    .filter((p) => !p.archived)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <label className="block text-sm text-zinc-700 dark:text-zinc-300">
              {schedManualModal.mode === "in" ? lx.clockInEntry ?? "" : lx.clockOutEntry ?? ""}
              <input
                type="time"
                value={schedManualTime}
                onChange={(e) => setSchedManualTime(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm text-zinc-700 dark:text-zinc-300">
              {lx.notes ?? ""}
              <textarea
                value={schedManualNotes}
                onChange={(e) => setSchedManualNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full max-w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={schedManualSaving || !schedManualTime}
              onClick={() => {
                if (!schedManualModal) return;
                setSchedManualSaving(true);
                const done = (ok: boolean) => {
                  setSchedManualSaving(false);
                  if (ok) {
                    setSchedManualModal(null);
                    showToast("success", schedManualModal.mode === "in" ? lx.clock_manual_in ?? "" : lx.clock_manual_out ?? "");
                  }
                };
                if (schedManualModal.mode === "in") {
                  void onManualClockIn({
                    targetUserId: schedManualModal.targetUserId,
                    date: todayYmd,
                    time: schedManualTime,
                    projectId: schedManualProjectId.trim() ? schedManualProjectId : null,
                    notes: schedManualNotes.trim() || undefined,
                  }).then((r) => {
                    if (r.ok) done(true);
                    else {
                      setSchedManualSaving(false);
                      showToast("error", r.error ?? lx.export_error ?? "Error");
                    }
                  });
                } else if (schedManualModal.timeEntryId) {
                  void onManualClockOut({
                    targetUserId: schedManualModal.targetUserId,
                    timeEntryId: schedManualModal.timeEntryId,
                    date: todayYmd,
                    time: schedManualTime,
                    notes: schedManualNotes.trim() || undefined,
                  }).then((r) => {
                    if (r.ok) done(true);
                    else {
                      setSchedManualSaving(false);
                      showToast("error", r.error ?? lx.export_error ?? "Error");
                    }
                  });
                } else {
                  setSchedManualSaving(false);
                }
              }}
              className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {schedManualSaving ? "…" : schedManualModal.mode === "in" ? lx.clock_manual_in ?? "" : lx.clock_manual_out ?? ""}
            </button>
          </div>
        </>
      ) : null}

      {scheduleSubTab === "vacations" && showVacationsTab && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
            {canApproveVacations ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setVacMobileFiltersOpen((o) => !o)}
                  className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-100 sm:hidden"
                  aria-expanded={vacMobileFiltersOpen}
                >
                  <span>{lx.logistics_filters_toggle ?? "Filtros"}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${vacMobileFiltersOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <div
                  className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${vacMobileFiltersOpen ? "" : "hidden"} sm:grid`}
                >
                  <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>{lx.vacations_filter_employee ?? lx.personnel ?? ""}</span>
                    <select
                      value={vacFilterUserId}
                      onChange={(e) => setVacFilterUserId(e.target.value)}
                      className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    >
                      <option value="">{lx.vacations_all ?? lx.whFilterAll ?? ""}</option>
                      {vacationFilterUserOptions.map((uid) => (
                        <option key={uid} value={uid}>
                          {vacationEmployeeNames[uid] ?? uid}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>{lx.vacations_filter_status ?? "Status"}</span>
                    <select
                      value={vacFilterStatus}
                      onChange={(e) =>
                        setVacFilterStatus(e.target.value as "all" | "pending" | "approved" | "rejected")
                      }
                      className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    >
                      <option value="all">{lx.vacations_all ?? lx.whFilterAll ?? ""}</option>
                      <option value="pending">{lx.vacations_pending ?? labels.pending ?? ""}</option>
                      <option value="approved">{lx.vacations_approved ?? labels.approved ?? ""}</option>
                      <option value="rejected">{lx.vacations_rejected ?? labels.rejected ?? ""}</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : null}

            {canApproveVacations && vacationFilterUserOptions.length > 0 ? (
              <div className="rounded-lg border border-zinc-100 dark:border-slate-800 bg-zinc-50/80 dark:bg-slate-800/40 p-3">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {vacationBalanceYear} — {lx.vacations_allowance_hint ?? ""}
                </p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(vacFilterUserId ? [vacFilterUserId] : vacationFilterUserOptions).map((uid) => {
                    const used = approvedVacationDaysByUser.get(uid) ?? 0;
                    const rem = Math.max(0, DEFAULT_ANNUAL_VACATION_DAYS - used);
                    return (
                      <li
                        key={uid}
                        className="rounded-md border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                      >
                        <p className="truncate font-medium text-zinc-900 dark:text-white">
                          {vacationEmployeeNames[uid] ?? uid}
                        </p>
                        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                          {lx.vacations_days_used ?? "Used"}: {used} / {DEFAULT_ANNUAL_VACATION_DAYS}
                        </p>
                        <p className="text-amber-700 dark:text-amber-400">
                          {lx.vacations_days_remaining ?? "Remaining"}: {rem}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {!canApproveVacations && currentUserId ? (
              <div className="rounded-lg border border-zinc-100 dark:border-slate-800 bg-zinc-50/80 dark:bg-slate-800/40 p-3 text-sm">
                <p className="font-medium text-zinc-900 dark:text-white">{vacationBalanceYear}</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {lx.vacations_days_used ?? "Used"}:{" "}
                  <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">
                    {approvedVacationDaysByUser.get(currentUserId) ?? 0} / {DEFAULT_ANNUAL_VACATION_DAYS}
                  </span>
                </p>
                <p className="text-amber-700 dark:text-amber-400">
                  {lx.vacations_days_remaining ?? "Remaining"}:{" "}
                  <span className="tabular-nums font-semibold">
                    {Math.max(
                      0,
                      DEFAULT_ANNUAL_VACATION_DAYS - (approvedVacationDaysByUser.get(currentUserId) ?? 0)
                    )}
                  </span>
                </p>
              </div>
            ) : null}

            {onRequestVacation && canRequestVacation && (
              <div className="space-y-3 border-t border-zinc-200 dark:border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {lx.vacations_request ?? lx.schedule_vacation_request ?? ""}
                </h4>
                <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
                  <input
                    type="date"
                    value={vacReqStart}
                    onChange={(e) => setVacReqStart(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm sm:w-auto"
                    aria-label={lx.date ?? "Start"}
                  />
                  <input
                    type="date"
                    value={vacReqEnd}
                    onChange={(e) => setVacReqEnd(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm sm:w-auto"
                    aria-label={lx.date ?? "End"}
                  />
                  <input
                    type="text"
                    value={vacReqNote}
                    onChange={(e) => setVacReqNote(e.target.value)}
                    placeholder={lx.schedule_vacation_comment ?? ""}
                    className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm sm:min-w-[200px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!vacReqStart || !vacReqEnd) return;
                      void onRequestVacation?.(vacReqStart, vacReqEnd, vacReqNote);
                      setVacReqNote("");
                    }}
                    className="min-h-[44px] w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 sm:w-auto"
                  >
                    {lx.vacations_request ?? lx.employees_request_vacation ?? ""}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
              {lx.vacations_list_heading ?? lx.schedule_vacation_pending_list ?? ""}
            </h4>
            {filteredVacationRequests.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{labels.noEntries ?? ""}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {filteredVacationRequests.map((v) => {
                  const used = approvedVacationDaysByUser.get(v.user_id) ?? 0;
                  const rem = Math.max(0, DEFAULT_ANNUAL_VACATION_DAYS - used);
                  const stLabel =
                    v.status === "approved"
                      ? (lx.vacations_approved ?? labels.approved ?? "")
                      : v.status === "rejected"
                        ? (lx.vacations_rejected ?? labels.rejected ?? "")
                        : (lx.vacations_pending ?? labels.pending ?? "");
                  const stCls =
                    v.status === "approved"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                      : v.status === "rejected"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
                  return (
                    <li
                      key={v.id}
                      className="rounded-lg border border-zinc-200 dark:border-slate-700 p-3 sm:flex sm:items-end sm:justify-between sm:gap-3"
                    >
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-zinc-900 dark:text-white">
                            {vacationEmployeeNames[v.user_id] ?? "—"}
                          </p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stCls}`}>{stLabel}</span>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400">
                          {v.start_date} → {v.end_date} · {v.total_days} {lx.days ?? ""}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {lx.vacations_days_used ?? "Used"}: {used} / {DEFAULT_ANNUAL_VACATION_DAYS} ·{" "}
                          {lx.vacations_days_remaining ?? "Remaining"}: {rem}
                        </p>
                        {v.notes ? <p className="mt-1 text-xs text-zinc-500">{v.notes}</p> : null}
                        {canApproveVacations && v.status === "pending" ? (
                          <input
                            type="text"
                            value={vacAdminComment[v.id] ?? ""}
                            onChange={(e) =>
                              setVacAdminComment((prev) => ({ ...prev, [v.id]: e.target.value }))
                            }
                            placeholder={lx.schedule_vacation_comment ?? ""}
                            className="mt-2 min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                          />
                        ) : null}
                      </div>
                      {canApproveVacations && v.status === "pending" ? (
                        <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
                          <button
                            type="button"
                            onClick={() => void onApproveVacation?.(v.id, vacAdminComment[v.id] ?? "")}
                            className="min-h-[44px] min-w-[44px] rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500"
                          >
                            {labels.approve ?? ""}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onRejectVacation?.(v.id, vacAdminComment[v.id] ?? "")}
                            className="min-h-[44px] min-w-[44px] rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500"
                          >
                            {labels.reject ?? ""}
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {showCalendarTab && scheduleSubTab === "calendar" && (
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

          {canViewTeamAvailability && scheduleSubTab === "calendar" ? (
            <div className="mt-4 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <button
                type="button"
                onClick={() => setTeamAvailabilityOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left min-h-[44px] hover:bg-zinc-50 dark:hover:bg-slate-800/80"
                aria-expanded={teamAvailabilityOpen}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
                    {(labels as Record<string, string>).schedule_team_availability ?? ""}
                  </span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {availabilityWeekOffset === 0
                      ? ((labels as Record<string, string>).schedule_availability_this_week ?? "")
                      : availabilityWeekRangeLabel}
                  </span>
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform ${teamAvailabilityOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {teamAvailabilityOpen ? (
                <div className="border-t border-zinc-200 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-2 py-2 dark:border-slate-800 sm:px-3">
                    <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setAvailabilityWeekOffset((o) => o - 1)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-200 dark:hover:bg-slate-700"
                        aria-label={
                          (labels as Record<string, string>).schedule_prev_week ??
                          ALL_TRANSLATIONS.es.schedule_prev_week ??
                          "Previous week"
                        }
                      >
                        <ChevronLeft className="h-5 w-5" aria-hidden />
                      </button>
                      <span className="min-w-0 flex-1 text-center text-xs font-medium text-zinc-800 dark:text-zinc-100 sm:text-sm">
                        {availabilityWeekRangeLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAvailabilityWeekOffset((o) => o + 1)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-200 dark:hover:bg-slate-700"
                        aria-label={
                          (labels as Record<string, string>).schedule_next_week ??
                          ALL_TRANSLATIONS.es.schedule_next_week ??
                          "Next week"
                        }
                      >
                        <ChevronRight className="h-5 w-5" aria-hidden />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAvailabilityWeekOffset(0)}
                      disabled={availabilityWeekOffset === 0}
                      className="shrink-0 rounded-lg border border-amber-300 px-2.5 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:pointer-events-none disabled:opacity-40 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-950/30 min-h-[44px] min-w-[44px]"
                    >
                      {(labels as Record<string, string>).schedule_this_week_btn ??
                        ALL_TRANSLATIONS.es.schedule_this_week_btn ??
                        "Esta semana"}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[min(100%,520px)] text-xs sm:min-w-[640px]">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-slate-700">
                          <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left text-[10px] font-semibold text-zinc-700 dark:bg-slate-900 dark:text-zinc-200 sm:text-xs">
                            {(labels as Record<string, string>).personnel ?? ""}
                          </th>
                          {availabilityWeekYmds.map((ymd, i) => {
                            const keys = [
                              "monShort",
                              "tueShort",
                              "wedShort",
                              "thuShort",
                              "friShort",
                              "satShort",
                              "sunShort",
                            ] as const;
                            const k = keys[i] ?? "monShort";
                            return (
                              <th
                                key={ymd}
                                className="px-1 py-2 text-center text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 sm:text-xs"
                              >
                                <span className="block truncate">
                                  {(labels as Record<string, string>)[k] ?? ""}
                                </span>
                                <span className="font-normal text-zinc-500 dark:text-zinc-400">
                                  {ymd.slice(8)}
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {teamWeekAvailabilityRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400"
                            >
                              {(labels as Record<string, string>).noEntries ?? ""}
                            </td>
                          </tr>
                        ) : (
                          teamWeekAvailabilityRows.map(({ emp, cells }) => (
                            <tr
                              key={emp.id}
                              className="border-b border-zinc-100 dark:border-slate-800"
                            >
                              <td className="sticky left-0 z-10 max-w-[120px] truncate bg-white px-2 py-1.5 text-[10px] font-medium text-zinc-800 dark:bg-slate-900 dark:text-zinc-100 sm:max-w-[180px] sm:text-xs">
                                {resolveSchedulePerson(emp.id)}
                              </td>
                              {cells.map(({ ymd, count, title }) => (
                                <td key={ymd} className="px-0.5 py-1 align-middle text-center">
                                  <span
                                    title={title || undefined}
                                    className={`mx-auto block min-h-[26px] min-w-[26px] rounded-md sm:min-h-[32px] sm:min-w-[32px] ${
                                      count === 0
                                        ? "bg-emerald-100 dark:bg-emerald-900/35"
                                        : count === 1
                                          ? "bg-amber-100 dark:bg-amber-900/35"
                                          : "bg-red-100 dark:bg-red-900/35"
                                    }`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 px-3 py-2 text-[10px] text-zinc-500 dark:border-slate-800 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 shrink-0 rounded-sm bg-emerald-500" aria-hidden />
                      {(labels as Record<string, string>).schedule_available ?? ""}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 shrink-0 rounded-sm bg-amber-500" aria-hidden />
                      {(labels as Record<string, string>).schedule_busy ?? ""}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 shrink-0 rounded-sm bg-red-500" aria-hidden />
                      {(labels as Record<string, string>).schedule_availability_2plus ?? "2+"}
                    </span>
                  </p>
                  {canManageTeamAvailability ? (
                    <div className="border-t border-zinc-200 px-3 py-2 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={openNewEntryForm}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400 sm:w-auto min-h-[44px]"
                      >
                        <Plus className="h-4 w-4 shrink-0" aria-hidden />
                        {labels.addEntry ?? "Añadir turno"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {showTimesheetsTab && scheduleSubTab === "timesheets" && (
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
          showTimesheetCosts={canViewTimesheetCosts}
          canViewLaborCosting={canViewLaborCosting}
          timesheetCostCurrency={timesheetCostCurrency}
          employeeLaborRatesByEmployeeId={employeeLaborRatesByEmployeeId}
        />
      )}

      {showPayrollTab && scheduleSubTab === "payroll" && (
        <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label={lx.payroll_title ?? "Payroll"}>
            <button
              type="button"
              onClick={() => setPayrollPayMode("hours")}
              className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                payrollPayMode === "hours"
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
                  : "border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {lx.payroll_pay_toggle_hours ?? "Hours"}
            </button>
            <button
              type="button"
              onClick={() => setPayrollPayMode("production")}
              className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                payrollPayMode === "production"
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
                  : "border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {lx.payroll_pay_toggle_production ?? "Production"}
            </button>
          </div>
          {payrollPayMode === "hours" ? (
            <PayrollSchedulePanel
              labels={lx}
              companyName={companyName}
              companyId={companyId}
              companyLogoUrl={companyLogoUrl}
              timeZone={scheduleTz}
              dateLocale={dateLocale}
              countryCode={companyCountryForPayroll}
              currency={timesheetCostCurrency}
              employees={employees.map((e) => ({ id: e.id, name: e.name }))}
              clockEntries={clockEntries}
              employeeLaborRatesByEmployeeId={employeeLaborRatesByEmployeeId}
              profileToLegacyEmployeeId={profileToLegacyEmployeeId}
              currentUserProfileId={currentUserProfileId}
              viewAllPayroll={viewAll || canManagePayroll}
              canManagePayroll={canManagePayroll}
              canExportPayroll={canExportPayroll}
            />
          ) : (
            <ProductionPayrollSchedulePanel
              labels={lx}
              companyName={companyName}
              companyId={companyId}
              timeZone={scheduleTz}
              dateLocale={dateLocale}
              currency={timesheetCostCurrency}
              employees={employees.map((e) => ({ id: e.id, name: e.name }))}
              productionReports={productionReports}
              profileToLegacyEmployeeId={profileToLegacyEmployeeId}
              currentUserProfileId={currentUserProfileId}
              viewAll={viewAll || canManagePayroll}
              canExportPayroll={canExportPayroll}
            />
          )}
        </div>
      )}

      {selectedDay !== null && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 touch-none"
            aria-hidden
            onClick={() => setSelectedDay(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:inset-y-0 sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:max-h-full sm:max-w-md sm:rounded-none sm:rounded-l-2xl md:max-w-lg lg:max-w-xl">
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
                            {entry.type === "shift" && (
                              <p className="flex items-center gap-1.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                                <Briefcase className="h-4 w-4 shrink-0" />
                                <span className="truncate">
                                  {(proj?.name || entry.projectCode)?.trim()
                                    ? (proj?.name ?? entry.projectCode)
                                    : (lx.schedule_no_project ?? "Sin proyecto")}
                                </span>
                              </p>
                            )}
                            <p
                              className={`font-medium text-zinc-800 dark:text-zinc-200 ${
                                entry.type === "shift"
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
                            : ((((labels as Record<string, string>).clock_in_action) ??
                                ((labels as Record<string, string>).timeclock_clock_in) ??
                                labels.clockIn ??
                                "").trim() || "Fichar")}
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
          <div className="fixed left-1/2 top-1/2 z-50 max-h-[min(90dvh,90vh)] w-[min(95vw,calc(100%-2rem))] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:p-6 md:max-w-xl lg:max-w-2xl max-md:inset-x-0 max-md:bottom-0 max-md:left-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl max-md:pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                    {(labels as Record<string, string>).project ?? "Proyecto"}
                  </label>
                  <select
                    value={fProjectId}
                    onChange={(e) => setFProjectId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                  >
                    <option value="">
                      {(labels as Record<string, string>).schedule_shift_general_option ??
                        "Sin proyecto / General"}
                    </option>
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
                      const st = formEmployeeShiftStatus.get(emp.id) ?? { kind: "none" as const };
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
                            <p className="flex min-w-0 items-center gap-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {(st.kind === "busy" || st.kind === "partial") && (
                                <span
                                  className="inline-flex shrink-0"
                                  title={
                                    (labels as Record<string, string>).schedule_conflict_warning ?? ""
                                  }
                                >
                                  <AlertTriangle
                                    className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                                    aria-hidden
                                  />
                                </span>
                              )}
                              <span className="truncate">{emp.name}</span>
                            </p>
                            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{roleLine}</p>
                            {st.kind === "free" && formSelectedDatesSorted.length > 0 ? (
                              <span className="mt-1 inline-flex max-w-full rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                                <span className="truncate">
                                  {(labels as Record<string, string>).schedule_available ?? ""}
                                </span>
                              </span>
                            ) : null}
                            {st.kind === "partial" ? (
                              <span
                                className="mt-1 inline-flex max-w-full rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                                title={st.title}
                              >
                                <span className="truncate">
                                  {(labels as Record<string, string>).schedule_partial ?? ""}
                                </span>
                              </span>
                            ) : null}
                            {st.kind === "busy" ? (
                              <span
                                className="mt-1 inline-flex max-w-full rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                                title={st.title}
                              >
                                <span className="truncate">{st.badge}</span>
                              </span>
                            ) : null}
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
                      const dot =
                        inMonth && fEmployeeIds.length > 0
                          ? formCalendarDayAvailabilityDot.get(ymd)
                          : undefined;
                      return (
                        <button
                          key={`${ymd}-${day.getTime()}`}
                          type="button"
                          onClick={() => inMonth && dispatchShiftFormDates({ type: "click", ymd })}
                          disabled={!inMonth}
                          className={`relative flex aspect-square min-h-[36px] max-h-10 items-center justify-center rounded-lg text-xs font-medium sm:text-sm ${
                            !inMonth
                              ? "pointer-events-none opacity-30"
                              : selected
                                ? `bg-amber-500 text-white dark:bg-amber-600 ${isAnchor ? "ring-2 ring-amber-800 ring-offset-1 dark:ring-amber-300 dark:ring-offset-slate-900" : ""}`
                                : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-slate-800 dark:text-zinc-100 dark:hover:bg-slate-700"
                          }`}
                        >
                          {day.getDate()}
                          {dot === "busy" ? (
                            <span
                              className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-white dark:ring-slate-900"
                              aria-hidden
                            />
                          ) : dot === "free" ? (
                            <span
                              className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900"
                              aria-hidden
                            />
                          ) : null}
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
                  fEmployeeIds.length === 0 || (!editingEntryId && fDates.length === 0)
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
          <div className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 md:max-w-md lg:max-w-lg">
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
