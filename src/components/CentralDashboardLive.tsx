"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  AlertTriangle,
  ClipboardCheck,
  Shield,
  CheckCircle2,
  Clock,
  CreditCard,
  Layers,
  StickyNote,
  MapPin,
  Plus,
  QrCode,
  FileSearch,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Minus,
  Briefcase,
  KeyRound,
  ShieldAlert,
  GripVertical,
  X,
  Settings2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSubscription } from "@/lib/useSubscription";
import type { AuditLogEntry } from "@/lib/useAuditLog";
import type { Hazard, HazardSeverity, HazardStatus } from "@/types/hazard";
import type { CorrectiveAction, ActionStatus } from "@/types/correctiveAction";
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

type ActivityFilter = "all" | "safety" | "operations" | "hr";

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

function hoursAgoIso(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function relativeTime(iso: string, locale: string, labels: Record<string, string>): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return labels.dashboard_rel_now ?? "";
  const min = Math.floor(sec / 60);
  if (min < 60) return (labels.dashboard_rel_minutes ?? "").replace("{n}", String(min));
  const h = Math.floor(min / 60);
  if (h < 24) return (labels.dashboard_rel_hours ?? "").replace("{n}", String(h));
  const d = Math.floor(h / 24);
  return (labels.dashboard_rel_days ?? "").replace("{n}", String(d));
}

function activityBucket(action: string, entityType: string): ActivityFilter | "other" {
  const a = action.toLowerCase();
  const e = entityType.toLowerCase();
  if (
    a.includes("hazard") ||
    a.includes("pin") ||
    a.includes("blueprint") ||
    a.includes("annotation") ||
    e === "hazard" ||
    e === "corrective_action" ||
    e === "blueprint"
  )
    return "safety";
  if (
    a.includes("photo") ||
    a.includes("project") ||
    a.includes("request") ||
    e === "photo" ||
    e === "project"
  )
    return "operations";
  if (a.includes("employee") || e === "employee") return "hr";
  return "other";
}

function formatActivityLine(
  row: AuditLogEntry,
  labels: Record<string, string>,
  projectNames: Record<string, string>,
  resolveWho: (userId: string, storedName?: string | null) => string
): string {
  const who = resolveWho(row.user_id, row.user_name ?? null);
  const ent = row.entity_name ?? "";
  const nv = row.new_value as Record<string, unknown> | undefined;
  const pid = typeof nv?.project_id === "string" ? nv.project_id : null;
  const pfx = pid && projectNames[pid] ? ` · ${projectNames[pid]}` : "";
  const dash = labels.common_dash ?? "—";
  const fill = (s: string) => s.replace(/\{who\}/g, who).replace(/\{name\}/g, ent || dash);
  const generic = (labels.dashboard_audit_generic ?? "").replace(/\{who\}/g, who).replace(/\{action\}/g, row.action);
  const m: Record<string, string> = {
    hazard_created: fill(labels.dashboard_audit_hazard_created ?? "") + pfx,
    hazard_status_changed: fill(labels.dashboard_audit_hazard_status ?? ""),
    pin_added: fill(labels.dashboard_audit_pin ?? ""),
    blueprint_uploaded: fill(labels.dashboard_audit_blueprint ?? ""),
    blueprint_new_version: fill(labels.dashboard_audit_blueprint_ver ?? ""),
    annotation_added: fill(labels.dashboard_audit_note ?? ""),
    photo_uploaded: fill(labels.dashboard_audit_photo ?? ""),
    employee_created: fill(labels.dashboard_audit_employee ?? ""),
    action_created: fill(labels.dashboard_audit_action ?? ""),
  };
  if (m[row.action]) return m[row.action];
  return ent ? `${generic} · ${ent}${pfx}` : `${generic}${pfx}`;
}

function severityTone(sev: HazardSeverity): string {
  if (sev === "critical") return "text-red-600 dark:text-red-400";
  if (sev === "high") return "text-orange-600 dark:text-orange-400";
  if (sev === "medium") return "text-amber-600 dark:text-amber-400";
  return "text-gray-600 dark:text-gray-400";
}

