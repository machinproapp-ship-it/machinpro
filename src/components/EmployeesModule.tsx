"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  Search,
  Mail,
  Phone,
  Camera,
  Shield,
  FolderKanban,
  Palmtree,
  UserPlus,
  Plus,
  Download,
  FileText,
  Pencil,
  X,
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  LogOut,
  Trash2,
  Loader2,
} from "lucide-react";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import { SafetyPassportPanel } from "@/components/SafetyPassportPanel";
import { useToast } from "@/components/Toast";
import { csvCell, downloadCsvUtf8, fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";
import { supabase } from "@/lib/supabase";
import {
  formatCalendarYmd,
  formatDate,
  formatTimeHm,
  formatTodayYmdInTimeZone,
  resolveUserTimezone,
  weekYmdsMondayFirstInTimeZone,
  zonedYmdHmToUtcIso,
} from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";
import type { CustomRole, RolePermissions } from "@/types/roles";
import {
  ROLE_PERMISSION_KEYS,
  ROLE_PERMISSION_LABELS,
  emptyRolePermissionsInline,
  permLocaleKey,
  pickDefaultWorkerRoleId,
} from "@/types/roles";
import type { EmployeeDocument } from "@/lib/employeeDocumentUtils";
import {
  computeEmployeeDocStatus,
  employeeDocDisplayName,
  employeeDocumentRowNeedsRedHighlight,
  worstEmployeeDocStatus,
} from "@/lib/employeeDocumentUtils";
import type {
  ComplianceField,
  ComplianceRecord,
  ScheduleEntry,
  VacationRequestRow,
} from "@/types/homePage";

const EmployeeGpsRouteTab = dynamic(
  () => import("@/components/EmployeeGpsRouteTab").then((m) => m.EmployeeGpsRouteTab),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[300px] md:h-[450px] animate-pulse rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-100 dark:bg-slate-800/80"
        aria-hidden
      />
    ),
  }
);

export interface EmployeesModuleProps {
  companyId: string | null;
  /** `companies.country_code` — plantillas de documentos (create vía API usa el mismo país). */
  companyCountryCode?: string;
  /** Para nombre de archivo CSV export. */
  companyName?: string | null;
  /** Moneda por defecto del perfil empresa (ajustes). */
  defaultPayCurrency?: string;
  labels: Record<string, string>;
  customRoles: CustomRole[];
  projects: { id: string; name: string; archived?: boolean }[];
  canManageEmployees: boolean;
  /** admin o permiso canManageEmployees — eliminar empleado */
  canDeleteEmployee?: boolean;
  /** admin o permiso canManageEmployees — botón invitar / nuevo */
  showNewEmployeeButton?: boolean;
  /** Solo administrador ve el pasaporte de otros; el empleado ve el suyo. */
  viewerIsAdmin?: boolean;
  /** Ver datos salariales de otros (además de admin / gestión). */
  canViewLaborCosting?: boolean;
  /** Pestaña ruta GPS en ficha (canViewAttendance). */
  canViewEmployeeGpsRoute?: boolean;
  /** Mini calendario de turnos de la semana en ficha (canViewTeamAvailability). */
  canViewTeamAvailabilityInProfile?: boolean;
  /** Perfil Supabase: permite cambiar propia foto */
  currentUserProfileId?: string | null;
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  /** user_profiles.id → legacy employees.id (compliance targetId) */
  userProfileToEmployeeId?: Record<string, string>;
  complianceFields?: ComplianceField[];
  complianceRecords?: ComplianceRecord[];
  onComplianceRecordsChange?: (records: ComplianceRecord[]) => void;
  vacationRequests?: VacationRequestRow[];
  /** Turnos / planificación (misma fuente que el calendario Central). */
  scheduleEntries?: ScheduleEntry[];
  /** Vuelve a Central (pestaña Oficina). */
  onBackToOffice?: () => void;
  dateLocale?: string;
  timeZone?: string;
  clockEntries?: Array<{
    id: string;
    employeeId: string;
    date: string;
    clockIn: string;
    clockOut?: string;
    projectId?: string;
  }>;
  /** Permiso fichar propio (lectura o contexto). */
  canClockInPersonal?: boolean;
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
}

type ProfileRow = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  role?: string | null;
  company_id?: string | null;
  employee_id?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  vacation_days_allowed?: number | null;
  /** Cupo anual para balance en Horario (solicitud vacaciones); distinto de días bajo política opcional. */
  vacation_days_per_year?: number | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  custom_role_id?: string | null;
  /** Relación `roles` vía FK custom_role_id (si existe en Supabase). */
  roles?:
    | { name?: string | null; permissions?: unknown; is_system?: boolean | null }
    | { name?: string | null; permissions?: unknown; is_system?: boolean | null }[]
    | null;
  custom_permissions?: Partial<RolePermissions> | null;
  use_role_permissions?: boolean | null;
  profile_status?: string | null;
  created_at?: string | null;
  pay_type?: string | null;
  pay_amount?: number | null;
  pay_currency?: string | null;
  pay_period?: string | null;
  /** AH-17 labor costing (optional). */
  hourly_rate?: number | null;
  vacation_policy_enabled?: boolean | null;
};

type EmployeeDocRow = {
  id: string;
  user_id: string;
  name: string;
  name_key?: string | null;
  file_url?: string | null;
  expiry_date?: string | null;
  alert_days?: number | null;
  required?: boolean | null;
  deleted_at?: string | null;
  created_at?: string | null;
};

function employeeDocRowToDocument(r: EmployeeDocRow): EmployeeDocument {
  return {
    id: r.id,
    name: r.name,
    nameKey: r.name_key ?? undefined,
    expiryDate: r.expiry_date ? String(r.expiry_date).slice(0, 10) : undefined,
    documentUrl: r.file_url ?? undefined,
    alertDays: r.alert_days ?? 30,
    required: r.required ?? undefined,
  };
}

function employeeDocFleetBadge(
  docs: EmployeeDocument[] | undefined,
  labels: Record<string, string>
): React.ReactNode | null {
  if (!docs?.length) return null;
  const w = worstEmployeeDocStatus(docs);
  if (w === "ok")
    return (
      <span className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        {labels.valid ?? "Al día"}
      </span>
    );
  if (w === "soon")
    return (
      <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        {labels.expiring ?? "Vence pronto"}
      </span>
    );
  if (w === "expired")
    return (
      <span className="inline-flex rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
        {labels.expired ?? "Vencido"}
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
      {labels.missing ?? "Sin fecha"}
    </span>
  );
}

function employeeDocStatusBadge(
  st: ReturnType<typeof computeEmployeeDocStatus>,
  labels: Record<string, string>
): React.ReactNode {
  if (st === "ok")
    return (
      <span className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        {labels.valid ?? ""}
      </span>
    );
  if (st === "soon")
    return (
      <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        {labels.expiring ?? ""}
      </span>
    );
  if (st === "expired")
    return (
      <span className="inline-flex rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
        {labels.expired ?? ""}
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
      {labels.missing ?? ""}
    </span>
  );
}

function coercePayAmount(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function emailLocalPart(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  if (!e) return "";
  const at = e.indexOf("@");
  if (at <= 0) return e;
  return e.slice(0, at).trim() || e;
}

/** full_name → display_name → email local → "Tú" (self) → anonymous+4chars (nunca UUID largo ni email entero). */
function employeeDisplayLabel(
  r: ProfileRow,
  labels?: Record<string, string>,
  selfProfileId?: string | null
): string {
  if (selfProfileId && r.id === selfProfileId) {
    const you = (labels?.common_you ?? "").trim();
    if (you) return you;
  }
  const fn = (r.full_name ?? "").trim();
  const dn = (r.display_name ?? "").trim();
  const em = (r.email ?? "").trim();
  const local = emailLocalPart(em);
  const anonPrefix = (labels?.employees_display_anonymous ?? labels?.worker ?? "").trim() || "Employee";
  const idFrag = r.id.replace(/-/g, "").slice(0, 4).toLowerCase();
  if (fn) return fn;
  if (dn) return dn;
  if (local) return local;
  if (anonPrefix && idFrag) return `${anonPrefix} ${idFrag}`.trim();
  const none = (labels?.common_no_name ?? "").trim();
  if (none) return none;
  return "—";
}

function initialsFromPersonName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) {
    const w = p[0]!;
    return w.length >= 2 ? w.slice(0, 2).toUpperCase() : w.slice(0, 1).toUpperCase();
  }
  return (p[0]![0]! + p[p.length - 1]![0]!).toUpperCase();
}

