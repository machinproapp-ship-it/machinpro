"use client";

import { useState, useMemo } from "react";
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

export interface SchedEmployee {
  id: string;
  name: string;
  role: string;
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
  type: "shift" | "event";
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
  };
  onAddEntry?: (entry: Omit<SchedEntry, "id">) => void;
  onUpdateEntry?: (id: string, entry: Omit<SchedEntry, "id">) => void;
  onDeleteEntry?: (id: string) => void;
  clockEntries?: ClockEntryForSchedule[];
  clockInProjectCode?: string;
  setClockInProjectCode?: (v: string) => void;
  gpsStatus?: "idle" | "locating" | "ok" | "alert" | "no_gps";
  clockInAlertMessage?: string | null;
  onDismissClockInAlert?: () => void;
  onClockIn?: () => void;
  onClockOut?: () => void;
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
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
};

function entryColor(entry: SchedEntry): string {
  if (entry.type === "shift") return EVENT_COLORS.shift;
  return EVENT_COLORS[entry.eventLabel ?? "other"] ?? EVENT_COLORS.other;
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
}: {
  clockEntries: ClockEntryForSchedule[];
  employees: SchedEmployee[];
  projects: SchedProject[];
  currentUserEmployeeId?: string;
  viewAll: boolean;
  labels: ScheduleModuleProps["labels"];
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
}: ScheduleModuleProps) {
  const today = new Date();
  const todayYmd = toYMD(today);
  const todayEntry = clockEntries.find(
    (e) =>
      e.employeeId === (currentUserEmployeeId ?? "") &&
      e.date === todayYmd
  );
  const [scheduleSubTab, setScheduleSubTab] = useState<"calendar" | "timesheets">("calendar");
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [deleteConfirmEntryId, setDeleteConfirmEntryId] = useState<string | null>(null);

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

  const mapsUrl = (proj: SchedProject) =>
    proj.locationLat != null && proj.locationLng != null
      ? `https://maps.google.com/?q=${proj.locationLat},${proj.locationLng}`
      : `https://maps.google.com/?q=${encodeURIComponent(proj.location ?? proj.name)}`;

  const toggleEmployee = (id: string) =>
    setFEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
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
    setFType(entry.type);
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

      <div className="flex border-b border-zinc-200 dark:border-zinc-700 gap-0">
        <button
          type="button"
          onClick={() => setScheduleSubTab("calendar")}
          className={`px-4 py-2.5 text-sm font-medium min-h-[44px] border-b-2 transition-colors ${
            scheduleSubTab === "calendar"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          {labels.schedule ?? "Calendario"}
        </button>
        <button
          type="button"
          onClick={() => setScheduleSubTab("timesheets")}
          className={`px-4 py-2.5 text-sm font-medium min-h-[44px] border-b-2 transition-colors ${
            scheduleSubTab === "timesheets"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          {labels.timesheets ?? "Hojas de horas"}
        </button>
      </div>

      {scheduleSubTab === "calendar" && (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg border border-zinc-200 dark:border-slate-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px]"
            >
              ← {labels.previousMonth ?? "Anterior"}
            </button>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white capitalize">
                {monthName} {viewYear}
              </h3>
              <button
                type="button"
                onClick={goToToday}
                className="text-xs px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400 min-h-[44px]"
              >
                {labels.today ?? "Hoy"}
              </button>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg border border-zinc-200 dark:border-slate-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px]"
            >
              {labels.nextMonth ?? "Siguiente"} →
            </button>
          </div>

          <div className="overflow-x-auto -mx-4 px-4 sm:overflow-visible sm:mx-0 sm:px-0">
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
                const displayEntries = dayEntries.slice(0, 3);
                const extraCount = dayEntries.length > 3 ? dayEntries.length - 3 : 0;
                return (
                  <div
                    key={ymd}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDay(ymd)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedDay(ymd);
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
                      {displayEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`rounded px-1 py-0.5 text-[10px] truncate ${entryColor(entry)}`}
                          title={`${entry.startTime}–${entry.endTime} ${entry.projectCode ?? entry.eventLabel ?? ""}`}
                        >
                          {entry.type === "shift" && entry.projectCode && (
                            <span className="font-mono text-xs">{entry.projectCode}</span>
                          )}
                          {entry.type !== "shift" && (entry.eventLabel ?? "—")}
                          {entry.type === "shift" && !entry.projectCode && (entry.startTime + "–" + entry.endTime)}
                        </div>
                      ))}
                      {extraCount > 0 && (
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">+{extraCount}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            {[
              { key: "shift", label: "Turno en proyecto" },
              { key: "meeting", label: "Reunión" },
              { key: "vacation", label: "Vacaciones" },
              { key: "training", label: "Formación" },
              { key: "other", label: "Otro" },
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
                                {entry.notes ?? entry.eventLabel ?? "Evento"}
                              </p>
                            )}
                          </div>
                          {canWrite && (
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
                          {entry.employeeIds
                            .map((id) => getEmployee(id)?.name ?? id)
                            .filter(Boolean)
                            .join(", ")}
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
                            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            Ver en Maps
                          </a>
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
                  {!todayEntry?.clockOut && (
                    <div>
                      <input
                        type="text"
                        value={clockInProjectCode}
                        onChange={(e) =>
                          setClockInProjectCode?.(e.target.value.toUpperCase())
                        }
                        placeholder={labels.projectCodePlaceholder ?? "Código de proyecto (ej: MON-01)"}
                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-mono tracking-wider uppercase text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                      />
                      {clockInProjectCode &&
                        (() => {
                          const found = projects.find(
                            (p) =>
                              (p.projectCode ?? "").toUpperCase() ===
                              clockInProjectCode.trim().toUpperCase()
                          );
                          return found ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                              ✓ {found.name}
                            </p>
                          ) : (
                            <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                              {labels.projectCodeNotFound ?? "Código no encontrado"}
                            </p>
                          );
                        })()}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3">
                    {!todayEntry ? (
                      <button
                        type="button"
                        onClick={onClockIn}
                        disabled={gpsStatus === "locating"}
                        className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base disabled:opacity-60 transition-colors"
                      >
                        {gpsStatus === "locating"
                          ? (labels.gpsLocating ?? "Obteniendo ubicación…")
                          : (labels.clockIn ?? "Fichar Entrada")}
                      </button>
                    ) : !todayEntry.clockOut ? (
                      <button
                        type="button"
                        onClick={onClockOut}
                        disabled={gpsStatus === "locating"}
                        className="h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold text-base disabled:opacity-60 transition-colors"
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
                    Tipo de evento
                  </label>
                  <select
                    value={fLabel}
                    onChange={(e) => setFLabel(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                  >
                    <option value="meeting">Reunión</option>
                    <option value="vacation">Vacaciones</option>
                    <option value="training">Formación</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              )}

              {fType === "shift" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Proyecto *
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
                  Empleados *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
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
                    Selecciona al menos un empleado
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
