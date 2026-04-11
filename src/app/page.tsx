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
  type RentalEquipmentType,
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
import { SecurityModule } from "@/components/SecurityModule";
import ScheduleModule from "@/components/ScheduleModule";
import { EmployeeShiftDayView } from "@/components/EmployeeShiftDayView";
import { FormsModule } from "@/components/FormsModule";
import { BillingModule } from "@/components/BillingModule";
import type { CorrectiveActionsPrefill } from "@/components/CorrectiveActionsModule";
import LoginScreen, { type LoginDemoAccount } from "@/components/LoginScreen";
import { BindersModule } from "@/components/BindersModule";
import { TrainingHubModule } from "@/components/TrainingHubModule";
import { EmployeesModule } from "@/components/EmployeesModule";
import { SubcontractorsModule } from "@/components/SubcontractorsModule";
import { InstallPWABanner } from "@/components/InstallPWABanner";
import { OnboardingModal } from "@/components/OnboardingModal";
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import { ModuleHelpFab } from "@/components/ModuleHelpFab";
import { displayNameFromProfile } from "@/lib/profileDisplayName";
import { countOperationallyActiveProjects } from "@/lib/projectFilters";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
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
  Search,
} from "lucide-react";
import { supabase, type AuthGetSessionResult } from "@/lib/supabase";
import { postAppNotification } from "@/lib/clientNotifications";
import { NotificationBell } from "@/components/NotificationBell";
import type { AppNotificationRow } from "@/hooks/useNotifications";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { buildVisitorCheckInUrl } from "@/lib/visitorQrUrl";
import { useProjectPhotos } from "@/lib/useProjectPhotos";
import { logAuditEvent, type AuditLogEntry } from "@/lib/useAuditLog";
import {
  mergeComplianceAlerts,
  runComplianceWatchdog,
  runVehicleDocumentsWatchdog,
  runSubcontractorWatchdog,
  runProjectEmployeeComplianceCheck,
  shouldRunWatchdog,
  setLastWatchdogRun,
  watchdogSubjectLabel,
  type ComplianceAlert,
  type SubcontractorForWatchdog,
} from "@/lib/complianceWatchdog";
import type { ProjectSafetyRequirementRow } from "@/lib/projectSafetyUtils";
import {
  ensureVehicleDocuments,
  newVehicleDocumentId,
  seedVehicleDocumentsFromCountry,
  computeVehicleDocStatus,
  vehicleDocDisplayName,
  type VehicleDocument,
} from "@/lib/vehicleDocumentUtils";
import type { Language, Currency } from "@/lib/i18n";
import { LANGUAGES, ALL_TRANSLATIONS, loadLocale, isLazyLocale } from "@/lib/i18n";
import {
  LOCALE_STORAGE_KEY,
  isValidLanguage,
  detectLanguageFromNavigator,
  persistUserLocale,
  persistUserTimezone,
} from "@/lib/localePreference";
import { dateLocaleForUser, resolveUserTimezone, formatTime, formatTodayYmdInTimeZone } from "@/lib/dateUtils";
import { useShiftGpsTracking } from "@/hooks/useShiftGpsTracking";
import {
  aggregateProjectLabor,
  buildLaborRateByUserId,
  buildLaborRateLookupForClock,
  companyHasConfiguredLaborRates,
  type ProjectLaborSummary,
} from "@/lib/laborCosting";
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
import { buildFormInstanceFromTemplate } from "@/lib/formInstanceFactory";
import { resolveFormLabel } from "@/lib/formTemplateDisplay";
import { getCountryConfig } from "@/lib/countryConfig";
import { fetchDailyReportsForCompany } from "@/lib/dailyReportsDb";
import { parseProfileCertificates } from "@/lib/employeeCertificatesJson";
import { useSubscription } from "@/lib/useSubscription";
import { applyPlanToModulePermissions } from "@/lib/planPermissions";
import { getCurrencyForCountry } from "@/lib/geoTier";
import type {
  ScheduleEntry,
  VacationRequestRow,
  ComplianceTarget,
  ComplianceFieldType,
  ComplianceField,
  ComplianceRecord,
  EmployeeDocument,
} from "@/types/homePage";

export type {
  ScheduleEntry,
  VacationRequestRow,
  ComplianceTarget,
  ComplianceFieldType,
  ComplianceField,
  ComplianceRecord,
  EmployeeDocument,
} from "@/types/homePage";

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
  AUD: "A$",
  NZD: "NZ$",
  SGD: "S$",
  JPY: "¥",
  KRW: "₩",
  INR: "₹",
  ZAR: "R",
  ARS: "$",
  CLP: "$",
  COP: "$",
  PEN: "S/",
  UYU: "$U",
  BRL: "R$",
  GTQ: "Q",
  HNL: "L",
  NIO: "C$",
  CRC: "₡",
  PAB: "B/.",
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
  AUD: 0.88,
  NZD: 0.82,
  SGD: 0.98,
  JPY: 110,
  KRW: 980,
  INR: 61,
  ZAR: 13.5,
  ARS: 220,
  CLP: 680,
  COP: 3100,
  PEN: 2.75,
  UYU: 27,
  BRL: 4.0,
  GTQ: 5.7,
  HNL: 19.5,
  NIO: 26,
  CRC: 380,
  PAB: 0.72,
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
  /** AH-17: optional `user_profiles.hourly_rate` for labor costing (admin). */
  laborHourlyRate?: number | null;
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
  /** JSON from `projects.safety_requirements` (EPI / certificados / procedimientos). */
  safetyRequirements?: unknown;
}

function dashboardFormContextLine(
  f: FormInstance,
  projects: Pick<Project, "id" | "name">[],
  vehicles: Vehicle[],
  rentals: Rental[],
  tl: Record<string, string>
): string {
  const ctx = f.contextType ?? (f.projectId ? "project" : "general");
  if (ctx === "general") return tl.forms_badge_general ?? "General";
  if (ctx === "project") {
    const n = projects.find((p) => p.id === f.projectId)?.name ?? f.contextName ?? f.projectId;
    return `${tl.forms_badge_project ?? "Project"} · ${n}`;
  }
  if (ctx === "vehicle") {
    const n = f.contextName ?? vehicles.find((v) => v.id === f.contextId)?.plate ?? f.contextId ?? "—";
    return `${tl.forms_badge_vehicle ?? "Vehicle"} · ${n}`;
  }
  if (ctx === "rental") {
    const n = f.contextName ?? rentals.find((r) => r.id === f.contextId)?.name ?? f.contextId ?? "—";
    return `${tl.forms_badge_rental ?? "Rental"} · ${n}`;
  }
  return "—";
}

export type ProjectType = "residential" | "commercial" | "industrial";

export type { Subcontractor } from "@/types/subcontractor";

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
  clockInAtIso?: string;
  clockOutAtIso?: string | null;
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
  {
    id: "r1",
    name: "Andamio 3m",
    supplier: "Equipos Quebec",
    returnDate: "2026-04-30",
    cost: 450,
    currency: "CAD",
  },
];

function normalizeStoredRentalEntry(raw: unknown): Rental | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  if (!id) return null;
  let cost = 0;
  if (typeof r.cost === "number" && Number.isFinite(r.cost)) cost = r.cost;
  else if (typeof r.costCAD === "number" && Number.isFinite(r.costCAD)) cost = r.costCAD;
  const currency =
    typeof r.currency === "string" && r.currency.trim() ? r.currency.trim() : "CAD";
  const et = r.equipmentType;
  const equipmentType: RentalEquipmentType | undefined =
    et === "vehicle" || et === "forklift" || et === "scaffold" || et === "tool" || et === "other"
      ? et
      : undefined;
  return {
    id,
    name: typeof r.name === "string" ? r.name : "",
    supplier: typeof r.supplier === "string" ? r.supplier : "",
    returnDate: typeof r.returnDate === "string" ? r.returnDate : "",
    cost,
    currency,
    contractLink: typeof r.contractLink === "string" ? r.contractLink : undefined,
    projectId: typeof r.projectId === "string" ? r.projectId : undefined,
    equipmentType,
    equipmentId: typeof r.equipmentId === "string" ? r.equipmentId : undefined,
  };
}

function rentalFromSupabaseRow(row: Record<string, unknown>): Rental {
  const et = row.equipment_type;
  const equipmentType: RentalEquipmentType | undefined =
    et === "vehicle" || et === "forklift" || et === "scaffold" || et === "tool" || et === "other"
      ? et
      : undefined;
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    supplier: row.supplier != null ? String(row.supplier) : "",
    returnDate: row.return_date != null ? String(row.return_date).slice(0, 10) : "",
    cost: row.cost != null ? Number(row.cost) || 0 : 0,
    currency: row.currency != null ? String(row.currency) : "CAD",
    contractLink: row.contract_url != null ? String(row.contract_url) : undefined,
    projectId: row.project_id != null ? String(row.project_id) : undefined,
    equipmentType,
    equipmentId: row.equipment_id != null ? String(row.equipment_id) : undefined,
  };
}

function isUuidString(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function inspectionTemplateIdForRentalEquipmentType(
  equipmentType: RentalEquipmentType | undefined
): string {
  switch (equipmentType) {
    case "vehicle":
      return "tpl-rental-vehicle-001";
    case "forklift":
      return "tpl-forklift-001";
    case "scaffold":
      return "tpl-scaffold-001";
    case "tool":
      return "tpl-electric-tool-001";
    default:
      return "tpl-equipment-001";
  }
}

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
      canViewTeamAvailability: true,
      canManageTeamAvailability: true,
      canManageVacations: true,
      canViewTimesheets: true,
      canViewLaborCosting: true,
      canViewProjectGeneral: true,
      canViewProjectTeam: true,
      canViewProjectInventory: true,
      canViewProjectGallery: true,
      canUploadPhotos: true,
      canViewProjectBlueprints: true,
      canManageProjectBlueprints: true,
      canViewProjectForms: true,
      canManageProjectForms: true,
      canViewForms: true,
      canCreateForms: true,
      canFillForms: true,
      canManageFormTemplates: true,
      canApproveForms: true,
      canExportForms: true,
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
      canViewLaborCosting: true,
      canViewProjectGeneral: true,
      canViewProjectTeam: true,
      canViewProjectInventory: true,
      canViewProjectGallery: true,
      canUploadPhotos: true,
      canViewProjectForms: true,
      canViewForms: true,
      canFillForms: true,
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
      canViewLaborCosting: true,
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
  /** Acceso al módulo Formularios (rellenar / crear / aprobar / plantillas). */
  forms: boolean;
  /** Solo entrada de menú Formularios (canViewForms). */
  formsNav: boolean;
  canSeeOnlyAssignedProjects?: boolean;
  canAccessSchedule: boolean;
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
  canAccessSecurity: boolean;
  canViewSettings?: boolean;
}

