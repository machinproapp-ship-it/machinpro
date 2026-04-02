"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { BrandWordmark } from "@/components/BrandWordmark";
import type { CentralEmployee, MainSection, UserRole } from "@/types/shared";
import { CentralModule } from "@/components/CentralModule";
import {
  LogisticsModule,
  type InventoryItem,
  type InventoryMovement,
  type Vehicle,
  type Rental,
  type Supplier,
  type SupplierContact,
  type Employee as LogisticsEmployee,
  type WarehouseSubTabId,
  type AssetUsageLog,
  type ToolStatus,
  type VehicleStatus,
} from "@/components/LogisticsModule";
import {
  ProjectsModule,
  type Project as SiteProject,
  type ProjectEmployee,
  type ProjectInventoryItem,
  type ProjectForm,
} from "@/components/ProjectsModule";
import type { SafetyChecklist } from "@/types/safetyChecklist";
import type { DailyFieldReport } from "@/types/dailyFieldReport";
import type { ProjectTask } from "@/types/projectTask";
import { SettingsModule } from "@/components/SettingsModule";
import ScheduleModule from "@/components/ScheduleModule";
import { EmployeeShiftDayView } from "@/components/EmployeeShiftDayView";
import { FormsModule } from "@/components/FormsModule";
import { BillingModule } from "@/components/BillingModule";
import type { CorrectiveActionsPrefill } from "@/components/CorrectiveActionsModule";
import LoginScreen, { type LoginDemoAccount } from "@/components/LoginScreen";
import { SecurityModule, type SecurityTabId } from "@/components/SecurityModule";
import { EmployeesModule } from "@/components/EmployeesModule";
import { SubcontractorsModule } from "@/components/SubcontractorsModule";
import { InstallPWABanner } from "@/components/InstallPWABanner";
import { OnboardingModal } from "@/components/OnboardingModal";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import { ModuleHelpFab } from "@/components/ModuleHelpFab";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { AuthChangeEvent, PostgrestResponse, Session } from "@supabase/supabase-js";
import {
  LogOut,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  CloudCheck,
  Camera,
  AlertTriangle,
  Shield,
  X,
  Bell,
  Settings,
  Menu,
} from "lucide-react";
import { supabase, type AuthGetSessionResult } from "@/lib/supabase";
import { postAppNotification } from "@/lib/clientNotifications";
import { NotificationBell } from "@/components/NotificationBell";
import { buildVisitorCheckInUrl } from "@/lib/visitorQrUrl";
import { useProjectPhotos } from "@/lib/useProjectPhotos";
import { logAuditEvent, type AuditLogEntry } from "@/lib/useAuditLog";
import {
  runComplianceWatchdog,
  shouldRunWatchdog,
  setLastWatchdogRun,
  type ComplianceAlert,
} from "@/lib/complianceWatchdog";
import type { Language, Currency } from "@/lib/i18n";
import { LANGUAGES, ALL_TRANSLATIONS, loadLocale, isLazyLocale } from "@/lib/i18n";
import {
  LOCALE_STORAGE_KEY,
  isValidLanguage,
  detectLanguageFromNavigator,
  persistUserLocale,
  persistUserTimezone,
} from "@/lib/localePreference";
import { dateLocaleForUser, resolveUserTimezone } from "@/lib/dateUtils";
import type { Blueprint, Annotation, BlueprintRevision } from "@/types/blueprints";
import {
  type CustomRole,
  type RolePermissions,
  resolveActiveCustomRole,
  pickDefaultWorkerRoleId,
  isProtectedCustomRole,
  emptyRolePermissionsInline,
} from "@/types/roles";
import {
  customRoleFromSupabaseRow,
  readLegacyCustomRolesFromLocalStorage,
  clearLegacyCustomRolesLocalStorage,
  fullAdministratorPermissions,
  type RolesTableRow,
} from "@/lib/roles-supabase";
import type { Binder, BinderDocument, BinderCategory } from "@/types/binders";
import type { FormTemplate, FormInstance } from "@/types/forms";
import type { Subcontractor } from "@/types/subcontractor";
import { INITIAL_FORM_TEMPLATES } from "@/lib/formTemplates";
import { getCountryConfig } from "@/lib/countryConfig";
import { fetchDailyReportsForCompany } from "@/lib/dailyReportsDb";
import { parseProfileCertificates } from "@/lib/employeeCertificatesJson";
import { useSubscription } from "@/lib/useSubscription";
import { applyPlanToModulePermissions } from "@/lib/planPermissions";

type ResourceRequestStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "dispatched"
  | "received";

type ResourceRequestItemStatus =
  | "pending"
  | "ready"
  | "substituted"
  | "unavailable";

interface ResourceRequestItem {
  id: string;
  type: "tool" | "equipment" | "consumable" | "material" | "vehicle";
  inventoryItemId?: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  status: ResourceRequestItemStatus;
  substituteId?: string;
  substituteName?: string;
}

interface ResourceRequest {
  id: string;
  projectId: string;
  requestedBy: string;
  requestedByName: string;
  neededBy: string;
  status: ResourceRequestStatus;
  items: ResourceRequestItem[];
  notes?: string;
  preparedBy?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  createdAt: string;
}

// Moneda: símbolos y tasas (referencia CAD). Tipos en @/lib/i18n.
const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CAD: "C$",
  USD: "$",
  MXN: "$MX",
  EUR: "€",
  GBP: "£",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CZK: "Kč",
  HUF: "Ft",
  RON: "lei",
  BGN: "лв",
  HRK: "kn",
  TRY: "₺",
  UAH: "₴",
};
const CURRENCY_RATES: Record<Currency, number> = {
  CAD: 1,
  USD: 0.72,
  MXN: 13.5,
  EUR: 0.68,
  GBP: 0.58,
  CHF: 0.67,
  SEK: 7.8,
  NOK: 7.9,
  DKK: 5.2,
  PLN: 3.0,
  CZK: 17.0,
  HUF: 270,
  RON: 3.5,
  BGN: 1.35,
  HRK: 5.5,
  TRY: 24.0,
  UAH: 30.0,
};

const TRANSLATIONS = ALL_TRANSLATIONS;

// ─── Tipos de dominio básicos ──────────────────────────────────────────────────

export interface Certificate {
  id: string;
  name: string;
  status: "valid" | "expired";
  expiryDate?: string;
}

function certificatesFromProfileJson(raw: unknown): Certificate[] {
  return parseProfileCertificates(raw).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status?.toLowerCase() === "expired" ? "expired" : "valid",
    expiryDate: c.expiryDate,
  }));
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  /** `user_profiles.profile_status` when loaded from Supabase. */
  profileStatus?: string | null;
  hours: number;
  permissions?: { plans: boolean; warehouse: boolean; certificates: boolean; subcontractors: boolean };
  phone?: string;
  email?: string;
  hoursLog?: { date: string; hours: number }[];
  certificates: Certificate[];
  payType?: "hourly" | "salary";
  hourlyRate?: number;
  monthlySalary?: number;
  customRoleId?: string;
  customPermissions?: Partial<RolePermissions>;
  useRolePermissions?: boolean;
}

function isActiveProfileEmployee(e: Pick<Employee, "profileStatus">): boolean {
  const st = (e.profileStatus ?? "active").toLowerCase().trim();
  return st === "active";
}

function scheduleRoleKeyForEmployee(e: Employee, customRoles: CustomRole[]): string {
  if (e.customRoleId) return `custom:${e.customRoleId}`;
  const norm = (e.role ?? "").trim().toLowerCase();
  const byName = customRoles.find((r) => r.name.trim().toLowerCase() === norm);
  if (byName) return `custom:${byName.id}`;
  if (norm.includes("admin")) return "admin";
  if (norm.includes("supervisor") || norm.includes("supervisora")) return "supervisor";
  if (norm.includes("logist") || norm.includes("almacén") || norm.includes("warehouse")) return "logistic";
  return "worker";
}

export interface Project {
  id: string;
  name: string;
  type: string;
  location: string;
  budgetCAD?: number;
  spentCAD?: number;
  estimatedStart: string;
  estimatedEnd: string;
  assignedEmployeeIds: string[];
  locationLat?: number;
  locationLng?: number;
  archived?: boolean;
  projectCode?: string;
  /** Estado operativo (lista Central / formulario). */
  lifecycleStatus?: "active" | "paused" | "completed";
}

export type ProjectType = "residential" | "commercial" | "industrial";

export type { Subcontractor } from "@/types/subcontractor";

// Turno o evento en el calendario
export interface ScheduleEntry {
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

export type VacationRequestRow = {
  id: string;
  company_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: "pending" | "approved" | "rejected";
  notes?: string | null;
  admin_comment?: string | null;
};

// Compliance Builder (Sprint P)
export type ComplianceTarget = "employee" | "subcontractor" | "vehicle";
export type ComplianceFieldType = "date" | "document" | "text" | "checkbox";

export interface ComplianceField {
  id: string;
  name: string;
  description?: string;
  fieldType: ComplianceFieldType;
  target: ComplianceTarget[];
  isRequired: boolean;
  alertDaysBefore: number;
  isDefault: boolean;
  createdAt: string;
}

export interface ComplianceRecord {
  id: string;
  fieldId: string;
  targetType: ComplianceTarget;
  targetId: string;
  value?: string;
  expiryDate?: string;
  documentUrl?: string;
  status: "valid" | "expiring" | "expired" | "missing";
  updatedAt: string;
}

export type EmployeeDocument = {
  id: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  title: string;
  type: "contract" | "certificate" | "id" | "training" | "medical" | "other";
  fileUrl: string;
  fileType: "pdf" | "image";
  expiryDate?: string;
  notes?: string;
  uploadedBy: string;
  uploadedAt: string;
};

// Entrada de fichaje
export interface ClockEntry {
  id: string;
  employeeId: string;
  projectId?: string;
  projectCode?: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  locationLat?: number;
  locationLng?: number;
  locationAlert?: boolean;
  locationAlertMeters?: number;
  hadPendingCerts?: boolean;
}

// Hoja de horas (Sprint J)
export interface TimeEntry {
  id: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  projectId?: string;
  projectName?: string;
  hoursWorked: number;
}

export interface TimeSheet {
  id: string;
  employeeId: string;
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  entries: TimeEntry[];
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

// Cola offline para sincronización con Supabase
export interface PendingSync {
  id: string;
  type: "form_instance" | "clock_entry" | "diary_entry";
  data: unknown;
  createdAt: string;
  attempts: number;
}

// Re-export for consumers that import from page
export type { AnnotationType, AnnotationColor, BlueprintCategory, Annotation, BlueprintRevision, Blueprint } from "@/types/blueprints";

// ─── Datos demo: empleados + certificados ──────────────────────────────────────

const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: "e1",
    name: "Ana García",
    role: "Supervisora de Obra",
    hours: 160,
    payType: "salary",
    monthlySalary: 4800,
    permissions: { plans: true, warehouse: false, certificates: true, subcontractors: false },
    phone: "+1 514 555 0101",
    email: "ana.garcia@empresa.com",
    hoursLog: [
      { date: "2026-03-10", hours: 8 },
      { date: "2026-03-09", hours: 8 },
      { date: "2026-03-08", hours: 6 },
    ],
    certificates: [
      { id: "c1-1", name: "OSHA 30",            status: "valid",   expiryDate: "2027-06-01" },
      { id: "c1-2", name: "First Aid / CPR",    status: "expired", expiryDate: "2025-08-15" },
      { id: "c1-3", name: "Working at Heights", status: "valid",   expiryDate: "2026-03-28" },
      { id: "c1-4", name: "WHMIS",              status: "valid",   expiryDate: "2026-12-01" },
    ],
  },
  {
    id: "e2",
    name: "Marc Dubois",
    role: "Encargado de Almacén",
    hours: 150,
    payType: "hourly",
    hourlyRate: 28,
    permissions: { plans: false, warehouse: true, certificates: false, subcontractors: false },
    phone: "+1 514 555 0102",
    email: "marc.dubois@empresa.com",
    hoursLog: [
      { date: "2026-03-10", hours: 8 },
      { date: "2026-03-09", hours: 7 },
    ],
    certificates: [
      { id: "c2-1", name: "Forklift Operator", status: "valid",   expiryDate: "2027-03-15" },
      { id: "c2-2", name: "WHMIS",             status: "expired", expiryDate: "2025-11-20" },
      { id: "c2-3", name: "Confined Space",    status: "valid",   expiryDate: "2026-04-05" },
    ],
  },
  {
    id: "e3",
    name: "Lena Hoffmann",
    role: "Jefa de Seguridad",
    hours: 145,
    payType: "salary",
    monthlySalary: 5200,
    permissions: { plans: true, warehouse: false, certificates: true, subcontractors: true },
    phone: "+1 514 555 0103",
    email: "lena.hoffmann@empresa.com",
    hoursLog: [
      { date: "2026-03-10", hours: 8 },
      { date: "2026-03-09", hours: 8 },
      { date: "2026-03-08", hours: 8 },
    ],
    certificates: [
      { id: "c3-1", name: "OSHA 30",            status: "valid", expiryDate: "2028-01-10" },
      { id: "c3-2", name: "First Aid / CPR",    status: "valid", expiryDate: "2026-05-20" },
      { id: "c3-3", name: "Working at Heights", status: "valid", expiryDate: "2026-11-30" },
      { id: "c3-4", name: "Fall Protection",    status: "valid", expiryDate: "2027-09-15" },
    ],
  },
  {
    id: "e4",
    name: "Carlos Mendoza",
    role: "Operador de Maquinaria",
    hours: 138,
    payType: "hourly",
    hourlyRate: 24,
    permissions: { plans: false, warehouse: false, certificates: false, subcontractors: false },
    phone: "+1 514 555 0104",
    email: "carlos.mendoza@empresa.com",
    hoursLog: [
      { date: "2026-03-10", hours: 9 },
      { date: "2026-03-09", hours: 8 },
    ],
    certificates: [
      { id: "c4-1", name: "Heavy Equipment", status: "valid",   expiryDate: "2026-04-02" },
      { id: "c4-2", name: "WHMIS",           status: "expired", expiryDate: "2025-06-30" },
      { id: "c4-3", name: "NOM-001-STPS",    status: "expired", expiryDate: "2025-12-01" },
    ],
  },
  {
    id: "e5",
    name: "Sophie Tremblay",
    role: "Inspectora de Calidad",
    hours: 152,
    payType: "salary",
    monthlySalary: 4500,
    permissions: { plans: true, warehouse: false, certificates: true, subcontractors: false },
    phone: "+1 514 555 0105",
    email: "sophie.tremblay@empresa.com",
    hoursLog: [
      { date: "2026-03-10", hours: 7 },
      { date: "2026-03-09", hours: 8 },
      { date: "2026-03-08", hours: 8 },
    ],
    certificates: [
      { id: "c5-1", name: "Quality Control", status: "valid", expiryDate: "2027-07-15" },
      { id: "c5-2", name: "First Aid / CPR", status: "valid", expiryDate: "2026-08-20" },
    ],
  },
];

// ─── Proyectos iniciales ───────────────────────────────────────────────────────

const INITIAL_PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Obra Centro",
    type: "commercial",
    location: "Montreal, QC, Canada",
    projectCode: "MON-01",
    budgetCAD: 500000,
    spentCAD: 120000,
    estimatedStart: "2026-01-01",
    estimatedEnd: "2026-12-31",
    archived: false,
    assignedEmployeeIds: ["e1", "e2", "e4"],
  },
  {
    id: "p2",
    name: "Residencia Maple",
    type: "residential",
    budgetCAD: 320000,
    spentCAD: 85000,
    location: "Laval, QC, Canada",
    projectCode: "LAV-02",
    locationLat: 45.6066,
    locationLng: -73.7124,
    estimatedStart: "2026-01-15",
    estimatedEnd: "2026-09-30",
    archived: false,
    assignedEmployeeIds: ["e3", "e5"],
  },
];

const INITIAL_SCHEDULE: ScheduleEntry[] = [
  { id: "se1", type: "shift", employeeIds: ["e1", "e4"], projectId: "p1", projectCode: "MON-01", date: "2026-03-11", startTime: "07:00", endTime: "16:00", notes: "Turno normal", createdBy: "admin" },
  { id: "se2", type: "shift", employeeIds: ["e3", "e5"], projectId: "p2", projectCode: "LAV-02", date: "2026-03-11", startTime: "08:00", endTime: "17:00", createdBy: "admin" },
  { id: "se3", type: "event", employeeIds: ["e1", "e2", "e3", "e4", "e5"], date: "2026-03-13", startTime: "09:00", endTime: "11:00", notes: "Reunión de seguridad mensual", eventLabel: "meeting", createdBy: "admin" },
  { id: "se4", type: "shift", employeeIds: ["e2"], projectId: "p1", projectCode: "MON-01", date: "2026-03-12", startTime: "07:00", endTime: "15:00", createdBy: "admin" },
];

// ─── Datos demo: inventario, flota, alquileres, proveedores ─────────────────────

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: "inv1", name: "Cemento", type: "consumable", quantity: 120, unit: "sacos", purchasePriceCAD: 12.5 },
  { id: "inv2", name: "Varilla", type: "consumable", quantity: 80, unit: "piezas", purchasePriceCAD: 8 },
  { id: "inv3", name: "Taladro inalámbrico", type: "tool", quantity: 4, unit: "unidades", purchasePriceCAD: 189, toolStatus: "available" },
  { id: "inv4", name: "Nivel láser", type: "tool", quantity: 2, unit: "unidades", purchasePriceCAD: 95, toolStatus: "available" },
  { id: "inv5", name: "Andamio", type: "equipment", quantity: 1, unit: "unidades", purchasePriceCAD: 1200, toolStatus: "available" },
];

const INITIAL_VEHICLES: Vehicle[] = [
  { id: "v1", plate: "ABC-1234", usualDriverId: "e2", currentProjectId: "p1", insuranceExpiry: "2026-08-15", inspectionExpiry: "2026-07-01" },
];

const INITIAL_RENTALS: Rental[] = [
  { id: "r1", name: "Andamio 3m", supplier: "Equipos Quebec", returnDate: "2026-04-30", costCAD: 450 },
];

const INITIAL_SUPPLIERS: Supplier[] = [
  { id: "s1", name: "Materiales Norte", phone: "+1 514 555 0200", email: "ventas@materialesnorte.com", webLink: "", address: "Montreal, QC" },
];

// ─── Binders (Documentos de empresa) ─────────────────────────────────────────────

const INITIAL_BINDERS: Binder[] = [
  { id: "b1", name: "Health & Safety", category: "health_safety", color: "#ef4444", icon: "shield", isDefault: true, description: "Safety policies and procedures", createdAt: "2026-01-01T00:00:00Z", documentCount: 0 },
  { id: "b2", name: "Safety Data Sheets", category: "safety_data", color: "#f59e0b", icon: "file-warning", isDefault: true, description: "Material safety data sheets", createdAt: "2026-01-01T00:00:00Z", documentCount: 0 },
  { id: "b3", name: "Staff Memos", category: "memos", color: "#3b82f6", icon: "mail", isDefault: true, description: "Company announcements and memos", createdAt: "2026-01-01T00:00:00Z", documentCount: 0 },
  { id: "b4", name: "Procedures", category: "procedures", color: "#10b981", icon: "list-checks", isDefault: true, description: "Work procedures and guidelines", createdAt: "2026-01-01T00:00:00Z", documentCount: 0 },
  { id: "b5", name: "Certificates", category: "certificates", color: "#8b5cf6", icon: "award", isDefault: true, description: "Company certifications", createdAt: "2026-01-01T00:00:00Z", documentCount: 0 },
];

// ─── Asignaciones trabajador–proyecto ───────────────────────────────────────────

export interface WorkerAssignment {
  id: string;
  projectId: string;
  employeeId: string;
  date: string;
}

const INITIAL_WORKER_ASSIGNMENTS: WorkerAssignment[] = [
  { id: "wa5", projectId: "p1", employeeId: "e4", date: "2026-03-10" },
  { id: "wa6", projectId: "p2", employeeId: "e3", date: "2026-03-10" },
  { id: "wa7", projectId: "p2", employeeId: "e5", date: "2026-03-10" },
];

// ─── Permisos y roles personalizados (Sprint E) ──────────────────────────────────

function fillRolePermissions(p: Partial<RolePermissions>): RolePermissions {
  return { ...emptyRolePermissionsInline(), ...p };
}

const INITIAL_CUSTOM_ROLES: CustomRole[] = [
  {
    id: "role-admin",
    name: "Administrador",
    color: "#b45309",
    createdAt: new Date().toISOString(),
    permissions: fullAdministratorPermissions(),
  },
  {
    id: "role-supervisor",
    name: "Supervisor",
    color: "#0d9488",
    createdAt: new Date().toISOString(),
    permissions: fillRolePermissions({
      canViewProjects: true,
      canViewOnlyAssignedProjects: true,
      canViewSchedule: true,
      canCreateShifts: true,
      canManageVacations: true,
      canViewTimesheets: true,
      canViewProjectGeneral: true,
      canViewProjectTeam: true,
      canViewProjectInventory: true,
      canViewProjectGallery: true,
      canUploadPhotos: true,
      canViewProjectBlueprints: true,
      canManageProjectBlueprints: true,
      canViewProjectForms: true,
      canManageProjectForms: true,
      canManageDailyReports: true,
      canViewProjectVisitors: true,
      canViewProjectRFI: true,
      canManageProjectRFI: true,
      canViewSettings: true,
      canViewBinders: true,
      canViewAttendance: true,
      canViewSecurity: true,
      canViewHazards: true,
      canViewCorrectiveActions: true,
      canViewTimeclock: true,
    }),
  },
  {
    id: "role-worker",
    name: "Empleado",
    color: "#10b981",
    createdAt: "2026-01-01T00:00:00Z",
    permissions: fillRolePermissions({
      canViewProjects: true,
      canViewOnlyAssignedProjects: true,
      canViewSchedule: true,
      canViewTimesheets: true,
      canViewProjectGeneral: true,
      canViewProjectTeam: true,
      canViewProjectInventory: true,
      canViewProjectGallery: true,
      canUploadPhotos: true,
      canViewProjectForms: true,
      canViewSettings: true,
      canViewBinders: true,
      canViewTimeclock: true,
    }),
  },
  {
    id: "role-logistic",
    name: "Logística",
    color: "#2563eb",
    createdAt: new Date().toISOString(),
    permissions: fillRolePermissions({
      canViewLogistics: true,
      canViewInventory: true,
      canManageInventory: true,
      canViewFleet: true,
      canManageFleet: true,
      canViewSuppliers: true,
      canManageSuppliers: true,
      canManageRentals: true,
      canCreatePurchaseOrders: true,
      canViewSchedule: true,
      canViewTimesheets: true,
      canViewSettings: true,
      canViewBinders: true,
    }),
  },
];

// Compatibilidad: permisos derivados para sidebar y módulos existentes
interface ModulePermissions {
  office: boolean;
  warehouse: boolean;
  site: boolean;
  worker: boolean;
  forms?: boolean;
  canSeeOnlyAssignedProjects?: boolean;
  canAccessSchedule?: boolean;
  canCreateShifts?: boolean;
  canEditCompanyProfile?: boolean;
  canViewBinders?: boolean;
  canManageBinders?: boolean;
  canAccessEmployees?: boolean;
  canAccessSubcontractors?: boolean;
  canManageVacations?: boolean;
  canViewAttendance?: boolean;
  canViewTimeclock?: boolean;
  canManageTimeclock?: boolean;
  canAccessSecurity?: boolean;
  canViewSettings?: boolean;
}