function BarStack({
  segments,
  height = 8,
}: {
  segments: { pct: number; className: string; key: string }[];
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + x.pct, 0) || 1;
  return (
    <div
      className="flex w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
      style={{ height }}
      role="img"
    >
      {segments.map((s) =>
        s.pct > 0 ? (
          <div key={s.key} className={s.className} style={{ width: `${(s.pct / total) * 100}%` }} />
        ) : null
      )}
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
      className="w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-left shadow-sm hover:border-amber-400/60 dark:hover:border-amber-500/50 transition-colors disabled:opacity-60 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      <div className="flex items-start gap-3 w-full">
        <div className={`shrink-0 p-2 rounded-lg ${iconWrapClassName}`}>{icon}</div>
        <div className="flex-1 min-w-0">
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
  timeclock: "dashboard_widget_timeclock",
  activity: "dashboard_widget_activity",
  alerts: "dashboard_widget_alerts",
  hazards: "dashboard_widget_hazards",
  actions: "dashboard_widget_actions",
  visitors: "dashboard_widget_visitors",
  blueprints: "dashboard_widget_blueprints",
  subscription: "dashboard_widget_subscription",
  quickaccess: "dashboard_widget_quickaccess",
};

export interface CentralDashboardLiveProps {
  labels: Record<string, string>;
  companyId: string | null;
  companyName?: string | null;
  language: string;
  activeProjectsCount: number;
  projectNameById: Record<string, string>;
  currentUserRole: UserRole;
  canManageRoles: boolean;
  canAccessVisitors: boolean;
  canAccessHazards: boolean;
  canAccessCorrective: boolean;
  onNavigateAppSection: (section: MainSection) => void;
  onOpenAuditInCentral: () => void;
  onQuickNewHazard: () => void;
  onQuickNewAction: () => void;
  onQuickVisitorQr: () => void;
  onNavigateToOperationsVisitors?: () => void;
  visitorCheckInUrl: string | null;
  canAccessEmployees?: boolean;
  canAccessSubcontractors?: boolean;
  subcontractorsCount: number;
  onOpenRolesInCentral: () => void;
  customRolesCount: number;
  complianceWatchdogCount?: number;
  onOpenComplianceInCentral?: () => void;
  /** Supabase auth user id — carga user_profiles.dashboard_config */
  currentUserId?: string | null;
  /** Admin o permiso equivalente a ver asistencia (widget fichaje). */
  canViewAttendance?: boolean;
  onQuickNewEmployee?: () => void;
  onQuickNewRfi?: () => void;
  onQuickNewSubcontractor?: () => void;
}

type TimeclockRow = {
  userId: string;
  name: string;
  status: "in" | "out" | "off";
  clockInTime?: string;
};

export function CentralDashboardLive({
  labels: labelsProp,
  companyId,
  companyName,
  language,
  activeProjectsCount,
  projectNameById,
  currentUserRole,
  canManageRoles,
  canAccessVisitors,
  canAccessHazards,
  canAccessCorrective,
  onNavigateAppSection,
  onOpenAuditInCentral,
  onQuickNewHazard,
  onQuickNewAction,
  onQuickVisitorQr,
  onNavigateToOperationsVisitors,
  visitorCheckInUrl,
  canAccessEmployees = false,
  canAccessSubcontractors = false,
  subcontractorsCount,
  onOpenRolesInCentral,
  customRolesCount,
  complianceWatchdogCount = 0,
  onOpenComplianceInCentral,
  currentUserId = null,
  canViewAttendance = false,
  onQuickNewEmployee,
  onQuickNewRfi,
  onQuickNewSubcontractor,
}: CentralDashboardLiveProps) {
  const labels = labelsProp;
  const L = (key: string) => labels[key] ?? "";

  const localeMap: Record<string, string> = {
    es: "es-ES",
    en: "en-GB",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
  };
  const locale = localeMap[language] ?? "es-ES";
  const formattedDate = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return labels.goodMorning ?? "";
    if (hour < 18) return labels.goodAfternoon ?? "";
    return labels.goodEvening ?? "";
  };

  const [empCount, setEmpCount] = useState<number | null>(null);
  const [visToday, setVisToday] = useState(0);
  const [visYesterday, setVisYesterday] = useState(0);
  const [hazardsOpen, setHazardsOpen] = useState(0);
  const [hazardRows, setHazardRows] = useState<Hazard[]>([]);
  const [actionRows, setActionRows] = useState<CorrectiveAction[]>([]);
  const [activeVisitors, setActiveVisitors] = useState(0);
  const [visitsByDay, setVisitsByDay] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [blueprintCount, setBlueprintCount] = useState(0);
  const [pinCount, setPinCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);
  const [criticalUnassigned, setCriticalUnassigned] = useState<Hazard[]>([]);
  const [overdueActions, setOverdueActions] = useState<CorrectiveAction[]>([]);
  const [longVisitors, setLongVisitors] = useState<{ id: string; visitor_name: string; check_in: string }[]>([]);
  const [activityRows, setActivityRows] = useState<AuditLogEntry[]>([]);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [timeclockRows, setTimeclockRows] = useState<TimeclockRow[]>([]);
  const [resolvedConfig, setResolvedConfig] = useState<ResolvedDashboardConfig>(() => parseDashboardConfig(null));
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draftConfig, setDraftConfig] = useState<ResolvedDashboardConfig>(() => parseDashboardConfig(null));
  const [savingConfig, setSavingConfig] = useState(false);
  const [useDnD, setUseDnD] = useState(false);
  const [dragWidget, setDragWidget] = useState<DashboardWidgetId | null>(null);

  const { subscription, trialDaysLeft } = useSubscription(companyId);

  const todayIso = localTodayYmd();

  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)") : null;
    const apply = () => setUseDnD(mq?.matches ?? false);
    apply();
    mq?.addEventListener("change", apply);
    return () => mq?.removeEventListener("change", apply);
  }, []);

  const loadDashboardConfig = useCallback(async () => {
    if (!supabase || !companyId) {
      setResolvedConfig(parseDashboardConfig(null));
      return;
    }
    const { data: co } = await supabase.from("companies").select("dashboard_config").eq("id", companyId).maybeSingle();
    let userRaw: unknown = null;
    if (currentUserId) {
      const { data: pr } = await supabase
        .from("user_profiles")
        .select("dashboard_config")
        .eq("id", currentUserId)
        .maybeSingle();
      userRaw = (pr as { dashboard_config?: unknown } | null)?.dashboard_config ?? null;
    }
    const merged = mergeDashboardRaw(co?.dashboard_config ?? null, userRaw);
    setResolvedConfig(parseDashboardConfig(merged));
  }, [companyId, currentUserId]);

  useEffect(() => {
    void loadDashboardConfig();
  }, [loadDashboardConfig]);

  useEffect(() => {
    if (customizeOpen) setDraftConfig(resolvedConfig);
  }, [customizeOpen, resolvedConfig]);

  const persistConfig = useCallback(
    async (next: ResolvedDashboardConfig) => {
      if (!companyId || !canManageRoles) return;
      setSavingConfig(true);
      try {
        const payload = buildDashboardConfigPayload(next);
        if (!supabase) return;
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/dashboard-config", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ companyId, dashboard_config: payload }),
        });
        if (!res.ok) return;
        setResolvedConfig(next);
      } finally {
        setSavingConfig(false);
      }
    },
    [companyId, canManageRoles]
  );

  const loadAll = useCallback(async () => {
    if (!supabase || !companyId) {
      setEmpCount(null);
      setVisToday(0);
      setVisYesterday(0);
      setHazardsOpen(0);
      setHazardRows([]);
      setActionRows([]);
      setActiveVisitors(0);
      setVisitsByDay([0, 0, 0, 0, 0, 0, 0]);
      setBlueprintCount(0);
      setPinCount(0);
      setNoteCount(0);
      setCriticalUnassigned([]);
      setOverdueActions([]);
      setLongVisitors([]);
      setActivityRows([]);
      setUserNameById({});
      setTimeclockRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { start: tStart, end: tEnd } = startEndLocalDay(0);
    const { start: yStart, end: yEnd } = startEndLocalDay(-1);
    const eightH = hoursAgoIso(8);

    try {
      const [
        profToday,
        hzOpen,
        hzList,
        caList,
        vToday,
        vYest,
        vActive,
        vLong,
        bpCt,
        pinCt,
        noteRes,
        audits,
        critUn,
        allProfs,
        vacRows,
        timeRows,
      ] = await Promise.all([
        supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase
          .from("hazards")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .in("status", ["open", "in_progress"]),
        supabase.from("hazards").select("*").eq("company_id", companyId).limit(200),
        supabase.from("corrective_actions").select("*").eq("company_id", companyId).limit(300),
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
          .gte("check_in", yStart)
          .lte("check_in", yEnd),
        supabase
          .from("visitor_logs")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "checked_in"),
        supabase
          .from("visitor_logs")
          .select("id,visitor_name,check_in")
          .eq("company_id", companyId)
          .is("check_out", null)
          .lt("check_in", eightH),
        supabase.from("blueprints").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("blueprint_pins").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase
          .from("blueprint_annotations")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("is_resolved", false),
        supabase
          .from("audit_logs")
          .select("*")
          .eq("company_id", companyId)
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("hazards")
          .select("*")
          .eq("company_id", companyId)
          .eq("severity", "critical")
          .is("assigned_to", null)
          .in("status", ["open", "in_progress"])
          .limit(20),
        supabase
          .from("user_profiles")
          .select("id, full_name, display_name")
          .eq("company_id", companyId)
          .order("full_name", { ascending: true }),
        supabase
          .from("vacation_requests")
          .select("user_id, start_date, end_date")
          .eq("company_id", companyId)
          .eq("status", "approved"),
        supabase
          .from("time_entries")
          .select("user_id, clock_in_at, clock_out_at, status")
          .eq("company_id", companyId)
          .gte("clock_in_at", tStart)
          .lte("clock_in_at", tEnd),
      ]);

      setEmpCount(profToday.count ?? 0);
      setVisToday(vToday.count ?? 0);
      setVisYesterday(vYest.count ?? 0);
      setHazardsOpen(hzOpen.count ?? 0);
      const hzData = (hzList.data ?? []) as Hazard[];
      setHazardRows(hzData);
      setActionRows((caList.data ?? []) as CorrectiveAction[]);
      setActiveVisitors(vActive.count ?? 0);
      setLongVisitors((vLong.data ?? []) as { id: string; visitor_name: string; check_in: string }[]);
      setBlueprintCount(bpCt.count ?? 0);
      setPinCount(pinCt.count ?? 0);
      setNoteCount(noteRes.error ? 0 : noteRes.count ?? 0);
      const auditRows = (audits.data ?? []) as AuditLogEntry[];
      setActivityRows(auditRows);
      const userIds = [...new Set(auditRows.map((r) => r.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("user_profiles")
          .select("id, full_name, display_name")
          .in("id", userIds);
        const map: Record<string, string> = {};
        for (const p of profs ?? []) {
          const pr = p as { id: string; full_name?: string | null; display_name?: string | null };
          const nm = (pr.full_name || pr.display_name || "").trim();
          if (nm) map[pr.id] = nm;
        }
        setUserNameById(map);
      } else {
        setUserNameById({});
      }
      setCriticalUnassigned((critUn.data ?? []) as Hazard[]);

      const ca = (caList.data ?? []) as CorrectiveAction[];
      const overdue = ca.filter((a) => {
        if (!a.due_date) return false;
        if (a.status === "verified" || a.status === "closed") return false;
        return a.due_date.slice(0, 10) < todayIso;
      });
      setOverdueActions(overdue.slice(0, 15));

      const dayKeys: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayKeys.push(d.toISOString().slice(0, 10));
      }
      const weekStart = `${dayKeys[0]}T00:00:00.000Z`;
      const weekEnd = `${dayKeys[6]}T23:59:59.999Z`;
      const { data: weekVis } = await supabase
        .from("visitor_logs")
        .select("check_in")
        .eq("company_id", companyId)
        .gte("check_in", weekStart)
        .lte("check_in", weekEnd);
      const counts = [0, 0, 0, 0, 0, 0, 0];
      for (const row of weekVis ?? []) {
        const day = (row as { check_in: string }).check_in.slice(0, 10);
        const idx = dayKeys.indexOf(day);
        if (idx >= 0) counts[idx]++;
      }
      setVisitsByDay(counts);

      const offToday = new Set<string>();
      for (const v of vacRows.data ?? []) {
        const row = v as { user_id: string; start_date: string; end_date: string };
        if (row.start_date <= todayIso && row.end_date >= todayIso) offToday.add(row.user_id);
      }

      const entriesByUser = new Map<
        string,
        { clock_in_at: string; clock_out_at: string | null }[]
      >();
      for (const te of timeRows.data ?? []) {
        const row = te as { user_id: string; clock_in_at: string; clock_out_at: string | null };
        if (!entriesByUser.has(row.user_id)) entriesByUser.set(row.user_id, []);
        entriesByUser.get(row.user_id)!.push({
          clock_in_at: row.clock_in_at,
          clock_out_at: row.clock_out_at,
        });
      }

      const tclock: TimeclockRow[] = [];
      for (const p of allProfs.data ?? []) {
        const pr = p as { id: string; full_name?: string | null; display_name?: string | null };
        const name = (pr.full_name || pr.display_name || "").trim() || pr.id.slice(0, 8);
        if (offToday.has(pr.id)) {
          tclock.push({ userId: pr.id, name, status: "off" });
          continue;
        }
        const entries = entriesByUser.get(pr.id) ?? [];
        const active = entries.find((e) => e.clock_out_at == null);
        if (active) {
          const dt = new Date(active.clock_in_at);
          const clockInTime = dt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
          tclock.push({ userId: pr.id, name, status: "in", clockInTime });
        } else {
          tclock.push({ userId: pr.id, name, status: "out" });
        }
      }
      setTimeclockRows(tclock);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [companyId, todayIso, locale]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, tick]);

  useEffect(() => {
    const client = supabase;
    if (!client || !companyId) return;
    const ch = client
      .channel(`dash_${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitor_logs", filter: `company_id=eq.${companyId}` },
        () => setTick((x) => x + 1)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hazards", filter: `company_id=eq.${companyId}` },
        () => setTick((x) => x + 1)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "corrective_actions", filter: `company_id=eq.${companyId}` },
        () => setTick((x) => x + 1)
      )
      .subscribe();
    return () => {
      void client.removeChannel(ch);
    };
  }, [companyId]);

  const trialAlert =
    subscription?.status === "trialing" &&
    subscription.trial_ends_at &&
    new Date(subscription.trial_ends_at).getTime() > Date.now() &&
    new Date(subscription.trial_ends_at).getTime() < Date.now() + 3 * 86400000;

  const alertCount =
    criticalUnassigned.length +
    overdueActions.length +
    longVisitors.length +
    (trialAlert ? 1 : 0);

  const openHazards = useMemo(
    () => hazardRows.filter((h) => h.status === "open" || h.status === "in_progress"),
    [hazardRows]
  );
  const sevBuckets = useMemo(() => {
    const m: Record<HazardSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const h of openHazards) m[h.severity] = (m[h.severity] ?? 0) + 1;
    return m;
  }, [openHazards]);

  const statusHazardParts = useMemo(() => {
    const st: Record<HazardStatus, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const h of hazardRows) st[h.status] = (st[h.status] ?? 0) + 1;
    return [
      { key: "open", pct: st.open, className: "bg-red-500" },
      { key: "ip", pct: st.in_progress, className: "bg-amber-500" },
      { key: "res", pct: st.resolved, className: "bg-emerald-500" },
      { key: "clo", pct: st.closed, className: "bg-gray-400" },
    ];
  }, [hazardRows]);

  const actionStatusParts = useMemo(() => {
    const st: Partial<Record<ActionStatus, number>> = {};
    for (const a of actionRows) st[a.status] = (st[a.status] ?? 0) + 1;
    return [
      { key: "open", pct: st.open ?? 0, className: "bg-red-400" },
      { key: "ip", pct: st.in_progress ?? 0, className: "bg-amber-400" },
      { key: "pr", pct: st.pending_review ?? 0, className: "bg-violet-400" },
      { key: "v", pct: st.verified ?? 0, className: "bg-emerald-500" },
      { key: "c", pct: st.closed ?? 0, className: "bg-gray-400" },
    ];
  }, [actionRows]);

  const dueThisWeek = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const endS = end.toISOString().slice(0, 10);
    return actionRows.filter(
      (a) =>
        a.due_date &&
        a.due_date.slice(0, 10) >= todayIso &&
        a.due_date.slice(0, 10) <= endS &&
        a.status !== "verified" &&
        a.status !== "closed"
    );
  }, [actionRows, todayIso]);

  const topCritical = useMemo(() => {
    const order: HazardSeverity[] = ["critical", "high", "medium", "low"];
    return [...openHazards]
      .sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
      .slice(0, 3);
  }, [openHazards]);

  const activityLast24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return activityRows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  }, [activityRows]);

  const activityPool = useMemo(() => {
    if (activityLast24h.length > 0) return activityLast24h;
    return activityRows;
  }, [activityLast24h, activityRows]);

  const activityPeriodIs24h = activityLast24h.length > 0;

  const filteredActivity = useMemo(() => {
    const src = activityPool;
    const filtered =
      activityFilter === "all"
        ? src
        : src.filter((r) => {
            const b = activityBucket(r.action, r.entity_type);
            if (activityFilter === "safety") return b === "safety";
            if (activityFilter === "operations") return b === "operations";
            if (activityFilter === "hr") return b === "hr";
            return false;
          });
    return filtered.slice(0, 10);
  }, [activityPool, activityFilter]);

  const resolveActivityWho = useCallback(
    (userId: string, storedName?: string | null) => {
      const fromDb = userNameById[userId]?.trim();
      if (fromDb) return fromDb;
      const s = (storedName ?? "").trim();
      const dash = labels.common_dash ?? "";
      if (s && !s.includes("@")) return s;
      if (s.includes("@")) {
        const local = s.split("@")[0]?.trim();
        return local || (labels.dashboard_activity_user ?? "");
      }
      return labels.dashboard_activity_user ?? "";
    },
    [userNameById, labels]
  );

  const seatsLimit = subscription?.seats_limit;
  const projLimit = subscription?.projects_limit;
  const storLimit = subscription?.storage_limit_gb;
  const empN = empCount ?? 0;
  const seatPct =
    seatsLimit != null && seatsLimit > 0 && seatsLimit < 999000 ? Math.min(100, Math.round((empN / seatsLimit) * 100)) : 0;
  const projPct =
    projLimit != null && projLimit > 0 && projLimit < 999000
      ? Math.min(100, Math.round((activeProjectsCount / projLimit) * 100))
      : 0;
  const storPct =
    storLimit != null && storLimit > 0 && storLimit < 999000 ? Math.min(100, Math.round((0 / storLimit) * 100)) : 0;

  const maxVis = Math.max(1, ...visitsByDay);

  const showTimeclockWidget = currentUserRole === "admin" || canViewAttendance;

  const canShowWidget = useCallback(
    (id: DashboardWidgetId): boolean => {
      if (id === "timeclock") return showTimeclockWidget;
      if (id === "hazards") return canAccessHazards;
      if (id === "actions") return canAccessCorrective;
      if (id === "visitors") return canAccessVisitors || currentUserRole === "worker";
      return true;
    },
    [showTimeclockWidget, canAccessHazards, canAccessCorrective, canAccessVisitors, currentUserRole]
  );

  const orderedVisibleWidgets = useMemo(
    () => resolvedConfig.orderedWidgets.filter((id) => canShowWidget(id)),
    [resolvedConfig.orderedWidgets, canShowWidget]
  );

  const moveWidget = useCallback(
    (id: DashboardWidgetId, dir: -1 | 1) => {
      const order = [...resolvedConfig.orderedWidgets];
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      const next = { ...resolvedConfig, orderedWidgets: order };
      setResolvedConfig(next);
      void persistConfig(next);
    },
    [resolvedConfig, persistConfig]
  );

  const onDragStartWidget = (id: DashboardWidgetId) => {
    if (!canManageRoles || !useDnD) return;
    setDragWidget(id);
  };

  const onDropWidget = (overId: DashboardWidgetId) => {
    if (!canManageRoles || !useDnD || !dragWidget || dragWidget === overId) {
      setDragWidget(null);
      return;
    }
    const order = [...resolvedConfig.orderedWidgets];
    const from = order.indexOf(dragWidget);
    const to = order.indexOf(overId);
    if (from < 0 || to < 0) {
      setDragWidget(null);
      return;
    }
    order.splice(from, 1);
    order.splice(to, 0, dragWidget);
    const next = { ...resolvedConfig, orderedWidgets: order };
    setResolvedConfig(next);
    void persistConfig(next);
    setDragWidget(null);
  };

  const toggleWidgetInDraft = (id: DashboardWidgetId) => {
    const has = draftConfig.orderedWidgets.includes(id);
    let order = [...draftConfig.orderedWidgets];
    if (has) {
      if (order.length <= 1) return;
      order = order.filter((w) => w !== id);
    } else order.push(id);
    setDraftConfig({ ...draftConfig, orderedWidgets: order });
  };

  const toggleQuickInDraft = (k: QuickAccessKey) => {
    const has = draftConfig.quickAccess.includes(k);
    let qa = [...draftConfig.quickAccess];
    if (has) {
      if (qa.length <= 1) return;
      qa = qa.filter((x) => x !== k);
    } else qa.push(k);
    setDraftConfig({ ...draftConfig, quickAccess: qa });
  };

  const saveCustomize = async () => {
    setResolvedConfig(draftConfig);
    setCustomizeOpen(false);
    await persistConfig(draftConfig);
  };

  const renderQuickAccessButtons = (quickKeys: QuickAccessKey[]) => (
    <div className="flex flex-wrap gap-2">
      {quickKeys.map((k) => {
        if (k === "hazard" && canAccessHazards && currentUserRole !== "worker") {
          return (
            <button
              key={k}
              type="button"
              onClick={onQuickNewHazard}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 text-sm font-semibold"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_new_hazard")}
            </button>
          );
        }
        if (k === "corrective" && canAccessCorrective && currentUserRole !== "worker") {
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
        if (k === "visitor" && (canAccessVisitors || currentUserRole === "worker")) {
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                if (canAccessVisitors) onQuickVisitorQr();
                else if (visitorCheckInUrl) window.open(visitorCheckInUrl, "_blank", "noopener,noreferrer");
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <QrCode className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_register_visitor")}
            </button>
          );
        }
        if (k === "audit" && canManageRoles) {
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
        if (k === "employee" && canAccessEmployees && onQuickNewEmployee) {
          return (
            <button
              key={k}
              type="button"
              onClick={onQuickNewEmployee}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_quick_employee")}
            </button>
          );
        }
        if (k === "rfi" && onQuickNewRfi) {
          return (
            <button
              key={k}
              type="button"
              onClick={onQuickNewRfi}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_quick_rfi")}
            </button>
          );
        }
        if (k === "subcontractor" && canAccessSubcontractors && onQuickNewSubcontractor) {
          return (
            <button
              key={k}
              type="button"
              onClick={onQuickNewSubcontractor}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {L("dashboard_quick_subcontractor")}
            </button>
          );
        }
        return null;
      })}
    </div>
  );

  const widgetChrome = (id: DashboardWidgetId, children: React.ReactNode) => {
    const idxAll = resolvedConfig.orderedWidgets.indexOf(id);
    const canUp = canManageRoles && idxAll > 0;
    const canDown = canManageRoles && idxAll >= 0 && idxAll < resolvedConfig.orderedWidgets.length - 1;
    return (
      <div
        className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
        onDragOver={
          useDnD && canManageRoles
            ? (e) => {
                e.preventDefault();
              }
            : undefined
        }
        onDrop={
          useDnD && canManageRoles
            ? (e) => {
                e.preventDefault();
                onDropWidget(id);
              }
            : undefined
        }
      >
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {canManageRoles && useDnD ? (
            <div
              role="button"
              tabIndex={0}
              draggable
              onDragStart={() => onDragStartWidget(id)}
              onDragEnd={() => setDragWidget(null)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing"
              aria-label={L("dashboard_drag_handle")}
            >
              <GripVertical className="h-5 w-5" aria-hidden />
            </div>
          ) : null}
          {canManageRoles && !useDnD ? (
            <>
              <button
                type="button"
                disabled={!canUp}
                onClick={() => moveWidget(id, -1)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
                aria-label={L("dashboard_move_up")}
              >
                <ChevronUp className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                disabled={!canDown}
                onClick={() => moveWidget(id, 1)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
                aria-label={L("dashboard_move_down")}
              >
                <ChevronDown className="h-5 w-5" aria-hidden />
              </button>
            </>
          ) : null}
        </div>
        {children}
      </div>
    );
  };

  const renderWidget = (id: DashboardWidgetId) => {
    switch (id) {
      case "timeclock":
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" aria-hidden />
              {L(WIDGET_LABEL_KEYS.timeclock)}
            </h3>
            {timeclockRows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-2">{L("dashboard_timeclock_empty")}</p>
            ) : (
              <ul className="space-y-2 max-h-[280px] overflow-y-auto">
                {timeclockRows.map((r) => (
                  <li
                    key={r.userId}
                    className={`flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg px-2 py-2 ${
                      r.status === "in"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
                        : r.status === "off"
                          ? "bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400"
                          : "bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-200"
                    }`}
                  >
                    <span className="font-medium truncate">{r.name}</span>
                    <span className="text-xs shrink-0">
                      {r.status === "in"
                        ? `${L("dashboard_clocked_in")}${r.clockInTime ? ` · ${r.clockInTime}` : ""}`
                        : r.status === "off"
                          ? L("dashboard_day_off")
                          : L("dashboard_not_clocked_in")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        );
      case "activity":
        return widgetChrome(
          id,
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 pe-14">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-400" aria-hidden />
                  {L(WIDGET_LABEL_KEYS.activity)}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {activityPeriodIs24h ? L("dashboard_activity_period_24h") : L("dashboard_activity_period_7d")}
                </p>
              </div>
              <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span>{L("dashboard_activity_filter")}</span>
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-h-[44px] px-2"
                >
                  <option value="all">{L("dashboard_filter_all")}</option>
                  <option value="safety">{L("dashboard_filter_safety")}</option>
                  <option value="operations">{L("dashboard_filter_operations")}</option>
                  <option value="hr">{L("dashboard_filter_hr")}</option>
                </select>
              </label>
            </div>
            <ul className="space-y-2 max-h-[320px] overflow-y-auto mt-3">
              {filteredActivity.length === 0 ? (
                <li className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">{L("dashboard_activity_empty")}</li>
              ) : (
                filteredActivity.map((row) => (
                  <li
                    key={row.id}
                    className="flex gap-2 text-sm border-b border-gray-100 dark:border-gray-700/60 pb-2 last:border-0"
                  >
                    <Shield className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-800 dark:text-gray-200">
                        {formatActivityLine(row, labels, projectNameById, resolveActivityWho)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{relativeTime(row.created_at, locale, labels)}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </>
        );
      case "alerts":
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 pe-14 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              {L(WIDGET_LABEL_KEYS.alerts)}
            </h3>
            {complianceWatchdogCount > 0 && onOpenComplianceInCentral ? (
              <button
                type="button"
                onClick={onOpenComplianceInCentral}
                className="w-full min-h-[44px] mb-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-left text-sm font-medium text-amber-900 dark:text-amber-200 flex items-center gap-2"
              >
                <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />
                <span className="flex-1 min-w-0">
                  {L("complianceWatchdog")}
                  <span className="ml-2 tabular-nums">({complianceWatchdogCount})</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              </button>
            ) : null}
            {alertCount === 0 ? (
              <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 px-4 py-3 flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
                <span className="text-sm font-medium">{L("dashboard_all_clear")}</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {criticalUnassigned.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-800/50 p-3"
                  >
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{L("dashboard_critical_hazards")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{h.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateAppSection("hazards")}
                      className="min-h-[44px] px-3 rounded-lg border border-red-300 dark:border-red-800 text-sm font-semibold text-red-700 dark:text-red-300"
                    >
                      {labels.viewAll ?? ""}
                    </button>
                  </li>
                ))}
                {overdueActions.slice(0, 5).map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-gray-800/50 p-3"
                  >
                    <Clock className="h-5 w-5 text-amber-500 shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{L("dashboard_overdue_actions")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateAppSection("corrective_actions")}
                      className="min-h-[44px] px-3 rounded-lg border border-amber-300 dark:border-amber-800 text-sm font-semibold text-amber-800 dark:text-amber-200"
                    >
                      {labels.viewAll ?? ""}
                    </button>
                  </li>
                ))}
                {longVisitors.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 dark:border-violet-900/50 bg-white dark:bg-gray-800/50 p-3"
                  >
                    <UserCheck className="h-5 w-5 text-violet-500 shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{L("dashboard_long_visitors")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{v.visitor_name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToOperationsVisitors ? onNavigateToOperationsVisitors() : onNavigateAppSection("site")
                      }
                      className="min-h-[44px] px-3 rounded-lg border border-violet-300 dark:border-violet-800 text-sm font-semibold text-violet-800 dark:text-violet-200"
                    >
                      {labels.viewAll ?? ""}
                    </button>
                  </li>
                ))}
                {trialAlert && (
                  <li className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-gray-800/50 p-3">
                    <CreditCard className="h-5 w-5 text-amber-500 shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{L("dashboard_trial_expiring")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {trialDaysLeft != null ? L("billing_trial_days_left").replace("{n}", String(trialDaysLeft)) : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateAppSection(currentUserRole === "admin" ? "billing" : "settings")}
                      className="min-h-[44px] px-3 rounded-lg border border-amber-300 text-sm font-semibold text-amber-800 dark:text-amber-200"
                    >
                      {labels.viewAll ?? ""}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </>
        );
      case "hazards":
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 pe-14 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />
              {L(WIDGET_LABEL_KEYS.hazards)}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{L("dashboard_severity_open")}</p>
            {openHazards.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-3">{L("dashboard_hazards_empty")}</p>
            ) : (
              <>
                <BarStack
                  segments={[
                    { key: "c", pct: sevBuckets.critical, className: "bg-red-600" },
                    { key: "h", pct: sevBuckets.high, className: "bg-orange-500" },
                    { key: "m", pct: sevBuckets.medium, className: "bg-amber-400" },
                    { key: "l", pct: sevBuckets.low, className: "bg-gray-400" },
                  ]}
                  height={10}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 mb-1">{L("dashboard_status_all")}</p>
                <BarStack segments={statusHazardParts} height={8} />
                <ul className="mt-3 space-y-1">
                  {topCritical.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => onNavigateAppSection("hazards")}
                        className="text-left w-full flex items-center gap-2 text-xs min-h-[44px] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 px-1"
                      >
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                        <span className={`font-medium truncate ${severityTone(h.severity)}`}>{h.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        );
      case "actions":
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 pe-14 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-amber-500" aria-hidden />
              {L(WIDGET_LABEL_KEYS.actions)}
            </h3>
            <BarStack segments={actionStatusParts} height={10} />
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-medium">
              {L("dashboard_actions_overdue").replace("{n}", String(overdueActions.length))}
            </p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-3 mb-1">{L("dashboard_due_week")}</p>
            <ul className="space-y-1">
              {dueThisWeek.slice(0, 4).map((a) => (
                <li key={a.id} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  · {a.title} ({a.due_date?.slice(0, 10)})
                </li>
              ))}
              {dueThisWeek.length === 0 && <li className="text-xs text-gray-500 dark:text-gray-400">{labels.common_dash ?? ""}</li>}
            </ul>
          </>
        );
      case "visitors":
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 pe-14 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-500" aria-hidden />
              {L(WIDGET_LABEL_KEYS.visitors)}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {L("dashboard_active_now")}: <span className="tabular-nums text-emerald-600">{activeVisitors}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 mb-2">{L("dashboard_visits_7d")}</p>
            {activeVisitors === 0 && visitsByDay.every((n) => n === 0) ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-3">{L("dashboard_visitors_empty")}</p>
            ) : (
              <div className="flex items-end gap-1 h-24">
                {visitsByDay.map((n, i) => (
                  <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1">
                    <div
                      className="w-full rounded-t bg-emerald-500/80 dark:bg-emerald-600/80 min-h-[4px]"
                      style={{ height: `${Math.max(8, (n / maxVis) * 100)}%` }}
                    />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      case "blueprints":
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 pe-14 flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-500" aria-hidden />
              {L(WIDGET_LABEL_KEYS.blueprints)}
            </h3>
            <ul className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex justify-between">
                <span>{L("dashboard_blueprints_total")}</span>
                <span className="font-bold tabular-nums">{blueprintCount}</span>
              </li>
              <li className="flex justify-between">
                <span>{L("dashboard_pins_total")}</span>
                <span className="font-bold tabular-nums">{pinCount}</span>
              </li>
              <li className="flex justify-between">
                <span className="flex items-center gap-1">
                  <StickyNote className="h-3.5 w-3.5" aria-hidden />
                  {L("dashboard_notes_active")}
                </span>
                <span className="font-bold tabular-nums">{noteCount}</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => onNavigateAppSection("site")}
              className="mt-3 w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" aria-hidden />
                {L("site")}
              </span>
            </button>
          </>
        );
      case "subscription":
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 pe-14 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-violet-500" aria-hidden />
              {L(WIDGET_LABEL_KEYS.subscription)}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 font-semibold text-amber-900 dark:text-amber-200">
                {subscription?.plan ?? (labels.common_dash ?? "")} ·{" "}
                {subscription?.status === "trialing"
                  ? L("subscription_status_trialing")
                  : subscription?.status ?? (labels.common_dash ?? "")}
              </span>
            </p>
            {subscription?.status === "trialing" && trialDaysLeft != null && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                {L("billing_trial_days_left").replace("{n}", String(trialDaysLeft))}
              </p>
            )}
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400 mb-1">
                  <span>{L("dashboard_usage_users")}</span>
                  <span>
                    {empN} / {seatsLimit != null && seatsLimit < 999000 ? seatsLimit : labels.common_dash ?? ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full bg-violet-500" style={{ width: `${seatPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400 mb-1">
                  <span>{L("dashboard_usage_projects")}</span>
                  <span>
                    {activeProjectsCount} / {projLimit != null && projLimit < 999000 ? projLimit : labels.common_dash ?? ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${projPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400 mb-1">
                  <span>{L("dashboard_usage_storage")}</span>
                  <span>
                    0 / {storLimit != null && storLimit < 999000 ? `${storLimit} GB` : labels.common_dash ?? ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${storPct}%` }} />
                </div>
              </div>
            </div>
          </>
        );
      case "quickaccess":
        return widgetChrome(
          id,
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14">{L(WIDGET_LABEL_KEYS.quickaccess)}</h3>
            {renderQuickAccessButtons(resolvedConfig.quickAccess)}
          </>
        );
      default:
        return null;
    }
  };

  if (!companyId) {
    return null;
  }

  return (
    <>
      <section className="space-y-2 mb-4">
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          {getGreeting()} — {formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}
        </p>
        {alertCount > 0 ? (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {L("dashboard_alerts_attention").replace("{n}", String(alertCount))}
          </p>
        ) : (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {L("dashboard_all_clear_named").replace("{company}", companyName ?? L("dashboard_company"))}
          </p>
        )}
      </section>

      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{L("dashboard_management_section")}</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {loading ? (
          <>
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 min-h-[88px] animate-pulse"
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
          </>
        ) : (
          <>
            <UnifiedDashCard
              icon={<Users className="h-5 w-5 text-blue-500" aria-hidden />}
              iconWrapClassName="bg-blue-500/10"
              label={L("employees_title") || L("personnel") || L("employees")}
              value={empN}
              subContent={
                L("dashboard_kpi_hint_personnel").trim() ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{L("dashboard_kpi_hint_personnel")}</p>
                ) : undefined
              }
              onClick={() => onNavigateAppSection(canAccessEmployees ? "employees" : "office")}
            />
            <UnifiedDashCard
              icon={<Briefcase className="h-5 w-5 text-violet-500" aria-hidden />}
              iconWrapClassName="bg-violet-500/10"
              label={L("subcontractors_title") || L("subcontractors")}
              value={subcontractorsCount}
              onClick={() => onNavigateAppSection(canAccessSubcontractors ? "subcontractors" : "office")}
            />
            <UnifiedDashCard
              icon={<KeyRound className="h-5 w-5 text-emerald-500" aria-hidden />}
              iconWrapClassName="bg-emerald-500/10"
              label={L("rolesAndPermissions")}
              value={customRolesCount}
              onClick={() => {
                if (canManageRoles) onOpenRolesInCentral();
                else onNavigateAppSection("office");
              }}
              ariaLabel={L("rolesAndPermissions")}
            />
            <UnifiedDashCard
              icon={<FileSearch className="h-5 w-5 text-amber-600" aria-hidden />}
              iconWrapClassName="bg-amber-500/10"
              label={L("auditLog")}
              value={activityRows.length}
              onClick={() => {
                if (canManageRoles) onOpenAuditInCentral();
                else onNavigateAppSection("office");
              }}
              ariaLabel={L("auditLog")}
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{L("dashboard_operations_panel")}</h2>
        {canManageRoles ? (
          <button
            type="button"
            onClick={() => setCustomizeOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Settings2 className="h-4 w-4" aria-hidden />
            {L("dashboard_customize")}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {orderedVisibleWidgets.map((id) => (
          <React.Fragment key={id}>{renderWidget(id)}</React.Fragment>
        ))}
      </div>

      {customizeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={L("dashboard_customize")}
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-900">
              <p className="text-base font-semibold text-gray-900 dark:text-white">{L("dashboard_customize")}</p>
              <button
                type="button"
                onClick={() => setCustomizeOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label={L("common_close")}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{L("dashboard_operations_panel")}</p>
              <ul className="space-y-2">
                {DEFAULT_DASHBOARD_WIDGET_ORDER.map((wid) => (
                  <li
                    key={wid}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-200">{L(WIDGET_LABEL_KEYS[wid])}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draftConfig.orderedWidgets.includes(wid)}
                      onClick={() => toggleWidgetInDraft(wid)}
                      className={`min-h-[44px] min-w-[52px] rounded-full border-2 px-2 text-xs font-semibold ${
                        draftConfig.orderedWidgets.includes(wid)
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                          : "border-gray-300 dark:border-gray-600 text-gray-500"
                      }`}
                    >
                      {draftConfig.orderedWidgets.includes(wid) ? L("common_on") : L("common_off")}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{L("dashboard_widget_quickaccess")}</p>
              <ul className="space-y-2">
                {QUICK_ACCESS_KEYS.map((k) => {
                  const labelKey =
                    k === "hazard"
                      ? "dashboard_new_hazard"
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
                  return (
                    <li
                      key={k}
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                    >
                      <span className="text-sm text-gray-800 dark:text-gray-200">{L(labelKey)}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draftConfig.quickAccess.includes(k)}
                        onClick={() => toggleQuickInDraft(k)}
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
            <div className="sticky bottom-0 flex flex-wrap gap-2 justify-end border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setCustomizeOpen(false)}
                className="min-h-[44px] px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold"
              >
                {L("dashboard_customize_cancel")}
              </button>
              <button
                type="button"
                disabled={savingConfig}
                onClick={() => void saveCustomize()}
                className="min-h-[44px] px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-60"
              >
                {L("dashboard_customize_save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
