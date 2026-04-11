"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  UserCheck,
  AlertTriangle,
  ClipboardCheck,
  Clock,
  Layers,
  StickyNote,
  Plus,
  QrCode,
  FileSearch,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Briefcase,
  ClipboardList,
  KeyRound,
  ShieldAlert,
  Shield,
  GripVertical,
  X,
  Settings2,
  Package,
  MapPin,
} from "lucide-react";

const TeamGpsMapWidget = dynamic(
  () => import("@/components/TeamGpsMapWidget").then((m) => m.TeamGpsMapWidget),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] md:h-[450px] animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/80" />
    ),
  }
);
import { supabase } from "@/lib/supabase";
import { GettingStartedWidget } from "@/components/GettingStartedWidget";
import { LaborCostingDashboardWidget } from "@/components/LaborCostingDashboardWidget";
import type { AuditLogEntry } from "@/lib/useAuditLog";
import type { Hazard } from "@/types/hazard";
import type { MainSection } from "@/types/shared";
import type { UserRole } from "@/types/shared";
import {
  buildDashboardConfigPayload,
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  mergeDashboardRaw,
  parseDashboardConfig,
  type DashboardWidgetId,
  type QuickAccessKey,
  type ResolvedDashboardConfig,
  QUICK_ACCESS_KEYS,
} from "@/lib/dashboardConfig";
import {
  clearCentralDashboardConfigCache,
  readCentralDashboardConfigCache,
  writeCentralDashboardConfigCache,
} from "@/lib/centralDashboardCache";
import { displayNameFromProfile } from "@/lib/profileDisplayName";
import { useDismissOnEscape } from "@/hooks/useDismissOnEscape";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";
import { useToast } from "@/components/Toast";
import {
  dateLocaleForUser,
  resolveUserTimezone,
  formatDateLong,
  formatTime,
  formatRelative,
  formatDateTime,
  getClockHourInTimeZone,
  formatTodayYmdInTimeZone,
} from "@/lib/dateUtils";

function startEndLocalDay(offsetDays: number): { start: string; end: string } {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  const start = d.toISOString();
  d.setHours(23, 59, 59, 999);
  const end = d.toISOString();
  return { start, end };
}

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return String(e);
}

type AuditProfileSnippet = {
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

type VisitorWidgetRow = {
  id: string;
  visitor_name: string;
  check_in: string;
  project_name: string | null;
  status: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Evita huecos en grid 2 columnas (md+): último impar a ancho completo; antes de `quick_access` (ancho completo) también. */
function mdColSpanForOperationsWidget(ids: DashboardWidgetId[], index: number): string {
  let col = 0;
  for (let i = 0; i < ids.length; i++) {
    const w = ids[i]!;
    if (w === "quick_access") {
      if (i === index) return "md:col-span-2";
      col = 0;
      continue;
    }
    if (col === 0) {
      const isLast = i === ids.length - 1;
      if (isLast) {
        if (i === index) return "md:col-span-2";
        col = 0;
        continue;
      }
      if (ids[i + 1] === "quick_access") {
        if (i === index) return "md:col-span-2";
        col = 0;
        continue;
      }
      if (i === index) return "";
      col = 1;
      continue;
    }
    if (i === index) return "";
    col = 0;
  }
  return "";
}

function auditActorLabel(
  row: AuditLogEntry,
  profileByUserId: Record<string, AuditProfileSnippet>,
  labels: Record<string, string>
): string {
  const localPart = (email: string): string => {
    const e = email.trim();
    const at = e.indexOf("@");
    return at > 0 ? e.slice(0, at) : e;
  };
  const safeName = (raw: string): string => {
    const t = raw.trim();
    if (!t) return "";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return localPart(t);
    return t;
  };
  const rawName = safeName(row.user_name ?? "");
  const badGeneric =
    /^usuario\s+del\s+equipo$/i.test(rawName) || /^team\s+user$/i.test(rawName);
  const un = rawName && !UUID_RE.test(rawName) && !badGeneric ? rawName : "";
  if (un) return un;

  const uid = (row.user_id ?? "").trim();
  const uidLower = uid.toLowerCase();
  const p =
    uid ? profileByUserId[uid] ?? profileByUserId[uidLower] : undefined;
  if (p) {
    const label = displayNameFromProfile(p.full_name, p.display_name, p.email);
    if (label) return safeName(label);
  }
  return (labels.dashboard_activity_unknown_user ?? "").trim() || "—";
}

/** Oculta login, sesión y demás acciones `auth_*` en el widget de actividad del panel central. */
function isAuthAuditAction(action: string | null | undefined): boolean {
  const a = (action ?? "").trim().toLowerCase();
  return a.startsWith("auth_");
}

function filterBusinessAuditRows(rows: AuditLogEntry[], max = 10): AuditLogEntry[] {
  return rows.filter((r) => !isAuthAuditAction(r.action)).slice(0, max);
}

function formatActivityLine(
  row: AuditLogEntry,
  labels: Record<string, string>,
  projectNames: Record<string, string>,
  who: string
): string {
  const action = (row.action ?? "").trim();
  const ent = row.entity_name ?? "";
  const nv = row.new_value as Record<string, unknown> | undefined;
  const pid =
    (typeof nv?.project_id === "string" ? nv.project_id : null) ??
    (typeof nv?.projectId === "string" ? nv.projectId : null);
  const pfx = pid && projectNames[pid] ? ` · ${projectNames[pid]}` : "";
  const dash = labels.common_dash ?? "—";
  const byActionKey = labels[`audit_action_${action}`];
  if (byActionKey) return `${who} ${byActionKey}${pfx}`;
  const humanAction = action.replace(/_/g, " ");
  const generic = (labels.dashboard_audit_generic ?? "{who} · {action}")
    .replace(/\{who\}/g, who)
    .replace(/\{action\}/g, humanAction);
  return ent ? `${generic} · ${ent}${pfx}` : `${generic}${pfx}`;
}

function WidgetSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3 pe-14" aria-hidden>
      <div className="h-4 max-w-[40%] rounded bg-gray-200 dark:bg-gray-600" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-700/80" />
      ))}
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-7 w-56 max-w-[80%] rounded-lg bg-gray-200 dark:bg-gray-600" />
      <div className="h-4 w-full max-w-md rounded bg-gray-100 dark:bg-gray-700" />
      <div className="grid grid-cols-2 gap-3 md:gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 min-h-[88px]"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-600 shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-4 max-w-[120px] rounded bg-gray-200 dark:bg-gray-600" />
                <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-600" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <WidgetSkeleton lines={5} />
    </div>
  );
}

function UnifiedDashCard({
  icon,
  iconWrapClassName,
  label,
  value,
  subContent,
  onClick,
  disabled,
  ariaLabel,
}: {
  icon: React.ReactNode;
  iconWrapClassName: string;
  label: string;
  value: React.ReactNode;
  subContent?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className="flex h-full min-h-[44px] w-full flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-left shadow-sm hover:border-amber-400/60 dark:hover:border-amber-500/50 transition-colors disabled:opacity-60 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      <div className="flex min-h-0 flex-1 items-start gap-3 w-full">
        <div className={`shrink-0 p-2 rounded-lg ${iconWrapClassName}`}>{icon}</div>
        <div className="flex min-h-0 flex-1 min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 ml-auto" aria-hidden />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums mt-1">{value}</p>
          {subContent ? <div className="mt-1">{subContent}</div> : null}
        </div>
      </div>
    </button>
  );
}

const WIDGET_LABEL_KEYS: Record<DashboardWidgetId, string> = {
  team_timeclock: "dashboard_widget_team_timeclock",
  team_map: "gps_map_title",
  my_timeclock: "myClockIn",
  activity: "dashboard_widget_activity",
  compliance_alerts: "complianceWatchdog",
  hazards: "hazards_title",
  security_summary: "dashboard_widget_security_summary",
  visitors: "dashboard_widget_visitors",
  my_tasks: "myTasksToday",
  daily_report: "dailyReportToSign",
  critical_inventory: "criticalInventory",
  labor_costing: "labor_costing",
  quick_access: "quickAccess",
  forms_pending: "forms_pending_widget",
};

