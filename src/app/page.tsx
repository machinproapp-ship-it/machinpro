"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
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
import { OperationsModule } from "@/components/OperationsModule";
import ScheduleModule from "@/components/ScheduleModule";
import { FormsModule } from "@/components/FormsModule";
import { BindersModule } from "@/components/BindersModule";
import LoginScreen from "@/components/LoginScreen";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useAuth } from "@/lib/AuthContext";
import { LogOut, Wifi, WifiOff, Cloud, CloudOff, CloudCheck, Camera, AlertTriangle, Shield, X, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
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
import type { Blueprint, Annotation, BlueprintRevision } from "@/types/blueprints";
import type { CustomRole, RolePermissions } from "@/types/roles";
import type { Binder, BinderDocument, BinderCategory } from "@/types/binders";
import type { FormTemplate, FormInstance } from "@/types/forms";
import type { Subcontractor } from "@/types/subcontractor";
import { INITIAL_FORM_TEMPLATES } from "@/lib/formTemplates";
import { getCountryConfig } from "@/lib/countryConfig";

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

export interface Employee {
  id: string;
  name: string;
  role: string;
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
}

export type ProjectType = "residential" | "commercial" | "industrial";

export type { Subcontractor } from "@/types/subcontractor";

// Turno o evento en el calendario
export interface ScheduleEntry {
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

const INITIAL_CUSTOM_ROLES: CustomRole[] = [
  {
    id: "role-admin",
    name: "Administrador",
    color: "#b45309",
    createdAt: new Date().toISOString(),
    permissions: {
      canViewCentral: true,
      canEditCentral: true,
      canViewLogistics: true,
      canEditLogistics: true,
      canViewProjects: true,
      canViewOnlyAssignedProjects: false,
      canEditProjects: true,
      canViewSchedule: true,
      canWriteSchedule: true,
      canViewBlueprints: true,
      canAnnotateBlueprints: true,
      canViewSettings: true,
      canEditSettings: true,
      canManageRoles: true,
      canManageEmployees: true,
      canViewForms: true,
      canManageForms: true,
      canViewBinders: true,
      canManageBinders: true,
    },
  },
  {
    id: "role-supervisor",
    name: "Supervisor",
    color: "#0d9488",
    createdAt: new Date().toISOString(),
    permissions: {
      canViewCentral: false,
      canEditCentral: false,
      canViewLogistics: false,
      canEditLogistics: false,
      canViewProjects: true,
      canViewOnlyAssignedProjects: true,
      canEditProjects: false,
      canViewSchedule: true,
      canWriteSchedule: true,
      canViewBlueprints: true,
      canAnnotateBlueprints: true,
      canViewSettings: true,
      canEditSettings: false,
      canManageRoles: false,
      canManageEmployees: false,
      canViewForms: true,
      canManageForms: true,
      canViewBinders: true,
      canManageBinders: false,
    },
  },
  {
    id: "role-worker",
    name: "Empleado",
    color: "#10b981",
    permissions: {
      canViewCentral: false,
      canEditCentral: false,
      canViewLogistics: false,
      canEditLogistics: false,
      canViewProjects: false,
      canViewOnlyAssignedProjects: false,
      canEditProjects: false,
      canViewSchedule: true,
      canWriteSchedule: false,
      canViewBlueprints: false,
      canAnnotateBlueprints: false,
      canViewSettings: true,
      canEditSettings: false,
      canManageRoles: false,
      canManageEmployees: false,
      canViewForms: false,
      canManageForms: false,
      canViewBinders: true,
      canManageBinders: false,
    },
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-logistic",
    name: "Logística",
    color: "#2563eb",
    createdAt: new Date().toISOString(),
    permissions: {
      canViewCentral: false,
      canEditCentral: false,
      canViewLogistics: true,
      canEditLogistics: true,
      canViewProjects: false,
      canViewOnlyAssignedProjects: false,
      canEditProjects: false,
      canViewSchedule: true,
      canWriteSchedule: false,
      canViewBlueprints: false,
      canAnnotateBlueprints: false,
      canViewSettings: true,
      canEditSettings: false,
      canManageRoles: false,
      canManageEmployees: false,
      canViewForms: false,
      canManageForms: false,
      canViewBinders: true,
      canManageBinders: false,
    },
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
  canWriteSchedule?: boolean;
  canEditSettings?: boolean;
  canViewBinders?: boolean;
  canManageBinders?: boolean;
}

function permissionsToModule(p: RolePermissions): ModulePermissions {
  return {
    office: p.canViewCentral,
    warehouse: p.canViewLogistics,
    site: p.canViewProjects,
    worker: false,
    forms: p.canViewForms,
    canSeeOnlyAssignedProjects: p.canViewOnlyAssignedProjects,
    canAccessSchedule: p.canViewSchedule,
    canWriteSchedule: p.canWriteSchedule,
    canEditSettings: p.canEditSettings,
    canViewBinders: p.canViewBinders,
    canManageBinders: p.canManageBinders,
  };
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
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const companyId = profile?.companyId ?? null;
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);
  const [pendingOpenEmployeeId, setPendingOpenEmployeeId] = useState<string | null>(null);
  const [complianceNotifOpen, setComplianceNotifOpen] = useState(false);
  const complianceNotifRef = useRef<HTMLDivElement>(null);
  const { photos, uploadPhoto, approvePhoto, rejectPhoto } = useProjectPhotos(companyId);

  useEffect(() => {
    if (!companyId || !supabase) return;
    void supabase
      .from("audit_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setAuditLogs((data as AuditLogEntry[]) ?? []));
  }, [companyId]);
  console.log("companyId:", companyId, "photos:", photos.length);
  const pendingPhotoCountByProject = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ph of photos ?? []) {
      if (ph.status !== "pending") continue;
      if (ph.photo_type && ph.photo_type !== "obra") continue;
      m[ph.project_id] = (m[ph.project_id] ?? 0) + 1;
    }
    return m;
  }, [photos]);
  const [language, setLanguage] = useState<Language>("es");
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

  const [currency, setCurrency] = useState<Currency>("CAD");
  const [measurementSystem, setMeasurementSystem] = useState<"metric" | "imperial">("metric");
  const [companyCountry, setCompanyCountry] = useState<string>("CA");
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
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("machinpro_onboarding_complete") === "1";
    } catch {
      return false;
    }
  });
  const completeOnboarding = useCallback(() => {
    setOnboardingComplete(true);
    try {
      localStorage.setItem("machinpro_onboarding_complete", "1");
    } catch {}
  }, []);

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
  const [currentUserRole] = useState<UserRole>("admin");
  const [customRoles, setCustomRoles] = useState<CustomRole[]>(INITIAL_CUSTOM_ROLES);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>(INITIAL_SCHEDULE);
  const [clockEntries, setClockEntries] = useState<ClockEntry[]>([]);
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

  const [dailyReports, setDailyReports] = useState<DailyFieldReport[]>(() => {
    try {
      const raw = localStorage.getItem("machinpro_daily_reports");
      return raw ? (JSON.parse(raw) as DailyFieldReport[]) : [];
    } catch {
      return [];
    }
  });

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

  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    const checkWidth = () => setSidebarCollapsed(typeof window !== "undefined" && window.innerWidth < 1024);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  useEffect(() => {
    if (profile?.companyName && !companyName) setCompanyName(profile.companyName);
  }, [profile?.companyName]);

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

  // Efecto 2: aplicar clase y guardar cuando cambia
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("machinpro_dark_mode", darkMode ? "1" : "0");
    } catch {}
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
      localStorage.setItem("machinpro_daily_reports", JSON.stringify(dailyReports));
    } catch {}
  }, [dailyReports]);

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
  const [projectFormSpent, setProjectFormSpent] = useState("");
  const [projectFormStart, setProjectFormStart] = useState("");
  const [projectFormEnd, setProjectFormEnd] = useState("");
  const [projectFormLat, setProjectFormLat] = useState("");
  const [projectFormLng, setProjectFormLng] = useState("");

  const countryConfig = useMemo(() => getCountryConfig(companyCountry), [companyCountry]);
  const activeCustomRole =
    customRoles.find((r) => r.id === `role-${effectiveRole}`) ?? customRoles[0];
  const rolePerms = activeCustomRole.permissions;
  const perms = permissionsToModule(rolePerms);

  const currentUserEmployeeId = effectiveRole === "worker" ? effectiveEmployeeId : effectiveRole === "supervisor" ? effectiveEmployeeId : null;
  const visibleProjects = rolePerms.canViewOnlyAssignedProjects
    ? (projects ?? []).filter((p) =>
        (p.assignedEmployeeIds ?? []).includes(effectiveEmployeeId ?? "")
      )
    : projects ?? [];

  const handleClockIn = useCallback(() => {
    const code = clockInProjectCode.trim().toUpperCase();
    const matchedProject = code
      ? (projects ?? []).find((p) => (p.projectCode ?? "").toUpperCase() === code)
      : undefined;

    const emp = (employees ?? []).find((e) => e.id === currentUserEmployeeId);
    const hasPendingCerts = emp?.certificates?.some(
      (c) => c.status === "expired" || (c.expiryDate != null && new Date(c.expiryDate) < new Date())
    ) ?? false;

    const createEntry = (lat?: number, lng?: number, alert?: boolean, alertMeters?: number) => {
      const entry: ClockEntry = {
        id: `ce${Date.now()}`,
        employeeId: currentUserEmployeeId ?? "",
        projectId: matchedProject?.id,
        projectCode: code || undefined,
        date: new Date().toISOString().split("T")[0],
        clockIn: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        locationLat: lat,
        locationLng: lng,
        locationAlert: alert ?? false,
        locationAlertMeters: alertMeters,
        hadPendingCerts: hasPendingCerts || undefined,
      };
      setClockEntries((prev) => [...prev, entry]);
      setClockInProjectCode("");
      setClockInGpsStatus("ok");
    };

    setClockInGpsStatus("locating");
    setClockInAlertMessage(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      createEntry(undefined, undefined, false);
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
        createEntry(latitude, longitude, alert, distMeters);
        if (alert && distMeters != null) {
          setClockInGpsStatus("alert");
          const msg = (t as Record<string, string>).outsideZoneAlert ?? "Estás a {n}m del proyecto. El fichaje quedará registrado como fuera de zona.";
          setClockInAlertMessage(msg.replace("{n}", String(Math.round(distMeters))));
        }
      },
      () => {
        createEntry(undefined, undefined, false);
        setClockInGpsStatus("no_gps");
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [clockInProjectCode, projects, currentUserEmployeeId, employees, t]);

  const handleClockOut = useCallback(() => {
    const todayYmd = new Date().toISOString().split("T")[0];
    const openEntry = (clockEntries ?? []).find(
      (e) =>
        e.employeeId === (currentUserEmployeeId ?? "") &&
        e.date === todayYmd &&
        !e.clockOut
    );
    if (!openEntry) return;

    const applyClockOut = (lat?: number, lng?: number) => {
      setClockEntries((prev) =>
        prev.map((e) =>
          e.id === openEntry.id
            ? {
                ...e,
                clockOut: new Date().toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
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
  }, [clockEntries, currentUserEmployeeId]);

  const handleAddScheduleEntry = (entry: Omit<ScheduleEntry, "id">) => {
    setScheduleEntries((prev) => [...prev, { ...entry, id: `se${Date.now()}` }]);
  };

  const handleDeleteScheduleEntry = (id: string) => {
    setScheduleEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUpdateScheduleEntry = (id: string, entry: Omit<ScheduleEntry, "id">) => {
    setScheduleEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...entry, id } : e))
    );
  };

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
    schedule: t.schedule,
    forms: (t as Record<string, string>).forms ?? "Formularios",
    binders: (t as Record<string, string>).binders ?? "Documentos",
    settings: t.settings,
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

  const logisticsEmployees: LogisticsEmployee[] = (employees ?? []).map((e) => ({
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

  const siteEmployees: ProjectEmployee[] = (employees ?? []).map((e) => ({
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
      const defaultRole = customRoles.find((r) => r.id === "role-worker");
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
    setProjectFormSpent(String(p?.spentCAD ?? ""));
    setProjectFormStart(p?.estimatedStart ?? "");
    setProjectFormEnd(p?.estimatedEnd ?? "");
    setProjectFormLat(String(p?.locationLat ?? ""));
    setProjectFormLng(String(p?.locationLng ?? ""));
    setProjectFormOpen(true);
  }
  function closeProjectForm() {
    setProjectFormOpen(false);
    setEditingProjectId(null);
  }
  function saveProjectForm() {
    const name = projectFormName.trim() || (editingProjectId ? projects.find((p) => p.id === editingProjectId)?.name : null) || "Nuevo proyecto";
    const payload = {
      name,
      projectCode: projectFormCode.trim().toUpperCase() || undefined,
      type: projectFormType,
      location: projectFormLocation.trim(),
      budgetCAD: parseFloat(projectFormBudget) || 0,
      spentCAD: parseFloat(projectFormSpent) || 0,
      estimatedStart: projectFormStart || new Date().toISOString().slice(0, 10),
      estimatedEnd: projectFormEnd || new Date().toISOString().slice(0, 10),
      locationLat: parseFloat(projectFormLat) || undefined,
      locationLng: parseFloat(projectFormLng) || undefined,
      archived: false,
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-amber-500 text-sm animate-pulse">
          Cargando…
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden">
      {user && effectiveRole === "admin" && !onboardingComplete && (
        <OnboardingModal
          onComplete={completeOnboarding}
          onGoToSettings={() => {
            completeOnboarding();
            setActiveSection("settings");
          }}
          labels={t}
          companyName={companyName}
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
          canAccessForms={perms.forms ?? false}
          canAccessBinders={perms.canViewBinders ?? false}
          labels={labels}
          collapsed={sidebarCollapsed}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden p-4 md:p-6 lg:p-8 min-h-screen pb-20 sm:pb-8">
          <header className="mb-6 sm:mb-8 border-b border-gray-200 dark:border-gray-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0 flex items-center">
              <div className="flex flex-col">
                {(companyName || profile?.companyName) ? (
                  <span className="text-lg font-bold text-zinc-900 dark:text-white leading-tight">
                    {companyName || profile?.companyName}
                  </span>
                ) : (
                  <span className="text-lg font-bold tracking-tight">
                    <span className="text-amber-500">Machin</span>
                    <span className="text-zinc-900 dark:text-white">Pro</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
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
                      className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
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
              <div className="hidden lg:block">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1 text-sm"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1 text-xs"
              >
                {darkMode ? "☾ " + (t.darkMode ?? "Oscuro") : "☀ " + (t.darkMode ?? "Oscuro")}
              </button>
              {user && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-500 hidden sm:block">
                    Machin<span className="text-zinc-500">Pro</span>
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
                    {profile?.role ?? ""}
                  </span>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px] transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:block">Salir</span>
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className="max-w-7xl mx-auto space-y-6 min-w-0 w-full">
            {activeSection === "office" && perms.office && (
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
                canEdit={rolePerms.canEditCentral}
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
                onAddRole={(role) => setCustomRoles((prev) => [...prev, role])}
                onUpdateRole={(role) => setCustomRoles((prev) => prev.map((r) => (r.id === role.id ? role : r)))}
                onDeleteRole={(id) => {
                  const baseIds = ["role-admin", "role-supervisor", "role-worker", "role-logistic"];
                  if (!baseIds.includes(id)) setCustomRoles((prev) => prev.filter((r) => r.id !== id));
                }}
                clockEntries={clockEntries}
                formInstances={formInstances}
                language={language}
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
              />
            )}

            {activeSection === "warehouse" && perms.warehouse && (
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
                vehicleInspectionLabel={countryConfig.vehicleInspectionLabel}
                complianceFields={complianceFields}
                complianceRecords={complianceRecords}
                onComplianceRecordsChange={setComplianceRecords}
                onAddInventory={() => { setNewItemFormOpen(true); }}
                onEditInventory={(item) => {
                  setEditingInventoryId(item.id);
                  setEditInventoryDraft({ name: item.name, type: item.type, quantity: item.quantity, unit: item.unit, purchasePriceCAD: item.purchasePriceCAD, assignedToProjectId: item.assignedToProjectId, assignedToEmployeeId: item.assignedToEmployeeId });
                }}
                onDeleteInventory={(id) => {
                  if (typeof window !== "undefined" && window.confirm("¿Eliminar este ítem?")) {
                    setInventoryItems((prev) => {
                      const next = prev.filter((i) => i.id !== id);
                      try { localStorage.setItem("machinpro_inventory", JSON.stringify(next)); } catch {}
                      return next;
                    });
                  }
                }}
                onAddFleet={() => { setVehicleFormOpen(true); setEditingVehicleId(null); setVehicleDraft({}); }}
                onEditFleet={(v) => { setEditingVehicleId(v.id); setVehicleDraft({ ...v }); setVehicleFormOpen(true); }}
                onDeleteFleet={(id) => { if (typeof window !== "undefined" && window.confirm("¿Eliminar vehículo?")) setVehicles((prev) => prev.filter((v) => v.id !== id)); }}
                onAddRental={() => { setRentalFormOpen(true); setEditingRentalId(null); setRentalDraft({}); }}
                onEditRental={(r) => { setEditingRentalId(r.id); setRentalDraft({ ...r }); setRentalFormOpen(true); }}
                onDeleteRental={(id) => { if (typeof window !== "undefined" && window.confirm("¿Eliminar alquiler?")) setRentals((prev) => prev.filter((r) => r.id !== id)); }}
                onAddSupplier={() => { setSupplierFormOpen(true); setEditingSupplierId(null); setSupplierDraft({}); }}
                onEditSupplier={(s) => { setEditingSupplierId(s.id); setSupplierDraft({ ...s }); setSupplierFormOpen(true); }}
                onDeleteSupplier={(id) => { if (typeof window !== "undefined" && window.confirm("¿Eliminar proveedor?")) setSuppliers((prev) => prev.filter((s) => s.id !== id)); }}
                canEdit={rolePerms.canEditLogistics}
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
              />
            )}

            {activeSection === "site" && perms.site && (
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
                currentUserRole={currentUserRole}
                onApproveDiaryEntry={async (id) => {
                  await approvePhoto(id, effectiveEmployeeId ?? "admin");
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
                  await rejectPhoto(id, notes);
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
                  setProjects((prev) =>
                    prev.map((p) =>
                      p.id === projectId ? { ...p, assignedEmployeeIds: employeeIds } : p
                    )
                  );
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
                companyPlan="starter"
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
                canAnnotateBlueprints={rolePerms.canAnnotateBlueprints}
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
                countryCode={subcontractorCountryCode ?? "CA"}
                dailyReports={dailyReports}
                onSaveDailyReport={(report) => {
                  setDailyReports((prev) => {
                    const exists = prev.find((r) => r.id === report.id);
                    if (exists) return prev.map((r) => (r.id === report.id ? report : r));
                    return [...prev, report];
                  });
                }}
                companyId={companyId ?? ""}
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

            {activeSection === "schedule" && (perms.canAccessSchedule !== false) && (
              <ScheduleModule
                entries={scheduleEntries}
                employees={employees.map((e) => ({ id: e.id, name: e.name, role: e.role }))}
                projects={projects.map((p) => ({
                  id: p.id,
                  name: p.name,
                  projectCode: p.projectCode,
                  locationLat: p.locationLat,
                  locationLng: p.locationLng,
                  location: p.location,
                }))}
                currentUserEmployeeId={currentUserEmployeeId ?? undefined}
                canWrite={perms.canWriteSchedule ?? false}
                canClockIn={effectiveRole !== "admin"}
                viewAll={effectiveRole === "admin" || effectiveRole === "supervisor"}
                labels={{
                  schedule: t.schedule ?? "Horario",
                  shift: (t as Record<string, string>).shift ?? "Turno",
                  event: (t as Record<string, string>).event ?? "Evento",
                  addEntry: (t as Record<string, string>).addEntry ?? "Añadir turno",
                  noEntries: (t as Record<string, string>).noEntries ?? "Sin entradas",
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
                }}
                onAddEntry={handleAddScheduleEntry}
                onUpdateEntry={handleUpdateScheduleEntry}
                onDeleteEntry={handleDeleteScheduleEntry}
                clockEntries={clockEntries}
                clockInProjectCode={clockInProjectCode}
                setClockInProjectCode={setClockInProjectCode}
                gpsStatus={clockInGpsStatus}
                clockInAlertMessage={clockInAlertMessage}
                onDismissClockInAlert={() => setClockInAlertMessage(null)}
                onClockIn={handleClockIn}
                onClockOut={handleClockOut}
              />
            )}

            {activeSection === "binders" && (perms.canViewBinders !== false) && (
              <BindersModule
                binders={binders}
                documents={binderDocuments}
                canManage={perms.canManageBinders ?? false}
                currentUserRole={effectiveRole}
                employees={employees.map((e) => ({ id: e.id, name: e.name }))}
                roleOptions={customRoles.map((r) => ({ id: r.id, name: r.name }))}
                labels={t as Record<string, string>}
                onAddBinder={(b) => setBinders((prev) => [...prev, b])}
                onDeleteBinder={(id) =>
                  setBinders((prev) =>
                    prev.filter((b) => b.id !== id || b.isDefault)
                  )}
                onAddDocument={(d) =>
                  setBinderDocuments((prev) => [...prev, d])}
                onDeleteDocument={(id) =>
                  setBinderDocuments((prev) =>
                    prev.filter((d) => d.id !== id)
                  )}
              />
            )}

            {activeSection === "forms" && (perms.forms !== false) && (
              <FormsModule
                templates={formTemplates}
                instances={formInstances}
                projects={visibleProjects.map((p) => ({
                  id: p.id,
                  name: p.name,
                  assignedEmployeeIds: p.assignedEmployeeIds,
                }))}
                employees={employees.map((e) => ({ id: e.id, name: e.name, email: e.email }))}
                currentUserEmployeeId={effectiveEmployeeId ?? ""}
                currentUserName={employees.find((e) => e.id === effectiveEmployeeId)?.name ?? "Admin"}
                canManage={rolePerms.canManageForms ?? false}
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
            )}

            {activeSection === "settings" && (
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
                }}
                language={language}
                setLanguage={(lang) => setLanguage(lang)}
                currency={currency}
                setCurrency={(c) => setCurrency(c as Currency)}
                measurementSystem={measurementSystem}
                setMeasurementSystem={setMeasurementSystem}
                canEditSettings={rolePerms.canEditSettings}
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
              />
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
              {editingProjectId ? (t.edit ?? "Editar") : (t.addNew ?? "Añadir")} proyecto
            </h3>
            <div className="space-y-3">

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Nombre *
                </label>
                <input type="text" value={projectFormName}
                  onChange={(e) => setProjectFormName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Código de proyecto
                </label>
                <input type="text" value={projectFormCode}
                  onChange={(e) => setProjectFormCode(e.target.value.toUpperCase())}
                  placeholder="MON-01" maxLength={10}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono tracking-wider text-zinc-900 dark:text-zinc-100 uppercase" />
                <p className="text-xs text-zinc-400 mt-1">
                  El trabajador usa este código para fichar en esta obra
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Tipo de proyecto
                </label>
                <select value={projectFormType}
                  onChange={(e) => setProjectFormType(e.target.value as ProjectType)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                  <option value="residential">Residencial</option>
                  <option value="commercial">Comercial</option>
                  <option value="industrial">Industrial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Ubicación
                </label>
                <input type="text" value={projectFormLocation}
                  onChange={(e) => setProjectFormLocation(e.target.value)}
                  placeholder="Ciudad, Provincia, País"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Presupuesto total (CAD)
                  </label>
                  <input type="number" min={0} value={projectFormBudget}
                    onChange={(e) => setProjectFormBudget(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Presupuesto consumido (CAD)
                  </label>
                  <input type="number" min={0} value={projectFormSpent}
                    onChange={(e) => setProjectFormSpent(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Fecha inicio
                  </label>
                  <input type="date" value={projectFormStart}
                    onChange={(e) => setProjectFormStart(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Fecha fin
                  </label>
                  <input type="date" value={projectFormEnd}
                    onChange={(e) => setProjectFormEnd(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Coordenadas GPS (opcional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="0.000001"
                    value={projectFormLat}
                    onChange={(e) => setProjectFormLat(e.target.value)}
                    placeholder="Latitud · 45.50"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                  <input type="number" step="0.000001"
                    value={projectFormLng}
                    onChange={(e) => setProjectFormLng(e.target.value)}
                    placeholder="Longitud · -73.56"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Para verificar GPS al fichar y enlace Maps
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
    </div>
  );
}
