"use client";

import React, { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { Users, Briefcase, HardHat, ShieldCheck, Shield, ShieldAlert, ShieldOff, X, Pencil, Trash2, Plus, ChevronLeft, UserPlus, Lock, AlertTriangle, Clock, FileCheck, Star, Phone, MapPin, FileText, Image, Loader2, Check, Calendar, Camera, KeyRound, Download } from 'lucide-react';
import type { CustomRole, RolePermissions } from '@/types/roles';
import {
  ROLE_PERMISSION_KEYS,
  isProtectedCustomRole,
  ROLE_PERMISSION_GROUPS,
  permLocaleKey,
  ROLE_PERMISSION_LABELS,
  emptyRolePermissionsInline,
} from '@/types/roles';
import type { CentralEmployee } from '@/types/shared';
import type { Subcontractor } from '@/types/subcontractor';
import { getTaxIdLabel, getComplianceCertLabel, SUBCONTRACTOR_SPECIALTIES } from '@/types/subcontractor';
import type { ComplianceField, ComplianceRecord, EmployeeDocument } from '@/app/page';
import type { AuditLogEntry } from '@/lib/useAuditLog';
import type { ComplianceAlert } from '@/lib/complianceWatchdog';
import type { UserRole } from '@/types/shared';
import type { MainSection } from '@/types/shared';
import { CentralDashboardLive } from '@/components/CentralDashboardLive';
import { HorizontalScrollFade } from '@/components/HorizontalScrollFade';
import { getAuditActionLabel, getAuditEntityTypeLabel } from '@/lib/auditDisplay';
import {
  dateLocaleForUser,
  resolveUserTimezone,
  formatDateLong,
  formatDateTime,
  formatDateMedium,
  getClockHourInTimeZone,
} from '@/lib/dateUtils';
import { useMachinProDisplayPrefs } from '@/hooks/useMachinProDisplayPrefs';
import { isProjectOperationallyActive, resolveProjectLifecycleStatus } from '@/lib/projectFilters';

interface Certificate {
  id: string;
  name: string;
  status: string;
  expiryDate?: string;
}

/** Briefing card for dashboard alerts */
interface BriefingItem {
  type: "red" | "amber" | "green";
  icon: ReactNode;
  title: string;
  description: string;
  count?: number;
  action?: () => void;
  actionLabel?: string;
}

function BriefingCard({ type, icon, title, description, count, action, actionLabel }: BriefingItem) {
  const borderClass = type === "red" ? "border-l-red-500" : type === "amber" ? "border-l-amber-500" : "border-l-emerald-500";
  const badgeClass = type === "red" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : type === "amber" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
  return (
    <div className={`flex items-start gap-3 rounded-xl border-l-4 bg-white dark:bg-slate-900 border border-zinc-100 dark:border-slate-700 p-4 shadow-sm ${borderClass}`}>
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{title}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
      </div>
      {count !== undefined && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>{count}</span>
      )}
      {action && (
        <button
          type="button"
          onClick={action}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center px-2 text-xs font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
        >
          {actionLabel ?? "View all"}
        </button>
      )}
    </div>
  );
}

function daysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  const expiry = new Date(expiryDate);
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

function certSemaphore(expiryDate?: string): "expired" | "soon" | "ok" | "nodate" {
  if (!expiryDate) return "nodate";
  const days = daysUntilExpiry(expiryDate);
  if (days < 0)  return "expired";
  if (days <= 30) return "soon";
  return "ok";
}

function getTrainingStatus(certs: { expiryDate?: string }[] | undefined): "sin_certs" | "pendiente" | "al_dia" {
  if (!(certs ?? []).length) return "sin_certs";
  const today = new Date().toISOString().slice(0, 10);
  const hasExpired = (certs ?? []).some((c) => c.expiryDate && c.expiryDate < today);
  return hasExpired ? "pendiente" : "al_dia";
}

function employeeDocTypeLabel(type: EmployeeDocument["type"], tl: Record<string, string>): string {
  switch (type) {
    case "contract":
      return tl.docTypeContract ?? "Contract";
    case "certificate":
      return tl.docTypeCertificate ?? "Certificate";
    case "id":
      return tl.docTypeId ?? "ID";
    case "training":
      return tl.docTypeTraining ?? "Training";
    case "medical":
      return tl.docTypeMedical ?? "Medical";
    case "other":
    default:
      return tl.docTypeOther ?? "Other";
  }
}

function employeeDocExpiryTextClass(expiryDate?: string): string {
  if (!expiryDate) return "text-zinc-500 dark:text-zinc-400";
  const days = daysUntilExpiry(expiryDate);
  if (days < 0) return "text-red-600 dark:text-red-400 font-semibold";
  if (days <= 30) return "text-amber-600 dark:text-amber-400 font-medium";
  return "text-zinc-600 dark:text-zinc-300";
}

/** Project shape for list + optional budget/deadline for briefing */
type CentralProject = {
  id: string;
  name?: string;
  location?: string;
  archived?: boolean;
  budgetCAD?: number;
  spentCAD?: number;
  estimatedStart?: string;
  estimatedEnd?: string;
  assignedEmployeeIds?: string[];
  lifecycleStatus?: "active" | "paused" | "completed";
};

function formatProjectListDate(iso: string | undefined, locale: string, timeZone: string): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDateMedium(d, locale, timeZone);
}

function projectBudgetPct(spent: number | undefined, budget: number | undefined): number {
  if (budget == null || budget <= 0) return 0;
  return Math.min(100, Math.round(((spent ?? 0) / budget) * 100));
}