function initialsFromEmailLocal(local: string): string {
  const s = local.trim();
  if (!s) return "?";
  const parts = s.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  if (s.length >= 2) return (s[0]! + s[s.length - 1]!).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function employeeInitials(r: ProfileRow): string {
  const fn = (r.full_name ?? "").trim();
  const dn = (r.display_name ?? "").trim();
  const fromName = fn || dn;
  if (fromName) return initialsFromPersonName(fromName);
  const em = (r.email ?? "").trim();
  if (em) return initialsFromEmailLocal(emailLocalPart(em) || em);
  return r.id.replace(/-/g, "").slice(0, 2).toUpperCase() || "?";
}

function permLabel(key: keyof RolePermissions, t: Record<string, string>): string {
  const lx = t as Record<string, string>;
  const fromT = lx[permLocaleKey(key)];
  if (fromT) return fromT;
  return ROLE_PERMISSION_LABELS[key] ?? String(key);
}

function emptyPermissions(): RolePermissions {
  return emptyRolePermissionsInline();
}

function mergePerm(base: RolePermissions, partial?: Partial<RolePermissions> | null): RolePermissions {
  return { ...base, ...(partial ?? {}) };
}

function complianceTone(
  status: ComplianceRecord["status"],
  t: Record<string, string>
): { cls: string; label: string } {
  if (status === "valid")
    return {
      cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
      label: t.valid ?? "",
    };
  if (status === "expiring")
    return {
      cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
      label: t.expiring ?? "",
    };
  if (status === "expired")
    return { cls: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200", label: t.expired ?? "" };
  return {
    cls: "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300",
    label: t.missing ?? "",
  };
}

function employeeComplianceFieldLabel(field: ComplianceField, t: Record<string, string>): string {
  const m: Record<string, string> = {
    "cf-liability": "compliance_field_liability_insurance",
    "cf-compliance": "compliance_field_provincial_compliance",
    "cf-vehicle-inspection": "compliance_field_safety_inspection",
    "cf-vehicle-insurance": "compliance_field_vehicle_insurance",
  };
  const lk = m[field.id];
  return lk ? (t[lk] ?? field.name) : field.name;
}

function recordStatusFromInputs(
  expiryDate: string | undefined,
  alertDaysBefore: number,
  fieldType: string
): ComplianceRecord["status"] {
  if (fieldType === "date" && expiryDate) {
    const d = new Date(expiryDate);
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (days < 0) return "expired";
    if (days <= alertDaysBefore) return "expiring";
    return "valid";
  }
  if (expiryDate || fieldType === "document") return "valid";
  return "missing";
}

const YEAR_START = new Date(new Date().getFullYear(), 0, 1);
const YEAR_END = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

const PAY_CURRENCIES = ["CAD", "USD", "EUR", "GBP", "MXN", "BRL", "ARS", "COP", "CLP", "PEN"] as const;

export function EmployeesModule({
  companyId,
  companyCountryCode,
  companyName = "",
  defaultPayCurrency = "CAD",
  labels: t,
  customRoles,
  projects,
  canManageEmployees,
  canDeleteEmployee: canDeleteEmployeeProp,
  showNewEmployeeButton = false,
  viewerIsAdmin = false,
  canViewLaborCosting = false,
  canViewEmployeeGpsRoute = false,
  canViewTeamAvailabilityInProfile = false,
  currentUserProfileId = null,
  cloudinaryCloudName = "",
  cloudinaryUploadPreset = "",
  userProfileToEmployeeId = {},
  complianceFields = [],
  complianceRecords = [],
  onComplianceRecordsChange,
  vacationRequests = [],
  scheduleEntries,
  onBackToOffice,
  dateLocale = "en-US",
  timeZone: timeZoneProp,
  clockEntries = [],
  canClockInPersonal = false,
  onManualClockIn,
  onManualClockOut,
}: EmployeesModuleProps) {
  const { showToast } = useToast();
  void useMachinProDisplayPrefs();
  const timeZone = timeZoneProp ?? resolveUserTimezone(null);
  const canDelete = canDeleteEmployeeProp !== undefined ? canDeleteEmployeeProp : canManageEmployees;
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<ProfileRow>>({});
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [employeeDocsByUser, setEmployeeDocsByUser] = useState<Record<string, EmployeeDocRow[]>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    customRoleId: "",
    profileStatus: "active",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    payType: "unspecified" as "unspecified" | "fixed" | "hourly" | "production",
    payAmount: "",
    payCurrency: "CAD",
    payPeriod: "monthly" as "monthly" | "biweekly" | "weekly",
    manageVacations: false,
    vacationDaysAnnual: "",
    useRolePermissions: true,
    customPermissions: {} as Partial<RolePermissions>,
  });
  const [complianceEdit, setComplianceEdit] = useState<{
    field: ComplianceField;
    expiryDate: string;
    documentUrl: string;
    value: string;
  } | null>(null);
  const [employeeDeleteModalOpen, setEmployeeDeleteModalOpen] = useState(false);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [hardDeleteConfirmInput, setHardDeleteConfirmInput] = useState("");
  const [hardDeleteBusy, setHardDeleteBusy] = useState(false);
  const [forceLogoutModalOpen, setForceLogoutModalOpen] = useState(false);
  const [forceLogoutBusy, setForceLogoutBusy] = useState(false);
  const [employeesBrowseTab, setEmployeesBrowseTab] = useState<"people" | "compliance">("people");
  const [fichajeInOpen, setFichajeInOpen] = useState(false);
  const [fichajeOutOpen, setFichajeOutOpen] = useState(false);
  const [fichajeProjectId, setFichajeProjectId] = useState("");
  const [fichajeTime, setFichajeTime] = useState("");
  const [fichajeNotes, setFichajeNotes] = useState("");
  const [fichajeSaving, setFichajeSaving] = useState(false);
  const [employeeDetailTab, setEmployeeDetailTab] = useState<"info" | "route">("info");
  const [employeeHasGpsData, setEmployeeHasGpsData] = useState(false);
  const paySectionRef = useRef<HTMLElement | null>(null);

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.archived),
    [projects]
  );

  void companyCountryCode;

  const load = useCallback(async () => {
    if (!companyId) {
      setRows([]);
      setEmployeeDocsByUser({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const withJoin = await supabase
      .from("user_profiles")
      .select("*, roles!custom_role_id(name, permissions, is_system)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    const { data, error } =
      withJoin.error?.code === "PGRST200" || withJoin.error?.message?.includes("relationship")
        ? await supabase
            .from("user_profiles")
            .select("*")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
        : withJoin;
    if (error) {
      console.error(error);
      setRows([]);
      setEmployeeDocsByUser({});
    } else {
      setRows((data ?? []) as ProfileRow[]);
    }
    const { data: edocs, error: edocsErr } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("company_id", companyId);
    if (edocsErr) {
      console.error("[EmployeesModule] employee_documents", edocsErr);
      setEmployeeDocsByUser({});
    } else {
      const buckets: Record<string, EmployeeDocRow[]> = {};
      for (const raw of edocs ?? []) {
        const r = raw as EmployeeDocRow;
        if (r.deleted_at) continue;
        const uid = r.user_id;
        if (!buckets[uid]) buckets[uid] = [];
        buckets[uid].push(r);
      }
      setEmployeeDocsByUser(buckets);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createOpen || customRoles.length === 0) return;
    setCreateForm((f) =>
      f.customRoleId && customRoles.some((c) => c.id === f.customRoleId)
        ? f
        : {
            ...f,
            customRoleId:
              pickDefaultWorkerRoleId(customRoles) ||
              customRoles[0]?.id ||
              "",
          }
    );
  }, [createOpen, customRoles]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const employeeDocs = useMemo(() => {
    if (!selectedId) return [];
    return employeeDocsByUser[selectedId] ?? [];
  }, [selectedId, employeeDocsByUser]);

  useEffect(() => {
    setEmployeeDetailTab("info");
  }, [selectedId]);

  useEffect(() => {
    if (!supabase || !canViewEmployeeGpsRoute || !selected?.id) {
      setEmployeeHasGpsData(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { count, error } = await supabase
        .from("gps_tracking")
        .select("id", { count: "exact", head: true })
        .eq("user_id", selected.id)
        .eq("company_id", companyId);
      if (!cancelled && !error) setEmployeeHasGpsData((count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, canViewEmployeeGpsRoute, companyId]);

  useEffect(() => {
    if (!employeeHasGpsData) setEmployeeDetailTab("info");
  }, [employeeHasGpsData]);

  const weekYmds = useMemo(() => weekYmdsMondayFirstInTimeZone(timeZone), [timeZone]);

  const scheduleShiftsByWeekDay = useMemo(() => {
    if (scheduleEntries === undefined || !selected) return null;
    const ids = new Set<string>();
    ids.add(selected.id);
    const mapped = userProfileToEmployeeId[selected.id];
    if (mapped) ids.add(mapped);
    if (selected.employee_id) ids.add(String(selected.employee_id));
    const map = new Map<string, ScheduleEntry[]>();
    for (const y of weekYmds) map.set(y, []);
    for (const e of scheduleEntries) {
      if (e.type !== "shift") continue;
      if (!weekYmds.includes(e.date)) continue;
      if (!(e.employeeIds ?? []).some((id) => ids.has(id))) continue;
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    for (const y of weekYmds) {
      const arr = map.get(y) ?? [];
      arr.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
      map.set(y, arr);
    }
    return map;
  }, [scheduleEntries, selected, weekYmds, userProfileToEmployeeId]);

  useEffect(() => {
    if (selected) {
      const inherit =
        selected.use_role_permissions != null
          ? selected.use_role_permissions
          : selected.custom_permissions == null;
      let pt = (selected.pay_type ?? "").trim().toLowerCase();
      if (pt === "salary") pt = "fixed";
      if (pt !== "fixed" && pt !== "hourly" && pt !== "production") pt = "";
      const payAmt = coercePayAmount(selected.pay_amount);
      const laborHr = coercePayAmount(selected.hourly_rate);
      const rawVac = selected.vacation_days_allowed;
      let vacationDaysAllowed: number | null = null;
      if (rawVac != null && String(rawVac).trim() !== "") {
        const n = typeof rawVac === "number" ? rawVac : parseInt(String(rawVac).trim(), 10);
        if (Number.isFinite(n) && !Number.isNaN(n)) vacationDaysAllowed = n;
      }
      let vacationDaysPerYear: number | null = 20;
      const rawVpy = selected.vacation_days_per_year;
      if (rawVpy != null && String(rawVpy).trim() !== "") {
        const ny = typeof rawVpy === "number" ? rawVpy : parseInt(String(rawVpy).trim(), 10);
        if (Number.isFinite(ny) && !Number.isNaN(ny) && ny >= 0) vacationDaysPerYear = Math.min(366, ny);
      }
      setDraft({
        ...selected,
        pay_type: pt === "" ? "unspecified" : pt,
        pay_amount: payAmt,
        pay_currency: (selected.pay_currency ?? "CAD").trim() || "CAD",
        pay_period: (selected.pay_period ?? "monthly").trim() || "monthly",
        hourly_rate: laborHr,
        vacation_policy_enabled:
          selected.vacation_policy_enabled === true ||
          (selected.vacation_policy_enabled == null && Boolean(selected.vacation_days_allowed)),
        vacation_days_allowed: vacationDaysAllowed,
        vacation_days_per_year: vacationDaysPerYear,
        use_role_permissions: inherit,
        custom_permissions: inherit ? {} : (selected.custom_permissions ?? {}) as Partial<RolePermissions>,
      });
    }
  }, [selected]);

  const loadAssignments = useCallback(async () => {
    if (!supabase || !companyId || !selectedId) {
      setAssignedProjectIds([]);
      return;
    }
    const { data: pj } = await supabase
      .from("employee_projects")
      .select("project_id")
      .eq("user_id", selectedId)
      .eq("company_id", companyId);
    if (pj) {
      setAssignedProjectIds((pj as { project_id: string }[]).map((r) => r.project_id));
    } else {
      setAssignedProjectIds([]);
    }
  }, [companyId, selectedId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const complianceTargetId = (profileId: string) =>
    userProfileToEmployeeId[profileId] ?? profileId;

  const employeeTargetComplianceFields = useMemo(
    () => complianceFields.filter((f) => f.target.includes("employee")),
    [complianceFields]
  );

  const roleLabel = (r: ProfileRow) => {
    const cr = r.custom_role_id ? customRoles.find((x) => x.id === r.custom_role_id) : undefined;
    if (cr?.name) return cr.name;
    const lx = t as Record<string, string>;
    const roleMap: Record<string, string> = {
      admin: lx.admin ?? "",
      supervisor: lx.supervisor ?? "",
      worker: lx.worker ?? "",
      logistic: lx.logistic ?? "",
    };
    const base = (r.role ?? "").trim();
    return roleMap[base] ?? base ?? lx.personnel ?? "";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const label = employeeDisplayLabel(r, t as Record<string, string>, currentUserProfileId ?? null).toLowerCase();
      const em = (r.email ?? "").toLowerCase();
      if (q && !label.includes(q) && !em.includes(q) && !r.id.toLowerCase().includes(q)) return false;

      if (roleFilter !== "all") {
        if (roleFilter.startsWith("custom:")) {
          const rid = roleFilter.slice(7);
          if ((r.custom_role_id ?? "") !== rid) return false;
        } else if ((r.role ?? "") !== roleFilter) return false;
      }

      const st = r.profile_status ?? "active";
      if (statusFilter !== "all" && st !== statusFilter) return false;
      return true;
    });
  }, [rows, search, roleFilter, statusFilter, t, currentUserProfileId]);

  const exportEmployeesCsv = useCallback(() => {
    const lx = t as Record<string, string>;
    try {
      const headers = [
        lx.employees_full_name ?? lx.employees_title ?? "Name",
        lx.email ?? "Email",
        lx.phone ?? "Phone",
        lx.employees_role ?? lx.employees_assigned_role ?? "Role",
        lx.employees_status ?? lx.common_status ?? "Status",
        lx.employees_joined ?? lx.employees_start_date ?? "Created",
      ];
      const lines = [headers.map((h) => csvCell(h)).join(",")];
      for (const r of filtered) {
        const st =
          r.profile_status === "inactive"
            ? (lx.common_inactive ?? r.profile_status ?? "")
            : r.profile_status === "invited"
              ? (lx.employees_status_invited ?? r.profile_status ?? "")
              : r.profile_status === "deleted"
                ? (lx.employees_status_deleted ?? r.profile_status ?? "")
                : (lx.common_active ?? r.profile_status ?? "active");
        const created = r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : "";
        lines.push(
          [
            csvCell(employeeDisplayLabel(r, lx, currentUserProfileId ?? null)),
            csvCell(r.email),
            csvCell(r.phone),
            csvCell(roleLabel(r)),
            csvCell(st),
            csvCell(created),
          ].join(",")
        );
      }
      const slug = fileSlugCompany(companyName ?? "", companyId ?? "co");
      downloadCsvUtf8(`empleados_${slug}_${filenameDateYmd()}.csv`, lines);
      showToast("success", lx.export_success ?? "Export completed");
    } catch {
      showToast("error", lx.export_error ?? "Export error");
    }
  }, [t, filtered, currentUserProfileId, companyName, companyId, roleLabel, showToast]);

  const vacationsForSelected = useMemo(() => {
    if (!selectedId) return [];
    return vacationRequests.filter((v) => v.user_id === selectedId);
  }, [vacationRequests, selectedId]);

  const vacationStats = useMemo(() => {
    const yStart = YEAR_START.toISOString().slice(0, 10);
    const yEnd = YEAR_END.toISOString().slice(0, 10);
    let used = 0;
    let pending = 0;
    for (const v of vacationsForSelected) {
      const overlapsYear = v.start_date <= yEnd && v.end_date >= yStart;
      if (!overlapsYear) continue;
      if (v.status === "approved") used += v.total_days;
      else if (v.status === "pending") pending += v.total_days;
    }
    return { used, pending };
  }, [vacationsForSelected]);

  const selectedRolePermissions = useMemo((): RolePermissions => {
    const rid = draft.custom_role_id ?? selected?.custom_role_id;
    const role = rid ? customRoles.find((x) => x.id === rid) : undefined;
    return role?.permissions ?? emptyPermissions();
  }, [draft.custom_role_id, selected?.custom_role_id, customRoles]);

  const effectivePermissionValue = (key: keyof RolePermissions): boolean => {
    const inherit = draft.use_role_permissions !== false;
    if (inherit) return Boolean(selectedRolePermissions[key]);
    return Boolean((draft.custom_permissions ?? {})[key]);
  };

  const createSelectedRolePermissions = useMemo((): RolePermissions => {
    const role = customRoles.find((x) => x.id === createForm.customRoleId);
    return role?.permissions ?? emptyPermissions();
  }, [customRoles, createForm.customRoleId]);

  const createEffectivePermissionValue = (key: keyof RolePermissions): boolean => {
    if (createForm.useRolePermissions) return Boolean(createSelectedRolePermissions[key]);
    return Boolean((createForm.customPermissions ?? {})[key]);
  };

  const toggleCreatePermission = (key: keyof RolePermissions) => {
    if (!canManageEmployees || createForm.useRolePermissions) return;
    setCreateForm((f) => {
      const base = (f.customPermissions ?? {}) as Partial<RolePermissions>;
      return { ...f, customPermissions: { ...base, [key]: !base[key] } };
    });
  };

  const saveProfile = async () => {
    if (!selected) return;
    if ((selected.profile_status ?? "") === "deleted") return;
    const isSelf = currentUserProfileId != null && selected.id === currentUserProfileId;
    const workerSelf = isSelf && !canManageEmployees;
    if (!canManageEmployees && !isSelf) return;
    setSaving(true);
    if (workerSelf) {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          full_name: draft.full_name ?? selected.full_name,
          phone: draft.phone ?? null,
          avatar_url: draft.avatar_url ?? selected.avatar_url ?? null,
          emergency_contact_name: draft.emergency_contact_name ?? null,
          emergency_contact_phone: draft.emergency_contact_phone ?? null,
          emergency_contact_relation: draft.emergency_contact_relation ?? null,
        })
        .eq("id", selected.id);
      setSaving(false);
      if (!error) void load();
      return;
    }
    const inherit = draft.use_role_permissions !== false;
    const payType = draft.pay_type ?? "unspecified";
    const payAmountRaw = draft.pay_amount;
    const payAmount =
      payType === "unspecified"
        ? null
        : typeof payAmountRaw === "number" && !Number.isNaN(payAmountRaw)
          ? payAmountRaw
          : payAmountRaw != null
            ? Number(payAmountRaw)
            : null;
    const payload = {
      full_name: draft.full_name ?? selected.full_name,
      phone: draft.phone ?? null,
      avatar_url: draft.avatar_url ?? selected.avatar_url,
      vacation_policy_enabled: Boolean(draft.vacation_policy_enabled),
      vacation_days_allowed: draft.vacation_policy_enabled ? draft.vacation_days_allowed ?? null : null,
      vacation_days_per_year: (() => {
        const raw = draft.vacation_days_per_year;
        const n = typeof raw === "number" ? raw : raw != null ? Number(raw) : NaN;
        if (!Number.isFinite(n) || Number.isNaN(n)) return 20;
        return Math.min(366, Math.max(0, Math.round(n)));
      })(),
      emergency_contact_name: draft.emergency_contact_name ?? null,
      emergency_contact_phone: draft.emergency_contact_phone ?? null,
      emergency_contact_relation: draft.emergency_contact_relation ?? null,
      custom_role_id: draft.custom_role_id ?? null,
      use_role_permissions: inherit,
      custom_permissions: inherit ? null : (draft.custom_permissions ?? {}) as Record<string, unknown>,
      profile_status: draft.profile_status ?? "active",
      pay_type: payType === "unspecified" ? null : payType,
      pay_amount:
        payType === "unspecified" ||
        payType === "production" ||
        payType === "hourly" ||
        payAmount == null ||
        Number.isNaN(payAmount as number)
          ? null
          : payAmount,
      pay_currency:
        payType === "unspecified" || payType === "production" || payType === "hourly"
          ? null
          : (draft.pay_currency ?? selected.pay_currency ?? "CAD") || null,
      pay_period:
        payType === "unspecified" || payType === "production" || payType === "hourly"
          ? null
          : (draft.pay_period ?? selected.pay_period ?? "monthly") || null,
      hourly_rate:
        payType === "production"
          ? null
          : payType === "fixed"
            ? null
            : coercePayAmount(draft.hourly_rate),
    };
    const { error } = await supabase.from("user_profiles").update(payload).eq("id", selected.id);
    setSaving(false);
    if (!error) void load();
  };

  const uploadAvatar = async (file: File) => {
    if (!cloudinaryCloudName || !cloudinaryUploadPreset || !selected) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", cloudinaryUploadPreset);
    fd.append("folder", "machinpro/avatars");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
      method: "POST",
      body: fd,
    });
    const data = (await res.json()) as { secure_url?: string };
    if (data.secure_url) {
      setDraft((d) => ({ ...d, avatar_url: data.secure_url }));
    }
  };

  const uploadEmployeeDocForRow = async (docId: string, file: File) => {
    if (!cloudinaryCloudName || !cloudinaryUploadPreset || !selected || !companyId || !canManageEmployees)
      return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", cloudinaryUploadPreset);
    fd.append("folder", "machinpro/employee-docs");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/raw/upload`, {
      method: "POST",
      body: fd,
    });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!data.secure_url) return;
    const { error } = await supabase
      .from("employee_documents")
      .update({ file_url: data.secure_url })
      .eq("id", docId)
      .eq("company_id", companyId)
      .eq("user_id", selected.id);
    if (!error) void load();
  };

  const uploadEmployeeDocAdHoc = async (file: File) => {
    if (!cloudinaryCloudName || !cloudinaryUploadPreset || !selected || !companyId || !canManageEmployees)
      return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", cloudinaryUploadPreset);
    fd.append("folder", "machinpro/employee-docs");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/raw/upload`, {
      method: "POST",
      body: fd,
    });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!data.secure_url) return;
    const name = file.name || "document";
    const { error } = await supabase.from("employee_documents").insert({
      company_id: companyId,
      user_id: selected.id,
      name,
      file_url: data.secure_url,
    });
    if (!error) void load();
  };

  const saveEmployeeDocExpiry = async (docId: string, expiryYmd: string) => {
    if (!selected || !companyId || !canManageEmployees) return;
    const y = expiryYmd.trim() ? expiryYmd.slice(0, 10) : null;
    const { error } = await supabase
      .from("employee_documents")
      .update({ expiry_date: y })
      .eq("id", docId)
      .eq("company_id", companyId)
      .eq("user_id", selected.id);
    if (!error) void load();
  };

  const togglePermission = (key: keyof RolePermissions) => {
    if (!canManageEmployees || draft.use_role_permissions !== false) return;
    const base = (draft.custom_permissions ?? {}) as Partial<RolePermissions>;
    const next = { ...base, [key]: !base[key] };
    setDraft((d) => ({ ...d, custom_permissions: next }));
  };

  const toggleProject = async (projectId: string) => {
    if (!selected || !companyId || !canManageEmployees) return;
    const on = assignedProjectIds.includes(projectId);
    if (on) {
      await supabase
        .from("employee_projects")
        .delete()
        .eq("user_id", selected.id)
        .eq("project_id", projectId)
        .eq("company_id", companyId);
    } else {
      await supabase.from("employee_projects").insert({
        user_id: selected.id,
        project_id: projectId,
        company_id: companyId,
      });
    }
    void loadAssignments();
  };

  const softDeactivateEmployee = async () => {
    if (!canDelete || !selected || !companyId) return;
    const lx = t as Record<string, string>;
    const { error } = await supabase
      .from("user_profiles")
      .update({ profile_status: "inactive" })
      .eq("id", selected.id)
      .eq("company_id", companyId);
    if (error) {
      console.error("[EmployeesModule] softDeactivateEmployee", error);
      window.alert((lx.employees_delete_error ?? "").trim() || error.message || "Could not update profile.");
      return;
    }
    setEmployeeDeleteModalOpen(false);
    setHardDeleteConfirmInput("");
    if (selectedId === selected.id) setSelectedId(null);
    void load();
    const ok = (lx.employee_deactivate_success ?? "").trim();
    if (ok) window.alert(ok);
  };

  const runHardDeleteEmployee = async () => {
    if (!canManageEmployees || !selected || !companyId) return;
    const lx = t as Record<string, string>;
    const st = (selected.profile_status ?? "").toLowerCase().trim();
    if (st !== "inactive" && st !== "deleted") return;
    const expected = (draft.full_name ?? selected.full_name ?? "").trim().replace(/\s+/g, " ");
    const typed = hardDeleteConfirmInput.trim().replace(/\s+/g, " ");
    if (!expected || typed !== expected) return;
    setHardDeleteBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        window.alert((lx.employees_delete_error ?? "").trim() || "Session required");
        return;
      }
      const res = await fetch("/api/employees/hard-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId, userId: selected.id }),
      });
      const j = (await res.json()) as { error?: string; hint?: string; ok?: boolean; success?: boolean };
      if (!res.ok || (!j.ok && !j.success)) {
        window.alert(
          [j.error, j.hint].filter(Boolean).join("\n") || (lx.employees_delete_error ?? "").trim() || "Error"
        );
        return;
      }
      setEmployeeDeleteModalOpen(false);
      setPermanentDeleteOpen(false);
      setHardDeleteConfirmInput("");
      if (selectedId === selected.id) setSelectedId(null);
      void load();
      const ok = (lx.hard_delete_success ?? lx.employee_hard_delete_success ?? "").trim();
      if (ok) window.alert(ok);
    } finally {
      setHardDeleteBusy(false);
    }
  };

  const runForceLogoutEmployee = async () => {
    if (!viewerIsAdmin || !companyId || !selectedId) return;
    const targetRow = rows.find((r) => r.id === selectedId);
    if (!targetRow) return;
    const lx = t as Record<string, string>;
    setForceLogoutBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        showToast("error", (lx.auth_force_logout_error ?? "").trim() || "Error");
        return;
      }
      const res = await fetch("/api/auth/force-logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId, targetUserId: targetRow.id }),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !j.ok) {
        showToast("error", (lx.auth_force_logout_error ?? "").trim() || "Error");
        return;
      }
      showToast("success", (lx.auth_force_logout_success ?? "").trim() || "OK");
      setForceLogoutModalOpen(false);
    } finally {
      setForceLogoutBusy(false);
    }
  };

  const submitCreateEmployee = async () => {
    const lx = t as Record<string, string>;
    if (!companyId || !canManageEmployees) {
      console.warn("[EmployeesModule] create blocked: missing companyId or permission");
      setCreateError(lx.employees_create_error ?? "");
      return;
    }
    const name = createForm.fullName.trim();
    const mail = createForm.email.trim().toLowerCase();
    if (!name || !mail.includes("@")) {
      setCreateError(lx.employees_create_validation ?? "");
      return;
    }
    setCreateError(null);
    setCreateSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        console.error("[EmployeesModule] create: no session access_token");
        setCreateError(lx.employees_create_error ?? "");
        return;
      }
      const payT = createForm.payType;
      const payAmt =
        payT === "unspecified" || createForm.payAmount.trim() === ""
          ? null
          : parseFloat(createForm.payAmount.replace(",", "."));
      const res = await fetch("/api/employees/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId,
          fullName: name,
          email: mail,
          phone: createForm.phone.trim() || null,
          customRoleId: createForm.customRoleId,
          profileStatus: createForm.profileStatus,
          emergencyContactName: createForm.emergencyName.trim() || null,
          emergencyContactPhone: createForm.emergencyPhone.trim() || null,
          emergencyContactRelation: createForm.emergencyRelation.trim() || null,
          payType: payT,
          payAmount: payAmt != null && !Number.isNaN(payAmt) ? payAmt : null,
          payCurrency: payT === "unspecified" ? null : createForm.payCurrency,
          payPeriod: payT === "fixed" ? createForm.payPeriod : null,
          useRolePermissions: createForm.useRolePermissions,
          customPermissions: createForm.useRolePermissions ? null : createForm.customPermissions,
          vacationPolicyEnabled: createForm.manageVacations,
          vacationDaysAnnual:
            createForm.manageVacations && createForm.vacationDaysAnnual.trim() !== ""
              ? parseInt(createForm.vacationDaysAnnual, 10)
              : null,
        }),
      });
      const rawText = await res.text();
      let j: { error?: string; warning?: string; id?: string } = {};
      try {
        j = rawText ? (JSON.parse(rawText) as typeof j) : {};
      } catch (parseErr) {
        console.error("[EmployeesModule] create: response is not JSON", res.status, rawText?.slice(0, 200), parseErr);
        setCreateError(lx.employees_create_error ?? "");
        return;
      }
      console.log("[EmployeesModule] POST /api/employees/create", res.status, j);
      if (!res.ok) {
        console.error("[EmployeesModule] create failed:", j.error ?? res.status);
        setCreateError(j.error ?? lx.employees_create_error ?? "");
        return;
      }
      if (j.warning) {
        console.warn("[EmployeesModule] create: extended fields warning:", j.warning);
      }
      setCreateOpen(false);
      setCreateForm({
        fullName: "",
        email: "",
        phone: "",
        customRoleId: pickDefaultWorkerRoleId(customRoles) || customRoles[0]?.id || "",
        profileStatus: "active",
        emergencyName: "",
        emergencyPhone: "",
        emergencyRelation: "",
        payType: "unspecified",
        payAmount: "",
        payCurrency: defaultPayCurrency,
        payPeriod: "monthly",
        manageVacations: false,
        vacationDaysAnnual: "",
        useRolePermissions: true,
        customPermissions: {},
      });
      void load();
    } catch (e) {
      console.error("[EmployeesModule] create employee exception:", e);
      setCreateError((t as Record<string, string>).employees_create_error ?? "");
    } finally {
      setCreateSaving(false);
    }
  };

  const openInviteMailto = () => {
    const subj = encodeURIComponent((t as Record<string, string>).employees_invite ?? "");
    const body = encodeURIComponent(inviteEmail.trim());
    window.location.href = `mailto:${encodeURIComponent(inviteEmail.trim())}?subject=${subj}&body=${body}`;
    setInviteOpen(false);
    setInviteEmail("");
  };

  const lxEarly = t as Record<string, string>;
  if (!companyId) {
    return (
      <>
        {onBackToOffice ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToOffice}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 min-h-[44px]"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              {lxEarly.back ?? "Volver"}
            </button>
          </div>
        ) : null}
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          {lxEarly.employees_no_company ?? ""}
        </p>
      </>
    );
  }

  const activeView: "list" | "detail" = selectedId ? "detail" : "list";

  if (selected) {
    const tl = t as Record<string, string>;
    const name = employeeDisplayLabel(selected, t as Record<string, string>, currentUserProfileId ?? null);
    const emailShown = (selected.email ?? "").trim() || emailLocalPart(selected.email);
    const inheritPerms = draft.use_role_permissions !== false;
    const isSelf = currentUserProfileId != null && selected.id === currentUserProfileId;
    const workerSelf = isSelf && !canManageEmployees;
    const isDeletedProfile = (selected.profile_status ?? "") === "deleted";
    const canEditBasicFields = (canManageEmployees || isSelf) && !isDeletedProfile;

    const complianceFieldLabel = (field: ComplianceField): string =>
      employeeComplianceFieldLabel(field, tl);

    const renderStructuredSalary = (sel: ProfileRow) => {
      const pt = (sel.pay_type ?? "unspecified").trim().toLowerCase();
      if (!pt || pt === "unspecified") {
        return <p className="text-zinc-600 dark:text-zinc-400">{tl.employees_pay_type_unspecified ?? ""}</p>;
      }
      if (pt === "production") {
        return (
          <p>
            {tl.salary_production_note ??
              tl.employees_pay_production_note ??
              tl.production_pay_production ??
              ""}
          </p>
        );
      }
      const typeLabel =
        pt === "fixed"
          ? tl.production_pay_fixed ?? tl.employees_fixed_salary ?? ""
          : tl.production_pay_hourly ?? tl.employees_hourly_rate ?? "";
      const cur = (sel.pay_currency ?? defaultPayCurrency ?? "").trim() || "CAD";
      const payAmt = coercePayAmount(sel.pay_amount);
      const laborHr = coercePayAmount(sel.hourly_rate);
      const per =
        pt === "fixed"
          ? sel.pay_period === "monthly"
            ? tl.pay_period_monthly ?? ""
            : sel.pay_period === "biweekly"
              ? tl.pay_period_biweekly ?? ""
              : sel.pay_period === "weekly"
                ? tl.pay_period_weekly ?? ""
                : ""
          : "";
      const missingRate = pt === "fixed" ? payAmt == null : laborHr == null;
      if (missingRate) {
        return (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500">{tl.salary_type_label ?? tl.employees_payment_type ?? ""}</dt>
                <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{typeLabel}</dd>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-amber-800 dark:text-amber-200">{tl.payroll_no_rate_configured ?? ""}</p>
                {canManageEmployees ? (
                  <button
                    type="button"
                    className="mt-2 min-h-[44px] rounded-lg border border-amber-500/60 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                    onClick={() => paySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    {tl.payroll_configure_rate ?? ""}
                  </button>
                ) : null}
              </div>
            </dl>
          </div>
        );
      }
      return (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">{tl.salary_type_label ?? tl.employees_payment_type ?? ""}</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{typeLabel}</dd>
          </div>
          {pt === "hourly" ? (
            <div>
              <dt className="text-xs text-zinc-500">{tl.employee_hourly_rate_label ?? tl.hourly_rate ?? ""}</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {laborHr != null ? `${laborHr} ${(defaultPayCurrency ?? cur).trim() || "CAD"}` : tl.common_dash ?? "—"}
              </dd>
            </div>
          ) : (
            <div>
              <dt className="text-xs text-zinc-500">{tl.salary_amount_label ?? tl.employee_salary_label ?? ""}</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {payAmt != null ? `${payAmt} ${cur}` : tl.common_dash ?? "—"}
                {per ? ` · ${per}` : ""}
              </dd>
            </div>
          )}
        </dl>
      );
    };

    const showPayrollReadOnlyOthers =
      !workerSelf && !canManageEmployees && (viewerIsAdmin === true || canViewLaborCosting === true);
    const showSalarySection = workerSelf || (canManageEmployees && !workerSelf) || showPayrollReadOnlyOthers;

    const hasAnyShiftThisWeek =
      scheduleShiftsByWeekDay != null &&
      weekYmds.some((ymd) => (scheduleShiftsByWeekDay.get(ymd) ?? []).length > 0);

    const fichajeTz = timeZone ?? resolveUserTimezone(null);
    const todayYmdFichaje = formatTodayYmdInTimeZone(fichajeTz);
    const legacyEmpId = selected.employee_id != null ? String(selected.employee_id) : null;
    const todayClock = clockEntries.find(
      (e) =>
        e.date === todayYmdFichaje &&
        (e.employeeId === selected.id || (!!legacyEmpId && e.employeeId === legacyEmpId))
    );
    const showFichajeSection =
      !isDeletedProfile && (canManageEmployees || (canClockInPersonal === true && isSelf));
    const showFichajeManage =
      canManageEmployees === true && !!onManualClockIn && !!onManualClockOut;
    let fichajeElapsedLabel = "";
    if (todayClock && !todayClock.clockOut) {
      try {
        const startMs = new Date(zonedYmdHmToUtcIso(todayYmdFichaje, todayClock.clockIn, fichajeTz)).getTime();
        const mins = Math.max(0, Math.round((Date.now() - startMs) / 60_000));
        fichajeElapsedLabel = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      } catch {
        fichajeElapsedLabel = tl.common_dash ?? "—";
      }
    }

    const openFichajeInModal = () => {
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const d = new Date();
      setFichajeTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
      setFichajeProjectId("");
      setFichajeNotes("");
      setFichajeInOpen(true);
    };
    const openFichajeOutModal = () => {
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const d = new Date();
      setFichajeTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
      setFichajeNotes("");
      setFichajeOutOpen(true);
    };

    const backBtn = (
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: "var(--color-background-primary, var(--background))",
          padding: "12px 0",
          marginBottom: "16px",
          borderBottom: "1px solid var(--color-border-tertiary, rgba(148, 163, 184, 0.35))",
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 min-h-[44px]"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          {tl.back ?? "Volver"}
        </button>
      </div>
    );

    return (
      <div style={{ position: "relative", paddingTop: "60px" }} className="space-y-4 max-w-3xl min-h-0 overflow-visible">
        {backBtn}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="h-16 w-16 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-lg font-semibold overflow-hidden">
            {draft.avatar_url || selected.avatar_url ? (
              <img
                src={(draft.avatar_url || selected.avatar_url) as string}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              employeeInitials(selected)
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{name}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{roleLabel(selected)}</p>
          </div>
          {(canManageEmployees || selected.id === currentUserProfileId) && !isDeletedProfile && (
            <label className="ml-auto cursor-pointer min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm">
              <Camera className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadAvatar(f);
                }}
              />
              {tl.employees_change_photo ?? ""}
            </label>
          )}
        </div>

        {canViewEmployeeGpsRoute && companyId ? (
          <div
            className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-slate-700 pb-3"
            role="tablist"
            aria-label={tl.tab_route ?? tl.gps_route_history ?? "Route"}
          >
            <button
              type="button"
              role="tab"
              aria-selected={employeeDetailTab === "info"}
              onClick={() => setEmployeeDetailTab("info")}
              className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                employeeDetailTab === "info"
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
                  : "border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {tl.employees_basic_info ?? ""}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={employeeDetailTab === "route"}
              onClick={() => setEmployeeDetailTab("route")}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                employeeDetailTab === "route"
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
                  : "border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {tl.tab_route ?? tl.gps_route_history ?? ""}
            </button>
          </div>
        ) : null}

        {employeeDetailTab === "route" && canViewEmployeeGpsRoute && companyId ? (
          <EmployeeGpsRouteTab
            companyId={companyId}
            userId={selected.id}
            employeeName={name}
            timeZone={timeZone}
            language={(dateLocale || "en").split("-")[0] || "en"}
            countryCode={((dateLocale || "en-CA").split("-")[1] ?? "CA").toUpperCase()}
            labels={t as Record<string, string>}
          />
        ) : (
          <>
            {(viewerIsAdmin || selected.id === currentUserProfileId) && companyId ? (
              <SafetyPassportPanel
                t={t as Record<string, string>}
                companyId={companyId}
                profileId={selected.id}
                profileName={name}
                dateLocale={dateLocale}
                complianceFields={complianceFields}
                complianceRecords={complianceRecords}
                userProfileToEmployeeId={userProfileToEmployeeId}
              />
            ) : null}

            <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Users className="h-4 w-4" />
                {tl.employees_basic_info ?? ""}
              </h3>
          {isSelf && !(draft.full_name ?? selected.full_name ?? "").trim() && (tl.employees_add_profile_name_hint ?? "").trim() ? (
            <p className="text-xs text-amber-700 dark:text-amber-300/90 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2">
              {tl.employees_add_profile_name_hint}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
            <label className="block text-sm">
              <span className="text-zinc-500">{t.personnel ?? ""}</span>
              <input
                value={draft.full_name ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
                disabled={!canEditBasicFields}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500 flex items-center gap-1">
                <Phone className="h-3 w-3" /> {t.phone ?? ""}
              </span>
              <input
                value={draft.phone ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                disabled={!canEditBasicFields}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <div className="text-sm sm:col-span-2">
              <span className="text-zinc-500 flex items-center gap-1">
                <Mail className="h-3 w-3" /> {t.email ?? ""}
              </span>
              <span className="block mt-1 text-zinc-800 dark:text-zinc-100 break-all">
                {emailShown || (tl.employees_no_email ?? tl.employees_email_unknown ?? "")}
              </span>
            </div>
            <p className="text-sm">
              <span className="text-zinc-500">{tl.employees_start_date ?? tl.employees_joined ?? ""}</span>
              <span className="block mt-1">
                {selected.created_at ? formatDate(selected.created_at, dateLocale, timeZone) : tl.common_dash ?? ""}
              </span>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-100 dark:border-slate-700">
            <label className="block text-sm">
              <span className="text-zinc-500">{t.employees_emergency_contact ?? ""}</span>
              <input
                value={draft.emergency_contact_name ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, emergency_contact_name: e.target.value }))}
                disabled={!canEditBasicFields}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{t.phone ?? ""}</span>
              <input
                value={draft.emergency_contact_phone ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, emergency_contact_phone: e.target.value }))}
                disabled={!canEditBasicFields}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{t.employees_emergency_relation ?? ""}</span>
              <input
                value={draft.emergency_contact_relation ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, emergency_contact_relation: e.target.value }))}
                disabled={!canEditBasicFields}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
          </div>
        </section>

        {showFichajeSection ? (
          <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              {tl.clock_tab ?? "Fichaje"}
            </h3>
            {showFichajeManage && !todayClock ? (
              <button
                type="button"
                onClick={() => openFichajeInModal()}
                className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
              >
                {tl.clock_manual_in ?? ""}
              </button>
            ) : null}
            {showFichajeManage && todayClock && !todayClock.clockOut ? (
              <div className="space-y-3">
                <div className="text-sm text-zinc-700 dark:text-zinc-200 space-y-1">
                  <p>
                    <span className="text-zinc-500">{tl.clock_active_since ?? ""}: </span>
                    <span className="font-medium tabular-nums">{formatTimeHm(todayClock.clockIn, dateLocale, fichajeTz)}</span>
                    {todayClock.projectId ? (
                      <span className="text-zinc-500">
                        {" · "}
                        {projects.find((p) => p.id === todayClock.projectId)?.name ?? todayClock.projectId}
                      </span>
                    ) : null}
                  </p>
                  {fichajeElapsedLabel ? (
                    <p className="text-xs text-zinc-500">
                      {tl.timeWorked ?? "Worked"}: <span className="font-semibold tabular-nums">{fichajeElapsedLabel}</span>
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => openFichajeOutModal()}
                  className="w-full min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
                >
                  {tl.clock_manual_out ?? ""}
                </button>
              </div>
            ) : null}
            {showFichajeManage && todayClock?.clockOut ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {tl.clockInEntry ?? ""}: {formatTimeHm(todayClock.clockIn, dateLocale, fichajeTz)} · {tl.clockOutEntry ?? ""}:{" "}
                {formatTimeHm(todayClock.clockOut, dateLocale, fichajeTz)}
              </p>
            ) : null}
            {!showFichajeManage && canClockInPersonal && isSelf ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300 space-y-1">
                {!todayClock ? <p>{tl.clock_not_clocked_in ?? ""}</p> : null}
                {todayClock && !todayClock.clockOut ? (
                  <p>
                    {tl.clock_active_since ?? ""}: {formatTimeHm(todayClock.clockIn, dateLocale, fichajeTz)}
                    {fichajeElapsedLabel ? ` · ${tl.timeWorked ?? ""}: ${fichajeElapsedLabel}` : ""}
                  </p>
                ) : null}
                {todayClock?.clockOut ? (
                  <p>
                    {tl.clockInEntry ?? ""}: {formatTimeHm(todayClock.clockIn, dateLocale, fichajeTz)} — {tl.clockOutEntry ?? ""}:{" "}
                    {formatTimeHm(todayClock.clockOut, dateLocale, fichajeTz)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {fichajeInOpen && showFichajeManage ? (
          <>
            <div className="fixed inset-0 z-[60] bg-black/50" aria-hidden onClick={() => !fichajeSaving && setFichajeInOpen(false)} />
            <div className="fixed z-[61] inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:inset-x-auto sm:max-w-md md:max-w-lg lg:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{tl.clock_manual_in ?? ""}</p>
                <button
                  type="button"
                  disabled={fichajeSaving}
                  onClick={() => setFichajeInOpen(false)}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label={tl.cancel ?? ""}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                {t.projects ?? "Project"}
                <select
                  value={fichajeProjectId}
                  onChange={(e) => setFichajeProjectId(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                >
                  <option value="">{tl.common_dash ?? "—"}</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                {tl.clockInEntry ?? ""}
                <input
                  type="time"
                  value={fichajeTime}
                  onChange={(e) => setFichajeTime(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                {t.notes ?? ""}
                <textarea
                  value={fichajeNotes}
                  onChange={(e) => setFichajeNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full max-w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={fichajeSaving || !fichajeTime}
                onClick={() => {
                  if (!onManualClockIn) return;
                  setFichajeSaving(true);
                  void onManualClockIn({
                    targetUserId: selected.id,
                    date: todayYmdFichaje,
                    time: fichajeTime,
                    projectId: fichajeProjectId.trim() ? fichajeProjectId : null,
                    notes: fichajeNotes.trim() || undefined,
                  }).then((r) => {
                    setFichajeSaving(false);
                    if (r.ok) {
                      setFichajeInOpen(false);
                      showToast("success", tl.clock_manual_in ?? "");
                    } else {
                      showToast("error", r.error ?? tl.export_error ?? "Error");
                    }
                  });
                }}
                className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {fichajeSaving ? "…" : tl.clock_manual_in ?? ""}
              </button>
            </div>
          </>
        ) : null}

        {fichajeOutOpen && showFichajeManage && todayClock && !todayClock.clockOut ? (
          <>
            <div className="fixed inset-0 z-[60] bg-black/50" aria-hidden onClick={() => !fichajeSaving && setFichajeOutOpen(false)} />
            <div className="fixed z-[61] inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:inset-x-auto sm:max-w-md md:max-w-lg lg:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{tl.clock_manual_out ?? ""}</p>
                <button
                  type="button"
                  disabled={fichajeSaving}
                  onClick={() => setFichajeOutOpen(false)}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label={tl.cancel ?? ""}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                {tl.clockOutEntry ?? ""}
                <input
                  type="time"
                  value={fichajeTime}
                  onChange={(e) => setFichajeTime(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                {t.notes ?? ""}
                <textarea
                  value={fichajeNotes}
                  onChange={(e) => setFichajeNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full max-w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={fichajeSaving || !fichajeTime}
                onClick={() => {
                  if (!onManualClockOut) return;
                  setFichajeSaving(true);
                  void onManualClockOut({
                    targetUserId: selected.id,
                    timeEntryId: todayClock.id,
                    date: todayYmdFichaje,
                    time: fichajeTime,
                    notes: fichajeNotes.trim() || undefined,
                  }).then((r) => {
                    setFichajeSaving(false);
                    if (r.ok) {
                      setFichajeOutOpen(false);
                      showToast("success", tl.clock_manual_out ?? "");
                    } else {
                      showToast("error", r.error ?? tl.export_error ?? "Error");
                    }
                  });
                }}
                className="w-full min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {fichajeSaving ? "…" : tl.clock_manual_out ?? ""}
              </button>
            </div>
          </>
        ) : null}

        {scheduleShiftsByWeekDay && canViewTeamAvailabilityInProfile ? (
          <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden />
              {tl.schedule_this_week ?? ""}
            </h3>
            {!hasAnyShiftThisWeek ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{tl.schedule_no_shifts_week ?? ""}</p>
            ) : null}
            <div className="space-y-2">
              {weekYmds.map((ymd) => {
                const list = scheduleShiftsByWeekDay.get(ymd) ?? [];
                const parts = ymd.split("-").map((x) => parseInt(x, 10));
                const y0 = parts[0] ?? 0;
                const m0 = parts[1] ?? 1;
                const d0 = parts[2] ?? 1;
                const utcNoon = new Date(Date.UTC(y0, m0 - 1, d0, 12, 0, 0));
                const wdShort = new Intl.DateTimeFormat(dateLocale, {
                  timeZone,
                  weekday: "short",
                }).format(utcNoon);
                return (
                  <div
                    key={ymd}
                    className="flex flex-col gap-2 border-b border-zinc-100 pb-2 last:border-b-0 last:pb-0 dark:border-slate-700 sm:flex-row sm:items-start sm:gap-4"
                  >
                    <div className="w-28 shrink-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {wdShort}
                      </p>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {formatCalendarYmd(ymd, dateLocale, timeZone)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {list.length === 0 ? (
                        <p className="text-sm text-zinc-400 dark:text-zinc-500">{tl.common_dash ?? "—"}</p>
                      ) : (
                        list.map((e) => {
                          const pname =
                            projects.find((p) => p.id === e.projectId)?.name ??
                            e.projectCode ??
                            tl.common_dash ??
                            "—";
                          return (
                            <div
                              key={e.id}
                              className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-2.5 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/20"
                            >
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">{pname}</span>
                              <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">
                                {formatTimeHm(e.startTime, dateLocale, timeZone)} →{" "}
                                {formatTimeHm(e.endTime, dateLocale, timeZone)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {showSalarySection ? (
        <section
          ref={paySectionRef}
          id="employee-pay-section"
          className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3 scroll-mt-24"
        >
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {tl.salary_view_title ?? tl.employees_payment_section ?? ""}
          </h3>
          {workerSelf ? <div className="text-sm">{renderStructuredSalary(selected)}</div> : null}
          {showPayrollReadOnlyOthers ? <div className="text-sm">{renderStructuredSalary(selected)}</div> : null}
          {canManageEmployees && !workerSelf ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
              <label className="block text-sm sm:col-span-2">
                <span className="text-zinc-500">{tl.employees_payment_type ?? ""}</span>
                <select
                  value={draft.pay_type ?? "unspecified"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => ({
                      ...d,
                      pay_type: v,
                      pay_amount:
                        v === "unspecified" || v === "production" || v === "hourly"
                          ? null
                          : d.pay_amount ?? selected.pay_amount ?? null,
                      hourly_rate:
                        v === "production" || v === "fixed"
                          ? null
                          : v === "hourly"
                            ? d.hourly_rate ?? selected.hourly_rate ?? null
                            : d.hourly_rate,
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                >
                  <option value="unspecified">{tl.employees_pay_type_unspecified ?? ""}</option>
                  <option value="fixed">{tl.production_pay_fixed ?? tl.employees_fixed_salary ?? ""}</option>
                  <option value="hourly">{tl.production_pay_hourly ?? tl.employees_hourly_rate ?? ""}</option>
                  <option value="production">{tl.production_pay_production ?? ""}</option>
                </select>
              </label>
              {draft.pay_type === "production" ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                  {tl.salary_production_note ?? tl.employees_pay_production_note ?? ""}
                </p>
              ) : null}
              {(draft.pay_type ?? "") !== "" &&
              draft.pay_type !== "unspecified" &&
              draft.pay_type !== "production" ? (
                <>
                  {draft.pay_type === "fixed" ? (
                    <label className="block text-sm sm:col-span-2">
                      <span className="text-zinc-500">
                        {tl.employees_fixed_salary ?? tl.salary_amount_label ?? ""} ({defaultPayCurrency ?? "CAD"})
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={draft.pay_amount ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            pay_amount: e.target.value === "" ? null : parseFloat(e.target.value),
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                      />
                    </label>
                  ) : (
                    <label className="block text-sm sm:col-span-2">
                      <span className="text-zinc-500">
                        {tl.employee_hourly_rate_label ?? tl.hourly_rate ?? ""} ({defaultPayCurrency ?? "CAD"})
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={draft.hourly_rate ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            hourly_rate: e.target.value === "" ? null : parseFloat(e.target.value),
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                      />
                    </label>
                  )}
                  {draft.pay_type === "fixed" ? (
                    <>
                      <label className="block text-sm">
                        <span className="text-zinc-500">{tl.employees_currency ?? ""}</span>
                        <select
                          value={draft.pay_currency ?? "CAD"}
                          onChange={(e) => setDraft((d) => ({ ...d, pay_currency: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                        >
                          {PAY_CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm sm:col-span-2">
                        <span className="text-zinc-500">{tl.employees_pay_period ?? ""}</span>
                        <select
                          value={draft.pay_period ?? "monthly"}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              pay_period: e.target.value as ProfileRow["pay_period"],
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                        >
                          <option value="monthly">{tl.pay_period_monthly ?? ""}</option>
                          <option value="biweekly">{tl.pay_period_biweekly ?? ""}</option>
                          <option value="weekly">{tl.pay_period_weekly ?? ""}</option>
                        </select>
                      </label>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </section>
        ) : null}

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {tl.employees_role_permissions ?? ""}
          </h3>
          <label className="block text-sm max-w-md">
            <span className="text-zinc-500">{tl.employees_assigned_role ?? tl.employees_role ?? ""}</span>
            <select
              value={draft.custom_role_id ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, custom_role_id: e.target.value || null }))}
              disabled={!canManageEmployees}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="">—</option>
              {customRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
            <span className="text-sm text-zinc-700 dark:text-zinc-200">
              {tl.employees_use_role_permissions ?? ""}
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-zinc-300"
              checked={inheritPerms}
              disabled={!canManageEmployees}
              onChange={(e) => {
                const on = e.target.checked;
                setDraft((d) => ({
                  ...d,
                  use_role_permissions: on,
                  custom_permissions: on ? {} : mergePerm(selectedRolePermissions, d.custom_permissions),
                }));
              }}
            />
          </label>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {ROLE_PERMISSION_KEYS.map((key) => (
              <label
                key={key}
                className={`flex items-center justify-between gap-3 text-sm py-1 ${inheritPerms ? "opacity-80" : ""}`}
              >
                <span className="text-zinc-600 dark:text-zinc-300">{permLabel(key, t as Record<string, string>)}</span>
                <input
                  type="checkbox"
                  checked={effectivePermissionValue(key)}
                  onChange={() => togglePermission(key)}
                  disabled={!canManageEmployees || inheritPerms}
                  className="h-5 w-5 rounded border-zinc-300"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            {tl.employees_assigned_projects ?? tl.employees_projects ?? ""}
          </h3>
          <ul className="text-sm space-y-2 max-h-56 overflow-y-auto">
            {activeProjects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-zinc-700 dark:text-zinc-200 truncate">· {p.name}</span>
                {canManageEmployees && (
                  <button
                    type="button"
                    onClick={() => void toggleProject(p.id)}
                    className="min-h-[44px] shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 text-sm"
                  >
                    {assignedProjectIds.includes(p.id)
                      ? (tl.employees_project_unassign ?? "")
                      : (tl.employees_project_assign ?? "")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Palmtree className="h-4 w-4" />
            {tl.employees_vacation_absences ?? tl.employees_vacations_section ?? t.employees_vacation_days_allowed ?? ""}
          </h3>
          {canManageEmployees && !workerSelf ? (
            <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
              <span className="text-sm text-zinc-700 dark:text-zinc-200">{tl.employees_manage_vacations ?? ""}</span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-zinc-300"
                checked={Boolean(draft.vacation_policy_enabled)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    vacation_policy_enabled: e.target.checked,
                    vacation_days_allowed: e.target.checked ? d.vacation_days_allowed : null,
                  }))
                }
              />
            </label>
          ) : null}
          <label className="block w-full max-w-full text-sm sm:max-w-xs">
            <span className="text-xs text-zinc-500">{t.employees_vacation_days_allowed ?? ""}</span>
            <input
              type="number"
              min={0}
              value={draft.vacation_days_allowed ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  vacation_days_allowed: e.target.value === "" ? null : parseInt(e.target.value, 10),
                }))
              }
              disabled={!canManageEmployees || workerSelf || !draft.vacation_policy_enabled}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            />
          </label>
          <label className="block w-full max-w-full text-sm sm:max-w-xs">
            <span className="text-xs text-zinc-500">
              {tl.employees_vacation_days_per_year ?? tl.employees_vacation_days_annual ?? t.employees_vacation_days_allowed ?? ""}
            </span>
            <input
              type="number"
              min={0}
              max={366}
              value={draft.vacation_days_per_year ?? 20}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  vacation_days_per_year:
                    e.target.value === "" ? 20 : Math.min(366, Math.max(0, parseInt(e.target.value, 10) || 0)),
                }))
              }
              disabled={!canManageEmployees || workerSelf}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            />
          </label>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {t.employees_vacation_used ?? ""}:{" "}
            <span className="font-medium tabular-nums">{vacationStats.used}</span>
            {" · "}
            {t.employees_vacation_pending ?? ""}:{" "}
            <span className="font-medium tabular-nums">{vacationStats.pending}</span>
          </p>
          <div>
            <p className="text-xs font-semibold text-zinc-500 mb-2">{tl.employees_request_history ?? tl.employees_vacation_history ?? ""}</p>
            <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
              {vacationsForSelected.length === 0 ? (
                <li className="text-zinc-500 italic">{tl.employees_no_requests ?? tl.employees_vacation_none ?? ""}</li>
              ) : (
                vacationsForSelected.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 dark:border-slate-800 pb-2"
                  >
                    <span>
                      {v.start_date} → {v.end_date}
                    </span>
                    <span className="tabular-nums">{v.total_days}d</span>
                    <span className="text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">
                      {v.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        {complianceFields.filter((f) => f.target.includes("employee")).length > 0 && (
          <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {tl.employees_compliance ?? t.compliance ?? ""}
            </h3>
            <ul className="space-y-2">
              {complianceFields
                .filter((f) => f.target.includes("employee"))
                .map((field) => {
                  const tid = complianceTargetId(selected.id);
                  const rec = complianceRecords.find(
                    (r) => r.fieldId === field.id && r.targetType === "employee" && r.targetId === tid
                  );
                  const tone = complianceTone(rec?.status ?? "missing", t as Record<string, string>);
                  return (
                    <li
                      key={field.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-slate-800 pb-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{complianceFieldLabel(field)}</p>
                        {rec?.expiryDate && (
                          <p className="text-xs text-zinc-500">
                            {tl.expiresOn ?? ""}: {rec.expiryDate}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs rounded-full px-2 py-0.5 ${tone.cls}`}>{tone.label}</span>
                        {canManageEmployees && onComplianceRecordsChange && (
                          <button
                            type="button"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600"
                            onClick={() =>
                              setComplianceEdit({
                                field,
                                expiryDate: rec?.expiryDate ?? "",
                                documentUrl: rec?.documentUrl ?? "",
                                value: rec?.value ?? "",
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {tl.employeeDocs ?? ""}
          </h3>
          <ul className="space-y-3 text-sm">
            {employeeDocs.map((d) => {
              const docModel = employeeDocRowToDocument(d);
              const st = computeEmployeeDocStatus(docModel.expiryDate, docModel.alertDays ?? 30);
              const label = employeeDocDisplayName(docModel, t as Record<string, string>);
              return (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 border-b border-zinc-100 dark:border-slate-800 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-white">{label}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {employeeDocStatusBadge(st, t as Record<string, string>)}
                        {d.expiry_date ? (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {tl.expiresOn ?? ""}: {String(d.expiry_date).slice(0, 10)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {tl.vehicle_doc_expiry ?? tl.expiresOn ?? ""}: —
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {d.file_url ? (
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[44px] inline-flex items-center rounded-lg border border-amber-500/50 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300"
                        >
                          {(tl as Record<string, string>).gallery_download ?? "Download"}
                        </a>
                      ) : null}
                      {canManageEmployees ? (
                        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-600">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (f) void uploadEmployeeDocForRow(d.id, f);
                            }}
                          />
                          {tl.employees_upload_document ?? ""}
                        </label>
                      ) : null}
                    </div>
                  </div>
                  {canManageEmployees ? (
                    <label className="block text-xs text-zinc-500">
                      {tl.vehicle_doc_expiry ?? tl.expiresOn ?? ""}
                      <input
                        type="date"
                        defaultValue={d.expiry_date ? String(d.expiry_date).slice(0, 10) : ""}
                        key={`${d.id}-${d.expiry_date ?? ""}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const prev = d.expiry_date ? String(d.expiry_date).slice(0, 10) : "";
                          if (v !== prev) void saveEmployeeDocExpiry(d.id, v);
                        }}
                        className="mt-1 w-full max-w-[14rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm min-h-[44px] dark:border-zinc-600 dark:bg-slate-800"
                      />
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {canManageEmployees && (
            <label className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadEmployeeDocAdHoc(f);
                }}
              />
              {tl.employees_upload_document ?? ""}
            </label>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-center">
          <div>
            <span className="text-xs text-zinc-500">{tl.common_status ?? tl.employees_status ?? ""}</span>
            <select
              value={draft.profile_status ?? "active"}
              onChange={(e) => setDraft((d) => ({ ...d, profile_status: e.target.value }))}
              disabled={!canManageEmployees || isDeletedProfile}
              className="block mt-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="active">{tl.employees_status_active ?? ""}</option>
              <option value="inactive">{tl.employees_status_inactive ?? ""}</option>
              <option value="invited">{tl.employees_status_invited ?? ""}</option>
              {isDeletedProfile ? (
                <option value="deleted">{tl.employees_status_deleted ?? ""}</option>
              ) : null}
            </select>
          </div>
          {canManageEmployees && (
            <button
              type="button"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
              onClick={() => {
                setInviteEmail((selected.email ?? "").trim());
                setInviteOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              {t.employees_invite ?? ""}
            </button>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-center">
          {(canManageEmployees || workerSelf) && (
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={saving}
              className="min-h-[44px] rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-medium"
            >
              {saving ? "…" : (tl.employees_save_changes ?? t.save ?? "")}
            </button>
          )}
          {canDelete && !isDeletedProfile && selected.id !== currentUserProfileId && (
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 text-sm font-medium"
              onClick={() => {
                setHardDeleteConfirmInput("");
                setEmployeeDeleteModalOpen(true);
              }}
            >
              {tl.employees_delete_action ?? tl.common_delete ?? ""}
            </button>
          )}
          {viewerIsAdmin && !isDeletedProfile && selected.id !== currentUserProfileId && (
            <button
              type="button"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-100"
              onClick={() => setForceLogoutModalOpen(true)}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              {tl.auth_force_logout_btn ?? ""}
            </button>
          )}
          {canManageEmployees &&
            selected.id !== currentUserProfileId &&
            (selected.profile_status === "inactive" || selected.profile_status === "deleted") && (
              <button
                type="button"
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/70"
                onClick={() => {
                  setHardDeleteConfirmInput("");
                  setPermanentDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                {tl.hard_delete_title ?? tl.employee_hard_delete ?? ""}
              </button>
            )}
        </section>
          </>
        )}

        {complianceEdit && onComplianceRecordsChange && (
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/50"
              aria-hidden
              onClick={() => setComplianceEdit(null)}
            />
            <div className="fixed z-[61] inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3 sm:left-auto sm:right-4 sm:top-24 sm:bottom-auto sm:inset-x-auto sm:max-w-md md:max-w-lg lg:max-w-xl sm:rounded-xl">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm">{complianceFieldLabel(complianceEdit.field)}</h4>
                <button
                  type="button"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center"
                  onClick={() => setComplianceEdit(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label className="block text-xs">
                {tl.expiresOn ?? ""}
                <input
                  type="date"
                  value={complianceEdit.expiryDate.slice(0, 10)}
                  onChange={(e) =>
                    setComplianceEdit((c) => (c ? { ...c, expiryDate: e.target.value } : c))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 min-h-[44px]"
                />
              </label>
              <label className="block text-xs">
                {tl.documentUrl ?? ""}
                <input
                  value={complianceEdit.documentUrl}
                  onChange={(e) =>
                    setComplianceEdit((c) => (c ? { ...c, documentUrl: e.target.value } : c))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 min-h-[44px]"
                />
              </label>
              <button
                type="button"
                className="w-full min-h-[44px] rounded-lg bg-amber-600 text-white text-sm font-medium"
                onClick={() => {
                  const tid = complianceTargetId(selected.id);
                  const f = complianceEdit.field;
                  const status = recordStatusFromInputs(
                    complianceEdit.expiryDate,
                    f.alertDaysBefore,
                    f.fieldType
                  );
                  const existing = complianceRecords.find(
                    (r) => r.fieldId === f.id && r.targetType === "employee" && r.targetId === tid
                  );
                  const next: ComplianceRecord = {
                    id: existing?.id ?? `cr-${Date.now()}`,
                    fieldId: f.id,
                    targetType: "employee",
                    targetId: tid,
                    value: complianceEdit.value,
                    expiryDate: complianceEdit.expiryDate || undefined,
                    documentUrl: complianceEdit.documentUrl || undefined,
                    status,
                    updatedAt: new Date().toISOString(),
                  };
                  const rest = complianceRecords.filter(
                    (r) =>
                      !(r.fieldId === f.id && r.targetType === "employee" && r.targetId === tid)
                  );
                  onComplianceRecordsChange([...rest, next]);
                  setComplianceEdit(null);
                }}
              >
                {tl.employees_save_changes ?? t.save ?? ""}
              </button>
            </div>
          </>
        )}

        {forceLogoutModalOpen && (
          <>
            <div
              className="fixed inset-0 z-[62] bg-black/50"
              aria-hidden
              onClick={() => !forceLogoutBusy && setForceLogoutModalOpen(false)}
            />
            <div
              className="fixed z-[63] inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl space-y-4 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:inset-x-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="force-logout-dialog-title"
            >
              <h3 id="force-logout-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-white">
                {tl.auth_force_logout_btn ?? ""}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{tl.auth_force_logout_confirm ?? ""}</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={forceLogoutBusy}
                  className="min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
                  onClick={() => !forceLogoutBusy && setForceLogoutModalOpen(false)}
                >
                  {tl.cancel ?? ""}
                </button>
                <button
                  type="button"
                  disabled={forceLogoutBusy}
                  className="min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() => void runForceLogoutEmployee()}
                >
                  {forceLogoutBusy ? "…" : (tl.auth_force_logout_btn ?? "")}
                </button>
              </div>
            </div>
          </>
        )}

        {employeeDeleteModalOpen && (
          <>
            <div
              className="fixed inset-0 z-[62] bg-black/50"
              aria-hidden
              onClick={() => !hardDeleteBusy && setEmployeeDeleteModalOpen(false)}
            />
            <div
              className="fixed z-[63] inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl space-y-4 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:inset-x-auto sm:max-w-lg md:max-w-xl lg:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="employee-delete-dialog-title"
            >
              <div className="flex justify-between items-start gap-2">
                <h3 id="employee-delete-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-white">
                  {tl.employee_delete_title ?? ""}
                </h3>
                <button
                  type="button"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300"
                  onClick={() => !hardDeleteBusy && setEmployeeDeleteModalOpen(false)}
                  aria-label={tl.cancel ?? "Close"}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/30 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{tl.employee_deactivate ?? ""}</p>
                <p className="text-sm text-amber-900/90 dark:text-amber-100/90">{tl.employee_deactivate_desc ?? ""}</p>
                <button
                  type="button"
                  disabled={hardDeleteBusy}
                  className="w-full min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50"
                  onClick={() => void softDeactivateEmployee()}
                >
                  {tl.employee_deactivate ?? ""}
                </button>
              </div>

            </div>
          </>
        )}

        {permanentDeleteOpen && selected && companyId && (
          <>
            <div
              className="fixed inset-0 z-[62] bg-black/50"
              aria-hidden
              onClick={() => !hardDeleteBusy && setPermanentDeleteOpen(false)}
            />
            <div
              className="fixed z-[63] inset-x-0 bottom-0 max-h-[90vh] w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-t-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-4 shadow-xl space-y-4 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:inset-x-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="permanent-delete-title"
            >
              <div className="flex justify-between items-start gap-2">
                <h3 id="permanent-delete-title" className="text-base font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
                  <Trash2 className="h-5 w-5 shrink-0" aria-hidden />
                  {tl.hard_delete_title ?? tl.employee_hard_delete ?? ""}
                </h3>
                <button
                  type="button"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300"
                  onClick={() => !hardDeleteBusy && setPermanentDeleteOpen(false)}
                  aria-label={tl.cancel ?? "Close"}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-red-900/95 dark:text-red-100/90">
                {(tl.hard_delete_warning ?? "")
                  .replace(/\{name\}/g, (draft.full_name ?? selected.full_name ?? "").trim() || "—")}
              </p>
              <label className="block text-xs font-medium text-red-900 dark:text-red-100">
                {tl.hard_delete_confirm_placeholder ?? ""}
                <input
                  value={hardDeleteConfirmInput}
                  onChange={(e) => setHardDeleteConfirmInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[44px]"
                  autoComplete="off"
                  disabled={hardDeleteBusy}
                  placeholder={(draft.full_name ?? selected.full_name ?? "").trim()}
                />
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={hardDeleteBusy}
                  onClick={() => setPermanentDeleteOpen(false)}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-slate-800 sm:w-auto"
                >
                  {tl.cancel ?? t.cancel ?? "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={
                    hardDeleteBusy ||
                    hardDeleteConfirmInput.trim().replace(/\s+/g, " ") !==
                      (draft.full_name ?? selected.full_name ?? "").trim().replace(/\s+/g, " ")
                  }
                  className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 sm:w-auto sm:min-w-[44px]"
                  onClick={() => void runHardDeleteEmployee()}
                >
                  {hardDeleteBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      <span>{tl.loading_saving ?? "…"}</span>
                    </>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                      {tl.hard_delete_button ?? ""}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {inviteOpen && (
          <>
            <div className="fixed inset-0 z-[60] bg-black/50" aria-hidden onClick={() => setInviteOpen(false)} />
            <div className="fixed z-[61] inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:inset-x-auto sm:max-w-md md:max-w-lg lg:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
              <p className="text-sm font-medium">{t.employees_invite ?? ""}</p>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 min-h-[44px]"
                placeholder={t.email ?? ""}
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  className="min-h-[44px] w-full rounded-lg border px-4 py-2.5 sm:w-auto"
                  onClick={() => setInviteOpen(false)}
                >
                  {t.cancel ?? ""}
                </button>
                <button
                  type="button"
                  disabled={!inviteEmail.includes("@")}
                  className="min-h-[44px] w-full rounded-lg bg-amber-600 px-4 py-2.5 text-white disabled:opacity-50 sm:w-auto sm:min-w-[44px]"
                  onClick={() => openInviteMailto()}
                >
                  {tl.employees_invite_send ?? ""}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const tl = t as Record<string, string>;

  return (
    <>
      {activeView === "list" && onBackToOffice ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToOffice}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 min-h-[44px]"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            {tl.back ?? "Volver"}
          </button>
        </div>
      ) : null}
      <section className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6 md:space-y-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
          <Users className="h-5 w-5 shrink-0" />
          <span className="min-w-0 break-words">{t.employees_title ?? ""}</span>
        </h2>
        <div className="flex flex-wrap gap-2 sm:justify-end">
        {canManageEmployees && (
          <button
            type="button"
            onClick={() => exportEmployeesCsv()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            {(t as Record<string, string>).export_employees ?? (t as Record<string, string>).export_csv ?? "CSV"}
          </button>
        )}
        {showNewEmployeeButton && canManageEmployees && (
          <>
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setCreateForm({
                  fullName: "",
                  email: "",
                  phone: "",
                  customRoleId:
                    pickDefaultWorkerRoleId(customRoles) || customRoles[0]?.id || "",
                  profileStatus: "active",
                  emergencyName: "",
                  emergencyPhone: "",
                  emergencyRelation: "",
                  payType: "unspecified",
                  payAmount: "",
                  payCurrency: defaultPayCurrency,
                  payPeriod: "monthly",
                  manageVacations: false,
                  vacationDaysAnnual: "",
                  useRolePermissions: true,
                  customPermissions: {},
                });
                setCreateOpen(true);
              }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              {tl.employees_new ?? ""}
            </button>
          </>
        )}
        </div>
      </div>

      {employeeTargetComplianceFields.length > 0 ? (
        <HorizontalScrollFade className="max-md:-mx-1" variant="inherit">
          <div
            className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0"
            role="tablist"
            aria-label={tl.employees_compliance ?? tl.compliance ?? ""}
          >
            <button
              type="button"
              role="tab"
              aria-selected={employeesBrowseTab === "people"}
              onClick={() => setEmployeesBrowseTab("people")}
              className={`shrink-0 min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                employeesBrowseTab === "people"
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
                  : "border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {tl.employees_title ?? t.personnel ?? ""}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={employeesBrowseTab === "compliance"}
              onClick={() => setEmployeesBrowseTab("compliance")}
              className={`shrink-0 min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                employeesBrowseTab === "compliance"
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
                  : "border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {tl.employees_compliance ?? t.compliance ?? ""}
            </button>
          </div>
        </HorizontalScrollFade>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="col-span-1 sm:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tl.employees_search ?? ""}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm min-h-[44px]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{t.whFilterAll ?? ""}</option>
          <option value="admin">{tl.admin ?? ""}</option>
          <option value="supervisor">{tl.supervisor ?? ""}</option>
          <option value="worker">{tl.worker ?? ""}</option>
          <option value="logistic">{tl.logistic ?? ""}</option>
          {customRoles.map((r) => (
            <option key={r.id} value={`custom:${r.id}`}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-2 py-2.5 text-sm min-h-[44px]"
        >
          <option value="all">{t.whFilterAll ?? ""}</option>
          <option value="active">{tl.employees_status_active ?? ""}</option>
          <option value="inactive">{tl.employees_status_inactive ?? ""}</option>
          <option value="invited">{tl.employees_status_invited ?? ""}</option>
          <option value="deleted">{tl.employees_status_deleted ?? ""}</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{t.loading ?? ""}</p>
      ) : employeesBrowseTab === "compliance" && employeeTargetComplianceFields.length > 0 ? (
        <>
          <div className="md:hidden space-y-3">
            {filtered.map((r) => {
              const dm = (employeeDocsByUser[r.id] ?? []).map(employeeDocRowToDocument);
              const urgent = employeeDocumentRowNeedsRedHighlight(dm);
              return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`w-full min-w-0 text-left rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-2 min-h-[44px] ${
                  urgent
                    ? "border-red-500 dark:border-red-700 border-2"
                    : "border-zinc-200 dark:border-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-zinc-900 dark:text-white truncate min-w-0">
                    {employeeDisplayLabel(r, tl, currentUserProfileId ?? null)}
                  </p>
                  {employeeDocFleetBadge(dm, tl as Record<string, string>)}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{roleLabel(r)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {r.profile_status === "inactive"
                    ? tl.common_inactive ?? ""
                    : r.profile_status === "invited"
                      ? tl.employees_status_invited ?? ""
                      : r.profile_status === "deleted"
                        ? tl.employees_status_deleted ?? ""
                        : tl.common_active ?? ""}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {employeeTargetComplianceFields.slice(0, 5).map((field) => {
                    const tid = complianceTargetId(r.id);
                    const rec = complianceRecords.find(
                      (x) => x.fieldId === field.id && x.targetType === "employee" && x.targetId === tid
                    );
                    const tone = complianceTone(rec?.status ?? "missing", tl);
                    return (
                      <span
                        key={field.id}
                        className={`inline-flex max-w-full truncate text-xs rounded-full px-2 py-0.5 font-medium ${tone.cls}`}
                        title={`${employeeComplianceFieldLabel(field, tl)} — ${tone.label}`}
                      >
                        {tone.label}
                      </span>
                    );
                  })}
                  {employeeTargetComplianceFields.length > 5 ? (
                    <span className="text-xs text-zinc-400 self-center">
                      +{employeeTargetComplianceFields.length - 5}
                    </span>
                  ) : null}
                </div>
              </button>
            );
            })}
          </div>
        <HorizontalScrollFade className="hidden md:block">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-700 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0">
            <table className="min-w-max w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800/80">
                  <th className="sticky left-0 z-10 bg-zinc-50 dark:bg-slate-800/95 px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-200">
                    {tl.employees_title ?? t.personnel ?? ""}
                  </th>
                  {employeeTargetComplianceFields.map((field) => (
                    <th
                      key={field.id}
                      className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-200 whitespace-nowrap"
                    >
                      {employeeComplianceFieldLabel(field, tl)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const dm = (employeeDocsByUser[r.id] ?? []).map(employeeDocRowToDocument);
                  const urgent = employeeDocumentRowNeedsRedHighlight(dm);
                  return (
                  <tr
                    key={r.id}
                    className={`border-b border-zinc-100 dark:border-slate-800 last:border-b-0 ${
                      urgent ? "bg-red-50/60 dark:bg-red-950/25" : ""
                    }`}
                  >
                    <td className="sticky left-0 z-[1] bg-white dark:bg-slate-900 px-3 py-2.5 align-middle">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          className="min-h-[44px] flex-1 min-w-0 text-left font-medium text-zinc-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400"
                        >
                          {employeeDisplayLabel(r, tl, currentUserProfileId ?? null)}
                        </button>
                        {employeeDocFleetBadge(dm, tl as Record<string, string>)}
                      </div>
                    </td>
                    {employeeTargetComplianceFields.map((field) => {
                      const tid = complianceTargetId(r.id);
                      const rec = complianceRecords.find(
                        (x) => x.fieldId === field.id && x.targetType === "employee" && x.targetId === tid
                      );
                      const tone = complianceTone(rec?.status ?? "missing", tl);
                      return (
                        <td key={field.id} className="px-3 py-2.5 align-middle">
                          <span className={`inline-flex text-xs rounded-full px-2 py-0.5 font-medium ${tone.cls}`}>
                            {tone.label}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </HorizontalScrollFade>
        </>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-slate-700 rounded-xl border border-zinc-200 dark:border-slate-700 overflow-hidden">
          {filtered.map((r) => {
            const dm = (employeeDocsByUser[r.id] ?? []).map(employeeDocRowToDocument);
            const urgent = employeeDocumentRowNeedsRedHighlight(dm);
            return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`w-full min-w-0 flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-slate-800 min-h-[56px] cursor-pointer ${
                  urgent ? "bg-red-50/70 dark:bg-red-950/30 border-l-4 border-l-red-500" : ""
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium shrink-0">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                  ) : (
                    employeeInitials(r)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium text-zinc-900 dark:text-white">
                    {employeeDisplayLabel(r, tl, currentUserProfileId ?? null)}
                  </p>
                  <p className="break-words text-xs font-medium text-zinc-600 dark:text-zinc-300" title={roleLabel(r)}>
                    {roleLabel(r)}
                  </p>
                  {(r.email ?? "").trim() ? (
                    <p className="hidden break-words text-xs text-zinc-500 sm:block" title={(r.email ?? "").trim()}>
                      {(r.email ?? "").trim()}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {employeeDocFleetBadge(dm, tl as Record<string, string>)}
                  <span className="text-xs rounded-full px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {r.profile_status === "inactive"
                      ? tl.common_inactive ?? ""
                      : r.profile_status === "invited"
                        ? tl.employees_status_invited ?? ""
                        : r.profile_status === "deleted"
                          ? tl.employees_status_deleted ?? ""
                          : tl.common_active ?? ""}
                  </span>
                </div>
              </button>
            </li>
            );
          })}
        </ul>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-8">{tl.employees_empty ?? ""}</p>
      )}

      {createOpen && canManageEmployees && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50"
            aria-hidden
            onClick={() => !createSaving && setCreateOpen(false)}
          />
          <div
            className="fixed z-[61] inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:inset-x-auto sm:max-w-md md:max-w-lg lg:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              {tl.employees_create_modal_title ?? ""}
            </h3>
            {createError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {createError}
              </p>
            )}
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.employees_full_name ?? t.personnel ?? ""} *</span>
              <input
                value={createForm.fullName}
                onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                autoComplete="name"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500 flex items-center gap-1">
                <Mail className="h-3 w-3" /> {t.email ?? ""} *
              </span>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                autoComplete="email"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500 flex items-center gap-1">
                <Phone className="h-3 w-3" /> {t.phone ?? ""}
              </span>
              <input
                type="tel"
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <p className="text-xs font-semibold text-zinc-500 pt-2 border-t border-zinc-200 dark:border-slate-700">
              {tl.employees_section_emergency ?? ""}
            </p>
            <label className="block text-sm">
              <span className="text-zinc-500">{t.employees_emergency_contact ?? ""}</span>
              <input
                value={createForm.emergencyName}
                onChange={(e) => setCreateForm((f) => ({ ...f, emergencyName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.employees_emergency_phone ?? t.phone ?? ""}</span>
              <input
                type="tel"
                value={createForm.emergencyPhone}
                onChange={(e) => setCreateForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{t.employees_emergency_relation ?? ""}</span>
              <input
                value={createForm.emergencyRelation}
                onChange={(e) => setCreateForm((f) => ({ ...f, emergencyRelation: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <p className="text-xs font-semibold text-zinc-500 pt-2 border-t border-zinc-200 dark:border-slate-700">
              {tl.employees_section_pay ?? ""}
            </p>
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.employees_payment_type ?? ""}</span>
              <select
                value={createForm.payType}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    payType: e.target.value as typeof f.payType,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="unspecified">{tl.employees_pay_type_unspecified ?? ""}</option>
                <option value="fixed">{tl.production_pay_fixed ?? tl.employees_fixed_salary ?? ""}</option>
                <option value="hourly">{tl.production_pay_hourly ?? tl.employees_hourly_rate ?? ""}</option>
                <option value="production">{tl.production_pay_production ?? ""}</option>
              </select>
            </label>
            {createForm.payType === "production" ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {tl.employees_pay_production_note ?? ""}
              </p>
            ) : null}
            {createForm.payType !== "unspecified" && createForm.payType !== "production" ? (
              <>
                <label className="block text-sm">
                  <span className="text-zinc-500">
                    {createForm.payType === "fixed"
                      ? tl.employees_fixed_salary ?? ""
                      : tl.employees_hourly_rate ?? ""}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={createForm.payAmount}
                    onChange={(e) => setCreateForm((f) => ({ ...f, payAmount: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-500">{tl.employees_currency ?? ""}</span>
                  <select
                    value={createForm.payCurrency}
                    onChange={(e) => setCreateForm((f) => ({ ...f, payCurrency: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                  >
                    {PAY_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                {createForm.payType === "fixed" ? (
                  <label className="block text-sm">
                    <span className="text-zinc-500">{tl.employees_pay_period ?? ""}</span>
                    <select
                      value={createForm.payPeriod}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          payPeriod: e.target.value as typeof f.payPeriod,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                    >
                      <option value="monthly">{tl.pay_period_monthly ?? ""}</option>
                      <option value="biweekly">{tl.pay_period_biweekly ?? ""}</option>
                      <option value="weekly">{tl.pay_period_weekly ?? ""}</option>
                    </select>
                  </label>
                ) : null}
              </>
            ) : null}
            <p className="text-xs font-semibold text-zinc-500 pt-2 border-t border-zinc-200 dark:border-slate-700">
              {tl.employees_role_permissions ?? ""}
            </p>
            <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
              <span className="text-sm text-zinc-700 dark:text-zinc-200">{tl.employees_use_role_permissions ?? ""}</span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-zinc-300"
                checked={createForm.useRolePermissions}
                onChange={(e) => {
                  const on = e.target.checked;
                  setCreateForm((f) => ({
                    ...f,
                    useRolePermissions: on,
                    customPermissions: on ? {} : mergePerm(createSelectedRolePermissions, f.customPermissions),
                  }));
                }}
              />
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {ROLE_PERMISSION_KEYS.map((key) => (
                <label
                  key={key}
                  className={`flex items-center justify-between gap-3 text-sm py-1 ${
                    createForm.useRolePermissions ? "opacity-80" : ""
                  }`}
                >
                  <span className="text-zinc-600 dark:text-zinc-300">{permLabel(key, t as Record<string, string>)}</span>
                  <input
                    type="checkbox"
                    checked={createEffectivePermissionValue(key)}
                    onChange={() => toggleCreatePermission(key)}
                    disabled={createForm.useRolePermissions}
                    className="h-5 w-5 rounded border-zinc-300"
                  />
                </label>
              ))}
            </div>
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.employees_role ?? ""}</span>
              <select
                value={createForm.customRoleId}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, customRoleId: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              >
                {customRoles.map((cr) => (
                  <option key={cr.id} value={cr.id}>
                    {cr.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">{tl.employees_status ?? ""}</span>
              <select
                value={createForm.profileStatus}
                onChange={(e) => setCreateForm((f) => ({ ...f, profileStatus: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="active">{tl.employees_status_active ?? ""}</option>
                <option value="inactive">{tl.employees_status_inactive ?? ""}</option>
                <option value="invited">{tl.employees_status_invited ?? ""}</option>
              </select>
            </label>
            <p className="text-xs font-semibold text-zinc-500 pt-2 border-t border-zinc-200 dark:border-slate-700">
              {tl.employees_section_vacation ?? ""}
            </p>
            <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
              <span className="text-sm text-zinc-700 dark:text-zinc-200">{tl.employees_manage_vacations ?? ""}</span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-zinc-300"
                checked={createForm.manageVacations}
                onChange={(e) => setCreateForm((f) => ({ ...f, manageVacations: e.target.checked }))}
              />
            </label>
            {createForm.manageVacations ? (
              <label className="block text-sm">
                <span className="text-zinc-500">{tl.employees_vacation_days_annual ?? t.employees_vacation_days_allowed ?? ""}</span>
                <input
                  type="number"
                  min={0}
                  value={createForm.vacationDaysAnnual}
                  onChange={(e) => setCreateForm((f) => ({ ...f, vacationDaysAnnual: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                />
              </label>
            ) : null}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                className="min-h-[44px] w-full rounded-lg border border-zinc-300 px-4 py-2.5 dark:border-zinc-600 sm:w-auto"
                disabled={createSaving}
                onClick={() => setCreateOpen(false)}
              >
                {t.cancel ?? ""}
              </button>
              <button
                type="button"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-white disabled:opacity-50 sm:w-auto sm:min-w-[44px]"
                disabled={createSaving}
                onClick={() => void submitCreateEmployee()}
              >
                {createSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    <span>{tl.loading_saving ?? "…"}</span>
                  </>
                ) : (
                  tl.employees_create_submit ?? t.save ?? ""
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {inviteOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" aria-hidden onClick={() => setInviteOpen(false)} />
          <div className="fixed z-[61] inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:inset-x-auto sm:max-w-md md:max-w-lg lg:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
            <p className="text-sm font-medium">{t.employees_invite ?? ""}</p>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 min-h-[44px]"
              placeholder={t.email ?? ""}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                className="min-h-[44px] w-full rounded-lg border px-4 py-2.5 sm:w-auto"
                onClick={() => setInviteOpen(false)}
              >
                {t.cancel ?? ""}
              </button>
              <button
                type="button"
                disabled={!inviteEmail.includes("@")}
                className="min-h-[44px] w-full rounded-lg bg-amber-600 px-4 py-2.5 text-white disabled:opacity-50 sm:w-auto sm:min-w-[44px]"
                onClick={() => openInviteMailto()}
              >
                {tl.employees_invite_send ?? ""}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
    </>
  );
}