function permissionsToModule(p: RolePermissions): ModulePermissions {
  return {
    office: p.canViewCentral,
    warehouse: p.canViewLogistics,
    site: p.canViewProjects || p.canViewSubcontractors,
    worker: false,
    forms:
      p.canViewForms ||
      p.canFillForms ||
      p.canCreateForms ||
      p.canManageFormTemplates ||
      p.canApproveForms ||
      p.canExportForms,
    formsNav: p.canViewForms,
    canSeeOnlyAssignedProjects: p.canViewOnlyAssignedProjects,
    canAccessSchedule: p.canViewSchedule || p.canViewTimeclock,
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

function pickFirstAllowedMainSection(_p: RolePermissions, m: ModulePermissions): MainSection | null {
  const order: MainSection[] = [
    "office",
    "schedule",
    "site",
    "warehouse",
    "security",
    "forms",
    "settings",
  ];
  const allowed = (s: MainSection): boolean => {
    switch (s) {
      case "office":
        return m.office;
      case "schedule":
        return m.canAccessSchedule;
      case "site":
        return m.site;
      case "warehouse":
        return m.warehouse;
      case "security":
        return m.canAccessSecurity;
      case "forms":
        return m.forms;
      case "settings":
        return !!m.canViewSettings;
      default:
        return false;
    }
  };
  return order.find((s) => allowed(s)) ?? null;
}

function mainSectionIsAllowed(section: MainSection, m: ModulePermissions): boolean {
  switch (section) {
    case "office":
      return m.office;
    case "schedule":
      return m.canAccessSchedule;
    case "site":
      return m.site;
    case "warehouse":
      return m.warehouse;
    case "security":
      return m.canAccessSecurity;
    case "forms":
      return m.forms;
    case "settings":
      return !!m.canViewSettings;
    case "employees":
      return !!(m.canAccessEmployees ?? false);
    case "subcontractors":
      return !!(m.canAccessSubcontractors ?? false);
    case "binders":
    case "rfi":
    case "billing":
    case "pricing":
    case "visitors":
    case "hazards":
    case "corrective_actions":
      return m.office;
    default:
      return false;
  }
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
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [pendingOpenBinderDocumentId, setPendingOpenBinderDocumentId] = useState<string | null>(null);
  const [complianceNotifOpen, setComplianceNotifOpen] = useState(false);
  const complianceNotifRef = useRef<HTMLDivElement>(null);
  const { photos, uploadPhoto, approvePhoto, rejectPhoto } = useProjectPhotos(companyId);

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
  const currencyManuallyChangedRef = useRef(false);
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
  const [gettingStartedRefreshTk, setGettingStartedRefreshTk] = useState(0);
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

  const completeOnboarding = useCallback(async () => {
    setOnboardingComplete(true);
    setActiveSection("office");
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
    setGettingStartedRefreshTk((n) => n + 1);
  }, [session?.access_token, companyId, setActiveSection]);

  const [operationsMainTab, setOperationsMainTab] = useState<"projects" | "subcontractors">("projects");
  const [correctivePrefill, setCorrectivePrefill] = useState<CorrectiveActionsPrefill | null>(null);
  const [focusHazardId, setFocusHazardId] = useState<string | null>(null);
  const [dashHazardCreateSig, setDashHazardCreateSig] = useState(0);
  const [dashActionCreateSig, setDashActionCreateSig] = useState(0);
  const [projectsSecurityTabSig, setProjectsSecurityTabSig] = useState(0);
  const [dashVisitorQrSig, setDashVisitorQrSig] = useState(0);
  const [dashVisitorTabSig, setDashVisitorTabSig] = useState(0);
  const [projectsOpenRfiSig, setProjectsOpenRfiSig] = useState(0);
  const [settingsHelpFocusSignal, setSettingsHelpFocusSignal] = useState(0);
  const openSettingsHelpFromFab = useCallback(() => {
    setActiveSection("settings");
    setSettingsHelpFocusSignal((n) => n + 1);
  }, []);
  const consumeCorrectivePrefill = useCallback(() => setCorrectivePrefill(null), []);
  const clearProjectSecurityDashSignals = useCallback(() => {
    setDashHazardCreateSig(0);
    setDashActionCreateSig(0);
  }, []);

  const [currentUserRole] = useState<UserRole>("admin");
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const activeEmployees = useMemo(
    () => (employees ?? []).filter(isActiveProfileEmployee),
    [employees]
  );
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [subcontractorsForWatchdog, setSubcontractorsForWatchdog] = useState<SubcontractorForWatchdog[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>(INITIAL_SCHEDULE);
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
  /** Fichajes desde `time_entries` (Supabase); se fusionan con fichajes locales. */
  const [dbClockEntries, setDbClockEntries] = useState<ClockEntry[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequestRow[]>([]);
  /** user_profiles.id → employees.id */
  const [userToEmployeeMap, setUserToEmployeeMap] = useState<Record<string, string>>({});
  const userIdToEmployeeIdRef = useRef<Map<string, string>>(new Map());
  const dashboardCacheRef = useRef<{
    companyId: string;
    employees: Employee[];
    projects: Project[];
    clockEntries: ClockEntry[];
    vacationRequests: VacationRequestRow[];
    scheduleEntries: ScheduleEntry[];
    customRoles: CustomRole[];
    teamProfiles: { id: string; employeeId: string | null; name: string; email?: string }[];
    auditLogs: AuditLogEntry[];
    companyName: string;
    logoUrl: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    companyWebsite: string;
    userToEmployeeMap: Record<string, string>;
    lastFetched: number;
  } | null>(null);
  const invalidateDashboardCache = useCallback(() => {
    dashboardCacheRef.current = null;
  }, []);

  const handleUpdateProjectSafetyRequirements = useCallback(
    async (projectId: string, rows: ProjectSafetyRequirementRow[]) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, safetyRequirements: rows } : p))
      );
      if (supabase && companyId) {
        const { error } = await supabase
          .from("projects")
          .update({ safety_requirements: rows })
          .eq("id", projectId)
          .eq("company_id", companyId);
        if (error) console.error("[page] safety_requirements update", error);
      }
      invalidateDashboardCache();
    },
    [supabase, companyId, invalidateDashboardCache]
  );

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
  const [formsOpenFillInstanceId, setFormsOpenFillInstanceId] = useState<string | null>(null);
  const [formsListProjectFilterOnOpen, setFormsListProjectFilterOnOpen] = useState<string | null>(
    null
  );
  const [formsListContextFilterOnOpen, setFormsListContextFilterOnOpen] = useState<{
    type: "vehicle" | "rental";
    id: string;
  } | null>(null);
  const [formsOpenTemplatePickerTk, setFormsOpenTemplatePickerTk] = useState(0);
  const consumeFormsOpenFillNavigation = useCallback(() => {
    setFormsOpenFillInstanceId(null);
    setFormsListProjectFilterOnOpen(null);
    setFormsListContextFilterOnOpen(null);
  }, []);
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

  const laborCostingRateByUserId = useMemo(() => buildLaborRateByUserId(employees), [employees]);
  const laborCostingEnabled = useMemo(() => companyHasConfiguredLaborRates(employees), [employees]);
  const laborCostingEmployeeLabels = useMemo(() => {
    const o: Record<string, string> = {};
    for (const e of employees) o[e.id] = e.name;
    return o;
  }, [employees]);
  const employeeLaborRateLookup = useMemo(
    () => buildLaborRateLookupForClock(employees, userToEmployeeMap),
    [employees, userToEmployeeMap]
  );
  const projectLaborSummaries = useMemo(() => {
    const names: Record<string, string> = {};
    for (const e of employees) names[e.id] = e.name;
    const out: Record<string, ProjectLaborSummary> = {};
    for (const p of projects) {
      out[p.id] = aggregateProjectLabor(
        p.id,
        p.assignedEmployeeIds ?? [],
        displayClockEntries,
        employees,
        names,
        userToEmployeeMap
      );
    }
    return out;
  }, [projects, displayClockEntries, employees, userToEmployeeMap]);

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
    const normalize = (list: Vehicle[]) =>
      list.map((v) => ({
        ...v,
        documents: ensureVehicleDocuments(v, undefined, undefined),
      }));
    if (typeof window === "undefined") return normalize(INITIAL_VEHICLES);
    try {
      const raw = localStorage.getItem("machinpro_vehicles");
      if (!raw) return normalize(INITIAL_VEHICLES);
      const parsed = JSON.parse(raw) as Vehicle[];
      if (!Array.isArray(parsed) || parsed.length === 0) return normalize(INITIAL_VEHICLES);
      return normalize(parsed);
    } catch {
      return normalize(INITIAL_VEHICLES);
    }
  });
  const [rentals, setRentals] = useState<Rental[]>(() => {
    if (typeof window === "undefined") return INITIAL_RENTALS;
    try {
      const raw = localStorage.getItem("machinpro_rentals");
      if (!raw) return INITIAL_RENTALS;
      const parsed = JSON.parse(raw) as unknown[];
      if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_RENTALS;
      const mapped = parsed.map(normalizeStoredRentalEntry).filter((x): x is Rental => x != null);
      return mapped.length ? mapped : INITIAL_RENTALS;
    } catch {
      return INITIAL_RENTALS;
    }
  });

  const dashboardFormsActiveCount = useMemo(
    () => formInstances.filter((f) => f.status === "draft" || f.status === "in_progress").length,
    [formInstances]
  );

  const dashboardFormsPendingPreview = useMemo(() => {
    const ymd = formatTodayYmdInTimeZone(userTimeZone);
    const tl = t as Record<string, string>;
    return formInstances
      .filter(
        (f) =>
          (f.status === "draft" || f.status === "in_progress") &&
          (f.date === ymd || (f.createdAt && f.createdAt.startsWith(ymd)))
      )
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 5)
      .map((f) => {
        const tpl = formTemplates.find((x) => x.id === f.templateId);
        const name = tpl ? resolveFormLabel(tpl.name, tl) : f.templateId;
        const contextLine = dashboardFormContextLine(f, projects, vehicles, rentals, tl);
        const statusLbl =
          f.status === "draft"
            ? (tl.formDraft ?? "Draft")
            : f.status === "in_progress"
              ? (tl.formInProgress ?? "In progress")
              : f.status;
        return { id: f.id, name, contextLine, status: statusLbl };
      });
  }, [formInstances, formTemplates, userTimeZone, projects, vehicles, rentals, t]);

  const logisticsActiveFormsTodayByVehicleId = useMemo(() => {
    const ymd = formatTodayYmdInTimeZone(userTimeZone);
    const m: Record<string, number> = {};
    for (const f of formInstances) {
      if (f.status !== "draft" && f.status !== "in_progress") continue;
      const d = f.date ?? f.createdAt?.slice(0, 10);
      if (d !== ymd) continue;
      if (f.contextType === "vehicle" && f.contextId) {
        m[f.contextId] = (m[f.contextId] ?? 0) + 1;
      }
    }
    return m;
  }, [formInstances, userTimeZone]);

  const logisticsActiveFormsTodayByRentalId = useMemo(() => {
    const ymd = formatTodayYmdInTimeZone(userTimeZone);
    const m: Record<string, number> = {};
    for (const f of formInstances) {
      if (f.status !== "draft" && f.status !== "in_progress") continue;
      const d = f.date ?? f.createdAt?.slice(0, 10);
      if (d !== ymd) continue;
      if (f.contextType === "rental" && f.contextId) {
        m[f.contextId] = (m[f.contextId] ?? 0) + 1;
      }
    }
    return m;
  }, [formInstances, userTimeZone]);

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

  /** Carga en dos fases: crítico (empleados, proyectos, roles, empresa) y secundario (fichajes, vacaciones, plan, auditoría, team). */
  useEffect(() => {
    if (!supabase || !session) {
      setCustomRoles(INITIAL_CUSTOM_ROLES);
    }
    if (!supabase || !session || !companyId) {
      dashboardCacheRef.current = null;
      setDbClockEntries([]);
      setVacationRequests([]);
      setUserToEmployeeMap({});
      userIdToEmployeeIdRef.current = new Map();
      setTeamProfiles([]);
      setSubcontractorsForWatchdog([]);
      return;
    }
    const cid = companyId;
    let cancelled = false;

    const CACHE_TTL_MS = 60_000;
    const cached = dashboardCacheRef.current;
    if (cached && cached.companyId === cid && Date.now() - cached.lastFetched < CACHE_TTL_MS) {
      userIdToEmployeeIdRef.current = new Map(Object.entries(cached.userToEmployeeMap));
      setUserToEmployeeMap(cached.userToEmployeeMap);
      setEmployees(cached.employees);
      setProjects(cached.projects);
      setDbClockEntries(cached.clockEntries);
      setVacationRequests(cached.vacationRequests);
      setCustomRoles(cached.customRoles);
      setTeamProfiles(cached.teamProfiles);
      setAuditLogs(cached.auditLogs);
      if (cached.companyName) setCompanyName(cached.companyName);
      if (cached.logoUrl) setLogoUrl(cached.logoUrl);
      setCompanyAddress(cached.companyAddress ?? "");
      setCompanyPhone(cached.companyPhone ?? "");
      setCompanyEmail(cached.companyEmail ?? "");
      setCompanyWebsite(cached.companyWebsite ?? "");
      setScheduleEntries((prev) => [...prev.filter((e) => e.type !== "vacation"), ...cached.scheduleEntries]);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      let mappedEmployees: Employee[] = [];
      let mappedTeamProfiles: {
        id: string;
        employeeId: string | null;
        name: string;
        email?: string;
      }[] = [];
      let mappedClockEntries: ClockEntry[] = [];
      let mappedVacations: VacationRequestRow[] = [];
      let mappedScheduleVacation: ScheduleEntry[] = [];
      let mappedProjects: Project[] = [];
      let mappedCustomRoles: CustomRole[] = INITIAL_CUSTOM_ROLES;
      let mappedCompanyName = "";
      let mappedLogoUrl = "";
      let mappedCompanyAddress = "";
      let mappedCompanyPhone = "";
      let mappedCompanyEmail = "";
      let mappedCompanyWebsite = "";
      let mappedAuditLogs: AuditLogEntry[] = [];

      const [profilesResult, projectsResult, rolesResult, companyResult] = await Promise.all([
        supabase
          .from("user_profiles")
          .select(
            "id, employee_id, full_name, display_name, email, role, phone, pay_type, pay_amount, pay_period, hourly_rate, custom_role_id, custom_permissions, use_role_permissions, created_at, certificates, profile_status"
          )
          .eq("company_id", cid)
          .order("created_at", { ascending: false }),
        supabase.from("projects").select("*").eq("company_id", cid),
        supabase.from("roles").select("*").eq("company_id", cid).order("created_at", { ascending: true }),
        supabase
          .from("companies")
          .select("name, logo_url, address, phone, email, website, country_code")
          .eq("id", cid)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const { data: profiles, error: profilesErr } = profilesResult;
      if (profilesErr) {
        console.error("[page] user_profiles (block1)", profilesErr);
      }

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

      if (!cancelled) {
        if (profilesErr || !profiles?.length) {
          mappedEmployees = [];
          setEmployees([]);
        } else {
          mappedEmployees = profiles.map((row: Record<string, unknown>) => {
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
            let laborHourlyRate: number | null | undefined;
            const hrRaw = row.hourly_rate;
            if (hrRaw != null && hrRaw !== "") {
              const hn = typeof hrRaw === "number" ? hrRaw : Number(hrRaw);
              if (Number.isFinite(hn) && hn > 0) laborHourlyRate = hn;
              else laborHourlyRate = null;
            }
            return {
              id,
              name,
              role,
              profileStatus: row.profile_status != null ? String(row.profile_status) : "active",
              hours: typeof row.hours === "number" ? row.hours : Number(row.hours) || 0,
              payType,
              hourlyRate,
              laborHourlyRate,
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
          });
          setEmployees(mappedEmployees);
        }
      }

      const { data: projData, error: projErr } = projectsResult;
      if (projErr) {
        console.error("[page] projects", projErr);
      } else if (!cancelled) {
        if (!projData?.length) {
          mappedProjects = [];
          setProjects([]);
        } else {
          mappedProjects = projData.map((p: Record<string, unknown>) => ({
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
            safetyRequirements: p.safety_requirements ?? undefined,
          }));
          setProjects(mappedProjects);
        }
      }

      if (cancelled) return;
      const { data: rolesRows, error: rolesErr } = rolesResult;
      if (rolesErr) {
        console.error("[page] roles load", rolesErr);
        mappedCustomRoles = INITIAL_CUSTOM_ROLES;
        setCustomRoles(INITIAL_CUSTOM_ROLES);
      } else {
        let list = (rolesRows ?? []) as RolesTableRow[];
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
            mappedCustomRoles = INITIAL_CUSTOM_ROLES;
            setCustomRoles(INITIAL_CUSTOM_ROLES);
          } else {
            clearLegacyCustomRolesLocalStorage();
            list = (inserted ?? []) as RolesTableRow[];
            mappedCustomRoles = list.map(customRoleFromSupabaseRow);
            setCustomRoles(mappedCustomRoles);
          }
        } else {
          mappedCustomRoles = list.map(customRoleFromSupabaseRow);
          setCustomRoles(mappedCustomRoles);
        }
      }

      if (cancelled) return;
      const { data: coData, error: coErr } = companyResult;
      if (!coErr && coData) {
        const row = coData as Record<string, unknown>;
        if (typeof row.name === "string") {
          mappedCompanyName = row.name;
          setCompanyName(row.name);
        }
        if (typeof row.logo_url === "string" && row.logo_url.trim()) {
          mappedLogoUrl = row.logo_url.trim();
          setLogoUrl(mappedLogoUrl);
        }
        const addr = row.address;
        const ph = row.phone;
        const em = row.email;
        const web = row.website;
        mappedCompanyAddress = typeof addr === "string" ? addr : "";
        mappedCompanyPhone = typeof ph === "string" ? ph : "";
        mappedCompanyEmail = typeof em === "string" ? em : "";
        mappedCompanyWebsite = typeof web === "string" ? web : "";
        setCompanyAddress(mappedCompanyAddress);
        setCompanyPhone(mappedCompanyPhone);
        setCompanyEmail(mappedCompanyEmail);
        setCompanyWebsite(mappedCompanyWebsite);
        const ccode = row.country_code;
        if (typeof ccode === "string" && ccode.trim()) {
          const up = ccode.trim().toUpperCase();
          setCompanyCountry(up);
          setSubcontractorCountryCode(up);
        }
      }

      if (!cancelled) {
        void (async () => {
          const [timeEntriesResult, vacationsResult, scheduleResult, auditResult, subRowsResult, subDocsResult] =
            await Promise.all([
            supabase
              .from("time_entries")
              .select("id, user_id, project_id, clock_in_at, clock_out_at, status")
              .eq("company_id", cid)
              .order("clock_in_at", { ascending: false })
              .limit(200),
            supabase
              .from("vacation_requests")
              .select("*")
              .eq("company_id", cid)
              .order("created_at", { ascending: false })
              .limit(100),
            supabase.from("schedule_entries").select("*").eq("company_id", cid).limit(2000),
            supabase
              .from("audit_logs")
              .select("*")
              .eq("company_id", cid)
              .order("created_at", { ascending: false })
              .limit(50),
            supabase.from("subcontractors").select("id, name").eq("company_id", cid),
            supabase.from("subcontractor_documents").select("*").eq("company_id", cid),
          ]);

          if (cancelled) return;

          try {
            const activeRows = (profiles ?? []).filter((row: Record<string, unknown>) => {
              const st = String(row.profile_status ?? "active").toLowerCase().trim();
              return st === "active";
            });
            mappedTeamProfiles = activeRows.map((row: Record<string, unknown>) => {
              const id = String(row.id ?? "");
              const fn = typeof row.full_name === "string" ? row.full_name : undefined;
              const dn = typeof row.display_name === "string" ? row.display_name : undefined;
              const em = typeof row.email === "string" ? row.email : undefined;
              const name = displayNameFromProfile(fn, dn, em);
              return {
                id,
                employeeId: row.employee_id != null ? String(row.employee_id) : null,
                name: name || id,
                email: typeof em === "string" ? em.trim() || undefined : undefined,
              };
            });
            setTeamProfiles(mappedTeamProfiles);
          } catch (e) {
            console.error("[page] teamProfiles (block2)", e);
            mappedTeamProfiles = [];
            setTeamProfiles([]);
          }

          const { data: timeRows, error: timeErr } = timeEntriesResult;
          if (timeErr) {
            console.error("[page] time_entries load", timeErr);
            if (!cancelled) {
              mappedClockEntries = [];
              setDbClockEntries([]);
            }
          } else if (!cancelled && timeRows) {
            const pad = (n: number) => String(n).padStart(2, "0");
            mappedClockEntries = (timeRows as Record<string, unknown>[]).map((row) => {
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
                clockInAtIso: String(row.clock_in_at),
                clockOutAtIso: row.clock_out_at != null ? String(row.clock_out_at) : undefined,
              };
            });
            setDbClockEntries(mappedClockEntries);
          }

          const { data: vac, error: vacErr } = vacationsResult;
          if (!cancelled) {
            if (vacErr) {
              console.error("[page] vacation_requests load", vacErr);
              mappedVacations = [];
              setVacationRequests([]);
            } else {
              mappedVacations = (vac ?? []) as VacationRequestRow[];
              setVacationRequests(mappedVacations);
            }
          }

          const { data: schedRows, error: schedErr } = scheduleResult;
          if (schedErr) {
            console.error("[page] schedule_entries load", schedErr);
          }
          const schedVac =
            !schedErr && schedRows?.length
              ? (schedRows as Record<string, unknown>[]).filter((row) => {
                  const st = String(row.type ?? "");
                  const el = row.event_label != null ? String(row.event_label) : "";
                  return st === "vacation" || (st === "event" && el === "vacation");
                })
              : [];
          if (!cancelled && !schedErr) {
            mappedScheduleVacation = schedVac.map((row) => {
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
            setScheduleEntries((prev) => [...prev.filter((e) => e.type !== "vacation"), ...mappedScheduleVacation]);
          }

          const { data: auditData, error: auditErr } = auditResult;
          if (auditErr) {
            console.error("[page] audit_logs load", auditErr);
          }
          if (!cancelled) {
            mappedAuditLogs = (auditData ?? []) as AuditLogEntry[];
            setAuditLogs(mappedAuditLogs);
          }

          const { data: subRowsRaw, error: subRowsErr } = subRowsResult;
          const { data: subDocsRaw, error: subDocsErr } = subDocsResult;
          if (!cancelled && !subRowsErr && !subDocsErr) {
            const docBuckets = new Map<string, VehicleDocument[]>();
            for (const raw of subDocsRaw ?? []) {
              const r = raw as Record<string, unknown>;
              const sid = r.subcontractor_id != null ? String(r.subcontractor_id) : "";
              if (!sid) continue;
              const vd: VehicleDocument = {
                id: String(r.id ?? ""),
                name: String(r.name ?? ""),
                expiryDate:
                  r.expires_at != null && String(r.expires_at).trim()
                    ? String(r.expires_at).slice(0, 10)
                    : undefined,
                documentUrl: typeof r.file_url === "string" && r.file_url.trim() ? r.file_url : undefined,
                alertDays: 30,
              };
              const arr = docBuckets.get(sid) ?? [];
              arr.push(vd);
              docBuckets.set(sid, arr);
            }
            const wd: SubcontractorForWatchdog[] = (subRowsRaw ?? []).map((row: { id: string; name: string }) => ({
              id: String(row.id),
              name: String(row.name ?? ""),
              documents: docBuckets.get(String(row.id)) ?? [],
            }));
            setSubcontractorsForWatchdog(wd);
          } else if (!cancelled && (subRowsErr || subDocsErr)) {
            if (subRowsErr) console.error("[page] subcontractors watchdog load", subRowsErr);
            if (subDocsErr) console.error("[page] subcontractor_documents watchdog load", subDocsErr);
            setSubcontractorsForWatchdog([]);
          }

          const cacheWriteOk =
            !cancelled &&
            !profilesErr &&
            !projErr &&
            !rolesErr &&
            !timeErr &&
            !vacErr &&
            !schedErr &&
            !auditErr;
          if (cacheWriteOk) {
            dashboardCacheRef.current = {
              companyId: cid,
              employees: mappedEmployees,
              projects: mappedProjects,
              clockEntries: mappedClockEntries,
              vacationRequests: mappedVacations,
              scheduleEntries: mappedScheduleVacation,
              customRoles: mappedCustomRoles,
              teamProfiles: mappedTeamProfiles,
              auditLogs: mappedAuditLogs,
              companyName: mappedCompanyName,
              logoUrl: mappedLogoUrl,
              companyAddress: mappedCompanyAddress,
              companyPhone: mappedCompanyPhone,
              companyEmail: mappedCompanyEmail,
              companyWebsite: mappedCompanyWebsite,
              userToEmployeeMap: { ...o },
              lastFetched: Date.now(),
            };
          }
        })();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, session, companyId]);

  const reloadDailyReports = useCallback(async () => {
    if (!supabase || !companyId) {
      setDailyReports([]);
      return;
    }
    const rows = await fetchDailyReportsForCompany(supabase, companyId);
    setDailyReports(rows);
  }, [companyId]);

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
  const [dailyReportNotificationFocus, setDailyReportNotificationFocus] = useState<{
    projectId: string;
    reportId: string;
    sig: number;
  } | null>(null);
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
      invalidateDashboardCache();
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
    invalidateDashboardCache,
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
  const clearPendingOpenBinderDocument = useCallback(() => setPendingOpenBinderDocumentId(null), []);

  useEffect(() => {
    if (!session) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  const criticalComplianceCount = useMemo(
    () => complianceAlerts.filter((a) => a.severity !== "warning").length,
    [complianceAlerts]
  );

  const complianceExpiredCertCount = useMemo(
    () => complianceAlerts.filter((a) => a.severity === "expired").length,
    [complianceAlerts]
  );

  useEffect(() => {
    const empAlerts = runComplianceWatchdog((employees ?? []) as CentralEmployee[]);
    const vehicleAlerts = runVehicleDocumentsWatchdog(vehicles ?? []);
    const subAlerts = runSubcontractorWatchdog(subcontractorsForWatchdog ?? []);
    const projectEmpAlerts = runProjectEmployeeComplianceCheck(
      (projects ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        archived: p.archived,
        assignedEmployeeIds: p.assignedEmployeeIds ?? [],
        safetyRequirements: p.safetyRequirements,
      })),
      (employees ?? []) as CentralEmployee[]
    );
    const merged = mergeComplianceAlerts(empAlerts, vehicleAlerts, subAlerts, projectEmpAlerts);
    setComplianceAlerts(merged);
    if (shouldRunWatchdog()) {
      setLastWatchdogRun();
      if (merged.length > 0) {
        console.log(`[ComplianceWatchdog] ${merged.length} alertas encontradas`);
      }
    }
  }, [employees, vehicles, subcontractorsForWatchdog, projects]);

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
            submittedByName:
                (employees ?? []).find((e) => e.id === effectiveEmployeeId)?.name ??
                ((t as Record<string, string>).employees_display_anonymous ?? "—"),
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
      t,
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
  const [newItemCategory, setNewItemCategory] = useState<"consumable" | "tool" | "equipment" | "material">("consumable");
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
  const [rentalInspectionSuggestion, setRentalInspectionSuggestion] = useState<{
    rentalId: string;
    rentalName: string;
    templateId: string;
    projectId?: string;
  } | null>(null);

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
  const rentalFormCurrency = useMemo(() => getCurrencyForCountry(companyCountry), [companyCountry]);
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

  const warehouseSectionsEnabled = useMemo(
    () => ({
      inventory: !!rolePerms.canViewInventory,
      fleet: !!rolePerms.canViewFleet,
      rentals: !!rolePerms.canManageRentals,
      suppliers: !!rolePerms.canViewSuppliers,
    }),
    [
      rolePerms.canViewInventory,
      rolePerms.canViewFleet,
      rolePerms.canManageRentals,
      rolePerms.canViewSuppliers,
    ]
  );

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

  const activeShiftTimeEntryId = useMemo(() => {
    const ymd = formatTodayYmdInTimeZone(userTimeZone);
    const ids = new Set(
      [profile?.id, user?.id, effectiveEmployeeId, currentUserEmployeeId].filter(Boolean).map(String)
    );
    const open = displayClockEntries.find(
      (e) =>
        !e.clockOut &&
        e.date === ymd &&
        ids.has(String(e.employeeId)) &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.id)
    );
    return open?.id ?? null;
  }, [
    displayClockEntries,
    profile?.id,
    user?.id,
    effectiveEmployeeId,
    currentUserEmployeeId,
    userTimeZone,
  ]);

  useShiftGpsTracking({
    entryId: activeShiftTimeEntryId,
    companyId: companyId ?? null,
    userId: user?.id ?? null,
    enabled: profile?.locationSharingEnabled !== false,
  });

  /** Admins (y project managers) ven todos los proyectos; el flag canViewOnlyAssignedProjects también es true en admin y no debe vaciar la lista. */
  const visibleProjects =
    effectiveRole === "admin" || effectiveRole === "projectManager"
      ? (projects ?? [])
      : rolePerms.canViewOnlyAssignedProjects
        ? (projects ?? []).filter((p) =>
            (p.assignedEmployeeIds ?? []).includes(effectiveEmployeeId ?? "")
          )
        : (projects ?? []);

  useEffect(() => {
    if (!supabase || !session || !companyId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error("[page] rentals load", error);
        return;
      }
      if (!data?.length) return;
      const mapped = data.map((row: Record<string, unknown>) => rentalFromSupabaseRow(row));
      setRentals(mapped);
      try {
        localStorage.setItem("machinpro_rentals", JSON.stringify(mapped));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, session, companyId]);

  const canViewProjectsTab =
    rolePerms.canViewProjects || rolePerms.canViewOnlyAssignedProjects;

  useEffect(() => {
    if (activeSection !== "site") return;
    if (!canViewProjectsTab && perms.canAccessSubcontractors) {
      setOperationsMainTab("subcontractors");
    }
  }, [activeSection, canViewProjectsTab, perms.canAccessSubcontractors]);

  useEffect(() => {
    if (mainSectionIsAllowed(activeSection, perms)) return;
    const next = pickFirstAllowedMainSection(rolePerms, perms);
    if (next != null && next !== activeSection) setActiveSection(next);
  }, [activeSection, rolePerms, perms]);

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

  const navigateToOperationsProjectSecurity = useCallback(() => {
    if (!perms.site) return;
    const vp = visibleProjects ?? [];
    const first = vp.find((p) => !p.archived)?.id ?? vp[0]?.id ?? null;
    if (first) setSiteSelectedProjectId(first);
    setActiveSection("site");
    setProjectsSecurityTabSig((n) => n + 1);
  }, [perms.site, visibleProjects]);

  const handleGlobalSearchSelectEmployee = useCallback((id: string) => {
    setActiveSection("office");
    setPendingOpenEmployeeId(id);
  }, []);

  const handleGlobalSearchSelectProject = useCallback((id: string) => {
    setActiveSection("site");
    setOperationsMainTab("projects");
    setSiteSelectedProjectId(id);
  }, []);

  const handleGlobalSearchSelectVehicle = useCallback(() => {
    setActiveSection("warehouse");
    setWarehouseSubTab("fleet");
  }, []);

  const handleGlobalSearchSelectSupplier = useCallback(() => {
    setActiveSection("warehouse");
    setWarehouseSubTab("suppliers");
  }, []);

  const handleGlobalSearchSelectDocument = useCallback((docId: string, _binderId?: string) => {
    void _binderId;
    setActiveSection("office");
    setPendingOpenBinderDocumentId(docId);
  }, []);

  const globalSearchFlags = useMemo(
    () => ({
      employees: !!(perms.canAccessEmployees ?? false),
      projects: !!(perms.site && canViewProjectsTab),
      vehicles: !!perms.warehouse,
      suppliers: !!perms.warehouse,
      documents: !!(
        rolePerms.canViewSecurityDocs ||
        rolePerms.canManageSecurityDocs ||
        rolePerms.canViewBinders ||
        rolePerms.canManageBinders
      ),
    }),
    [
      perms.canAccessEmployees,
      perms.site,
      perms.warehouse,
      canViewProjectsTab,
      rolePerms.canViewSecurityDocs,
      rolePerms.canManageSecurityDocs,
      rolePerms.canViewBinders,
      rolePerms.canManageBinders,
    ]
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
  const [profileLocationSharingEnabled, setProfileLocationSharingEnabled] = useState(true);
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);
  const [passwordResetBusy, setPasswordResetBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setProfileEditName(profile.fullName ?? "");
    setProfileEditPhone(profile.phone ?? "");
    setProfileEditAvatarUrl(profile.avatarUrl ?? "");
    setProfileLocationSharingEnabled(profile.locationSharingEnabled !== false);
  }, [profile?.id, profile?.fullName, profile?.phone, profile?.avatarUrl, profile?.locationSharingEnabled]);

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
        location_sharing_enabled: profileLocationSharingEnabled,
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
    profileLocationSharingEnabled,
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
      const outTime = formatTime(new Date(), dateLocaleBcp47, userTimeZone);
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
  }, [displayClockEntries, currentUserEmployeeId, supabase, dateLocaleBcp47, userTimeZone]);

  const handleManualClockIn = useCallback(
    async (params: {
      targetUserId: string;
      date: string;
      time: string;
      projectId?: string | null;
      notes?: string;
    }) => {
      if (!companyId || !session?.access_token) {
        return { ok: false as const, error: "no_session" };
      }
      const res = await fetch("/api/time-entries/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          companyId,
          targetUserId: params.targetUserId,
          mode: "in",
          date: params.date,
          time: params.time,
          timeZone: userTimeZone,
          projectId: params.projectId ?? null,
          notes: params.notes?.trim() ? params.notes.trim() : null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; entry?: ClockEntry };
      if (!res.ok || !json.ok || !json.entry) {
        return { ok: false as const, error: json.error ?? "request_failed" };
      }
      setDbClockEntries((prev) => {
        const rest = prev.filter((e) => e.id !== json.entry!.id);
        return [json.entry!, ...rest];
      });
      return { ok: true as const };
    },
    [companyId, session?.access_token, userTimeZone]
  );

  const handleManualClockOut = useCallback(
    async (params: {
      targetUserId: string;
      timeEntryId: string;
      date: string;
      time: string;
      notes?: string;
    }) => {
      if (!companyId || !session?.access_token) {
        return { ok: false as const, error: "no_session" };
      }
      const res = await fetch("/api/time-entries/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          companyId,
          targetUserId: params.targetUserId,
          mode: "out",
          timeEntryId: params.timeEntryId,
          date: params.date,
          time: params.time,
          timeZone: userTimeZone,
          notes: params.notes?.trim() ? params.notes.trim() : null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; entry?: ClockEntry };
      if (!res.ok || !json.ok || !json.entry) {
        return { ok: false as const, error: json.error ?? "request_failed" };
      }
      setDbClockEntries((prev) =>
        prev.map((e) => (e.id === json.entry!.id ? json.entry! : e))
      );
      return { ok: true as const };
    },
    [companyId, session?.access_token, userTimeZone]
  );

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
          data: {
            reportId: report.id,
            projectId: report.projectId,
            date: report.date,
            project: report.projectName ?? "",
          },
        });
      }
      const supTitle = tl.notif_daily_report_submitted_title ?? tl.daily_report_send ?? "Daily report submitted";
      const supBodyRaw = tl.notif_daily_report_submitted_body ?? "";
      const supBody =
        supBodyRaw.replace(/\{project\}/g, report.projectName ?? "").replace(/\{date\}/g, report.date) ||
        `${report.projectName ?? ""} · ${report.date}`;
      for (const e of activeEmployees) {
        const r = (e.role ?? "").toLowerCase();
        if (r !== "admin" && r !== "supervisor") continue;
        if (e.id === report.createdBy) continue;
        void postAppNotification(supabase, {
          companyId,
          targetUserId: e.id,
          type: "daily_report_submitted",
          title: supTitle,
          body: supBody,
          data: {
            reportId: report.id,
            projectId: report.projectId,
            date: report.date,
            project: report.projectName ?? "",
          },
        });
      }
    },
    [companyId, supabase, t, activeEmployees]
  );

  const consumeDailyReportNotificationFocus = useCallback(() => {
    setDailyReportNotificationFocus(null);
  }, []);

  const handleAppNotificationNavigate = useCallback((n: AppNotificationRow) => {
    const data = n.data as Record<string, unknown> | null | undefined;
    const projectId = typeof data?.projectId === "string" ? data.projectId : "";
    const reportId = typeof data?.reportId === "string" ? data.reportId : "";
    const ty = (n.type || "").toLowerCase();
    if (ty.includes("daily_report") && projectId && reportId) {
      setActiveSection("site");
      setOperationsMainTab("projects");
      setSiteSelectedProjectId(projectId);
      setDailyReportNotificationFocus({ projectId, reportId, sig: Date.now() });
      return;
    }
    if (ty.includes("vacation")) {
      setActiveSection("schedule");
      return;
    }
    if ((ty === "photo_approved" || ty === "photo_rejected") && projectId) {
      setActiveSection("site");
      setOperationsMainTab("projects");
      setSiteSelectedProjectId(projectId);
      return;
    }
    if (ty === "project_assigned" && projectId) {
      setActiveSection("site");
      setOperationsMainTab("projects");
      setSiteSelectedProjectId(projectId);
      return;
    }
    if ((ty === "shift_created" || ty === "shift_updated") && projectId) {
      setActiveSection("site");
      setOperationsMainTab("projects");
      setSiteSelectedProjectId(projectId);
    }
  }, []);

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
      const tl = t as Record<string, string>;
      const title = tl.notif_vacation_pending_title ?? tl.schedule_vacation_pending_list ?? "Vacation pending approval";
      const who =
        (profile?.fullName ?? "").trim() ||
        (profile?.email ?? "").trim() ||
        (user.email ?? "").trim() ||
        user.id;
      const body = `${who}: ${start} → ${end}` + (notes?.trim() ? ` · ${notes.trim()}` : "");
      for (const e of activeEmployees) {
        const r = (e.role ?? "").toLowerCase();
        if (r !== "admin" && r !== "supervisor") continue;
        if (e.id === user.id) continue;
        void postAppNotification(supabase, {
          companyId,
          targetUserId: e.id,
          type: "vacation_pending_approval",
          title,
          body,
          data: { vacationRequestId: (data as VacationRequestRow).id, userId: user.id },
        });
      }
    },
    [supabase, companyId, user?.id, user?.email, profile?.fullName, profile?.email, t, activeEmployees]
  );

  /** Resuelve nombres en turnos (IDs de perfil, employee_id legacy, o demo e1/e2). Perfil MachinPro gana sobre nombre de employee. */
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
      const lbl = (p.name ?? "").trim() || (p.email ? displayNameFromProfile(null, null, p.email) : "") || p.id;
      m[p.id] = lbl;
      if (p.employeeId) m[p.employeeId] = lbl;
    }
    return m;
  }, [activeEmployees, teamProfiles]);

  const vacationEmployeeNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const req of vacationRequests) {
      const uid = req.user_id;
      const byProfile = teamProfiles.find((p) => p.id === uid);
      const eid = userToEmployeeMap[uid];
      const label =
        (byProfile?.name ?? "").trim() ||
        scheduleEmployeeLabels[uid] ||
        (eid ? scheduleEmployeeLabels[eid] : undefined) ||
        (eid ? employees.find((e) => e.id === eid)?.name : undefined);
      out[uid] = (label && String(label).trim()) || "—";
    }
    return out;
  }, [vacationRequests, userToEmployeeMap, employees, teamProfiles, scheduleEmployeeLabels]);

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
    safetyRequirements: p.safetyRequirements,
  }));

  const projectNameByIdForGps = useMemo(() => {
    const o: Record<string, string> = {};
    for (const p of projects ?? []) o[p.id] = p.name;
    return o;
  }, [projects]);

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
    setNewItemCategory("consumable");
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
    const docT = t as Record<string, string>;
    const docList =
      vehicleDraft.documents && vehicleDraft.documents.length > 0
        ? vehicleDraft.documents
        : seedVehicleDocumentsFromCountry(companyCountry, docT);
    if (editingVehicleId) {
      setVehicles((prev) => {
        const next = prev.map((v) =>
          v.id === editingVehicleId
            ? ({
                ...v,
                ...vehicleDraft,
                documents: vehicleDraft.documents?.length ? vehicleDraft.documents : v.documents ?? docList,
              } as Vehicle)
            : v
        );
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
        documents: docList,
        vehicleStatus: vehicleDraft.vehicleStatus ?? "available",
        lastMaintenanceDate: vehicleDraft.lastMaintenanceDate,
        nextMaintenanceDate: vehicleDraft.nextMaintenanceDate,
        mileage: vehicleDraft.mileage,
        notes: vehicleDraft.notes,
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

  function persistRentalsLocal(next: Rental[]) {
    try {
      localStorage.setItem("machinpro_rentals", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function saveRental() {
    const costVal =
      typeof rentalDraft.cost === "number" && Number.isFinite(rentalDraft.cost)
        ? rentalDraft.cost
        : typeof rentalDraft.costCAD === "number" && Number.isFinite(rentalDraft.costCAD)
          ? rentalDraft.costCAD
          : Number.parseFloat(String(rentalDraft.cost ?? rentalDraft.costCAD ?? 0)) || 0;
    const cur = (rentalDraft.currency ?? rentalFormCurrency).trim() || "CAD";
    const equipType: RentalEquipmentType =
      rentalDraft.equipmentType === "vehicle" ||
      rentalDraft.equipmentType === "forklift" ||
      rentalDraft.equipmentType === "scaffold" ||
      rentalDraft.equipmentType === "tool" ||
      rentalDraft.equipmentType === "other"
        ? rentalDraft.equipmentType
        : "other";
    const equipmentIdStr = rentalDraft.equipmentId?.trim() || undefined;

    if (editingRentalId) {
      const prev = rentals.find((r) => r.id === editingRentalId);
      const merged: Rental = {
        ...(prev ?? {
          id: editingRentalId,
          name: "",
          supplier: "",
          returnDate: "",
          cost: 0,
          currency: cur,
        }),
        ...rentalDraft,
        id: editingRentalId,
        name: rentalDraft.name ?? prev?.name ?? "",
        supplier: rentalDraft.supplier ?? prev?.supplier ?? "",
        returnDate: rentalDraft.returnDate ?? prev?.returnDate ?? "",
        cost: costVal,
        currency: cur,
        contractLink: rentalDraft.contractLink ?? prev?.contractLink,
        projectId: rentalDraft.projectId ?? prev?.projectId,
        equipmentType: equipType,
        equipmentId: equipmentIdStr,
      };

      setRentals((prevList) => {
        const next = prevList.map((r) => (r.id === editingRentalId ? merged : r));
        persistRentalsLocal(next);
        return next;
      });

      if (supabase && companyId && isUuidString(merged.id)) {
        void (async () => {
          const { error } = await supabase.from("rentals").upsert({
            id: merged.id,
            company_id: companyId,
            name: merged.name,
            supplier: merged.supplier || null,
            return_date: merged.returnDate || null,
            cost: merged.cost,
            currency: merged.currency,
            contract_url: merged.contractLink || null,
            project_id: merged.projectId || null,
            equipment_type: merged.equipmentType ?? "other",
            equipment_id: merged.equipmentId || null,
            status: "active",
            deleted_at: null,
            updated_at: new Date().toISOString(),
          });
          if (error) console.error("[page] rental upsert", error);
        })();
      }

      void logAuditEvent({
        company_id: companyId ?? "",
        user_id: user?.id ?? "",
        user_name: profile?.fullName ?? profile?.email ?? "admin",
        action: "rental_updated",
        entity_type: "rental",
        entity_id: merged.id,
        entity_name: merged.name,
        new_value: { supplier: merged.supplier, cost: merged.cost, currency: merged.currency },
      });

      closeRentalForm();
      return;
    }

    const newId =
      supabase && companyId && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "r" + Date.now();
    const newRental: Rental = {
      id: newId,
      name: rentalDraft.name ?? "",
      supplier: rentalDraft.supplier ?? "",
      returnDate: rentalDraft.returnDate ?? "",
      cost: costVal,
      currency: cur,
      contractLink: rentalDraft.contractLink,
      projectId: rentalDraft.projectId,
      equipmentType: equipType,
      equipmentId: equipmentIdStr,
    };

    setRentals((prev) => {
      const next = [...prev, newRental];
      persistRentalsLocal(next);
      return next;
    });

    if (supabase && companyId && isUuidString(newRental.id)) {
      void (async () => {
        const { error } = await supabase.from("rentals").insert({
          id: newRental.id,
          company_id: companyId,
          name: newRental.name,
          supplier: newRental.supplier || null,
          return_date: newRental.returnDate || null,
          cost: newRental.cost,
          currency: newRental.currency,
          contract_url: newRental.contractLink || null,
          project_id: newRental.projectId || null,
          equipment_type: newRental.equipmentType ?? "other",
          equipment_id: newRental.equipmentId || null,
          status: "active",
        });
        if (error) console.error("[page] rental insert", error);
      })();
    }

    void logAuditEvent({
      company_id: companyId ?? "",
      user_id: user?.id ?? "",
      user_name: profile?.fullName ?? profile?.email ?? "admin",
      action: "rental_created",
      entity_type: "rental",
      entity_id: newRental.id,
      entity_name: newRental.name,
      new_value: { cost: newRental.cost, currency: newRental.currency },
    });

    setRentalInspectionSuggestion({
      rentalId: newRental.id,
      rentalName: newRental.name,
      templateId: inspectionTemplateIdForRentalEquipmentType(newRental.equipmentType),
      projectId: newRental.projectId,
    });

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
      invalidateDashboardCache();
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
      invalidateDashboardCache();
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
    invalidateDashboardCache();
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
          onCompanyNameChange={setCompanyName}
          onCountryChange={(country, defaults) => {
            setCompanyCountry(country);
            if (defaults) {
              if (!currencyManuallyChangedRef.current) {
                setCurrency(defaults.currency as Currency);
              }
              setMeasurementSystem(defaults.measurementSystem);
            }
            const defaultFields = getDefaultComplianceFields(country);
            setComplianceFields((prev) => [...defaultFields, ...prev.filter((f) => !f.isDefault)]);
          }}
          onCurrencyChange={(c) => {
            currencyManuallyChangedRef.current = true;
            setCurrency(c);
          }}
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
          canAccessSchedule={perms.canAccessSchedule}
          canAccessSettings={!!perms.canViewSettings}
          canAccessSecurity={perms.canAccessSecurity}
          canAccessFormsNav={perms.formsNav}
          labels={labels}
          collapsed={sidebarCollapsed}
          mobileDrawerOpen={mobileNavOpen}
          onMobileDrawerOpenChange={setMobileNavOpen}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden p-4 md:p-6 lg:p-8 min-h-screen pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-8">
          <header className="mb-4 sm:mb-8 border-b border-gray-200 dark:border-gray-800 pb-4 flex w-full min-w-0 max-w-full flex-col gap-3 overflow-x-hidden sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 max-w-full flex-1 items-center gap-2">
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
              <div className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-stretch gap-2 sm:w-auto sm:justify-end sm:gap-3">
              {session && companyId ? (
                <button
                  type="button"
                  onClick={() => setGlobalSearchOpen(true)}
                  className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-gray-700 dark:bg-gray-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  aria-label={(t as Record<string, string>).search_global ?? "Search"}
                  title={(t as Record<string, string>).search_kb_hint ?? "Ctrl+K"}
                >
                  <Search className="h-5 w-5 shrink-0" aria-hidden />
                </button>
              ) : null}
              {session && companyId ? (
                <NotificationBell
                  supabase={supabase}
                  labels={labels as Record<string, string>}
                  enabled
                  localeBcp47={dateLocaleBcp47}
                  timeZone={userTimeZone}
                  onNavigate={handleAppNotificationNavigate}
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
              {!!rolePerms.canManageCompliance && criticalComplianceCount > 0 && (
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
                              <li
                                key={`${a.source ?? "employee"}-${a.employeeId ?? a.vehicleId ?? a.subcontractorId}-${a.certName}-${a.expiryDate}`}
                              >
                                <button
                                  type="button"
                                  className="flex min-h-[44px] w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                  onClick={() => {
                                    setComplianceNotifOpen(false);
                                    if (a.source === "vehicle") {
                                      setActiveSection("warehouse");
                                    } else if (a.source === "subcontractor") {
                                      setActiveSection("subcontractors");
                                    } else {
                                      setActiveSection("office");
                                      setPendingOpenEmployeeId(a.employeeId ?? null);
                                    }
                                  }}
                                >
                                  <span className="font-medium text-zinc-900 dark:text-white">
                                    {watchdogSubjectLabel(a)}
                                  </span>
                                  <span className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    {a.certNameKey
                                      ? ((t as Record<string, string>)[a.certNameKey] ?? a.certName)
                                      : a.certName}
                                  </span>
                                </button>
                              </li>
                            ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <label className="flex min-w-0 flex-[1_1_8rem] items-center gap-2 sm:flex-initial sm:flex-none">
                <span className="sr-only">{(t as Record<string, string>).language ?? "Language"}</span>
                <select
                  value={language}
                  onChange={(e) => void applyLanguage(e.target.value as Language)}
                  aria-label={(t as Record<string, string>).language ?? "Language"}
                  className="min-h-[44px] w-full min-w-0 max-w-[min(100%,9.5rem)] flex-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 sm:max-w-none sm:min-w-[10rem] sm:flex-none sm:px-3 sm:text-sm"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.label}
                    </option>
                  ))}
                </select>
              </label>
              {session && (
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
                  <span className="hidden sm:block">
                    <BrandWordmark tone="onLight" className="text-xs font-semibold" />
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
                    {profile?.role ?? ""}
                  </span>
                  {profile?.isSuperadmin && (
                    <Link
                      href="/superadmin"
                      title={(t as Record<string, string>).superadmin_panel ?? "Panel Admin"}
                      aria-label={(t as Record<string, string>).superadmin_panel ?? "Panel Admin"}
                      className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/50 px-2.5 py-2 text-sm font-medium text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40 sm:min-w-0 sm:px-3"
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
                    title={(t as Record<string, string>).settings_sign_out ?? "Sign out"}
                    aria-label={(t as Record<string, string>).settings_sign_out ?? "Sign out"}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-2.5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:min-w-0 sm:px-4"
                  >
                    <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">
                      {(t as Record<string, string>).settings_sign_out ?? "Sign out"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </header>

          {session && companyId ? (
            <GlobalSearchModal
              open={globalSearchOpen}
              onClose={() => setGlobalSearchOpen(false)}
              labels={t as Record<string, string>}
              employees={activeEmployees.map((e) => ({
                id: e.id,
                name: e.name,
                email: e.email,
              }))}
              projects={visibleProjects.map((p) => ({ id: p.id, name: p.name }))}
              vehicles={(vehicles ?? []).map((v) => ({ id: v.id, plate: v.plate }))}
              suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))}
              binderDocuments={(binderDocuments ?? []).map((d) => ({
                id: d.id,
                name: d.name,
                binderId: d.binderId,
              }))}
              binders={(binders ?? []).map((b) => ({ id: b.id, name: b.name }))}
              flags={globalSearchFlags}
              onSelectEmployee={handleGlobalSearchSelectEmployee}
              onSelectProject={handleGlobalSearchSelectProject}
              onSelectVehicle={handleGlobalSearchSelectVehicle}
              onSelectSupplier={handleGlobalSearchSelectSupplier}
              onSelectDocument={handleGlobalSearchSelectDocument}
            />
          ) : null}

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
                    laborHourlyRate: e.laborHourlyRate,
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
                    invalidateDashboardCache();
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
                pendingOpenBinderDocumentId={pendingOpenBinderDocumentId}
                onPendingOpenBinderDocumentHandled={clearPendingOpenBinderDocument}
                companyName={(profile?.companyName ?? companyName) || null}
                onNavigateAppSection={(s) => setActiveSection(s)}
                onQuickNewHazard={() => {
                  navigateToOperationsProjectSecurity();
                  setDashHazardCreateSig((n) => n + 1);
                }}
                onQuickNewAction={() => {
                  navigateToOperationsProjectSecurity();
                  setDashActionCreateSig((n) => n + 1);
                }}
                onQuickVisitorQr={() => {
                  navigateToSiteVisitorsTab({ openQr: true });
                }}
                visitorCheckInUrl={companyId ? buildVisitorCheckInUrl(companyId) : null}
                canAccessEmployees={!!perms.canAccessEmployees}
                canAccessSubcontractors={!!perms.canAccessSubcontractors}
                canAccessVisitors={!!rolePerms.canViewProjectVisitors}
                canAccessHazards={
                  !!(rolePerms.canViewHazards || rolePerms.canManageHazards)
                }
                canAccessCorrective={
                  !!(rolePerms.canViewCorrectiveActions || rolePerms.canManageCorrectiveActions)
                }
                currentUserId={user?.id ?? null}
                canViewAttendance={!!rolePerms.canViewAttendance}
                dashboardCanManageEmployees={!!rolePerms.canManageEmployees}
                dashboardCanViewTeamClock={
                  !!(rolePerms.canViewTimeclock || rolePerms.canManageTimeclock)
                }
                dashboardCanViewTeamAvailability={!!rolePerms.canViewTeamAvailability}
                dashboardCanManageComplianceAlerts={!!rolePerms.canManageCompliance}
                dashboardCanViewLogistics={!!rolePerms.canViewLogistics}
                dashboardCanViewEmployees={
                  !!(rolePerms.canViewEmployees || rolePerms.canManageEmployees)
                }
                dashboardCanViewRoles={
                  !!(rolePerms.canViewRoles || rolePerms.canManageRoles)
                }
                dashboardCanViewAuditLog={!!rolePerms.canViewAuditLog}
                dashboardCanViewDashboardWidgets={!!rolePerms.canViewDashboardWidgets}
                dashboardCanViewProjectsManagement={!!rolePerms.canViewProjects}
                dashboardCriticalInventoryCount={criticalInventoryCount}
                laborCostingEnabled={laborCostingEnabled}
                canViewLaborCosting={!!rolePerms.canViewLaborCosting}
                gettingStartedRefreshTk={gettingStartedRefreshTk}
                laborCostingCurrency={currency}
                laborCostingRateByUserId={laborCostingRateByUserId}
                laborCostingEmployeeLabels={laborCostingEmployeeLabels}
                canViewForms={!!rolePerms.canViewForms}
                dashboardFormsActiveCount={dashboardFormsActiveCount}
                dashboardFormsPendingPreview={dashboardFormsPendingPreview}
                onNavigateToForms={() => setActiveSection("forms")}
                onNavigateToFormsNew={() => {
                  setActiveSection("forms");
                  setFormsOpenTemplatePickerTk((n) => n + 1);
                }}
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
                manualClockEmployeeOptions={activeEmployees.map((e) => ({ id: e.id, name: e.name }))}
                manualClockProjectOptions={(projects ?? [])
                  .filter((p) => !p.archived)
                  .map((p) => ({ id: p.id, name: p.name }))}
                registerManualClockIn={handleManualClockIn}
                canViewProjects={!!rolePerms.canViewProjects}
                canCreateProjects={!!rolePerms.canCreateProjects}
                canEditProjects={!!rolePerms.canEditProjects}
                canDeleteProjects={!!rolePerms.canDeleteProjects}
                complianceExpiredCertCount={complianceExpiredCertCount}
                canViewSecurityDashboard={!!perms.canAccessSecurity}
                onOpenOperationsSecurity={navigateToOperationsProjectSecurity}
                companyBindersPanel={
                  <BindersModule
                    binders={binders}
                    documents={binderDocuments}
                    canManage={!!perms.canManageBinders}
                    currentUserRole={effectiveRole}
                    employees={activeEmployees.map((e) => ({
                      id: e.id,
                      name: e.name,
                      role: e.role,
                      customRoleId: e.customRoleId,
                    }))}
                    roleOptions={customRoles.map((r) => ({ id: r.id, name: r.name }))}
                    labels={t as Record<string, string>}
                    onAddBinder={(b) => setBinders((prev) => [...prev, b])}
                    onDeleteBinder={(id) =>
                      setBinders((prev) => prev.filter((b) => b.id !== id || b.isDefault))
                    }
                    onAddDocument={(d) => setBinderDocuments((prev) => [...prev, d])}
                    onDeleteDocument={(id) =>
                      setBinderDocuments((prev) => prev.filter((doc) => doc.id !== id))
                    }
                  />
                }
                companyTrainingPanel={
                  <TrainingHubModule
                    t={t as Record<string, string>}
                    companyId={companyId}
                    userProfileId={profile?.id ?? null}
                    userName={profile?.fullName ?? profile?.email ?? user?.email ?? "User"}
                    canManageTraining={effectiveRole === "admin"}
                    employees={activeEmployees.map((e) => ({
                      id: e.id,
                      name: e.name,
                      role: e.role,
                      customRoleId: e.customRoleId,
                    }))}
                    customRoles={customRoles}
                    dateLocale={dateLocaleBcp47}
                    cloudinaryCloudName={
                      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || "dwdlmxmkt"
                    }
                    cloudinaryUploadPreset={
                      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || "i5dmd07o"
                    }
                  />
                }
                canOpenCompanyBinders={
                  !!(rolePerms.canViewBinders || rolePerms.canManageBinders)
                }
                canOpenCompanyTraining={!!perms.office}
                dashboardCanViewInventory={!!rolePerms.canViewInventory}
                dashboardCanViewProjectVisitors={!!rolePerms.canViewProjectVisitors}
                dashboardCanManageProjectVisitors={!!rolePerms.canManageProjectVisitors}
                dashboardCanManageHazards={!!rolePerms.canManageHazards}
                dashboardCanManageCorrectiveActions={!!rolePerms.canManageCorrectiveActions}
                dashboardCanManageProjectRFI={!!rolePerms.canManageProjectRFI}
                dashboardCanAccessSubcontractors={!!perms.canAccessSubcontractors}
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
                onAddFleet={() => {
                  setVehicleFormOpen(true);
                  setEditingVehicleId(null);
                  setVehicleDraft({
                    documents: seedVehicleDocumentsFromCountry(companyCountry, t as Record<string, string>),
                  });
                }}
                onEditFleet={(v) => {
                  setEditingVehicleId(v.id);
                  setVehicleDraft({
                    ...v,
                    documents: ensureVehicleDocuments(v, companyCountry, t as Record<string, string>),
                  });
                  setVehicleFormOpen(true);
                }}
                onDeleteFleet={(id) => {
                  const msg = (t as Record<string, string>).common_confirm_delete ?? "";
                  if (typeof window !== "undefined" && window.confirm(msg))
                    setVehicles((prev) => prev.filter((v) => v.id !== id));
                }}
                onAddRental={() => {
                  setRentalFormOpen(true);
                  setEditingRentalId(null);
                  setRentalDraft({
                    equipmentType: "other",
                    currency: rentalFormCurrency,
                  });
                }}
                onEditRental={(r) => {
                  setEditingRentalId(r.id);
                  setRentalDraft({
                    ...r,
                    cost: r.cost ?? r.costCAD ?? 0,
                    currency: r.currency ?? rentalFormCurrency,
                  });
                  setRentalFormOpen(true);
                }}
                onDeleteRental={(id) => {
                  const msg = (t as Record<string, string>).common_confirm_delete ?? "";
                  if (typeof window !== "undefined" && window.confirm(msg)) {
                    const deleted = rentals.find((x) => x.id === id);
                    setRentals((prev) => {
                      const next = prev.filter((r) => r.id !== id);
                      persistRentalsLocal(next);
                      return next;
                    });
                    void logAuditEvent({
                      company_id: companyId ?? "",
                      user_id: user?.id ?? "",
                      user_name: profile?.fullName ?? profile?.email ?? "admin",
                      action: "rental_deleted",
                      entity_type: "rental",
                      entity_id: id,
                      entity_name: deleted?.name,
                    });
                    if (supabase && companyId && isUuidString(id)) {
                      void supabase
                        .from("rentals")
                        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                        .eq("id", id)
                        .eq("company_id", companyId);
                    }
                  }
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
                gpsMapTimeZone={userTimeZone}
                gpsMapLanguage={language}
                gpsMapCountryCode={companyCountry}
                gpsProjectNameById={projectNameByIdForGps}
                vehiclesForGpsMap={vehicles}
                canViewForms={!!rolePerms.canViewForms}
                activeFormsTodayByVehicleId={logisticsActiveFormsTodayByVehicleId}
                activeFormsTodayByRentalId={logisticsActiveFormsTodayByRentalId}
                onOpenFormsFilteredByVehicle={(vehicleId) => {
                  setActiveSection("forms");
                  setFormsListContextFilterOnOpen({ type: "vehicle", id: vehicleId });
                }}
                onOpenFormsFilteredByRental={(rentalId) => {
                  setActiveSection("forms");
                  setFormsListContextFilterOnOpen({ type: "rental", id: rentalId });
                }}
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
                companyCountryCode={companyCountry}
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
                viewerIsAdmin={effectiveRole === "admin"}
                canViewEmployeeGpsRoute={!!rolePerms.canViewAttendance}
                canViewTeamAvailabilityInProfile={!!rolePerms.canViewTeamAvailability}
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
                scheduleEntries={scheduleEntries}
                dateLocale={dateLocaleBcp47}
                timeZone={userTimeZone}
                clockEntries={displayClockEntries}
                canClockInPersonal={
                  !!rolePerms.canViewTimeclock && effectiveRole !== "admin"
                }
                onManualClockIn={handleManualClockIn}
                onManualClockOut={handleManualClockOut}
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
                    canDeleteSubcontractor={!!rolePerms.canManageSubcontractors}
                    customRoles={customRoles}
                  />
                ) : operationsMainTab === "subcontractors" && perms.canAccessSubcontractors ? (
                  <SubcontractorsModule
                    companyId={companyId}
                    onBackToOffice={() => setOperationsMainTab("projects")}
                    labels={t as Record<string, string>}
                    projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name, archived: p.archived }))}
                    canManage={rolePerms.canManageSubcontractors}
                    canDeleteSubcontractor={!!rolePerms.canManageSubcontractors}
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
                    submittedByName:
                      (employees ?? []).find((e) => e.id === effectiveEmployeeId)?.name ??
                      ((t as Record<string, string>).employees_display_anonymous ?? "—"),
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
                  if (companyId && supabase) {
                    void (async () => {
                      const { error } = await supabase
                        .from("projects")
                        .update({ assigned_employee_ids: employeeIds })
                        .eq("id", projectId)
                        .eq("company_id", companyId);
                      if (error) console.error("[page] assigned_employee_ids update", error);
                    })();
                  }
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
                onUpdateProjectSafetyRequirements={
                  rolePerms.canEditProjects ? handleUpdateProjectSafetyRequirements : undefined
                }
                projectNameByIdForGps={projectNameByIdForGps}
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
                canManageProjectTeam={!!rolePerms.canManageProjectTeam}
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
                projectLaborSummaries={projectLaborSummaries}
                canViewProjectLaborCosts={!!rolePerms.canViewLaborCosting}
                dailyReports={dailyReports}
                onRefreshDailyReports={reloadDailyReports}
                onDailyReportPublished={handleDailyReportPublished}
                focusDailyReportNav={dailyReportNotificationFocus}
                onConsumeDailyReportNav={consumeDailyReportNotificationFocus}
                teamProfiles={teamProfiles}
                canManageDailyReports={!!rolePerms.canManageDailyReports}
                companyId={companyId ?? ""}
                currentUserProfileId={profile?.id ?? null}
                onOpenHazardFromBlueprint={(id) => {
                  setFocusHazardId(id);
                  setActiveSection("site");
                  setProjectsSecurityTabSig((n) => n + 1);
                }}
                onOpenCorrectiveFromBlueprint={() => {
                  setActiveSection("site");
                  setProjectsSecurityTabSig((n) => n + 1);
                  setDashActionCreateSig((n) => n + 1);
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
                shiftLocationSharingEnabled={profile?.locationSharingEnabled !== false}
                visitorOpenQrSignal={dashVisitorQrSig}
                visitorTabSignal={dashVisitorTabSig}
                openRfiTabSignal={projectsOpenRfiSig}
                showProjectRfiTab={!!rolePerms.canViewProjectRFI}
                showProjectVisitorsTab={!!rolePerms.canViewProjectVisitors}
                showProjectSecurityTab={!!rolePerms.canViewSecurity}
                showProjectGeneralTab={!!rolePerms.canViewProjectGeneral}
                showProjectTeamTab={!!rolePerms.canViewProjectTeam}
                showProjectInventoryTab={!!rolePerms.canViewProjectInventory}
                showProjectGalleryTab={!!rolePerms.canViewProjectGallery}
                showProjectBlueprintsTab={!!rolePerms.canViewProjectBlueprints}
                showProjectFormsTab={!!rolePerms.canViewProjectForms}
                showProjectMapTab={!!rolePerms.canViewAttendance}
                showProjectEpiTab={!!rolePerms.canViewSecurity}
                projectsSecurityTabSignal={projectsSecurityTabSig}
                projectSecurityCompanyId={companyId}
                projectSecurityCompanyName={profile?.companyName ?? companyName}
                projectSecurityUserRole={effectiveRole}
                projectSecurityUserName={
                  profile?.fullName ?? profile?.email ?? user?.email ?? "User"
                }
                projectSecurityUserProfileId={profile?.id ?? null}
                projectSecurityFocusHazardId={focusHazardId}
                onProjectSecurityFocusHazardConsumed={() => setFocusHazardId(null)}
                projectSecurityCorrectivePrefill={correctivePrefill}
                onProjectSecurityConsumeCorrectivePrefill={consumeCorrectivePrefill}
                projectSecurityOpenHazardSignal={dashHazardCreateSig}
                projectSecurityOpenActionSignal={dashActionCreateSig}
                onProjectSecuritySetCorrectivePrefill={setCorrectivePrefill}
                onProjectSecurityRequestFocusHazard={(id) => setFocusHazardId(id)}
                onProjectSecurityInteraction={clearProjectSecurityDashSignals}
                projectSecurityCanShowHazards={
                  !!(rolePerms.canViewHazards || rolePerms.canManageHazards)
                }
                projectSecurityCanShowActions={
                  !!(rolePerms.canViewCorrectiveActions || rolePerms.canManageCorrectiveActions)
                }
                projectSecurityDateLocale={dateLocaleBcp47}
                projectSecurityTimeZone={userTimeZone}
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
                formTemplates={formTemplates}
                canCreateMachinFormFromProject={!!rolePerms.canCreateForms}
                canDeleteProjectFormEntry={!!rolePerms.canManageProjectForms}
                onStartFormFromMachinTemplate={({ templateId, projectId }) => {
                  const template = formTemplates.find((x) => x.id === templateId);
                  if (!template) return;
                  const projectName =
                    (visibleProjects ?? []).find((p) => p.id === projectId)?.name ?? "";
                  const instance = buildFormInstanceFromTemplate(
                    template,
                    { type: "project", id: projectId, name: projectName || null },
                    {
                    currentUserEmployeeId: effectiveEmployeeId ?? "",
                    employees: activeEmployees.map((e) => ({ id: e.id, name: e.name })),
                    projects: (visibleProjects ?? []).map((p) => ({
                      id: p.id,
                      assignedEmployeeIds: p.assignedEmployeeIds,
                    })),
                  }
                  );
                  setFormInstances((prev) => [...prev, instance]);
                  setFormsOpenFillInstanceId(instance.id);
                  setFormsListProjectFilterOnOpen(projectId);
                  setActiveSection("forms");
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

            {activeSection === "schedule" && perms.canAccessSchedule && (
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
                  archived: p.archived,
                }))}
                currentUserEmployeeId={currentUserEmployeeId ?? undefined}
                employeeLabels={scheduleEmployeeLabels}
                canWrite={!!rolePerms.canCreateShifts}
                canViewScheduleCalendar={!!rolePerms.canViewSchedule}
                canViewTimeclock={!!rolePerms.canViewTimeclock}
                canViewTimesheets={!!rolePerms.canViewTimesheets}
                canViewTeamAvailability={!!rolePerms.canViewTeamAvailability}
                canManageTeamAvailability={!!rolePerms.canManageTeamAvailability}
                canClockIn={effectiveRole !== "admin"}
                canManageEmployees={!!rolePerms.canManageEmployees}
                currentUserProfileId={profile?.id}
                profileToLegacyEmployeeId={userToEmployeeMap}
                onManualClockIn={handleManualClockIn}
                onManualClockOut={handleManualClockOut}
                viewAll={!!rolePerms.canViewSchedule}
                canApproveVacations={!!rolePerms.canManageVacations}
                canRequestVacation={!!session && !!companyId}
                vacationRequests={vacationRequests}
                vacationEmployeeNames={vacationEmployeeNames}
                currentUserId={user?.id ?? ""}
                onApproveVacation={handleApproveVacation}
                onRejectVacation={handleRejectVacation}
                onRequestVacation={handleCreateVacationRequest}
                labels={{
                  schedule: t.schedule ?? "Horario",
                  clock_tab: (t as Record<string, string>).clock_tab,
                  schedule_tab_calendar: (t as Record<string, string>).schedule_tab_calendar,
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
                  previousMonth: (t as Record<string, string>).schedule_prev_month ?? "Previous month",
                  nextMonth: (t as Record<string, string>).schedule_next_month ?? "Next month",
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
                  schedule_search_employees: (t as Record<string, string>).schedule_search_employees,
                  schedule_selected_count: (t as Record<string, string>).schedule_selected_count,
                  schedule_days_selected: (t as Record<string, string>).schedule_days_selected,
                  schedule_available: (t as Record<string, string>).schedule_available,
                  schedule_busy: (t as Record<string, string>).schedule_busy,
                  schedule_partial: (t as Record<string, string>).schedule_partial,
                  schedule_conflict_warning: (t as Record<string, string>).schedule_conflict_warning,
                  schedule_no_project: (t as Record<string, string>).schedule_no_project,
                  schedule_shift_general_option: (t as Record<string, string>).schedule_shift_general_option,
                  schedule_team_availability: (t as Record<string, string>).schedule_team_availability,
                  schedule_this_week_btn: (t as Record<string, string>).schedule_this_week_btn,
                  schedule_prev_week: (t as Record<string, string>).schedule_prev_week,
                  schedule_next_week: (t as Record<string, string>).schedule_next_week,
                  schedule_availability_this_week: (t as Record<string, string>).schedule_availability_this_week,
                  schedule_availability_2plus: (t as Record<string, string>).schedule_availability_2plus,
                  schedule_deselect_filter: (t as Record<string, string>).schedule_deselect_filter,
                  export_csv: (t as Record<string, string>).export_csv ?? "Export CSV",
                  export_pdf: (t as Record<string, string>).export_pdf ?? "Export PDF",
                  export_timesheets: (t as Record<string, string>).export_timesheets ?? "Export timesheets",
                  export_success: (t as Record<string, string>).export_success ?? "Export completed",
                  export_error: (t as Record<string, string>).export_error ?? "Export error",
                  vacations_tab: (t as Record<string, string>).vacations_tab,
                  vacations_request: (t as Record<string, string>).vacations_request,
                  vacations_pending: (t as Record<string, string>).vacations_pending,
                  vacations_approved: (t as Record<string, string>).vacations_approved,
                  vacations_rejected: (t as Record<string, string>).vacations_rejected,
                  vacations_filter_employee: (t as Record<string, string>).vacations_filter_employee,
                  vacations_filter_status: (t as Record<string, string>).vacations_filter_status,
                  vacations_all: (t as Record<string, string>).vacations_all,
                  vacations_days_used: (t as Record<string, string>).vacations_days_used,
                  vacations_days_remaining: (t as Record<string, string>).vacations_days_remaining,
                  vacations_allowance_hint: (t as Record<string, string>).vacations_allowance_hint,
                  vacations_list_heading: (t as Record<string, string>).vacations_list_heading,
                  timesheet_weekly_summary: (t as Record<string, string>).timesheet_weekly_summary,
                  timesheet_export: (t as Record<string, string>).timesheet_export,
                  timesheet_total_month: (t as Record<string, string>).timesheet_total_month,
                  timesheet_date_from: (t as Record<string, string>).timesheet_date_from,
                  timesheet_date_to: (t as Record<string, string>).timesheet_date_to,
                  timesheet_by_project: (t as Record<string, string>).timesheet_by_project,
                  admin: (t as Record<string, string>).admin,
                  supervisor: (t as Record<string, string>).supervisor,
                  worker: (t as Record<string, string>).worker,
                  logistic: (t as Record<string, string>).logistic,
                  whFilterAll: (t as Record<string, string>).whFilterAll,
                  openInMaps: (t as Record<string, string>).openInMaps,
                  viewMyShift: (t as Record<string, string>).viewMyShift,
                  labor_cost_column: (t as Record<string, string>).labor_cost_column,
                  labor_cost_total: (t as Record<string, string>).labor_cost_total,
                  labor_hours_worked: (t as Record<string, string>).labor_hours_worked,
                  labor_export_report: (t as Record<string, string>).labor_export_report,
                  labor_report_summary: (t as Record<string, string>).labor_report_summary,
                  labor_cost_filter_week: (t as Record<string, string>).labor_cost_filter_week,
                  labor_cost_filter_month: (t as Record<string, string>).labor_cost_filter_month,
                  labor_cost_filter_custom: (t as Record<string, string>).labor_cost_filter_custom,
                  labor_cost_by_employee: (t as Record<string, string>).labor_cost_by_employee,
                  labor_cost_by_project: (t as Record<string, string>).labor_cost_by_project,
                  logistics_filters_toggle: (t as Record<string, string>).logistics_filters_toggle,
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
                canViewTimesheetCosts={!!rolePerms.canViewLaborCosting}
                canViewLaborCosting={!!rolePerms.canViewLaborCosting}
                timesheetCostCurrency={currency}
                employeeLaborRatesByEmployeeId={employeeLaborRateLookup}
              />
              <ModuleHelpFab
                moduleKey="schedule"
                labels={t as Record<string, string>}
                onOpenSettingsHelp={openSettingsHelpFromFab}
              />
            </>
            )}

            {activeSection === "security" && perms.canAccessSecurity && companyId && (
              <>
                <SecurityModule
                  t={t as Record<string, string>}
                  companyId={companyId}
                  companyName={(profile?.companyName ?? companyName ?? "").trim() || "Company"}
                  userRole={effectiveRole}
                  userName={profile?.fullName ?? profile?.email ?? user?.email ?? "User"}
                  userProfileId={profile?.id ?? null}
                  projects={visibleProjects.map((p) => ({ id: p.id, name: p.name }))}
                  employees={activeEmployees.map((e) => ({
                    id: e.id,
                    name: e.name,
                    role: e.role,
                    customRoleId: e.customRoleId,
                  }))}
                  focusHazardId={focusHazardId}
                  onFocusHazardConsumed={() => setFocusHazardId(null)}
                  correctivePrefill={correctivePrefill}
                  onConsumeCorrectivePrefill={consumeCorrectivePrefill}
                  openHazardSignal={dashHazardCreateSig}
                  openActionSignal={dashActionCreateSig}
                  binders={binders}
                  binderDocuments={binderDocuments}
                  canManageBinders={!!perms.canManageBinders}
                  roleOptions={customRoles.map((r) => ({ id: r.id, name: r.name }))}
                  onAddBinder={(b) => setBinders((prev) => [...prev, b])}
                  onDeleteBinder={(id) =>
                    setBinders((prev) => prev.filter((b) => b.id !== id || b.isDefault))
                  }
                  onAddDocument={(d) => setBinderDocuments((prev) => [...prev, d])}
                  onDeleteDocument={(id) =>
                    setBinderDocuments((prev) => prev.filter((doc) => doc.id !== id))
                  }
                  auditLogs={auditLogs}
                  canManageRoles={!!rolePerms.canManageRoles}
                  canShowHazards={!!(rolePerms.canViewHazards || rolePerms.canManageHazards)}
                  canShowActions={
                    !!(rolePerms.canViewCorrectiveActions || rolePerms.canManageCorrectiveActions)
                  }
                  canShowDocuments={
                    !!(rolePerms.canViewSecurityDocs || rolePerms.canManageSecurityDocs)
                  }
                  canShowAudit={!!rolePerms.canViewSecurityAudit}
                  canShowTraining={!!rolePerms.canViewSecurity}
                  canManageTraining={effectiveRole === "admin"}
                  cloudinaryCloudName={
                    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || "dwdlmxmkt"
                  }
                  cloudinaryUploadPreset={
                    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || "i5dmd07o"
                  }
                  customRoles={customRoles}
                  onOpenCorrectiveFromHazard={(payload) => {
                    setCorrectivePrefill({
                      hazardId: payload.hazardId,
                      projectId: payload.projectId,
                      projectName: payload.projectName,
                    });
                  }}
                  onRequestFocusHazard={(id) => setFocusHazardId(id)}
                  onSecurityTabInteraction={clearProjectSecurityDashSignals}
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

            {activeSection === "forms" && perms.forms && (
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
                canCreateForms={!!rolePerms.canCreateForms}
                canManageFormTemplates={!!rolePerms.canManageFormTemplates}
                canFillForms={!!rolePerms.canFillForms}
                canApproveForms={!!rolePerms.canApproveForms}
                canExportForms={!!rolePerms.canExportForms}
                canViewForms={!!rolePerms.canViewForms}
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
                dateLocale={dateLocaleBcp47}
                timeZone={userTimeZone}
                openFillInstanceId={formsOpenFillInstanceId}
                listProjectFilterOnOpen={formsListProjectFilterOnOpen}
                listContextFilterOnOpen={formsListContextFilterOnOpen}
                onConsumeListContextFilter={() => setFormsListContextFilterOnOpen(null)}
                openTemplatePickerToken={formsOpenTemplatePickerTk}
                vehicles={(vehicles ?? []).map((v) => ({ id: v.id, plate: v.plate }))}
                rentals={(rentals ?? [])
                  .filter((r) => (r.returnDate ?? "") >= formatTodayYmdInTimeZone(userTimeZone))
                  .map((r) => ({ id: r.id, name: r.name }))}
                onConsumeOpenFillNavigation={consumeFormsOpenFillNavigation}
              />
              <ModuleHelpFab
                moduleKey="forms"
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
                setCurrency={(c) => {
                  currencyManuallyChangedRef.current = true;
                  setCurrency(c as Currency);
                }}
                measurementSystem={measurementSystem}
                setMeasurementSystem={setMeasurementSystem}
                canEditCompanyProfile={!!rolePerms.canEditCompanyProfile}
                canManageHazardActionPush={
                  !!(rolePerms.canManageCompliance || rolePerms.canManageEmployees)
                }
                canManageProjectVisitors={!!rolePerms.canManageProjectVisitors}
                canManageRegionalConfig={!!rolePerms.canManageRegionalConfig}
                companyCountry={companyCountry}
                onCountryChange={(country, defaults) => {
                  setCompanyCountry(country);
                  if (defaults) {
                    if (!currencyManuallyChangedRef.current) {
                      setCurrency(defaults.currency as Currency);
                    }
                    setMeasurementSystem(defaults.measurementSystem);
                  }
                  const defaultFields = getDefaultComplianceFields(country);
                  setComplianceFields((prev) => [...defaultFields, ...prev.filter((f) => !f.isDefault)]);
                }}
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
                      projectsCount={countOperationallyActiveProjects(
                        projects ?? [],
                        new Date().toISOString().split("T")[0]
                      )}
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
                profileLocationSharingEnabled={profileLocationSharingEnabled}
                setProfileLocationSharingEnabled={setProfileLocationSharingEnabled}
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
                darkMode={darkMode ?? false}
                onDarkModeChange={(next) => setDarkMode(next)}
                showMfaSecuritySection={effectiveRole === "admin" || effectiveRole === "supervisor"}
                canManageNotifications={!!rolePerms.canManageNotifications}
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
                              className="w-16 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-slate-900 text-center text-sm py-1 min-h-[44px]"
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
                              className="w-16 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-slate-900 text-center text-sm py-1 min-h-[44px]"
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
          <div className="fixed bottom-20 right-4 z-40 xl:hidden">
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
                <AddressAutocomplete
                  value={projectFormLocation}
                  onChange={setProjectFormLocation}
                  placeholder={(t as Record<string, string>).projectFormLocationPlaceholder ?? ""}
                  onPlaceResolved={(p) => {
                    if (p.lat != null) setProjectFormLat(String(p.lat));
                    if (p.lng != null) setProjectFormLng(String(p.lng));
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
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
                <select
                  value={
                    editingInventoryId
                      ? editInventoryDraft?.type === "material"
                        ? "consumable"
                        : (editInventoryDraft?.type ?? "consumable")
                      : newItemCategory === "material"
                        ? "consumable"
                        : newItemCategory
                  }
                  onChange={(e) => {
                    const v = e.target.value as "consumable" | "tool" | "equipment";
                    if (editingInventoryId) {
                      setEditInventoryDraft((d) => (d ? { ...d, type: v } : d));
                    } else {
                      setNewItemCategory(v);
                    }
                  }}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="consumable">{t.consumable ?? t.whTabMaterial ?? "Material"}</option>
                  <option value="tool">{t.whTabTools ?? "Herramientas"}</option>
                  <option value="equipment">{t.equipment ?? "Equipamiento"}</option>
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
          <div className="fixed z-50 flex max-h-[100dvh] w-full flex-col border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-8 max-sm:max-h-[calc(100dvh-2rem)] max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 sm:left-1/2 sm:top-1/2 sm:max-h-[min(92dvh,720px)] sm:w-[min(100%,28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border">
            <div className="shrink-0 border-b border-zinc-200 px-4 py-4 dark:border-slate-700 sm:px-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {editingVehicleId ? (t.edit ?? "Editar") : (t.addNew ?? "Añadir")} vehículo
              </h3>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="space-y-3">
              {(() => {
                const tl = t as Record<string, string>;
                const docStatusBadge = (doc: VehicleDocument) => {
                  const st = computeVehicleDocStatus(doc.expiryDate, doc.alertDays ?? 30);
                  const label =
                    st === "ok"
                      ? (tl.valid ?? "Al día")
                      : st === "soon"
                        ? (tl.expiring ?? "Vence pronto")
                        : st === "expired"
                          ? (tl.expired ?? "Vencido")
                          : (tl.missing ?? "Sin fecha");
                  const cls =
                    st === "ok"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : st === "soon"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : st === "expired"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
                  return (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
                  );
                };
                return (
                  <>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Matrícula</label><input type="text" value={vehicleDraft.plate ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, plate: e.target.value }))} className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Conductor habitual</label><select value={vehicleDraft.usualDriverId ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, usualDriverId: e.target.value }))} className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"><option value="">—</option>{(employees ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Proyecto asignado</label><select value={vehicleDraft.currentProjectId ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, currentProjectId: e.target.value || null }))} className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"><option value="">—</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{tl.status ?? "Estado"}</label><select value={vehicleDraft.vehicleStatus ?? "available"} onChange={(e) => setVehicleDraft((d) => ({ ...d, vehicleStatus: e.target.value as VehicleStatus }))} className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"><option value="available">{tl.available ?? "Disponible"}</option><option value="in_use">{tl.inUse ?? "En uso"}</option><option value="maintenance">{tl.maintenance ?? "Mantenimiento"}</option><option value="out_of_service">{tl.outOfService ?? "Fuera de servicio"}</option></select></div>
              <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-slate-700">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{tl.vehicle_documents ?? "Documentación del vehículo"}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setVehicleDraft((d) => ({
                        ...d,
                        documents: [
                          ...(d.documents ?? []),
                          { id: newVehicleDocumentId(), name: "", alertDays: 30 },
                        ],
                      }))
                    }
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-amber-500/60 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                  >
                    {tl.vehicle_add_document ?? "Añadir documento"}
                  </button>
                </div>
                {(vehicleDraft.documents ?? []).map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-xl border border-zinc-200 dark:border-slate-600 bg-zinc-50/50 dark:bg-slate-800/40 p-3 space-y-2"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <input
                        type="text"
                        value={vehicleDocDisplayName(doc, tl)}
                        onChange={(e) =>
                          setVehicleDraft((d) => ({
                            ...d,
                            documents: (d.documents ?? []).map((x) =>
                              x.id === doc.id
                                ? { ...x, name: e.target.value, nameKey: undefined }
                                : x
                            ),
                          }))
                        }
                        placeholder={tl.name ?? "Nombre del documento"}
                        className="min-h-[44px] w-full min-w-0 sm:flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        {docStatusBadge(doc)}
                        <button
                          type="button"
                          onClick={() =>
                            setVehicleDraft((d) => ({
                              ...d,
                              documents: (d.documents ?? []).filter((x) => x.id !== doc.id),
                            }))
                          }
                          className="min-h-[44px] min-w-[44px] rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30 text-sm font-medium"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">{tl.vehicle_doc_expiry ?? "Fecha de vencimiento"}</label>
                      <input
                        type="date"
                        value={doc.expiryDate ?? ""}
                        onChange={(e) =>
                          setVehicleDraft((d) => ({
                            ...d,
                            documents: (d.documents ?? []).map((x) =>
                              x.id === doc.id ? { ...x, expiryDate: e.target.value || undefined } : x
                            ),
                          }))
                        }
                        className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">URL</label>
                      <input
                        type="url"
                        value={doc.documentUrl ?? ""}
                        onChange={(e) =>
                          setVehicleDraft((d) => ({
                            ...d,
                            documents: (d.documents ?? []).map((x) =>
                              x.id === doc.id ? { ...x, documentUrl: e.target.value || undefined } : x
                            ),
                          }))
                        }
                        placeholder="https://"
                        className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">{tl.vehicle_doc_alert_days ?? "Alertar X días antes"}</label>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={doc.alertDays ?? 30}
                        onChange={(e) =>
                          setVehicleDraft((d) => ({
                            ...d,
                            documents: (d.documents ?? []).map((x) =>
                              x.id === doc.id
                                ? { ...x, alertDays: Math.max(0, parseInt(e.target.value, 10) || 0) }
                                : x
                            ),
                          }))
                        }
                        className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
                  </>
                );
              })()}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{(t as Record<string, string>).lastMaintenance ?? "Último mantenimiento"}</label><input type="date" value={vehicleDraft.lastMaintenanceDate ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, lastMaintenanceDate: e.target.value }))} className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div><div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{(t as Record<string, string>).nextMaintenance ?? "Próximo mantenimiento"}</label><input type="date" value={vehicleDraft.nextMaintenanceDate ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, nextMaintenanceDate: e.target.value }))} className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{(t as Record<string, string>).mileage ?? "Kilometraje"}</label><input type="number" min={0} value={vehicleDraft.mileage ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, mileage: e.target.value ? parseInt(e.target.value, 10) : undefined }))} className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Notas</label><textarea rows={2} value={vehicleDraft.notes ?? ""} onChange={(e) => setVehicleDraft((d) => ({ ...d, notes: e.target.value }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" /></div>
            </div>
            </div>
            <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-zinc-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={closeVehicleForm} className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:w-auto">{t.cancel ?? "Cancelar"}</button>
              <button type="button" onClick={saveVehicle} className="min-h-[44px] w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 sm:w-auto">{t.save ?? "Guardar"}</button>
            </div>
          </div>
        </>
      )}

      {(rentalFormOpen || editingRentalId) && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={closeRentalForm} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              {editingRentalId ? (t.edit ?? "Editar") : (t.addNew ?? "Añadir")}{" "}
              {(t as Record<string, string>).rental_title ?? "alquiler"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).rental_field_name ?? "Nombre del equipo"}
                </label>
                <input
                  type="text"
                  value={rentalDraft.name ?? ""}
                  onChange={(e) => setRentalDraft((d) => ({ ...d, name: e.target.value }))}
                  className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).rental_field_supplier ?? "Proveedor"}
                </label>
                <input
                  type="text"
                  value={rentalDraft.supplier ?? ""}
                  onChange={(e) => setRentalDraft((d) => ({ ...d, supplier: e.target.value }))}
                  className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).rental_field_return_date ?? "Fecha de devolución"}
                </label>
                <input
                  type="date"
                  value={rentalDraft.returnDate ?? ""}
                  onChange={(e) => setRentalDraft((d) => ({ ...d, returnDate: e.target.value }))}
                  className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).rental_field_equipment_type ?? "Tipo de equipo"}
                </label>
                <select
                  value={rentalDraft.equipmentType ?? "other"}
                  onChange={(e) =>
                    setRentalDraft((d) => ({
                      ...d,
                      equipmentType: e.target.value as RentalEquipmentType,
                    }))
                  }
                  className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="vehicle">{(t as Record<string, string>).rental_type_vehicle ?? "Vehículo"}</option>
                  <option value="forklift">
                    {(t as Record<string, string>).rental_type_forklift ?? "Carretilla elevadora"}
                  </option>
                  <option value="scaffold">{(t as Record<string, string>).rental_type_scaffold ?? "Andamio"}</option>
                  <option value="tool">{(t as Record<string, string>).rental_type_tool ?? "Herramienta"}</option>
                  <option value="other">{(t as Record<string, string>).rental_type_other ?? "Otro"}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).rental_field_equipment_id ?? "Matrícula / ID del equipo"}
                </label>
                <input
                  type="text"
                  value={rentalDraft.equipmentId ?? ""}
                  onChange={(e) => setRentalDraft((d) => ({ ...d, equipmentId: e.target.value }))}
                  className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).rental_field_cost ?? "Coste"}{" "}
                  <span className="text-zinc-500">({rentalFormCurrency})</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={rentalDraft.cost ?? rentalDraft.costCAD ?? ""}
                  onChange={(e) =>
                    setRentalDraft((d) => ({
                      ...d,
                      cost: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {(t as Record<string, string>).rental_field_contract ?? "Contrato (URL)"}
                </label>
                <input
                  type="url"
                  value={rentalDraft.contractLink ?? ""}
                  onChange={(e) => setRentalDraft((d) => ({ ...d, contractLink: e.target.value }))}
                  className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  placeholder="https://"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t.assignedProject ?? "Proyecto asignado"}
                </label>
                <select
                  value={rentalDraft.projectId ?? ""}
                  onChange={(e) => setRentalDraft((d) => ({ ...d, projectId: e.target.value || undefined }))}
                  className="min-h-[44px] w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">{t.noProject ?? "Sin proyecto"}</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeRentalForm}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
              >
                {t.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={saveRental}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
              >
                {t.save ?? "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}

      {rentalInspectionSuggestion && (
        <>
          <div
            className="fixed inset-0 z-[55] bg-black/50 touch-none"
            aria-hidden
            onClick={() => setRentalInspectionSuggestion(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[56] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <p className="text-sm text-zinc-800 dark:text-zinc-100 mb-6">
              {((t as Record<string, string>).rental_inspection_suggestion ?? "¿Crear inspección para {name}?").replace(
                "{name}",
                rentalInspectionSuggestion.rentalName
              )}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRentalInspectionSuggestion(null)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
              >
                {(t as Record<string, string>).rental_inspection_suggestion_no ?? "Ahora no"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const sug = rentalInspectionSuggestion;
                  setRentalInspectionSuggestion(null);
                  if (!sug) return;
                  const template = formTemplates.find((x) => x.id === sug.templateId);
                  const pid =
                    sug.projectId ||
                    visibleProjects[0]?.id ||
                    (projects ?? [])[0]?.id ||
                    "";
                  if (!template || !pid) return;
                  const pname = (visibleProjects ?? []).find((p) => p.id === pid)?.name ?? "";
                  const instance = buildFormInstanceFromTemplate(
                    template,
                    { type: "project", id: pid, name: pname || null },
                    {
                    currentUserEmployeeId: effectiveEmployeeId ?? "",
                    employees: activeEmployees.map((e) => ({ id: e.id, name: e.name })),
                    projects: (visibleProjects ?? []).map((p) => ({
                      id: p.id,
                      assignedEmployeeIds: p.assignedEmployeeIds,
                    })),
                  }
                  );
                  setFormInstances((prev) => [...prev, instance]);
                  setFormsOpenFillInstanceId(instance.id);
                  setFormsListProjectFilterOnOpen(pid);
                  setActiveSection("forms");
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
              >
                {(t as Record<string, string>).rental_inspection_suggestion_yes ?? "Sí, crear inspección"}
              </button>
            </div>
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
                      <input type="text" placeholder={(t as Record<string, string>).name ?? "Nombre"} value={c.name} onChange={(e) => setSupplierDraft((d) => d?.contacts ? { ...d, contacts: d.contacts!.map((cc, i) => i === idx ? { ...cc, name: e.target.value } : cc) } : d)} className="w-full sm:flex-1 sm:min-w-0 rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm min-h-[44px]" />
                      <select value={c.role} onChange={(e) => setSupplierDraft((d) => d?.contacts ? { ...d, contacts: d.contacts.map((cc, i) => i === idx ? { ...cc, role: e.target.value as SupplierContact["role"] } : cc) } : d)} className="w-full sm:w-auto rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm min-h-[44px]">
                        <option value="sales">{(t as Record<string, string>).roleSales ?? "Ventas"}</option>
                        <option value="accounting">{(t as Record<string, string>).roleAccounting ?? "Contabilidad"}</option>
                        <option value="technical">{(t as Record<string, string>).roleTechnical ?? "Técnico"}</option>
                        <option value="other">{(t as Record<string, string>).other ?? "Otro"}</option>
                      </select>
                      <input type="text" placeholder={(t as Record<string, string>).phone ?? "Tel."} value={c.phone ?? ""} onChange={(e) => setSupplierDraft((d) => d?.contacts ? { ...d, contacts: d.contacts.map((cc, i) => i === idx ? { ...cc, phone: e.target.value || undefined } : cc) } : d)} className="w-full sm:w-28 rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm min-h-[44px]" />
                      <input type="text" placeholder="Email" value={c.email ?? ""} onChange={(e) => setSupplierDraft((d) => d?.contacts ? { ...d, contacts: d.contacts.map((cc, i) => i === idx ? { ...cc, email: e.target.value || undefined } : cc) } : d)} className="w-full sm:w-32 rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm min-h-[44px]" />
                      <button type="button" onClick={() => setSupplierDraft((d) => d ? { ...d, contacts: (d.contacts ?? []).filter((_, i) => i !== idx) } : d)} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">{(t as Record<string, string>)["delete"] ?? "Eliminar"}</button>
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
          timeZone={userTimeZone}
        />
      )}
      <InstallPWABanner labels={t} isDark={darkMode ?? false} />
    </div>
  );
}