function budgetBarToneClass(pct: number): string {
  if (pct > 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

/** Days until estimated end (local date); null if unknown. */
function daysUntilProjectEnd(estimatedEnd?: string): number | null {
  if (!estimatedEnd) return null;
  const end = new Date(estimatedEnd.includes("T") ? estimatedEnd : `${estimatedEnd}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

interface CentralModuleProps {
  labels: Record<string, string>;
  employees?: CentralEmployee[];
  projects?: CentralProject[];
  displayProjects?: Array<{ id: string; name?: string; location?: string; archived?: boolean }>;
  subcontractors?: Subcontractor[];
  subcontractorCountryCode?: string;
  /** Company country for date/number locale (MM/DD vs DD/MM); defaults to subcontractorCountryCode. */
  regionCountryCode?: string;
  taxIdLabel?: string;
  complianceCertLabel?: string;
  clockEntries?: Array<{ date: string; clockIn?: string; employeeId?: string }>;
  formInstances?: Array<{ id: string; status: string; createdAt: string; date?: string }>;
  language?: string;
  /** IANA timezone for audit logs / dates (defaults: profile → browser → America/Toronto). */
  timeZone?: string;
  onAddProject?: () => void;
  onEditProject?: (id: string) => void;
  onArchiveProject?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  onAddEmployee?: () => void;
  onUpdateEmployee?: (id: string, upd?: { name?: string; role?: string; hours?: number; certificates?: unknown[] }) => void;
  onConfirmDeleteEmployee?: (id: string) => void;
  onAddSubcontractor?: (sub: Subcontractor) => void;
  onUpdateSubcontractor?: (sub: Subcontractor) => void;
  onConfirmDeleteSubcontractor?: (id: string) => void;
  onOpenProjectForm?: (proj: { id: string; name?: string; location?: string; archived?: boolean }) => void;
  /** Navigate to Operations (site) with project selected, or use onOpenProjectForm fallback from parent. */
  onOpenProjectInOperations?: (proj: { id: string; name?: string; location?: string; archived?: boolean }) => void;
  /** Pending obra photos per project id (e.g. from useProjectPhotos). */
  pendingPhotoCountByProject?: Record<string, number>;
  canEdit?: boolean;
  /** Permisos granulares de proyectos (Central). Si omiten, se deducen de `canEdit`. */
  canViewProjects?: boolean;
  canCreateProjects?: boolean;
  canEditProjects?: boolean;
  canDeleteProjects?: boolean;
  canManageRoles?: boolean;
  canViewRoles?: boolean;
  canViewAuditLog?: boolean;
  customRoles?: CustomRole[];
  onAddRole?: (role: CustomRole) => void | Promise<void>;
  onUpdateRole?: (role: CustomRole) => void | Promise<void>;
  onDeleteRole?: (id: string) => void | Promise<void>;
  complianceFields?: ComplianceField[];
  complianceRecords?: ComplianceRecord[];
  onComplianceRecordsChange?: (records: ComplianceRecord[]) => void;
  employeeDocs?: EmployeeDocument[];
  onUploadEmployeeDoc?: (doc: Omit<EmployeeDocument, "id" | "uploadedAt">) => void;
  onDeleteEmployeeDoc?: (docId: string) => void;
  currentUserRole?: UserRole;
  /** When role is worker, only this employee id may see the documents section. */
  currentUserEmployeeId?: string | null;
  companyId?: string | null;
  uploadedByDisplayName?: string;
  onUpdateEmployeePermissions?: (employeeId: string, permissions: Partial<RolePermissions>, useRole: boolean) => void;
  auditLogs?: AuditLogEntry[];
  complianceAlerts?: ComplianceAlert[];
  pendingOpenEmployeeId?: string | null;
  onPendingOpenEmployeeHandled?: () => void;
  companyName?: string | null;
  onNavigateAppSection?: (section: MainSection) => void;
  onQuickNewHazard?: () => void;
  onQuickNewAction?: () => void;
  onQuickVisitorQr?: () => void;
  /** Solo pestaña Visitantes en Operaciones (sin forzar modal QR). */
  onNavigateToOperationsVisitors?: () => void;
  visitorCheckInUrl?: string | null;
  canAccessVisitors?: boolean;
  canAccessHazards?: boolean;
  canAccessCorrective?: boolean;
  canAccessEmployees?: boolean;
  canAccessSubcontractors?: boolean;
  currentUserId?: string | null;
  canViewAttendance?: boolean;
  /** Permisos efectivos para CentralDashboardLive (widgets / Zona 1). */
  dashboardCanManageEmployees?: boolean;
  dashboardCanViewTeamClock?: boolean;
  dashboardCanManageComplianceAlerts?: boolean;
  dashboardCanViewLogistics?: boolean;
  dashboardCanViewEmployees?: boolean;
  dashboardCanViewRoles?: boolean;
  dashboardCanViewAuditLog?: boolean;
  dashboardCanViewDashboardWidgets?: boolean;
  /** Tarjeta Proyectos en Zona de gestión (Central). */
  dashboardCanViewProjectsManagement?: boolean;
  dashboardCriticalInventoryCount?: number;
  onQuickNewRfi?: () => void;
  onQuickNewSubcontractor?: () => void;
  /** Abrir Operaciones → Subcontratistas (fuera de Central). */
  onOpenSubcontractorsInOperations?: () => void;
  /** Vista jornada AW-6: abre panel completo desde widget Mi fichaje. */
  onOpenMyShiftView?: () => void;
  /** Tarjeta Proyectos: crear proyecto o solo Operaciones según permisos. */
  onProjectsManagementCardClick?: () => void;
  myShiftCentralCard?: {
    hasShiftToday: boolean;
    projectName?: string;
    shiftTimeLabel?: string;
    workedSummary?: string | null;
    clockedInNotOut?: boolean;
  };
  /** Opciones para modal “Registrar fichaje” (widget equipo). */
  manualClockEmployeeOptions?: { id: string; name: string }[];
  manualClockProjectOptions?: { id: string; name: string }[];
  registerManualClockIn?: (p: {
    targetUserId: string;
    date: string;
    time: string;
    projectId?: string | null;
    notes?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

function computeComplianceRecordStatus(
  expiryDate: string | undefined,
  alertDaysBefore: number,
  fieldType: string
): "valid" | "expiring" | "expired" | "missing" {
  if (fieldType === "date" && expiryDate) {
    const days = daysUntilExpiry(expiryDate);
    if (days < 0) return "expired";
    if (days <= alertDaysBefore) return "expiring";
    return "valid";
  }
  return "missing";
}

function getComplianceStatusBadge(
  record: ComplianceRecord | undefined,
  labels: Record<string, string>
): React.ReactNode {
  const status = record?.status ?? "missing";
  if (status === "valid")
    return (
      <span className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        {labels.valid ?? "Al d?a"}
      </span>
    );
  if (status === "expiring")
    return (
      <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        {labels.expiring ?? "Vence pronto"}
      </span>
    );
  if (status === "expired")
    return (
      <span className="inline-flex rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
        {labels.expired ?? "Vencido"}
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
      {labels.missing ?? "Sin datos"}
    </span>
  );
}

export function CentralModule({ 
  labels, 
  employees = [], 
  projects = [], 
  displayProjects = [], 
  subcontractors = [],
  subcontractorCountryCode = "CA",
  regionCountryCode: regionCountryCodeProp,
  taxIdLabel: taxIdLabelProp,
  complianceCertLabel: complianceCertLabelProp,
  clockEntries = [],
  formInstances = [],
  language = "es",
  timeZone: timeZoneProp,
  onAddProject,
  onEditProject,
  onArchiveProject,
  onDeleteProject,
  onAddEmployee,
  onUpdateEmployee,
  onConfirmDeleteEmployee,
  onAddSubcontractor,
  onUpdateSubcontractor,
  onConfirmDeleteSubcontractor,
  onOpenProjectForm,
  onOpenProjectInOperations,
  pendingPhotoCountByProject = {},
  canEdit = true,
  canViewProjects: canViewProjectsProp,
  canCreateProjects: canCreateProjectsProp,
  canEditProjects: canEditProjectsProp,
  canDeleteProjects: canDeleteProjectsProp,
  canManageRoles = false,
  canViewRoles = false,
  canViewAuditLog = false,
  customRoles = [],
  onAddRole,
  onUpdateRole,
  onDeleteRole,
  complianceFields = [],
  complianceRecords = [],
  onComplianceRecordsChange,
  employeeDocs = [],
  onUploadEmployeeDoc,
  onDeleteEmployeeDoc,
  currentUserRole = "admin",
  currentUserEmployeeId = null,
  companyId = null,
  uploadedByDisplayName = "Admin",
  onUpdateEmployeePermissions,
  auditLogs = [],
  complianceAlerts: complianceWatchdogAlerts = [],
  pendingOpenEmployeeId = null,
  onPendingOpenEmployeeHandled,
  companyName = null,
  onNavigateAppSection,
  onQuickNewHazard,
  onQuickNewAction,
  onQuickVisitorQr,
  onNavigateToOperationsVisitors,
  visitorCheckInUrl = null,
  canAccessVisitors = false,
  canAccessHazards = false,
  canAccessCorrective = false,
  canAccessEmployees = false,
  canAccessSubcontractors = false,
  currentUserId = null,
  canViewAttendance = false,
  dashboardCanManageEmployees = false,
  dashboardCanViewTeamClock = false,
  dashboardCanManageComplianceAlerts = false,
  dashboardCanViewLogistics = false,
  dashboardCanViewEmployees = false,
  dashboardCanViewRoles = false,
  dashboardCanViewAuditLog = false,
  dashboardCanViewDashboardWidgets = false,
  dashboardCanViewProjectsManagement = false,
  dashboardCriticalInventoryCount = 0,
  onQuickNewRfi,
  onQuickNewSubcontractor,
  onOpenSubcontractorsInOperations,
  onOpenMyShiftView,
  onProjectsManagementCardClick,
  myShiftCentralCard,
  manualClockEmployeeOptions = [],
  manualClockProjectOptions = [],
  registerManualClockIn,
}: CentralModuleProps) {
  const canViewProjects = canViewProjectsProp ?? canEdit;
  const canCreateProjects = canCreateProjectsProp ?? canEdit;
  const canEditProjects = canEditProjectsProp ?? canEdit;
  const canDeleteProjects = canDeleteProjectsProp ?? canEdit;
  const taxLabel = taxIdLabelProp ?? getTaxIdLabel(subcontractorCountryCode ?? "CA");
  const certLabel = complianceCertLabelProp ?? getComplianceCertLabel(subcontractorCountryCode ?? "CA");
  const timeZone = timeZoneProp ?? resolveUserTimezone(null);
  const countryForDates = (regionCountryCodeProp ?? subcontractorCountryCode) || "CA";
  const dateLoc = useMemo(
    () => dateLocaleForUser(language, countryForDates),
    [language, countryForDates]
  );
  void useMachinProDisplayPrefs();
  const [employeePanelId, setEmployeePanelId] = useState<string | null>(null);
  const [centralView, setCentralView] = useState<
    "dashboard" | "projects" | "personnel" | "roles" | "auditlog" | "compliance"
  >("dashboard");
  const [subcontractorModalOpen, setSubcontractorModalOpen] = useState(false);
  const [editingSubcontractorId, setEditingSubcontractorId] = useState<string | null>(null);
  const [subcontractorDetailId, setSubcontractorDetailId] = useState<string | null>(null);
  const [subcontractorDraft, setSubcontractorDraft] = useState<Partial<Subcontractor>>({});
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingComplianceRecord, setEditingComplianceRecord] = useState<{ field: ComplianceField; targetId: string; targetType: "employee" | "subcontractor" | "vehicle" } | null>(null);
  const [complianceRecordDraft, setComplianceRecordDraft] = useState<{ value?: string; expiryDate?: string; documentUrl?: string }>({});
  const [roleDetailDrawerId, setRoleDetailDrawerId] = useState<string | null>(null);
  const [employeeDocUploadOpen, setEmployeeDocUploadOpen] = useState(false);
  const [projectsMgmtTab, setProjectsMgmtTab] = useState<"active" | "archived">("active");
  const [edDocTitle, setEdDocTitle] = useState("");
  const [edDocType, setEdDocType] = useState<EmployeeDocument["type"]>("other");
  const [edDocExpiry, setEdDocExpiry] = useState("");
  const [edDocNotes, setEdDocNotes] = useState("");
  const [edDocUploading, setEdDocUploading] = useState(false);
  const edDocFileRef = useRef<HTMLInputElement>(null);
  const [roleDraft, setRoleDraft] = useState<{ name: string; color: string; permissions: RolePermissions }>({
    name: "",
    color: "#b45309",
    permissions: emptyRolePermissionsInline(),
  });

  const permLabel = (key: keyof RolePermissions): string => {
    const lx = labels as Record<string, string>;
    const i18n = lx[permLocaleKey(key)];
    return i18n && i18n.trim() !== "" ? i18n : ROLE_PERMISSION_LABELS[key];
  };

  const openCreateRole = () => {
    setEditingRoleId(null);
    setRoleDraft({
      name: "",
      color: "#b45309",
      permissions: emptyRolePermissionsInline(),
    });
    setRoleModalOpen(true);
  };

  const openEditRole = (role: CustomRole) => {
    setEditingRoleId(role.id);
    setRoleDraft({ name: role.name, color: role.color, permissions: { ...role.permissions } });
    setRoleModalOpen(true);
  };

  const togglePerm = (key: keyof RolePermissions) => {
    setRoleDraft((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }));
  };

  const saveRole = async () => {
    if (!roleDraft.name.trim()) return;
    try {
      if (editingRoleId && onUpdateRole) {
        const existing = customRoles.find((r) => r.id === editingRoleId);
        if (existing) {
          await Promise.resolve(
            onUpdateRole({
              ...existing,
              name: roleDraft.name.trim(),
              color: roleDraft.color,
              permissions: roleDraft.permissions,
            })
          );
        }
      } else if (onAddRole) {
        await Promise.resolve(
          onAddRole({
            id: `role-custom-${Date.now()}`,
            name: roleDraft.name.trim(),
            color: roleDraft.color,
            permissions: roleDraft.permissions,
            createdAt: new Date().toISOString(),
          })
        );
      }
      setRoleModalOpen(false);
    } catch (e) {
      console.error("[CentralModule] saveRole", e);
    }
  };

  // PROTECCI?N CR?TICA: Aseguramos que las listas existan antes de usar .slice()
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeDisplayProjects = Array.isArray(displayProjects) ? displayProjects : (safeProjects as CentralProject[]);

  const activeEmployeeIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of safeEmployees) {
      const st = (e.profileStatus ?? "active").toLowerCase().trim();
      if (st === "active") s.add(e.id);
    }
    return s;
  }, [safeEmployees]);

  const getCentralProjectById = (id: string): CentralProject | undefined => {
    const fromProjects = safeProjects.find((p) => p.id === id);
    const fromDisplay = safeDisplayProjects.find((p) => p.id === id);
    if (!fromProjects && !fromDisplay) return undefined;
    return { ...(fromDisplay ?? {}), ...(fromProjects ?? {}) } as CentralProject;
  };

  const projectsManagementList = useMemo(() => {
    const todayYmd = new Date().toISOString().split("T")[0];
    return safeDisplayProjects.filter((p) =>
      projectsMgmtTab === "active" ? isProjectOperationallyActive(p, todayYmd) : !!p.archived
    );
  }, [safeDisplayProjects, projectsMgmtTab]);

  useEffect(() => {
    if (centralView !== "projects" || dashboardCanViewProjectsManagement) return;
    setCentralView("dashboard");
  }, [centralView, dashboardCanViewProjectsManagement]);

  useEffect(() => {
    if (!pendingOpenEmployeeId) return;
    setCentralView("personnel");
    setEmployeePanelId(pendingOpenEmployeeId);
    onPendingOpenEmployeeHandled?.();
  }, [pendingOpenEmployeeId, onPendingOpenEmployeeHandled]);

  const safeSubcontractors = Array.isArray(subcontractors) ? subcontractors : [];

  const projectNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of safeDisplayProjects) m[p.id] = p.name ?? p.id;
    return m;
  }, [safeDisplayProjects]);

  const recentEmployees = safeEmployees.filter((e) => activeEmployeeIdSet.has(e.id)).slice(0, 5);

  const getGreeting = (t: Record<string, string>) => {
    const hour = getClockHourInTimeZone(new Date(), timeZone);
    if (hour < 12) return t.goodMorning ?? "Good morning";
    if (hour < 18) return t.goodAfternoon ?? "Good afternoon";
    return t.goodEvening ?? "Good evening";
  };

  const today = new Date().toISOString().split("T")[0];
  const formattedDate = formatDateLong(new Date(), dateLoc, timeZone);

  const operationalActiveProjects = useMemo(
    () => safeDisplayProjects.filter((p) => isProjectOperationallyActive(p, today)),
    [safeDisplayProjects, today]
  );
  const activeProjectsCountForDashboard = operationalActiveProjects.length;
  const recentProjects = operationalActiveProjects.slice(0, 3);

  const projectsWithBudget = (projects ?? []) as CentralProject[];
  const expiredCerts = safeEmployees.filter((e) =>
    activeEmployeeIdSet.has(e.id) &&
    (e.certificates ?? []).some((c) => {
      if (!c.expiryDate) return (c as { status?: string }).status === "expired";
      const expDate = c.expiryDate.slice(0, 10);
      return expDate <= today;
    })
  );
  const soonCerts = safeEmployees.filter((e) =>
    activeEmployeeIdSet.has(e.id) &&
    (e.certificates ?? []).some((c) => {
      if (!c.expiryDate) return false;
      const days = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 30;
    })
  );
  const overBudgetProjects = projectsWithBudget.filter(
    (p) =>
      isProjectOperationallyActive(p, today) &&
      (p.budgetCAD ?? 0) > 0 &&
      ((p.spentCAD ?? 0) / (p.budgetCAD ?? 1)) > 1
  );
  const nearBudgetProjects = projectsWithBudget.filter((p) => {
    if (!isProjectOperationallyActive(p, today)) return false;
    const budget = p.budgetCAD ?? 0;
    if (budget <= 0) return false;
    const ratio = (p.spentCAD ?? 0) / budget;
    return ratio > 0.8 && ratio <= 1;
  });
  const urgentDeadlines = projectsWithBudget.filter((p) => {
    if (!isProjectOperationallyActive(p, today)) return false;
    if (!p.estimatedEnd) return false;
    const days = Math.ceil((new Date(p.estimatedEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 7;
  });
  const clockedInTodayCount = (clockEntries ?? []).filter(
    (e) =>
      e.date === today &&
      e.clockIn &&
      !!e.employeeId &&
      activeEmployeeIdSet.has(e.employeeId)
  ).length;
  const nowMs = Date.now();
  const formsPendingOver24h = (formInstances ?? []).filter((f) => {
    if (f.status === "completed" || f.status === "approved") return false;
    const created = new Date(f.createdAt).getTime();
    return (nowMs - created) > 24 * 60 * 60 * 1000;
  });
  const pendingForms = (formInstances ?? []).filter((f) => f.status !== "completed" && f.status !== "approved").length;
  const formsCompletedToday = (formInstances ?? []).filter((f) => (f.status === "completed" || f.status === "approved") && (f.date === today || (f.createdAt && f.createdAt.startsWith(today))));

  const complianceRecordAlerts = (complianceRecords ?? []).filter((r) => r.status === "expired" || r.status === "expiring");
  const hasComplianceExpired = complianceRecordAlerts.some((r) => r.status === "expired");

  const watchdogExpiredCount = complianceWatchdogAlerts.filter((a) => a.severity === "expired").length;
  const watchdogCriticalCount = complianceWatchdogAlerts.filter((a) => a.severity === "critical").length;
  const watchdogWarningCount = complianceWatchdogAlerts.filter((a) => a.severity === "warning").length;

  const safeSubcontractorsFull = Array.isArray(subcontractors) ? subcontractors : [];
  const subcontractorsInsuranceExpiring = safeSubcontractorsFull.filter((s) => {
    const exp = s.liabilityInsuranceExpiry;
    if (!exp) return false;
    const days = daysUntilExpiry(exp);
    return days >= 0 && days <= 30;
  });

  const replaceCount = (template: string, count: number) => (template ?? "").replace("{count}", String(count));

  const briefingItems: BriefingItem[] = [];
  if (expiredCerts.length > 0) {
    briefingItems.push({
      type: "red",
      icon: <ShieldOff className="h-5 w-5 text-red-500" />,
      title: labels.expiredCerts ?? "Expired certificates",
      description: replaceCount(
        labels.expiredCertsDescription ?? "{count} employee(s) with expired certificates — require immediate renewal",
        expiredCerts.length
      ),
      count: expiredCerts.length,
      action: () => setCentralView("personnel"),
      actionLabel: labels.viewAll ?? "View all",
    });
  }
  if (overBudgetProjects.length > 0) {
    briefingItems.push({
      type: "red",
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      title: labels.overBudget ?? "Over budget",
      description: replaceCount(
        labels.overBudgetDescription ?? "{count} project(s) have exceeded the assigned budget",
        overBudgetProjects.length
      ),
      count: overBudgetProjects.length,
      action: () => setCentralView("projects"),
      actionLabel: labels.viewAll ?? "View all",
    });
  }
  if (formsPendingOver24h.length > 0) {
    briefingItems.push({
      type: "red",
      icon: <FileCheck className="h-5 w-5 text-red-500" />,
      title: labels.formsPendingSignature ?? "Forms pending signature",
      description: replaceCount(
        labels.formsPendingSignatureDescription ?? "{count} form(s) have been waiting for signature for over 24h",
        formsPendingOver24h.length
      ),
      count: formsPendingOver24h.length,
      actionLabel: labels.viewAll ?? "View all",
    });
  }
  if (complianceRecordAlerts.length > 0) {
    briefingItems.push({
      type: hasComplianceExpired ? "red" : "amber",
      icon: hasComplianceExpired ? <ShieldOff className="h-5 w-5 text-red-500" /> : <ShieldAlert className="h-5 w-5 text-amber-500" />,
      title: (labels as Record<string, string>).complianceAlert ?? "Compliance pending",
      description: replaceCount(
        (labels as Record<string, string>).complianceAlertDescription ??
          "{count} record(s) require attention",
        complianceRecordAlerts.length
      ),
      count: complianceRecordAlerts.length,
    });
  }
  if (subcontractorsInsuranceExpiring.length > 0) {
    briefingItems.push({
      type: "amber",
      icon: <ShieldAlert className="h-5 w-5 text-amber-500" />,
      title: (labels as Record<string, string>).subcontractorInsuranceExpiring ?? "Subcontractor insurance expiring soon",
      description: replaceCount(
        (labels as Record<string, string>).subcontractorInsuranceExpiringDescription ??
          "{count} subcontractor(s) with insurance expiring soon",
        subcontractorsInsuranceExpiring.length
      ),
      count: subcontractorsInsuranceExpiring.length,
      action: () => onOpenSubcontractorsInOperations?.(),
      actionLabel: labels.viewAll ?? "View all",
    });
  }
  if (soonCerts.length > 0) {
    briefingItems.push({
      type: "amber",
      icon: <ShieldAlert className="h-5 w-5 text-amber-500" />,
      title: labels.certsSoonExpiring ?? "Certificates expiring soon",
      description: replaceCount(
        labels.certsSoonExpiringDescription ??
          "{count} employee(s) have certificates expiring in the next 30 days",
        soonCerts.length
      ),
      count: soonCerts.length,
      action: () => setCentralView("personnel"),
      actionLabel: labels.viewAll ?? "View all",
    });
  }
  if (nearBudgetProjects.length > 0) {
    briefingItems.push({
      type: "amber",
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
      title: labels.nearBudget ?? "Near budget limit",
      description: replaceCount(
        labels.nearBudgetDescription ?? "{count} project(s) have consumed over 80% of the budget",
        nearBudgetProjects.length
      ),
      count: nearBudgetProjects.length,
      action: () => setCentralView("projects"),
      actionLabel: labels.viewAll ?? "View all",
    });
  }
  if (urgentDeadlines.length > 0) {
    briefingItems.push({
      type: "amber",
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      title: labels.urgentDeadline ?? "Urgent deadline",
      description: replaceCount(
        labels.urgentDeadlineDescription ?? "{count} project(s) have a delivery date in less than 7 days",
        urgentDeadlines.length
      ),
      count: urgentDeadlines.length,
      action: () => setCentralView("projects"),
      actionLabel: labels.viewAll ?? "View all",
    });
  }
  if (clockedInTodayCount > 0) {
    briefingItems.push({
      type: "green",
      icon: <Users className="h-5 w-5 text-emerald-500" />,
      title: labels.clockedInToday ?? "Employees clocked in today",
      description: replaceCount(
        labels.clockedInTodayDescription ?? "{count} employee(s) have clocked in today",
        clockedInTodayCount
      ),
      count: clockedInTodayCount,
      actionLabel: labels.viewAll ?? "View all",
    });
  }
  if (formsCompletedToday.length > 0) {
    briefingItems.push({
      type: "green",
      icon: <FileCheck className="h-5 w-5 text-emerald-500" />,
      title: labels.formsCompletedToday ?? "Forms completed today",
      description: replaceCount(
        labels.formsCompletedTodayDescription ?? "{count} form(s) completed and signed today",
        formsCompletedToday.length
      ),
      count: formsCompletedToday.length,
      actionLabel: labels.viewAll ?? "View all",
    });
  }
  const activeProjectsNoIssue = operationalActiveProjects.length;
  if (activeProjectsNoIssue > 0 && overBudgetProjects.length === 0 && nearBudgetProjects.length === 0 && urgentDeadlines.length === 0) {
    briefingItems.push({
      type: "green",
      icon: <Briefcase className="h-5 w-5 text-emerald-500" />,
      title: labels.activeProjectsNoIssues ?? "Active projects with no issues",
      description: replaceCount(
        labels.activeProjectsNoIssuesDescription ?? "{count} active project(s) with no alerts or issues",
        activeProjectsNoIssue
      ),
      count: activeProjectsNoIssue,
      action: () => setCentralView("projects"),
      actionLabel: labels.viewAll ?? "View all",
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {centralView !== "dashboard" && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCentralView("dashboard")}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 min-h-[44px]"
          >
            <ChevronLeft className="h-4 w-4" />{" "}
            {(labels as Record<string, string>).nav_back ?? labels.back ?? "Back"}
          </button>
        </div>
      )}

      {centralView === "dashboard" && (
        <>
          {companyId && onNavigateAppSection ? (
            <div className="space-y-6">
              <CentralDashboardLive
                labels={labels}
                companyId={companyId}
                companyName={companyName ?? undefined}
                language={language}
                countryCode={countryForDates}
                timeZone={timeZone}
                activeProjectsCount={activeProjectsCountForDashboard}
                canViewProjectsManagement={dashboardCanViewProjectsManagement}
                projectNameById={projectNameById}
                currentUserRole={currentUserRole}
                canManageRoles={canManageRoles}
                canViewRoles={canViewRoles}
                canManageEmployees={dashboardCanManageEmployees}
                canViewEmployees={dashboardCanViewEmployees}
                canViewAuditLog={dashboardCanViewAuditLog}
                canViewTeamClock={dashboardCanViewTeamClock}
                canManageComplianceAlerts={dashboardCanManageComplianceAlerts}
                canViewLogistics={dashboardCanViewLogistics}
                canViewDashboardWidgets={dashboardCanViewDashboardWidgets}
                criticalInventoryCount={dashboardCriticalInventoryCount}
                canAccessVisitors={canAccessVisitors}
                canAccessHazards={canAccessHazards}
                canAccessCorrective={canAccessCorrective}
                onNavigateAppSection={onNavigateAppSection}
                onOpenAuditInCentral={() => {
                  if (dashboardCanManageEmployees || dashboardCanViewAuditLog) setCentralView("auditlog");
                }}
                onOpenRolesInCentral={() => {
                  if (canManageRoles || canViewRoles) setCentralView("roles");
                }}
                customRolesCount={customRoles.length}
                complianceWatchdogCount={complianceWatchdogAlerts.length}
                onOpenComplianceInCentral={
                  complianceWatchdogAlerts.length > 0
                    ? () => setCentralView("compliance")
                    : undefined
                }
                onQuickNewHazard={onQuickNewHazard ?? (() => undefined)}
                onQuickNewAction={onQuickNewAction ?? (() => undefined)}
                onQuickVisitorQr={onQuickVisitorQr ?? (() => undefined)}
                onNavigateToOperationsVisitors={onNavigateToOperationsVisitors}
                visitorCheckInUrl={visitorCheckInUrl}
                canAccessEmployees={canAccessEmployees}
                currentUserId={currentUserId}
                onQuickNewEmployee={onAddEmployee}
                onQuickNewRfi={onQuickNewRfi}
                onQuickNewSubcontractor={onQuickNewSubcontractor}
                onOpenSubcontractorsInOperations={onOpenSubcontractorsInOperations}
                onOpenMyShiftView={onOpenMyShiftView}
                onProjectsManagementCardClick={onProjectsManagementCardClick ?? (() => setCentralView("projects"))}
                myShiftCentralCard={myShiftCentralCard}
                manualClockEmployeeOptions={manualClockEmployeeOptions}
                manualClockProjectOptions={manualClockProjectOptions}
                registerManualClockIn={registerManualClockIn}
              />
            </div>
          ) : (
            <section className="space-y-2 mb-2">
              <p className="text-lg font-medium text-zinc-900 dark:text-white">
                {getGreeting(labels)} — {formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}
              </p>
            </section>
          )}

          {pendingForms > 0 && (
            <section className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/25 px-4 py-3">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                {pendingForms} {labels.formsPendingSignature ?? ""}
              </p>
            </section>
          )}
        </>
      )}
      {centralView === "auditlog" && (dashboardCanManageEmployees || dashboardCanViewAuditLog) && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-white/10">
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              {(labels as Record<string, string>).auditLog ?? ""}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {(labels as Record<string, string>).auditLogDesc ?? ""}
            </p>
          </div>
          <div>
            {auditLogs.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400 italic">
                {(labels as Record<string, string>).auditNoLogs ?? ""}
              </p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50">
                        <th className="w-12 py-3 px-2" aria-hidden />
                        <th className="text-left py-3 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                          {(labels as Record<string, string>).auditWhen ?? (labels as Record<string, string>).date ?? "Fecha"}
                        </th>
                        <th className="text-left py-3 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                          {(labels as Record<string, string>).auditActionColumn ?? (labels as Record<string, string>).actions ?? "Acción"}
                        </th>
                        <th className="text-left py-3 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                          {(labels as Record<string, string>).auditUserColumn ?? (labels as Record<string, string>).sessionRole ?? "Usuario"}
                        </th>
                        <th className="text-left py-3 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                          {(labels as Record<string, string>).auditEntityColumn ?? (labels as Record<string, string>).entity ?? "Entidad"}
                        </th>
                        <th className="text-left py-3 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                          {(labels as Record<string, string>).auditTypeColumn ?? (labels as Record<string, string>).category ?? "Tipo"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((row) => {
                        const tl = labels as Record<string, string>;
                        const when = formatDateTime(row.created_at, dateLoc, timeZone);
                        const actionIcon =
                          row.action === "photo_downloaded" || row.action === "photos_bulk_downloaded" ? (
                            <Download className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
                          ) : row.action.startsWith("photo_") ? (
                            <Camera className="h-4 w-4 text-amber-600" aria-hidden />
                          ) : row.action.startsWith("employee_") ? (
                            <Users className="h-4 w-4 text-blue-600" aria-hidden />
                          ) : row.action.startsWith("document_") ? (
                            <FileText className="h-4 w-4 text-zinc-600" aria-hidden />
                          ) : row.action === "inspection_report_generated" ? (
                            <FileText className="h-4 w-4 text-amber-600" aria-hidden />
                          ) : (
                            <Shield className="h-4 w-4 text-zinc-500" aria-hidden />
                          );
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30"
                          >
                            <td className="py-3 px-2">{actionIcon}</td>
                            <td className="py-3 px-3 text-sm text-zinc-700 dark:text-zinc-200 whitespace-nowrap">
                              {when}
                            </td>
                            <td className="py-3 px-3 text-sm text-zinc-800 dark:text-zinc-100">
                              {getAuditActionLabel(row.action, row.entity_type, tl)}
                            </td>
                            <td className="py-3 px-3 text-sm text-zinc-600 dark:text-zinc-300">
                              {row.user_name ?? row.user_id ?? "—"}
                            </td>
                            <td className="py-3 px-3 text-sm text-zinc-700 dark:text-zinc-200 max-w-[200px] truncate" title={row.entity_name ?? row.entity_id}>
                              {row.entity_name ?? row.entity_id}
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                {getAuditEntityTypeLabel(row.entity_type, tl)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="md:hidden divide-y divide-zinc-100 dark:divide-white/10">
                  {auditLogs.map((row) => {
                    const tl = labels as Record<string, string>;
                    const when = formatDateTime(row.created_at, dateLoc, timeZone);
                    const actionIcon =
                      row.action === "photo_downloaded" || row.action === "photos_bulk_downloaded" ? (
                        <Download className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                      ) : row.action.startsWith("photo_") ? (
                        <Camera className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                      ) : row.action.startsWith("employee_") ? (
                        <Users className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                      ) : row.action.startsWith("document_") ? (
                        <FileText className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                      ) : row.action === "inspection_report_generated" ? (
                        <FileText className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                      ) : (
                        <Shield className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                      );
                    return (
                      <li key={row.id} className="p-4 flex gap-3">
                        <div className="pt-0.5">{actionIcon}</div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                            {getAuditActionLabel(row.action, row.entity_type, tl)}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {(row.user_name ?? row.user_id ?? "—") + " · " + when}
                          </p>
                          {(row.entity_name ?? row.entity_id) ? (
                            <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate" title={row.entity_name ?? row.entity_id}>
                              {row.entity_name ?? row.entity_id}
                            </p>
                          ) : null}
                          <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {getAuditEntityTypeLabel(row.entity_type, tl)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {centralView === "compliance" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {(labels as Record<string, string>).complianceWatchdog ?? "Compliance Watchdog"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {(labels as Record<string, string>).complianceWatchdogDesc ?? ""}
            </p>
          </div>
          {complianceWatchdogAlerts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              {(labels as Record<string, string>).certsUpToDate ?? (labels as Record<string, string>).noNotifications ?? ""}
            </p>
          ) : (
            <>
              {watchdogExpiredCount > 0 && (
                <section className="space-y-3" aria-labelledby="compliance-expired-heading">
                  <h4 id="compliance-expired-heading" className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
                    <span aria-hidden>🔴</span>
                    {(labels as Record<string, string>).complianceGroupExpired ?? (labels as Record<string, string>).certExpired ?? ""}
                  </h4>
                  <ul className="space-y-2">
                    {complianceWatchdogAlerts
                      .filter((a) => a.severity === "expired")
                      .map((a) => {
                        const tl = labels as Record<string, string>;
                        const expStr = formatDateMedium(new Date(a.expiryDate), dateLoc, timeZone);
                        const overdue = Math.abs(a.daysLeft);
                        return (
                          <li
                            key={`exp-${a.employeeId}-${a.certName}-${a.expiryDate}`}
                            className="flex flex-col gap-3 rounded-xl border border-red-200/80 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 flex-1 gap-3">
                              <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-200/80 text-sm font-bold text-red-900 dark:bg-red-900/50 dark:text-red-100"
                                aria-hidden
                              >
                                {initialsFromName(a.employeeName)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-zinc-900 dark:text-white">{a.employeeName}</p>
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">{a.certName}</p>
                                <p className="text-xs text-red-700 dark:text-red-300">
                                  {overdue} {tl.certDaysOverdue ?? ""} · {tl.expiresOn ?? ""} {expStr}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setCentralView("personnel");
                                setEmployeePanelId(a.employeeId);
                              }}
                              className="min-h-[44px] shrink-0 rounded-lg border border-red-300/80 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-200 dark:hover:bg-red-950/40"
                            >
                              {tl.viewEmployee ?? ""}
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              )}
              {watchdogCriticalCount > 0 && (
                <section className="space-y-3" aria-labelledby="compliance-critical-heading">
                  <h4 id="compliance-critical-heading" className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                    <span aria-hidden>🟠</span>
                    {(labels as Record<string, string>).complianceGroupCritical ?? (labels as Record<string, string>).certCritical ?? ""}
                  </h4>
                  <ul className="space-y-2">
                    {complianceWatchdogAlerts
                      .filter((a) => a.severity === "critical")
                      .map((a) => {
                        const tl = labels as Record<string, string>;
                        const expStr = formatDateMedium(new Date(a.expiryDate), dateLoc, timeZone);
                        return (
                          <li
                            key={`crit-${a.employeeId}-${a.certName}-${a.expiryDate}`}
                            className="flex flex-col gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 flex-1 gap-3">
                              <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-sm font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                                aria-hidden
                              >
                                {initialsFromName(a.employeeName)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-zinc-900 dark:text-white">{a.employeeName}</p>
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">{a.certName}</p>
                                <p className="text-xs text-amber-800 dark:text-amber-200">
                                  {a.daysLeft} {tl.certDaysLeft ?? ""} · {tl.expiresOn ?? ""} {expStr}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setCentralView("personnel");
                                setEmployeePanelId(a.employeeId);
                              }}
                              className="min-h-[44px] shrink-0 rounded-lg border border-amber-300/80 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-100 dark:hover:bg-amber-950/40"
                            >
                              {tl.viewEmployee ?? ""}
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              )}
              {watchdogWarningCount > 0 && (
                <section className="space-y-3" aria-labelledby="compliance-warning-heading">
                  <h4 id="compliance-warning-heading" className="flex items-center gap-2 text-sm font-semibold text-yellow-900 dark:text-yellow-200">
                    <span aria-hidden>🟡</span>
                    {(labels as Record<string, string>).complianceGroupWarning ?? (labels as Record<string, string>).certWarning ?? ""}
                  </h4>
                  <ul className="space-y-2">
                    {complianceWatchdogAlerts
                      .filter((a) => a.severity === "warning")
                      .map((a) => {
                        const tl = labels as Record<string, string>;
                        const expStr = formatDateMedium(new Date(a.expiryDate), dateLoc, timeZone);
                        return (
                          <li
                            key={`warn-${a.employeeId}-${a.certName}-${a.expiryDate}`}
                            className="flex flex-col gap-3 rounded-xl border border-yellow-200/80 bg-yellow-50/40 p-4 dark:border-yellow-900/30 dark:bg-yellow-950/10 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 flex-1 gap-3">
                              <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-yellow-200/80 text-sm font-bold text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100"
                                aria-hidden
                              >
                                {initialsFromName(a.employeeName)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-zinc-900 dark:text-white">{a.employeeName}</p>
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">{a.certName}</p>
                                <p className="text-xs text-yellow-900/90 dark:text-yellow-200/90">
                                  {a.daysLeft} {tl.certDaysLeft ?? ""} · {tl.expiresOn ?? ""} {expStr}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setCentralView("personnel");
                                setEmployeePanelId(a.employeeId);
                              }}
                              className="min-h-[44px] shrink-0 rounded-lg border border-yellow-300/80 bg-white px-4 py-2 text-sm font-medium text-yellow-900 hover:bg-yellow-50 dark:border-yellow-800 dark:bg-zinc-900 dark:text-yellow-100 dark:hover:bg-yellow-950/30"
                            >
                              {tl.viewEmployee ?? ""}
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {centralView === "roles" && (canManageRoles || canViewRoles) && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-white/10 flex flex-wrap justify-between items-center gap-3">
            <h3 className="font-semibold">{labels.roles ?? "Roles"}</h3>
            {canManageRoles && onAddRole && (
              <button type="button" onClick={openCreateRole} className="flex items-center gap-1.5 rounded-lg bg-amber-600 dark:bg-amber-500 text-white px-3 py-2.5 text-sm font-medium hover:bg-amber-500 dark:hover:bg-amber-400 min-h-[44px]">
                <Plus className="h-4 w-4" />{" "}
                {(labels as Record<string, string>).create_role ?? labels.createRole ?? "Crear rol"}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400 w-12"></th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">{labels.roleName ?? "Nombre"}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">{labels.rolePermissions ?? "Permisos activos"}</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">{labels.actions ?? "Acciones"}</th>
                </tr>
              </thead>
              <tbody>
                {customRoles.map((role) => {
                  const count = ROLE_PERMISSION_KEYS.filter((k) => role.permissions[k]).length;
                  const base = isProtectedCustomRole(role);
                  return (
                    <tr
                      key={role.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setRoleDetailDrawerId(role.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setRoleDetailDrawerId(role.id);
                        }
                      }}
                      className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <span
                          className="inline-block w-6 h-6 rounded-full border-2 border-white dark:border-zinc-800 shadow"
                          style={{ backgroundColor: role.color }}
                          title={role.color}
                        />
                      </td>
                      <td className="py-3 px-4 font-medium">{role.name}</td>
                      <td className="py-3 px-4 text-sm text-zinc-500">{count}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManageRoles ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditRole(role);
                            }}
                            className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title={labels.editRole ?? "Editar"}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          ) : null}
                          {base ? (
                            <span
                              className="p-2.5 rounded-lg text-zinc-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title={labels.roleBaseCannotDelete ?? "Los roles base no se pueden eliminar"}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Lock className="h-4 w-4" />
                            </span>
                          ) : (
                            canManageRoles &&
                            onDeleteRole && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (typeof window !== "undefined" && window.confirm(labels.confirmDeleteRole ?? "?Eliminar este rol?")) onDeleteRole(role.id);
                                }}
                                className="p-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                title={labels["delete"] ?? "Eliminar"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {roleDetailDrawerId && (() => {
        const drawerRole = customRoles.find((r) => r.id === roleDetailDrawerId);
        if (!drawerRole) return null;
        const tl = labels as Record<string, string>;
        const activeKeys = ROLE_PERMISSION_KEYS.filter((k) => drawerRole.permissions[k]);
        const withRole = safeEmployees.filter(
          (e) => e.customRoleId === drawerRole.id || e.role === drawerRole.name
        );
        return (
          <>
            <div
              className="fixed inset-0 z-[55] bg-black/50 touch-none"
              aria-hidden
              onClick={() => setRoleDetailDrawerId(null)}
            />
            <div
              className="
                fixed z-[56] bg-white dark:bg-slate-900
                border border-zinc-200 dark:border-slate-700 shadow-xl
                overflow-y-auto
                inset-x-0 bottom-0 rounded-t-2xl max-h-[90vh]
                sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto
                sm:w-full sm:max-w-lg sm:rounded-none sm:rounded-l-2xl sm:max-h-full
              "
            >
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-slate-600" />
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-flex h-10 w-10 shrink-0 rounded-full border-2 border-white dark:border-zinc-800 shadow"
                    style={{ backgroundColor: drawerRole.color }}
                  />
                  <h4 className="text-base font-semibold text-zinc-900 dark:text-white truncate">{drawerRole.name}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleDetailDrawerId(null)}
                  className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-6">
                <div>
                  <h5 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
                    {tl.activePermissions ?? "Active permissions"}
                  </h5>
                  {activeKeys.length === 0 ? (
                    <p className="text-sm text-zinc-400 italic">—</p>
                  ) : (
                    <ul className="space-y-2">
                      {activeKeys.map((key) => (
                        <li key={key} className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          <span>{permLabel(key)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
                    {tl.employeesWithRole ?? "Employees with this role"}
                  </h5>
                  {withRole.length === 0 ? (
                    <p className="text-sm text-zinc-400 italic">{tl.noEmployeesWithRole ?? "—"}</p>
                  ) : (
                    <ul className="space-y-2">
                      {withRole.map((e) => (
                        <li key={e.id} className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs font-bold">
                            {(e.name ?? "?").charAt(0)}
                          </span>
                          <span className="truncate">{e.name ?? e.id}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {onUpdateRole && (
                  <button
                    type="button"
                    onClick={() => {
                      openEditRole(drawerRole);
                      setRoleDetailDrawerId(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-200 min-h-[44px]"
                  >
                    <Pencil className="h-4 w-4" />
                    {labels.editRole ?? "Editar rol"}
                  </button>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {centralView === "projects" && dashboardCanViewProjectsManagement && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-white/10 flex flex-wrap justify-between items-center gap-3">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              {(labels as Record<string, string>).projects_management ?? "Project management"}
            </h3>
            {canCreateProjects && onAddProject ? (
              <button
                type="button"
                onClick={onAddProject}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2.5 text-sm font-medium text-white hover:bg-orange-600 dark:hover:bg-orange-500 min-h-[44px] min-w-[44px]"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">
                  {(labels as Record<string, string>).projects_new ?? "New project"}
                </span>
              </button>
            ) : null}
          </div>
          <div className="border-b border-zinc-200 dark:border-white/10 px-2 sm:px-4">
            <HorizontalScrollFade className="-mx-2 px-2 sm:mx-0 sm:px-0" variant="inherit">
              <div className="flex gap-1 min-h-[48px] items-stretch">
                <button
                  type="button"
                  onClick={() => setProjectsMgmtTab("active")}
                  className={`shrink-0 rounded-t-lg px-4 py-3 text-sm font-medium min-h-[44px] border-b-2 transition-colors ${
                    projectsMgmtTab === "active"
                      ? "border-[#f97316] text-zinc-900 dark:text-white"
                      : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {(labels as Record<string, string>).projects_active ?? "Active"}
                </button>
                <button
                  type="button"
                  onClick={() => setProjectsMgmtTab("archived")}
                  className={`shrink-0 rounded-t-lg px-4 py-3 text-sm font-medium min-h-[44px] border-b-2 transition-colors ${
                    projectsMgmtTab === "archived"
                      ? "border-[#f97316] text-zinc-900 dark:text-white"
                      : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {(labels as Record<string, string>).projects_archived ?? "Archived"}
                </button>
              </div>
            </HorizontalScrollFade>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-white/10">
            {projectsManagementList.length === 0 ? (
              <p className="p-8 text-center text-zinc-500 dark:text-zinc-400 italic text-sm">
                {projectsMgmtTab === "active"
                  ? (labels as Record<string, string>).projects_no_active ?? "No active projects"
                  : (labels as Record<string, string>).projects_no_archived ?? "No archived projects"}
              </p>
            ) : (
              projectsManagementList.map((project) => {
                  const p = getCentralProjectById(project.id) ?? (project as CentralProject);
                  const tl = labels as Record<string, string>;
                  const life = resolveProjectLifecycleStatus(p, today);
                  const startStr = formatProjectListDate(p.estimatedStart, dateLoc, timeZone);
                  const nEmp = (p.assignedEmployeeIds ?? []).length;
                  const statusText =
                    life === "paused"
                      ? tl.projects_status_paused ?? "Paused"
                      : life === "completed"
                        ? tl.projects_status_completed ?? "Completed"
                        : tl.projects_status_active ?? "Active";
                  const statusClass =
                    life === "paused"
                      ? "bg-amber-100 dark:bg-amber-900/35 text-amber-900 dark:text-amber-200"
                      : life === "completed"
                        ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                        : "bg-emerald-100 dark:bg-emerald-900/35 text-emerald-900 dark:text-emerald-200";
                  return (
                    <div
                      key={project.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="font-medium text-zinc-900 dark:text-white">{p.name ?? "—"}</p>
                        {p.location ? (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{p.location}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                          <span className="inline-flex items-center gap-1" title={tl.projectFormDateStart ?? ""}>
                            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span>{startStr}</span>
                          </span>
                          <span
                            className="inline-flex items-center gap-1"
                            title={tl.teamMembers ?? tl.project_kpi_team ?? ""}
                          >
                            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span>{nEmp}</span>
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
                          >
                            {statusText}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0 sm:justify-end">
                        {onOpenProjectInOperations &&
                        (canViewProjects || canCreateProjects || currentUserRole === "admin") ? (
                          <button
                            type="button"
                            onClick={() => onOpenProjectInOperations(p)}
                            className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-500 dark:bg-amber-500 sm:flex-none"
                          >
                            {tl.projects_view_detail ?? "View detail"}
                          </button>
                        ) : null}
                        {canEditProjects && onEditProject ? (
                          <button
                            type="button"
                            onClick={() => onEditProject(project.id)}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-zinc-300 bg-white p-2.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-300 dark:hover:bg-slate-700"
                            title={labels.edit ?? "Edit"}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        {canDeleteProjects && onArchiveProject ? (
                          <button
                            type="button"
                            onClick={() => onArchiveProject(project.id)}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-zinc-600 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
                          >
                            {p.archived
                              ? tl.projects_unarchive ?? "Unarchive"
                              : tl.projects_archive ?? "Archive"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                 );
              })
            )}
          </div>
        </div>
      )}

      {centralView === "personnel" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4" />
                {labels.personnel ?? labels.recentStaff ?? "Personal"}
              </h3>
              {canEdit && onAddEmployee && (
                <button type="button" onClick={onAddEmployee} className="flex items-center gap-2 rounded-lg bg-amber-600 dark:bg-amber-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-amber-500 dark:hover:bg-amber-600 min-h-[44px]">
                  <UserPlus className="h-4 w-4" />
                  {labels.addNew ?? "A?adir empleado"}
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-white/10">
            {(safeEmployees ?? []).length === 0 ? (
              <p className="p-8 text-center text-zinc-500 italic text-sm">{labels.noStaff ?? "No hay personal registrado"}</p>
            ) : (
              (safeEmployees ?? []).map((emp) => {
                const certs = emp.certificates ?? [];
                const status = getTrainingStatus(certs);
                const certLabel = certs.length === 0 ? (labels.securityNoCerts ?? "Sin certificados") : `${certs.length} ${labels.certificates ?? "certificados"}`;
                return (
                  <div
                    key={emp.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEmployeePanelId(emp.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEmployeePanelId(emp.id); } }}
                    className="p-4 flex items-center justify-between gap-3 min-h-[64px] cursor-pointer hover:bg-zinc-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold">{(emp.name ?? "").charAt(0) || "?"}</div>
                      <div>
                        <p className="text-sm font-medium">{emp.name ?? "?"}</p>
                        <p className="text-xs text-zinc-500">{emp.role ?? ""}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{certLabel}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${status === "al_dia" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : status === "pendiente" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"}`}>
                      {status === "al_dia" && <ShieldCheck className="h-3 w-3" />}
                      {status === "pendiente" && <ShieldAlert className="h-3 w-3" />}
                      {status === "sin_certs" && <ShieldOff className="h-3 w-3" />}
                      {status === "al_dia" ? (labels.upToDate ?? labels.securityOk ?? "Al d?a") : status === "pendiente" ? (labels.pending ?? labels.securityPending ?? "Pendiente") : (labels.withoutCerts ?? labels.securityNoCerts ?? "Sin certificados")}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {employeePanelId && (() => {
        const emp = (safeEmployees ?? []).find((e) => e.id === employeePanelId);
        if (!emp) return null;
        const certs = emp.certificates ?? [];
        const t = labels;
        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 touch-none"
              aria-hidden
              onClick={() => setEmployeePanelId(null)}
            />
            <div className="
              fixed z-50 bg-white dark:bg-slate-900
              border border-zinc-200 dark:border-slate-700 shadow-xl
              overflow-y-auto
              inset-x-0 bottom-0 rounded-t-2xl max-h-[90vh]
              sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto
              sm:w-full sm:max-w-lg sm:rounded-none sm:rounded-l-2xl sm:max-h-full
            ">
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-slate-600" />
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-sm font-bold text-amber-700 dark:text-amber-400 shrink-0">
                    {emp.name?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-zinc-900 dark:text-white leading-tight">
                      {emp.name ?? "?"}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{emp.role ?? ""}</p>
                    {emp.customRoleId && (() => {
                      const role = customRoles.find((r) => r.id === emp.customRoleId);
                      return role ? (
                        <span
                          style={{ backgroundColor: role.color }}
                          className="inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        >
                          {role.name}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmployeePanelId(null)}
                  className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-zinc-50 dark:bg-slate-800/50 px-4 py-3">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">
                      {t.hoursLogged ?? "Horas / mes"}
                    </p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {emp.hours ?? 0}h
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-50 dark:bg-slate-800/50 px-4 py-3">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">
                      {t.certificates ?? "Certificados"}
                    </p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {certs.length}
                    </p>
                  </div>
                </div>

                {emp.payType && (
                  <div className="px-6 py-3 border-t border-zinc-100 dark:border-slate-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Tipo de pago</p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {emp.payType === "hourly"
                        ? `${emp.hourlyRate ?? "?"} CAD/h`
                        : `${emp.monthlySalary ?? "?"} CAD/mes`}
                    </p>
                  </div>
                )}

                {(emp.phone || emp.email) && (
                  <div className="space-y-1.5">
                    {emp.phone && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        <span className="text-zinc-400 dark:text-zinc-500 mr-2">{(labels as Record<string, string>).phone ?? "Tel?fono"}</span>
                        {emp.phone}
                      </p>
                    )}
                    {emp.email && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        <span className="text-zinc-400 dark:text-zinc-500 mr-2">Email</span>
                        {emp.email}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <h5 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
                    {t.certificates ?? "Certificados de seguridad"}
                  </h5>

                  {certs.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800/40 px-4 py-6 text-center">
                      <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
                        Sin certificados registrados
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(certs ?? []).map((c) => {
                        const state = certSemaphore(c.expiryDate);
                        const days  = c.expiryDate ? daysUntilExpiry(c.expiryDate) : null;
                        const rowClass =
                          state === "expired"
                            ? "border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20"
                            : state === "soon"
                            ? "border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20"
                            : "border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900";
                        const dot =
                          state === "expired" ? "??"
                          : state === "soon"  ? "??"
                          : state === "ok"    ? "??"
                          : "?";
                        const expiryText =
                          state === "expired"
                            ? `VENCIDO ? ${c.expiryDate}`
                            : state === "soon"
                            ? `? Vence en ${days} d?a${days !== 1 ? "s" : ""}`
                            : c.expiryDate
                            ? `OK Vence: ${c.expiryDate}`
                            : "Sin fecha de vencimiento";
                        const textColor =
                          state === "expired"
                            ? "text-red-600 dark:text-red-400 font-semibold"
                            : state === "soon"
                            ? "text-amber-600 dark:text-amber-400 font-medium"
                            : "text-zinc-500 dark:text-zinc-400";
                        return (
                          <div
                            key={c.id}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${rowClass}`}
                          >
                            <span className="text-base shrink-0" aria-hidden>{dot}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                {c.name}
                              </p>
                              <p className={`text-xs ${textColor}`}>{expiryText}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-slate-700">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                      Estado global
                    </p>
                    {(() => {
                      const st = getTrainingStatus(certs);
                      if (st === "sin_certs") return (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          ? Sin certificados
                        </span>
                      );
                      if (st === "pendiente") return (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                          ?? Pendiente ? hay certificados vencidos
                        </span>
                      );
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          ?? Al d?a ? todos los certificados vigentes
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {(complianceFields ?? []).filter((f) => f.target.includes("employee")).length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
                      {t.compliance ?? "Compliance"}
                    </h5>
                    <div className="space-y-0">
                      {(complianceFields ?? [])
                        .filter((f) => f.target.includes("employee"))
                        .map((field) => {
                          const record = (complianceRecords ?? []).find(
                            (r) => r.fieldId === field.id && r.targetType === "employee" && r.targetId === emp.id
                          );
                          return (
                            <div
                              key={field.id}
                              className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0"
                            >
                              <div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{field.name}</p>
                                {record?.expiryDate && (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {(t as Record<string, string>).expiresOn ?? "Vence"}: {record.expiryDate}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {getComplianceStatusBadge(record, t as Record<string, string>)}
                                {canEdit && onComplianceRecordsChange && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingComplianceRecord({ field, targetId: emp.id, targetType: "employee" });
                                      const r = record;
                                      setComplianceRecordDraft({
                                        value: r?.value,
                                        expiryDate: r?.expiryDate,
                                        documentUrl: r?.documentUrl,
                                      });
                                    }}
                                    className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {(() => {
                  const tl = t as Record<string, string>;
                  const role = currentUserRole;
                  if (role === "logistic") return null;
                  if (role === "worker" && emp.id !== (currentUserEmployeeId ?? "")) return null;
                  const docsForEmp = (employeeDocs ?? []).filter(
                    (d) => d.employeeId === emp.id && (!companyId || d.companyId === companyId)
                  );
                  const isDocAdmin = role === "admin";
                  return (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h5 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                            {tl.employeeDocs ?? "Documents"}
                          </h5>
                          {isDocAdmin && onUploadEmployeeDoc && (
                            <button
                              type="button"
                              onClick={() => {
                                setEdDocTitle("");
                                setEdDocType("other");
                                setEdDocExpiry("");
                                setEdDocNotes("");
                                if (edDocFileRef.current) edDocFileRef.current.value = "";
                                setEmployeeDocUploadOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200 min-h-[44px] min-w-[44px]"
                            >
                              <Plus className="h-4 w-4 shrink-0" />
                              {tl.uploadDoc ?? "Upload"}
                            </button>
                          )}
                        </div>
                        {docsForEmp.length === 0 ? (
                          <p className="text-sm text-zinc-400 dark:text-zinc-500 italic py-2">
                            {tl.noEmployeeDocs ?? "—"}
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {docsForEmp.map((doc) => (
                              <li
                                key={doc.id}
                                className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800/40 px-3 py-3"
                              >
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <span className="shrink-0 mt-0.5 text-zinc-500">
                                    {doc.fileType === "pdf" ? (
                                      <FileText className="h-5 w-5" aria-hidden />
                                    ) : (
                                      <Image className="h-5 w-5" aria-hidden />
                                    )}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                      {doc.title}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      <span className="inline-flex rounded-full bg-zinc-200/80 dark:bg-slate-600 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-200">
                                        {employeeDocTypeLabel(doc.type, tl)}
                                      </span>
                                      {doc.expiryDate && (
                                        <span className={`text-xs ${employeeDocExpiryTextClass(doc.expiryDate)}`}>
                                          {daysUntilExpiry(doc.expiryDate) < 0
                                            ? `${tl.docExpired ?? "Expired"} · ${doc.expiryDate}`
                                            : `${tl.docExpiry ?? "Expires"}: ${doc.expiryDate}`}
                                        </span>
                                      )}
                                    </div>
                                    {doc.notes && (
                                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{doc.notes}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (typeof window !== "undefined") window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
                                    }}
                                    className="inline-flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 min-h-[44px] min-w-[44px]"
                                  >
                                    {tl.docView ?? "View"}
                                  </button>
                                  {isDocAdmin && onDeleteEmployeeDoc && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteEmployeeDoc(doc.id)}
                                      className="inline-flex items-center justify-center rounded-lg bg-red-600 text-white p-2.5 min-h-[44px] min-w-[44px]"
                                      aria-label={tl["delete"] ?? "Delete"}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {employeeDocUploadOpen && isDocAdmin && onUploadEmployeeDoc && (
                        <>
                          <div
                            className="fixed inset-0 z-[60] bg-black/50"
                            aria-hidden
                            onClick={() => !edDocUploading && setEmployeeDocUploadOpen(false)}
                          />
                          <div
                            className="fixed z-[61] left-4 right-4 bottom-4 sm:left-auto sm:top-1/2 sm:-translate-y-1/2 sm:right-4 sm:bottom-auto sm:max-w-md w-auto max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-5 space-y-4"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="employee-doc-upload-title"
                          >
                            <h4 id="employee-doc-upload-title" className="text-base font-semibold text-zinc-900 dark:text-white">
                              {tl.uploadDoc ?? "Upload"}
                            </h4>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              {tl.docTitle ?? "Title"}
                              <input
                                type="text"
                                value={edDocTitle}
                                onChange={(e) => setEdDocTitle(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[44px]"
                              />
                            </label>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              {tl.category ?? "Type"}
                              <select
                                value={edDocType}
                                onChange={(e) => setEdDocType(e.target.value as EmployeeDocument["type"])}
                                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[44px]"
                              >
                                <option value="contract">{tl.docTypeContract ?? "contract"}</option>
                                <option value="certificate">{tl.docTypeCertificate ?? "certificate"}</option>
                                <option value="id">{tl.docTypeId ?? "id"}</option>
                                <option value="training">{tl.docTypeTraining ?? "training"}</option>
                                <option value="medical">{tl.docTypeMedical ?? "medical"}</option>
                                <option value="other">{tl.docTypeOther ?? "other"}</option>
                              </select>
                            </label>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              {tl.docExpiryDate ?? "Expiry"}
                              <input
                                type="date"
                                value={edDocExpiry}
                                onChange={(e) => setEdDocExpiry(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[44px]"
                              />
                            </label>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              {tl.docNotes ?? "Notes"}
                              <textarea
                                value={edDocNotes}
                                onChange={(e) => setEdDocNotes(e.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              {tl.docFile ?? "File"}
                              <input
                                ref={edDocFileRef}
                                type="file"
                                accept="application/pdf,image/*"
                                className="mt-1 w-full text-sm min-h-[44px]"
                              />
                            </label>
                            <div className="flex flex-wrap gap-2 justify-end pt-2">
                              <button
                                type="button"
                                disabled={edDocUploading}
                                onClick={() => !edDocUploading && setEmployeeDocUploadOpen(false)}
                                className="rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium min-h-[44px]"
                              >
                                {tl.back ?? "Back"}
                              </button>
                              <button
                                type="button"
                                disabled={edDocUploading || !edDocTitle.trim()}
                                onClick={async () => {
                                  const file = edDocFileRef.current?.files?.[0];
                                  if (!file || !onUploadEmployeeDoc) return;
                                  setEdDocUploading(true);
                                  try {
                                    const isPdf =
                                      file.type === "application/pdf" ||
                                      file.name.toLowerCase().endsWith(".pdf");
                                    const resourceType = isPdf ? "raw" : "image";
                                    const cloudName =
                                      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "dwdlmxmkt";
                                    const preset =
                                      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "i5dmd07o";
                                    const fd = new FormData();
                                    fd.append("file", file);
                                    fd.append("upload_preset", preset);
                                    const res = await fetch(
                                      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
                                      { method: "POST", body: fd }
                                    );
                                    const data = (await res.json()) as { secure_url?: string };
                                    const url = data.secure_url;
                                    if (!url) throw new Error("upload failed");
                                    const companyIdVal = companyId ?? "local";
                                    onUploadEmployeeDoc({
                                      employeeId: emp.id,
                                      employeeName: emp.name ?? "",
                                      companyId: companyIdVal,
                                      title: edDocTitle.trim(),
                                      type: edDocType,
                                      fileUrl: url,
                                      fileType: isPdf ? "pdf" : "image",
                                      expiryDate: edDocExpiry.trim() || undefined,
                                      notes: edDocNotes.trim() || undefined,
                                      uploadedBy: uploadedByDisplayName,
                                    });
                                    setEmployeeDocUploadOpen(false);
                                    setEdDocTitle("");
                                    setEdDocExpiry("");
                                    setEdDocNotes("");
                                    if (edDocFileRef.current) edDocFileRef.current.value = "";
                                  } catch {
                                    /* silent */
                                  } finally {
                                    setEdDocUploading(false);
                                  }
                                }}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-amber-500 disabled:opacity-50 min-h-[44px] min-w-[44px]"
                              >
                                {edDocUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {tl.uploadDoc ?? "Upload"}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}

                {currentUserRole === "admin" && onUpdateEmployeePermissions && (() => {
                  const tl = t as Record<string, string>;
                  const assigned = customRoles.find((r) => r.id === emp.customRoleId);
                  const basePerms = assigned?.permissions ?? emptyRolePermissionsInline();
                  const useRole = emp.useRolePermissions !== false;
                  const merged: RolePermissions = {
                    ...emptyRolePermissionsInline(),
                    ...basePerms,
                    ...(useRole ? {} : (emp.customPermissions ?? {})),
                  };
                  const setUseRole = (next: boolean) => {
                    if (next) onUpdateEmployeePermissions(emp.id, {}, true);
                    else onUpdateEmployeePermissions(emp.id, { ...basePerms }, false);
                  };
                  const togglePermKey = (key: keyof RolePermissions) => {
                    const next = { ...merged, [key]: !merged[key] };
                    onUpdateEmployeePermissions(emp.id, next, false);
                  };
                  return (
                    <div className="space-y-4 border-t border-zinc-200 dark:border-slate-700 pt-4">
                      <h5 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        {tl.employeePermissions ?? "Employee permissions"}
                      </h5>
                      <div className="flex flex-wrap items-center gap-2">
                        {assigned ? (
                          <span
                            style={{ backgroundColor: assigned.color }}
                            className="inline-flex rounded-full px-3 py-1 text-xs font-medium text-white"
                          >
                            {assigned.name}
                          </span>
                        ) : (
                          <span className="text-sm text-zinc-700 dark:text-zinc-200">{emp.role ?? "—"}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-slate-700 px-3 py-2">
                        <span className="text-sm text-zinc-700 dark:text-zinc-200">
                          {tl.useRolePermissions ?? "Use role permissions"}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={useRole}
                          onClick={() => setUseRole(!useRole)}
                          className={`relative inline-flex w-11 h-6 shrink-0 rounded-full transition-colors ${useRole ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${useRole ? "translate-x-5" : "translate-x-0"}`}
                          />
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                        {(t as Record<string, string>).useRolePermissionsHint ??
                          "Desactiva para personalizar los permisos de este empleado individualmente"}
                      </p>
                      {!useRole && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                            {tl.customPermissions ?? "Custom permissions"}
                          </p>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {ROLE_PERMISSION_KEYS.map((key) => (
                              <div key={key} className="flex items-center justify-between gap-2 py-1">
                                <span className="text-xs text-zinc-600 dark:text-zinc-400 leading-tight">{permLabel(key)}</span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={merged[key]}
                                  onClick={() => togglePermKey(key)}
                                  className={`relative inline-flex w-11 h-6 shrink-0 rounded-full transition-colors ${merged[key] ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                                >
                                  <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${merged[key] ? "translate-x-5" : "translate-x-0"}`}
                                  />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="px-6 pb-6 pt-2 border-t border-zinc-200 dark:border-slate-700 flex flex-wrap gap-2">
                  {canEdit && (
                    <>
                      {onUpdateEmployee && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmployeePanelId(null);
                            onUpdateEmployee(emp.id, { name: emp.name, role: emp.role, hours: emp.hours, certificates: emp.certificates as unknown[] });
                          }}
                          className="flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 min-h-[44px]"
                        >
                          <Pencil className="h-4 w-4" />
                          {t.edit ?? "Editar"}
                        </button>
                      )}
                      {onConfirmDeleteEmployee && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmployeePanelId(null);
                            onConfirmDeleteEmployee(emp.id);
                          }}
                          className="flex items-center gap-2 rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-500 min-h-[44px]"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t["delete"] ?? "Eliminar"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {subcontractorDetailId && (() => {
        const sub = safeSubcontractors.find((s) => s.id === subcontractorDetailId) as Subcontractor | undefined;
        if (!sub) return null;
        const t = labels as Record<string, string>;
        const projectNames = (sub.assignedProjectIds ?? []).map((pid) => safeProjects.find((p) => p.id === pid)?.name ?? pid).filter(Boolean);
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/50 touch-none" aria-hidden onClick={() => setSubcontractorDetailId(null)} />
            <div className="fixed z-50 bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 shadow-xl overflow-y-auto inset-x-0 bottom-0 rounded-t-2xl max-h-[90vh] sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:w-full sm:max-w-lg sm:rounded-none sm:rounded-l-2xl sm:max-h-full">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-slate-700">
                <h4 className="text-base font-semibold text-zinc-900 dark:text-white">{sub.name}</h4>
                <button type="button" onClick={() => setSubcontractorDetailId(null)} className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400"><span className="text-zinc-400 mr-2">{t.specialty ?? "Especialidad"}</span>{(t[sub.specialty] ?? sub.specialty)}</p>
                {sub.address && <p className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2"><MapPin className="h-4 w-4" />{sub.address}</p>}
                {sub.emergencyContactName && <p className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2"><Phone className="h-4 w-4" />{sub.emergencyContactName} {sub.emergencyContactPhone}</p>}
                {projectNames.length > 0 && <p className="text-sm"><span className="text-zinc-400">{t.projects ?? "Proyectos"}:</span> {projectNames.join(", ")}</p>}
                {sub.liabilityInsuranceExpiry && <p className="text-xs text-zinc-500">{(t.liabilityInsurance ?? "Seguro RC")}: {sub.liabilityInsuranceExpiry}</p>}
                {sub.rating != null && sub.rating > 0 && <div className="flex items-center gap-1">{(t.rating ?? "Valoraci�n")}: {[1,2,3,4,5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= sub.rating! ? "text-amber-500 fill-amber-500" : "text-zinc-300"}`} />)}</div>}
                {sub.notes && <p className="text-sm text-zinc-500">{sub.notes}</p>}
                {(complianceFields ?? []).filter((f) => f.target.includes("subcontractor")).length > 0 && (
                  <div className="pt-4 border-t border-zinc-200 dark:border-slate-700">
                    <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t.compliance ?? "Compliance"}</h4>
                    <div className="space-y-0">
                      {(complianceFields ?? [])
                        .filter((f) => f.target.includes("subcontractor"))
                        .map((field) => {
                          const record = (complianceRecords ?? []).find(
                            (r) => r.fieldId === field.id && r.targetType === "subcontractor" && r.targetId === sub.id
                          );
                          return (
                            <div key={field.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
                              <div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{field.name}</p>
                                {record?.expiryDate && <p className="text-xs text-zinc-500 dark:text-zinc-400">{(t.expiresOn ?? "Vence")}: {record.expiryDate}</p>}
                              </div>
                              <div className="flex items-center gap-2">
                                {getComplianceStatusBadge(record, t)}
                                {canEdit && onComplianceRecordsChange && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingComplianceRecord({ field, targetId: sub.id, targetType: "subcontractor" });
                                      setComplianceRecordDraft({ value: record?.value, expiryDate: record?.expiryDate, documentUrl: record?.documentUrl });
                                    }}
                                    className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {subcontractorModalOpen && onAddSubcontractor && onUpdateSubcontractor && (() => {
        const t = labels as Record<string, string>;
        const isNew = !editingSubcontractorId;
        const handleSave = () => {
          const d = subcontractorDraft;
          if (!d.name?.trim()) return;
          const sub: Subcontractor = {
            id: d.id ?? "sc" + Date.now(),
            name: d.name.trim(),
            specialty: (d.specialty ?? SUBCONTRACTOR_SPECIALTIES[0]) as string,
            taxId: d.taxId ?? "",
            taxIdLabel: taxLabel,
            address: d.address ?? "",
            status: (d.status ?? "active") as "active" | "inactive" | "review",
            liabilityInsuranceExpiry: d.liabilityInsuranceExpiry || undefined,
            liabilityInsuranceDoc: d.liabilityInsuranceDoc || undefined,
            complianceCertExpiry: d.complianceCertExpiry || undefined,
            complianceCertDoc: d.complianceCertDoc || undefined,
            complianceCertLabel: certLabel,
            assignedProjectIds: Array.isArray(d.assignedProjectIds) ? d.assignedProjectIds : [],
            emergencyContactName: d.emergencyContactName || undefined,
            emergencyContactPhone: d.emergencyContactPhone || undefined,
            rating: d.rating,
            notes: d.notes || undefined,
            createdAt: d.createdAt ?? new Date().toISOString().slice(0, 10),
          };
          if (isNew) onAddSubcontractor(sub); else onUpdateSubcontractor(sub);
          setSubcontractorModalOpen(false);
          setEditingSubcontractorId(null);
          setSubcontractorDraft({});
        };
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={() => { setSubcontractorModalOpen(false); setSubcontractorDraft({}); }} />
            <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-700 shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{isNew ? (t.addSubcontractor ?? "A?adir subcontratista") : (t.edit ?? "Editar")}</h3>
                <button type="button" onClick={() => { setSubcontractorModalOpen(false); setSubcontractorDraft({}); }} className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-5">
                <section>
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t.profile ?? "Perfil"}</h4>
                  <div className="space-y-2">
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{t.name ?? "Nombre legal"}</label><input type="text" value={subcontractorDraft.name ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, name: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" required /></div>
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{t.specialty ?? "Especialidad"}</label><select value={subcontractorDraft.specialty ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, specialty: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm">{SUBCONTRACTOR_SPECIALTIES.map((sp) => <option key={sp} value={sp}>{t[sp] ?? sp}</option>)}</select></div>
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{taxLabel}</label><input type="text" value={subcontractorDraft.taxId ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, taxId: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" /></div>
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{t.address ?? "Direcci?n"}</label><input type="text" value={subcontractorDraft.address ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, address: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" /></div>
                  </div>
                </section>
                <section>
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t.compliance ?? "Compliance"}</h4>
                  <div className="space-y-2">
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{t.liabilityInsurance ?? "Seguro RC"}</label><input type="date" value={subcontractorDraft.liabilityInsuranceExpiry ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, liabilityInsuranceExpiry: e.target.value || undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" /></div>
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{t.liabilityInsurance ?? "Seguro RC"} URL</label><input type="text" value={subcontractorDraft.liabilityInsuranceDoc ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, liabilityInsuranceDoc: e.target.value || undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" placeholder="https://" /></div>
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{certLabel}</label><input type="date" value={subcontractorDraft.complianceCertExpiry ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, complianceCertExpiry: e.target.value || undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" /></div>
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{certLabel} URL</label><input type="text" value={subcontractorDraft.complianceCertDoc ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, complianceCertDoc: e.target.value || undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" placeholder="https://" /></div>
                  </div>
                </section>
                <section>
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t.operations ?? "Operaciones"}</h4>
                  <div className="space-y-2">
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{t.projects ?? "Proyectos asignados"}</label><select multiple value={subcontractorDraft.assignedProjectIds ?? []} onChange={(e) => { const sel = Array.from(e.target.selectedOptions, (o) => o.value); setSubcontractorDraft((d) => ({ ...d, assignedProjectIds: sel })); }} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[80px]">{safeProjects.map((p) => <option key={p.id} value={p.id}>{p.name ?? p.id}</option>)}</select></div>
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{t.emergencyContact ?? "Contacto emergencia"}</label><input type="text" value={subcontractorDraft.emergencyContactName ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, emergencyContactName: e.target.value || undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" placeholder={t.name ?? "Nombre"} /></div>
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{t.phone ?? "Tel?fono"}</label><input type="text" value={subcontractorDraft.emergencyContactPhone ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, emergencyContactPhone: e.target.value || undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" /></div>
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{t.notes ?? "Notas"}</label><textarea value={subcontractorDraft.notes ?? ""} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, notes: e.target.value || undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none" rows={2} /></div>
                  </div>
                </section>
                <section>
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t.rating ?? "Valoraci?n"}</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map((i) => (
                        <button key={i} type="button" onClick={() => setSubcontractorDraft((d) => ({ ...d, rating: i }))} className="p-1"><Star className={`h-6 w-6 ${i <= (subcontractorDraft.rating ?? 0) ? "text-amber-500 fill-amber-500" : "text-zinc-300 dark:text-zinc-600"}`} /></button>
                      ))}
                    </div>
                    <div><label className="block text-xs text-zinc-500 mb-0.5">{t.status ?? "Estado"}</label><select value={subcontractorDraft.status ?? "active"} onChange={(e) => setSubcontractorDraft((d) => ({ ...d, status: e.target.value as "active" | "inactive" | "review" }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"><option value="active">{t.active ?? "Activo"}</option><option value="inactive">{t.inactive ?? "Inactivo"}</option><option value="review">{t.underReview ?? "En revisi?n"}</option></select></div>
                  </div>
                </section>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => { setSubcontractorModalOpen(false); setSubcontractorDraft({}); }} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]">{t.cancel ?? "Cancelar"}</button>
                <button type="button" onClick={handleSave} className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]">{t.save ?? "Guardar"}</button>
              </div>
            </div>
          </>
        );
      })()}

      {roleModalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={() => setRoleModalOpen(false)} />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-zinc-200 dark:border-slate-700 shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {editingRoleId
                  ? (labels.editRole ?? "Editar rol")
                  : ((labels as Record<string, string>).create_role ?? labels.createRole ?? "Crear rol")}
              </h3>
              <button type="button" onClick={() => setRoleModalOpen(false)} className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(labels as Record<string, string>).role_name ?? labels.roleName ?? "Nombre del rol"}
                </label>
                <input
                  type="text"
                  value={roleDraft.name}
                  onChange={(e) => setRoleDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder={
                    (labels as Record<string, string>).role_name ?? labels.roleName ?? "Nombre"
                  }
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(labels as Record<string, string>).badge_color ?? labels.roleColor ?? "Color del badge"}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={roleDraft.color}
                    onChange={(e) => setRoleDraft((p) => ({ ...p, color: e.target.value }))}
                    className="h-10 w-14 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer"
                  />
                  <span className="text-sm text-zinc-500 font-mono">{roleDraft.color}</span>
                </div>
              </div>
              <div className="space-y-6">
                {ROLE_PERMISSION_GROUPS.map((group) => {
                  const gl = (labels as Record<string, string>)[group.labelKey];
                  return (
                    <div key={group.id}>
                      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        {gl && gl.trim() !== "" ? gl : group.id}
                      </h4>
                      <table className="w-full text-sm">
                        <tbody>
                          {group.keys.map((key) => (
                            <tr key={key} className="border-b border-zinc-100 dark:border-white/5">
                              <td className="py-2.5 pr-4 text-zinc-700 dark:text-zinc-300">{permLabel(key)}</td>
                              <td className="py-2.5 w-14 text-right">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={roleDraft.permissions[key]}
                                  onClick={() => togglePerm(key)}
                                  className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${roleDraft.permissions[key] ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                                >
                                  <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${roleDraft.permissions[key] ? "translate-x-5" : "translate-x-0"}`}
                                  />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setRoleModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">
                {labels.cancel ?? "Cancelar"}
              </button>
              <button type="button" onClick={saveRole} disabled={!roleDraft.name.trim()} className="px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-50">
                {editingRoleId
                  ? (labels.save ?? "Guardar")
                  : ((labels as Record<string, string>).create_role ?? labels.createRole ?? "Crear rol")}
              </button>
            </div>
          </div>
        </>
      )}

      {editingComplianceRecord && onComplianceRecordsChange && (() => {
        const { field, targetId, targetType } = editingComplianceRecord;
        const t = labels as Record<string, string>;
        const existing = (complianceRecords ?? []).find(
          (r) => r.fieldId === field.id && r.targetType === targetType && r.targetId === targetId
        );
        const saveRecord = () => {
          const expiryDate = field.fieldType === "date" ? (complianceRecordDraft.expiryDate || undefined) : undefined;
          const documentUrl = field.fieldType === "document" ? (complianceRecordDraft.documentUrl || undefined) : undefined;
          const value = field.fieldType === "text" ? (complianceRecordDraft.value || undefined) : field.fieldType === "checkbox" ? (complianceRecordDraft.value === "true" ? "true" : "false") : undefined;
          let status: ComplianceRecord["status"] = "missing";
          if (field.fieldType === "date" && expiryDate) {
            status = computeComplianceRecordStatus(expiryDate, field.alertDaysBefore, field.fieldType);
          } else if (field.fieldType === "checkbox") {
            status = value === "true" ? "valid" : "missing";
          } else if ((field.fieldType === "document" && documentUrl) || (field.fieldType === "text" && value)) {
            status = "valid";
          }
          const updated: ComplianceRecord = {
            id: existing?.id ?? "cr-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9),
            fieldId: field.id,
            targetType,
            targetId,
            value,
            expiryDate,
            documentUrl,
            status,
            updatedAt: new Date().toISOString(),
          };
          const rest = (complianceRecords ?? []).filter(
            (r) => !(r.fieldId === field.id && r.targetType === targetType && r.targetId === targetId)
          );
          onComplianceRecordsChange([...rest, updated]);
          setEditingComplianceRecord(null);
          setComplianceRecordDraft({});
        };
        return (
          <>
            <div className="fixed inset-0 z-50 bg-black/50" aria-hidden onClick={() => { setEditingComplianceRecord(null); setComplianceRecordDraft({}); }} />
            <div role="dialog" aria-modal className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">{field.name}</h3>
              <div className="space-y-4">
                {field.fieldType === "date" && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{(t as Record<string, string>).fieldTypeDate ?? "Fecha vencimiento"}</label>
                    <input
                      type="date"
                      value={complianceRecordDraft.expiryDate ?? ""}
                      onChange={(e) => setComplianceRecordDraft((d) => ({ ...d, expiryDate: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                    />
                  </div>
                )}
                {field.fieldType === "document" && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">URL</label>
                    <input
                      type="url"
                      value={complianceRecordDraft.documentUrl ?? ""}
                      onChange={(e) => setComplianceRecordDraft((d) => ({ ...d, documentUrl: e.target.value || undefined }))}
                      placeholder="https://"
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                    />
                  </div>
                )}
                {field.fieldType === "text" && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.value ?? "Valor"}</label>
                    <input
                      type="text"
                      value={complianceRecordDraft.value ?? ""}
                      onChange={(e) => setComplianceRecordDraft((d) => ({ ...d, value: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                    />
                  </div>
                )}
                {field.fieldType === "checkbox" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={complianceRecordDraft.value === "true"}
                      onChange={(e) => setComplianceRecordDraft((d) => ({ ...d, value: e.target.checked ? "true" : "false" }))}
                      className="rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{t.yes ?? "S?"}</span>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => { setEditingComplianceRecord(null); setComplianceRecordDraft({}); }} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]">
                  {t.cancel ?? "Cancelar"}
                </button>
                <button type="button" onClick={saveRecord} className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]">
                  {t.save ?? "Guardar"}
                </button>
              </div>
            </div>
          </>
        );
      })()}

    </div>
  );
}