export interface CentralDashboardLiveProps {
  labels: Record<string, string>;
  companyId: string | null;
  companyName?: string | null;
  language: string;
  /** ISO 3166-1 alpha-2 for regional date/number patterns with `language`. */
  countryCode?: string;
  /** IANA timezone for clocks and formatted timestamps. */
  timeZone?: string;
  activeProjectsCount: number;
  /** Zona gestión: tarjeta Proyectos (ver/crear proyectos o admin). */
  canViewProjectsManagement: boolean;
  projectNameById: Record<string, string>;
  currentUserRole: UserRole;
  canManageRoles: boolean;
  canViewRoles?: boolean;
  /** Zona 1 gestión, personalización del panel y widgets de gestión (actividad, visitantes, equipo). */
  canManageEmployees: boolean;
  canViewEmployees?: boolean;
  canViewAuditLog?: boolean;
  /** Widget fichaje del equipo. */
  canViewTeamClock: boolean;
  /** AH-20: mapa GPS del equipo (disponibilidad). */
  canViewTeamAvailability?: boolean;
  /** Alertas compliance e incidencias ampliadas. */
  canManageComplianceAlerts: boolean;
  canAccessVisitors: boolean;
  canAccessHazards: boolean;
  canAccessCorrective: boolean;
  canViewProjectVisitors?: boolean;
  canManageProjectVisitors?: boolean;
  canManageHazards?: boolean;
  canManageCorrectiveActions?: boolean;
  canManageProjectRFI?: boolean;
  canAccessSubcontractors?: boolean;
  /** Inventario crítico (canViewInventory), no solo logística general. */
  canViewInventory?: boolean;
  onNavigateAppSection: (section: MainSection) => void;
  onOpenAuditInCentral: () => void;
  onQuickNewHazard: () => void;
  onQuickNewAction: () => void;
  onQuickVisitorQr: () => void;
  onNavigateToOperationsVisitors?: () => void;
  visitorCheckInUrl: string | null;
  canAccessEmployees?: boolean;
  onOpenRolesInCentral: () => void;
  customRolesCount: number;
  complianceWatchdogCount?: number;
  onOpenComplianceInCentral?: () => void;
  currentUserId?: string | null;
  canViewLogistics: boolean;
  canViewDashboardWidgets?: boolean;
  criticalInventoryCount?: number;
  onQuickNewEmployee?: () => void;
  onQuickNewRfi?: () => void;
  onQuickNewSubcontractor?: () => void;
  onOpenSubcontractorsInOperations?: () => void;
  onOpenMyShiftView?: () => void;
  onProjectsManagementCardClick?: () => void;
  myShiftCentralCard?: {
    hasShiftToday: boolean;
    projectName?: string;
    shiftTimeLabel?: string;
    workedSummary?: string | null;
    clockedInNotOut?: boolean;
  };
  manualClockEmployeeOptions?: { id: string; name: string }[];
  manualClockProjectOptions?: { id: string; name: string }[];
  registerManualClockIn?: (p: {
    targetUserId: string;
    date: string;
    time: string;
    projectId?: string | null;
    notes?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** AH-17: optional labor costing widget (requires at least one configured rate). */
  laborCostingEnabled?: boolean;
  canViewLaborCosting?: boolean;
  laborCostingCurrency?: string;
  laborCostingRateByUserId?: Record<string, number>;
  laborCostingEmployeeLabels?: Record<string, string>;
  gettingStartedRefreshTk?: number;
  /** AH-21: certificados / documentos con vencimiento expirado (empleados + vehículos). */
  complianceExpiredCertCount?: number;
  /** Solo usuarios con permiso de seguridad ven el widget opcional. */
  canViewSecurityDashboard?: boolean;
  onOpenOperationsSecurity?: () => void;
  canViewForms?: boolean;
  formsActiveCount?: number;
  /** Hasta 5 filas: formularios pendientes del día para el widget del panel. */
  formsPendingTodayPreview?: { id: string; name: string; contextLine: string; status: string }[];
  onNavigateToForms?: () => void;
  /** Abre el módulo Formularios en la librería de plantillas (crear). */
  onNavigateToFormsNew?: () => void;
}

type TimeRow = {
  id: string;
  user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
};

const CENTRAL_WARM_TTL_MS = 60_000;

type CentralDashboardCacheSnap = {
  companyId: string;
  audit?: { at: number; rows: AuditLogEntry[]; profiles: Record<string, AuditProfileSnippet> };
  visitors?: { at: number; todayCount: number; activeNow: number; recent: VisitorWidgetRow[] };
  hazards?: { at: number; hazardRows: Hazard[]; correctivePendingCount: number };
  empCount?: { at: number; value: number | null };
};

type CentralDashboardWarmBlob = {
  savedAt: number;
  refreshTk: number;
  todayIso: string;
  resolvedConfig: ResolvedDashboardConfig;
  myTimeRows: TimeRow[];
  teamTimeRows: TimeRow[];
  teamClockLabelsByUserId: Record<string, string>;
  scheduleToday: Record<string, unknown>[];
  dailyReportsToday: Record<string, unknown>[];
  myTasksToday: { description: string; completed: boolean }[];
  empActiveCount: number | null;
  activityRows: AuditLogEntry[];
  auditProfileByUserId: Record<string, AuditProfileSnippet>;
  hazardRows: Hazard[];
  correctivePendingCount: number;
  visitorsTodayCount: number;
  visitorsActiveNow: number;
  visitorsRecent: VisitorWidgetRow[];
  dashboardCache: CentralDashboardCacheSnap;
};

const centralDashboardWarmStore = new Map<string, CentralDashboardWarmBlob>();

function centralDashboardWarmKey(companyId: string, userId: string, refreshTk: number, todayIso: string) {
  return `${companyId}\0${userId}\0${refreshTk}\0${todayIso}`;
}

type CentralCachedProfileRow = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

const centralUserProfileRowsByKey = new Map<string, CentralCachedProfileRow>();

function centralProfileRowKey(companyId: string, userId: string) {
  return `${companyId}\0${userId.trim().toLowerCase()}`;
}

async function fetchCentralUserProfilesMerged(
  companyId: string,
  rawIds: string[]
): Promise<Record<string, AuditProfileSnippet>> {
  const ids = [...new Set(rawIds.map((x) => String(x).trim()).filter(Boolean))];
  const missing: string[] = [];
  for (const id of ids) {
    if (!centralUserProfileRowsByKey.has(centralProfileRowKey(companyId, id))) missing.push(id);
  }
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, full_name, display_name, email")
      .eq("company_id", companyId)
      .in("id", missing);
    if (error) throw error;
    for (const p of (data ?? []) as CentralCachedProfileRow[]) {
      const idRaw = (p.id ?? "").trim();
      if (!idRaw) continue;
      centralUserProfileRowsByKey.set(centralProfileRowKey(companyId, idRaw), p);
    }
  }
  const profileMap: Record<string, AuditProfileSnippet> = {};
  for (const id of ids) {
    const p = centralUserProfileRowsByKey.get(centralProfileRowKey(companyId, id));
    if (!p) continue;
    const snippet: AuditProfileSnippet = {
      full_name: p.full_name,
      display_name: p.display_name,
      email: p.email,
    };
    profileMap[id] = snippet;
    profileMap[id.toLowerCase()] = snippet;
  }
  return profileMap;
}

function buildTeamClockLabelsFromCentralCache(companyId: string, rawIds: string[]): Record<string, string> {
  const ids = [...new Set(rawIds.map((x) => String(x).trim()).filter(Boolean))];
  const next: Record<string, string> = {};
  for (const id of ids) {
    const p = centralUserProfileRowsByKey.get(centralProfileRowKey(companyId, id));
    const label = p
      ? displayNameFromProfile(p.full_name, p.display_name, p.email) || `${id.slice(0, 8)}…`
      : `${id.slice(0, 8)}…`;
    next[id] = label;
    next[id.toLowerCase()] = label;
  }
  return next;
}

export function CentralDashboardLive(props: CentralDashboardLiveProps) {
  const companyId = props.companyId;
  const currentUserId = props.currentUserId ?? null;
  if (!companyId || !currentUserId) {
    return <SkeletonLoader />;
  }
  return <CentralDashboardBody {...props} companyId={companyId} currentUserId={currentUserId} />;
}

function CentralDashboardBody(
  props: CentralDashboardLiveProps & { companyId: string; currentUserId: string }
) {
  const {
    labels: labelsProp,
    companyId,
    companyName,
    language,
    countryCode = "CA",
    timeZone: timeZoneProp,
    activeProjectsCount,
    canViewProjectsManagement,
    projectNameById,
    currentUserRole,
    canManageRoles,
    canViewRoles = false,
    canManageEmployees,
    canViewEmployees = false,
    canViewAuditLog = false,
    canViewTeamClock,
    canViewTeamAvailability = false,
    canManageComplianceAlerts,
    canAccessVisitors,
    canAccessHazards,
    canAccessCorrective,
    canViewProjectVisitors = false,
    canManageProjectVisitors = false,
    canManageHazards = false,
    canManageCorrectiveActions = false,
    canManageProjectRFI = false,
    canAccessSubcontractors = false,
    canViewInventory = false,
    onNavigateAppSection,
    onOpenAuditInCentral,
    onQuickNewHazard,
    onQuickNewAction,
    onQuickVisitorQr,
    onNavigateToOperationsVisitors,
    visitorCheckInUrl,
    canAccessEmployees = false,
    onOpenRolesInCentral,
    customRolesCount,
    complianceWatchdogCount = 0,
    onOpenComplianceInCentral,
    currentUserId,
    canViewLogistics,
    canViewDashboardWidgets = true,
    criticalInventoryCount = 0,
    onQuickNewEmployee,
    onQuickNewRfi,
    onQuickNewSubcontractor,
    onOpenSubcontractorsInOperations,
    onOpenMyShiftView,
    onProjectsManagementCardClick,
    myShiftCentralCard,
    manualClockEmployeeOptions = [],
    manualClockProjectOptions = [],
    registerManualClockIn,
    laborCostingEnabled = false,
    canViewLaborCosting = false,
    laborCostingCurrency = "CAD",
    laborCostingRateByUserId = {},
    laborCostingEmployeeLabels = {},
    gettingStartedRefreshTk = 0,
    complianceExpiredCertCount = 0,
    canViewSecurityDashboard = false,
    onOpenOperationsSecurity,
    canViewForms = false,
    formsActiveCount = 0,
    formsPendingTodayPreview = [],
    onNavigateToForms,
    onNavigateToFormsNew,
  } = props;

  const labels = labelsProp;
  const L = (key: string) => labels[key] ?? "";
  const { showToast } = useToast();
  void useMachinProDisplayPrefs();

  const timeZone = timeZoneProp ?? resolveUserTimezone(null);
  const dateLoc = dateLocaleForUser(language, countryCode);

  const todayIso = localTodayYmd();
  const { start: tStart, end: tEnd } = startEndLocalDay(0);

  const getGreeting = () => {
    const hour = getClockHourInTimeZone(new Date(), timeZone);
    if (hour < 12) return labels.goodMorning ?? "";
    if (hour < 18) return labels.goodAfternoon ?? "";
    return labels.goodEvening ?? "";
  };
  const formattedDate = formatDateLong(new Date(), dateLoc, timeZone);

  const [primaryReady, setPrimaryReady] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [empCountLoading, setEmpCountLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [hazardsLoading, setHazardsLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [dashboardRefreshTk, setDashboardRefreshTk] = useState(0);
  const [manualClockOpen, setManualClockOpen] = useState(false);
  const [manualClockSaving, setManualClockSaving] = useState(false);
  const [manualTargetUserId, setManualTargetUserId] = useState("");
  const [manualDateYmd, setManualDateYmd] = useState("");
  const [manualTimeHm, setManualTimeHm] = useState("");
  const [manualProjectId, setManualProjectId] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const openManualClockModal = useCallback(() => {
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    setManualTimeHm(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
    setManualDateYmd(formatTodayYmdInTimeZone(timeZone));
    setManualProjectId("");
    setManualNotes("");
    setManualTargetUserId(manualClockEmployeeOptions[0]?.id ?? "");
    setManualClockOpen(true);
  }, [timeZone, manualClockEmployeeOptions]);

  const submitManualClock = useCallback(async () => {
    if (!registerManualClockIn || !manualTargetUserId || !manualDateYmd || !manualTimeHm) return;
    setManualClockSaving(true);
    try {
      const r = await registerManualClockIn({
        targetUserId: manualTargetUserId,
        date: manualDateYmd,
        time: manualTimeHm,
        projectId: manualProjectId.trim() ? manualProjectId : null,
        notes: manualNotes.trim() || undefined,
      });
      if (r.ok) {
        showToast("success", L("clock_manual_in") || "OK");
        setManualClockOpen(false);
        setDashboardRefreshTk((n) => n + 1);
      } else {
        showToast("error", r.error ?? L("export_error") ?? "Error");
      }
    } finally {
      setManualClockSaving(false);
    }
  }, [
    registerManualClockIn,
    manualTargetUserId,
    manualDateYmd,
    manualTimeHm,
    manualProjectId,
    manualNotes,
    showToast,
    L,
  ]);

  const [resolvedConfig, setResolvedConfig] = useState<ResolvedDashboardConfig>(() => parseDashboardConfig(null));
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draftConfig, setDraftConfig] = useState<ResolvedDashboardConfig>(() => parseDashboardConfig(null));
  const [savingConfig, setSavingConfig] = useState(false);

  const [myTimeRows, setMyTimeRows] = useState<TimeRow[]>([]);
  const [teamTimeRows, setTeamTimeRows] = useState<TimeRow[]>([]);
  /** Display labels for team timeclock widget (full_name → display_name → email). */
  const [teamClockLabelsByUserId, setTeamClockLabelsByUserId] = useState<Record<string, string>>({});
  const [scheduleToday, setScheduleToday] = useState<Record<string, unknown>[]>([]);
  const [dailyReportsToday, setDailyReportsToday] = useState<Record<string, unknown>[]>([]);
  const [myTasksToday, setMyTasksToday] = useState<{ description: string; completed: boolean }[]>([]);
  const [empActiveCount, setEmpActiveCount] = useState<number | null>(null);
  const [activityRows, setActivityRows] = useState<AuditLogEntry[]>([]);
  const [auditProfileByUserId, setAuditProfileByUserId] = useState<Record<string, AuditProfileSnippet>>({});
  const [hazardRows, setHazardRows] = useState<Hazard[]>([]);
  const [correctivePendingCount, setCorrectivePendingCount] = useState(0);
  const [visitorsTodayCount, setVisitorsTodayCount] = useState(0);
  const [visitorsActiveNow, setVisitorsActiveNow] = useState(0);
  const [visitorsRecent, setVisitorsRecent] = useState<VisitorWidgetRow[]>([]);

  const dashboardDataCacheRef = useRef<{
    companyId: string;
    audit?: { at: number; rows: AuditLogEntry[]; profiles: Record<string, AuditProfileSnippet> };
    visitors?: { at: number; todayCount: number; activeNow: number; recent: VisitorWidgetRow[] };
    hazards?: { at: number; hazardRows: Hazard[]; correctivePendingCount: number };
    empCount?: { at: number; value: number | null };
  }>({ companyId: "" });
  const lastDashboardRefreshTkAppliedRef = useRef<number | null>(null);
  const hasLoadedRef = useRef(false);

  const showZone1 =
    canViewEmployees ||
    canManageEmployees ||
    canViewRoles ||
    canManageRoles ||
    canViewProjectsManagement ||
    canViewForms;

  const canShowWidget = useCallback(
    (id: DashboardWidgetId): boolean => {
      switch (id) {
        case "team_timeclock":
          return canViewTeamClock;
        case "team_map":
          return canViewTeamAvailability;
        case "my_timeclock":
          return true;
        case "activity":
          return canViewAuditLog;
        case "compliance_alerts":
          return canManageComplianceAlerts;
        case "hazards":
          return canAccessHazards;
        case "security_summary":
          return canViewSecurityDashboard;
        case "visitors":
          return canViewProjectVisitors;
        case "my_tasks":
          return true;
        case "daily_report":
          return true;
        case "critical_inventory":
          return canViewInventory;
        case "quick_access":
          return true;
        case "labor_costing":
          return laborCostingEnabled && canViewLaborCosting;
        default:
          return false;
      }
    },
    [
      canViewTeamClock,
      canViewTeamAvailability,
      canManageEmployees,
      canViewAuditLog,
      canManageComplianceAlerts,
      canAccessHazards,
      canAccessCorrective,
      canViewSecurityDashboard,
      canAccessVisitors,
      canViewLogistics,
      canViewInventory,
      laborCostingEnabled,
      canViewLaborCosting,
      canViewForms,
      canViewProjectVisitors,
    ]
  );

  const loadDashboardConfig = useCallback(async (): Promise<ResolvedDashboardConfig> => {
    try {
      const cached = readCentralDashboardConfigCache(companyId, currentUserId);
      if (cached != null) {
        const parsed = parseDashboardConfig(cached);
        setResolvedConfig(parsed);
        return parsed;
      }
      const [{ data: co, error: coErr }, { data: pr, error: prErr }] = await Promise.all([
        supabase.from("companies").select("dashboard_config").eq("id", companyId).maybeSingle(),
        supabase.from("user_profiles").select("dashboard_config").eq("id", currentUserId).maybeSingle(),
      ]);
      if (coErr) throw coErr;
      if (prErr) throw prErr;
      const userRaw = (pr as { dashboard_config?: unknown } | null)?.dashboard_config ?? null;
      const merged = mergeDashboardRaw(co?.dashboard_config ?? null, userRaw);
      writeCentralDashboardConfigCache(companyId, currentUserId, merged);
      const parsed = parseDashboardConfig(merged);
      setResolvedConfig(parsed);
      return parsed;
    } catch (e) {
      console.error("[CentralDashboard] loadDashboardConfig", e);
      setLoadErrors((prev) => [...prev, errMessage(e)]);
      const fallback = parseDashboardConfig(null);
      setResolvedConfig(fallback);
      return fallback;
    }
  }, [companyId, currentUserId]);

  useEffect(() => {
    if (customizeOpen) setDraftConfig(resolvedConfig);
  }, [customizeOpen, resolvedConfig]);

  const persistConfig = useCallback(
    async (next: ResolvedDashboardConfig): Promise<boolean> => {
      if (!companyId || !canManageEmployees) return false;
      setSavingConfig(true);
      try {
        const payload = buildDashboardConfigPayload(next);
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return false;
        const res = await fetch("/api/dashboard-config", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ companyId, dashboard_config: payload }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          let msg = L("dashboard_config_save_error") || L("toast_error") || "Could not save";
          try {
            const j = JSON.parse(errText) as { error?: string };
            if (j?.error) msg = `${msg}: ${j.error}`;
          } catch {
            if (errText) msg = `${msg}: ${errText}`;
          }
          showToast("error", msg);
          return false;
        }
        clearCentralDashboardConfigCache();
        showToast("success", L("dashboard_config_saved") || L("push_saved") || "Saved");
        await loadDashboardConfig();
        return true;
      } catch (e) {
        console.error("[CentralDashboard] persistConfig", e);
        setLoadErrors((prev) => [...prev, errMessage(e)]);
        showToast("error", L("dashboard_config_save_error") || L("toast_error") || errMessage(e));
        return false;
      } finally {
        setSavingConfig(false);
      }
    },
    [companyId, canManageEmployees, showToast, labels, loadDashboardConfig]
  );

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const scheduleDelayed = (ms: number, fn: () => Promise<void>) =>
      new Promise<void>((resolve) => {
        const tid = setTimeout(() => {
          void fn().finally(() => resolve());
        }, ms);
        timers.push(tid);
      });

    const pushErr = (e: unknown, label: string) => {
      if (cancelled) return;
      setLoadErrors((prev) => [...prev, `${label}: ${errMessage(e)}`]);
    };

    const cref = dashboardDataCacheRef;
    if (cref.current.companyId !== companyId) {
      cref.current = { companyId };
    }
    const c = cref.current;

    const warmKey = centralDashboardWarmKey(companyId, currentUserId, dashboardRefreshTk, todayIso);
    const warm = centralDashboardWarmStore.get(warmKey);
    if (warm && Date.now() - warm.savedAt < CENTRAL_WARM_TTL_MS) {
      lastDashboardRefreshTkAppliedRef.current = dashboardRefreshTk;
      cref.current = { ...warm.dashboardCache, companyId };
      hasLoadedRef.current = true;
      setLoadErrors([]);
      setResolvedConfig(warm.resolvedConfig);
      setMyTimeRows(warm.myTimeRows);
      setTeamTimeRows(warm.teamTimeRows);
      setTeamClockLabelsByUserId(warm.teamClockLabelsByUserId);
      setScheduleToday(warm.scheduleToday);
      setDailyReportsToday(warm.dailyReportsToday);
      setMyTasksToday(warm.myTasksToday);
      setEmpActiveCount(warm.empActiveCount);
      setActivityRows(warm.activityRows);
      setAuditProfileByUserId(warm.auditProfileByUserId);
      setHazardRows(warm.hazardRows);
      setCorrectivePendingCount(warm.correctivePendingCount);
      setVisitorsTodayCount(warm.visitorsTodayCount);
      setVisitorsActiveNow(warm.visitorsActiveNow);
      setVisitorsRecent(warm.visitorsRecent);
      setPrimaryReady(true);
      setScheduleLoading(false);
      setDailyLoading(false);
      setEmpCountLoading(false);
      setActivityLoading(false);
      setVisitorsLoading(false);
      setHazardsLoading(false);
      return () => {
        cancelled = true;
        for (const t of timers) clearTimeout(t);
      };
    }

    if (lastDashboardRefreshTkAppliedRef.current !== dashboardRefreshTk) {
      lastDashboardRefreshTkAppliedRef.current = dashboardRefreshTk;
      delete c.audit;
      delete c.visitors;
      delete c.hazards;
      delete c.empCount;
    }

    const run = async () => {
      setLoadErrors([]);
      setPrimaryReady(false);
      setScheduleLoading(true);
      setDailyLoading(true);
      setEmpCountLoading(true);
      setActivityLoading(true);
      setVisitorsLoading(true);
      setHazardsLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        if (!cancelled) {
          setPrimaryReady(false);
          setScheduleLoading(false);
          setDailyLoading(false);
          setEmpCountLoading(false);
          setActivityLoading(false);
          setVisitorsLoading(false);
          setHazardsLoading(false);
        }
        return;
      }

      let scheduleMine: Record<string, unknown>[] = [];
      let dailyFiltered: Record<string, unknown>[] = [];
      let myTasksSnapshot: { description: string; completed: boolean }[] = [];
      let visitorsTodaySnap = 0;
      let visitorsActiveSnap = 0;
      let visitorsRecentSnap: VisitorWidgetRow[] = [];
      let hazardRowsSnap: Hazard[] = [];
      let correctiveSnap = 0;
      let activityRowsSnap: AuditLogEntry[] = [];
      let auditProfilesSnap: Record<string, AuditProfileSnippet> = {};

      const phase1Time = async (): Promise<{
        myTimeRows: TimeRow[];
        teamTimeRows: TimeRow[];
        teamLabels: Record<string, string>;
      }> => {
        const empty = { myTimeRows: [] as TimeRow[], teamTimeRows: [] as TimeRow[], teamLabels: {} as Record<string, string> };
        try {
          const { data, error } = await supabase
            .from("time_entries")
            .select("id, user_id, clock_in_at, clock_out_at")
            .eq("company_id", companyId)
            .gte("clock_in_at", tStart)
            .lte("clock_in_at", tEnd)
            .order("clock_in_at", { ascending: false })
            .limit(20);
          if (error) throw error;
          if (cancelled) return empty;
          const rows = (data ?? []) as TimeRow[];
          const myTimeRows = rows.filter((r) => String(r.user_id) === currentUserId);
          const teamTimeRows = canViewTeamClock ? rows : [];
          let teamLabels: Record<string, string> = {};
          if (canViewTeamClock && teamTimeRows.length > 0) {
            const ids = [...new Set(teamTimeRows.map((r) => r.user_id).filter(Boolean))] as string[];
            try {
              await fetchCentralUserProfilesMerged(companyId, ids);
              teamLabels = buildTeamClockLabelsFromCentralCache(companyId, ids);
            } catch (e) {
              pushErr(e, "user_profiles");
            }
          }
          if (!cancelled) {
            setMyTimeRows(myTimeRows);
            setTeamTimeRows(teamTimeRows);
            setTeamClockLabelsByUserId(teamLabels);
          }
          return { myTimeRows, teamTimeRows, teamLabels };
        } catch (e) {
          pushErr(e, L("myClockIn"));
          if (!cancelled) {
            setMyTimeRows([]);
            setTeamTimeRows([]);
            setTeamClockLabelsByUserId({});
          }
          return empty;
        }
      };

      const phase1Emp = async (): Promise<number | null> => {
        try {
          if (!canViewEmployees && !canManageEmployees) {
            if (!cancelled) setEmpActiveCount(null);
            return null;
          }
          const now = Date.now();
          const cached = c.empCount;
          if (cached && now - cached.at < 300_000) {
            if (!cancelled) setEmpActiveCount(cached.value);
            return cached.value;
          }
          const { count, error } = await supabase
            .from("user_profiles")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("profile_status", "active");
          if (error) throw error;
          const value = count ?? 0;
          c.empCount = { at: Date.now(), value };
          if (!cancelled) setEmpActiveCount(value);
          return value;
        } catch (e) {
          pushErr(e, "user_profiles");
          return null;
        } finally {
          if (!cancelled) setEmpCountLoading(false);
        }
      };

      const [t1, resolvedCfg, empSnap] = await Promise.all([
        phase1Time(),
        loadDashboardConfig(),
        phase1Emp(),
      ]);
      if (cancelled) return;
      setPrimaryReady(true);

      const loadSchedule = async () => {
        try {
          const { data, error } = await supabase
            .from("schedule_entries")
            .select("id, employee_ids")
            .eq("company_id", companyId)
            .eq("date", todayIso)
            .limit(50);
          if (error) throw error;
          const rows = (data ?? []) as Record<string, unknown>[];
          const mine = rows.filter((row) => {
            const ids = row.employee_ids;
            if (!Array.isArray(ids)) return false;
            return ids.map(String).includes(currentUserId);
          });
          scheduleMine = mine;
          if (!cancelled) setScheduleToday(mine);
        } catch (e) {
          pushErr(e, "schedule");
        } finally {
          if (!cancelled) setScheduleLoading(false);
        }
      };

      const loadDailyBundle = async () => {
        try {
          const { data: epData, error: epErr } = await supabase
            .from("employee_projects")
            .select("project_id")
            .eq("user_id", currentUserId)
            .eq("company_id", companyId)
            .limit(120);
          if (epErr) throw epErr;
          const projectIdsForUser = ((epData ?? []) as { project_id: string }[]).map((r) =>
            String(r.project_id)
          );

          const { data: drData, error: drErr } = await supabase
            .from("daily_reports")
            .select(
              `id, project_id, date, status, title, daily_report_tasks (id, employee_id, description, completed)`
            )
            .eq("company_id", companyId)
            .eq("date", todayIso)
            .limit(50);
          if (drErr) throw drErr;
          const rows = (drData ?? []) as Record<string, unknown>[];
          let filtered = rows;
          if (projectIdsForUser.length > 0) {
            const pset = new Set(projectIdsForUser);
            const f = rows.filter((r) => pset.has(String(r.project_id ?? "")));
            if (f.length > 0) filtered = f;
          }
          dailyFiltered = filtered;
          const tasks: { description: string; completed: boolean }[] = [];
          for (const r of filtered) {
            const dt = r.daily_report_tasks;
            if (!Array.isArray(dt)) continue;
            for (const te of dt) {
              const tr = te as Record<string, unknown>;
              if (String(tr.employee_id ?? "") !== currentUserId) continue;
              tasks.push({
                description: String(tr.description ?? ""),
                completed: tr.completed === true,
              });
            }
          }
          myTasksSnapshot = tasks;
          if (!cancelled) {
            setDailyReportsToday(filtered);
            setMyTasksToday(tasks);
          }
        } catch (e) {
          pushErr(e, "daily_reports");
        } finally {
          if (!cancelled) setDailyLoading(false);
        }
      };

      const auditPipeline = async () => {
        try {
          if (!canManageEmployees && !canViewAuditLog) {
            if (!cancelled) {
              setActivityRows([]);
              setAuditProfileByUserId({});
            }
            activityRowsSnap = [];
            auditProfilesSnap = {};
            return;
          }
          const now = Date.now();
          const cached = c.audit;
          if (cached && now - cached.at < 60_000) {
            const visible = filterBusinessAuditRows(cached.rows, 10);
            if (!cancelled) {
              setActivityRows(visible);
              setAuditProfileByUserId(cached.profiles);
            }
            activityRowsSnap = visible;
            auditProfilesSnap = cached.profiles;
            return;
          }
          const { data, error } = await supabase
            .from("audit_logs")
            .select(
              "id, company_id, user_id, user_name, action, entity_type, entity_id, entity_name, new_value, created_at"
            )
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(36);
          if (error) throw error;
          const rows = (data ?? []) as AuditLogEntry[];
          const filteredRows = filterBusinessAuditRows(rows, 10);
          const ids = [...new Set(filteredRows.map((r) => r.user_id).filter(Boolean))] as string[];
          const profileMap =
            ids.length > 0 ? await fetchCentralUserProfilesMerged(companyId, ids) : ({} as Record<string, AuditProfileSnippet>);
          c.audit = { at: Date.now(), rows: filteredRows, profiles: profileMap };
          activityRowsSnap = filteredRows;
          auditProfilesSnap = profileMap;
          if (!cancelled) {
            setActivityRows(filteredRows);
            setAuditProfileByUserId(profileMap);
          }
        } catch (e) {
          pushErr(e, L("dashboard_widget_activity"));
        } finally {
          if (!cancelled) setActivityLoading(false);
        }
      };

      const fetchVisitors = async () => {
        try {
          if (!canAccessVisitors) {
            if (!cancelled) {
              setVisitorsTodayCount(0);
              setVisitorsActiveNow(0);
              setVisitorsRecent([]);
            }
            visitorsTodaySnap = 0;
            visitorsActiveSnap = 0;
            visitorsRecentSnap = [];
            return;
          }
          const now = Date.now();
          const cached = c.visitors;
          if (cached && now - cached.at < 30_000) {
            if (!cancelled) {
              setVisitorsTodayCount(cached.todayCount);
              setVisitorsActiveNow(cached.activeNow);
              setVisitorsRecent(cached.recent);
            }
            visitorsTodaySnap = cached.todayCount;
            visitorsActiveSnap = cached.activeNow;
            visitorsRecentSnap = cached.recent;
            return;
          }

          const orFilter = `status.eq.checked_in,and(check_in.gte."${tStart}",check_in.lte."${tEnd}")`;
          const merged = await supabase
            .from("visitor_logs")
            .select("id, visitor_name, check_in, project_name, status")
            .eq("company_id", companyId)
            .or(orFilter)
            .order("check_in", { ascending: false })
            .limit(72);

          if (merged.error) {
            const [todayRes, activeRes, recentRes] = await Promise.all([
              supabase
                .from("visitor_logs")
                .select("id", { count: "exact", head: true })
                .eq("company_id", companyId)
                .gte("check_in", tStart)
                .lte("check_in", tEnd),
              supabase
                .from("visitor_logs")
                .select("id", { count: "exact", head: true })
                .eq("company_id", companyId)
                .eq("status", "checked_in"),
              supabase
                .from("visitor_logs")
                .select("id, visitor_name, check_in, project_name, status")
                .eq("company_id", companyId)
                .order("check_in", { ascending: false })
                .limit(5),
            ]);
            if (todayRes.error) throw todayRes.error;
            if (activeRes.error) throw activeRes.error;
            if (recentRes.error) throw recentRes.error;
            const tC = todayRes.count ?? 0;
            const aC = activeRes.count ?? 0;
            const rec = (recentRes.data ?? []) as VisitorWidgetRow[];
            visitorsTodaySnap = tC;
            visitorsActiveSnap = aC;
            visitorsRecentSnap = rec;
            c.visitors = { at: Date.now(), todayCount: tC, activeNow: aC, recent: rec };
            if (!cancelled) {
              setVisitorsTodayCount(tC);
              setVisitorsActiveNow(aC);
              setVisitorsRecent(rec);
            }
            return;
          }

          const vrows = (merged.data ?? []) as VisitorWidgetRow[];
          const todayCount = vrows.filter((r) => r.check_in >= tStart && r.check_in <= tEnd).length;
          const activeNow = vrows.filter((r) => r.status === "checked_in").length;
          const recent = vrows.slice(0, 5);
          visitorsTodaySnap = todayCount;
          visitorsActiveSnap = activeNow;
          visitorsRecentSnap = recent;
          c.visitors = { at: Date.now(), todayCount, activeNow, recent };
          if (!cancelled) {
            setVisitorsTodayCount(todayCount);
            setVisitorsActiveNow(activeNow);
            setVisitorsRecent(recent);
          }
        } catch (e) {
          pushErr(e, L("dashboard_widget_visitors"));
        } finally {
          if (!cancelled) setVisitorsLoading(false);
        }
      };

      const fetchHazards = async () => {
        try {
          const now = Date.now();
          const hzCached = c.hazards;
          if (hzCached && now - hzCached.at < 120_000) {
            if (!cancelled) {
              setHazardRows(hzCached.hazardRows);
              setCorrectivePendingCount(hzCached.correctivePendingCount);
            }
            hazardRowsSnap = hzCached.hazardRows;
            correctiveSnap = hzCached.correctivePendingCount;
            return;
          }

          let hazardRowsNext: Hazard[] = [];
          if (canAccessHazards && (canManageEmployees || canManageComplianceAlerts)) {
            const { data, error } = await supabase
              .from("hazards")
              .select("id, company_id, title, status")
              .eq("company_id", companyId)
              .in("status", ["open", "in_progress"])
              .limit(50);
            if (error) throw error;
            hazardRowsNext = (data ?? []) as Hazard[];
            if (!cancelled) setHazardRows(hazardRowsNext);
          } else if (!cancelled) {
            setHazardRows([]);
          }
          let corrective = 0;
          if (
            canViewSecurityDashboard &&
            canAccessCorrective &&
            (canManageEmployees || canManageComplianceAlerts)
          ) {
            const { count, error: cErr } = await supabase
              .from("corrective_actions")
              .select("id", { count: "exact", head: true })
              .eq("company_id", companyId)
              .in("status", ["open", "in_progress"]);
            if (cErr) throw cErr;
            corrective = count ?? 0;
            if (!cancelled) setCorrectivePendingCount(corrective);
          } else if (!cancelled) {
            setCorrectivePendingCount(0);
          }
          hazardRowsSnap = hazardRowsNext;
          correctiveSnap = corrective;
          c.hazards = {
            at: Date.now(),
            hazardRows: hazardRowsNext,
            correctivePendingCount: corrective,
          };
        } catch (e) {
          pushErr(e, L("dashboard_widget_hazards"));
        } finally {
          if (!cancelled) setHazardsLoading(false);
        }
      };

      await Promise.all([
        scheduleDelayed(400, loadSchedule),
        scheduleDelayed(500, auditPipeline),
        scheduleDelayed(600, loadDailyBundle),
        scheduleDelayed(800, fetchVisitors),
        scheduleDelayed(1000, fetchHazards),
      ]);

      if (cancelled) return;

      const dashSnap: CentralDashboardCacheSnap = {
        companyId,
        audit: c.audit,
        visitors: c.visitors,
        hazards: c.hazards,
        empCount: c.empCount,
      };

      centralDashboardWarmStore.set(warmKey, {
        savedAt: Date.now(),
        refreshTk: dashboardRefreshTk,
        todayIso,
        resolvedConfig: resolvedCfg,
        myTimeRows: t1.myTimeRows,
        teamTimeRows: t1.teamTimeRows,
        teamClockLabelsByUserId: t1.teamLabels,
        scheduleToday: scheduleMine,
        dailyReportsToday: dailyFiltered,
        myTasksToday: myTasksSnapshot,
        empActiveCount: empSnap,
        activityRows: activityRowsSnap,
        auditProfileByUserId: auditProfilesSnap,
        hazardRows: hazardRowsSnap,
        correctivePendingCount: correctiveSnap,
        visitorsTodayCount: visitorsTodaySnap,
        visitorsActiveNow: visitorsActiveSnap,
        visitorsRecent: visitorsRecentSnap,
        dashboardCache: dashSnap,
      });
      hasLoadedRef.current = true;
    };

    void run();
    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
    };
  }, [
    companyId,
    currentUserId,
    todayIso,
    tStart,
    tEnd,
    canViewTeamClock,
    canManageEmployees,
    canViewEmployees,
    canViewAuditLog,
    canAccessVisitors,
    canAccessHazards,
    canAccessCorrective,
    canViewSecurityDashboard,
    canManageComplianceAlerts,
    loadDashboardConfig,
    dashboardRefreshTk,
  ]);

  useDismissOnEscape(customizeOpen, () => setCustomizeOpen(false));

  /** Enabled widgets in saved order only — do not append “missing” ids or turning everything off cannot persist. */
  const orderedVisibleWidgets = useMemo(() => {
    const allowed = new Set(DEFAULT_DASHBOARD_WIDGET_ORDER.filter((id) => canShowWidget(id)));
    return resolvedConfig.orderedWidgets.filter((id) => allowed.has(id));
  }, [resolvedConfig.orderedWidgets, canShowWidget]);

  const moveWidget = useCallback(
    async (id: DashboardWidgetId, dir: -1 | 1) => {
      const order = orderedVisibleWidgets.filter((w) => canShowWidget(w));
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      const nextOrder = [...order];
      [nextOrder[i], nextOrder[j]] = [nextOrder[j], nextOrder[i]];
      const full = DEFAULT_DASHBOARD_WIDGET_ORDER.filter(
        (w) => canShowWidget(w) && !nextOrder.includes(w as DashboardWidgetId)
      );
      const merged = [...nextOrder, ...full];
      const next = { ...resolvedConfig, orderedWidgets: merged };
      setResolvedConfig(next);
      const ok = await persistConfig(next);
      if (!ok) void loadDashboardConfig();
    },
    [orderedVisibleWidgets, canShowWidget, resolvedConfig, persistConfig, loadDashboardConfig]
  );

  const toggleWidgetInDraft = (id: DashboardWidgetId) => {
    const has = draftConfig.orderedWidgets.includes(id);
    let order = [...draftConfig.orderedWidgets];
    if (has) {
      order = order.filter((w) => w !== id);
    } else order.push(id);
    setDraftConfig({ ...draftConfig, orderedWidgets: order });
  };

  const saveCustomize = async () => {
    const allowed = new Set(DEFAULT_DASHBOARD_WIDGET_ORDER.filter((id) => canShowWidget(id)));
    const filtered = draftConfig.orderedWidgets.filter((id) => allowed.has(id));
    const next = { ...draftConfig, orderedWidgets: filtered };
    const ok = await persistConfig(next);
    if (ok) setCustomizeOpen(false);
  };

  const renderQuickButtons = (quickKeys: QuickAccessKey[]) => (
    <div className="flex flex-wrap gap-2">
      {quickKeys.map((k) => {
        if (k === "hazard" && canManageHazards) {
          return (
            <button
              key={k}
              type="button"
              onClick={onQuickNewHazard}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 text-sm font-semibold"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {L("new_hazard") || L("dashboard_new_hazard")}
            </button>
          );
        }
        if (k === "corrective" && canManageCorrectiveActions) {
          return (
            <button
              key={k}
              type="button"
              onClick={onQuickNewAction}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 text-sm font-semibold"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_new_action")}
            </button>
          );
        }
        if (
          k === "visitor" &&
          (canManageProjectVisitors || (currentUserRole === "worker" && visitorCheckInUrl))
        ) {
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                if (canManageProjectVisitors) onQuickVisitorQr();
                else if (visitorCheckInUrl) window.open(visitorCheckInUrl, "_blank", "noopener,noreferrer");
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <QrCode className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_register_visitor")}
            </button>
          );
        }
        if (k === "audit" && canViewAuditLog) {
          return (
            <button
              key={k}
              type="button"
              onClick={onOpenAuditInCentral}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <FileSearch className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_view_audit")}
            </button>
          );
        }
        if (k === "employee" && onQuickNewEmployee && canManageEmployees) {
          return (
            <button
              key={k}
              type="button"
              onClick={onQuickNewEmployee}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <UserCheck className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_quick_employee")}
            </button>
          );
        }
        if (k === "rfi" && onQuickNewRfi && canManageProjectRFI) {
          return (
            <button
              key={k}
              type="button"
              onClick={onQuickNewRfi}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Layers className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_quick_rfi")}
            </button>
          );
        }
        if (
          k === "subcontractor" &&
          canAccessSubcontractors &&
          (onQuickNewSubcontractor || onOpenSubcontractorsInOperations)
        ) {
          return (
            <button
              key={k}
              type="button"
              onClick={onQuickNewSubcontractor ?? onOpenSubcontractorsInOperations}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_quick_subcontractor")}
            </button>
          );
        }
        return null;
      })}
    </div>
  );

  const widgetChrome = (id: DashboardWidgetId, children: React.ReactNode) => (
    <div className="relative min-w-0 max-w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {canManageEmployees ? (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            type="button"
            disabled={orderedVisibleWidgets.indexOf(id) <= 0}
            onClick={() => void moveWidget(id, -1)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
            aria-label={L("dashboard_move_up")}
          >
            <ChevronUp className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={orderedVisibleWidgets.indexOf(id) >= orderedVisibleWidgets.length - 1}
            onClick={() => void moveWidget(id, 1)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
            aria-label={L("dashboard_move_down")}
          >
            <ChevronDown className="h-5 w-5" aria-hidden />
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );

  const fmtTime = (iso: string) => formatTime(iso, dateLoc, timeZone);

  const renderWidget = (id: DashboardWidgetId) => {
    const title = L(WIDGET_LABEL_KEYS[id]) || L(`dashboard_widget_${id}`) || id;
    const widgetSkeleton = (lines = 4) =>
      widgetChrome(
        id,
        <>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14">{title}</h3>
          <WidgetSkeleton lines={lines} />
        </>
      );

    switch (id) {
      case "team_timeclock":
        if (!primaryReady) return widgetSkeleton();
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" aria-hidden />
              {title}
            </h3>
            <ul className="text-sm space-y-2 text-gray-800 dark:text-gray-200 max-h-48 min-h-0 overflow-y-auto overscroll-contain">
              {teamTimeRows.length === 0 ? (
                <li className="text-gray-500">{L("dashboard_trend_neutral")}</li>
              ) : (
                teamTimeRows.slice(0, 12).map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-1">
                    <span className="min-w-0 truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                      {teamClockLabelsByUserId[r.user_id] ??
                        teamClockLabelsByUserId[r.user_id.toLowerCase()] ??
                        `${r.user_id.slice(0, 8)}…`}
                    </span>
                    <span>
                      {fmtTime(r.clock_in_at)}
                      {r.clock_out_at ? ` – ${fmtTime(r.clock_out_at)}` : ` · ${L("dashboard_active_now")}`}
                    </span>
                  </li>
                ))
              )}
            </ul>
            {canManageEmployees && registerManualClockIn && manualClockEmployeeOptions.length > 0 ? (
              <button
                type="button"
                onClick={() => openManualClockModal()}
                className="mt-3 w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/30 px-3 py-2 text-sm font-semibold text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-950/50"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                {L("clock_manual_entry")}
              </button>
            ) : null}
            {manualClockOpen && canManageEmployees && registerManualClockIn ? (
              <>
                <div
                  className="fixed inset-0 z-[70] bg-black/50"
                  aria-hidden
                  onClick={() => !manualClockSaving && setManualClockOpen(false)}
                />
                <div className="fixed z-[71] inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-xl space-y-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:inset-x-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl md:max-w-lg lg:max-w-xl">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">{L("clock_manual_entry")}</h4>
                    <button
                      type="button"
                      disabled={manualClockSaving}
                      onClick={() => setManualClockOpen(false)}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                      aria-label={L("cancel")}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300">
                    {L("personnel") || "Employee"}
                    <select
                      value={manualTargetUserId}
                      onChange={(e) => setManualTargetUserId(e.target.value)}
                      className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    >
                      {manualClockEmployeeOptions.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-gray-700 dark:text-gray-300">
                    {L("project") || "Project"}
                    <select
                      value={manualProjectId}
                      onChange={(e) => setManualProjectId(e.target.value)}
                      className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    >
                      <option value="">{L("schedule_no_project") || "—"}</option>
                      {manualClockProjectOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-gray-700 dark:text-gray-300">
                    {L("date") || "Date"}
                    <input
                      type="date"
                      value={manualDateYmd}
                      onChange={(e) => setManualDateYmd(e.target.value)}
                      className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm text-gray-700 dark:text-gray-300">
                    {L("clockInEntry") || "Time in"}
                    <input
                      type="time"
                      value={manualTimeHm}
                      onChange={(e) => setManualTimeHm(e.target.value)}
                      className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm text-gray-700 dark:text-gray-300">
                    {L("notes") || "Notes"}
                    <textarea
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      rows={2}
                      className="mt-1 w-full max-w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={manualClockSaving || !manualTargetUserId}
                    onClick={() => void submitManualClock()}
                    className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {manualClockSaving ? "…" : L("clock_manual_in")}
                  </button>
                </div>
              </>
            ) : null}
          </>
        );
      case "team_map":
        if (!primaryReady) return widgetSkeleton();
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-violet-500" aria-hidden />
              {title}
            </h3>
            <TeamGpsMapWidget
              companyId={companyId}
              timeZone={timeZone}
              language={language}
              countryCode={countryCode}
              projectNameById={projectNameById}
              labels={labels}
            />
          </>
        );
      case "my_timeclock":
        if (!primaryReady) return widgetSkeleton();
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-500" aria-hidden />
              {title}
            </h3>
            {myShiftCentralCard && onOpenMyShiftView ? (
              <div className="space-y-3">
                {!myShiftCentralCard.hasShiftToday ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300">{L("noShiftToday")}</p>
                ) : (
                  <>
                    {myShiftCentralCard.projectName && (
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {myShiftCentralCard.projectName}
                      </p>
                    )}
                    {myShiftCentralCard.shiftTimeLabel && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        {myShiftCentralCard.shiftTimeLabel}
                      </p>
                    )}
                    {myShiftCentralCard.workedSummary && (
                      <p className="text-sm text-gray-700 dark:text-gray-200">
                        {L("timeWorked")}:{" "}
                        <span className="font-semibold tabular-nums">{myShiftCentralCard.workedSummary}</span>
                      </p>
                    )}
                    {myShiftCentralCard.clockedInNotOut && (
                      <p className="text-sm text-amber-700 dark:text-amber-300">{L("dashboard_active_now")}</p>
                    )}
                    <button
                      type="button"
                      onClick={onOpenMyShiftView}
                      className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
                    >
                      {L("viewMyShift")}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <ul className="text-sm space-y-2">
                {myTimeRows.length === 0 ? (
                  <li className="text-gray-500">{L("dashboard_trend_neutral")}</li>
                ) : (
                  myTimeRows.map((r) => (
                    <li key={r.id}>
                      {fmtTime(r.clock_in_at)}
                      {r.clock_out_at ? ` – ${fmtTime(r.clock_out_at)}` : ` · ${L("dashboard_active_now")}`}
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        );
      case "activity":
        if (activityLoading) return widgetSkeleton();
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-violet-500" aria-hidden />
              {title}
            </h3>
            <ul className="text-sm space-y-2 max-h-56 min-h-0 overflow-y-auto overscroll-contain">
              {activityRows.length === 0 ? (
                <li className="text-gray-600 dark:text-gray-400">
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {L("dashboard_activity_empty_business") || L("dashboard_trend_neutral")}
                  </p>
                  {(L("dashboard_activity_empty_business_hint") || "").trim() ? (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {L("dashboard_activity_empty_business_hint")}
                    </p>
                  ) : null}
                </li>
              ) : (
                activityRows.map((row) => (
                  <li key={row.id} className="text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 pb-2 min-w-0">
                    <span className="text-xs text-gray-500">{formatRelative(row.created_at, dateLoc)}</span>
                    <p className="mt-0.5 break-words">
                      {formatActivityLine(
                        row,
                        labels,
                        projectNameById,
                        auditActorLabel(row, auditProfileByUserId, labels)
                      )}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </>
        );
      case "compliance_alerts":
        if (!primaryReady) return widgetSkeleton(2);
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" aria-hidden />
              {title}
            </h3>
            {complianceWatchdogCount > 0 && onOpenComplianceInCentral ? (
              <button
                type="button"
                onClick={onOpenComplianceInCentral}
                className="min-h-[44px] w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-100"
              >
                {L("complianceWatchdog")} ({complianceWatchdogCount})
              </button>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300">{L("dashboard_all_clear")}</p>
            )}
          </>
        );
      case "hazards":
        if (hazardsLoading) return widgetSkeleton();
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />
              {title}
            </h3>
            <ul className="text-sm space-y-2 max-h-56 overflow-y-auto">
              {hazardRows.length === 0 ? (
                <li className="text-gray-500">{L("dashboard_all_clear")}</li>
              ) : (
                hazardRows.map((h) => (
                  <li key={h.id} className="text-gray-800 dark:text-gray-200">
                    · {h.title || h.id}
                  </li>
                ))
              )}
            </ul>
          </>
        );
      case "security_summary":
        if (hazardsLoading) return widgetSkeleton(2);
        return widgetChrome(
          id,
          <>
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 pe-14 flex items-center gap-2 sm:text-sm sm:mb-3">
              <Shield className="h-3.5 w-3.5 text-orange-500 sm:h-4 sm:w-4" aria-hidden />
              {title}
            </h3>
            <ul className="text-xs space-y-1.5 text-gray-800 dark:text-gray-200 sm:text-sm sm:space-y-2">
              <li className="flex justify-between gap-2">
                <span className="min-w-0 truncate pr-1">{L("dashboard_security_open_hazards") || L("hazards_title")}</span>
                <span className="font-semibold tabular-nums shrink-0">{hazardRows.length}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="min-w-0 truncate pr-1">{L("dashboard_security_pending_actions") || L("security_corrective")}</span>
                <span className="font-semibold tabular-nums shrink-0">{correctivePendingCount}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="min-w-0 truncate pr-1">{L("dashboard_security_expired_certs") || L("complianceWatchdog")}</span>
                <span className="font-semibold tabular-nums shrink-0">{complianceExpiredCertCount}</span>
              </li>
            </ul>
            {onOpenOperationsSecurity ? (
              <button
                type="button"
                onClick={() => onOpenOperationsSecurity()}
                className="mt-2 min-h-[44px] w-full rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 py-2 sm:mt-3 sm:text-sm"
              >
                {L("dashboard_security_open_operations") || L("nav_operations") || "Operations"}
              </button>
            ) : null}
          </>
        );
      case "visitors":
        if (visitorsLoading) return widgetSkeleton();
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-cyan-500" aria-hidden />
              {title}
            </h3>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{L("visitor_active_now")}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{visitorsActiveNow}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {L("dashboard_visitors_today")}: {visitorsTodayCount}
            </p>
            <ul className="mt-3 text-sm space-y-2 max-h-36 overflow-y-auto">
              {visitorsRecent.length === 0 ? (
                <li className="text-gray-500 dark:text-gray-400">{L("dashboard_trend_neutral")}</li>
              ) : (
                visitorsRecent.map((v) => (
                  <li key={v.id} className="text-gray-800 dark:text-gray-200 leading-snug">
                    <span className="font-medium">{v.visitor_name}</span>
                    {v.project_name ? <span className="text-gray-500 dark:text-gray-400"> · {v.project_name}</span> : null}
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(v.check_in, dateLoc, timeZone)}
                    </span>
                  </li>
                ))
              )}
            </ul>
            <button
              type="button"
              onClick={() => (onNavigateToOperationsVisitors ? onNavigateToOperationsVisitors() : onNavigateAppSection("visitors"))}
              className="mt-3 min-h-[44px] w-full rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 py-2"
            >
              {L("viewAll") ?? L("dashboard_register_visitor")}
            </button>
          </>
        );
      case "my_tasks":
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-indigo-500" aria-hidden />
              {title}
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              {scheduleLoading ? (
                <span
                  className="inline-block h-4 w-48 max-w-full rounded bg-gray-200 dark:bg-gray-600 animate-pulse"
                  aria-hidden
                />
              ) : scheduleToday.length > 0 ? (
                `${scheduleToday.length} ${L("schedule_pick_employees") ?? ""}`
              ) : (
                L("dashboard_trend_neutral")
              )}
            </p>
            {dailyLoading ? (
              <WidgetSkeleton lines={3} />
            ) : (
              <ul className="text-sm space-y-2 max-h-40 overflow-y-auto">
                {myTasksToday.length === 0 ? (
                  <li className="text-gray-500">{L("dashboard_trend_neutral")}</li>
                ) : (
                  myTasksToday.map((task, i) => (
                    <li key={i} className={task.completed ? "line-through opacity-60" : ""}>
                      · {task.description || L("common_dash")}
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        );
      case "daily_report":
        if (!primaryReady || dailyLoading) return widgetSkeleton();
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-sky-500" aria-hidden />
              {title}
            </h3>
            <ul className="text-sm space-y-2 max-h-48 overflow-y-auto">
              {dailyReportsToday.length === 0 ? (
                <li className="text-gray-500">{L("dashboard_trend_neutral")}</li>
              ) : (
                dailyReportsToday.map((r) => (
                  <li key={String(r.id)} className="text-gray-800 dark:text-gray-200">
                    · {projectNameById[String(r.project_id)] ?? String(r.project_id)}
                    {r.status ? ` · ${String(r.status)}` : ""}
                  </li>
                ))
              )}
            </ul>
          </>
        );
      case "forms_pending":
        if (!canViewForms) return null;
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-500" aria-hidden />
              {title}
            </h3>
            {formsPendingTodayPreview.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{L("dashboard_trend_neutral")}</p>
            ) : (
              <ul className="text-sm space-y-2 max-h-48 overflow-y-auto mb-3">
                {formsPendingTodayPreview.map((row) => (
                  <li key={row.id} className="text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="font-medium block break-words">{row.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">{row.contextLine}</span>
                    <span className="text-xs text-amber-700 dark:text-amber-300">{row.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => onNavigateToForms?.()}
                className="min-h-[44px] flex-1 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 py-2"
              >
                {L("viewAll") || L("forms")}
              </button>
              <button
                type="button"
                onClick={() => onNavigateToFormsNew?.()}
                className="min-h-[44px] flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2"
              >
                {L("newForm") || "New form"}
              </button>
            </div>
          </>
        );
      case "critical_inventory":
        if (!primaryReady) return widgetSkeleton(2);
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-500" aria-hidden />
              {title}
            </h3>
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{criticalInventoryCount}</p>
            <button
              type="button"
              onClick={() => onNavigateAppSection("warehouse")}
              className="mt-2 min-h-[44px] text-sm font-medium text-amber-600 dark:text-amber-400"
            >
              {L("warehouse") || L("viewAll") || "Logistics"}
            </button>
          </>
        );
      case "quick_access":
        if (!primaryReady) return widgetSkeleton(2);
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14">{title}</h3>
            {renderQuickButtons(resolvedConfig.quickAccess)}
          </>
        );
      case "labor_costing":
        if (!laborCostingEnabled || !canViewLaborCosting) return null;
        return widgetChrome(
          id,
          <LaborCostingDashboardWidget
            companyId={companyId}
            companyNameForFiles={companyName ?? ""}
            labels={labels}
            timeZone={timeZone}
            dateLocaleBcp47={dateLoc}
            currency={laborCostingCurrency}
            rateByUserId={laborCostingRateByUserId}
            employeeLabelsByUserId={laborCostingEmployeeLabels}
            projectNameById={projectNameById}
            dashboardRefreshTk={dashboardRefreshTk}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <section className="mb-4 w-full min-w-0 max-w-full space-y-2 overflow-x-hidden">
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="min-w-0 text-lg font-medium text-gray-900 dark:text-white break-words">
            {getGreeting()} — {formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}
          </p>
          {canManageEmployees ? (
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="inline-flex w-full min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 sm:w-auto"
            >
              <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_customize_open")}
            </button>
          ) : null}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 break-words">
          {(labels.dashboard_all_clear_named ?? "").replace("{company}", companyName ?? L("dashboard_company"))}
        </p>
      </section>

      {loadErrors.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 text-sm text-amber-950 dark:text-amber-100 mb-4 space-y-3"
        >
          <p className="font-semibold">{L("network_error") || L("dashboard_error_load_title")}</p>
          <ul className="list-disc pl-5 font-mono text-xs break-all">
            {loadErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setLoadErrors([]);
              setDashboardRefreshTk((n) => n + 1);
            }}
            className="min-h-[44px] rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-500"
          >
            {L("retry_button") || L("dashboard_error_retry") || "Retry"}
          </button>
        </div>
      ) : null}

      {currentUserRole === "admin" ? (
        <GettingStartedWidget
          companyId={companyId}
          labels={labels}
          onNavigateAppSection={onNavigateAppSection}
          refreshToken={gettingStartedRefreshTk}
        />
      ) : null}

      {showZone1 ? (
        <>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{L("dashboard_management_section")}</h2>
          <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 md:gap-6 items-stretch">
            {(
              (canViewEmployees || canManageEmployees
                ? [
                    {
                      key: "mgmt-emp",
                      node: (
                        <UnifiedDashCard
                          icon={<Users className="h-5 w-5 text-white" />}
                          iconWrapClassName="bg-blue-500"
                          label={L("personnel") ?? L("employees_title")}
                          value={
                            empCountLoading ? (
                              <span
                                className="inline-block h-8 w-16 max-w-[40%] rounded-md bg-gray-200 dark:bg-gray-600 animate-pulse"
                                aria-busy="true"
                                aria-label={L("loading") || "…"}
                              />
                            ) : (
                              (empActiveCount ?? "—")
                            )
                          }
                          subContent={
                            !empCountLoading && empActiveCount === 0 ? (
                              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                {L("dashboard_trend_neutral")}
                              </span>
                            ) : undefined
                          }
                          onClick={() => onNavigateAppSection("employees")}
                          disabled={!canAccessEmployees}
                        />
                      ),
                    },
                  ]
                : []
              )
                .concat(
                  canViewRoles || canManageRoles
                    ? [
                        {
                          key: "mgmt-roles",
                          node: (
                            <UnifiedDashCard
                              icon={<KeyRound className="h-5 w-5 text-white" />}
                              iconWrapClassName="bg-violet-500"
                              label={L("roles") ?? L("permManageRoles")}
                              value={customRolesCount}
                              onClick={() => onOpenRolesInCentral()}
                              disabled={!(canViewRoles || canManageRoles)}
                            />
                          ),
                        },
                      ]
                    : []
                )
                .concat(
                  canViewProjectsManagement
                    ? [
                        {
                          key: "mgmt-proj",
                          node: (
                            <UnifiedDashCard
                              icon={<Briefcase className="h-5 w-5 text-white" />}
                              iconWrapClassName="bg-amber-500"
                              label={L("projects")}
                              value={activeProjectsCount}
                              subContent={
                                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                  {activeProjectsCount === 0
                                    ? L("empty_state_projects") || L("activeProjects")
                                    : L("activeProjects")}
                                </span>
                              }
                              onClick={() => {
                                onProjectsManagementCardClick?.();
                              }}
                            />
                          ),
                        },
                      ]
                    : []
                )
                .concat(
                  canViewForms
                    ? [
                        {
                          key: "mgmt-forms",
                          node: (
                            <UnifiedDashCard
                              icon={<ClipboardList className="h-5 w-5 text-white" />}
                              iconWrapClassName="bg-blue-500"
                              label={L("forms_card_title") || L("forms")}
                              value={formsActiveCount}
                              subContent={
                                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                  {L("forms_card_subtitle") || "formularios activos"}
                                </span>
                              }
                              onClick={() => onNavigateToForms?.()}
                            />
                          ),
                        },
                      ]
                    : []
                )
                .map((item) => (
                  <div key={item.key} className="flex h-full min-h-0 min-w-0">
                    {item.node}
                  </div>
                ))
            )}
          </div>
        </>
      ) : null}

      {canViewDashboardWidgets ? (
        <>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{L("dashboard_operations_panel")}</h2>
      <div className="grid grid-cols-1 gap-3 min-w-0 md:grid-cols-2 md:gap-6 md:grid-flow-dense">
        {(() => {
          const opsIds = orderedVisibleWidgets.filter(canShowWidget);
          return opsIds.map((id, index) => (
            <div key={id} className={`min-w-0 ${mdColSpanForOperationsWidget(opsIds, index)}`}>
              {renderWidget(id)}
            </div>
          ));
        })()}
      </div>
        </>
      ) : null}

      {customizeOpen ? (
        <>
          <div className="fixed inset-0 z-[70] min-h-[100dvh] bg-black/50" aria-hidden onClick={() => setCustomizeOpen(false)} />
          <div className="fixed z-[71] inset-x-0 bottom-0 max-h-[min(88vh,96dvh)] w-full max-w-none overflow-y-auto rounded-t-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl flex flex-col sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl md:max-w-xl lg:max-w-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700 md:px-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <GripVertical className="h-4 w-4" aria-hidden />
                {L("dashboard_customize_title")}
              </h3>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500"
                onClick={() => setCustomizeOpen(false)}
                aria-label={L("common_close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-gray-500">{L("dashboard_customize_hint")}</p>
              <ul className="space-y-2">
                {DEFAULT_DASHBOARD_WIDGET_ORDER.filter(canShowWidget).map((id) => (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-200">{L(WIDGET_LABEL_KEYS[id])}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draftConfig.orderedWidgets.includes(id)}
                      onClick={() => toggleWidgetInDraft(id)}
                      className={`min-h-[44px] min-w-[52px] rounded-full border-2 px-2 text-xs font-semibold ${
                        draftConfig.orderedWidgets.includes(id)
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                          : "border-gray-300 dark:border-gray-600 text-gray-500"
                      }`}
                    >
                      {draftConfig.orderedWidgets.includes(id) ? L("common_on") : L("common_off")}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 pt-2">{L("dashboard_widget_quickaccess")}</p>
              <ul className="space-y-2">
                {QUICK_ACCESS_KEYS.map((k) => {
                  const labelKey =
                    k === "hazard"
                      ? "new_hazard"
                      : k === "corrective"
                        ? "dashboard_new_action"
                        : k === "visitor"
                          ? "dashboard_register_visitor"
                          : k === "audit"
                            ? "dashboard_view_audit"
                            : k === "employee"
                              ? "dashboard_quick_employee"
                              : k === "rfi"
                                ? "dashboard_quick_rfi"
                                : "dashboard_quick_subcontractor";
                  const quickLbl =
                    k === "hazard"
                      ? L("new_hazard") || L("dashboard_new_hazard")
                      : L(labelKey);
                  return (
                    <li
                      key={k}
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                    >
                      <span className="text-sm text-gray-800 dark:text-gray-200">{quickLbl}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draftConfig.quickAccess.includes(k)}
                        onClick={() => {
                          const has = draftConfig.quickAccess.includes(k);
                          let qa = [...draftConfig.quickAccess];
                          if (has) {
                            qa = qa.filter((x) => x !== k);
                          } else qa.push(k);
                          setDraftConfig({ ...draftConfig, quickAccess: qa });
                        }}
                        className={`min-h-[44px] min-w-[52px] rounded-full border-2 px-2 text-xs font-semibold ${
                          draftConfig.quickAccess.includes(k)
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                            : "border-gray-300 dark:border-gray-600 text-gray-500"
                        }`}
                      >
                        {draftConfig.quickAccess.includes(k) ? L("common_on") : L("common_off")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="sticky bottom-0 flex flex-col gap-2 border-t border-gray-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:flex-wrap sm:justify-end md:px-6">
              <button
                type="button"
                onClick={() => setCustomizeOpen(false)}
                className="min-h-[44px] w-full px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold sm:w-auto"
              >
                {L("dashboard_customize_cancel")}
              </button>
              <button
                type="button"
                disabled={savingConfig}
                onClick={() => void saveCustomize()}
                className="min-h-[44px] w-full px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-60 sm:w-auto"
              >
                {L("dashboard_customize_save")}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