function permissionsToModule(p: RolePermissions): ModulePermissions {
  return {
    office: p.canViewCentral,
    warehouse: p.canViewLogistics,
    site: p.canViewProjects || p.canViewSubcontractors,
    worker: false,
    forms: p.canViewProjectForms,
    canSeeOnlyAssignedProjects: p.canViewOnlyAssignedProjects,
    canAccessSchedule: p.canViewSchedule,
    canCreateShifts: p.canCreateShifts,
    canEditCompanyProfile: p.canEditCompanyProfile,
    canViewBinders: p.canViewBinders,
    canManageBinders: p.canManageBinders,
    canAccessEmployees: p.canViewEmployees || p.canManageEmployees,
    canAccessSubcontractors: p.canViewSubcontractors || p.canManageSubcontractors,
    canManageVacations: p.canManageVacations,
    canViewAttendance: p.canViewAttendance,
    canViewTimeclock: p.canViewTimeclock,
    canManageTimeclock: p.canManageTimeclock,
    canAccessSecurity: p.canViewSecurity,
    canViewSettings: p.canViewSettings,
  };
}

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWorkedFromClockPair(clockIn: string, clockOut: string): string {
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

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDefaultComplianceFields(country: string): ComplianceField[] {
  const config = getCountryConfig(country);
  const now = new Date().toISOString();
  return [
    {
      id: "cf-liability",
      name: "Liability Insurance",
      fieldType: "date",
      target: ["employee", "subcontractor"],
      isRequired: true,
      alertDaysBefore: 30,
      isDefault: true,
      createdAt: now,
    },
    {
      id: "cf-compliance",
      name: config.complianceCertLabel,
      fieldType: "date",
      target: ["employee", "subcontractor"],
      isRequired: true,
      alertDaysBefore: 30,
      isDefault: true,
      createdAt: now,
    },
    {
      id: "cf-vehicle-inspection",
      name: config.vehicleInspectionLabel,
      fieldType: "date",
      target: ["vehicle"],
      isRequired: true,
      alertDaysBefore: 30,
      isDefault: true,
      createdAt: now,
    },
    {
      id: "cf-vehicle-insurance",
      name: "Vehicle Insurance",
      fieldType: "date",
      target: ["vehicle"],
      isRequired: true,
      alertDaysBefore: 30,
      isDefault: true,
      createdAt: now,
    },
  ];
}

// ─── Estado global y layout ────────────────────────────────────────────────────

export default function Home() {
  // PASO MANUAL: Crear usuario admin en Supabase Dashboard
  // Authentication → Users → Add user
  // Email: admin@machinpro.com
  // Password: (elegir una segura)

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const { user, profile, signOut, syncSession } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    void supabase.auth.getSession().then((result: AuthGetSessionResult) => {
      setSession(result.data.session);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, s: Session | null) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      localStorage.removeItem(LOCALE_STORAGE_KEY);
      if (typeof sessionStorage !== "undefined") {
        const toRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k?.startsWith("machinpro_locale_bootstrapped_")) toRemove.push(k);
        }
        for (const k of toRemove) sessionStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
    await signOut();
    setSession(null);
    setLanguage(detectLanguageFromNavigator());
  };
  const companyId = profile?.companyId ?? null;
  const { subscription: subscriptionRow } = useSubscription(companyId);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);
  const [pendingOpenEmployeeId, setPendingOpenEmployeeId] = useState<string | null>(null);
  const [complianceNotifOpen, setComplianceNotifOpen] = useState(false);
  const complianceNotifRef = useRef<HTMLDivElement>(null);
  const { photos, uploadPhoto, approvePhoto, rejectPhoto } = useProjectPhotos(companyId);

  useEffect(() => {
    if (!companyId) return;
    void supabase
      .from("audit_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then((res: PostgrestResponse<AuditLogEntry>) => setAuditLogs(res.data ?? []));
  }, [companyId]);
  const pendingPhotoCountByProject = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ph of photos ?? []) {
      if (ph.status !== "pending") continue;
      if (ph.photo_type && ph.photo_type !== "obra") continue;
      m[ph.project_id] = (m[ph.project_id] ?? 0) + 1;
    }
    return m;
  }, [photos]);
  /** Never seed from localStorage: avoids showing the previous account's language after login. */
  const [language, setLanguage] = useState<Language>(() =>
    typeof window === "undefined" ? "es" : detectLanguageFromNavigator()
  );
  const [lazyLocaleT, setLazyLocaleT] = useState<Record<string, string> | null>(null);
  const lazyLocaleCacheRef = useRef<Map<string, Record<string, string>>>(new Map());

  useEffect(() => {
    if (!isLazyLocale(language)) {
      setLazyLocaleT(null);
      return;
    }
    const cached = lazyLocaleCacheRef.current.get(language);
    if (cached) {
      setLazyLocaleT(cached);
      return;
    }
    let cancelled = false;
    setLazyLocaleT(null);
    void loadLocale(language).then((merged) => {
      if (!cancelled) {
        lazyLocaleCacheRef.current.set(language, merged);
        setLazyLocaleT(merged);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const t = useMemo(() => {
    if (!isLazyLocale(language)) {
      return (TRANSLATIONS[language] ?? TRANSLATIONS["en"]) as Record<string, string>;
    }
    return (lazyLocaleT ?? TRANSLATIONS["en"]) as Record<string, string>;
  }, [language, lazyLocaleT]);

  const applyLanguage = useCallback(
    async (lang: Language) => {
      setLanguage(lang);
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, lang);
      } catch {
        /* ignore */
      }
      if (user?.id) {
        await persistUserLocale(supabase, user.id, lang);
        await syncSession();
      }
    },
    [user?.id, syncSession]
  );

  const applyUserTimezone = useCallback(
    async (tz: string) => {
      if (!user?.id) return;
      await persistUserTimezone(supabase, user.id, tz);
      try {
        localStorage.setItem("machinpro_tz", tz);
      } catch {
        /* ignore */
      }
      await syncSession();
    },
    [user?.id, syncSession]
  );

  useEffect(() => {
    if (!user?.id || !profile || profile.id !== user.id) return;
    if (profile.locale && isValidLanguage(profile.locale)) {
      setLanguage((prev) => (prev === profile.locale ? prev : profile.locale!));
      try {
        if (localStorage.getItem(LOCALE_STORAGE_KEY) !== profile.locale) {
          localStorage.setItem(LOCALE_STORAGE_KEY, profile.locale);
        }
      } catch {
        /* ignore */
      }
      return;
    }
    const bootKey = `machinpro_locale_bootstrapped_${user.id}`;
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(bootKey)) return;
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(bootKey, "1");
    } catch {
      /* ignore */
    }
    const chosen = detectLanguageFromNavigator();
    void (async () => {
      setLanguage(chosen);
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, chosen);
      } catch {
        /* ignore */
      }
      await persistUserLocale(supabase, user.id, chosen);
      await syncSession();
    })();
  }, [user?.id, profile?.id, profile?.locale]);

  const loginDemoAccounts = useMemo((): LoginDemoAccount[] => {
    const rawEnv = process.env.NEXT_PUBLIC_LOGIN_DEMOS;
    if (typeof rawEnv !== "string" || !rawEnv.trim()) return [];
    try {
      const raw = JSON.parse(rawEnv) as unknown;
      if (!Array.isArray(raw)) return [];
      return raw
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const o = x as Record<string, unknown>;
          const email = typeof o.email === "string" ? o.email : "";
          const password = typeof o.password === "string" ? o.password : "";
          const label = typeof o.label === "string" ? o.label : email;
          const accentClass =
            typeof o.accentClass === "string" ? o.accentClass : "ring-2 ring-teal-400/60";
          if (!email || !password) return null;
          return { email, password, label, accentClass };
        })
        .filter((x): x is LoginDemoAccount => x !== null);
    } catch {
      return [];
    }
  }, []);

  const [currency, setCurrency] = useState<Currency>("CAD");
  const [measurementSystem, setMeasurementSystem] = useState<"metric" | "imperial">("metric");
  const [companyCountry, setCompanyCountry] = useState<string>("CA");
  const userTimeZone = useMemo(() => resolveUserTimezone(profile?.timezone ?? null), [profile?.timezone]);
  const dateLocaleBcp47 = useMemo(() => dateLocaleForUser(language, companyCountry), [language, companyCountry]);
  const [complianceFields, setComplianceFields] = useState<ComplianceField[]>(() => getDefaultComplianceFields("CA"));
  const [complianceRecords, setComplianceRecords] = useState<ComplianceRecord[]>([]);
  const [employeeDocs, setEmployeeDocs] = useState<EmployeeDocument[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("machinpro_employee_docs");
      return saved ? (JSON.parse(saved) as EmployeeDocument[]) : [];
    } catch {
      return [];
    }
  });
  const [companyName, setCompanyName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyProfileSaveBusy, setCompanyProfileSaveBusy] = useState(false);
  const ONBOARDING_LS_KEY = "machinpro_onboarding_complete";
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const v = localStorage.getItem(ONBOARDING_LS_KEY);
      return v === "true" || v === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!supabase || !companyId || !session) return;
    void (async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("onboarding_complete")
        .eq("id", companyId)
        .maybeSingle();
      if (error || !data) return;
      const row = data as { onboarding_complete?: boolean | null };
      if (row.onboarding_complete === true) {
        try {
          localStorage.setItem(ONBOARDING_LS_KEY, "true");
        } catch {
          /* ignore */
        }
        setOnboardingComplete(true);
      }
    })();
  }, [supabase, companyId, session]);

  const completeOnboarding = useCallback(async () => {
    setOnboardingComplete(true);
    try {
      localStorage.setItem(ONBOARDING_LS_KEY, "true");
    } catch {
      /* ignore */
    }
    const token = session?.access_token;
    if (token && companyId) {
      try {
        await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ companyId }),
        });
      } catch {
        /* ignore */
      }
    }
  }, [session?.access_token, companyId]);

  const handleLogoUpload = useCallback(() => {
    if (typeof window === "undefined") return;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) return;
    const cloudinary = (window as unknown as { cloudinary?: { openUploadWidget: (options: unknown, callback: (error: unknown, result: { event?: string; info?: { secure_url: string } }) => void) => void } }).cloudinary;
    if (!cloudinary?.openUploadWidget) return;
    cloudinary.openUploadWidget(
      {
        cloudName,
        uploadPreset,
        sources: ["local", "camera", "google_drive", "dropbox", "url"],
        multiple: false,
        maxFileSize: 5000000,
        cropping: true,
        croppingAspectRatio: 3,
        croppingDefaultSelectionRatio: 0.8,
        folder: "machinpro/logos",
        clientAllowedFormats: ["png", "jpg", "jpeg", "svg", "webp"],
        showAdvancedOptions: false,
        showCompletedButton: true,
        theme: "minimal",
      },
      (error: unknown, result: { event?: string; info?: { secure_url: string } }) => {
        if (!error && result?.event === "success" && result?.info?.secure_url) {
          setLogoUrl(result.info.secure_url);
        }
      }
    );
  }, []);

  const [fabOpen, setFabOpen] = useState(false);
  const fabFileInputRef = useRef<HTMLInputElement>(null);
  const [fabCategory, setFabCategory] = useState<"progress" | "incident" | "health_safety">("progress");
  const [fabIncidentToolModal, setFabIncidentToolModal] = useState<{ entryId: string; projectId: string } | null>(null);
  const [fabLinkedToolId, setFabLinkedToolId] = useState<string>("");
  const [fabIncidentNotes, setFabIncidentNotes] = useState<string>("");

  const [activeSection, setActiveSection] = useState<MainSection>("office");
  const [operationsMainTab, setOperationsMainTab] = useState<"projects" | "subcontractors">("projects");
  const [correctivePrefill, setCorrectivePrefill] = useState<CorrectiveActionsPrefill | null>(null);
  const [focusHazardId, setFocusHazardId] = useState<string | null>(null);
  const [dashHazardCreateSig, setDashHazardCreateSig] = useState(0);
  const [dashActionCreateSig, setDashActionCreateSig] = useState(0);
  const [securityInitialTab, setSecurityInitialTab] = useState<SecurityTabId | null>(null);
  const [dashVisitorQrSig, setDashVisitorQrSig] = useState(0);
  const [dashVisitorTabSig, setDashVisitorTabSig] = useState(0);
  const [projectsOpenRfiSig, setProjectsOpenRfiSig] = useState(0);
  const [settingsHelpFocusSignal, setSettingsHelpFocusSignal] = useState(0);
  const openSettingsHelpFromFab = useCallback(() => {
    setActiveSection("settings");
    setSettingsHelpFocusSignal((n) => n + 1);
  }, []);
  const consumeCorrectivePrefill = useCallback(() => setCorrectivePrefill(null), []);
  const resetSecurityDashSignals = useCallback(() => {
    setDashHazardCreateSig(0);
    setDashActionCreateSig(0);
  }, []);

  useEffect(() => {
    if (activeSection !== "security") {
      resetSecurityDashSignals();
      setSecurityInitialTab(null);
    }
  }, [activeSection, resetSecurityDashSignals]);
  const [currentUserRole] = useState<UserRole>("admin");
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const activeEmployees = useMemo(
    () => (employees ?? []).filter(isActiveProfileEmployee),
    [employees]
  );
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>(INITIAL_SCHEDULE);
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
  /** Fichajes desde `time_entries` (Supabase); se fusionan con fichajes locales. */
  const [dbClockEntries, setDbClockEntries] = useState<ClockEntry[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequestRow[]>([]);
  /** user_profiles.id → employees.id */
  const [userToEmployeeMap, setUserToEmployeeMap] = useState<Record<string, string>>({});
  const userIdToEmployeeIdRef = useRef<Map<string, string>>(new Map());
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>(() => {
    if (typeof window === "undefined") return INITIAL_FORM_TEMPLATES;
    try {
      const raw = localStorage.getItem("machinpro_formTemplates");
      const saved = raw ? (JSON.parse(raw) as FormTemplate[]) : [];
      const customTemplates = Array.isArray(saved) ? saved.filter((t) => !t.isBase) : [];
      return [...INITIAL_FORM_TEMPLATES, ...customTemplates];
    } catch {
      return INITIAL_FORM_TEMPLATES;
    }
  });
  const [formInstances, setFormInstances] = useState<FormInstance[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("machinpro_form_instances");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as FormInstance[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [binders, setBinders] = useState<Binder[]>(INITIAL_BINDERS);
  const [binderDocuments, setBinderDocuments] = useState<BinderDocument[]>([]);

  const displayClockEntries = useMemo(() => {
    const map = new Map<string, ClockEntry>();
    for (const c of clockEntries) {
      map.set(`${c.employeeId}|${c.date}`, c);
    }
    for (const d of dbClockEntries) {
      map.set(`${d.employeeId}|${d.date}`, d);
    }
    return Array.from(map.values());
  }, [dbClockEntries, clockEntries]);

  useEffect(() => {
    if (!supabase || !session || !companyId) {
      setDbClockEntries([]);
      setVacationRequests([]);
      setUserToEmployeeMap({});
      userIdToEmployeeIdRef.current = new Map();
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: profiles, error: profilesErr } = await supabase
        .from("user_profiles")
        .select("id, employee_id")
        .eq("company_id", companyId);
      if (profilesErr) {
        console.error("[page] user_profiles (clock map)", profilesErr);
      }
      if (cancelled) return;
      const userToEmp = new Map<string, string>();
      const o: Record<string, string> = {};
      for (const p of profiles ?? []) {
        const row = p as { id: string; employee_id: string | null };
        if (row.employee_id) {
          userToEmp.set(row.id, row.employee_id);
          o[row.id] = row.employee_id;
        }
      }
      userIdToEmployeeIdRef.current = userToEmp;
      setUserToEmployeeMap(o);
      const { data: rows, error: timeErr } = await supabase
        .from("time_entries")
        .select("id, user_id, project_id, clock_in_at, clock_out_at, status")
        .eq("company_id", companyId)
        .order("clock_in_at", { ascending: false })
        .limit(500);
      if (timeErr) {
        console.error("[page] time_entries load", timeErr);
      }
      if (cancelled || !rows) return;
      const pad = (n: number) => String(n).padStart(2, "0");
      const mapped: ClockEntry[] = (rows as Record<string, unknown>[]).map((row) => {
        const userId = String(row.user_id);
        const inD = new Date(String(row.clock_in_at));
        const dateStr = `${inD.getFullYear()}-${pad(inD.getMonth() + 1)}-${pad(inD.getDate())}`;
        const clockIn = `${pad(inD.getHours())}:${pad(inD.getMinutes())}`;
        let clockOut: string | undefined;
        if (row.clock_out_at) {
          const outD = new Date(String(row.clock_out_at));
          clockOut = `${pad(outD.getHours())}:${pad(outD.getMinutes())}`;
        }
        const empId = userToEmp.get(userId) ?? userId;
        return {
          id: String(row.id),
          employeeId: empId,
          projectId: row.project_id != null ? String(row.project_id) : undefined,
          date: dateStr,
          clockIn,
          clockOut,
        };
      });
      setDbClockEntries(mapped);
      const { data: vac } = await supabase
        .from("vacation_requests")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!cancelled && vac) setVacationRequests(vac as VacationRequestRow[]);
      const { data: schedRows, error: schedErr } = await supabase
        .from("schedule_entries")
        .select("*")
        .eq("company_id", companyId)
        .limit(4000);
      const schedVac =
        !schedErr && schedRows?.length
          ? (schedRows as Record<string, unknown>[]).filter((row) => {
              const st = String(row.type ?? "");
              const el = row.event_label != null ? String(row.event_label) : "";
              return st === "vacation" || (st === "event" && el === "vacation");
            })
          : [];
      if (!cancelled && !schedErr && schedVac.length) {
        const mapped: ScheduleEntry[] = schedVac.map((row) => {
          const st = String(row.start_time ?? "00:00");
          const et = String(row.end_time ?? "23:59");
          return {
            id: String(row.id),
            type: "vacation" as const,
            employeeIds: Array.isArray(row.employee_ids) ? (row.employee_ids as string[]) : [],
            projectId: row.project_id != null ? String(row.project_id) : undefined,
            projectCode: row.project_code != null ? String(row.project_code) : undefined,
            date: String(row.date).slice(0, 10),
            startTime: st.length >= 5 ? st.slice(0, 5) : st,
            endTime: et.length >= 5 ? et.slice(0, 5) : et,
            notes: row.notes != null ? String(row.notes) : undefined,
            eventLabel: "vacation",
            createdBy: row.created_by != null ? String(row.created_by) : "",
          };
        });
        setScheduleEntries((prev) => [...prev.filter((e) => e.type !== "vacation"), ...mapped]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, companyId]);

  useEffect(() => {
    if (!supabase || !session || !companyId) return;
    const client = supabase;
    const loadEmployees = async () => {
      const { data, error } = await client
        .from("user_profiles")
        .select(
          "id, full_name, display_name, email, role, phone, pay_type, pay_amount, pay_period, custom_role_id, custom_permissions, use_role_permissions, created_at, certificates, profile_status"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[page] user_profiles (employees state)", error);
        return;
      }
      if (!data?.length) return;
      setEmployees(
        data.map((row: Record<string, unknown>) => {
          const id = String(row.id);
          const fn = row.full_name != null ? String(row.full_name).trim() : "";
          const dn = row.display_name != null ? String(row.display_name).trim() : "";
          const em = row.email != null ? String(row.email).trim() : "";
          const name =
            fn ||
            dn ||
            (em.includes("@") ? em.split("@")[0]!.trim() : em) ||
            id.slice(0, 8);
          const role = String(row.role ?? "worker");
          let payType: Employee["payType"] | undefined;
          const pt = String(row.pay_type ?? "").toLowerCase();
          if (pt === "hourly") payType = "hourly";
          else if (pt === "fixed" || pt === "salary") payType = "salary";
          let hourlyRate: number | undefined;
          let monthlySalary: number | undefined;
          const payAmt = row.pay_amount != null ? Number(row.pay_amount) : undefined;
          if (payType === "hourly" && payAmt != null && Number.isFinite(payAmt)) hourlyRate = payAmt;
          if (payType === "salary" && payAmt != null && Number.isFinite(payAmt)) monthlySalary = payAmt;
          return {
            id,
            name,
            role,
            profileStatus: row.profile_status != null ? String(row.profile_status) : "active",
            hours: typeof row.hours === "number" ? row.hours : Number(row.hours) || 0,
            payType,
            hourlyRate,
            monthlySalary,
            phone: row.phone != null ? String(row.phone) : undefined,
            email: em || undefined,
            certificates: certificatesFromProfileJson(row.certificates),
            hoursLog: [],
            customRoleId: row.custom_role_id != null ? String(row.custom_role_id) : undefined,
            customPermissions: row.custom_permissions as Employee["customPermissions"],
            useRolePermissions:
              row.use_role_permissions != null ? Boolean(row.use_role_permissions) : undefined,
          };
        })
      );
    };
    void loadEmployees();
  }, [session, companyId]);

  useEffect(() => {
    if (!supabase || !session) {
      setCustomRoles(INITIAL_CUSTOM_ROLES);
      return;
    }
    if (!companyId) return;
    const cid = companyId;
    let cancelled = false;
    void (async () => {
      const { data: rows, error } = await supabase
        .from("roles")
        .select("*")
        .eq("company_id", cid)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[page] roles load", error);
        return;
      }
      let list = (rows ?? []) as RolesTableRow[];
      if (list.length === 0) {
        const fromLs = readLegacyCustomRolesFromLocalStorage();
        const seedRows = fromLs?.length
          ? fromLs.map((r) => ({
              company_id: cid,
              name: r.name,
              color: r.color,
              permissions: r.permissions,
              is_system: r.isSystem === true,
            }))
          : INITIAL_CUSTOM_ROLES.map((r) => ({
              company_id: cid,
              name: r.name,
              color: r.color,
              permissions: r.permissions,
              is_system: true,
            }));
        const { data: inserted, error: insErr } = await supabase.from("roles").insert(seedRows).select("*");
        if (cancelled) return;
        if (insErr) {
          console.error("[page] roles seed", insErr);
          setCustomRoles(INITIAL_CUSTOM_ROLES);
          return;
        }
        clearLegacyCustomRolesLocalStorage();
        list = (inserted ?? []) as RolesTableRow[];
      }
      setCustomRoles(list.map(customRoleFromSupabaseRow));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, session, companyId]);

  useEffect(() => {
    if (!supabase || !session || !companyId) return;
    const client = supabase;
    const loadProjects = async () => {
      const { data, error } = await client.from("projects").select("*").eq("company_id", companyId);
      if (error) {
        console.error("[page] projects", error);
        return;
      }
      if (!data?.length) {
        setProjects([]);
        return;
      }
      setProjects(
        data.map((p: Record<string, unknown>) => ({
          id: String(p.id),
          name: String(p.name),
          type: String(p.type ?? ""),
          location: String(p.location ?? ""),
          projectCode: p.project_code != null ? String(p.project_code) : undefined,
          budgetCAD: p.budget_cad != null ? Number(p.budget_cad) : undefined,
          spentCAD: p.spent_cad != null ? Number(p.spent_cad) : undefined,
          estimatedStart: String(p.estimated_start ?? ""),
          estimatedEnd: String(p.estimated_end ?? ""),
          locationLat: p.location_lat != null ? Number(p.location_lat) : undefined,
          locationLng: p.location_lng != null ? Number(p.location_lng) : undefined,
          archived: Boolean(p.archived),
          assignedEmployeeIds: Array.isArray(p.assigned_employee_ids)
            ? (p.assigned_employee_ids as string[])
            : [],
        }))
      );
    };
    void loadProjects();
  }, [session, companyId]);

  const [isOnline, setIsOnline] = useState(true);

  const [pendingSync, setPendingSync] = useState<PendingSync[]>(() => {
    try {
      const raw = localStorage.getItem("machinpro_pending_sync");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("machinpro_pending_sync", JSON.stringify(pendingSync));
    } catch {}
  }, [pendingSync]);

  const addToPendingSync = useCallback((type: PendingSync["type"], data: unknown) => {
    const entry: PendingSync = {
      id: crypto.randomUUID(),
      type,
      data,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    setPendingSync((prev) => [...prev, entry]);
  }, []);

  const pendingSyncRef = useRef(pendingSync);
  pendingSyncRef.current = pendingSync;

  const syncPendingData = useCallback(async () => {
    if (!isOnline || !supabase || pendingSyncRef.current.length === 0) return;
    const toSync = [...pendingSyncRef.current];
    const synced: string[] = [];
    const failed: string[] = [];

    for (const item of toSync) {
      try {
        if (item.type === "form_instance") {
          const instance = item.data as FormInstance;
          await supabase.from("form_instances").upsert(instance);
          synced.push(item.id);
        }
        if (item.type === "clock_entry") {
          const entry = item.data as ClockEntry;
          await supabase.from("clock_entries").upsert(entry);
          synced.push(item.id);
        }
      } catch {
        failed.push(item.id);
        setPendingSync((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, attempts: p.attempts + 1 } : p
          )
        );
      }
    }

    if (synced.length > 0) {
      setPendingSync((prev) => prev.filter((p) => !synced.includes(p.id)));
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && pendingSync.length > 0) {
      syncPendingData();
    }
  }, [isOnline, syncPendingData, pendingSync.length]);

  useEffect(() => {
    try {
      localStorage.setItem("machinpro_form_instances", JSON.stringify(formInstances));
    } catch {}
  }, [formInstances]);

  useEffect(() => {
    try {
      const customOnly = formTemplates.filter((t) => !t.isBase);
      localStorage.setItem("machinpro_formTemplates", JSON.stringify(customOnly));
    } catch {}
  }, [formTemplates]);

  useEffect(() => {
    try {
      localStorage.setItem("machinpro_employee_docs", JSON.stringify(employeeDocs));
    } catch {}
  }, [employeeDocs]);

  const [warehouseSubTab, setWarehouseSubTab] = useState<WarehouseSubTabId>("inventory");
  const [warehouseSectionsEnabled, setWarehouseSectionsEnabled] = useState({
    inventory: true,
    fleet: true,
    rentals: true,
    suppliers: true,
  });
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => {
    if (typeof window === "undefined") return INITIAL_INVENTORY;
    try {
      const raw = localStorage.getItem("machinpro_inventory");
      if (!raw) return INITIAL_INVENTORY;
      const parsed = JSON.parse(raw) as InventoryItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_INVENTORY;
      return parsed;
    } catch { return INITIAL_INVENTORY; }
  });
  const [inventoryMovements] = useState<InventoryMovement[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    if (typeof window === "undefined") return INITIAL_VEHICLES;
    try {
      const raw = localStorage.getItem("machinpro_vehicles");
      if (!raw) return INITIAL_VEHICLES;
      const parsed = JSON.parse(raw) as Vehicle[];
      if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_VEHICLES;
      return parsed;
    } catch { return INITIAL_VEHICLES; }
  });
  const [rentals, setRentals] = useState<Rental[]>(() => {
    if (typeof window === "undefined") return INITIAL_RENTALS;
    try {
      const raw = localStorage.getItem("machinpro_rentals");
      if (!raw) return INITIAL_RENTALS;
      const parsed = JSON.parse(raw) as Rental[];
      if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_RENTALS;
      return parsed;
    } catch { return INITIAL_RENTALS; }
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    if (typeof window === "undefined") return INITIAL_SUPPLIERS;
    try {
      const raw = localStorage.getItem("machinpro_suppliers");
      if (!raw) return INITIAL_SUPPLIERS;
      const parsed = JSON.parse(raw) as Supplier[];
      if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_SUPPLIERS;
      return parsed;
    } catch { return INITIAL_SUPPLIERS; }
  });
  const [requestModalProjectId, setRequestModalProjectId] = useState<string | null>(null);
  const [requestNeededBy, setRequestNeededBy] = useState<string>("");
  const [requestNotes, setRequestNotes] = useState<string>("");
  const [requestQuantities, setRequestQuantities] = useState<Record<string, number>>({});
  const [requestExternal, setRequestExternal] = useState<string>("");

  const handleUpdateRequestStatus = (id: string, status: ResourceRequestStatus) => {
    setResourceRequests((prev) => {
      const next = prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              ...(status === "dispatched" ? { dispatchedAt: new Date().toISOString() } : {}),
            }
          : r
      );
      try {
        localStorage.setItem("machinpro_resource_requests", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleMarkResourceItemReady = (requestId: string, itemId: string) => {
    setResourceRequests((prev) => {
      const next = prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              items: r.items.map((it) =>
                it.id === itemId
                  ? {
                      ...it,
                      status: (it.status === "ready" ? "pending" : "ready") as ResourceRequestItemStatus,
                    }
                  : it
              ),
            }
          : r
      );
      try {
        localStorage.setItem("machinpro_resource_requests", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleConfirmReception = (requestId: string) => {
    const target = resourceRequests.find((r) => r.id === requestId);
    if (!target) return;
    setInventoryItems((prev) => {
      const next = prev.map((item) => {
        const reqItem = target.items.find((ri) => ri.inventoryItemId === item.id);
        if (!reqItem) return item;
        if (reqItem.type === "tool" || reqItem.type === "equipment") {
          return {
            ...item,
            assignedToProjectId: target.projectId,
            toolStatus: "in_use" as const,
          };
        }
        if (reqItem.type === "consumable" || reqItem.type === "material") {
          return {
            ...item,
            quantity: Math.max(0, item.quantity - reqItem.quantity),
          };
        }
        return item;
      });
      try {
        localStorage.setItem("machinpro_inventory", JSON.stringify(next));
      } catch {}
      return next;
    });
    setResourceRequests((prev) => {
      const next = prev.map((r) =>
        r.id === requestId
          ? { ...r, status: "received" as const, receivedAt: new Date().toISOString() }
          : r
      );
      try {
        localStorage.setItem("machinpro_resource_requests", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const submitResourceRequest = () => {
    if (!requestModalProjectId) return;
    const items: ResourceRequestItem[] = [];
    inventoryItems.forEach((i) => {
      const qty = requestQuantities[i.id] ?? 0;
      if (qty > 0) {
        items.push({
          id: "reqItem_" + Date.now() + "_" + i.id,
          type: i.type === "material" ? "material" : i.type,
          inventoryItemId: i.id,
          name: i.name,
          quantity: qty,
          unit: i.unit,
          status: "pending",
        });
      }
    });
    if (requestExternal.trim()) {
      items.push({
        id: "reqItem_ext_" + Date.now(),
        type: "consumable",
        name: requestExternal.trim(),
        quantity: 1,
        unit: "",
        status: "pending",
      });
    }
    if (!items.length) return;
    const newReq: ResourceRequest = {
      id: "req_" + Date.now(),
      projectId: requestModalProjectId,
      requestedBy: effectiveEmployeeId ?? "unknown",
      requestedByName:
        employees.find((e) => e.id === effectiveEmployeeId)?.name ?? "Supervisor",
      neededBy: requestNeededBy || new Date().toISOString().slice(0, 10),
      status: "pending",
      items,
      notes: requestNotes || undefined,
      createdAt: new Date().toISOString(),
    };
    setResourceRequests((prev) => {
      const next = [...prev, newReq];
      try {
        localStorage.setItem("machinpro_resource_requests", JSON.stringify(next));
      } catch {}
      return next;
    });
    setRequestModalProjectId(null);
    setRequestNeededBy("");
    setRequestNotes("");
    setRequestQuantities({});
    setRequestExternal("");
  };
  const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>(() => {
    try {
      if (typeof window === "undefined") return [];
      return JSON.parse(localStorage.getItem("machinpro_resource_requests") ?? "[]") as ResourceRequest[];
    } catch {
      return [];
    }
  });
  const [adjustModal, setAdjustModal] = useState<{ itemId: string; type: "add" | "remove" } | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const [projectForms, setProjectForms] = useState<ProjectForm[]>(() => {
    try {
      const saved = localStorage.getItem("machinpro_project_forms");
      return saved ? (JSON.parse(saved) as ProjectForm[]) : [];
    } catch {
      return [];
    }
  });

  const [safetyChecklists, setSafetyChecklists] = useState<SafetyChecklist[]>(() => {
    try {
      const raw = localStorage.getItem("machinpro_safety_checklists");
      return raw ? (JSON.parse(raw) as SafetyChecklist[]) : [];
    } catch {
      return [];
    }
  });

  const [dailyReports, setDailyReports] = useState<DailyFieldReport[]>([]);
  const [teamProfiles, setTeamProfiles] = useState<
    { id: string; employeeId: string | null; name: string; email?: string }[]
  >([]);

  const reloadDailyReports = useCallback(async () => {
    if (!supabase || !companyId) {
      setDailyReports([]);
      return;
    }
    const rows = await fetchDailyReportsForCompany(supabase, companyId);
    setDailyReports(rows);
  }, [companyId]);

  useEffect(() => {
    if (!supabase || !session || !companyId) {
      setTeamProfiles([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, employee_id, full_name, display_name, email, profile_status")
        .eq("company_id", companyId);
      if (error) {
        console.error("[page] teamProfiles load", error);
        if (!cancelled) setTeamProfiles([]);
        return;
      }
      if (cancelled) return;
      const activeRows = (data ?? []).filter((row: Record<string, unknown>) => {
        const st = String(row.profile_status ?? "active").toLowerCase().trim();
        return st === "active";
      });
      setTeamProfiles(
        activeRows.map((row: Record<string, unknown>) => {
          const id = String(row.id ?? "");
          const fn = typeof row.full_name === "string" ? row.full_name.trim() : "";
          const dn = typeof row.display_name === "string" ? row.display_name.trim() : "";
          const em = typeof row.email === "string" ? row.email.trim() : "";
          const name = fn || dn || em || "";
          return {
            id,
            employeeId: row.employee_id != null ? String(row.employee_id) : null,
            name,
            email: em || undefined,
          };
        })
      );
      } catch (e) {
        console.error("[page] teamProfiles", e);
        if (!cancelled) setTeamProfiles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, session, companyId]);

  useEffect(() => {
    void reloadDailyReports();
  }, [reloadDailyReports]);

  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>(() => {
    try {
      const saved = localStorage.getItem("machinpro_project_tasks");
      return saved ? (JSON.parse(saved) as ProjectTask[]) : [];
    } catch {
      return [];
    }
  });

  const [siteSelectedProjectId, setSiteSelectedProjectId] = useState<string | null>(null);
  const [siteDiaryNotesDraft, setSiteDiaryNotesDraft] = useState("");

  const [clockInProjectCode, setClockInProjectCode] = useState("");
  const [clockInGpsStatus, setClockInGpsStatus] = useState<"idle" | "locating" | "ok" | "alert" | "no_gps">("idle");
  const [clockInAlertMessage, setClockInAlertMessage] = useState<string | null>(null);
  const [employeeShiftDayOpen, setEmployeeShiftDayOpen] = useState<{ date: string; entryId: string } | null>(null);

  /** null = aún no hidratado desde localStorage (evita sobrescribir la clave antes de leerla). */
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const checkWidth = () => setSidebarCollapsed(typeof window !== "undefined" && window.innerWidth < 1024);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (profile?.companyName && !companyName) setCompanyName(profile.companyName);
  }, [profile?.companyName]);

  useEffect(() => {
    if (!supabase || !companyId || !session) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("name, logo_url, address, phone, email, website")
        .eq("id", companyId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const row = data as Record<string, unknown>;
      if (typeof row.name === "string") setCompanyName(row.name);
      if (typeof row.logo_url === "string" && row.logo_url.trim()) setLogoUrl(row.logo_url.trim());
      const addr = row.address;
      const ph = row.phone;
      const em = row.email;
      const web = row.website;
      setCompanyAddress(typeof addr === "string" ? addr : "");
      setCompanyPhone(typeof ph === "string" ? ph : "");
      setCompanyEmail(typeof em === "string" ? em : "");
      setCompanyWebsite(typeof web === "string" ? web : "");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, companyId, session]);

  const handleSaveCompanyProfile = useCallback(async () => {
    if (!companyId || !session?.access_token) return;
    setCompanyProfileSaveBusy(true);
    try {
      const res = await fetch("/api/onboarding/company", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          companyId,
          name: companyName.trim(),
          country: companyCountry,
          currency,
          language,
          logo_url: logoUrl.trim() || null,
          address: companyAddress.trim() || null,
          phone: companyPhone.trim() || null,
          email: companyEmail.trim() || null,
          website: companyWebsite.trim() || null,
        }),
      });
      if (!res.ok) return;
      await syncSession();
    } finally {
      setCompanyProfileSaveBusy(false);
    }
  }, [
    companyId,
    session?.access_token,
    companyName,
    companyCountry,
    currency,
    language,
    logoUrl,
    companyAddress,
    companyPhone,
    companyEmail,
    companyWebsite,
    syncSession,
  ]);

  // Efecto 1: leer preferencia guardada al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem("machinpro_dark_mode");
      if (saved === "1") {
        setDarkMode(true);
      } else if (saved === "0") {
        setDarkMode(false);
      } else {
        // Sin preferencia guardada: usar preferencia del sistema
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        setDarkMode(prefersDark);
      }
    } catch {
      setDarkMode(false);
    }
  }, []);

  // Efecto 2: aplicar clase en <html> y guardar solo tras hidratar (el primer render con false ejecutaba esto antes de leer localStorage y borraba "1").
  useEffect(() => {
    if (darkMode === null) return;
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("machinpro_dark_mode", darkMode ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem("machinpro_project_forms", JSON.stringify(projectForms));
    } catch {}
  }, [projectForms]);

  useEffect(() => {
    try {
      localStorage.setItem("machinpro_safety_checklists", JSON.stringify(safetyChecklists));
    } catch {}
  }, [safetyChecklists]);

  useEffect(() => {
    try {
      localStorage.setItem("machinpro_project_tasks", JSON.stringify(projectTasks));
    } catch {}
  }, [projectTasks]);

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Usar el rol real de Supabase si está disponible.
  // Mantener el simulador solo si no hay perfil (modo dev local).
  const effectiveRole: UserRole = (profile?.role as UserRole) ?? currentUserRole;
  const effectiveEmployeeId: string | null = profile?.employeeId ?? null;
  const workerEmployeeId = effectiveRole === "worker" ? effectiveEmployeeId : null;

  const clearPendingOpenEmployee = useCallback(() => setPendingOpenEmployeeId(null), []);

  const criticalComplianceCount = useMemo(
    () => complianceAlerts.filter((a) => a.severity !== "warning").length,
    [complianceAlerts]
  );

  useEffect(() => {
    if (!employees || employees.length === 0) {
      setComplianceAlerts([]);
      return;
    }
    const alerts = runComplianceWatchdog(employees as CentralEmployee[]);
    setComplianceAlerts(alerts);
    if (shouldRunWatchdog()) {
      setLastWatchdogRun();
      if (alerts.length > 0) {
        console.log(`[ComplianceWatchdog] ${alerts.length} alertas encontradas`);
      }
    }
  }, [employees]);

  useEffect(() => {
    if (!complianceNotifOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = complianceNotifRef.current;
      if (el && !el.contains(e.target as Node)) setComplianceNotifOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [complianceNotifOpen]);

  const handleFabFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log("FAB triggered - siteSelectedProjectId:", siteSelectedProjectId);
      console.log("FAB triggered - projects:", projects?.map((p) => p.id + ":" + p.name));
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      const projectId = siteSelectedProjectId ?? projects[0]?.id;
      if (!projectId) return;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "");
      formData.append("folder", "machinpro/photos");

      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: "POST", body: formData }
        );
        const data = (await res.json()) as { secure_url?: string };
        const url = data.secure_url;
        console.log("FAB URL recibida:", url);
        console.log("projectId:", projectId);
        console.log("fabCategory:", fabCategory);
        if (url && companyId) {
          const newId = await uploadPhoto({
            projectId,
            projectName: (projects ?? []).find((p) => p.id === projectId)?.name ?? "",
            photoUrl: url,
            photoCategory: fabCategory,
            photoType: "obra",
            submittedByEmployeeId: effectiveEmployeeId ?? undefined,
            submittedByName: (employees ?? []).find((e) => e.id === effectiveEmployeeId)?.name ?? "Unknown",
            notes: siteDiaryNotesDraft,
            companyId,
          });
          if (fabCategory === "incident" && newId) {
            setFabIncidentToolModal({ entryId: newId, projectId });
            setFabLinkedToolId("");
            setFabIncidentNotes("");
          }
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    },
    [
      siteSelectedProjectId,
      projects,
      employees,
      siteDiaryNotesDraft,
      effectiveEmployeeId,
      fabCategory,
      companyId,
      uploadPhoto,
    ]
  );

  const openFabPhotoWidget = useCallback((category: "progress" | "incident" | "health_safety") => {
    setFabOpen(false);
    setFabCategory(category);
    fabFileInputRef.current?.click();
  }, []);

  const handleFabPhotoProgress = useCallback(() => openFabPhotoWidget("progress"), [openFabPhotoWidget]);
  const handleFabPhotoIncident = useCallback(() => openFabPhotoWidget("incident"), [openFabPhotoWidget]);
  const handleFabPhotoHS = useCallback(() => openFabPhotoWidget("health_safety"), [openFabPhotoWidget]);

  const confirmFabToolLink = useCallback(() => {
    if (!fabIncidentToolModal || !fabLinkedToolId) return;
    const entry = photos.find((p) => p.id === fabIncidentToolModal.entryId);
    const photoUrl = entry?.photo_url;
    if (!photoUrl) {
      setFabIncidentToolModal(null);
      setFabLinkedToolId("");
      setFabIncidentNotes("");
      return;
    }
    const trModal = t;
    const noteSuffix =
      fabIncidentNotes.trim() || (trModal.incidentReportedOnSite ?? "Incidencia reportada en obra");
    if (fabLinkedToolId !== "__free__") {
      setInventoryItems((prev) => {
        const next = prev.map((i) =>
          i.id === fabLinkedToolId
            ? {
                ...i,
                toolStatus: "maintenance" as const,
                incidentPhotoUrl: photoUrl,
                incidentEntryId: fabIncidentToolModal.entryId,
              }
            : i
        );
        try { localStorage.setItem("machinpro_inventory", JSON.stringify(next)); } catch {}
        return next;
      });
      setAssetUsageLogs((prev) =>
        prev.map((log) =>
          log.assetType === "tool" && log.assetId === fabLinkedToolId && !log.endDate
            ? { ...log, notes: (log.notes ? log.notes + "\n" : "") + noteSuffix }
            : log
        )
      );
    }
    setFabIncidentToolModal(null);
    setFabLinkedToolId("");
    setFabIncidentNotes("");
  }, [fabIncidentToolModal, fabLinkedToolId, photos, fabIncidentNotes, language, t]);

  // Inventario: formulario añadir/editar
  const [newItemFormOpen, setNewItemFormOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<"consumable" | "tool" | "equipment" | "material">("material");
  const [newItemSerialNumber, setNewItemSerialNumber] = useState("");
  const [newItemInternalId, setNewItemInternalId] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState("");
  const [newItemAssignedProjectId, setNewItemAssignedProjectId] = useState("");
  const [newItemAssignedEmployeeId, setNewItemAssignedEmployeeId] = useState("");
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [editInventoryDraft, setEditInventoryDraft] = useState<Partial<InventoryItem> | null>(null);

  // Flota: formulario añadir/editar
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleDraft, setVehicleDraft] = useState<Partial<Vehicle>>({});
  const [assetUsageLogs, setAssetUsageLogs] = useState<AssetUsageLog[]>([]);

  // Alquileres: formulario
  const [rentalFormOpen, setRentalFormOpen] = useState(false);
  const [editingRentalId, setEditingRentalId] = useState<string | null>(null);
  const [rentalDraft, setRentalDraft] = useState<Partial<Rental>>({});

  // Proveedores: formulario
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierDraft, setSupplierDraft] = useState<Partial<Supplier>>({});

  const [subcontractorCountryCode, setSubcontractorCountryCode] = useState("CA");

  // Empleado: modal añadir/editar
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | "new" | null>(null);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState("worker");
  const [newEmployeeHours, setNewEmployeeHours] = useState("");
  const [newEmployeePayType, setNewEmployeePayType] = useState<"hourly" | "salary">("hourly");
  const [newEmployeeHourlyRate, setNewEmployeeHourlyRate] = useState("");
  const [newEmployeeMonthlySalary, setNewEmployeeMonthlySalary] = useState("");
  const [newEmployeeCustomRoleId, setNewEmployeeCustomRoleId] = useState("");
  const [newEmployeeRoleMode, setNewEmployeeRoleMode] = useState<"list" | "custom">("list");

  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectFormName, setProjectFormName] = useState("");
  const [projectFormCode, setProjectFormCode] = useState("");
  const [projectFormType, setProjectFormType] = useState<ProjectType>("residential");
  const [projectFormLocation, setProjectFormLocation] = useState("");
  const [projectFormBudget, setProjectFormBudget] = useState("");
  const [projectFormStart, setProjectFormStart] = useState("");
  const [projectFormEnd, setProjectFormEnd] = useState("");
  const [projectFormLifecycle, setProjectFormLifecycle] = useState<"active" | "paused" | "completed">("active");
  const [projectFormLat, setProjectFormLat] = useState("");
  const [projectFormLng, setProjectFormLng] = useState("");

  const countryConfig = useMemo(() => getCountryConfig(companyCountry), [companyCountry]);
  const activeCustomRole = useMemo(() => {
    if (!customRoles.length) {
      const fallbackLegacyId =
        effectiveRole === "projectManager" ? "role-supervisor" : `role-${effectiveRole}`;
      return (
        INITIAL_CUSTOM_ROLES.find((r) => r.id === fallbackLegacyId) ?? INITIAL_CUSTOM_ROLES[0]!
      );
    }
    return resolveActiveCustomRole(customRoles, effectiveRole, profile?.customRoleId);
  }, [customRoles, effectiveRole, profile?.customRoleId]);
  const rolePerms = useMemo(
    () => (effectiveRole === "admin" ? fullAdministratorPermissions() : activeCustomRole.permissions),
    [effectiveRole, activeCustomRole.permissions]
  );
  const perms = useMemo(() => {
    const base = permissionsToModule(rolePerms);
    return applyPlanToModulePermissions(base, subscriptionRow?.plan ?? null, {
      subscriptionStatus: subscriptionRow?.status ?? null,
    });
  }, [rolePerms, subscriptionRow?.plan, subscriptionRow?.status]);

  const criticalInventoryCount = useMemo(
    () =>
      inventoryItems.filter(
        (i) =>
          i.quantity <= 0 ||
          (i.lowStockThreshold != null &&
            i.lowStockThreshold > 0 &&
            i.quantity <= i.lowStockThreshold)
      ).length,
    [inventoryItems]
  );

  const currentUserEmployeeId = effectiveRole === "worker" ? effectiveEmployeeId : effectiveRole === "supervisor" ? effectiveEmployeeId : null;
  /** Admins (y project managers) ven todos los proyectos; el flag canViewOnlyAssignedProjects también es true en admin y no debe vaciar la lista. */
  const visibleProjects =
    effectiveRole === "admin" || effectiveRole === "projectManager"
      ? (projects ?? [])
      : rolePerms.canViewOnlyAssignedProjects
        ? (projects ?? []).filter((p) =>
            (p.assignedEmployeeIds ?? []).includes(effectiveEmployeeId ?? "")
          )
        : (projects ?? []);

  const canViewProjectsTab =
    rolePerms.canViewProjects || rolePerms.canViewOnlyAssignedProjects;

  useEffect(() => {
    if (activeSection !== "site") return;
    if (!canViewProjectsTab && perms.canAccessSubcontractors) {
      setOperationsMainTab("subcontractors");
    }
  }, [activeSection, canViewProjectsTab, perms.canAccessSubcontractors]);

  useEffect(() => {
    if (activeSection === "site" && !perms.site) {
      setActiveSection("office");
      return;
    }
    if (activeSection === "warehouse" && !perms.warehouse) {
      setActiveSection("office");
      return;
    }
    if (activeSection === "security" && !(perms.canAccessSecurity ?? false)) {
      setActiveSection("office");
      return;
    }
    if (activeSection === "schedule" && perms.canAccessSchedule === false) {
      setActiveSection("office");
    }
  }, [
    activeSection,
    perms.site,
    perms.warehouse,
    perms.canAccessSecurity,
    perms.canAccessSchedule,
  ]);

  const openOperationsSubcontractors = useCallback(() => {
    setActiveSection("site");
    setOperationsMainTab("subcontractors");
  }, []);

  const navigateToSiteVisitorsTab = useCallback(
    (opts?: { openQr?: boolean }) => {
      if (!perms.site) return;
      const vp = visibleProjects ?? [];
      const first = vp.find((p) => !p.archived)?.id ?? vp[0]?.id ?? null;
      if (first) setSiteSelectedProjectId(first);
      setActiveSection("site");
      if (opts?.openQr) setDashVisitorQrSig((n) => n + 1);
      else setDashVisitorTabSig((n) => n + 1);
    },
    [perms.site, visibleProjects]
  );

  const scheduleSelfIds = useMemo(
    () => [profile?.id, effectiveEmployeeId].filter((x): x is string => !!x),
    [profile?.id, effectiveEmployeeId]
  );

  const assignedClockInProjects = useMemo(() => {
    const ids = new Set(scheduleSelfIds);
    return (projects ?? [])
      .filter(
        (p) =>
          !p.archived && (p.assignedEmployeeIds ?? []).some((eid) => ids.has(eid))
      )
      .map((p) => ({ id: p.id, name: p.name, projectCode: p.projectCode }));
  }, [projects, scheduleSelfIds]);

  const [profileEditName, setProfileEditName] = useState("");
  const [profileEditPhone, setProfileEditPhone] = useState("");
  const [profileEditAvatarUrl, setProfileEditAvatarUrl] = useState("");
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);
  const [passwordResetBusy, setPasswordResetBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setProfileEditName(profile.fullName ?? "");
    setProfileEditPhone(profile.phone ?? "");
    setProfileEditAvatarUrl(profile.avatarUrl ?? "");
  }, [profile?.id, profile?.fullName, profile?.phone, profile?.avatarUrl]);

  const handleProfileAvatarUpload = useCallback(() => {
    if (typeof window === "undefined") return;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) return;
    const cloudinary = (
      window as unknown as {
        cloudinary?: {
          openUploadWidget: (
            options: unknown,
            callback: (
              error: unknown,
              result: { event?: string; info?: { secure_url: string } }
            ) => void
          ) => void;
        };
      }
    ).cloudinary;
    if (!cloudinary?.openUploadWidget) return;
    cloudinary.openUploadWidget(
      {
        cloudName,
        uploadPreset,
        sources: ["local", "camera"],
        multiple: false,
        maxFileSize: 5000000,
        cropping: true,
        croppingAspectRatio: 1,
        croppingDefaultSelectionRatio: 0.9,
        folder: "machinpro/avatars",
        clientAllowedFormats: ["png", "jpg", "jpeg", "webp"],
        showAdvancedOptions: false,
        showCompletedButton: true,
        theme: "minimal",
      },
      (error: unknown, result: { event?: string; info?: { secure_url: string } }) => {
        if (!error && result?.event === "success" && result?.info?.secure_url) {
          setProfileEditAvatarUrl(result.info.secure_url);
        }
      }
    );
  }, []);

  const handleSaveUserProfile = useCallback(async () => {
    if (!supabase || !user?.id) return;
    setProfileSaveBusy(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({
        full_name: profileEditName.trim() || null,
        phone: profileEditPhone.trim() || null,
        avatar_url: profileEditAvatarUrl.trim() || null,
      })
      .eq("id", user.id);
    setProfileSaveBusy(false);
    if (error) {
      showToast("error", error.message);
      return;
    }
    await syncSession();
    const uid = user.id;
    const eid = profile?.employeeId;
    setEmployees((prev) =>
      prev.map((em) =>
        em.id === uid || (eid && em.id === eid)
          ? {
              ...em,
              name: profileEditName.trim() || em.name,
              phone: profileEditPhone.trim() || em.phone,
            }
          : em
      )
    );
    showToast("success", (t as Record<string, string>).toast_saved ?? "Guardado");
  }, [
    supabase,
    user?.id,
    profileEditName,
    profileEditPhone,
    profileEditAvatarUrl,
    profile?.employeeId,
    syncSession,
    showToast,
    t,
  ]);

  const handleRequestPasswordReset = useCallback(async () => {
    const email = profile?.email ?? user?.email;
    if (!email || !supabase) return;
    setPasswordResetBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
    });
    setPasswordResetBusy(false);
    if (error) {
      showToast("error", error.message);
      return;
    }
    showToast(
      "success",
      (t as Record<string, string>).passwordResetEmailSent ?? "Revisa tu correo"
    );
  }, [profile?.email, user?.email, supabase, showToast, t]);

  const openEmployeeShiftDay = useCallback((date: string, entryId: string) => {
    setEmployeeShiftDayOpen({ date, entryId });
  }, []);

  useEffect(() => {
    if (effectiveRole === "admin") return;
    if (!session || scheduleSelfIds.length === 0) return;
    if (typeof window === "undefined") return;
    const ymd = localTodayYmd();
    const key = `machinpro_aw6_openshift_${ymd}`;
    if (sessionStorage.getItem(key)) return;
    const myShifts = scheduleEntries.filter(
      (e) =>
        e.date === ymd &&
        e.type === "shift" &&
        scheduleSelfIds.some((id) => (e.employeeIds ?? []).includes(id))
    );
    if (myShifts.length === 1) {
      setEmployeeShiftDayOpen({ date: ymd, entryId: myShifts[0]!.id });
      sessionStorage.setItem(key, "1");
    }
  }, [effectiveRole, session, scheduleSelfIds, scheduleEntries]);

  const myShiftCentralCard = useMemo(() => {
    const ymd = localTodayYmd();
    const myShifts = scheduleEntries.filter(
      (e) =>
        e.date === ymd &&
        e.type === "shift" &&
        scheduleSelfIds.some((id) => (e.employeeIds ?? []).includes(id))
    );
    const ce = displayClockEntries.find(
      (e) =>
        e.date === ymd &&
        (e.employeeId === currentUserEmployeeId || e.employeeId === profile?.id)
    );
    const worked =
      ce?.clockIn && ce?.clockOut ? formatWorkedFromClockPair(ce.clockIn, ce.clockOut) : null;
    const first = myShifts[0];
    return {
      hasShiftToday: myShifts.length > 0,
      projectName: first?.projectId ? projects.find((p) => p.id === first.projectId)?.name : undefined,
      shiftTimeLabel: first ? `${first.startTime} → ${first.endTime}` : undefined,
      workedSummary: worked,
      clockedInNotOut: !!(ce && !ce.clockOut),
    };
  }, [
    scheduleEntries,
    scheduleSelfIds,
    displayClockEntries,
    currentUserEmployeeId,
    profile?.id,
    projects,
  ]);

  const handleClockIn = useCallback(
    (override?: { projectId?: string; projectCode?: string }) => {
      const fromOverride = override?.projectCode?.trim().toUpperCase() ?? "";
      const code = fromOverride || clockInProjectCode.trim().toUpperCase();
      const matchedProject = override?.projectId
        ? (projects ?? []).find((p) => p.id === override.projectId)
        : code
          ? (projects ?? []).find((p) => (p.projectCode ?? "").toUpperCase() === code)
          : undefined;

      const emp = (employees ?? []).find(
        (e) => e.id === currentUserEmployeeId || e.id === profile?.id
      );
      const hasPendingCerts =
        emp?.certificates?.some(
          (c) =>
            c.status === "expired" || (c.expiryDate != null && new Date(c.expiryDate) < new Date())
        ) ?? false;

      const pad2 = (n: number) => String(n).padStart(2, "0");

      const createEntryLocal = (lat?: number, lng?: number, alert?: boolean, alertMeters?: number) => {
        const dateStr = localTodayYmd();
        const now = new Date();
        const entry: ClockEntry = {
          id: `ce${Date.now()}`,
          employeeId: currentUserEmployeeId ?? profile?.id ?? "",
          projectId: matchedProject?.id,
          projectCode: code || matchedProject?.projectCode,
          date: dateStr,
          clockIn: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
          locationLat: lat,
          locationLng: lng,
          locationAlert: alert ?? false,
          locationAlertMeters: alertMeters,
          hadPendingCerts: hasPendingCerts || undefined,
        };
        setClockEntries((prev) => [...prev, entry]);
        setClockInProjectCode("");
        setClockInGpsStatus(alert ? "alert" : "ok");
      };

      const persistServer = async (
        lat?: number,
        lng?: number,
        alert?: boolean,
        alertMeters?: number
      ) => {
        const dateStr = localTodayYmd();
        if (supabase && user?.id && companyId) {
          const { data, error } = await supabase
            .from("time_entries")
            .insert({
              company_id: companyId,
              user_id: user.id,
              project_id: matchedProject?.id ?? null,
              clock_in_lat: lat ?? null,
              clock_in_lng: lng ?? null,
              status: "active",
            })
            .select("id, clock_in_at")
            .single();
          if (!error && data) {
            const row = data as { id: string; clock_in_at: string };
            const inD = new Date(row.clock_in_at);
            const mappedDate = `${inD.getFullYear()}-${pad2(inD.getMonth() + 1)}-${pad2(inD.getDate())}`;
            const mappedClockIn = `${pad2(inD.getHours())}:${pad2(inD.getMinutes())}`;
            setDbClockEntries((prev) => [
              {
                id: row.id,
                employeeId: currentUserEmployeeId ?? profile?.id ?? user.id,
                projectId: matchedProject?.id,
                projectCode: code || matchedProject?.projectCode,
                date: mappedDate,
                clockIn: mappedClockIn,
                clockOut: undefined,
                locationLat: lat,
                locationLng: lng,
                locationAlert: alert ?? false,
                locationAlertMeters: alertMeters,
                hadPendingCerts: hasPendingCerts || undefined,
              },
              ...prev.filter((e) => e.id !== row.id),
            ]);
            setClockInProjectCode("");
            setClockInGpsStatus(alert ? "alert" : "ok");
            return true;
          }
        }
        createEntryLocal(lat, lng, alert, alertMeters);
        return false;
      };

      const finish = async (
        lat?: number,
        lng?: number,
        alert?: boolean,
        alertMeters?: number
      ) => {
        await persistServer(lat, lng, alert, alertMeters);
        if (alert && alertMeters != null) {
          setClockInGpsStatus("alert");
          const msg =
            (t as Record<string, string>).outsideZoneAlert ??
            "Estás a {n}m del proyecto. El fichaje quedará registrado como fuera de zona.";
          setClockInAlertMessage(msg.replace("{n}", String(Math.round(alertMeters))));
        }
      };

      setClockInGpsStatus("locating");
      setClockInAlertMessage(null);

      if (typeof navigator === "undefined" || !navigator.geolocation) {
        void finish(undefined, undefined, false);
        setClockInGpsStatus("no_gps");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          let alert = false;
          let distMeters: number | undefined;
          if (matchedProject?.locationLat != null && matchedProject?.locationLng != null) {
            const dist = haversineMeters(
              latitude,
              longitude,
              matchedProject.locationLat,
              matchedProject.locationLng
            );
            distMeters = dist;
            alert = dist > 500;
          }
          void finish(latitude, longitude, alert, distMeters);
        },
        () => {
          void finish(undefined, undefined, false);
          setClockInGpsStatus("no_gps");
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    },
    [
      clockInProjectCode,
      projects,
      currentUserEmployeeId,
      profile?.id,
      employees,
      t,
      supabase,
      user?.id,
      companyId,
    ]
  );

  const handleClockOut = useCallback(() => {
    const todayYmd = localTodayYmd();
    const openEntry = displayClockEntries.find(
      (e) =>
        e.employeeId === (currentUserEmployeeId ?? "") &&
        e.date === todayYmd &&
        !e.clockOut
    );
    if (!openEntry) return;

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(openEntry.id);

    const applyClockOut = (lat?: number, lng?: number) => {
      const outTime = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (isUuid && supabase) {
        void (async () => {
          const { data: row } = await supabase
            .from("time_entries")
            .select("clock_in_at")
            .eq("id", openEntry.id)
            .maybeSingle();
          const clockInAt = row && typeof (row as { clock_in_at?: string }).clock_in_at === "string"
            ? new Date((row as { clock_in_at: string }).clock_in_at).getTime()
            : Date.now();
          const mins = Math.max(0, Math.round((Date.now() - clockInAt) / 60_000));
          await supabase
            .from("time_entries")
            .update({
              clock_out_at: new Date().toISOString(),
              clock_out_lat: lat ?? null,
              clock_out_lng: lng ?? null,
              status: "completed",
              total_minutes: mins,
            })
            .eq("id", openEntry.id);
          setDbClockEntries((prev) =>
            prev.map((e) => (e.id === openEntry.id ? { ...e, clockOut: outTime } : e))
          );
          setClockInGpsStatus("ok");
        })();
        return;
      }
      setClockEntries((prev) =>
        prev.map((e) =>
          e.id === openEntry.id
            ? {
                ...e,
                clockOut: outTime,
                locationLat: lat ?? e.locationLat,
                locationLng: lng ?? e.locationLng,
              }
            : e
        )
      );
      setClockInGpsStatus("ok");
    };

    setClockInGpsStatus("locating");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      applyClockOut(undefined, undefined);
      setClockInGpsStatus("no_gps");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyClockOut(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        applyClockOut(undefined, undefined);
        setClockInGpsStatus("no_gps");
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [displayClockEntries, currentUserEmployeeId, supabase]);

  const handleDailyReportPublished = useCallback(
    (report: DailyFieldReport) => {
      if (!companyId || !supabase) return;
      const tl = t as Record<string, string>;
      const ids = new Set<string>();
      for (const a of report.attendance) {
        if (a.employeeId) ids.add(a.employeeId);
      }
      for (const tk of report.tasks) {
        if (tk.employeeId) ids.add(tk.employeeId);
      }
      ids.delete(report.createdBy);
      const title = tl.notif_daily_report_title ?? "Daily report pending";
      for (const pid of ids) {
        void postAppNotification(supabase, {
          companyId,
          targetEmployeeKey: pid,
          type: "daily_report_pending",
          title,
          data: { reportId: report.id, projectId: report.projectId, date: report.date },
        });
      }
    },
    [companyId, supabase, t]
  );

  const handleAddScheduleEntry = (entry: Omit<ScheduleEntry, "id">) => {
    const newId = `se${Date.now()}`;
    setScheduleEntries((prev) => [...prev, { ...entry, id: newId }]);
    if (companyId && supabase && entry.type === "shift") {
      const tl = t as Record<string, string>;
      const title = tl.notif_shift_created_title ?? "";
      for (const eid of entry.employeeIds ?? []) {
        void postAppNotification(supabase, {
          companyId,
          targetEmployeeKey: eid,
          type: "shift_created",
          title,
          data: { scheduleEntryId: newId, date: entry.date, projectId: entry.projectId },
        });
      }
    }
  };

  const handleDeleteScheduleEntry = (id: string) => {
    setScheduleEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUpdateScheduleEntry = (id: string, entry: Omit<ScheduleEntry, "id">) => {
    setScheduleEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...entry, id } : e))
    );
    if (companyId && supabase && entry.type === "shift") {
      const tl = t as Record<string, string>;
      const title = tl.notif_shift_updated_title ?? "";
      for (const eid of entry.employeeIds ?? []) {
        void postAppNotification(supabase, {
          companyId,
          targetEmployeeKey: eid,
          type: "shift_updated",
          title,
          data: { scheduleEntryId: id, date: entry.date, projectId: entry.projectId },
        });
      }
    }
  };

  const handleApproveVacation = useCallback(
    async (id: string, comment: string) => {
      if (!supabase || !user?.id) return;
      const req = vacationRequests.find((v) => v.id === id);
      if (!req || req.status !== "pending") return;
      const { error } = await supabase
        .from("vacation_requests")
        .update({
          status: "approved",
          admin_comment: comment || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) return;
      setVacationRequests((prev) =>
        prev.map((v) => (v.id === id ? { ...v, status: "approved" as const } : v))
      );
      const empId = userIdToEmployeeIdRef.current.get(req.user_id) ?? req.user_id;
      const pad = (n: number) => String(n).padStart(2, "0");
      const newEntries: ScheduleEntry[] = [];
      const noteTxt =
        (t as Record<string, string>).schedule_vacation_calendar_note ?? "";
      const rowsToInsert: Record<string, unknown>[] = [];
      const start = new Date(req.start_date + "T12:00:00");
      const end = new Date(req.end_date + "T12:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const entryId = crypto.randomUUID();
        newEntries.push({
          id: entryId,
          type: "vacation",
          employeeIds: [empId],
          date: ymd,
          startTime: "00:00",
          endTime: "23:59",
          notes: noteTxt,
          eventLabel: "vacation",
          createdBy: user.id,
        });
        if (companyId) {
          rowsToInsert.push({
            id: entryId,
            company_id: companyId,
            type: "vacation",
            employee_ids: [empId],
            date: ymd,
            start_time: "00:00:00",
            end_time: "23:59:00",
            notes: noteTxt || null,
            event_label: "vacation",
            created_by: user.id,
          });
        }
      }
      if (newEntries.length) {
        setScheduleEntries((prev) => [...prev, ...newEntries]);
      }
      if (companyId && rowsToInsert.length) {
        const { error: insErr } = await supabase.from("schedule_entries").insert(rowsToInsert);
        if (insErr) console.error("schedule_entries vacation insert", insErr);
      }
    },
    [supabase, user?.id, vacationRequests, t, companyId]
  );

  const handleRejectVacation = useCallback(
    async (id: string, comment: string) => {
      if (!supabase || !user?.id) return;
      const { error } = await supabase
        .from("vacation_requests")
        .update({
          status: "rejected",
          admin_comment: comment || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) return;
      setVacationRequests((prev) =>
        prev.map((v) => (v.id === id ? { ...v, status: "rejected" as const } : v))
      );
    },
    [supabase, user?.id]
  );

  const handleCreateVacationRequest = useCallback(
    async (start: string, end: string, notes: string) => {
      if (!supabase || !companyId || !user?.id) return;
      const d0 = new Date(start + "T12:00:00");
      const d1 = new Date(end + "T12:00:00");
      if (d1 < d0) return;
      const totalDays = Math.floor((d1.getTime() - d0.getTime()) / 86400000) + 1;
      const { data, error } = await supabase
        .from("vacation_requests")
        .insert({
          company_id: companyId,
          user_id: user.id,
          start_date: start,
          end_date: end,
          total_days: totalDays,
          notes: notes || null,
          status: "pending",
        })
        .select("*")
        .single();
      if (error || !data) return;
      setVacationRequests((prev) => [data as VacationRequestRow, ...prev]);
    },
    [supabase, companyId, user?.id]
  );

  const vacationEmployeeNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const req of vacationRequests) {
      const eid = userToEmployeeMap[req.user_id];
      const name = eid ? employees.find((e) => e.id === eid)?.name : undefined;
      out[req.user_id] = name ?? "—";
    }
    return out;
  }, [vacationRequests, userToEmployeeMap, employees]);

  /** Resuelve nombres en turnos (IDs de perfil, employee_id legacy, o demo e1/e2). */
  const scheduleEmployeeLabels = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of INITIAL_EMPLOYEES) {
      m[e.id] = (e.name ?? "").trim() || (e.email ?? "").trim() || e.id;
    }
    for (const e of activeEmployees) {
      const nm = (e.name ?? "").trim();
      const em = (e.email ?? "").trim();
      m[e.id] = nm || em || e.id;
    }
    for (const p of teamProfiles) {
      const lbl =
        (p.name ?? "").trim() ||
        (p.email ?? "").trim() ||
        p.id;
      m[p.id] = lbl;
      if (p.employeeId) m[p.employeeId] = lbl;
    }
    return m;
  }, [activeEmployees, teamProfiles]);

  const employeeShiftModalModel = useMemo(() => {
    if (!employeeShiftDayOpen) return null;
    const entry = scheduleEntries.find((e) => e.id === employeeShiftDayOpen.entryId);
    if (!entry || entry.type !== "shift") return null;
    let resolvedProject = entry.projectId
      ? ((projects ?? []).find((p) => p.id === entry.projectId) ?? null)
      : null;
    if (!resolvedProject && entry.projectCode?.trim()) {
      const codeU = entry.projectCode.trim().toUpperCase();
      resolvedProject =
        (projects ?? []).find((p) => (p.projectCode ?? "").toUpperCase() === codeU) ?? null;
    }
    const codeFallback =
      entry.projectCode?.trim() || entry.projectId || "—";
    const shiftViewProject =
      resolvedProject != null
        ? {
            id: resolvedProject.id,
            name: resolvedProject.name,
            projectCode: resolvedProject.projectCode,
            location: resolvedProject.location,
            locationLat: resolvedProject.locationLat,
            locationLng: resolvedProject.locationLng,
          }
        : entry.projectCode?.trim() || entry.projectId
          ? {
              id: entry.projectId ?? `code:${entry.projectCode ?? "unknown"}`,
              name: codeFallback,
              projectCode: entry.projectCode,
              location: undefined,
              locationLat: undefined,
              locationLng: undefined,
            }
          : null;
    const dateStr = entry.date;
    const clockCandidates = displayClockEntries.filter(
      (e) =>
        e.date === dateStr &&
        (e.employeeId === currentUserEmployeeId || e.employeeId === profile?.id)
    );
    const clockEntry =
      clockCandidates.find((e) => e.projectId === entry.projectId) ?? clockCandidates[0];
    const colleagueNames = (entry.employeeIds ?? [])
      .filter((id) => !scheduleSelfIds.includes(id))
      .map(
        (id) =>
          scheduleEmployeeLabels[id] ?? employees.find((em) => em.id === id)?.name ?? ""
      )
      .filter((n) => n.trim().length > 0);
    const shiftTasks = projectTasks.filter(
      (task) =>
        task.projectId === entry.projectId &&
        (task.assignedToEmployeeId === currentUserEmployeeId ||
          task.assignedToEmployeeId === profile?.id) &&
        (task.dueDate == null || task.dueDate === dateStr)
    );
    const dr = entry.projectId
      ? dailyReports.find(
          (r) =>
            r.projectId === entry.projectId && r.date === dateStr && r.status === "published"
        ) ?? null
      : null;
    const canActClock = dateStr === localTodayYmd() && effectiveRole !== "admin";
    return {
      entry,
      shiftViewProject,
      clockEntry,
      colleagueNames,
      shiftTasks,
      dailyReport: dr ?? null,
      canActClock,
    };
  }, [
    employeeShiftDayOpen,
    scheduleEntries,
    projects,
    displayClockEntries,
    currentUserEmployeeId,
    profile?.id,
    scheduleSelfIds,
    scheduleEmployeeLabels,
    employees,
    projectTasks,
    dailyReports,
    effectiveRole,
  ]);

  const handleAddBlueprint = (bp: Blueprint) => {
    setBlueprints((prev) => [...prev, bp]);
  };

  const handleUpdateBlueprintAnnotations = (blueprintId: string, annotations: Annotation[]) => {
    setBlueprints((prev) =>
      prev.map((bp) => (bp.id === blueprintId ? { ...bp, annotations } : bp))
    );
  };

  const handleAddBlueprintRevision = (blueprintId: string, revision: BlueprintRevision) => {
    setBlueprints((prev) =>
      prev.map((bp) => {
        if (bp.id !== blueprintId) return bp;
        return {
          ...bp,
          revisions: [
            ...(bp.revisions ?? []).map((r) => ({ ...r, isCurrent: false })),
            { ...revision, isCurrent: true },
          ],
        };
      })
    );
  };

  const handleMarkBlueprintNotCurrent = (blueprintId: string) => {
    setBlueprints((prev) =>
      prev.map((bp) => (bp.id === blueprintId ? { ...bp, isCurrentVersion: false } : bp))
    );
  };

  const labels = {
    office: t.office,
    warehouse: t.warehouse,
    operations: (t as Record<string, string>).operations ?? "Operations",
    site: t.site,
    nav_operations: (t as Record<string, string>).nav_operations ?? t.site,
    schedule: t.schedule,
    forms: (t as Record<string, string>).forms ?? "Formularios",
    binders: (t as Record<string, string>).binders ?? "Documentos",
    billing: (t as Record<string, string>).billing_menu ?? "Billing",
    visitors: (t as Record<string, string>).visitors_menu ?? "Visitantes",
    hazards: (t as Record<string, string>).hazards_menu ?? "Riesgos",
    actions: (t as Record<string, string>).actions_menu ?? "Acciones",
    settings: t.settings,
    nav_security: (t as Record<string, string>).nav_security ?? "Seguridad",
    worker: t.worker,
    blueprints: t.blueprints ?? "Planos",
    employees: t.personnel,
    activeProjects: t.siteAdminView,
    recentStaff: t.recentStaff ?? "Personal reciente",
    viewAll: t.viewAll ?? "Ver todo",
    subcontractors: t.subcontractors ?? "Subcontratistas",
    projects: t.proyectos ?? "Proyectos",
    noProjects: t.noProjects ?? "No hay proyectos activos",
    noStaff: t.noStaff ?? "No hay personal registrado",
    edit: t.edit ?? "Editar",
    addNew: t.addNew ?? "Añadir",
    ...t,
  };

  const simulatorNames: Record<UserRole, string> = {
    admin: (t as Record<string, string>).admin ?? "Admin",
    supervisor: (t as Record<string, string>).supervisor ?? "Supervisor",
    worker: (t as Record<string, string>).worker ?? "Worker",
    logistic: (t as Record<string, string>).logistic ?? "Logistics",
    projectManager: (t as Record<string, string>).projectManager ?? "Project Manager",
  };

  const logisticsEmployees: LogisticsEmployee[] = activeEmployees.map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    phone: "",
    email: "",
    certificates: (e.certificates ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      expiryDate: c.expiryDate,
    })),
  }));

  const siteEmployees: ProjectEmployee[] = activeEmployees.map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    phone: "",
    email: "",
    certificates: (e.certificates ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      expiryDate: c.expiryDate,
    })),
  }));

  const siteProjects: SiteProject[] = (visibleProjects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    location: p.location,
    budgetCAD: p.budgetCAD,
    spentCAD: p.spentCAD,
    estimatedStart: p.estimatedStart,
    estimatedEnd: p.estimatedEnd,
    assignedEmployeeIds: p.assignedEmployeeIds,
    supervisorName: undefined,
  }));

  const siteInventoryItems: ProjectInventoryItem[] = (inventoryItems ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    quantity: i.quantity,
    unit: i.unit,
    toolStatus: i.toolStatus,
    assignedToProjectId: i.assignedToProjectId,
    assignedToEmployeeId: i.assignedToEmployeeId,
    imageUrl: i.imageUrl,
  }));

  // Worker: solo ve sus propias fotos/entradas de diario
  const workerVisibleDiary = (photos ?? []).filter(
    (p) => p.submitted_by_employee_id === workerEmployeeId
  );

  function closeInventoryForm() {
    setNewItemFormOpen(false);
    setNewItemName("");
    setNewItemCategory("material");
    setNewItemSerialNumber("");
    setNewItemInternalId("");
    setNewItemQuantity("");
    setNewItemUnit("");
    setNewItemPurchasePrice("");
    setNewItemAssignedProjectId("");
    setNewItemAssignedEmployeeId("");
    setEditingInventoryId(null);
    setEditInventoryDraft(null);
  }
  const qrUrlForAsset = (id: string) => `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(id)}`;
  function saveNewItem() {
    const id = "inv" + Date.now();
    const isTracked = newItemCategory === "tool" || newItemCategory === "equipment";
    const item: InventoryItem = {
      id,
      name: newItemName || "Nuevo ítem",
      type: newItemCategory,
      quantity: parseFloat(newItemQuantity) || 0,
      unit: newItemUnit || "unidades",
      purchasePriceCAD: parseFloat(newItemPurchasePrice) || 0,
      assignedToProjectId: isTracked ? (newItemAssignedProjectId || undefined) : undefined,
      assignedToEmployeeId: isTracked ? (newItemAssignedEmployeeId || undefined) : undefined,
      toolStatus: isTracked ? "available" : undefined,
      serialNumber: newItemSerialNumber || undefined,
      internalId: newItemInternalId || undefined,
      qrCode: qrUrlForAsset(id),
    };
    setInventoryItems((prev) => {
      const next = [...prev, item];
      try { localStorage.setItem("machinpro_inventory", JSON.stringify(next)); } catch {}
      return next;
    });
    closeInventoryForm();
  }
  function saveEditedItem() {
    if (!editingInventoryId || !editInventoryDraft) return;
    const isTracked = editInventoryDraft.type === "tool" || editInventoryDraft.type === "equipment";
    const patch = { ...editInventoryDraft } as Partial<InventoryItem>;
    if (isTracked) patch.qrCode = qrUrlForAsset(editingInventoryId);
    setInventoryItems((prev) => {
      const next = prev.map((i) => i.id === editingInventoryId ? { ...i, ...patch } as InventoryItem : i);
      try { localStorage.setItem("machinpro_inventory", JSON.stringify(next)); } catch {}
      return next;
    });
    closeInventoryForm();
  }

  function closeVehicleForm() {
    setVehicleFormOpen(false);
    setEditingVehicleId(null);
    setVehicleDraft({});
  }
  function saveVehicle() {
    if (editingVehicleId) {
      setVehicles((prev) => {
        const next = prev.map((v) => v.id === editingVehicleId ? { ...v, ...vehicleDraft } as Vehicle : v);
        try { localStorage.setItem("machinpro_vehicles", JSON.stringify(next)); } catch {}
        return next;
      });
    } else {
      const id = "v" + Date.now();
      const newVehicle: Vehicle = {
        id,
        plate: vehicleDraft.plate ?? "",
        usualDriverId: vehicleDraft.usualDriverId ?? "",
        currentProjectId: vehicleDraft.currentProjectId ?? null,
        insuranceExpiry: vehicleDraft.insuranceExpiry ?? "",
        inspectionExpiry: vehicleDraft.inspectionExpiry ?? "",
        vehicleStatus: vehicleDraft.vehicleStatus,
        lastMaintenanceDate: vehicleDraft.lastMaintenanceDate,
        nextMaintenanceDate: vehicleDraft.nextMaintenanceDate,
        mileage: vehicleDraft.mileage,
        notes: vehicleDraft.notes,
        insuranceDocUrl: vehicleDraft.insuranceDocUrl,
        inspectionDocUrl: vehicleDraft.inspectionDocUrl,
        registrationDocUrl: vehicleDraft.registrationDocUrl,
        serialNumber: vehicleDraft.serialNumber,
        internalId: vehicleDraft.internalId,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(id)}`,
      };
      setVehicles((prev) => {
        const next = [...prev, newVehicle];
        try { localStorage.setItem("machinpro_vehicles", JSON.stringify(next)); } catch {}
        return next;
      });
    }
    closeVehicleForm();
  }

  function closeRentalForm() {
    setRentalFormOpen(false);
    setEditingRentalId(null);
    setRentalDraft({});
  }
  function saveRental() {
    if (editingRentalId) {
      setRentals((prev) => prev.map((r) => r.id === editingRentalId ? { ...r, ...rentalDraft } as Rental : r));
    } else {
      const id = "r" + Date.now();
      setRentals((prev) => [...prev, { id, name: rentalDraft.name ?? "", supplier: rentalDraft.supplier ?? "", returnDate: rentalDraft.returnDate ?? "", costCAD: rentalDraft.costCAD ?? 0, contractLink: rentalDraft.contractLink, projectId: rentalDraft.projectId } as Rental]);
    }
    closeRentalForm();
  }

  function closeSupplierForm() {
    setSupplierFormOpen(false);
    setEditingSupplierId(null);
    setSupplierDraft({});
  }
  function saveSupplier() {
    if (editingSupplierId) {
      setSuppliers((prev) => prev.map((s) => s.id === editingSupplierId ? { ...s, ...supplierDraft } as Supplier : s));
    } else {
      const id = "s" + Date.now();
      setSuppliers((prev) => [...prev, { id, name: supplierDraft.name ?? "", phone: supplierDraft.phone ?? "", email: supplierDraft.email ?? "", webLink: supplierDraft.webLink ?? "", address: supplierDraft.address ?? "", contacts: supplierDraft.contacts ?? [] } as Supplier]);
    }
    closeSupplierForm();
  }

  function updateEmployee(id: string, _upd: Partial<Employee>) {
    openEmployeeForm(id);
  }

  function openEmployeeForm(mode: "new" | string) {
    if (mode === "new") {
      setEditingEmployeeId("new");
      setNewEmployeeName("");
      const defaultRoleId = pickDefaultWorkerRoleId(customRoles);
      const defaultRole = defaultRoleId ? customRoles.find((r) => r.id === defaultRoleId) : undefined;
      setNewEmployeeRole(defaultRole?.name ?? "worker");
      setNewEmployeeHours("");
      setNewEmployeePayType("hourly");
      setNewEmployeeHourlyRate("");
      setNewEmployeeMonthlySalary("");
      setNewEmployeeCustomRoleId(defaultRole?.id ?? "");
      setNewEmployeeRoleMode("list");
    } else {
      const emp = employees.find((e) => e.id === mode);
      if (!emp) return;
      setEditingEmployeeId(emp.id);
      setNewEmployeeName(emp.name);
      setNewEmployeeHours(String(emp.hours ?? 0));
      setNewEmployeePayType(emp.payType ?? "hourly");
      setNewEmployeeHourlyRate(emp.hourlyRate != null ? String(emp.hourlyRate) : "");
      setNewEmployeeMonthlySalary(emp.monthlySalary != null ? String(emp.monthlySalary) : "");
      if (emp.customRoleId) {
        setNewEmployeeCustomRoleId(emp.customRoleId);
        setNewEmployeeRole(emp.role);
        setNewEmployeeRoleMode("list");
      } else {
        const matchByName = customRoles.find((r) => r.name === emp.role);
        if (matchByName) {
          setNewEmployeeCustomRoleId(matchByName.id);
          setNewEmployeeRole(matchByName.name);
          setNewEmployeeRoleMode("list");
        } else {
          setNewEmployeeCustomRoleId("");
          setNewEmployeeRole(emp.role);
          setNewEmployeeRoleMode("custom");
        }
      }
    }
  }
  function closeEmployeeForm() {
    setEditingEmployeeId(null);
  }
  function saveEmployee() {
    if (editingEmployeeId === "new") {
      const id = "e" + Date.now().toString(36);
      const picked = customRoles.find((r) => r.id === newEmployeeCustomRoleId);
      const roleName = newEmployeeRoleMode === "list" && picked ? picked.name : newEmployeeRole || "worker";
      const emp: Employee = {
        id,
        name: newEmployeeName || "Nuevo empleado",
        role: roleName,
        hours: parseInt(newEmployeeHours, 10) || 0,
        certificates: [],
        payType: newEmployeePayType,
        hourlyRate: newEmployeePayType === "hourly" && newEmployeeHourlyRate ? parseFloat(newEmployeeHourlyRate) : undefined,
        monthlySalary: newEmployeePayType === "salary" && newEmployeeMonthlySalary ? parseFloat(newEmployeeMonthlySalary) : undefined,
        customRoleId: newEmployeeRoleMode === "list" && newEmployeeCustomRoleId ? newEmployeeCustomRoleId : undefined,
        useRolePermissions: true,
      };
      setEmployees((prev) => [...prev, emp]);
      void logAuditEvent({
        company_id: companyId ?? "",
        user_id: user?.id ?? "",
        user_name: profile?.fullName ?? profile?.email ?? "admin",
        action: "employee_created",
        entity_type: "employee",
        entity_id: id,
        entity_name: emp.name,
      });
    } else if (editingEmployeeId) {
      const picked = customRoles.find((r) => r.id === newEmployeeCustomRoleId);
      const roleName = newEmployeeRoleMode === "list" && picked ? picked.name : newEmployeeRole || "worker";
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === editingEmployeeId
            ? {
                ...e,
                name: newEmployeeName || e.name,
                role: roleName,
                hours: parseInt(newEmployeeHours, 10) ?? e.hours,
                payType: newEmployeePayType,
                hourlyRate: newEmployeePayType === "hourly" && newEmployeeHourlyRate ? parseFloat(newEmployeeHourlyRate) : undefined,
                monthlySalary: newEmployeePayType === "salary" && newEmployeeMonthlySalary ? parseFloat(newEmployeeMonthlySalary) : undefined,
                customRoleId: newEmployeeRoleMode === "list" && newEmployeeCustomRoleId ? newEmployeeCustomRoleId : undefined,
              }
            : e
        )
      );
    }
    closeEmployeeForm();
  }

  function openProjectForm(proj?: Project | { id: string; name?: string; projectCode?: string } | null) {
    const project = proj
      ? ("estimatedStart" in proj && proj.estimatedStart ? proj : projects.find((p) => p.id === proj.id))
      : null;
    const p = project as Project | undefined;
    setEditingProjectId(proj?.id ?? null);
    setProjectFormName(p?.name ?? "");
    setProjectFormCode(p?.projectCode ?? "");
    setProjectFormType((p?.type as ProjectType) ?? "residential");
    setProjectFormLocation(p?.location ?? "");
    setProjectFormBudget(String(p?.budgetCAD ?? ""));
    setProjectFormStart(p?.estimatedStart ?? "");
    setProjectFormEnd(p?.estimatedEnd ?? "");
    setProjectFormLifecycle(p?.lifecycleStatus ?? "active");
    setProjectFormLat(String(p?.locationLat ?? ""));
    setProjectFormLng(String(p?.locationLng ?? ""));
    setProjectFormOpen(true);
  }
  function closeProjectForm() {
    setProjectFormOpen(false);
    setEditingProjectId(null);
  }
  function saveProjectForm() {
    const existingProject = editingProjectId
      ? projects.find((p) => p.id === editingProjectId)
      : undefined;
    const name =
      projectFormName.trim() ||
      existingProject?.name ||
      `${(t as Record<string, string>).addNew ?? ""} ${t.projects ?? ""}`.trim();
    const payload = {
      name,
      projectCode: projectFormCode.trim().toUpperCase() || undefined,
      type: projectFormType,
      location: projectFormLocation.trim(),
      budgetCAD: parseFloat(projectFormBudget) || 0,
      spentCAD: existingProject?.spentCAD ?? 0,
      estimatedStart: projectFormStart || new Date().toISOString().slice(0, 10),
      estimatedEnd: projectFormEnd || new Date().toISOString().slice(0, 10),
      locationLat: parseFloat(projectFormLat) || undefined,
      locationLng: parseFloat(projectFormLng) || undefined,
      archived: false,
      lifecycleStatus: projectFormLifecycle,
      assignedEmployeeIds: [] as string[],
    };
    if (editingProjectId) {
      const existing = projects.find((p) => p.id === editingProjectId);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProjectId
            ? { ...p, ...payload, assignedEmployeeIds: existing?.assignedEmployeeIds ?? [], archived: existing?.archived ?? false }
            : p
        )
      );
    } else {
      const id = "p" + Date.now().toString(36);
      setProjects((prev) => [...prev, { id, ...payload } as Project]);
    }
    closeProjectForm();
  }

  const isSuppliersFormOpen = supplierFormOpen || editingSupplierId !== null;
  const editSupplierDraft = supplierDraft;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session && supabase) {
    return (
      <>
        <LoginScreen
          onLogin={async () => {
            await syncSession();
            if (supabase) {
              const { data } = await supabase.auth.getSession();
              setSession(data.session ?? null);
            }
          }}
          labels={t as Record<string, string>}
          demoAccounts={loginDemoAccounts}
        />
        <InstallPWABanner labels={t} isDark={darkMode ?? false} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden">
      {session && effectiveRole === "admin" && !onboardingComplete && (
        <OnboardingModal
          onComplete={completeOnboarding}
          labels={t}
          session={session}
          companyId={companyId}
          language={language}
          companyName={companyName || profile?.companyName || ""}
          companyCountry={companyCountry}
          currency={currency}
          measurementSystem={measurementSystem}
          logoUrl={logoUrl}
          customRoles={customRoles}
          onCompanyNameChange={setCompanyName}
          onCountryChange={(country, defaults) => {
            setCompanyCountry(country);
            if (defaults) {
              setCurrency(defaults.currency as Currency);
              setMeasurementSystem(defaults.measurementSystem);
            }
            const defaultFields = getDefaultComplianceFields(country);
            setComplianceFields((prev) => [...defaultFields, ...prev.filter((f) => !f.isDefault)]);
          }}
          onCurrencyChange={(c) => setCurrency(c)}
          onMeasurementSystemChange={setMeasurementSystem}
          onLogoUrlChange={setLogoUrl}
          onLogoUpload={handleLogoUpload}
          profileTimeZone={profile?.timezone ?? null}
          onUserTimezoneSaved={() => void syncSession()}
          onProjectCreated={(row) => {
            setProjects((prev) => [...prev, row as Project]);
          }}
        />
      )}
      <div className="flex min-w-0">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={(s: MainSection) => setActiveSection(s)}
          canAccessOffice={perms.office}
          canAccessWarehouse={perms.warehouse}
          canAccessSite={perms.site}
          canAccessSchedule={perms.canAccessSchedule ?? true}
          canAccessSecurity={perms.canAccessSecurity ?? false}
          canAccessSettings={perms.canViewSettings ?? false}
          labels={labels}
          collapsed={sidebarCollapsed}
          mobileDrawerOpen={mobileNavOpen}
          onMobileDrawerOpenChange={setMobileNavOpen}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden p-4 md:p-6 lg:p-8 min-h-screen pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-8">
          <header className="mb-4 sm:mb-8 border-b border-gray-200 dark:border-gray-800 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-gray-700 dark:bg-gray-900 dark:text-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-expanded={mobileNavOpen}
                aria-controls="app-mobile-drawer"
                aria-label={(t as Record<string, string>).nav_menu_open ?? "Open menu"}
              >
                <Menu className="h-6 w-6 shrink-0" aria-hidden />
              </button>
              {logoUrl?.trim() ? (
                <img
                  src={logoUrl.trim()}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700 lg:hidden"
                />
              ) : null}
              <div className="min-w-0 flex-1 flex flex-col">
                {(companyName || profile?.companyName) ? (
                  <span className="truncate text-base font-bold leading-tight text-zinc-900 dark:text-white sm:text-lg">
                    {companyName || profile?.companyName}
                  </span>
                ) : (
                  <BrandWordmark tone="onLight" className="text-base font-bold tracking-tight sm:text-lg min-w-0" />
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
              {session && companyId ? (
                <NotificationBell
                  supabase={supabase}
                  labels={labels as Record<string, string>}
                  enabled
                  localeBcp47={dateLocaleBcp47}
                />
              ) : null}
              {pendingSync.length > 0 ? (
                <div className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Cloud className="h-3.5 w-3.5" />
                  <span className="hidden sm:block">
                    {pendingSync.length} {t.pendingSync ?? "pendiente(s)"}
                  </span>
                </div>
              ) : isOnline ? (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <CloudCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:block">{t.synced ?? "Sincronizado"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <CloudOff className="h-3.5 w-3.5" />
                  <span className="hidden sm:block">{t.offline ?? "Sin conexión"}</span>
                </div>
              )}
              {(effectiveRole === "admin" || effectiveRole === "supervisor") && criticalComplianceCount > 0 && (
                <div className="relative" ref={complianceNotifRef}>
                  <button
                    type="button"
                    onClick={() => setComplianceNotifOpen((o) => !o)}
                    className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-gray-700 dark:bg-gray-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    aria-label={(t as Record<string, string>).notifications ?? "Notifications"}
                  >
                    <Bell className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {criticalComplianceCount > 99 ? "99+" : criticalComplianceCount}
                    </span>
                  </button>
                  {complianceNotifOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-50 mt-2 w-[min(95vw,22rem)] max-md:left-1/2 max-md:right-auto max-md:-translate-x-1/2 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <p className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:text-white">
                        {(t as Record<string, string>).notifications ?? ""}
                      </p>
                      <ul className="max-h-64 overflow-y-auto py-1">
                        {complianceAlerts.filter((a) => a.severity !== "warning").length === 0 ? (
                          <li className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            {(t as Record<string, string>).noNotifications ?? ""}
                          </li>
                        ) : (
                          complianceAlerts
                            .filter((a) => a.severity !== "warning")
                            .slice(0, 30)
                            .map((a) => (
                              <li key={`${a.employeeId}-${a.certName}-${a.expiryDate}`}>
                                <button
                                  type="button"
                                  className="flex min-h-[44px] w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                  onClick={() => {
                                    setComplianceNotifOpen(false);
                                    setActiveSection("office");
                                    setPendingOpenEmployeeId(a.employeeId);
                                  }}
                                >
                                  <span className="font-medium text-zinc-900 dark:text-white">{a.employeeName}</span>
                                  <span className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{a.certName}</span>
                                </button>
                              </li>
                            ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
                <span className="sr-only">{(t as Record<string, string>).language ?? "Language"}</span>
                <select
                  value={language}
                  onChange={(e) => void applyLanguage(e.target.value as Language)}
                  aria-label={(t as Record<string, string>).language ?? "Language"}
                  className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 sm:min-w-[10rem] sm:flex-none"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  const root = document.documentElement;
                  const next = !root.classList.contains("dark");
                  try {
                    if (next) root.classList.add("dark");
                    else root.classList.remove("dark");
                    localStorage.setItem("machinpro_dark_mode", next ? "1" : "0");
                  } catch {
                    /* ignore */
                  }
                  setDarkMode(next);
                }}
                className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1 text-xs text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[44px]"
                aria-pressed={darkMode === true}
                title={(darkMode ?? false) ? (t.lightMode ?? "Modo claro") : (t.darkMode ?? "Modo oscuro")}
              >
                {(darkMode ?? false)
                  ? "☀️ " + (t.lightMode ?? "Modo claro")
                  : "🌙 " + (t.darkMode ?? "Modo oscuro")}
              </button>
              {session && (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:block">
                    <BrandWordmark tone="onLight" className="text-xs font-semibold" />
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
                    {profile?.role ?? ""}
                  </span>
                  {profile?.isSuperadmin && (
                    <Link
                      href="/superadmin"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/50 px-3 py-2 text-sm font-medium text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40"
                    >
                      <Settings className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="hidden sm:inline">
                        {(t as Record<string, string>).superadmin_panel ?? "Panel Admin"}
                      </span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px]"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">{(t as Record<string, string>).settings_sign_out ?? "Sign out"}</span>
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className="max-w-7xl mx-auto space-y-6 min-w-0 w-full">
            {activeSection === "office" && perms.office && (
              <>
              <CentralModule
                labels={labels}
                employees={(() => {
                  const activeProjects = currentUserRole === "supervisor"
                    ? (projects ?? []).filter((p) => p.id === "p1")
                    : (projects ?? []).filter((p) => !p.archived);
                  const visible = currentUserRole === "supervisor"
                    ? (employees ?? []).filter((e) =>
                        activeProjects.some((p) =>
                          (p.assignedEmployeeIds ?? []).includes(e.id)
                        )
                      )
                    : (employees ?? []);
                  return visible.map((e) => ({
                    id: e.id,
                    name: e.name,
                    role: e.role,
                    profileStatus: e.profileStatus,
                    hours: e.hours,
                    phone: e.phone,
                    email: e.email,
                    certificates: e.certificates ?? [],
                    payType: e.payType,
                    hourlyRate: e.hourlyRate,
                    monthlySalary: e.monthlySalary,
                    customRoleId: e.customRoleId,
                    customPermissions: e.customPermissions,
                    useRolePermissions: e.useRolePermissions,
                  }));
                })()}
                projects={projects}
                displayProjects={projects}
                subcontractors={subcontractors}
                canEdit={
                  !!(
                    rolePerms.canManageEmployees ||
                    rolePerms.canCreateProjects ||
                    rolePerms.canEditProjects ||
                    rolePerms.canDeleteProjects
                  )
                }
                canViewRoles={!!rolePerms.canViewRoles}
                canViewAuditLog={!!rolePerms.canViewAuditLog}
                onAddProject={() => openProjectForm()}
                onEditProject={(id) => openProjectForm(projects.find((p) => p.id === id) ?? null)}
                onArchiveProject={(id) => {
                  setProjects((prev) => prev.map((p) => p.id === id ? { ...p, archived: !p.archived } : p));
                }}
                onDeleteProject={(id) => {
                  if (window.confirm("¿Eliminar este proyecto?")) setProjects((prev) => prev.filter((p) => p.id !== id));
                }}
                onAddEmployee={() => openEmployeeForm("new")}
                onUpdateEmployee={(id, upd) => updateEmployee(id, upd as Partial<Employee>)}
                onConfirmDeleteEmployee={(id) => {
                  if (window.confirm("¿Eliminar este empleado?")) {
                    void logAuditEvent({
                      company_id: companyId ?? "",
                      user_id: user?.id ?? "",
                      user_name: profile?.fullName ?? profile?.email ?? "admin",
                      action: "employee_deleted",
                      entity_type: "employee",
                      entity_id: id,
                    });
                    setEmployees((prev) => prev.filter((e) => e.id !== id));
                  }
                }}
                subcontractorCountryCode={subcontractorCountryCode}
                taxIdLabel={countryConfig.taxIdLabel}
                complianceCertLabel={countryConfig.complianceCertLabel}
                onAddSubcontractor={(sub) => setSubcontractors((prev) => [...prev, sub])}
                onUpdateSubcontractor={(sub) => setSubcontractors((prev) => prev.map((s) => (s.id === sub.id ? sub : s)))}
                onConfirmDeleteSubcontractor={(id) => {
                  if (typeof window !== "undefined" && window.confirm((t as Record<string, string>).confirmDeleteSubcontractor ?? "¿Eliminar este subcontratista?"))
                    setSubcontractors((prev) => prev.filter((s) => s.id !== id));
                }}
                onOpenProjectForm={(proj) => openProjectForm(projects.find((p) => p.id === proj.id) ?? proj)}
                onOpenProjectInOperations={(proj) => {
                  if (perms.site) {
                    setSiteSelectedProjectId(proj.id);
                    setActiveSection("site");
                  } else {
                    openProjectForm(projects.find((p) => p.id === proj.id) ?? proj);
                  }
                }}
                pendingPhotoCountByProject={pendingPhotoCountByProject}
                auditLogs={auditLogs}
                canManageRoles={rolePerms.canManageRoles}
                customRoles={customRoles}
                onAddRole={async (role) => {
                  if (!supabase || !companyId) {
                    setCustomRoles((prev) => [...prev, role]);
                    return;
                  }
                  const { data, error } = await supabase
                    .from("roles")
                    .insert({
                      company_id: companyId,
                      name: role.name,
                      color: role.color,
                      permissions: role.permissions,
                      is_system: false,
                    })
                    .select("*")
                    .single();
                  if (error || !data) {
                    console.error("[page] roles insert", error);
                    return;
                  }
                  setCustomRoles((prev) => [...prev, customRoleFromSupabaseRow(data as RolesTableRow)]);
                }}
                onUpdateRole={async (role) => {
                  if (!supabase || !companyId) {
                    setCustomRoles((prev) => prev.map((r) => (r.id === role.id ? role : r)));
                    return;
                  }
                  const { error } = await supabase
                    .from("roles")
                    .update({
                      name: role.name,
                      color: role.color,
                      permissions: role.permissions,
                    })
                    .eq("id", role.id)
                    .eq("company_id", companyId);
                  if (error) {
                    console.error("[page] roles update", error);
                    return;
                  }
                  setCustomRoles((prev) => prev.map((r) => (r.id === role.id ? role : r)));
                }}
                onDeleteRole={async (id) => {
                  const row = customRoles.find((r) => r.id === id);
                  if (!row || isProtectedCustomRole(row)) return;
                  if (!supabase || !companyId) {
                    setCustomRoles((prev) => prev.filter((r) => r.id !== id));
                    return;
                  }
                  const { error } = await supabase
                    .from("roles")
                    .delete()
                    .eq("id", id)
                    .eq("company_id", companyId);
                  if (error) {
                    console.error("[page] roles delete", error);
                    return;
                  }
                  setCustomRoles((prev) => prev.filter((r) => r.id !== id));
                }}
                clockEntries={displayClockEntries}
                formInstances={formInstances}
                language={language}
                timeZone={userTimeZone}
                regionCountryCode={companyCountry}
                complianceFields={complianceFields}
                complianceRecords={complianceRecords}
                onComplianceRecordsChange={setComplianceRecords}
                employeeDocs={employeeDocs}
                onUploadEmployeeDoc={(doc) => {
                  const full: EmployeeDocument = {
                    ...doc,
                    id: "doc-" + Date.now(),
                    uploadedAt: new Date().toISOString(),
                  };
                  setEmployeeDocs((prev) => [...prev, full]);
                }}
                onDeleteEmployeeDoc={(docId) => {
                  setEmployeeDocs((prev) => prev.filter((d) => d.id !== docId));
                }}
                currentUserRole={effectiveRole}
                currentUserEmployeeId={effectiveRole === "worker" ? effectiveEmployeeId : null}
                companyId={companyId}
                uploadedByDisplayName={
                  (effectiveEmployeeId
                    ? employees.find((e) => e.id === effectiveEmployeeId)?.name
                    : null) ??
                  user?.email ??
                  "Admin"
                }
                onUpdateEmployeePermissions={(employeeId, permissions, useRole) => {
                  setEmployees((prev) =>
                    prev.map((e) =>
                      e.id === employeeId
                        ? {
                            ...e,
                            useRolePermissions: useRole,
                            customPermissions: useRole ? undefined : (permissions as Partial<RolePermissions>),
                          }
                        : e
                    )
                  );
                }}
                complianceAlerts={complianceAlerts}
                pendingOpenEmployeeId={pendingOpenEmployeeId}
                onPendingOpenEmployeeHandled={clearPendingOpenEmployee}
                companyName={(profile?.companyName ?? companyName) || null}
                onNavigateAppSection={(s) => setActiveSection(s)}
                onQuickNewHazard={() => {
                  setSecurityInitialTab("hazards");
                  setActiveSection("security");
                  setDashHazardCreateSig((n) => n + 1);
                }}
                onQuickNewAction={() => {
                  setSecurityInitialTab("actions");
                  setActiveSection("security");
                  setDashActionCreateSig((n) => n + 1);
                }}
                onQuickVisitorQr={() => {
                  navigateToSiteVisitorsTab({ openQr: true });
                }}
                visitorCheckInUrl={companyId ? buildVisitorCheckInUrl(companyId) : null}
                canAccessEmployees={!!perms.canAccessEmployees}
                canAccessSubcontractors={!!perms.canAccessSubcontractors}
                canAccessVisitors={effectiveRole === "admin" || effectiveRole === "supervisor"}
                canAccessHazards={
                  effectiveRole === "admin" ||
                  effectiveRole === "supervisor" ||
                  effectiveRole === "worker"
                }
                canAccessCorrective={
                  effectiveRole === "admin" ||
                  effectiveRole === "supervisor" ||
                  effectiveRole === "worker"
                }
                currentUserId={user?.id ?? null}
                canViewAttendance={!!rolePerms.canViewAttendance}
                dashboardCanManageEmployees={!!rolePerms.canManageEmployees}
                dashboardCanViewTeamClock={
                  !!(
                    rolePerms.canManageEmployees ||
                    rolePerms.canViewTimeclock ||
                    rolePerms.canManageTimeclock
                  )
                }
                dashboardCanManageComplianceAlerts={
                  !!(rolePerms.canManageCompliance || rolePerms.canManageEmployees)
                }
                dashboardCanViewLogistics={!!rolePerms.canViewLogistics}
                dashboardCanViewEmployees={
                  !!(rolePerms.canViewEmployees || rolePerms.canManageEmployees)
                }
                dashboardCanViewRoles={
                  !!(rolePerms.canViewRoles || rolePerms.canManageRoles)
                }
                dashboardCanViewAuditLog={!!rolePerms.canViewAuditLog}
                dashboardCanViewDashboardWidgets={!!rolePerms.canViewDashboardWidgets}
                dashboardCanViewProjectsManagement={
                  effectiveRole === "admin" ||
                  !!(rolePerms.canViewProjects || rolePerms.canCreateProjects)
                }
                dashboardCriticalInventoryCount={criticalInventoryCount}
                onQuickNewRfi={() => {
                  if (!perms.site) return;
                  const vp = visibleProjects ?? [];
                  const first = vp.find((p) => !p.archived)?.id ?? vp[0]?.id ?? null;
                  if (first) setSiteSelectedProjectId(first);
                  setActiveSection("site");
                  setProjectsOpenRfiSig((n) => n + 1);
                }}
                onQuickNewSubcontractor={() => setActiveSection("subcontractors")}
                onOpenMyShiftView={() => {
                  const ymd = localTodayYmd();
                  const mine = scheduleEntries.filter(
                    (e) =>
                      e.date === ymd &&
                      e.type === "shift" &&
                      scheduleSelfIds.some((id) => (e.employeeIds ?? []).includes(id))
                  );
                  if (mine.length >= 1) openEmployeeShiftDay(ymd, mine[0]!.id);
                }}
                myShiftCentralCard={myShiftCentralCard}
                canViewProjects={!!rolePerms.canViewProjects}
                canCreateProjects={!!rolePerms.canCreateProjects}
                canEditProjects={!!rolePerms.canEditProjects}
                canDeleteProjects={!!rolePerms.canDeleteProjects}
              />
              <ModuleHelpFab
                moduleKey="office"
                labels={t as Record<string, string>}
                onOpenSettingsHelp={openSettingsHelpFromFab}
              />
            </>
            )}

            {activeSection === "warehouse" && perms.warehouse && (
              <>
              <LogisticsModule
                warehouseSubTab={warehouseSubTab}
                setWarehouseSubTab={setWarehouseSubTab}
                warehouseSectionsEnabled={warehouseSectionsEnabled}
                projects={projects}
                inventoryItems={inventoryItems}
                inventoryMovements={inventoryMovements}
                adjustModal={adjustModal}
                adjustQuantity={adjustQuantity}
                adjustNote={adjustNote}
                setAdjustQuantity={setAdjustQuantity}
                setAdjustNote={setAdjustNote}
                onOpenAdjust={(itemId, type) => setAdjustModal({ itemId, type })}
                onApplyAdjustment={() => setAdjustModal(null)}
                onCloseAdjustModal={() => setAdjustModal(null)}
                vehicles={vehicles}
                rentals={rentals}
                suppliers={suppliers}
                employees={logisticsEmployees}
                labels={t}
                complianceFields={complianceFields}
                complianceRecords={complianceRecords}
                onComplianceRecordsChange={setComplianceRecords}
                onAddInventory={() => { setNewItemFormOpen(true); }}
                onEditInventory={(item) => {
                  setEditingInventoryId(item.id);
                  setEditInventoryDraft({ name: item.name, type: item.type, quantity: item.quantity, unit: item.unit, purchasePriceCAD: item.purchasePriceCAD, assignedToProjectId: item.assignedToProjectId, assignedToEmployeeId: item.assignedToEmployeeId });
                }}
                onDeleteInventory={(id) => {
                  const msg = (t as Record<string, string>).common_confirm_delete ?? "";
                  if (typeof window !== "undefined" && window.confirm(msg)) {
                    setInventoryItems((prev) => {
                      const next = prev.filter((i) => i.id !== id);
                      try { localStorage.setItem("machinpro_inventory", JSON.stringify(next)); } catch {}
                      return next;
                    });
                  }
                }}
                onAddFleet={() => { setVehicleFormOpen(true); setEditingVehicleId(null); setVehicleDraft({}); }}
                onEditFleet={(v) => { setEditingVehicleId(v.id); setVehicleDraft({ ...v }); setVehicleFormOpen(true); }}
                onDeleteFleet={(id) => {
                  const msg = (t as Record<string, string>).common_confirm_delete ?? "";
                  if (typeof window !== "undefined" && window.confirm(msg))
                    setVehicles((prev) => prev.filter((v) => v.id !== id));
                }}
                onAddRental={() => { setRentalFormOpen(true); setEditingRentalId(null); setRentalDraft({}); }}
                onEditRental={(r) => { setEditingRentalId(r.id); setRentalDraft({ ...r }); setRentalFormOpen(true); }}
                onDeleteRental={(id) => {
                  const msg = (t as Record<string, string>).common_confirm_delete ?? "";
                  if (typeof window !== "undefined" && window.confirm(msg))
                    setRentals((prev) => prev.filter((r) => r.id !== id));
                }}
                onAddSupplier={() => { setSupplierFormOpen(true); setEditingSupplierId(null); setSupplierDraft({}); }}
                onEditSupplier={(s) => { setEditingSupplierId(s.id); setSupplierDraft({ ...s }); setSupplierFormOpen(true); }}
                onDeleteSupplier={(id) => {
                  const msg = (t as Record<string, string>).common_confirm_delete ?? "";
                  if (typeof window !== "undefined" && window.confirm(msg))
                    setSuppliers((prev) => prev.filter((s) => s.id !== id));
                }}
                canEdit={
                  !!(
                    rolePerms.canManageInventory ||
                    rolePerms.canManageFleet ||
                    rolePerms.canManageSuppliers ||
                    rolePerms.canManageRentals ||
                    rolePerms.canCreatePurchaseOrders
                  )
                }
                onUpdateItemStatus={(id, status) => {
                  setInventoryItems((prev) => {
                    const next = prev.map((i) => i.id === id ? { ...i, toolStatus: status as ToolStatus } : i);
                    try { localStorage.setItem("machinpro_inventory", JSON.stringify(next)); } catch {}
                    return next;
                  });
                }}
                onReturnTool={(itemId, condition, notes, photoUrl) => {
                  const newStatus: ToolStatus = condition === "good" ? "available" : "maintenance";
                  const today = new Date().toISOString().slice(0, 10);
                  setInventoryItems((prev) => {
                    const next = prev.map((i) =>
                      i.id === itemId
                        ? { ...i, toolStatus: newStatus, assignedToProjectId: undefined, assignedToEmployeeId: undefined }
                        : i
                    );
                    try { localStorage.setItem("machinpro_inventory", JSON.stringify(next)); } catch {}
                    return next;
                  });
                  setAssetUsageLogs((prev) => {
                    const updated = prev.map((log) =>
                      log.assetType === "tool" && log.assetId === itemId && !log.endDate
                        ? { ...log, endDate: today, notes: notes || log.notes, returnPhotoUrl: photoUrl, returnCondition: condition }
                        : log
                    );
                    try { localStorage.setItem("machinpro_asset_usage_logs", JSON.stringify(updated)); } catch {}
                    return updated;
                  });
                }}
                onMarkIncidentReviewed={(itemId) => {
                  setInventoryItems((prev) => {
                    const next = prev.map((i) => (i.id === itemId ? { ...i, incidentReviewed: true } : i));
                    try { localStorage.setItem("machinpro_inventory", JSON.stringify(next)); } catch {}
                    return next;
                  });
                }}
                onUpdateVehicleStatus={(id, status) => {
                  setVehicles((prev) => {
                    const next = prev.map((v) => v.id === id ? { ...v, vehicleStatus: status as VehicleStatus } : v);
                    try { localStorage.setItem("machinpro_vehicles", JSON.stringify(next)); } catch {}
                    return next;
                  });
                }}
                assetUsageLogs={assetUsageLogs}
                onAddUsageLog={(log) => setAssetUsageLogs((prev) => [...prev, { ...log, id: "log" + Date.now(), createdAt: new Date().toISOString() }])}
                resourceRequests={resourceRequests}
                onUpdateResourceRequestStatus={handleUpdateRequestStatus}
                onMarkResourceItemReady={handleMarkResourceItemReady}
                cloudinaryCloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}
                cloudinaryUploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? ""}
                companyName={profile?.companyName ?? companyName ?? ""}
                companyId={companyId ?? ""}
              />
              <ModuleHelpFab
                moduleKey="warehouse"
                labels={t as Record<string, string>}
                onOpenSettingsHelp={openSettingsHelpFromFab}
              />
            </>
            )}

            {activeSection === "employees" && !!perms.canAccessEmployees && (
              <>
              <EmployeesModule
                companyId={companyId}
                companyName={profile?.companyName ?? companyName ?? ""}
                onBackToOffice={() => setActiveSection("office")}
                defaultPayCurrency={currency}
                labels={t as Record<string, string>}
                customRoles={customRoles}
                projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name, archived: p.archived }))}
                canManageEmployees={!!rolePerms.canManageEmployees}
                showNewEmployeeButton={
                  effectiveRole === "admin" || !!rolePerms.canManageEmployees
                }
                currentUserProfileId={profile?.id ?? null}
                cloudinaryCloudName={
                  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || "dwdlmxmkt"
                }
                cloudinaryUploadPreset={
                  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || "i5dmd07o"
                }
                userProfileToEmployeeId={userToEmployeeMap}
                complianceFields={complianceFields}
                complianceRecords={complianceRecords}
                onComplianceRecordsChange={setComplianceRecords}
                vacationRequests={vacationRequests}
              />
              <ModuleHelpFab
                moduleKey="employees"
                labels={t as Record<string, string>}
                onOpenSettingsHelp={openSettingsHelpFromFab}
              />
            </>
            )}

            {activeSection === "site" && perms.site && (
              <>
                {canViewProjectsTab && perms.canAccessSubcontractors ? (
                  <HorizontalScrollFade className="mb-4 max-md:-mx-1" variant="inherit">
                    <div
                      className="flex flex-nowrap md:flex-wrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0"
                      role="tablist"
                      aria-label={(t as Record<string, string>).nav_operations ?? ""}
                    >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={operationsMainTab === "projects"}
                      onClick={() => setOperationsMainTab("projects")}
                      className={`inline-flex min-h-[44px] items-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                        operationsMainTab === "projects"
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
                          : "border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {t.projects ?? "Proyectos"}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={operationsMainTab === "subcontractors"}
                      onClick={() => setOperationsMainTab("subcontractors")}
                      className={`inline-flex min-h-[44px] items-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                        operationsMainTab === "subcontractors"
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
                          : "border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {t.subcontractors ?? "Subcontratistas"}
                    </button>
                    </div>
                  </HorizontalScrollFade>
                ) : null}
                {!canViewProjectsTab && perms.canAccessSubcontractors ? (
                  <SubcontractorsModule
                   companyId={companyId}
                    onBackToOffice={() => setActiveSection("office")}
                    labels={t as Record<string, string>}
                    projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name, archived: p.archived }))}
                    canManage={rolePerms.canManageSubcontractors}
                    canDeleteSubcontractor={effectiveRole === "admin" || !!rolePerms.canManageSubcontractors}
                    customRoles={customRoles}
                  />
                ) : operationsMainTab === "subcontractors" && perms.canAccessSubcontractors ? (
                  <SubcontractorsModule
                    companyId={companyId}
                    onBackToOffice={() => setOperationsMainTab("projects")}
                    labels={t as Record<string, string>}
                    projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name, archived: p.archived }))}
                    canManage={rolePerms.canManageSubcontractors}
                    canDeleteSubcontractor={effectiveRole === "admin" || !!rolePerms.canManageSubcontractors}
                    customRoles={customRoles}
                  />
                ) : (
                  <ProjectsModule
                labels={t}
                projects={siteProjects}
                selectedProjectId={siteSelectedProjectId}
                onSelectProject={setSiteSelectedProjectId}
                onPhotoObra={async (projectId, photoCategory, uploadedUrl) => {
                  if (!uploadedUrl || !companyId) return;
                  await uploadPhoto({
                    projectId,
                    projectName: (projects ?? []).find((p) => p.id === projectId)?.name ?? "",
                    photoUrl: uploadedUrl,
                    photoCategory: photoCategory ?? "progress",
                    photoType: "obra",
                    submittedByEmployeeId: effectiveEmployeeId ?? undefined,
                    submittedByName: (employees ?? []).find((e) => e.id === effectiveEmployeeId)?.name ?? "Unknown",
                    notes: siteDiaryNotesDraft,
                    companyId,
                  });
                }}
                onPhotoInventario={() => {}}
                photoNotes={siteDiaryNotesDraft}
                setPhotoNotes={setSiteDiaryNotesDraft}
                allEmployees={siteEmployees}
                inventoryItems={siteInventoryItems}
                diaryEntries={photos.map((p) => ({
                  id: p.id,
                  projectId: p.project_id,
                  photoUrls: [p.photo_url],
                  photoCategory: p.photo_category,
                  photoType: p.photo_type,
                  status: p.status,
                  submittedByName: p.submitted_by_name ?? "",
                  submittedByEmployeeId: p.submitted_by_employee_id,
                  createdAt: p.created_at,
                  notes: p.notes ?? "",
                  date: p.created_at.split("T")[0],
                  projectName: p.project_name ?? "",
                  rejectionReason: p.rejected_reason ?? undefined,
                }))}
                companyName={profile?.companyName ?? companyName ?? "Canariense Inc"}
                companyLogoUrl={logoUrl || undefined}
                companyAddress={companyAddress}
                companyPhone={companyPhone}
                companyEmail={companyEmail}
                companyWebsite={companyWebsite}
                projectPhotos={photos}
                language={language}
                currentUserDisplayName={
                  profile?.fullName ??
                  profile?.email ??
                  effectiveEmployeeId ??
                  user?.email ??
                  (t as Record<string, string>).admin ??
                  "Admin"
                }
                currentUserRole={effectiveRole}
                onApproveDiaryEntry={async (id) => {
                  const ph = photos.find((p) => p.id === id);
                  await approvePhoto(id, effectiveEmployeeId ?? "admin");
                  if (companyId && supabase && ph?.submitted_by_employee_id) {
                    const tl = t as Record<string, string>;
                    void postAppNotification(supabase, {
                      companyId,
                      targetEmployeeKey: ph.submitted_by_employee_id,
                      type: "photo_approved",
                      title: tl.notif_photo_approved_title ?? "Photo approved",
                      data: { photoId: id, projectId: ph.project_id },
                    });
                  }
                  void logAuditEvent({
                    company_id: companyId ?? "",
                    user_id: user?.id ?? "",
                    user_name: profile?.fullName ?? profile?.email ?? "admin",
                    action: "photo_approved",
                    entity_type: "photo",
                    entity_id: id,
                    new_value: {
                      approved_by: effectiveEmployeeId,
                      approved_at: new Date().toISOString(),
                    },
                  });
                }}
                onRejectDiaryEntry={async (id, notes) => {
                  const ph = photos.find((p) => p.id === id);
                  await rejectPhoto(id, notes);
                  if (companyId && supabase && ph?.submitted_by_employee_id) {
                    const tl = t as Record<string, string>;
                    void postAppNotification(supabase, {
                      companyId,
                      targetEmployeeKey: ph.submitted_by_employee_id,
                      type: "photo_rejected",
                      title: tl.notif_photo_rejected_title ?? "Photo rejected",
                      body: notes ?? null,
                      data: { photoId: id, projectId: ph.project_id },
                    });
                  }
                  void logAuditEvent({
                    company_id: companyId ?? "",
                    user_id: user?.id ?? "",
                    user_name: profile?.fullName ?? profile?.email ?? "admin",
                    action: "photo_rejected",
                    entity_type: "photo",
                    entity_id: id,
                    new_value: { rejected_reason: notes },
                  });
                }}
                onUpdateProjectEmployees={(projectId, employeeIds) => {
                  const prevAssigned = projects.find((p) => p.id === projectId)?.assignedEmployeeIds ?? [];
                  setProjects((prev) =>
                    prev.map((p) =>
                      p.id === projectId ? { ...p, assignedEmployeeIds: employeeIds } : p
                    )
                  );
                  if (!companyId || !supabase) return;
                  const added = employeeIds.filter((eid) => !prevAssigned.includes(eid));
                  if (added.length === 0) return;
                  const tl = t as Record<string, string>;
                  const title = tl.notif_project_assigned_title ?? "";
                  for (const eid of added) {
                    void postAppNotification(supabase, {
                      companyId,
                      targetEmployeeKey: eid,
                      type: "project_assigned",
                      title,
                      data: { projectId },
                    });
                  }
                }}
                onUpdateItemProject={(itemId, projectId) => {
                  setInventoryItems((prev) =>
                    prev.map((i) =>
                      i.id === itemId ? { ...i, assignedToProjectId: projectId ?? undefined } : i
                    )
                  );
                }}
                onReturnToolFromProject={(toolId) => {
                  const today = new Date().toISOString().slice(0, 10);
                  setInventoryItems((prev) => {
                    const next = prev.map((i) =>
                      i.id === toolId
                        ? { ...i, toolStatus: "available" as const, assignedToProjectId: undefined, assignedToEmployeeId: undefined }
                        : i
                    );
                    try { localStorage.setItem("machinpro_inventory", JSON.stringify(next)); } catch {}
                    return next;
                  });
                  setAssetUsageLogs((prev) =>
                    prev.map((log) =>
                      log.assetType === "tool" && log.assetId === toolId && !log.endDate
                        ? { ...log, endDate: today }
                        : log
                    )
                  );
                }}
                onOpenResourceRequest={(projectId) => setRequestModalProjectId(projectId)}
                resourceRequests={resourceRequests}
                onConfirmReception={handleConfirmReception}
                companyPlan={subscriptionRow?.plan ?? "esencial"}
                blueprints={blueprints}
                currentUserEmployeeId={currentUserEmployeeId ?? ""}
                currentUserName={
                  employees.find((e) => e.id === currentUserEmployeeId)?.name ?? "Admin"
                }
                onAddBlueprint={handleAddBlueprint}
                onUpdateAnnotations={handleUpdateBlueprintAnnotations}
                onAddRevision={handleAddBlueprintRevision}
                onMarkBlueprintNotCurrent={handleMarkBlueprintNotCurrent}
                canEdit={rolePerms.canEditProjects}
                canAnnotateBlueprints={!!rolePerms.canManageProjectBlueprints}
                cloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}
                projectForms={projectForms}
                safetyChecklists={safetyChecklists}
                onSaveChecklist={(checklist) => {
                  setSafetyChecklists((prev) => {
                    const exists = prev.find((c) => c.id === checklist.id);
                    if (exists) return prev.map((c) => (c.id === checklist.id ? checklist : c));
                    return [...prev, checklist];
                  });
                  setProjectForms((prev) =>
                    prev.map((f) =>
                      f.safetyChecklistId === checklist.id
                        ? {
                            ...f,
                            status:
                              checklist.status === "draft"
                                ? ("draft" as const)
                                : checklist.status === "completed" || checklist.status === "submitted"
                                  ? ("completed" as const)
                                  : f.status,
                          }
                        : f
                    )
                  );
                }}
                countryCode={companyCountry ?? "CA"}
                timeZone={userTimeZone}
                companyCurrency={currency}
                dailyReports={dailyReports}
                onRefreshDailyReports={reloadDailyReports}
                onDailyReportPublished={handleDailyReportPublished}
                teamProfiles={teamProfiles}
                canManageDailyReports={!!rolePerms.canManageDailyReports}
                companyId={companyId ?? ""}
                currentUserProfileId={profile?.id ?? null}
                onOpenHazardFromBlueprint={(id) => {
                  setFocusHazardId(id);
                  setActiveSection("security");
                }}
                onOpenCorrectiveFromBlueprint={() => {
                  setActiveSection("security");
                }}
                projectTasks={projectTasks}
                onCreateTask={(task) => {
                  setProjectTasks((prev) => [
                    ...prev,
                    {
                      ...task,
                      id: "task-" + Date.now(),
                      createdAt: new Date().toISOString(),
                    },
                  ]);
                }}
                onUpdateTask={(taskId, updates) => {
                  setProjectTasks((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
                  );
                }}
                onDeleteTask={(taskId) => {
                  setProjectTasks((prev) => prev.filter((t) => t.id !== taskId));
                }}
                canViewAttendancePanel={!!rolePerms.canViewAttendance}
                canUseProjectTimeclock={!!rolePerms.canViewTimeclock}
                visitorOpenQrSignal={dashVisitorQrSig}
                visitorTabSignal={dashVisitorTabSig}
                openRfiTabSignal={projectsOpenRfiSig}
                showProjectRfiTab={!!rolePerms.canViewProjectRFI}
                showProjectVisitorsTab={!!rolePerms.canViewProjectVisitors}
                canManageProjectGallery={!!rolePerms.canManageProjectGallery}
                onInspectionReportGenerated={(payload) => {
                  void logAuditEvent({
                    company_id: companyId ?? "",
                    user_id: user?.id ?? "",
                    user_name: profile?.fullName ?? profile?.email ?? "admin",
                    action: "inspection_report_generated",
                    entity_type: "project",
                    entity_id: payload.projectId,
                    entity_name: payload.projectName,
                    new_value: {
                      photo_count: payload.photoCount,
                      report_title: payload.reportTitle,
                    },
                  });
                }}
                canUploadPhotos={!!rolePerms.canUploadPhotos}
                onGalleryPhotoDownloaded={(payload) => {
                  void logAuditEvent({
                    company_id: companyId ?? "",
                    user_id: user?.id ?? "",
                    user_name: profile?.fullName ?? profile?.email ?? "admin",
                    action: "photo_downloaded",
                    entity_type: "photo",
                    entity_id: payload.photoId,
                    entity_name: payload.projectName,
                    new_value: { project_id: payload.projectId },
                  });
                }}
                onGalleryPhotosBulkDownloaded={(payload) => {
                  void logAuditEvent({
                    company_id: companyId ?? "",
                    user_id: user?.id ?? "",
                    user_name: profile?.fullName ?? profile?.email ?? "admin",
                    action: "photos_bulk_downloaded",
                    entity_type: "project",
                    entity_id: payload.projectId,
                    entity_name: payload.projectName,
                    new_value: { photo_count: payload.count },
                  });
                }}
                onCreateForm={(projectId, form) => {
                  const newForm = {
                    ...form,
                    id: "form-" + Date.now(),
                    createdAt: new Date().toISOString(),
                    responses: [] as ProjectForm["responses"],
                  };
                  console.log("Creando formulario:", newForm);
                  setProjectForms((prev) => [...prev, newForm]);
                }}
                onDeleteForm={(formId) => {
                  setProjectForms((prev) => {
                    const f = prev.find((x) => x.id === formId);
                    if (f?.safetyChecklistId) {
                      setSafetyChecklists((prevC) => prevC.filter((c) => c.id !== f.safetyChecklistId));
                    }
                    return prev.filter((x) => x.id !== formId);
                  });
                }}
              />
                )}
              <ModuleHelpFab
                moduleKey="site"
                labels={t as Record<string, string>}
                onOpenSettingsHelp={openSettingsHelpFromFab}
              />
              </>
            )}

            {activeSection === "schedule" && (perms.canAccessSchedule !== false) && (
              <>
              <ScheduleModule
                entries={scheduleEntries}
                employees={activeEmployees.map((e) => ({
                  id: e.id,
                  name: e.name,
                  role: e.role,
                  scheduleRoleKey: scheduleRoleKeyForEmployee(e, customRoles),
                }))}
                customRoles={customRoles.map((r) => ({ id: r.id, name: r.name }))}
                projects={projects.map((p) => ({
                  id: p.id,
                  name: p.name,
                  projectCode: p.projectCode,
                  locationLat: p.locationLat,
                  locationLng: p.locationLng,
                  location: p.location,
                }))}
                currentUserEmployeeId={currentUserEmployeeId ?? undefined}
                employeeLabels={scheduleEmployeeLabels}
                canWrite={!!rolePerms.canCreateShifts}
                canClockIn={effectiveRole !== "admin"}
                viewAll={!!rolePerms.canViewSchedule}
                canApproveVacations={!!rolePerms.canManageVacations}
                canRequestVacation={!!session && !!companyId}
                vacationRequests={vacationRequests}
                vacationEmployeeNames={vacationEmployeeNames}
                onApproveVacation={handleApproveVacation}
                onRejectVacation={handleRejectVacation}
                onRequestVacation={handleCreateVacationRequest}
                labels={{
                  schedule: t.schedule ?? "Horario",
                  shift: (t as Record<string, string>).shift ?? "Turno",
                  event: (t as Record<string, string>).event ?? "Evento",
                  addEntry: (t as Record<string, string>).addEntry ?? "Añadir turno",
                  noEntries: (t as Record<string, string>).noEntries ?? "No entries",
                  schedule_no_sheets: (t as Record<string, string>).schedule_no_sheets ?? "No timesheets",
                  schedule_no_shifts_day: (t as Record<string, string>).schedule_no_shifts_day ?? "No shifts on this day",
                  today: (t as Record<string, string>).today ?? "Hoy",
                  clockInTitle: (t as Record<string, string>).clockInTitle ?? "Fichaje de hoy",
                  clockIn: (t as Record<string, string>).clockIn ?? "Fichar Entrada",
                  clockOut: (t as Record<string, string>).clockOut ?? "Fichar Salida",
                  clockInDone: (t as Record<string, string>).clockInDone ?? "Jornada completada",
                  clockInEntry: (t as Record<string, string>).clockInEntry ?? "Entrada",
                  clockOutEntry: (t as Record<string, string>).clockOutEntry ?? "Salida",
                  gpsLocating: (t as Record<string, string>).gpsLocating ?? "Obteniendo ubicación…",
                  gpsNoGps: (t as Record<string, string>).gpsNoGps ?? "GPS no disponible — fichaje sin ubicación",
                  gpsOutOfRange: (t as Record<string, string>).gpsOutOfRange ?? "Fuera de rango GPS",
                  projectCodePlaceholder: (t as Record<string, string>).projectCodePlaceholder ?? "Código de proyecto (ej: MON-01)",
                  projectCodeNotFound: (t as Record<string, string>).projectCodeNotFound ?? "Código no encontrado",
                  projectCode: (t as Record<string, string>).projectCode,
                  projectCodeHint: (t as Record<string, string>).projectCodeHint,
                  useAnotherCode: (t as Record<string, string>).useAnotherCode,
                  backToMyProjects: (t as Record<string, string>).backToMyProjects,
                  selectProjectToClock: (t as Record<string, string>).selectProjectToClock,
                  editEntry: (t as Record<string, string>).editEntry ?? "Editar turno",
                  confirmDeleteShift: (t as Record<string, string>).confirmDeleteShift ?? "¿Eliminar este turno? Esta acción no se puede deshacer",
                  cancel: t.cancel,
                  delete: (t as Record<string, string>)["delete"],
                  timesheets: (t as Record<string, string>).timesheets ?? "Hojas de horas",
                  weekly: (t as Record<string, string>).weekly ?? "Semanal",
                  biweekly: (t as Record<string, string>).biweekly ?? "Quincenal",
                  monthly: (t as Record<string, string>).monthly ?? "Mensual",
                  regularHours: (t as Record<string, string>).regularHours ?? "Horas regulares",
                  overtimeHours: (t as Record<string, string>).overtimeHours ?? "Horas extra",
                  approve: (t as Record<string, string>).approve ?? "Aprobar",
                  reject: (t as Record<string, string>).reject ?? "Rechazar",
                  approved: (t as Record<string, string>).approved ?? "Aprobado",
                  rejected: (t as Record<string, string>).rejected ?? "Rechazado",
                  pending: (t as Record<string, string>).pending ?? "Pendiente",
                  previousMonth: "Anterior",
                  nextMonth: "Siguiente",
                  january: (t as Record<string, string>).january,
                  february: (t as Record<string, string>).february,
                  march: (t as Record<string, string>).march,
                  april: (t as Record<string, string>).april,
                  may: (t as Record<string, string>).may,
                  june: (t as Record<string, string>).june,
                  july: (t as Record<string, string>).july,
                  august: (t as Record<string, string>).august,
                  september: (t as Record<string, string>).september,
                  october: (t as Record<string, string>).october,
                  november: (t as Record<string, string>).november,
                  december: (t as Record<string, string>).december,
                  monShort: (t as Record<string, string>).monShort,
                  tueShort: (t as Record<string, string>).tueShort,
                  wedShort: (t as Record<string, string>).wedShort,
                  thuShort: (t as Record<string, string>).thuShort,
                  friShort: (t as Record<string, string>).friShort,
                  satShort: (t as Record<string, string>).satShort,
                  sunShort: (t as Record<string, string>).sunShort,
                  date: (t as Record<string, string>).date ?? "Fecha",
                  project: t.projects ?? "Proyecto",
                  personnel: t.personnel ?? "Empleados",
                  hours: t.hours ?? "Horas",
                  outsideZone: (t as Record<string, string>).outsideZone ?? "Fuera de zona",
                  pendingCertsAtClockIn: (t as Record<string, string>).pendingCertsAtClockIn ?? "Certs pendientes al fichar",
                  days: (t as Record<string, string>).days ?? "días",
                  schedule_event_company: (t as Record<string, string>).schedule_event_company,
                  schedule_day_off_collective: (t as Record<string, string>).schedule_day_off_collective,
                  schedule_personal_leave: (t as Record<string, string>).schedule_personal_leave,
                  schedule_event_type: (t as Record<string, string>).schedule_event_type,
                  schedule_vacation_request: (t as Record<string, string>).schedule_vacation_request,
                  schedule_vacation_pending_list: (t as Record<string, string>).schedule_vacation_pending_list,
                  schedule_vacation_comment: (t as Record<string, string>).schedule_vacation_comment,
                  schedule_vacation_calendar_note: (t as Record<string, string>).schedule_vacation_calendar_note,
                  schedule_legend_meeting: (t as Record<string, string>).schedule_legend_meeting,
                  schedule_legend_training: (t as Record<string, string>).schedule_legend_training,
                  employees_request_vacation: (t as Record<string, string>).employees_request_vacation,
                  common_other: (t as Record<string, string>).common_other,
                  schedule_select_all: (t as Record<string, string>).schedule_select_all,
                  schedule_deselect_all: (t as Record<string, string>).schedule_deselect_all,
                  schedule_filter_by_role: (t as Record<string, string>).schedule_filter_by_role,
                  schedule_pick_employees: (t as Record<string, string>).schedule_pick_employees,
                  schedule_pick_employees_error: (t as Record<string, string>).schedule_pick_employees_error,
                  export_csv: (t as Record<string, string>).export_csv ?? "Export CSV",
                  export_pdf: (t as Record<string, string>).export_pdf ?? "Export PDF",
                  export_timesheets: (t as Record<string, string>).export_timesheets ?? "Export timesheets",
                  export_success: (t as Record<string, string>).export_success ?? "Export completed",
                  export_error: (t as Record<string, string>).export_error ?? "Export error",
                  admin: (t as Record<string, string>).admin,
                  supervisor: (t as Record<string, string>).supervisor,
                  worker: (t as Record<string, string>).worker,
                  logistic: (t as Record<string, string>).logistic,
                  whFilterAll: (t as Record<string, string>).whFilterAll,
                  openInMaps: (t as Record<string, string>).openInMaps,
                  viewMyShift: (t as Record<string, string>).viewMyShift,
                }}
                onAddEntry={handleAddScheduleEntry}
                onUpdateEntry={handleUpdateScheduleEntry}
                onDeleteEntry={handleDeleteScheduleEntry}
                clockEntries={displayClockEntries}
                clockInProjectCode={clockInProjectCode}
                setClockInProjectCode={setClockInProjectCode}
                gpsStatus={clockInGpsStatus}
                clockInAlertMessage={clockInAlertMessage}
                onDismissClockInAlert={() => setClockInAlertMessage(null)}
                onClockIn={handleClockIn}
                onClockOut={handleClockOut}
                onOpenMyShiftView={openEmployeeShiftDay}
                scheduleSelfIds={scheduleSelfIds}
                assignedClockInProjects={assignedClockInProjects}
                dateLocale={dateLocaleBcp47}
                timeZone={userTimeZone}
                companyName={profile?.companyName ?? companyName ?? ""}
                companyId={companyId ?? ""}
              />
              <ModuleHelpFab
                moduleKey="schedule"
                labels={t as Record<string, string>}
                onOpenSettingsHelp={openSettingsHelpFromFab}
              />
            </>
            )}

            {activeSection === "forms" && (perms.forms !== false) && (
              <>
              <FormsModule
                templates={formTemplates}
                instances={formInstances}
                projects={visibleProjects.map((p) => ({
                  id: p.id,
                  name: p.name,
                  assignedEmployeeIds: p.assignedEmployeeIds,
                }))}
                employees={activeEmployees.map((e) => ({ id: e.id, name: e.name, email: e.email }))}
                currentUserEmployeeId={effectiveEmployeeId ?? ""}
                currentUserName={employees.find((e) => e.id === effectiveEmployeeId)?.name ?? "Admin"}
                canManage={!!rolePerms.canManageProjectForms}
                onCreateInstance={(instance) => setFormInstances((prev) => [...prev, instance])}
                onUpdateInstance={(instance) => {
                  setFormInstances((prev) => prev.map((i) => (i.id === instance.id ? instance : i)));
                  if (!isOnline) addToPendingSync("form_instance", instance);
                }}
                onAddTemplate={(tpl) => setFormTemplates((prev) => [...prev, tpl])}
                onUpdateTemplate={(tpl) =>
                  setFormTemplates((prev) => prev.map((t) => (t.id === tpl.id ? tpl : t)))}
                onDeleteTemplate={(id) =>
                  setFormTemplates((prev) => prev.filter((t) => t.id !== id || t.isBase))}
                labels={t as Record<string, string>}
              />
              <ModuleHelpFab
                moduleKey="forms"
                labels={t as Record<string, string>}
                onOpenSettingsHelp={openSettingsHelpFromFab}
              />
            </>
            )}

            {activeSection === "security" && (perms.canAccessSecurity ?? false) && (
              <>
              <SecurityModule
                t={t as Record<string, string>}
                companyId={companyId}
                companyName={profile?.companyName ?? companyName}
                userRole={effectiveRole}
                userName={profile?.fullName ?? profile?.email ?? user?.email ?? "User"}
                userProfileId={profile?.id ?? null}
                projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name }))}
                employees={activeEmployees.map((e) => ({ id: e.id, name: e.name }))}
                focusHazardId={focusHazardId}
                onFocusHazardConsumed={() => setFocusHazardId(null)}
                correctivePrefill={correctivePrefill}
                onConsumeCorrectivePrefill={consumeCorrectivePrefill}
                initialTab={securityInitialTab}
                onInitialTabConsumed={() => setSecurityInitialTab(null)}
                onSecurityTabInteraction={resetSecurityDashSignals}
                openHazardSignal={dashHazardCreateSig}
                openActionSignal={dashActionCreateSig}
                binders={binders}
                binderDocuments={binderDocuments}
                canManageBinders={perms.canManageBinders ?? false}
                roleOptions={customRoles.map((r) => ({ id: r.id, name: r.name }))}
                onAddBinder={(b) => setBinders((prev) => [...prev, b])}
                onDeleteBinder={(id) =>
                  setBinders((prev) => prev.filter((b) => b.id !== id || b.isDefault))
                }
                onAddDocument={(d) => setBinderDocuments((prev) => [...prev, d])}
                onDeleteDocument={(id) =>
                  setBinderDocuments((prev) => prev.filter((d) => d.id !== id))
                }
                auditLogs={auditLogs}
                canManageRoles={rolePerms.canManageRoles}
                canShowHazards={!!(rolePerms.canViewHazards || rolePerms.canManageHazards)}
                canShowActions={
                  !!(rolePerms.canViewCorrectiveActions || rolePerms.canManageCorrectiveActions)
                }
                canShowDocuments={
                  !!(
                    rolePerms.canViewSecurityDocs ||
                    rolePerms.canManageSecurityDocs ||
                    rolePerms.canViewBinders ||
                    rolePerms.canManageBinders
                  )
                }
                canShowAudit={!!(rolePerms.canViewSecurityAudit || rolePerms.canViewAuditLog)}
                onOpenCorrectiveFromHazard={({ hazardId, projectId, projectName }) => {
                  setCorrectivePrefill({
                    hazardId,
                    projectId,
                    projectName,
                  });
                }}
                onRequestFocusHazard={(id) => setFocusHazardId(id)}
                dateLocale={dateLocaleBcp47}
                timeZone={userTimeZone}
              />
              <ModuleHelpFab
                moduleKey="security"
                labels={t as Record<string, string>}
                onOpenSettingsHelp={openSettingsHelpFromFab}
              />
            </>
            )}

            {activeSection === "settings" && (perms.canViewSettings ?? false) && (
              <>
              <SettingsModule
                labels={{
                  ...(t as Record<string, string>),
                  settings: t.settings,
                  tabGeneral: t.tabGeneral,
                  language: t.language,
                  currency: t.currency,
                  measurementSystem: t.measurementSystem,
                  settingsMetric: (t as Record<string, string>).settingsMetric ?? "Métrico",
                  settingsImperial: (t as Record<string, string>).settingsImperial ?? "Imperial",
                  companyIdentity: (t as Record<string, string>).companyIdentity ?? "Identidad de empresa",
                  companyName: (t as Record<string, string>).companyName ?? "Nombre de empresa",
                  companyLogo: (t as Record<string, string>).companyLogo ?? "Logo de empresa",
                  logoHint: (t as Record<string, string>).logoHint ?? "El logo aparecerá en reportes y formularios PDF",
                  uploadLogo: (t as Record<string, string>).uploadLogo ?? "Subir logo",
                  countryRegion: (t as Record<string, string>).countryRegion ?? "País / Región",
                  autoSetupConfirm: (t as Record<string, string>).autoSetupConfirm ?? "País actualizado — moneda y medidas configuradas",
                  settings_regional_advanced: (t as Record<string, string>).settings_regional_advanced ?? "Configuración regional avanzada",
                  settings_regional_advanced_hint:
                    (t as Record<string, string>).settings_regional_advanced_hint ??
                    "Opciones regionales adicionales (zona horaria, formatos) gestionadas por el administrador.",
                }}
                language={language}
                setLanguage={(lang) => void applyLanguage(lang)}
                currency={currency}
                setCurrency={(c) => setCurrency(c as Currency)}
                measurementSystem={measurementSystem}
                setMeasurementSystem={setMeasurementSystem}
                canEditCompanyProfile={!!rolePerms.canEditCompanyProfile}
                canManageCompliance={!!rolePerms.canManageCompliance}
                canManageProjectVisitors={!!rolePerms.canManageProjectVisitors}
                canManageRegionalConfig={!!rolePerms.canManageRegionalConfig}
                companyCountry={companyCountry}
                onCountryChange={(country, defaults) => {
                  setCompanyCountry(country);
                  if (defaults) {
                    setCurrency(defaults.currency as Currency);
                    setMeasurementSystem(defaults.measurementSystem);
                  }
                  const defaultFields = getDefaultComplianceFields(country);
                  setComplianceFields((prev) => [...defaultFields, ...prev.filter((f) => !f.isDefault)]);
                }}
                complianceFields={complianceFields}
                onComplianceFieldsChange={setComplianceFields}
                companyName={companyName}
                onCompanyNameChange={setCompanyName}
                logoUrl={logoUrl}
                onLogoUpload={handleLogoUpload}
                companyAddress={companyAddress}
                onCompanyAddressChange={setCompanyAddress}
                companyPhone={companyPhone}
                onCompanyPhoneChange={setCompanyPhone}
                companyEmail={companyEmail}
                onCompanyEmailChange={setCompanyEmail}
                companyWebsite={companyWebsite}
                onCompanyWebsiteChange={setCompanyWebsite}
                onSaveCompanyProfile={
                  rolePerms.canEditCompanyProfile && companyId
                    ? () => void handleSaveCompanyProfile()
                    : undefined
                }
                companyProfileSaveBusy={companyProfileSaveBusy}
                session={session}
                onSignOut={() => void handleLogout()}
                companyId={companyId}
                showBillingSection={!!rolePerms.canViewBilling}
                billingSection={
                  companyId ? (
                    <BillingModule
                      t={t as Record<string, string>}
                      companyId={companyId}
                      companyName={profile?.companyName ?? companyName}
                      email={profile?.email ?? undefined}
                      employeesCount={activeEmployees.length}
                      projectsCount={(projects ?? []).filter((p) => !p.archived).length}
                      storageUsedGb={0}
                      userRole={effectiveRole}
                      dateLocale={dateLocaleBcp47}
                      timeZone={userTimeZone}
                    />
                  ) : null
                }
                profileFullName={profileEditName}
                setProfileFullName={setProfileEditName}
                profileEmail={profile?.email ?? user?.email ?? ""}
                profilePhone={profileEditPhone}
                setProfilePhone={setProfileEditPhone}
                profileAvatarUrl={profileEditAvatarUrl}
                onProfileAvatarUpload={handleProfileAvatarUpload}
                onSaveProfile={() => void handleSaveUserProfile()}
                profileSaveBusy={profileSaveBusy}
                onRequestPasswordReset={() => void handleRequestPasswordReset()}
                passwordResetBusy={passwordResetBusy}
                onReopenOnboarding={
                  effectiveRole === "admin"
                    ? () => {
                        try {
                          localStorage.removeItem("machinpro_onboarding_complete");
                        } catch {
                          /* ignore */
                        }
                        setOnboardingComplete(false);
                      }
                    : undefined
                }
                savedProfileTimeZone={profile?.timezone ?? null}
                onPersistUserTimeZone={(tz) => void applyUserTimezone(tz)}
                focusHelpSectionSignal={settingsHelpFocusSignal}
              />
              <ModuleHelpFab
                moduleKey="settings"
                labels={t as Record<string, string>}
                onOpenSettingsHelp={openSettingsHelpFromFab}
              />
            </>
            )}

            {requestModalProjectId && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                  <div className="p-4 border-b border-zinc-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="font-semibold text-zinc-900 dark:text-white">
                      {t.requestResources ?? "Solicitar recursos"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setRequestModalProjectId(null)}
                      className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-4 space-y-4">
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-zinc-500 uppercase">
                        {projects.find((p) => p.id === requestModalProjectId)?.name}
                      </p>
                      <div>
                        <label className="text-sm font-medium">
                          {t.neededBy ?? "Necesario para"}
                        </label>
                        <input
                          type="date"
                          value={requestNeededBy}
                          onChange={(e) => setRequestNeededBy(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm min-h-[44px] mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          {t.notes ?? "Notas"}
                        </label>
                        <textarea
                          value={requestNotes}
                          onChange={(e) => setRequestNotes(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm min-h-[80px] mt-1 resize-none"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-2">
                        {t.whTabTools ?? "Herramientas y Equipos"}
                      </p>
                      {inventoryItems
                        .filter(
                          (i) =>
                            (i.type === "tool" || i.type === "equipment") &&
                            i.toolStatus === "available"
                        )
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800"
                          >
                            <div>
                              <span className="text-sm">{item.name}</span>
                              <span className="text-xs text-zinc-400 ml-2">
                                ({item.quantity} {t.available ?? "Disponibles"})
                              </span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={requestQuantities[item.id] ?? 0}
                              onChange={(e) =>
                                setRequestQuantities((prev) => ({
                                  ...prev,
                                  [item.id]: Number.parseInt(e.target.value, 10) || 0,
                                }))
                              }
                              className="w-16 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-slate-900 text-center text-sm py-1 min-h-[36px]"
                            />
                          </div>
                        ))}
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-2">
                        {(t as Record<string, string>).whTabMaterial ?? "Materiales"}
                      </p>
                      {inventoryItems
                        .filter((i) => i.type === "consumable" || i.type === "material")
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800"
                          >
                            <div>
                              <span className="text-sm">{item.name}</span>
                              <span className="text-xs text-zinc-400 ml-2">
                                ({item.quantity} {item.unit})
                              </span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={requestQuantities[item.id] ?? 0}
                              onChange={(e) =>
                                setRequestQuantities((prev) => ({
                                  ...prev,
                                  [item.id]: Number.parseInt(e.target.value, 10) || 0,
                                }))
                              }
                              className="w-16 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-slate-900 text-center text-sm py-1 min-h-[36px]"
                            />
                          </div>
                        ))}
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-2">
                        Externos / Compras directas
                      </p>
                      <textarea
                        value={requestExternal}
                        onChange={(e) => setRequestExternal(e.target.value)}
                        placeholder="Ej: Alquiler excavadora, cemento especial..."
                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm min-h-[80px] resize-none"
                      />
                    </div>
                  </div>
                  <div className="p-4 border-t border-zinc-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={submitResourceRequest}
                      className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 text-white py-3 text-sm font-semibold min-h-[44px] transition-colors"
                    >
                      {t.sendRequest ?? "Enviar solicitud"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="h-16 sm:hidden" aria-hidden />
        </main>
      </div>

      {(activeSection === "site" || activeSection === "warehouse") && effectiveRole !== "admin" && (
        <>
          <input
            ref={fabFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFabFileChange}
          />
          <div className="fixed bottom-20 right-4 z-40 sm:hidden">
          <button
            type="button"
            onClick={() => setFabOpen(!fabOpen)}
            className="h-14 w-14 rounded-full bg-amber-600 hover:bg-amber-500 shadow-lg flex items-center justify-center transition-all"
          >
            <Camera className="h-6 w-6 text-white" />
          </button>
          {fabOpen && (
            <div className="absolute bottom-16 right-0 flex flex-col gap-2 items-end">
              <button
                type="button"
                onClick={handleFabPhotoProgress}
                className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 shadow-md px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px] border border-zinc-200 dark:border-slate-700"
              >
                <Camera className="h-4 w-4 text-amber-500" />
                {(t as Record<string, string>).photoProgress ?? "Avance"}
              </button>
              <button
                type="button"
                onClick={handleFabPhotoIncident}
                className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 shadow-md px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px] border border-zinc-200 dark:border-slate-700"
              >
                <AlertTriangle className="h-4 w-4 text-red-500" />
                {(t as Record<string, string>).photoIncident ?? "Incidencia"}
              </button>
              <button
                type="button"
                onClick={handleFabPhotoHS}
                className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 shadow-md px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px] border border-zinc-200 dark:border-slate-700"
              >
                <Shield className="h-4 w-4 text-blue-500" />
                {(t as Record<string, string>).photoHealthSafety ?? "H&S"}
              </button>
            </div>
          )}
        </div>
        </>
      )}

      {/* Modal: Vincular incidencia a herramienta */}
      {fabIncidentToolModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 p-6 space-y-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              {(t as Record<string, string>).linkToTool ?? "¿Afecta a una herramienta?"}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {(t as Record<string, string>).linkToToolDesc ?? "Si la incidencia está relacionada con una herramienta, se marcará automáticamente para mantenimiento."}
            </p>
            <select
              value={fabLinkedToolId === "__free__" ? "" : fabLinkedToolId}
              onChange={(e) => setFabLinkedToolId(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
            >
              <option value="">{(t as Record<string, string>).selectTool ?? "Seleccionar herramienta..."}</option>
              {(inventoryItems ?? [])
                .filter(
                  (i) =>
                    (i.type === "tool" || i.type === "equipment") &&
                    i.assignedToProjectId === fabIncidentToolModal.projectId
                )
                .map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {tool.name}
                  </option>
                ))}
            </select>
            <textarea
              value={fabIncidentNotes}
              onChange={(e) => setFabIncidentNotes(e.target.value)}
              placeholder={
                (t as Record<string, string>).incidentNotes ?? "Notas sobre la incidencia (opcional)..."
              }
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[88px] resize-none"
            />
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer py-2 min-h-[44px]">
              <input
                type="checkbox"
                checked={fabLinkedToolId === "__free__"}
                onChange={(e) => setFabLinkedToolId(e.target.checked ? "__free__" : "")}
                className="rounded h-5 w-5 shrink-0"
              />
              {(t as Record<string, string>).freeToolLink ?? "Herramienta no registrada en inventario"}
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setFabIncidentToolModal(null);
                  setFabLinkedToolId("");
                  setFabIncidentNotes("");
                }}
                className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 py-3 text-sm text-zinc-700 dark:text-zinc-300 min-h-[44px] hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                {(t as Record<string, string>).skip ?? "No vincular"}
              </button>
              <button
                type="button"
                onClick={confirmFabToolLink}
                disabled={!fabLinkedToolId}
                className="flex-1 rounded-xl bg-amber-600 text-white py-3 text-sm font-medium min-h-[44px] disabled:opacity-50 hover:bg-amber-500"
              >
                {(t as Record<string, string>).linkTool ?? "Vincular"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Añadir / Editar proyecto */}
      {projectFormOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={closeProjectForm} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              {editingProjectId ? (t.edit ?? "") : (t.addNew ?? "")}{(t as Record<string, string>).projectFormTitleSuffix ?? ""}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).projectFormNameLabel ?? `${t.name} *`}
                </label>
                <input type="text" value={projectFormName}
                  onChange={(e) => setProjectFormName(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).projectFormCodeLabel ?? ""}
                </label>
                <input type="text" value={projectFormCode}
                  onChange={(e) => setProjectFormCode(e.target.value.toUpperCase())}
                  placeholder="MON-01" maxLength={10}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono tracking-wider text-zinc-900 dark:text-zinc-100 uppercase" />
                <p className="text-xs text-zinc-400 mt-1">
                  {(t as Record<string, string>).projectFormCodeHelp ?? ""}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).projectFormTypeLabel ?? ""}
                </label>
                <select value={projectFormType}
                  onChange={(e) => setProjectFormType(e.target.value as ProjectType)}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                  <option value="residential">{(t as Record<string, string>).projectTypeResidential ?? ""}</option>
                  <option value="commercial">{(t as Record<string, string>).projectTypeCommercial ?? ""}</option>
                  <option value="industrial">{(t as Record<string, string>).projectTypeIndustrial ?? ""}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).projectFormLocationLabel ?? ""}
                </label>
                <input type="text" value={projectFormLocation}
                  onChange={(e) => setProjectFormLocation(e.target.value)}
                  placeholder={(t as Record<string, string>).projectFormLocationPlaceholder ?? ""}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).projectFormBudgetTotal ?? ""}
                </label>
                <input type="number" min={0} value={projectFormBudget}
                  onChange={(e) => setProjectFormBudget(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {(t as Record<string, string>).projectFormDateStart ?? ""}
                  </label>
                  <input type="date" value={projectFormStart}
                    onChange={(e) => setProjectFormStart(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {(t as Record<string, string>).projectFormDateEnd ?? ""}
                  </label>
                  <input type="date" value={projectFormEnd}
                    onChange={(e) => setProjectFormEnd(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).projects_status_field ?? "Estado"}
                </label>
                <select
                  value={projectFormLifecycle}
                  onChange={(e) => setProjectFormLifecycle(e.target.value as "active" | "paused" | "completed")}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="active">{(t as Record<string, string>).projects_status_active ?? "Active"}</option>
                  <option value="paused">{(t as Record<string, string>).projects_status_paused ?? "Paused"}</option>
                  <option value="completed">{(t as Record<string, string>).projects_status_completed ?? "Completed"}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).projectFormGpsOptional ?? ""}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="0.000001"
                    value={projectFormLat}
                    onChange={(e) => setProjectFormLat(e.target.value)}
                    placeholder={(t as Record<string, string>).projectFormLatPlaceholder ?? ""}
                    className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                  <input type="number" step="0.000001"
                    value={projectFormLng}
                    onChange={(e) => setProjectFormLng(e.target.value)}
                    placeholder={(t as Record<string, string>).projectFormLngPlaceholder ?? ""}
                    className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  {(t as Record<string, string>).projectFormGpsHelp ?? ""}
                </p>
              </div>

            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeProjectForm} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]">{t.cancel ?? "Cancelar"}</button>
              <button type="button" onClick={saveProjectForm} className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]">{t.save ?? "Guardar"}</button>
            </div>
          </div>
        </>
      )}

      {/* Modal: Añadir / Editar ítem de inventario */}
      {(newItemFormOpen || (editingInventoryId && editInventoryDraft)) && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={closeInventoryForm} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">{editingInventoryId ? (t.edit ?? "Editar") : (t.addNew ?? "Añadir")} ítem</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.name ?? "Nombre"}</label>
                <input type="text" value={editingInventoryId ? (editInventoryDraft?.name ?? "") : newItemName} onChange={(e) => editingInventoryId ? setEditInventoryDraft((d) => d ? { ...d, name: e.target.value } : d) : setNewItemName(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.category ?? "Tipo"}</label>
                <select value={editingInventoryId ? (editInventoryDraft?.type ?? "material") : newItemCategory} onChange={(e) => editingInventoryId ? setEditInventoryDraft((d) => d ? { ...d, type: e.target.value as InventoryItem["type"] } : d) : setNewItemCategory(e.target.value as InventoryItem["type"])} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                  <option value="consumable">{t.consumable ?? "Material"}</option>
                  <option value="tool">{t.whTabTools ?? "Herramientas"}</option>
                  <option value="equipment">{t.equipment ?? "Equipo"}</option>
                  <option value="material">{t.whTabMaterial ?? "Material"}</option>
                </select>
              </div>
              {((editingInventoryId ? editInventoryDraft?.type : newItemCategory) === "tool" || (editingInventoryId ? editInventoryDraft?.type : newItemCategory) === "equipment") && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.serialNumber ?? "Número de serie"}</label>
                    <input type="text" value={editingInventoryId ? (editInventoryDraft?.serialNumber ?? "") : newItemSerialNumber} onChange={(e) => editingInventoryId ? setEditInventoryDraft((d) => d ? { ...d, serialNumber: e.target.value } : d) : setNewItemSerialNumber(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" placeholder="ej. SN-12345" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.internalId ?? "ID interno"}</label>
                    <input type="text" value={editingInventoryId ? (editInventoryDraft?.internalId ?? "") : newItemInternalId} onChange={(e) => editingInventoryId ? setEditInventoryDraft((d) => d ? { ...d, internalId: e.target.value } : d) : setNewItemInternalId(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" placeholder="ej. TOOL-001" />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Cantidad</label>
                  <input type="number" min={0} value={editingInventoryId ? (editInventoryDraft?.quantity ?? 0) : newItemQuantity} onChange={(e) => editingInventoryId ? setEditInventoryDraft((d) => d ? { ...d, quantity: parseFloat(e.target.value) || 0 } : d) : setNewItemQuantity(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Unidad</label>
                  <input type="text" value={editingInventoryId ? (editInventoryDraft?.unit ?? "") : newItemUnit} onChange={(e) => editingInventoryId ? setEditInventoryDraft((d) => d ? { ...d, unit: e.target.value } : d) : setNewItemUnit(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Precio (CAD)</label>
                <input type="number" min={0} step={0.01} value={editingInventoryId ? (editInventoryDraft?.purchasePriceCAD ?? 0) : newItemPurchasePrice} onChange={(e) => editingInventoryId ? setEditInventoryDraft((d) => d ? { ...d, purchasePriceCAD: parseFloat(e.target.value) || 0 } : d) : setNewItemPurchasePrice(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              {((editingInventoryId ? editInventoryDraft?.type : newItemCategory) === "tool" || (editingInventoryId ? editInventoryDraft?.type : newItemCategory) === "equipment") && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.assignedProject ?? "Proyecto asignado"}</label>
                    <select value={editingInventoryId ? (editInventoryDraft?.assignedToProjectId ?? "") : newItemAssignedProjectId} onChange={(e) => editingInventoryId ? setEditInventoryDraft((d) => d ? { ...d, assignedToProjectId: e.target.value || undefined } : d) : setNewItemAssignedProjectId(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                      <option value="">{t.noProject ?? "Sin proyecto"}</option>
                      {(projects ?? []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.assignedEmployee ?? "Empleado asignado"}</label>
                    <select value={editingInventoryId ? (editInventoryDraft?.assignedToEmployeeId ?? "") : newItemAssignedEmployeeId} onChange={(e) => editingInventoryId ? setEditInventoryDraft((d) => d ? { ...d, assignedToEmployeeId: e.target.value || undefined } : d) : setNewItemAssignedEmployeeId(e.target.value)} className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]">
                      <option value="">{t.noEmployeeAssigned ?? "Sin empleado"}</option>
                      {(employees ?? []).map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeInventoryForm} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]">{t.cancel ?? "Cancelar"}</button>
              <button type="button" onClick={editingInventoryId ? saveEditedItem : saveNewItem} className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]">{t.save ?? "Guardar"}</button>
            </div>
          </div>
        </>
      )}

      {vehicleFormOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={closeVehicleForm} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">{editingVehicleId ? (t.edit ?? "Editar") : (t.addNew ?? "Añadir")} vehículo</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Matrícula</label><input type="text" value={vehicleDraft.plate ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, plate: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Conductor habitual</label><select value={vehicleDraft.usualDriverId ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, usualDriverId: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"><option value="">—</option>{(employees ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Proyecto actual</label><select value={vehicleDraft.currentProjectId ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, currentProjectId: e.target.value || null }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"><option value="">—</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Venc. seguro</label><input type="date" value={vehicleDraft.insuranceExpiry ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, insuranceExpiry: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div><div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Venc. inspección</label><input type="date" value={vehicleDraft.inspectionExpiry ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, inspectionExpiry: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div></div>
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-slate-700">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Documentación</p>
                <div><label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Seguro (URL)</label><input type="url" value={vehicleDraft.insuranceDocUrl ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, insuranceDocUrl: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" placeholder="https://" /></div>
                <div><label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Inspección (URL)</label><input type="url" value={vehicleDraft.inspectionDocUrl ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, inspectionDocUrl: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" placeholder="https://" /></div>
                <div><label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Matriculación (URL)</label><input type="url" value={vehicleDraft.registrationDocUrl ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, registrationDocUrl: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" placeholder="https://" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{(t as Record<string, string>).lastMaintenance ?? "Último mantenimiento"}</label><input type="date" value={vehicleDraft.lastMaintenanceDate ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, lastMaintenanceDate: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div><div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{(t as Record<string, string>).nextMaintenance ?? "Próximo mantenimiento"}</label><input type="date" value={vehicleDraft.nextMaintenanceDate ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, nextMaintenanceDate: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{(t as Record<string, string>).mileage ?? "Kilometraje"}</label><input type="number" min={0} value={vehicleDraft.mileage ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, mileage: e.target.value ? parseInt(e.target.value, 10) : undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Notas</label><textarea rows={2} value={vehicleDraft.notes ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, notes: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeVehicleForm} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]">{t.cancel ?? "Cancelar"}</button><button type="button" onClick={saveVehicle} className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]">{t.save ?? "Guardar"}</button></div>
          </div>
        </>
      )}

      {(rentalFormOpen || editingRentalId) && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={closeRentalForm} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">{editingRentalId ? (t.edit ?? "Editar") : (t.addNew ?? "Añadir")} alquiler</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Nombre del equipo</label><input type="text" value={rentalDraft.name ?? ""} onChange={(e) => setRentalDraft((d) => ({ ...d, name: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Proveedor</label><input type="text" value={rentalDraft.supplier ?? ""} onChange={(e) => setRentalDraft((d) => ({ ...d, supplier: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Fecha de devolución</label><input type="date" value={rentalDraft.returnDate ?? ""} onChange={(e) => setRentalDraft((d) => ({ ...d, returnDate: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Coste (CAD)</label><input type="number" min={0} step={0.01} value={rentalDraft.costCAD ?? ""} onChange={(e) => setRentalDraft((d) => ({ ...d, costCAD: parseFloat(e.target.value) || 0 }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Link contrato (URL)</label><input type="url" value={rentalDraft.contractLink ?? ""} onChange={(e) => setRentalDraft((d) => ({ ...d, contractLink: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" placeholder="https://" /></div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.assignedProject ?? "Proyecto asignado"}</label>
                <select value={rentalDraft.projectId ?? ""} onChange={(e) => setRentalDraft((d) => ({ ...d, projectId: e.target.value || undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                  <option value="">{t.noProject ?? "Sin proyecto"}</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeRentalForm} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]">{t.cancel ?? "Cancelar"}</button><button type="button" onClick={saveRental} className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]">{t.save ?? "Guardar"}</button></div>
          </div>
        </>
      )}

      {/* Modal: Añadir / Editar proveedor */}
      {isSuppliersFormOpen && editSupplierDraft && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={closeSupplierForm} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              {editingSupplierId ? (t.edit ?? "Editar proveedor") : (t.addNew ?? "Añadir proveedor")}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.name ?? "Nombre"}</label>
                <input type="text" value={editSupplierDraft.name ?? ""} onChange={(e) => setSupplierDraft((d) => d ? { ...d, name: e.target.value } : d)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.phone ?? "Teléfono"}</label>
                <input type="text" value={editSupplierDraft.phone ?? ""} onChange={(e) => setSupplierDraft((d) => d ? { ...d, phone: e.target.value } : d)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.email ?? "Email"}</label>
                <input type="email" value={editSupplierDraft.email ?? ""} onChange={(e) => setSupplierDraft((d) => d ? { ...d, email: e.target.value } : d)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Web</label>
                <input type="url" value={editSupplierDraft.webLink ?? ""} onChange={(e) => setSupplierDraft((d) => d ? { ...d, webLink: e.target.value } : d)} placeholder="https://" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Dirección</label>
                <input type="text" value={editSupplierDraft.address ?? ""} onChange={(e) => setSupplierDraft((d) => d ? { ...d, address: e.target.value } : d)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{(t as Record<string, string>).supplierContacts ?? "Contactos"}</h4>
                <ul className="space-y-2 mb-2">
                  {(editSupplierDraft.contacts ?? []).map((c, idx) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 dark:border-slate-700 p-2">
                      <input type="text" placeholder={(t as Record<string, string>).name ?? "Nombre"} value={c.name} onChange={(e) => setSupplierDraft((d) => d?.contacts ? { ...d, contacts: d.contacts!.map((cc, i) => i === idx ? { ...cc, name: e.target.value } : cc) } : d)} className="flex-1 min-w-0 rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm" />
                      <select value={c.role} onChange={(e) => setSupplierDraft((d) => d?.contacts ? { ...d, contacts: d.contacts.map((cc, i) => i === idx ? { ...cc, role: e.target.value as SupplierContact["role"] } : cc) } : d)} className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm">
                        <option value="sales">{(t as Record<string, string>).roleSales ?? "Ventas"}</option>
                        <option value="accounting">{(t as Record<string, string>).roleAccounting ?? "Contabilidad"}</option>
                        <option value="technical">{(t as Record<string, string>).roleTechnical ?? "Técnico"}</option>
                        <option value="other">{(t as Record<string, string>).other ?? "Otro"}</option>
                      </select>
                      <input type="text" placeholder={(t as Record<string, string>).phone ?? "Tel."} value={c.phone ?? ""} onChange={(e) => setSupplierDraft((d) => d?.contacts ? { ...d, contacts: d.contacts.map((cc, i) => i === idx ? { ...cc, phone: e.target.value || undefined } : cc) } : d)} className="w-28 rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm" />
                      <input type="text" placeholder="Email" value={c.email ?? ""} onChange={(e) => setSupplierDraft((d) => d?.contacts ? { ...d, contacts: d.contacts.map((cc, i) => i === idx ? { ...cc, email: e.target.value || undefined } : cc) } : d)} className="w-32 rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm" />
                      <button type="button" onClick={() => setSupplierDraft((d) => d ? { ...d, contacts: (d.contacts ?? []).filter((_, i) => i !== idx) } : d)} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">{(t as Record<string, string>)["delete"] ?? "Eliminar"}</button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setSupplierDraft((d) => d ? { ...d, contacts: [...(d.contacts ?? []), { id: "c" + Date.now(), name: "", role: "sales" as const, phone: "", email: "" }] } : d)} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]">
                  + {(t as Record<string, string>).addContact ?? "Añadir contacto"}
                </button>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeSupplierForm} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]">{t.cancel ?? "Cancelar"}</button>
              <button type="button" onClick={saveSupplier} className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]">{t.save ?? "Guardar"}</button>
            </div>
          </div>
        </>
      )}

      {/* Modal: Añadir / Editar empleado */}
      {editingEmployeeId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={closeEmployeeForm} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              {editingEmployeeId === "new" ? (t.addNew ?? "Añadir empleado") : (t.edit ?? "Editar empleado")}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.name ?? "Nombre"}</label>
                <input type="text" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.roleLabel ?? "Rol"}</label>
                <div className="flex items-center gap-2">
                  {newEmployeeRoleMode === "list" && newEmployeeCustomRoleId ? (() => {
                    const cr = customRoles.find((r) => r.id === newEmployeeCustomRoleId);
                    return cr ? (
                      <span
                        className="inline-block h-9 w-9 shrink-0 rounded-full border-2 border-zinc-200 dark:border-zinc-600"
                        style={{ backgroundColor: cr.color }}
                        title={cr.name}
                        aria-hidden
                      />
                    ) : null;
                  })() : null}
                  <select
                    value={newEmployeeRoleMode === "custom" ? "__custom__" : newEmployeeCustomRoleId || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__custom__") {
                        setNewEmployeeRoleMode("custom");
                        setNewEmployeeCustomRoleId("");
                        return;
                      }
                      const r = customRoles.find((x) => x.id === v);
                      if (r) {
                        setNewEmployeeRoleMode("list");
                        setNewEmployeeCustomRoleId(r.id);
                        setNewEmployeeRole(r.name);
                      } else {
                        setNewEmployeeRoleMode("list");
                        setNewEmployeeCustomRoleId("");
                      }
                    }}
                    className="min-h-[44px] w-full flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">{t.noRoleAssigned ?? "Sin rol asignado"}</option>
                    {customRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                    <option value="__custom__">{(t as Record<string, string>).roleFreeText ?? "Other role"}</option>
                  </select>
                </div>
                {newEmployeeRoleMode === "custom" && (
                  <input
                    type="text"
                    value={newEmployeeRole}
                    onChange={(e) => setNewEmployeeRole(e.target.value)}
                    className="mt-2 w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                    placeholder={(t as Record<string, string>).roleFreeText ?? ""}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.hoursLogged ?? "Horas / mes"}</label>
                <input type="number" min={0} value={newEmployeeHours} onChange={(e) => setNewEmployeeHours(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tipo de pago</label>
                <select value={newEmployeePayType} onChange={(e) => setNewEmployeePayType(e.target.value as "hourly" | "salary")} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                  <option value="hourly">Por horas</option>
                  <option value="salary">Salario fijo</option>
                </select>
              </div>
              {newEmployeePayType === "hourly" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tarifa/hora (CAD)</label>
                  <input type="number" min={0} step={0.01} value={newEmployeeHourlyRate} onChange={(e) => setNewEmployeeHourlyRate(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
              )}
              {newEmployeePayType === "salary" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Salario mensual (CAD)</label>
                  <input type="number" min={0} step={1} value={newEmployeeMonthlySalary} onChange={(e) => setNewEmployeeMonthlySalary(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeEmployeeForm} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]">{t.cancel ?? "Cancelar"}</button>
              <button type="button" onClick={saveEmployee} className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]">{t.save ?? "Guardar"}</button>
            </div>
          </div>
        </>
      )}
      {employeeShiftModalModel && (
        <EmployeeShiftDayView
          open
          onClose={() => setEmployeeShiftDayOpen(null)}
          language={language}
          labels={t as Record<string, string>}
          scheduleEntry={employeeShiftModalModel.entry}
          project={employeeShiftModalModel.shiftViewProject}
          clockEntry={employeeShiftModalModel.clockEntry}
          canActClock={employeeShiftModalModel.canActClock}
          gpsStatus={clockInGpsStatus}
          clockInAlertMessage={clockInAlertMessage}
          onDismissClockInAlert={() => setClockInAlertMessage(null)}
          onClockIn={(override) => {
            const pid = employeeShiftModalModel.entry.projectId;
            const pcode = employeeShiftModalModel.entry.projectCode;
            if (override) {
              void handleClockIn(override);
              return;
            }
            void handleClockIn(
              pid ? { projectId: pid, projectCode: pcode } : pcode ? { projectCode: pcode } : undefined
            );
          }}
          assignedClockInProjects={assignedClockInProjects}
          clockInProjectCode={clockInProjectCode}
          setClockInProjectCode={setClockInProjectCode}
          clockProjectsForHint={projects.map((p) => ({
            id: p.id,
            name: p.name,
            projectCode: p.projectCode,
          }))}
          onClockOut={handleClockOut}
          tasks={employeeShiftModalModel.shiftTasks}
          onToggleProjectTask={(taskId, completed) => {
            setProjectTasks((prev) =>
              prev.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      status: completed ? ("completed" as const) : ("pending" as const),
                      completedAt: completed ? new Date().toISOString() : undefined,
                    }
                  : task
              )
            );
          }}
          dailyReport={employeeShiftModalModel.dailyReport}
          currentUserProfileId={profile?.id ?? null}
          currentUserDisplayName={
            (profile?.fullName ?? profile?.email ?? user?.email ?? "").trim() || "User"
          }
          colleagueNames={employeeShiftModalModel.colleagueNames}
          onDailyReportSigned={() => void reloadDailyReports()}
        />
      )}
      <InstallPWABanner labels={t} isDark={darkMode ?? false} />
    </div>
  );
}
