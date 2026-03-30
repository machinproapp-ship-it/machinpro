"use client";

import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";

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

function formatDay(date: Date): string {
  return date.toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
  });
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
  shift: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100",
  meeting: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100",
  vacation: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100",
  training: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-100",
  company_event: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-100",
  collective_off: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  personal_leave: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-100",
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
  if (k === "vacation") return "bg-emerald-500";
  if (k === "training") return "bg-purple-500";
  if (k === "company_event") return "bg-pink-500";
  if (k === "collective_off") return "bg-slate-500";
  if (k === "personal_leave") return "bg-cyan-500";
  return "bg-zinc-500";
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
}: {
  clockEntries: ClockEntryForSchedule[];
  employees: SchedEmployee[];
  projects: SchedProject[];
  currentUserEmployeeId?: string;
  viewAll: boolean;
  labels: ScheduleModuleProps["labels"];
  employeeLabels?: Record<string, string>;
}) {
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

  const getEmployeeName = (id: string) => employees.find((e) => e.id === id)?.name ?? id;

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
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
          >
            <option value="">{(labels as Record<string, string>).personnel ?? "Todos"}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sheets.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 col-span-full">
            {labels.noEntries ?? "Sin hojas de horas"}
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
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {getEmployeeName(selectedSheet.employeeId)} · {selectedSheet.weekStart} – {selectedSheet.weekEnd}
              </h3>
              <button type="button" onClick={() => setSelectedSheetId(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <table className="w-full text-sm border-collapse">
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
                    <td className="py-2">{ent.clockIn}</td>
                    <td className="py-2">{ent.clockOut ?? "—"}</td>
                    <td className="py-2 text-right font-medium">{ent.hoursWorked.toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
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
}: ScheduleModuleProps) {
  const lx = labels as Record<string, string>;
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
  const [fProjectId, setFProjectId] = useState("");
  const [fDate, setFDate] = useState(toYMD(today));
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

  const monthNameKey = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][viewMonth] as keyof typeof labels;
  const monthName = (labels[monthNameKey] as string) ?? new Date(viewYear, viewMonth).toLocaleDateString("default", { month: "long" });

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

  const roleChips = useMemo(() => {
    const l = labels as Record<string, string>;
    const chips: { key: string; label: string }[] = [
      { key: "all", label: l.whFilterAll ?? "Todos" },
      { key: "admin", label: l.admin ?? "" },
      { key: "supervisor", label: l.supervisor ?? "" },
      { key: "worker", label: l.worker ?? "" },
      { key: "logistic", label: l.logistic ?? "" },
    ];
    for (const r of customRoles) {
      chips.push({ key: `custom:${r.id}`, label: r.name });
    }
    return chips;
  }, [labels, customRoles]);

  const selectEmployeesByRoleChip = useCallback(
    (key: string) => {
      if (key === "all") {
        setFEmployeeIds(employees.map((e) => e.id));
        return;
      }
      const ids = employees
        .filter((e) => (e.scheduleRoleKey ?? "") === key)
        .map((e) => e.id);
      setFEmployeeIds(ids);
    },
    [employees]
  );

  const resetForm = () => {
    setFType("shift");
    setFEmployeeIds([]);
    setFProjectId("");
    setFDate(toYMD(today));
    setFStart("07:00");
    setFEnd("16:00");
    setFNotes("");
    setFLabel("meeting");
    setFormOpen(false);
    setEditingEntryId(null);
  };

  const openEditForm = (entry: SchedEntry) => {
    if (entry.type === "vacation") return;
    setFType(entry.type === "event" ? "event" : "shift");
    setFEmployeeIds([...entry.employeeIds]);
    setFProjectId(entry.projectId ?? "");
    setFDate(entry.date);
    setFStart(entry.startTime);
    setFEnd(entry.endTime);
    setFNotes(entry.notes ?? "");
    setFLabel(entry.eventLabel ?? "meeting");
    setEditingEntryId(entry.id);
    setFormOpen(true);
  };

  const handleSave = () => {
    if (fEmployeeIds.length === 0) return;
    if (fType === "shift" && !fProjectId) return;
    const proj = projects.find((p) => p.id === fProjectId);
    const payload = {
      type: fType,
      employeeIds: fEmployeeIds,
      projectId: fType === "shift" ? fProjectId : undefined,
      projectCode: fType === "shift" ? proj?.projectCode : undefined,
      date: fDate,
      startTime: fStart,
      endTime: fEnd,
      notes: fNotes || undefined,
      eventLabel: fType === "event" ? fLabel : undefined,
      createdBy: currentUserEmployeeId ?? "admin",
    };
    if (editingEntryId) {
      onUpdateEntry?.(editingEntryId, payload);
    } else {
      onAddEntry?.(payload);
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
          {labels.schedule ?? "Horario"}
        </h2>
        {canWrite && scheduleSubTab === "calendar" && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
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
          aria-label={labels.schedule ?? "Schedule"}
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
            {labels.schedule ?? "Calendario"}
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
          <div className="flex flex-nowrap items-center gap-2 mb-4 w-full">
            <button
              type="button"
              onClick={prevMonth}
              className="shrink-0 rounded-lg border border-zinc-200 dark:border-slate-700 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px]"
            >
              ← {labels.previousMonth ?? "Anterior"}
            </button>
            <h3 className="flex-1 min-w-0 text-center text-sm sm:text-lg font-semibold text-zinc-900 dark:text-white capitalize truncate">
              {monthName} {viewYear}
            </h3>
            <button
              type="button"
              onClick={nextMonth}
              className="shrink-0 rounded-lg border border-zinc-200 dark:border-slate-700 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px]"
            >
              {labels.nextMonth ?? "Siguiente"} →
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="shrink-0 text-xs px-2.5 py-2 rounded-lg border border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400 min-h-[44px] font-medium"
            >
              {labels.today ?? "Hoy"}
            </button>
          </div>

          <HorizontalScrollFade className="-mx-4 px-0 sm:mx-0 sm:px-0">
            <div className="overflow-x-auto px-4 sm:overflow-visible sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0">
            <div className="grid grid-cols-7 gap-1 min-w-[320px]">
              {["monShort", "tueShort", "wedShort", "thuShort", "friShort", "satShort", "sunShort"].map((key, i) => (
                <div
                  key={key}
                  className="text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400 py-1"
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
                const useCompact = dayEntries.length > 1;
                const displayEntries = useCompact ? dayEntries.slice(0, 1) : dayEntries.slice(0, 3);
                const extraCount = useCompact
                  ? Math.max(0, dayEntries.length - 1)
                  : dayEntries.length > 3
                    ? dayEntries.length - 3
                    : 0;
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
                    className={`rounded-xl border p-1.5 sm:p-2 h-16 min-h-[64px] sm:h-24 sm:min-h-[96px] flex flex-col gap-0.5 cursor-pointer hover:ring-2 hover:ring-amber-400/50 transition-shadow ${
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
                    <div className="flex flex-col gap-0.5 min-h-0 overflow-hidden">
                      {useCompact ? (
                        <div className="flex items-center gap-1 justify-center min-h-[1.25rem]">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${entryColor(dayEntries[0]).replace(/text-\S+/g, "").trim() || "bg-amber-500"}`}
                            style={{ backgroundColor: "currentColor" }}
                            aria-hidden
                          />
                          <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 tabular-nums">
                            +{extraCount}
                          </span>
                        </div>
                      ) : (
                        <>
                          {displayEntries.map((entry) => (
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
                              className={`rounded px-1 py-0.5 text-[10px] truncate ${entryColor(entry)}`}
                              title={`${entry.startTime}–${entry.endTime} ${
                                entry.type === "shift"
                                  ? (entry.projectCode ?? "")
                                  : scheduleEntryTypeLabel(entry, lx)
                              }`}
                            >
                              {entry.type === "shift" && entry.projectCode && (
                                <span className="font-mono text-xs">{entry.projectCode}</span>
                              )}
                              {entry.type !== "shift" && scheduleEntryTypeLabel(entry, lx)}
                              {entry.type === "shift" && !entry.projectCode && (entry.startTime + "–" + entry.endTime)}
                            </div>
                          ))}
                          {extraCount > 0 && (
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">+{extraCount}</span>
                          )}
                        </>
                      )}
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
                {new Date(selectedDay + "T12:00:00").toLocaleDateString("es", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
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
                  {labels.noEntries ?? "Sin turnos este día"}
                </p>
              ) : (
                <ul className="space-y-3">
                  {entriesForDay(selectedDay).map((entry) => {
                    const proj = getProject(entry.projectId);
                    return (
                      <li
                        key={entry.id}
                        className={`rounded-xl border p-4 ${entryColor(entry)}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {entry.startTime} → {entry.endTime}
                            </p>
                            {entry.type === "shift" && proj && (
                              <p className="flex items-center gap-1.5 mt-1 text-sm">
                                <Briefcase className="h-4 w-4 shrink-0" />
                                {proj.name}
                              </p>
                            )}
                            {entry.type !== "shift" && (
                              <p className="text-sm mt-1">
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
                        ✓ {labels.clockInEntry ?? "Entrada"}: {todayEntry.clockIn}
                      </span>
                      {todayEntry.clockOut && (
                        <span className="text-zinc-500 dark:text-zinc-400">
                          · {labels.clockOutEntry ?? "Salida"}: {todayEntry.clockOut}
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
                  <div className="grid grid-cols-1 gap-3">
                    {!todayEntry ? (
                      clockInManualNeeded ? (
                        <button
                          type="button"
                          onClick={() => onClockIn?.()}
                          disabled={gpsStatus === "locating"}
                          className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base disabled:opacity-60 transition-colors min-h-[44px]"
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
                        className="h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold text-base disabled:opacity-60 transition-colors min-h-[44px]"
                      >
                        {gpsStatus === "locating"
                          ? (labels.gpsLocating ?? "Obteniendo ubicación…")
                          : (labels.clockOut ?? "Fichar Salida")}
                      </button>
                    ) : (
                      <div className="h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✓ {labels.clockInDone ?? "Jornada completada"}
                      </div>
                    )}
                  </div>
                  {clockInAlertMessage && (
                    <div className="rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start justify-between gap-2">
                      <p className="text-sm text-amber-800 dark:text-amber-200">{clockInAlertMessage}</p>
                      {onDismissClockInAlert && (
                        <button type="button" onClick={onDismissClockInAlert} className="shrink-0 p-1 rounded-lg hover:bg-amber-200/50 dark:hover:bg-amber-800/30 text-amber-700 dark:text-amber-300" aria-label="Cerrar">×</button>
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
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
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
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setFEmployeeIds(employees.map((e) => e.id))}
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
                <p className="text-xs text-zinc-500 mb-1">
                  {(labels as Record<string, string>).schedule_filter_by_role ?? ""}
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {roleChips.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => selectEmployeesByRoleChip(c.key)}
                      className="rounded-full border border-zinc-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium min-h-[44px] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-slate-800"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleEmployee(emp.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors min-h-[44px] ${
                        fEmployeeIds.includes(emp.id)
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                          : "border-zinc-200 dark:border-slate-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {emp.name[0]}
                      </span>
                      <span className="truncate">{emp.name}</span>
                    </button>
                  ))}
                </div>
                {fEmployeeIds.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {(labels as Record<string, string>).schedule_pick_employees_error ?? ""}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={fDate}
                  onChange={(e) => setFDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                />
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
                  fEmployeeIds.length === 0 || (fType === "shift" && !fProjectId)
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
