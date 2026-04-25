"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";
import { usePPPPricing } from "@/hooks/usePPPPricing";
import {
  Building2,
  Package,
  PackagePlus,
  MapPin,
  Users,
  UserCheck,
  Image as ImageIcon,
  Info,
  Camera,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  Calendar,
  DollarSign,
  Boxes,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  X,
  FileText,
  Truck,
  ClipboardList,
  UserPlus,
  Plus,
  Trash2,
  FileDown,
  List,
  LayoutGrid,
  Map as MapViewIcon,
  HardHat,
  Circle,
  FileQuestion,
  ChevronUp,
  ChevronDown,
  Download,
  Shield,
  Factory,
  Loader2,
} from "lucide-react";
import type { ProjectPhoto } from "@/lib/useProjectPhotos";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import { EmptyIllustrationFolder, ModuleEmptyState } from "@/components/ModuleEmptyState";
import {
  generatePhotoReport,
  type PhotoReportOrientation,
  type PhotoReportPhotosPerPage,
  type PhotoReportPhotoSize,
  type PhotoReportSortBy,
} from "@/lib/generatePhotoReport";
import { generateInspectionReportPDF } from "@/lib/generateInspectionReportPDF";
import type { ToolStatus, ResourceRequest, Rental } from "@/components/LogisticsModule";
import type { Blueprint, Annotation, BlueprintRevision } from "@/types/blueprints";
import type { UserRole } from "@/types/shared";
import type { FormTemplate } from "@/types/forms";
import type { SafetyChecklist, SafetyChecklistItem, SafetyChecklistResponse } from "@/types/safetyChecklist";
import type { DailyFieldReport } from "@/types/dailyFieldReport";
import { CURRENCY_BY_TIER } from "@/lib/stripe";
import type { ProjectTask, TaskPriority } from "@/types/projectTask";
import type { ProjectExpenseCategory, ProjectExpenseRow } from "@/types/homePage";
import { ALL_TRANSLATIONS, type Currency } from "@/lib/i18n";
import {
  dateLocaleForUser,
  resolveUserTimezone,
  formatDate as formatDateIntl,
  formatDateTime as formatDateTimeIntl,
  formatCalendarYmd,
  formatCurrency,
} from "@/lib/dateUtils";
import { cloudinaryFull, cloudinaryThumb } from "@/lib/cloudinaryUrl";
import { resolveFormLabel } from "@/lib/formTemplateDisplay";
import {
  filterFormTemplatesByProjectCategory,
  PROJECT_FORM_BLANK_TEMPLATE_ID,
} from "@/lib/projectFormTemplateCategories";
import { generateSafetyChecklistPdf } from "@/lib/generateSafetyChecklistReport";
import { formatReportDate } from "@/lib/dailyReportFormat";
import type { ProjectLaborSummary } from "@/lib/laborCosting";
import { VisitorModule } from "@/components/VisitorModule";
import { useToast } from "@/components/Toast";
import { userFacingErrorMessage } from "@/lib/userFacingError";
import { supabase } from "@/lib/supabase";
import {
  type CatalogItem,
  type ProjectTaskOverride,
  type ProductionReport,
  effectivePrices,
} from "@/lib/productionCatalog";
import {
  generateInvoicePdf,
  nextMachinProInvoiceNumber,
  peekMachinProInvoiceNumber,
  defaultInvoiceTaxPercent,
} from "@/lib/generateInvoicePdf";
import { generateBenefitReportPdf } from "@/lib/generateBenefitReportPdf";
import {
  formatTodayYmdInTimeZone,
  zonedYmdHmToUtcIso,
} from "@/lib/dateUtils";
import {
  parseSafetyRequirementsJson,
  findCertForRequirement,
  defaultProjectSafetyRequirements,
  type ProjectSafetyRequirementRow,
} from "@/lib/projectSafetyUtils";
import {
  downloadImageUrlAsFile,
  galleryPhotoFilename,
  galleryBulkZipFilename,
  buildGalleryPhotosZip,
  triggerBlobDownload,
  formatGalleryDownloadProgress,
} from "@/lib/galleryPhotoDownload";

const PM_EN = ALL_TRANSLATIONS.en as Record<string, string>;
const TeamGpsMapWidget = dynamic(
  () => import("@/components/TeamGpsMapWidget").then((m) => m.TeamGpsMapWidget),
  { ssr: false }
);
const ProjectsMapDynamic = dynamic(
  () => import("@/components/maps/ProjectsMapDynamic").then((m) => ({ default: m.ProjectsMapDynamic })),
  { ssr: false }
);

const tabHeavyFallback = () => (
  <div className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
);

const BlueprintViewer = dynamic(() => import("@/components/BlueprintViewer"), {
  ssr: false,
  loading: tabHeavyFallback,
});

const RFIModule = dynamic(
  () => import("@/components/RFIModule").then((m) => ({ default: m.RFIModule })),
  { ssr: false, loading: tabHeavyFallback }
);

const ProjectWorkOrdersPanel = dynamic(
  () => import("@/components/ProjectWorkOrdersPanel").then((m) => ({ default: m.ProjectWorkOrdersPanel })),
  { ssr: false, loading: tabHeavyFallback }
);

const ProjectSecurityTab = dynamic(
  () => import("@/components/ProjectSecurityTab").then((m) => ({ default: m.ProjectSecurityTab })),
  { ssr: false, loading: tabHeavyFallback }
);

const ProjectEpiSafetyTab = dynamic(
  () => import("@/components/ProjectEpiSafetyTab").then((m) => ({ default: m.ProjectEpiSafetyTab })),
  { ssr: false, loading: tabHeavyFallback }
);

const DailyFieldReportView = dynamic(
  () => import("@/components/DailyFieldReportView").then((m) => ({ default: m.DailyFieldReportView })),
  { ssr: false, loading: tabHeavyFallback }
);

const ProjectTimeclockSection = dynamic(
  () => import("@/components/ProjectTimeclockSection").then((m) => ({ default: m.ProjectTimeclockSection })),
  { ssr: false, loading: tabHeavyFallback }
);

export type { SafetyChecklist, SafetyChecklistItem, SafetyChecklistResponse } from "@/types/safetyChecklist";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type PhotoType = "obra" | "inventario";

export type { ProjectExpenseCategory, ProjectExpenseRow };

export interface ProjectEmployee {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  certificates: { id: string; name: string; status: string; expiryDate?: string }[];
}

export interface ProjectInventoryItem {
  id: string;
  name: string;
  type: "material" | "tool" | "consumable" | "equipment";
  quantity: number;
  unit: string;
  toolStatus?: ToolStatus;
  assignedToEmployeeId?: string;
  assignedToProjectId?: string;
  imageUrl?: string;
}

export type PhotoCategory = "progress" | "incident" | "health_safety";

export interface ProjectDiaryEntry {
  id: string;
  projectId: string;
  date: string;
  photoUrls: string[];
  notes: string;
  createdAt: string;
  photoType?: PhotoType;
  photoCategory?: PhotoCategory;
  status?: "pending" | "approved" | "accepted" | "rejected" | "inspection";
  submittedByEmployeeId?: string;
  submittedByName?: string;
  projectName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
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
  supervisorName?: string;
  safetyRequirements?: unknown;
  locationLat?: number;
  locationLng?: number;
  archived?: boolean;
  lifecycleStatus?: "active" | "paused" | "completed";
}

export type ProjectForm = {
  id: string;
  projectId: string;
  title: string;
  type: "inspection" | "tailgate" | "safety" | "custom";
  status: "draft" | "active" | "completed";
  createdBy: string;
  createdAt: string;
  fields: {
    id: string;
    label: string;
    type: "text" | "photo" | "signature" | "checkbox" | "select";
    required: boolean;
    options?: string[];
  }[];
  responses: {
    employeeId: string;
    employeeName: string;
    signedAt: string;
    answers: Record<string, string>;
  }[];
  qrCode?: string;
  /** When type is "safety", links to persisted {@link SafetyChecklist}. */
  safetyChecklistId?: string;
};

export interface ProjectsModuleProps {
  labels: Record<string, string>;
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onPhotoObra: (
    projectId: string,
    photoCategory?: PhotoCategory,
    uploadedUrl?: string
  ) => void;
  onPhotoInventario: (projectId: string) => void;
  photoNotes: string;
  setPhotoNotes: (v: string) => void;
  allEmployees?: ProjectEmployee[];
  inventoryItems?: ProjectInventoryItem[];
  diaryEntries?: ProjectDiaryEntry[];
  currentUserRole?: UserRole;
  onApproveDiaryEntry?: (entryId: string) => void;
  onRejectDiaryEntry?: (entryId: string, reason?: string) => void;
  onUpdateProjectEmployees?: (projectId: string, employeeIds: string[]) => void;
  onUpdateItemProject?: (itemId: string, projectId: string | null) => void;
  onReturnToolFromProject?: (toolId: string) => void;
  blueprints?: Blueprint[];
  currentUserEmployeeId?: string;
  currentUserName?: string;
  onAddBlueprint?: (bp: Blueprint) => void;
  onUpdateAnnotations?: (blueprintId: string, annotations: Annotation[]) => void;
  onAddRevision?: (blueprintId: string, revision: BlueprintRevision) => void;
  onMarkBlueprintNotCurrent?: (blueprintId: string) => void;
  canEdit?: boolean;
  /** Añadir/quitar personal asignado al proyecto. Si no se pasa, se usa `canEdit` (legacy). */
  canManageProjectTeam?: boolean;
  canAnnotateBlueprints?: boolean;
  cloudName?: string;
  onOpenResourceRequest?: (projectId: string) => void;
  resourceRequests?: ResourceRequest[];
  onConfirmReception?: (requestId: string) => void;
  companyPlan?: string;
  projectForms?: ProjectForm[];
  onDeleteForm?: (formId: string) => void;
  /** MachinPro form templates (Operaciones → proyecto → Formularios). */
  formTemplates?: FormTemplate[];
  /** Creates a {@link FormInstance} and should open the Forms module fill flow. */
  onStartFormFromMachinTemplate?: (payload: { templateId: string; projectId: string }) => void;
  companyName?: string;
  companyLogoUrl?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  projectPhotos?: ProjectPhoto[];
  language?: string;
  /** Display name for PDF "Generated by" and reports. */
  currentUserDisplayName?: string;
  safetyChecklists?: SafetyChecklist[];
  onSaveChecklist?: (checklist: SafetyChecklist) => void;
  countryCode?: string;
  dailyReports?: DailyFieldReport[];
  onRefreshDailyReports?: () => void | Promise<void>;
  onDailyReportPublished?: (report: DailyFieldReport) => void;
  /** IANA; fechas de galería, parte diario y proyecto */
  timeZone?: string;
  /** Bearer para APIs work_order_items (AH-43C). */
  authAccessToken?: string | null;
  companyCurrency?: Currency;
  /** AH-17: labor hours/cost per project (from time entries). */
  projectLaborSummaries?: Record<string, ProjectLaborSummary>;
  canViewProjectLaborCosts?: boolean;
  teamProfiles?: { id: string; employeeId: string | null; name: string }[];
  /** Admin/supervisor o permiso canManageDailyReports */
  canManageDailyReports?: boolean;
  companyId?: string;
  /** Perfil Supabase (user_profiles.id) para planos / pines. */
  currentUserProfileId?: string | null;
  onOpenHazardFromBlueprint?: (hazardId: string) => void;
  onOpenCorrectiveFromBlueprint?: (correctiveActionId: string) => void;
  projectTasks?: ProjectTask[];
  onCreateTask?: (task: Omit<ProjectTask, "id" | "createdAt">) => void;
  onUpdateTask?: (taskId: string, updates: Partial<ProjectTask>) => void;
  onDeleteTask?: (taskId: string) => void;
  /** Sprint AV: GPS timeclock + attendance */
  canViewAttendancePanel?: boolean;
  canUseProjectTimeclock?: boolean;
  /** AH-20: respect user preference for periodic GPS on project timeclock. */
  shiftLocationSharingEnabled?: boolean;
  /** Desde Central: abrir pestaña Visitantes + modal QR */
  visitorOpenQrSignal?: number;
  /** Solo cambiar a la pestaña (p. ej. alerta visita larga), sin abrir modal QR */
  visitorTabSignal?: number;
  showProjectVisitorsTab?: boolean;
  /** Desde Central: abrir pestaña RFI del proyecto seleccionado */
  openRfiTabSignal?: number;
  showProjectRfiTab?: boolean;
  /** AH-21: pestaña Seguridad (riesgos + acciones en el proyecto). */
  showProjectSecurityTab?: boolean;
  showProjectGeneralTab?: boolean;
  showProjectTeamTab?: boolean;
  showProjectInventoryTab?: boolean;
  showProjectGalleryTab?: boolean;
  showProjectBlueprintsTab?: boolean;
  showProjectFormsTab?: boolean;
  /** Pestaña mapa / asistencia (canViewAttendance). */
  showProjectMapTab?: boolean;
  /** EPI / seguridad en obra (canViewSecurity). */
  showProjectEpiTab?: boolean;
  /** Costes de obra (gastos manuales + resumen vs presupuesto). */
  showProjectCostsTab?: boolean;
  projectExpenses?: ProjectExpenseRow[];
  canManageProjectCosts?: boolean;
  canExportProjectCosts?: boolean;
  onAddProjectExpense?: (row: {
    projectId: string;
    name: string;
    amount: number;
    currency: string;
    category: ProjectExpenseCategory;
    expenseDate: string;
    notes: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  onDeleteProjectExpense?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  projectsSecurityTabSignal?: number;
  projectSecurityCompanyId?: string | null;
  projectSecurityCompanyName?: string;
  projectSecurityUserRole?: UserRole;
  projectSecurityUserName?: string;
  projectSecurityUserProfileId?: string | null;
  projectSecurityFocusHazardId?: string | null;
  onProjectSecurityFocusHazardConsumed?: () => void;
  projectSecurityCorrectivePrefill?: import("@/components/CorrectiveActionsModule").CorrectiveActionsPrefill | null;
  onProjectSecurityConsumeCorrectivePrefill?: () => void;
  projectSecurityOpenHazardSignal?: number;
  projectSecurityOpenActionSignal?: number;
  onProjectSecuritySetCorrectivePrefill?: (
    p: import("@/components/CorrectiveActionsModule").CorrectiveActionsPrefill | null
  ) => void;
  onProjectSecurityRequestFocusHazard?: (id: string) => void;
  onProjectSecurityInteraction?: () => void;
  projectSecurityCanShowHazards?: boolean;
  projectSecurityCanShowActions?: boolean;
  projectSecurityCanManageHazards?: boolean;
  projectSecurityCanManageCorrectiveActions?: boolean;
  projectSecurityDateLocale?: string;
  projectSecurityTimeZone?: string;
  /** Informe PDF de inspección (galería → Inspección). */
  canManageProjectGallery?: boolean;
  onInspectionReportGenerated?: (payload: {
    projectId: string;
    projectName: string;
    photoCount: number;
    reportTitle: string;
  }) => void;
  /** Descarga de fotos aprobadas / inspección (fetch + blob). */
  canUploadPhotos?: boolean;
  onGalleryPhotoDownloaded?: (payload: {
    photoId: string;
    projectId: string;
    projectName: string;
  }) => void;
  onGalleryPhotosBulkDownloaded?: (payload: {
    projectId: string;
    projectName: string;
    count: number;
  }) => void;
  /** Desde el centro de notificaciones: abrir parte diario en el proyecto. */
  focusDailyReportNav?: { projectId: string; reportId: string; sig: number } | null;
  onConsumeDailyReportNav?: () => void;
  /** EPI / certificados por obra (JSON en Supabase). */
  onUpdateProjectSafetyRequirements?: (projectId: string, rows: ProjectSafetyRequirementRow[]) => void;
  /** Nombres de proyecto para leyendas en mapa GPS. */
  projectNameByIdForGps?: Record<string, string>;
  /** Crear instancia desde plantilla MachinPro (pestaña Formularios del proyecto). */
  canCreateMachinFormFromProject?: boolean;
  /** Eliminar entradas de la lista de formularios del proyecto. */
  canDeleteProjectFormEntry?: boolean;
  productionCatalogItems?: CatalogItem[];
  projectTaskOverrides?: ProjectTaskOverride[];
  canViewWorkOrders?: boolean;
  canManageWorkOrders?: boolean;
  /** Parte diario: sección producción (payType o permiso). */
  showProductionInDailyReport?: boolean;
  onRefreshProductionData?: () => void;
  /** Producción global (filtrado por proyecto en Costes). */
  productionReports?: ProductionReport[];
  rentals?: Rental[];
  /** Operaciones: abrir formulario nuevo proyecto (Central usa el mismo flujo). */
  canCreateProjects?: boolean;
  onOpenNewProject?: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

type CertState = "al_dia" | "pendiente" | "sin_certs";

function getCertState(certs: ProjectEmployee["certificates"]): CertState {
  if (!certs.length) return "sin_certs";
  const today = new Date().toISOString().slice(0, 10);
  const hasExpired = certs.some((c) => c.expiryDate && c.expiryDate < today);
  return hasExpired ? "pendiente" : "al_dia";
}

function formatBudget(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

function daysLeft(dateStr: string): number {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

function todayYmdLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Sub-componentes ────────────────────────────────────────────────────────────

function SecurityBadge({ state, labels }: { state: CertState; labels: Record<string, string> }) {
  const t = labels;
  if (state === "al_dia")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="h-3 w-3" />{t.securityOk ?? PM_EN.securityOk}
      </span>
    );
  if (state === "pendiente")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <ShieldAlert className="h-3 w-3" />{t.securityPending ?? PM_EN.securityPending}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
      <ShieldOff className="h-3 w-3" />{t.securityNoCerts ?? PM_EN.securityNoCerts}
    </span>
  );
}

function getCategoryLabel(cat: string, tl: Record<string, string>): string {
  if (cat === "progress") return tl.photoProgress ?? PM_EN.photoProgress;
  if (cat === "incident") return tl.photoIncident ?? PM_EN.photoIncident;
  if (cat === "health_safety") return tl.photoHealthSafety ?? PM_EN.photoHealthSafety;
  return cat;
}

function isGalleryDownloadableStatus(status?: string): boolean {
  return status === "approved" || status === "accepted" || status === "inspection";
}

function PhotoStatusBadge({ status, labels }: { status?: string; labels: Record<string, string> }) {
  const t = labels;
  if (status === "approved" || status === "accepted")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />{t.photoStatusApproved ?? PM_EN.photoStatusApproved}
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
        <XCircle className="h-3 w-3" />{t.photoStatusRejected ?? PM_EN.photoStatusRejected}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
      <Clock className="h-3 w-3" />{t.photoStatusPending ?? PM_EN.photoStatusPending}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 dark:border-slate-700/60 bg-zinc-50 dark:bg-slate-800/40 px-4 py-3">
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-zinc-300 dark:text-zinc-600">
      {icon}
      <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center">{text}</p>
    </div>
  );
}

// ─── Definición de tabs ────────────────────────────────────────────────────────

type TabId =
  | "general"
  | "personal"
  | "inventario"
  | "galeria"
  | "blueprints"
  | "formularios"
  | "visitantes"
  | "rfi"
  | "seguridad"
  | "project_epi"
  | "costes"
  | "work_order"
  | "mapa";

function projectToolStatusLabel(
  status: ToolStatus | undefined,
  lx: Record<string, string>
): string {
  const s = status ?? "available";
  if (s === "available") return lx.available ?? PM_EN.available;
  if (s === "in_use") return lx.inUse ?? PM_EN.inUse;
  if (s === "maintenance") return lx.maintenance ?? PM_EN.maintenance;
  if (s === "out_of_service") return lx.outOfService ?? PM_EN.outOfService;
  if (s === "lost") return lx.lost ?? PM_EN.lost;
  return lx.available ?? PM_EN.available;
}

const TABS: { id: TabId; icon: React.ReactNode }[] = [
  { id: "general", icon: <Info className="h-4 w-4" /> },
  { id: "personal", icon: <Users className="h-4 w-4" /> },
  { id: "inventario", icon: <Boxes className="h-4 w-4" /> },
  { id: "galeria", icon: <ImageIcon className="h-4 w-4" /> },
  { id: "blueprints", icon: <FileText className="h-4 w-4" /> },
  { id: "formularios", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "visitantes", icon: <UserCheck className="h-4 w-4" /> },
  { id: "rfi", icon: <FileQuestion className="h-4 w-4" /> },
  { id: "seguridad", icon: <Shield className="h-4 w-4" /> },
  { id: "project_epi", icon: <HardHat className="h-4 w-4" /> },
  { id: "costes", icon: <DollarSign className="h-4 w-4" /> },
  { id: "work_order", icon: <Factory className="h-4 w-4" /> },
  { id: "mapa", icon: <MapPin className="h-4 w-4" /> },
];

// ─── Componente principal ──────────────────────────────────────────────────────

export function ProjectsModule({
  labels: t,
  projects = [],
  selectedProjectId,
  onSelectProject,
  onPhotoObra,
  onPhotoInventario,
  photoNotes,
  setPhotoNotes,
  allEmployees = [],
  inventoryItems = [],
  diaryEntries = [],
  currentUserRole = "admin",
  onApproveDiaryEntry,
  onRejectDiaryEntry,
  onUpdateProjectEmployees,
  onUpdateItemProject,
  onReturnToolFromProject,
  blueprints,
  currentUserEmployeeId,
  currentUserName,
  onAddBlueprint,
  onUpdateAnnotations,
  onAddRevision,
  onMarkBlueprintNotCurrent,
  canEdit: canEditProp,
  canManageProjectTeam: canManageProjectTeamProp,
  canAnnotateBlueprints,
  cloudName = "",
  onOpenResourceRequest,
  resourceRequests = [],
  onConfirmReception,
  companyPlan = "esencial",
  projectForms,
  onDeleteForm,
  formTemplates = [],
  onStartFormFromMachinTemplate,
  companyName = "",
  companyLogoUrl,
  companyAddress = "",
  companyPhone = "",
  companyEmail = "",
  companyWebsite = "",
  projectPhotos,
  language = "es",
  currentUserDisplayName = "",
  safetyChecklists = [],
  onSaveChecklist,
  countryCode = "CA",
  dailyReports = [],
  onRefreshDailyReports,
  onDailyReportPublished,
  timeZone: timeZoneProp,
  authAccessToken = null,
  companyCurrency = "CAD",
  projectLaborSummaries = {},
  canViewProjectLaborCosts = false,
  teamProfiles = [],
  canManageDailyReports = false,
  companyId = "",
  currentUserProfileId = null,
  onOpenHazardFromBlueprint,
  onOpenCorrectiveFromBlueprint,
  projectTasks = [],
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  canViewAttendancePanel = false,
  canUseProjectTimeclock = false,
  shiftLocationSharingEnabled = true,
  visitorOpenQrSignal = 0,
  visitorTabSignal = 0,
  showProjectVisitorsTab = true,
  openRfiTabSignal = 0,
  showProjectRfiTab = false,
  showProjectSecurityTab = false,
  showProjectGeneralTab = true,
  showProjectTeamTab = true,
  showProjectInventoryTab = true,
  showProjectGalleryTab = true,
  showProjectBlueprintsTab = true,
  showProjectFormsTab = true,
  showProjectMapTab = true,
  showProjectEpiTab = true,
  showProjectCostsTab = false,
  projectExpenses = [],
  canManageProjectCosts = false,
  canExportProjectCosts = false,
  onAddProjectExpense,
  onDeleteProjectExpense,
  projectsSecurityTabSignal = 0,
  projectSecurityCompanyId = null,
  projectSecurityCompanyName = "",
  projectSecurityUserRole = "admin",
  projectSecurityUserName = "",
  projectSecurityUserProfileId = null,
  projectSecurityFocusHazardId = null,
  onProjectSecurityFocusHazardConsumed,
  projectSecurityCorrectivePrefill = null,
  onProjectSecurityConsumeCorrectivePrefill,
  projectSecurityOpenHazardSignal = 0,
  projectSecurityOpenActionSignal = 0,
  onProjectSecuritySetCorrectivePrefill,
  onProjectSecurityRequestFocusHazard,
  onProjectSecurityInteraction,
  projectSecurityCanShowHazards = false,
  projectSecurityCanShowActions = false,
  projectSecurityCanManageHazards = false,
  projectSecurityCanManageCorrectiveActions = false,
  projectSecurityDateLocale = "es",
  projectSecurityTimeZone = "UTC",
  canManageProjectGallery = false,
  onInspectionReportGenerated,
  canUploadPhotos = false,
  onGalleryPhotoDownloaded,
  onGalleryPhotosBulkDownloaded,
  focusDailyReportNav = null,
  onConsumeDailyReportNav,
  onUpdateProjectSafetyRequirements,
  projectNameByIdForGps = {},
  canCreateMachinFormFromProject,
  canDeleteProjectFormEntry,
  productionCatalogItems = [],
  projectTaskOverrides = [],
  canViewWorkOrders = false,
  canManageWorkOrders = false,
  showProductionInDailyReport = false,
  onRefreshProductionData,
  productionReports = [],
  rentals = [],
  canCreateProjects = false,
  onOpenNewProject,
}: ProjectsModuleProps) {
  const tl = t as Record<string, string>;
  const ppp = usePPPPricing();
  const budgetCurrencyDisplay = (companyCurrency?.trim() || CURRENCY_BY_TIER[ppp.tier] || "CAD") as string;
  const projectBudgetInfoLabel = `${tl.project_budget || tl.projectFormBudgetTotal || "Total budget"} (${budgetCurrencyDisplay})`;
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [projectMapActiveCount, setProjectMapActiveCount] = useState(0);
  const lastVisitorNavSig = useRef(0);
  const lastRfiNavSig = useRef(0);
  const lastSecurityNavSig = useRef(0);
  const dailyReportFocusConsumedSig = useRef(0);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [lightbox, setLightbox] = useState<{
    src: string;
    fallback: string;
  } | null>(null);
  const [addEmployeeToProjectId, setAddEmployeeToProjectId] = useState("");
  const [addItemToProjectId, setAddItemToProjectId] = useState("");
  const [galleryCategoryFilter, setGalleryCategoryFilter] = useState<"all" | PhotoCategory>("all");
  const [photoCategoryModal, setPhotoCategoryModal] = useState<{ projectId: string } | null>(null);
  const [photoCategoryToSubmit, setPhotoCategoryToSubmit] = useState<PhotoCategory>("progress");
  const galleryPhotoInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadCategoryRef = useRef<PhotoCategory | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState<"list" | "grid">("list");
  const [pendingDetailEntry, setPendingDetailEntry] = useState<ProjectDiaryEntry | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFormType, setNewFormType] = useState<ProjectForm["type"]>("inspection");
  const [newFormTemplateId, setNewFormTemplateId] = useState<string>("");
  const [openSafetyChecklistId, setOpenSafetyChecklistId] = useState<string | null>(null);
  const [safetyDraft, setSafetyDraft] = useState<SafetyChecklist | null>(null);
  const [openDailyReportKey, setOpenDailyReportKey] = useState<string | null>(null);
  const [dailyReportViewVariant, setDailyReportViewVariant] = useState<"full" | "employee">("full");
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [taskModal, setTaskModal] = useState<null | "new" | string>(null);
  const [taskDraft, setTaskDraft] = useState<{
    title: string;
    description: string;
    priority: TaskPriority;
    assignedToEmployeeId: string;
    dueDate: string;
  }>({
    title: "",
    description: "",
    priority: "medium",
    assignedToEmployeeId: "",
    dueDate: "",
  });

  const [costFormName, setCostFormName] = useState("");
  const [costFormAmount, setCostFormAmount] = useState("");
  const [costFormCategory, setCostFormCategory] = useState<ProjectExpenseCategory>("other");
  const [costFormDate, setCostFormDate] = useState(() => todayYmdLocal());
  const [costFormNotes, setCostFormNotes] = useState("");
  const [costFormBusy, setCostFormBusy] = useState(false);
  const [costInvoiceOpen, setCostInvoiceOpen] = useState(false);
  const [costInvoiceStart, setCostInvoiceStart] = useState("");
  const [costInvoiceEnd, setCostInvoiceEnd] = useState("");
  const [costInvoiceClientName, setCostInvoiceClientName] = useState("");
  const [costInvoiceClientAddr, setCostInvoiceClientAddr] = useState("");
  const [costInvoiceClientEmail, setCostInvoiceClientEmail] = useState("");
  const [costInvoiceProjectRef, setCostInvoiceProjectRef] = useState("");
  const [costInvoiceTax, setCostInvoiceTax] = useState("");
  const [costInvoiceNotes, setCostInvoiceNotes] = useState("");
  const [costInvoiceClientFiscal, setCostInvoiceClientFiscal] = useState("");
  const [benefitOpen, setBenefitOpen] = useState(false);
  const [benefitStart, setBenefitStart] = useState("");
  const [benefitEnd, setBenefitEnd] = useState("");
  const [galleryUploadBusy, setGalleryUploadBusy] = useState(false);
  const [pdfExportBusy, setPdfExportBusy] = useState(false);
  const [safetyChecklistPdfBusy, setSafetyChecklistPdfBusy] = useState(false);
  const [rfiSummary, setRfiSummary] = useState<{ total: number; open: number; closed: number } | null>(null);
  const [generalPhotosSkeleton, setGeneralPhotosSkeleton] = useState(false);
  const [rfiSummaryLoading, setRfiSummaryLoading] = useState(false);
  const [rfiQuickCreateSig, setRfiQuickCreateSig] = useState(0);
  const [projectsBrowseView, setProjectsBrowseView] = useState<"list" | "map">("list");
  const [projectsMapDark, setProjectsMapDark] = useState(false);

  const projectExpensesForProject = useMemo(() => {
    if (!selectedProjectId) return [];
    return (projectExpenses ?? []).filter((e) => e.projectId === selectedProjectId);
  }, [projectExpenses, selectedProjectId]);

  const productionCatalogById = useMemo(
    () => new Map(productionCatalogItems.map((i) => [i.id, i])),
    [productionCatalogItems]
  );

  const workOrderOverridesForProject = useMemo(() => {
    if (!selectedProjectId) return [];
    return projectTaskOverrides.filter((o) => o.projectId === selectedProjectId && o.isActive);
  }, [projectTaskOverrides, selectedProjectId]);

  const workOrderLines = useMemo(() => {
    const lines: {
      override: ProjectTaskOverride;
      catalog: CatalogItem;
      eff: { cost: number; sell: number };
    }[] = [];
    for (const o of workOrderOverridesForProject) {
      const cat = productionCatalogById.get(o.catalogItemId);
      if (!cat || !cat.isActive) continue;
      lines.push({ override: o, catalog: cat, eff: effectivePrices(cat, o) });
    }
    return lines;
  }, [workOrderOverridesForProject, productionCatalogById]);

  const dailyReportWorkOrderLines = useMemo(
    () =>
      workOrderLines.map(({ override: o, catalog: cat, eff }) => ({
        overrideId: o.id,
        catalogItemId: cat.id,
        taskName: cat.name,
        unit: cat.unit,
        sellPrice: eff.sell,
        costPrice: eff.cost,
        baseSell: cat.sellPrice,
        baseCost: cat.costPrice,
        currency: cat.currency,
        hasSellOverride: o.customSellPrice != null,
        hasCostOverride: o.customCostPrice != null,
      })),
    [workOrderLines]
  );

  const filteredMachinTemplates = useMemo(
    () => filterFormTemplatesByProjectCategory(formTemplates, newFormType),
    [formTemplates, newFormType]
  );

  useEffect(() => {
    const blankOk = formTemplates.some((x) => x.id === PROJECT_FORM_BLANK_TEMPLATE_ID);
    const filtered = filterFormTemplatesByProjectCategory(formTemplates, newFormType);
    const ids = filtered.map((t) => t.id);
    if (filtered.length > 0) {
      setNewFormTemplateId((prev) => (prev && ids.includes(prev) ? prev : ids[0]!));
    } else if (blankOk) {
      setNewFormTemplateId(PROJECT_FORM_BLANK_TEMPLATE_ID);
    } else {
      setNewFormTemplateId("");
    }
  }, [newFormType, formTemplates]);

  const dailyReportsForProject = useMemo(() => {
    if (!selectedProjectId) return [];
    return [...dailyReports]
      .filter((r) => r.projectId === selectedProjectId)
      .sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, 10);
  }, [dailyReports, selectedProjectId]);

  const projectTasksForProject = useMemo(() => {
    if (!selectedProjectId) return [];
    return [...projectTasks]
      .filter((tk) => tk.projectId === selectedProjectId)
      .sort((a, b) => {
        const ap = TASK_PRIORITY_ORDER[a.priority];
        const bp = TASK_PRIORITY_ORDER[b.priority];
        if (ap !== bp) return ap - bp;
        const ad = a.dueDate ?? "9999-12-31";
        const bd = b.dueDate ?? "9999-12-31";
        return ad.localeCompare(bd);
      });
  }, [projectTasks, selectedProjectId]);

  const pendingTaskCount = useMemo(
    () =>
      projectTasksForProject.filter(
        (tk) => tk.status === "pending" || tk.status === "in_progress"
      ).length,
    [projectTasksForProject]
  );

  const filteredProjectTasks = useMemo(() => {
    return projectTasksForProject.filter((tk) => {
      if (taskFilter === "all") return true;
      return tk.status === taskFilter;
    });
  }, [projectTasksForProject, taskFilter]);

  const [pdfConfigOpen, setPdfConfigOpen] = useState(false);
  const [pdfSortBy, setPdfSortBy] = useState<PhotoReportSortBy>("date_desc");
  const [pdfPhotosPerPage, setPdfPhotosPerPage] = useState<PhotoReportPhotosPerPage>(1);
  const [pdfPhotoSize, setPdfPhotoSize] = useState<PhotoReportPhotoSize>("large");
  const [pdfIncludeGps, setPdfIncludeGps] = useState(true);
  const [pdfIncludeAuthor, setPdfIncludeAuthor] = useState(true);
  const [pdfIncludeDate, setPdfIncludeDate] = useState(true);
  const [pdfIncludeNotes, setPdfIncludeNotes] = useState(true);
  const [pdfApprovedOnly, setPdfApprovedOnly] = useState(true);
  const [pdfOrientation, setPdfOrientation] = useState<PhotoReportOrientation>("portrait");
  const [gallerySubTab, setGallerySubTab] = useState<"browse" | "inspection">("browse");
  const [inspectionReportOpen, setInspectionReportOpen] = useState(false);
  const [inspectionReportTitle, setInspectionReportTitle] = useState("");
  const [inspectionInspectorName, setInspectionInspectorName] = useState("");
  const [inspectionIncluded, setInspectionIncluded] = useState<Record<string, boolean>>({});
  const [inspectionOrderIds, setInspectionOrderIds] = useState<string[]>([]);
  const [inspectionPdfBusy, setInspectionPdfBusy] = useState(false);
  const [galleryBulkProgress, setGalleryBulkProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [galleryXferBanner, setGalleryXferBanner] = useState<string | null>(null);

  const projectForms_filtered = (projectForms ?? []).filter(
    (f) => f.projectId === selectedProjectId
  );
  const canCreateMachinFormFromProjectResolved =
    canCreateMachinFormFromProject ??
    (currentUserRole === "admin" || currentUserRole === "supervisor");
  const canDeleteProjectFormEntryResolved =
    canDeleteProjectFormEntry ??
    (currentUserRole === "admin" || currentUserRole === "supervisor");

  const projectTabAllowed = useCallback(
    (id: TabId): boolean => {
      switch (id) {
        case "general":
          return showProjectGeneralTab;
        case "personal":
          return showProjectTeamTab;
        case "inventario":
          return showProjectInventoryTab;
        case "galeria":
          return showProjectGalleryTab;
        case "blueprints":
          return showProjectBlueprintsTab;
        case "formularios":
          return showProjectFormsTab;
        case "visitantes":
          return showProjectVisitorsTab;
        case "rfi":
          return showProjectRfiTab;
        case "seguridad":
          return showProjectSecurityTab;
        case "project_epi":
          return showProjectEpiTab;
        case "costes":
          return showProjectCostsTab;
        case "work_order":
          return !!canViewWorkOrders;
        case "mapa":
          return showProjectMapTab && !!companyId;
        default:
          return true;
      }
    },
    [
      showProjectGeneralTab,
      showProjectTeamTab,
      showProjectInventoryTab,
      showProjectGalleryTab,
      showProjectBlueprintsTab,
      showProjectFormsTab,
      showProjectVisitorsTab,
      showProjectRfiTab,
      showProjectSecurityTab,
      showProjectEpiTab,
      showProjectCostsTab,
      canViewWorkOrders,
      showProjectMapTab,
      companyId,
    ]
  );

  useEffect(() => {
    if (projectTabAllowed(activeTab)) return;
    const next = TABS.map((tab) => tab.id).find((id) => projectTabAllowed(id));
    if (next) setActiveTab(next);
  }, [activeTab, projectTabAllowed]);

  useEffect(() => {
    if (!companyId || !selectedProjectId || !supabase) {
      setProjectMapActiveCount(0);
      return;
    }
    const tz = timeZoneProp ?? "UTC";
    let cancelled = false;
    const run = async () => {
      const ymd = formatTodayYmdInTimeZone(tz);
      const start = zonedYmdHmToUtcIso(ymd, "00:00", tz);
      const end = zonedYmdHmToUtcIso(ymd, "23:59", tz);
      const { count, error } = await supabase
        .from("time_entries")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("project_id", selectedProjectId)
        .is("clock_out_at", null)
        .gte("clock_in_at", start)
        .lte("clock_in_at", end);
      if (!cancelled) setProjectMapActiveCount(error ? 0 : count ?? 0);
    };
    void run();
    const id = window.setInterval(() => void run(), 120_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [companyId, selectedProjectId, supabase, timeZoneProp]);

  useEffect(() => {
    const tab = visitorTabSignal ?? 0;
    const qr = visitorOpenQrSignal ?? 0;
    const mx = Math.max(tab, qr);
    if (!mx || mx <= lastVisitorNavSig.current) return;
    lastVisitorNavSig.current = mx;
    if (selectedProjectId && showProjectVisitorsTab) setActiveTab("visitantes");
  }, [visitorTabSignal, visitorOpenQrSignal, selectedProjectId, showProjectVisitorsTab]);

  useEffect(() => {
    const s = openRfiTabSignal ?? 0;
    if (!s || s <= lastRfiNavSig.current || !selectedProjectId || !showProjectRfiTab) return;
    lastRfiNavSig.current = s;
    setActiveTab("rfi");
  }, [openRfiTabSignal, selectedProjectId, showProjectRfiTab]);

  useEffect(() => {
    const s = projectsSecurityTabSignal ?? 0;
    if (!s || s <= lastSecurityNavSig.current || !selectedProjectId || !showProjectSecurityTab) return;
    lastSecurityNavSig.current = s;
    setActiveTab("seguridad");
  }, [projectsSecurityTabSignal, selectedProjectId, showProjectSecurityTab]);

  useEffect(() => {
    if (!focusDailyReportNav) return;
    const { projectId, reportId, sig } = focusDailyReportNav;
    if (selectedProjectId !== projectId) {
      onSelectProject(projectId);
      return;
    }
    if (dailyReportFocusConsumedSig.current === sig) return;
    dailyReportFocusConsumedSig.current = sig;
    if (showProjectFormsTab) {
      setActiveTab("formularios");
      setDailyReportViewVariant(currentUserRole === "worker" ? "employee" : "full");
      setOpenDailyReportKey(reportId);
    }
    onConsumeDailyReportNav?.();
  }, [
    focusDailyReportNav,
    selectedProjectId,
    onSelectProject,
    currentUserRole,
    onConsumeDailyReportNav,
    showProjectFormsTab,
  ]);

  useEffect(() => {
    if (!openSafetyChecklistId) {
      setSafetyDraft(null);
      return;
    }
    const c = safetyChecklists.find((x) => x.id === openSafetyChecklistId);
    if (c) setSafetyDraft({ ...c });
  }, [openSafetyChecklistId, safetyChecklists]);

  useEffect(() => {
    if (!openDailyReportKey || openDailyReportKey === "new") return;
    if (!dailyReports.some((r) => r.id === openDailyReportKey)) setOpenDailyReportKey(null);
  }, [openDailyReportKey, dailyReports]);

  const groupedSafetyCategories = useMemo(() => {
    if (!safetyDraft?.items.length) return [] as [string, SafetyChecklistItem[]][];
    const m = new Map<string, SafetyChecklistItem[]>();
    for (const it of safetyDraft.items) {
      const cat = it.category || "—";
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat)!.push(it);
    }
    return Array.from(m.entries());
  }, [safetyDraft]);

  const canEdit = canEditProp ?? (currentUserRole === "admin" || currentUserRole === "supervisor" || currentUserRole === "projectManager");
  const canManageProjectTeam =
    typeof canManageProjectTeamProp === "boolean" ? canManageProjectTeamProp : canEdit;
  const canAnnotate = canAnnotateBlueprints ?? canEdit;

  const displayPrefsRev = useMachinProDisplayPrefs();
  const userTz = timeZoneProp ?? resolveUserTimezone(null);
  const dateLoc = useMemo(() => dateLocaleForUser(language, countryCode), [language, countryCode]);
  const fmtYmd = useCallback(
    (iso: string) => {
      if (!iso) return "—";
      const ymd = iso.includes("T") ? iso.split("T")[0]! : iso.slice(0, 10);
      return formatCalendarYmd(ymd, dateLoc, userTz);
    },
    [dateLoc, userTz, displayPrefsRev]
  );

  const selectedProject = selectedProjectId
    ? (projects ?? []).find((p) => p.id === selectedProjectId)
    : null;

  const operationsTabLabelForBreadcrumb = useMemo(() => {
    if (!selectedProject) return "";
    const tab = activeTab;
    return tab === "general"
      ? (t.siteTabGeneral ?? t.tabGeneral ?? PM_EN.tabGeneral)
      : tab === "personal"
        ? (t.siteTabPersonnel ?? t.personnel ?? PM_EN.personnel)
        : tab === "inventario"
          ? (t.siteTabInventory ?? t.whTabInventory ?? PM_EN.whTabInventory)
          : tab === "galeria"
            ? (t.siteTabGallery ?? PM_EN.siteTabGallery)
            : tab === "formularios"
              ? ((t as Record<string, string>).siteTabForms ?? PM_EN.siteTabForms)
              : tab === "blueprints"
                ? ((t as Record<string, string>).blueprints_title ??
                  t.blueprints ??
                  PM_EN.blueprints)
                : tab === "visitantes"
                  ? ((t as Record<string, string>).siteTabVisitors ||
                      (t as Record<string, string>).visitors_menu ||
                      "")
                  : tab === "rfi"
                    ? ((t as Record<string, string>).site_tab_rfi ??
                      (t as Record<string, string>).rfi_menu ??
                      PM_EN.rfi_menu)
                    : tab === "seguridad"
                      ? ((t as Record<string, string>).security_tab ?? PM_EN.security_tab)
                      : tab === "project_epi"
                        ? ((t as Record<string, string>).project_safety_title ?? PM_EN.project_safety_title)
                        : tab === "costes"
                          ? ((t as Record<string, string>).project_costs_title ?? PM_EN.project_costs_title)
                          : tab === "work_order"
                            ? ((t as Record<string, string>).work_order_title ?? PM_EN.work_order_title)
                            : tab === "mapa"
                              ? ((t as Record<string, string>).map ??
                                (t as Record<string, string>).tab_map ??
                                PM_EN.tab_map)
                              : "";
  }, [selectedProject, activeTab, t]);

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setProjectsMapDark(el.classList.contains("dark"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  const projectsForMap = useMemo(
    () =>
      (projects ?? []).map((proj) => ({
        id: proj.id,
        name: proj.name,
        locationLat: proj.locationLat,
        locationLng: proj.locationLng,
        budgetCAD: proj.budgetCAD,
        spentCAD: proj.spentCAD,
        archived: proj.archived,
        lifecycleStatus: proj.lifecycleStatus,
        teamCount: (proj.assignedEmployeeIds ?? []).length,
      })),
    [projects]
  );

  const projectsWithCoordsCount = useMemo(
    () =>
      projectsForMap.filter(
        (p) =>
          typeof p.locationLat === "number" &&
          typeof p.locationLng === "number" &&
          !Number.isNaN(p.locationLat) &&
          !Number.isNaN(p.locationLng)
      ).length,
    [projectsForMap]
  );

  useEffect(() => {
    if (!supabase || !companyId || !selectedProjectId || activeTab !== "general") return;
    let cancelled = false;
    setRfiSummaryLoading(true);
    void (async () => {
      const { data, error } = await supabase.from("rfis").select("status").eq("company_id", companyId).eq("project_id", selectedProjectId);
      if (cancelled) return;
      if (error || !data) {
        setRfiSummary(null);
        setRfiSummaryLoading(false);
        return;
      }
      const rows = data as { status: string }[];
      let closed = 0;
      let openCount = 0;
      for (const r of rows) {
        const s = String(r.status ?? "");
        if (s === "closed") closed += 1;
        else openCount += 1;
      }
      setRfiSummary({ total: rows.length, open: openCount, closed });
      setRfiSummaryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, selectedProjectId, activeTab]);

  useEffect(() => {
    if (activeTab !== "general" || !selectedProjectId) return;
    setGeneralPhotosSkeleton(true);
    const tid = window.setTimeout(() => setGeneralPhotosSkeleton(false), 380);
    return () => window.clearTimeout(tid);
  }, [activeTab, selectedProjectId]);

  const recentGalleryPhotos = useMemo(() => {
    if (!selectedProjectId || !(projectPhotos ?? []).length) return [];
    const list = (projectPhotos ?? []).filter((p) => p.project_id === selectedProjectId);
    return [...list]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4);
  }, [projectPhotos, selectedProjectId]);

  const assignedEmployees = (allEmployees ?? []).filter((e) =>
    (selectedProject?.assignedEmployeeIds ?? []).includes(e.id)
  );

  const projectProfileAssignees = useMemo(() => {
    if (!selectedProject) return [] as { profileId: string; name: string }[];
    const ids = new Set(selectedProject.assignedEmployeeIds ?? []);
    return teamProfiles
      .filter((tp) => tp.employeeId && ids.has(tp.employeeId))
      .map((tp) => ({ profileId: tp.id, name: tp.name || "—" }));
  }, [teamProfiles, selectedProject]);

  const profileNamesByAuthId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const tp of teamProfiles) {
      const n = (tp.name ?? "").trim();
      if (tp.id && n) m[tp.id] = n;
    }
    return m;
  }, [teamProfiles]);

  const blueprintAnnotationNotifyUserIds = useMemo(() => {
    if (!selectedProject) return [] as string[];
    const ids = new Set(selectedProject.assignedEmployeeIds ?? []);
    const out: string[] = [];
    for (const tp of teamProfiles) {
      if (!tp.employeeId || !ids.has(tp.employeeId)) continue;
      const uid = tp.id.trim();
      if (!uid || uid === (currentUserProfileId ?? "").trim()) continue;
      out.push(uid);
    }
    return out;
  }, [selectedProject, teamProfiles, currentUserProfileId]);

  const userAssignedToProject =
    !!currentUserEmployeeId &&
    !!selectedProject &&
    (selectedProject.assignedEmployeeIds ?? []).includes(currentUserEmployeeId);

  const dailyReportsListForUi = useMemo(() => {
    if (currentUserRole === "worker") {
      if (!userAssignedToProject || !selectedProjectId) return [];
      return dailyReportsForProject.filter((r) => r.status === "published" || r.status === "approved");
    }
    return dailyReportsForProject;
  }, [currentUserRole, dailyReportsForProject, userAssignedToProject, selectedProjectId]);

  const projectInventory = (inventoryItems ?? []).filter(
    (i) => i.assignedToProjectId === selectedProjectId
  );
  const projectMaterials = projectInventory.filter((i) => i.type === "material");
  const projectTools = projectInventory.filter((i) => i.type === "tool");

  const projectDiary = (diaryEntries ?? []).filter((e) => e.projectId === selectedProjectId);
  const obraPhotos = projectDiary.filter((e) => e.photoType === "obra" || !e.photoType);
  const invPhotos = projectDiary.filter((e) => e.photoType === "inventario");
  const approvedObraPhotos = obraPhotos.filter(
    (e) =>
      e.status === "approved" ||
      e.status === "accepted" ||
      e.status === "inspection"
  );
  const pendingObraPhotos = obraPhotos.filter((e) => e.status === "pending");
  const filteredObraPhotos =
    galleryCategoryFilter === "all"
      ? obraPhotos
      : obraPhotos.filter((e) => (e.photoCategory ?? "progress") === galleryCategoryFilter);
  const filteredPendingObra = pendingObraPhotos.filter(
    (e) => galleryCategoryFilter === "all" || (e.photoCategory ?? "progress") === galleryCategoryFilter
  );
  const filteredApprovedObra = approvedObraPhotos.filter(
    (e) => galleryCategoryFilter === "all" || (e.photoCategory ?? "progress") === galleryCategoryFilter
  );

  const canUserDownloadThisGalleryPhoto = useCallback(
    (submittedByEmployeeId?: string | null) => {
      if (canManageProjectGallery) return true;
      if (!canUploadPhotos) return false;
      if (!currentUserEmployeeId) return false;
      return submittedByEmployeeId === currentUserEmployeeId;
    },
    [canManageProjectGallery, canUploadPhotos, currentUserEmployeeId]
  );

  const downloadDiaryPhoto = useCallback(
    async (entry: ProjectDiaryEntry) => {
      if (!selectedProject) return;
      const url = entry.photoUrls[0];
      if (!url || !isGalleryDownloadableStatus(entry.status)) return;
      if (!canUserDownloadThisGalleryPhoto(entry.submittedByEmployeeId)) return;
      const tl = t as Record<string, string>;
      try {
        const fn = galleryPhotoFilename(selectedProject.name, entry.createdAt, entry.id, url);
        await downloadImageUrlAsFile(url, fn);
        onGalleryPhotoDownloaded?.({
          photoId: entry.id,
          projectId: selectedProject.id,
          projectName: selectedProject.name,
        });
      } catch {
        setGalleryXferBanner(tl.gallery_download_error ?? PM_EN.gallery_download_error);
      }
    },
    [selectedProject, canUserDownloadThisGalleryPhoto, t, onGalleryPhotoDownloaded]
  );

  const downloadProjectPhotoRow = useCallback(
    async (ph: ProjectPhoto) => {
      if (!selectedProject) return;
      if (!isGalleryDownloadableStatus(ph.status)) return;
      if (!canUserDownloadThisGalleryPhoto(ph.submitted_by_employee_id ?? null)) return;
      const tl = t as Record<string, string>;
      try {
        const fn = galleryPhotoFilename(selectedProject.name, ph.created_at, ph.id, ph.photo_url);
        await downloadImageUrlAsFile(ph.photo_url, fn);
        onGalleryPhotoDownloaded?.({
          photoId: ph.id,
          projectId: selectedProject.id,
          projectName: selectedProject.name,
        });
      } catch {
        setGalleryXferBanner(tl.gallery_download_error ?? PM_EN.gallery_download_error);
      }
    },
    [selectedProject, canUserDownloadThisGalleryPhoto, t, onGalleryPhotoDownloaded]
  );

  const runBulkApprovedGalleryDownload = useCallback(async () => {
    if (!selectedProject || !canManageProjectGallery) return;
    const tl = t as Record<string, string>;
    const list = filteredApprovedObra.filter(
      (e) => isGalleryDownloadableStatus(e.status) && e.photoUrls[0]
    );
    const total = list.length;
    if (total === 0) return;
    setGalleryBulkProgress({ current: 0, total });
    setGalleryXferBanner(tl.gallery_downloading ?? PM_EN.gallery_downloading);
    try {
      const files = list.map((entry) => {
        const url = entry.photoUrls[0]!;
        return {
          url,
          pathInZip: galleryPhotoFilename(
            selectedProject.name,
            entry.createdAt,
            entry.id,
            url
          ),
        };
      });
      const zipBlob = await buildGalleryPhotosZip(files, (cur, tot) => {
        setGalleryBulkProgress({ current: cur, total: tot });
        setGalleryXferBanner(
          formatGalleryDownloadProgress(
            tl.gallery_download_progress ?? PM_EN.gallery_download_progress,
            cur,
            tot
          )
        );
      });
      triggerBlobDownload(zipBlob, galleryBulkZipFilename(selectedProject.name));
      onGalleryPhotosBulkDownloaded?.({
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        count: total,
      });
      setGalleryXferBanner(tl.gallery_download_complete ?? PM_EN.gallery_download_complete);
    } catch {
      setGalleryXferBanner(tl.gallery_download_error ?? PM_EN.gallery_download_error);
    } finally {
      setGalleryBulkProgress(null);
    }
  }, [
    selectedProject,
    canManageProjectGallery,
    filteredApprovedObra,
    t,
    onGalleryPhotosBulkDownloaded,
  ]);

  useEffect(() => {
    if (!galleryXferBanner) return;
    const id = window.setTimeout(() => setGalleryXferBanner(null), 4500);
    return () => window.clearTimeout(id);
  }, [galleryXferBanner]);

  const pdfSourcePhotos = useMemo(
    () =>
      (projectPhotos ?? []).filter((p) => {
        if (!selectedProjectId || p.project_id !== selectedProjectId) return false;
        if (p.photo_type !== "obra") return false;
        if (galleryCategoryFilter !== "all" && p.photo_category !== galleryCategoryFilter) return false;
        return true;
      }),
    [projectPhotos, selectedProjectId, galleryCategoryFilter]
  );

  const inspectionPhotosPool = useMemo(() => {
    if (!selectedProjectId || !projectPhotos?.length) return [] as ProjectPhoto[];
    return projectPhotos.filter(
      (p) =>
        p.project_id === selectedProjectId &&
        p.photo_type === "obra" &&
        (p.photo_category === "incident" || p.photo_category === "health_safety")
    );
  }, [projectPhotos, selectedProjectId]);

  const canGeneratePdf =
    pdfApprovedOnly
      ? pdfSourcePhotos.some((p) => p.status === "approved")
      : pdfSourcePhotos.length > 0;

  const handleGalleryPhotoChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !selectedProjectId) return;
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "dwdlmxmkt";
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "i5dmd07o";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", "machinpro/photos");
      setGalleryUploadBusy(true);
      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: "POST", body: formData }
        );
        const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
        const url = data.secure_url;
        if (url) {
          const fromModal = pendingUploadCategoryRef.current;
          pendingUploadCategoryRef.current = null;
          const category =
            fromModal ??
            (galleryCategoryFilter === "all" ? "progress" : galleryCategoryFilter);
          onPhotoObra?.(
            selectedProjectId!,
            category as "progress" | "incident" | "health_safety",
            url
          );
          showToast("success", tl.saved_successfully ?? PM_EN.toast_saved);
        } else if (data.error?.message) {
          showToast("error", userFacingErrorMessage(tl, new Error(data.error.message)));
        } else {
          showToast("error", userFacingErrorMessage(tl, undefined));
        }
      } catch (err) {
        showToast("error", userFacingErrorMessage(tl, err));
      } finally {
        setGalleryUploadBusy(false);
      }
    },
    [selectedProjectId, galleryCategoryFilter, onPhotoObra, showToast, tl]
  );

  const openGalleryFilePickerAfterCategory = useCallback((cat: PhotoCategory) => {
    pendingUploadCategoryRef.current = cat;
    setShowCategoryModal(false);
    requestAnimationFrame(() => {
      galleryPhotoInputRef.current?.click();
    });
  }, []);

  useEffect(() => {
    if (activeTab !== "galeria") setGallerySubTab("browse");
  }, [activeTab]);

  const openInspectionReportModal = useCallback(() => {
    if (!selectedProject) return;
    const tl = t as Record<string, string>;
    const pool = [...inspectionPhotosPool].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setInspectionOrderIds(pool.map((p) => p.id));
    setInspectionIncluded(Object.fromEntries(pool.map((p) => [p.id, true])));
    const d = formatDateIntl(new Date(), dateLoc, userTz);
    setInspectionReportTitle(`${tl.inspection_report ?? PM_EN.inspection_report} — ${selectedProject.name} — ${d}`);
    setInspectionInspectorName(currentUserDisplayName ?? "");
    setInspectionReportOpen(true);
  }, [selectedProject, inspectionPhotosPool, t, currentUserDisplayName, dateLoc, userTz]);

  const runInspectionPdfDownload = useCallback(async () => {
    if (!selectedProject) return;
    const ordered = inspectionOrderIds.filter((id) => inspectionIncluded[id]);
    const list: ProjectPhoto[] = [];
    for (const id of ordered) {
      const ph = inspectionPhotosPool.find((p) => p.id === id);
      if (ph) list.push(ph);
    }
    if (list.length === 0) return;
    setInspectionPdfBusy(true);
    try {
      const blob = await generateInspectionReportPDF({
        photos: list,
        projectName: selectedProject.name,
        companyName: companyName ?? "",
        companyLogoUrl: companyLogoUrl ?? undefined,
        companyAddress: companyAddress?.trim() || undefined,
        companyPhone: companyPhone?.trim() || undefined,
        companyEmail: companyEmail?.trim() || undefined,
        companyWebsite: companyWebsite?.trim() || undefined,
        inspectorName: inspectionInspectorName.trim() || (currentUserDisplayName ?? ""),
        reportTitle: inspectionReportTitle.trim() || (selectedProject.name ?? ""),
        labels: t as Record<string, string>,
        language,
        countryCode,
        timeZone: userTz,
      });
      const ymd = new Date().toISOString().slice(0, 10);
      const slug =
        selectedProject.name
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 48) || "Proyecto";
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Inspeccion_${slug}_${ymd}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      onInspectionReportGenerated?.({
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        photoCount: list.length,
        reportTitle: inspectionReportTitle.trim() || selectedProject.name,
      });
      setInspectionReportOpen(false);
    } finally {
      setInspectionPdfBusy(false);
    }
  }, [
    selectedProject,
    inspectionOrderIds,
    inspectionIncluded,
    inspectionPhotosPool,
    companyName,
    companyLogoUrl,
    companyAddress,
    companyPhone,
    companyEmail,
    companyWebsite,
    inspectionInspectorName,
    inspectionReportTitle,
    currentUserDisplayName,
    t,
    language,
    countryCode,
    userTz,
    onInspectionReportGenerated,
  ]);

  const sortInspectionOrderByDate = useCallback(() => {
    setInspectionOrderIds((prev) =>
      [...prev].sort((a, b) => {
        const ta = new Date(
          inspectionPhotosPool.find((p) => p.id === a)?.created_at ?? 0
        ).getTime();
        const tb = new Date(
          inspectionPhotosPool.find((p) => p.id === b)?.created_at ?? 0
        ).getTime();
        return ta - tb;
      })
    );
  }, [inspectionPhotosPool]);

  const moveInspectionOrder = useCallback((id: string, delta: number) => {
    setInspectionOrderIds((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }, []);

  const canApprove = currentUserRole === "admin" || currentUserRole === "supervisor" || currentUserRole === "projectManager";
  const progress =
    selectedProject?.budgetCAD && selectedProject.budgetCAD > 0
      ? Math.min(100, Math.round(((selectedProject.spentCAD ?? 0) / selectedProject.budgetCAD) * 100))
      : 0;

  const daysRemaining = selectedProject?.estimatedEnd
    ? daysLeft(selectedProject.estimatedEnd)
    : null;

  const dispatchedRequestsForProject = selectedProject
    ? (resourceRequests ?? []).filter(
        (r) => r.projectId === selectedProject.id && r.status === "dispatched"
      )
    : [];

  const canCreateRfiQuick = currentUserRole === "admin" || currentUserRole === "supervisor";
  const budgetBarToneClass =
    progress < 70 ? "bg-emerald-500" : progress <= 90 ? "bg-amber-500" : "bg-red-500";

  const handleExportProjectPdf = useCallback(async () => {
    const tlPdf = t as Record<string, string>;
    if (!supabase || !companyId || !selectedProjectId) {
      showToast("error", tlPdf.export_error ?? PM_EN.export_error ?? "Export error");
      return;
    }
    const proj = (projects ?? []).find((p) => p.id === selectedProjectId);
    if (!proj) return;
    setPdfExportBusy(true);
    try {
      const { buildProjectReportPdf, slugProjectPdfName } = await import("@/lib/projectExportPdf");
      const genIso = new Date().toISOString();
      const { data: hz } = await supabase
        .from("hazards")
        .select("title,description,severity,status,created_at,reported_by_name")
        .eq("company_id", companyId)
        .eq("project_id", proj.id)
        .in("status", ["open", "in_progress"]);
      const hazardRows =
        ((hz ?? []) as {
          title: string;
          description: string | null;
          severity: string;
          status: string;
          created_at: string;
          reported_by_name: string | null;
        }[]).map((h) => ({
          description: `${h.title}${h.description?.trim() ? ` — ${h.description}` : ""}`.slice(0, 220),
          severity: h.severity,
          status: h.status,
          date: h.created_at?.slice(0, 10) ?? "—",
          reportedBy: (h.reported_by_name ?? "—").trim() || "—",
        }));
      const { data: caData } = await supabase
        .from("corrective_actions")
        .select("title,description,status,due_date")
        .eq("company_id", companyId)
        .eq("project_id", proj.id)
        .in("status", ["open", "in_progress", "pending_review"]);
      const correctivePdf =
        ((caData ?? []) as {
          title: string;
          description: string | null;
          status: string;
          due_date: string | null;
        }[]).map((c) => ({
          description: `${c.title}${c.description?.trim() ? ` — ${c.description}` : ""}`.slice(0, 160),
          status: c.status,
          dueDate: c.due_date?.slice(0, 10) ?? "",
        }));
      const laborSum = projectLaborSummaries[proj.id];
      const teamPdf =
        (laborSum?.byEmployee ?? []).map((row) => ({
          name: row.name,
          role: allEmployees?.find((e) => e.id === row.employeeId)?.role ?? "—",
          hours: row.hours,
          costCad: row.cost,
        })) ?? [];
      const costsPdf = (projectExpenses ?? [])
        .filter((e) => e.projectId === proj.id)
        .map((e) => ({
          description: e.name,
          amountCad: Number.isFinite(e.amount) ? e.amount : 0,
          date: e.expenseDate?.slice(0, 10) ?? "—",
        }));
      const typeLbl =
        proj.type === "residential"
          ? (tlPdf.projectTypeResidential ?? PM_EN.projectTypeResidential)
          : proj.type === "commercial"
            ? (tlPdf.projectTypeCommercial ?? PM_EN.projectTypeCommercial)
            : proj.type === "industrial"
              ? (tlPdf.projectTypeIndustrial ?? PM_EN.projectTypeIndustrial)
              : proj.type;
      const lifeLbl =
        proj.archived || proj.lifecycleStatus === "completed"
          ? (tlPdf.projects_status_completed ?? "Completed")
          : proj.lifecycleStatus === "paused"
            ? (tlPdf.projects_status_paused ?? "Paused")
            : (tlPdf.projects_status_active ?? "Active");
      const consumedPct =
        proj.budgetCAD && proj.budgetCAD > 0 ? Math.min(100, Math.round(((proj.spentCAD ?? 0) / proj.budgetCAD) * 100)) : null;
      const doc = buildProjectReportPdf({
        labels: tlPdf,
        companyName: companyName || "",
        projectName: proj.name,
        projectTypeLabel: typeLbl,
        location: proj.location || "",
        dateStart: proj.estimatedStart?.slice?.(0, 10) ?? String(proj.estimatedStart ?? ""),
        dateEnd: proj.estimatedEnd?.slice?.(0, 10) ?? String(proj.estimatedEnd ?? ""),
        lifecycleStatusLabel: lifeLbl,
        budgetCad: proj.budgetCAD ?? null,
        spentCad: proj.spentCAD ?? null,
        consumedPct,
        team: teamPdf,
        costs: costsPdf,
        hazards: hazardRows,
        correctives: correctivePdf,
        generationIso: genIso,
      });
      doc.save(slugProjectPdfName(proj.name, genIso));
      showToast(
        "success",
        tlPdf.project_pdf_download_success ?? tlPdf.export_success ?? PM_EN.export_success ?? "Done"
      );
    } catch (err) {
      showToast("error", userFacingErrorMessage(t as Record<string, string>, err));
    } finally {
      setPdfExportBusy(false);
    }
  }, [
    supabase,
    companyId,
    selectedProjectId,
    projects,
    projectLaborSummaries,
    projectExpenses,
    allEmployees,
    companyName,
    showToast,
    t,
  ]);

  // ── Vista: lista de proyectos ───────────────────────────────────────────────
  if (!selectedProject) {
    return (
      <section className="w-full min-w-0 max-w-full overflow-x-hidden rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
        <div className="min-w-0 border-b border-zinc-200 px-4 py-4 dark:border-slate-700 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
                <Building2 className="h-5 w-5 shrink-0 text-amber-500" />
                <span className="min-w-0 break-words">{t.siteAdminView ?? PM_EN.siteAdminView}</span>
              </h2>
              <p className="mt-0.5 break-words text-sm text-zinc-500 dark:text-zinc-400">
                {t.projects_select_detail_hint ?? PM_EN.projects_select_detail_hint}
              </p>
            </div>
            {canCreateProjects && onOpenNewProject ? (
              <button
                type="button"
                onClick={onOpenNewProject}
                className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 sm:w-auto"
              >
                <Plus className="h-5 w-5 shrink-0" aria-hidden />
                {(t as Record<string, string>).projects_new_project ?? PM_EN.projects_new_project}
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4 dark:border-slate-700/80" role="group" aria-label={tl.projects_view_toggle_group ?? "View"}>
            <button
              type="button"
              onClick={() => setProjectsBrowseView("list")}
              aria-pressed={projectsBrowseView === "list"}
              className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                projectsBrowseView === "list"
                  ? "bg-amber-100 text-amber-950 ring-2 ring-amber-400/70 dark:bg-amber-900/40 dark:text-amber-50 dark:ring-amber-500/50"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-900 dark:text-zinc-200 dark:hover:bg-slate-800"
              }`}
            >
              <List className="h-4 w-4 shrink-0" aria-hidden />
              {tl.projects_view_list ?? PM_EN.projects_view_list}
            </button>
            <button
              type="button"
              onClick={() => setProjectsBrowseView("map")}
              aria-pressed={projectsBrowseView === "map"}
              className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                projectsBrowseView === "map"
                  ? "bg-amber-100 text-amber-950 ring-2 ring-amber-400/70 dark:bg-amber-900/40 dark:text-amber-50 dark:ring-amber-500/50"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-900 dark:text-zinc-200 dark:hover:bg-slate-800"
              }`}
            >
              <MapViewIcon className="h-4 w-4 shrink-0" aria-hidden />
              {tl.projects_view_map ?? PM_EN.projects_view_map}
            </button>
          </div>
        </div>

        {projectsBrowseView === "map" ? (
          <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
            {projectsWithCoordsCount === 0 ? (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                {tl.projects_map_no_coords ?? PM_EN.projects_map_no_coords}
              </p>
            ) : null}
            <div className="h-[400px] w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-slate-700 md:h-[600px]">
              <ProjectsMapDynamic projects={projectsForMap} labels={tl} isDark={projectsMapDark} />
            </div>
          </div>
        ) : (
        <div className="grid w-full min-w-0 grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 md:gap-6 lg:grid-cols-3 lg:p-8">
          {(projects ?? []).map((proj) => {
            const typeLabel =
              proj.type === "residential"
                ? (tl.projectTypeResidential ?? PM_EN.projectTypeResidential)
                : proj.type === "commercial"
                  ? (tl.projectTypeCommercial ?? PM_EN.projectTypeCommercial)
                  : proj.type === "industrial"
                    ? (tl.projectTypeIndustrial ?? PM_EN.projectTypeIndustrial)
                    : proj.type;
            const assigned = (allEmployees ?? []).filter((e) => (proj.assignedEmployeeIds ?? []).includes(e.id));
            const pendingCount = (diaryEntries ?? []).filter(
              (e) => e.projectId === proj.id && e.status === "pending" && (e.photoType === "obra" || !e.photoType)
            ).length;
            const prog =
              proj.budgetCAD && proj.budgetCAD > 0
                ? Math.min(100, Math.round(((proj.spentCAD ?? 0) / proj.budgetCAD) * 100))
                : 0;

            return (
              <button
                key={proj.id}
                type="button"
                onClick={() => { onSelectProject(proj.id); setActiveTab("general"); }}
                className="group text-left rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800/50 p-5 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors break-words"
                      title={proj.name}
                    >
                      {proj.name}
                    </h3>
                    <p
                      className="mt-0.5 text-xs font-medium text-amber-800 dark:text-amber-300/90 break-words"
                      title={typeLabel}
                    >
                      {tl.projectFormTypeLabel ?? PM_EN.projectFormTypeLabel}: {typeLabel}
                    </p>
                    {proj.location && (
                      <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />{proj.location}
                      </p>
                    )}
                  </div>
                  {pendingCount > 0 && canApprove && (
                    <span className="shrink-0 rounded-full bg-amber-500 text-white text-xs font-bold px-2 py-0.5">
                      {pendingCount === 1
                        ? (tl.project_photos_pending_one ?? PM_EN.project_photos_pending_one)
                        : (tl.project_photos_pending_many ?? PM_EN.project_photos_pending_many).replace(
                            /\{\{n\}\}/g,
                            String(pendingCount)
                          )}
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                    <span>{tl.project_budget_consumed_progress ?? PM_EN.project_budget_consumed_progress}</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{prog}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${prog > 80 ? "bg-red-500" : prog > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${prog}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {assigned.length === 1
                      ? (tl.project_team_one ?? PM_EN.project_team_one)
                      : (tl.project_team_many ?? PM_EN.project_team_many).replace(/\{\{n\}\}/g, String(assigned.length))}
                  </span>
                  <span>{fmtYmd(proj.estimatedEnd)}</span>
                </div>
              </button>
            );
          })}

          {(projects ?? []).length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-zinc-400 dark:text-zinc-500 sm:col-span-2 lg:col-span-3">
              {t.noProjectsAssigned ?? PM_EN.noProjectsAssigned}
            </div>
          )}
        </div>
        )}
      </section>
    );
  }

  // ── Vista: detalle del proyecto ─────────────────────────────────────────────
  return (
    <section className="w-full min-w-0 max-w-full overflow-x-hidden rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/60 sm:px-6 sm:py-5 lg:px-8 min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => onSelectProject(null)}
            className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors min-h-[44px] min-w-[44px] items-center justify-center sm:justify-start"
          >
            <ChevronLeft className="h-3.5 w-3.5" />{t.siteBackToProjects ?? PM_EN.siteBackToProjects}
          </button>
        </div>

        <nav aria-label={(tl as Record<string, string>).operations_breadcrumb_aria ?? "Breadcrumb"} className="mb-3 min-w-0">
          <ol className="hidden min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 sm:flex">
            <li className="min-w-0 shrink">
              <button
                type="button"
                onClick={() => onSelectProject(null)}
                className="max-w-full truncate font-medium text-amber-700 hover:underline dark:text-amber-400 min-h-[44px] inline-flex items-center"
              >
                {(tl as Record<string, string>).operations_breadcrumb ?? "Operations"}
              </button>
            </li>
            <li aria-hidden className="text-zinc-400">
              ›
            </li>
            <li className="min-w-0 shrink">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className="max-w-full truncate font-medium text-amber-700 hover:underline dark:text-amber-400 min-h-[44px] inline-flex items-center text-left"
              >
                {selectedProject.name}
              </button>
            </li>
            <li aria-hidden className="text-zinc-400">
              ›
            </li>
            <li className="min-w-0 shrink text-zinc-700 dark:text-zinc-200 font-medium" aria-current="page">
              <span className="line-clamp-2 break-words">{operationsTabLabelForBreadcrumb}</span>
            </li>
          </ol>
          <div className="flex min-w-0 items-center sm:hidden">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className="inline-flex min-h-[44px] max-w-full items-center gap-1 truncate rounded-lg px-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100"
            >
              <ChevronLeft className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              <span className="truncate">{selectedProject.name}</span>
            </button>
          </div>
        </nav>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 p-2.5 shrink-0">
                <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold text-zinc-900 dark:text-white">{selectedProject.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {selectedProject.location && (
                    <span className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {selectedProject.location}
                    </span>
                  )}
                  {selectedProject.location ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedProject.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-lg px-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden /> {tl.openInMaps ?? PM_EN.openInMaps}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => void handleExportProjectPdf()}
                disabled={pdfExportBusy || !companyId}
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-600 bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 dark:border-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                {pdfExportBusy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <FileDown className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {(tl as Record<string, string>).project_export_pdf_btn ?? tl.project_export_pdf ?? PM_EN.project_export_pdf}
              </button>
            </div>
          </div>

          {(canUploadPhotos ||
            showProjectFormsTab ||
            (showProjectRfiTab && canCreateRfiQuick) ||
            showProjectVisitorsTab) && (
            <div className="min-w-0 border-t border-zinc-200 pt-3 dark:border-slate-700">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {tl.project_quick_actions ?? PM_EN.project_quick_actions}
              </p>
              <div className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {canUploadPhotos ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoCategoryModal({ projectId: selectedProject.id });
                      setPhotoCategoryToSubmit("progress");
                    }}
                    className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-900 dark:text-zinc-100 dark:hover:bg-slate-800"
                  >
                    <Camera className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">
                      {(tl as Record<string, string>).project_quick_action_photo ?? tl.progressPhotos ?? PM_EN.progressPhotos}
                    </span>
                  </button>
                ) : null}
                {showProjectFormsTab ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("formularios");
                      setDailyReportViewVariant(currentUserRole === "worker" ? "employee" : "full");
                      setOpenDailyReportKey("new");
                    }}
                    className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-900 dark:text-zinc-100 dark:hover:bg-slate-800"
                  >
                    <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">
                      {(tl as Record<string, string>).project_quick_action_daily ??
                        (t as Record<string, string>).daily_report_summary ??
                        PM_EN.daily_report_summary ??
                        "Daily report"}
                    </span>
                  </button>
                ) : null}
                {showProjectRfiTab && canCreateRfiQuick ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("rfi");
                      setRfiQuickCreateSig((n) => n + 1);
                    }}
                    className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-900 dark:text-zinc-100 dark:hover:bg-slate-800"
                  >
                    <FileQuestion className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">{tl.rfi_new ?? PM_EN.rfi_new ?? "RFI"}</span>
                  </button>
                ) : null}
                {showProjectVisitorsTab ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("visitantes")}
                    className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-900 dark:text-zinc-100 dark:hover:bg-slate-800"
                  >
                    <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">
                      {(tl as Record<string, string>).project_quick_action_visitor ??
                        (t as Record<string, string>).siteTabVisitors ??
                        (t as Record<string, string>).visitors_menu ??
                        "Visitors"}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {/* KPIs rápidos — 1 col en móvil estrecho, 2–3 columnas en tablet+ */}
          <div className="grid w-full auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 md:gap-4 lg:gap-5">
            {selectedProject.budgetCAD != null && selectedProject.budgetCAD > 0 && (
              <div className="rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 min-w-0">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" aria-hidden /> {tl.project_budget_short_label ?? PM_EN.project_budget_short_label}
                </p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatBudget(selectedProject.budgetCAD)}</p>
                {selectedProject.spentCAD != null && (
                  <p className={`text-xs font-medium ${progress > 80 ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                    {progress}
                    {tl.project_budget_pct_used ?? PM_EN.project_budget_pct_used}
                  </p>
                )}
              </div>
            )}
            {daysRemaining !== null && (
              <div className="rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 min-w-0">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" aria-hidden /> {tl.daysRemaining ?? PM_EN.daysRemaining}
                </p>
                <p className={`text-sm font-semibold break-words ${daysRemaining < 0 ? "text-red-500" : daysRemaining < 30 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                  {daysRemaining < 0
                    ? `${Math.abs(daysRemaining)} ${tl.certDaysOverdue ?? PM_EN.certDaysOverdue}`
                    : (tl.wh_maintenance_days_short ?? PM_EN.wh_maintenance_days_short).replace(
                        "{n}",
                        String(daysRemaining)
                      )}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 break-words">{fmtYmd(selectedProject.estimatedEnd)}</p>
              </div>
            )}
            <div className="rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 min-w-0">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5 flex items-center gap-1">
                <Users className="h-3 w-3" /> {(t as Record<string, string>).project_kpi_team ?? PM_EN.project_kpi_team}
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{assignedEmployees.length}</p>
              {pendingObraPhotos.length > 0 && canApprove && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 break-words">
                  {pendingObraPhotos.length === 1
                    ? (tl.project_photos_pending_one ?? PM_EN.project_photos_pending_one)
                    : (tl.project_photos_pending_many ?? PM_EN.project_photos_pending_many).replace(
                        /\{\{n\}\}/g,
                        String(pendingObraPhotos.length)
                      )}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {(() => {
        const unresolvedCount = (blueprints ?? [])
          .filter((bp) => bp.projectId === selectedProject?.id)
          .reduce(
            (acc, bp) =>
              acc + (bp.annotations ?? []).filter((a) => !a.resolved).length,
            0
          );
        return (
          <HorizontalScrollFade className="border-b border-zinc-200 dark:border-slate-700 min-w-0">
            <div className="flex w-full min-w-0 max-w-full flex-nowrap gap-0 overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory px-4 pb-0.5 sm:px-6 [scrollbar-width:thin]">
            {TABS.filter((tab) => projectTabAllowed(tab.id)).map((tab) => {
              const label =
                tab.id === "general"
                  ? t.siteTabGeneral ?? t.tabGeneral ?? PM_EN.tabGeneral
                  : tab.id === "personal"
                  ? t.siteTabPersonnel ?? t.personnel ?? PM_EN.personnel
                  : tab.id === "inventario"
                  ? t.siteTabInventory ?? t.whTabInventory ?? PM_EN.whTabInventory
                  : tab.id === "galeria"
                  ? t.siteTabGallery ?? PM_EN.siteTabGallery
                  : tab.id === "formularios"
                  ? (t as Record<string, string>).siteTabForms ?? PM_EN.siteTabForms
                  : tab.id === "blueprints"
                  ? (t as Record<string, string>).blueprints_title ??
                    t.blueprints ?? PM_EN.blueprints
                  : tab.id === "visitantes"
                  ? (t as Record<string, string>).siteTabVisitors ||
                    (t as Record<string, string>).visitors_menu ||
                    ""
                  : tab.id === "rfi"
                  ? (t as Record<string, string>).site_tab_rfi ?? (t as Record<string, string>).rfi_menu ?? PM_EN.rfi_menu
                  : tab.id === "seguridad"
                    ? (t as Record<string, string>).security_tab ?? PM_EN.security_tab
                  : tab.id === "project_epi"
                    ? (t as Record<string, string>).project_safety_title ?? PM_EN.project_safety_title
                  : tab.id === "costes"
                    ? (t as Record<string, string>).project_costs_title ?? PM_EN.project_costs_title
                  : tab.id === "work_order"
                    ? (t as Record<string, string>).work_order_title ?? PM_EN.work_order_title
                  : tab.id === "mapa"
                    ? (t as Record<string, string>).map ??
                      (t as Record<string, string>).tab_map ??
                      PM_EN.tab_map
                  : "";
              const badge =
                tab.id === "galeria" && pendingObraPhotos.length > 0 && canApprove
                  ? pendingObraPhotos.length
                  : null;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 snap-start items-center gap-1.5 px-3 py-3.5 text-sm font-medium border-b-[3px] transition-colors whitespace-nowrap min-h-[44px] ${
                    activeTab === tab.id
                      ? "border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/25"
                      : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  }`}
                >
                  {tab.icon}
                  {tab.id === "blueprints" && unresolvedCount > 0 ? (
                    <>
                      <span>{label}</span>
                      <span className="ml-1.5 rounded-full bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 min-w-[18px] text-center inline-block">
                        {unresolvedCount}
                      </span>
                    </>
                  ) : (
                    label
                  )}
                  {badge && (
                    <span className="ml-1 rounded-full bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 leading-none">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
            </div>
          </HorizontalScrollFade>
        );
      })()}

      {/* Contenido */}
      <div className="w-full min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">

        {dispatchedRequestsForProject.length > 0 && (
          <div className="space-y-2 mb-3">
            {dispatchedRequestsForProject.map((request) => (
              <div
                key={request.id}
                className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      {t.resourcesInTransit ?? PM_EN.resourcesInTransit}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      {request.items.length} items ·{" "}
                      {t.neededBy ?? PM_EN.neededBy}: {request.neededBy}
                    </p>
                  </div>
                </div>
                {onConfirmReception && (
                  <button
                    type="button"
                    onClick={() => onConfirmReception(request.id)}
                    className="shrink-0 text-sm rounded-xl bg-amber-600 text-white px-3 py-2 min-h-[44px] hover:bg-amber-500 transition-colors font-medium"
                  >
                    {t.confirmReception ?? PM_EN.confirmReception}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ══ TAB GENERAL ══ */}
        {activeTab === "general" && (
          <div className="space-y-6">
            {selectedProject.budgetCAD != null && selectedProject.budgetCAD > 0 && (
              <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    {tl.project_budget_progress_label ?? PM_EN.project_budget_progress_label}
                  </span>
                  <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-200">
                    {(tl.project_budget_consumed_total ?? tl.project_budget_consumed_detail ?? "")
                      .replace(
                        "{{spent}}",
                        formatCurrency(selectedProject.spentCAD ?? 0, companyCurrency, dateLoc)
                      )
                      .replace(/\{\{total\}\}/g, formatCurrency(selectedProject.budgetCAD ?? 0, companyCurrency, dateLoc))
                      .replace(/\{\{budget\}\}/g, formatCurrency(selectedProject.budgetCAD ?? 0, companyCurrency, dateLoc))
                      .replace("{{pct}}", String(progress))}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full transition-all ${budgetBarToneClass}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {progress > 90 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {(tl.project_budget_alert_capacity ?? PM_EN.project_budget_alert_capacity).replace(
                      /\{\{pct\}\}/g,
                      String(progress)
                    )}
                  </p>
                )}
              </section>
            )}

            {companyId && showProjectRfiTab && (
              <button
                type="button"
                onClick={() => setActiveTab("rfi")}
                disabled={rfiSummaryLoading}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm transition-colors hover:border-amber-400 hover:bg-amber-50/60 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-amber-500 dark:hover:bg-amber-950/20 min-h-[44px]"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {tl.project_rfi_summary ?? PM_EN.project_rfi_summary}
                </p>
                {rfiSummaryLoading ? (
                  <div className="mt-3 space-y-2">
                    <div className="h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-slate-600" />
                    <div className="h-4 w-36 animate-pulse rounded bg-zinc-200 dark:bg-slate-600" />
                  </div>
                ) : rfiSummary ? (
                  rfiSummary.total > 0 ? (
                    <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">
                      {(tl.project_rfi_counts_open_closed ?? tl.project_rfi_counts ?? "")
                        .replace("{{total}}", String(rfiSummary.total))
                        .replace("{{open}}", String(rfiSummary.open))
                        .replace("{{closed}}", String(rfiSummary.closed))
                        .replace("{{pending}}", String(rfiSummary.open))
                        .replace("{{answered}}", String(rfiSummary.closed))}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {tl.project_no_rfis_yet ?? tl.project_rfi_empty ?? "—"}
                    </p>
                  )
                ) : (
                  <p className="mt-1 text-sm text-zinc-500">{tl.common_dash ?? "—"}</p>
                )}
              </button>
            )}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {tl.project_recent_photos ?? PM_EN.project_recent_photos}
                </h3>
                {showProjectGalleryTab ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("galeria")}
                    className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
                  >
                    {tl.project_see_all_photos ?? PM_EN.project_see_all_photos}
                  </button>
                ) : null}
              </div>
              {generalPhotosSkeleton ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="aspect-square animate-pulse rounded-xl bg-zinc-200 dark:bg-slate-700"
                    />
                  ))}
                </div>
              ) : recentGalleryPhotos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-slate-600 dark:text-zinc-400">
                  <p>{tl.project_photos_empty_line1 ?? tl.project_no_recent_photos ?? PM_EN.project_no_recent_photos}</p>
                  {tl.project_photos_empty_line2 ? (
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{tl.project_photos_empty_line2}</p>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {recentGalleryPhotos.map((ph) => (
                    <button
                      key={ph.id}
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: cloudinaryFull(ph.photo_url),
                          fallback: ph.photo_url,
                        })
                      }
                      className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cloudinaryThumb(ph.photo_url)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
              <InfoRow
                label={tl.projectFormTypeLabel ?? PM_EN.projectFormTypeLabel}
                value={
                  selectedProject.type === "residential"
                    ? (tl.projectTypeResidential ?? PM_EN.projectTypeResidential)
                    : selectedProject.type === "commercial"
                      ? (tl.projectTypeCommercial ?? PM_EN.projectTypeCommercial)
                      : selectedProject.type === "industrial"
                        ? (tl.projectTypeIndustrial ?? PM_EN.projectTypeIndustrial)
                        : selectedProject.type
                }
              />
              <InfoRow
                label={tl.projectFormLocationLabel ?? PM_EN.projectFormLocationLabel}
                value={selectedProject.location || (tl.common_dash ?? PM_EN.common_dash)}
              />
              <InfoRow label={tl.projectFormDateStart ?? PM_EN.projectFormDateStart} value={fmtYmd(selectedProject.estimatedStart)} />
              <InfoRow label={tl.projectFormDateEnd ?? PM_EN.projectFormDateEnd} value={fmtYmd(selectedProject.estimatedEnd)} />
              {selectedProject.budgetCAD != null && (
                <InfoRow label={projectBudgetInfoLabel} value={formatCurrency(selectedProject.budgetCAD, companyCurrency, dateLoc)} />
              )}
              {selectedProject.spentCAD != null && (
                <InfoRow
                  label={tl.project_budget_consumed_progress ?? PM_EN.project_budget_consumed_progress}
                  value={`${formatCurrency(selectedProject.spentCAD, companyCurrency, dateLoc)} (${progress}%)`}
                />
              )}
            </div>

            {companyId &&
              (canViewAttendancePanel || (canUseProjectTimeclock && userAssignedToProject)) && (
                <ProjectTimeclockSection
                  companyId={companyId}
                  projectId={selectedProject.id}
                  userProfileId={currentUserProfileId}
                  labels={t}
                  assignedEmployeeNames={assignedEmployees.map((e) => ({ id: e.id, name: e.name }))}
                  profileNamesByAuthId={profileNamesByAuthId}
                  canClock={canUseProjectTimeclock && userAssignedToProject}
                  canViewAttendance={canViewAttendancePanel}
                  dateLocale={dateLoc}
                  timeZone={userTz}
                  locationSharingEnabled={shiftLocationSharingEnabled}
                />
              )}

            {canViewProjectLaborCosts ? (
              <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/60 dark:bg-slate-800/40 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {tl.labor_costing ?? "Labor costing"}
                </h3>
                {(() => {
                  const laborSum: ProjectLaborSummary =
                    projectLaborSummaries[selectedProject.id] ?? {
                      totalHours: 0,
                      totalCost: 0,
                      byEmployee: [],
                    };
                  const budget = selectedProject.budgetCAD ?? 0;
                  const laborVsBudgetPct =
                    budget > 0 ? Math.min(100, Math.round((laborSum.totalCost / budget) * 100)) : null;
                  return (
                    <>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {tl.labor_hours_worked ?? "Hours worked"}
                          </p>
                          <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">
                            {laborSum.totalHours.toFixed(1)}h
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {tl.labor_cost_total ?? "Total cost"}
                          </p>
                          <p className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                            {formatCurrency(laborSum.totalCost, companyCurrency, dateLoc)}
                          </p>
                        </div>
                      </div>
                      {budget > 0 && laborVsBudgetPct != null ? (
                        <div>
                          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
                            <span>{tl.labor_cost_vs_budget ?? "Cost vs budget"}</span>
                            <span className="font-medium tabular-nums">
                              {formatCurrency(laborSum.totalCost, companyCurrency, dateLoc)} /{" "}
                              {formatCurrency(budget, companyCurrency, dateLoc)} ({laborVsBudgetPct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                laborVsBudgetPct > 100
                                  ? "bg-red-500"
                                  : laborVsBudgetPct > 80
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(100, laborVsBudgetPct)}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {laborSum.byEmployee.length === 0 ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {tl.dashboard_trend_neutral ?? PM_EN.common_dash}
                        </p>
                      ) : (
                        <>
                          <div className="space-y-2 md:hidden">
                            {laborSum.byEmployee.map((row) => (
                              <div
                                key={row.employeeId}
                                className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40"
                              >
                                <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{row.name}</p>
                                <div className="mt-2 flex items-center justify-between text-sm">
                                  <span className="text-zinc-500 dark:text-zinc-400">
                                    {tl.labor_hours_worked ?? "Hours"}
                                  </span>
                                  <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                                    {row.hours.toFixed(1)}h
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-sm">
                                  <span className="text-zinc-500 dark:text-zinc-400">
                                    {tl.labor_cost_column ?? "Cost"}
                                  </span>
                                  <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                                    {formatCurrency(row.cost, companyCurrency, dateLoc)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="hidden overflow-x-auto md:block">
                            <table className="w-full min-w-[280px] text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-zinc-200 dark:border-slate-600 text-left text-zinc-500 dark:text-zinc-400">
                                  <th className="py-2 pe-2 font-medium">{tl.personnel ?? PM_EN.personnel}</th>
                                  <th className="py-2 pe-2 font-medium text-right">
                                    {tl.labor_hours_worked ?? "Hours"}
                                  </th>
                                  <th className="py-2 font-medium text-right">
                                    {tl.labor_cost_column ?? "Cost"}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {laborSum.byEmployee.map((row) => (
                                  <tr
                                    key={row.employeeId}
                                    className="border-b border-zinc-100 dark:border-slate-800 text-zinc-800 dark:text-zinc-200"
                                  >
                                    <td className="py-2 pe-2 min-w-0 truncate">{row.name}</td>
                                    <td className="py-2 pe-2 text-right tabular-nums">{row.hours.toFixed(1)}h</td>
                                    <td className="py-2 text-right tabular-nums">
                                      {formatCurrency(row.cost, companyCurrency, dateLoc)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </section>
            ) : null}

            {canUploadPhotos && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                  {t.progressPhotos ?? PM_EN.progressPhotos}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setPhotoCategoryModal({ projectId: selectedProject.id }); setPhotoCategoryToSubmit("progress"); }}
                    className="flex min-h-[44px] items-center gap-3 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-5 py-4 transition-colors"
                  >
                    <Camera className="h-5 w-5 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">
                        {t.progressPhotos ?? PM_EN.progressPhotos}
                      </p>
                      <p className="text-xs opacity-70">
                        {t.progressPhotosSub ?? PM_EN.progressPhotosSub}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onPhotoInventario(selectedProject.id)}
                    className="flex min-h-[44px] items-center gap-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 text-orange-700 dark:text-orange-300 px-5 py-4 transition-colors"
                  >
                    <Package className="h-5 w-5 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">
                        {t.whPhotoForInventory ?? PM_EN.whPhotoForInventory}
                      </p>
                      <p className="text-xs opacity-70">
                        {t.whInventoryAtSite ?? PM_EN.whInventoryAtSite}
                      </p>
                    </div>
                  </button>
                </div>
                <textarea
                  value={photoNotes}
                  onChange={(e) => setPhotoNotes(e.target.value)}
                  placeholder={t.photoNotesPlaceholder ?? PM_EN.photoNotesPlaceholder}
                  className="mt-3 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[80px] resize-none"
                  rows={2}
                />
              </div>
            )}
          </div>
        )}

        {/* ══ TAB PERSONAL ══ */}
        {activeTab === "personal" && (
          <div className="space-y-3">
            {assignedEmployees.length === 0 ? (
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                text={t.noAssignedPersonnel ?? PM_EN.noAssignedPersonnel}
              />
            ) : (
              assignedEmployees.map((emp) => {
                const certState = getCertState(emp.certificates);
                const isExpanded = expandedEmployeeId === emp.id;
                const today = new Date().toISOString().slice(0, 10);
                return (
                  <div key={emp.id} className="rounded-xl border border-zinc-200 dark:border-slate-700 overflow-hidden">
                    <div className="flex items-center gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                        className="flex-1 flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-zinc-50 dark:hover:bg-slate-800/50 transition-colors min-w-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 text-sm font-bold text-amber-700 dark:text-amber-400">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{emp.name}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{emp.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <SecurityBadge state={certState} labels={t} />
                          <span className={`text-zinc-400 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}>›</span>
                        </div>
                      </button>
                      {canManageProjectTeam && (
                        <button
                          type="button"
                          onClick={() => {
                            const current = selectedProject?.assignedEmployeeIds ?? [];
                            onUpdateProjectEmployees?.(selectedProject!.id, current.filter((id) => id !== emp.id));
                          }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-zinc-200 dark:border-slate-700 px-4 py-4 space-y-4 bg-zinc-50/50 dark:bg-slate-800/30">
                        <div className="flex flex-wrap gap-3">
                          {emp.phone && (
                            <a href={`tel:${emp.phone}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">📞 {emp.phone}</a>
                          )}
                          {emp.email && (
                            <a href={`mailto:${emp.email}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">✉️ {emp.email}</a>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">Certificados de seguridad</p>
                          {emp.certificates.length === 0 ? (
                            <p className="text-xs text-zinc-400 italic">Sin certificados registrados</p>
                          ) : (
                            <div className="space-y-1.5">
                              {(emp.certificates || []).map((cert) => {
                                const expired = cert.expiryDate && cert.expiryDate < today;
                                const expiringSoon = cert.expiryDate && !expired && daysLeft(cert.expiryDate) <= 30;
                                return (
                                  <div
                                    key={cert.id}
                                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs border ${
                                      expired
                                        ? "border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20"
                                        : expiringSoon
                                        ? "border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20"
                                        : "border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                    }`}
                                  >
                                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{cert.name}</span>
                                    <span className={expired ? "text-red-500" : expiringSoon ? "text-amber-600 dark:text-amber-400" : "text-zinc-400"}>
                                      {cert.expiryDate
                                        ? expired
                                          ? "⚠ Vencido"
                                          : expiringSoon
                                          ? `⚡ ${daysLeft(cert.expiryDate)}d`
                                          : `✓ ${fmtYmd(cert.expiryDate ?? "")}`
                                        : "Sin fecha"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {canManageProjectTeam && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-slate-700">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {tl.projects_team_add_employee ?? PM_EN.projects_team_add_employee}
                </p>
                <div className="flex gap-2">
                  <select
                    value={addEmployeeToProjectId}
                    onChange={(e) => setAddEmployeeToProjectId(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                  >
                    <option value="">{tl.projects_team_select_employee ?? PM_EN.projects_team_select_employee}</option>
                    {(allEmployees ?? []).filter((e) => !(selectedProject?.assignedEmployeeIds ?? []).includes(e.id)).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!addEmployeeToProjectId}
                    onClick={() => {
                      if (!selectedProject || !addEmployeeToProjectId) return;
                      let rows = parseSafetyRequirementsJson(selectedProject.safetyRequirements);
                      if (rows.length === 0)
                        rows = defaultProjectSafetyRequirements(countryCode, selectedProject.type);
                      const emp = (allEmployees ?? []).find((e) => e.id === addEmployeeToProjectId);
                      const certReqs = rows.filter((r) => r.category === "certification");
                      const missing = emp
                        ? certReqs.some(
                            (req) =>
                              !findCertForRequirement(
                                (emp.certificates ?? []).map((c) => ({
                                  name: c.name,
                                  expiryDate: c.expiryDate,
                                })),
                                req
                              )
                          )
                        : false;
                      if (missing) {
                        showToast(
                          "warning",
                          tl.project_safety_missing_cert ?? PM_EN.project_safety_missing_cert
                        );
                      }
                      const current = selectedProject.assignedEmployeeIds ?? [];
                      onUpdateProjectEmployees?.(selectedProject.id, [...current, addEmployeeToProjectId]);
                      setAddEmployeeToProjectId("");
                    }}
                    className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-500 disabled:opacity-50 min-h-[44px]"
                  >
                    {tl.projects_team_add ?? PM_EN.projects_team_add}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB INVENTARIO ══ */}
        {activeTab === "inventario" && (
          <div className="space-y-6">
            {canEdit && (
              <div className="mb-4 flex flex-wrap gap-2">
                <div className="flex-1 min-w-[220px] flex gap-2">
                  <select
                    value={addItemToProjectId}
                    onChange={(e) => setAddItemToProjectId(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                  >
                    <option value="">{tl.projects_inv_select_item ?? PM_EN.projects_inv_select_item}</option>
                    {(inventoryItems ?? []).filter((i) => !i.assignedToProjectId).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.quantity} {i.unit})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!addItemToProjectId}
                    onClick={() => {
                      if (!selectedProject || !addItemToProjectId) return;
                      onUpdateItemProject?.(addItemToProjectId, selectedProject.id);
                      setAddItemToProjectId("");
                    }}
                    className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-500 disabled:opacity-50 min-h-[44px]"
                  >
                    {tl.projects_inv_assign ?? PM_EN.projects_inv_assign}
                  </button>
                </div>
                {onOpenResourceRequest && selectedProject && (
                  <button
                    type="button"
                    onClick={() => onOpenResourceRequest(selectedProject.id)}
                    className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 text-sm font-medium min-h-[44px] transition-colors"
                  >
                    <PackagePlus className="h-4 w-4" />
                    {t.requestResources ?? PM_EN.requestResources}
                  </button>
                )}
              </div>
            )}
            {/* Materiales */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Boxes className="h-4 w-4 text-amber-500 shrink-0" />
                {tl.projects_inv_materials_assigned ?? PM_EN.projects_inv_materials_assigned}
              </h3>
              {projectMaterials.length === 0 ? (
                <p className="text-sm text-zinc-400 italic">
                  {t.noProjectMaterials ?? PM_EN.noProjectMaterials}
                </p>
              ) : (
                <>
                  <div className="space-y-2 md:hidden">
                    {projectMaterials.map((item) => (
                      <div
                        key={item.id}
                        className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {tl.quantity ?? PM_EN.quantity}: {item.quantity} {item.unit}
                          </p>
                        </div>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => onUpdateItemProject?.(item.id, null)}
                            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                            aria-label={tl.common_delete ?? PM_EN.common_delete}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-hidden rounded-xl border border-zinc-200 dark:border-slate-700 md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[320px] text-sm">
                        <thead className="bg-zinc-50 dark:bg-slate-800">
                          <tr className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            <th className="px-4 py-2.5 text-left">{tl.material ?? PM_EN.material}</th>
                            <th className="px-4 py-2.5 text-right">{tl.quantity ?? PM_EN.quantity}</th>
                            {canEdit && <th className="w-12 px-4 py-2.5" />}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
                          {projectMaterials.map((item) => (
                            <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100 break-words">
                                {item.name}
                              </td>
                              <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                {item.quantity} {item.unit}
                              </td>
                              {canEdit && (
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => onUpdateItemProject?.(item.id, null)}
                                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                                    aria-label={tl.common_delete ?? PM_EN.common_delete}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Herramientas */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-500" />{t.whToolsOnSite ?? PM_EN.whToolsOnSite}
              </h3>
              {projectTools.length === 0 ? (
                <p className="text-sm text-zinc-400 italic">
                  {t.noProjectTools ?? PM_EN.noProjectTools}
                </p>
              ) : (
                <div className="space-y-2">
                  {projectTools.map((tool) => {
                    const assignedTo = (allEmployees ?? []).find((e) => e.id === tool.assignedToEmployeeId);
                    const statusColor =
                      tool.toolStatus === "available"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        : tool.toolStatus === "in_use"
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        : tool.toolStatus === "maintenance"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : tool.toolStatus === "out_of_service"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        : tool.toolStatus === "lost"
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
                    const statusLabel = projectToolStatusLabel(tool.toolStatus, tl);
                    return (
                      <div key={tool.id} className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-slate-700 px-4 py-3">
                        <div className="flex items-center gap-3">
                          {tool.imageUrl ? (
                            <img src={cloudinaryThumb(tool.imageUrl)} alt={tool.name} className="h-9 w-9 rounded-lg object-cover border border-zinc-200 dark:border-slate-700" />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-slate-800 flex items-center justify-center">
                              <Wrench className="h-4 w-4 text-zinc-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{tool.name}</p>
                            {assignedTo && <p className="text-xs text-zinc-500 dark:text-zinc-400">{assignedTo.name}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                          {canEdit && tool.toolStatus === "in_use" && onReturnToolFromProject && (
                            <button
                              type="button"
                              onClick={() => onReturnToolFromProject(tool.id)}
                              className="text-xs rounded-lg border border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400 px-2 py-1 hover:bg-amber-50 dark:hover:bg-amber-950/30 min-h-[44px] min-w-[44px] transition-colors"
                            >
                              {(t as Record<string, string>).returnToWarehouse ?? PM_EN.returnToWarehouse}
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onUpdateItemProject?.(tool.id, null)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fotos de inventario */}
            {invPhotos.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-orange-500" />{t.invPhotosTitle ?? PM_EN.invPhotosTitle}
                </h3>
                <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
                  {invPhotos.flatMap((entry) =>
                    (entry.photoUrls || []).map((url, i) => (
                      <button
                        key={`${entry.id}-${i}`}
                        type="button"
                        onClick={() => setLightbox({ src: cloudinaryFull(url), fallback: url })}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-slate-700 bg-zinc-100 dark:bg-slate-800"
                      >
                        <img
                          src={cloudinaryThumb(url)}
                          alt={tl.inv_photo_alt ?? PM_EN.inv_photo_alt}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                          <p className="text-white text-xs truncate">{entry.date}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {projectInventory.length === 0 && invPhotos.length === 0 && (
              <EmptyState
                icon={<Package className="h-8 w-8" />}
                text={t.noProjectInventory ?? PM_EN.noProjectInventory}
              />
            )}
          </div>
        )}

        {/* ══ TAB GALERÍA ══ */}
        {activeTab === "galeria" && (
          <div className="space-y-6">
            <input
              ref={galleryPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGalleryPhotoChange}
            />
            <div
              className="-mx-4 flex flex-nowrap gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory border-b border-zinc-200 px-4 pb-3 dark:border-slate-700 sm:mx-0 sm:px-0 [scrollbar-width:thin]"
              role="tablist"
              aria-label={(t as Record<string, string>).galleryTabBrowse ?? PM_EN.galleryTabBrowse}
            >
              <button
                type="button"
                role="tab"
                aria-selected={gallerySubTab === "browse"}
                onClick={() => setGallerySubTab("browse")}
                className={`min-h-[44px] shrink-0 snap-start rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  gallerySubTab === "browse"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-slate-800"
                }`}
              >
                {(t as Record<string, string>).galleryTabBrowse ?? PM_EN.galleryTabBrowse}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={gallerySubTab === "inspection"}
                onClick={() => setGallerySubTab("inspection")}
                className={`min-h-[44px] shrink-0 snap-start rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  gallerySubTab === "inspection"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-slate-800"
                }`}
              >
                {(t as Record<string, string>).galleryTabInspection ?? PM_EN.galleryTabInspection}
              </button>
            </div>
            {galleryXferBanner ? (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100"
                role="status"
                aria-live="polite"
              >
                {galleryXferBanner}
              </div>
            ) : null}
            {gallerySubTab === "browse" && (
            <>
            <div className="flex flex-wrap gap-2 items-stretch">
              <button
                type="button"
                onClick={() => {
                  pendingUploadCategoryRef.current = null;
                  if (selectedProjectId) setShowCategoryModal(true);
                }}
                disabled={!selectedProjectId || galleryUploadBusy}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/80 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 min-h-[44px] min-w-[44px] transition-colors hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60 sm:w-auto sm:justify-start ${galleryUploadBusy ? "opacity-50" : ""}`}
              >
                {galleryUploadBusy ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Camera className="h-5 w-5 shrink-0" aria-hidden />
                )}
                {(t as Record<string, string>).uploadPhoto ?? PM_EN.uploadPhoto}
              </button>
              {pdfSourcePhotos.length > 0 && selectedProject && (
                <button
                  type="button"
                  onClick={() => setPdfConfigOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-100 min-h-[44px] transition-colors hover:bg-zinc-50 dark:hover:bg-slate-800 sm:w-auto sm:justify-start"
                >
                  <FileDown className="h-5 w-5 shrink-0" aria-hidden />
                  {(t as Record<string, string>).generatePDF ?? PM_EN.generatePDF}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "progress", "incident", "health_safety"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setGalleryCategoryFilter(cat)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] border transition-colors ${
                    galleryCategoryFilter === cat
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                      : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {cat === "all"
                    ? ((t as Record<string, string>).whFilterAll ?? PM_EN.whFilterAll)
                    : cat === "progress"
                    ? ((t as Record<string, string>).photoProgress ?? PM_EN.photoProgress)
                    : cat === "incident"
                    ? ((t as Record<string, string>).photoIncident ?? PM_EN.photoIncident)
                    : (t as Record<string, string>).photoHealthSafety ?? PM_EN.photoHealthSafety}
                </button>
              ))}
            </div>
            {/* Pendientes de aprobación */}
            {canApprove && filteredPendingObra.length > 0 && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 flex-wrap">
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    {t.pendingPhotosReview ?? PM_EN.pendingPhotosReview}
                    <span className="rounded-full bg-amber-500 text-white text-xs font-bold px-2 py-0.5">
                      {filteredPendingObra.length}
                    </span>
                  </h3>
                  <div
                    className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 gap-0.5"
                    role="group"
                    aria-label={(t as Record<string, string>).listView ?? PM_EN.listView}
                  >
                    <button
                      type="button"
                      aria-pressed={pendingViewMode === "list"}
                      onClick={() => setPendingViewMode("list")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-2.5 text-xs font-medium min-h-[44px] min-w-[44px] transition-colors ${
                        pendingViewMode === "list"
                          ? "bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
                      }`}
                      title={(t as Record<string, string>).listView ?? PM_EN.listView}
                    >
                      <List className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="hidden sm:inline">{(t as Record<string, string>).listViewShort ?? PM_EN.listViewShort}</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={pendingViewMode === "grid"}
                      onClick={() => setPendingViewMode("grid")}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-2.5 text-xs font-medium min-h-[44px] min-w-[44px] transition-colors ${
                        pendingViewMode === "grid"
                          ? "bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
                      }`}
                      title={(t as Record<string, string>).gridView ?? PM_EN.gridView}
                    >
                      <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="hidden sm:inline">{(t as Record<string, string>).gridViewShort ?? PM_EN.gridViewShort}</span>
                    </button>
                  </div>
                </div>
                {pendingViewMode === "list" ? (
                  <div className="space-y-3">
                    {filteredPendingObra.map((entry) => {
                      const cat = entry.photoCategory ?? "progress";
                      const catBadgeClass =
                        cat === "progress"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : cat === "incident"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
                      const catLabel = getCategoryLabel(cat, t as Record<string, string>);
                      return (
                        <div
                          key={entry.id}
                          className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/10 p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${catBadgeClass}`}>
                                {catLabel}
                              </span>
                              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">
                                {(allEmployees ?? []).find((e) => e.id === entry.submittedByEmployeeId)?.name ??
                                  t.workerLabel ?? PM_EN.workerLabel}{" "}
                                · {entry.date}
                              </p>
                              {entry.notes && (
                                <p className="text-xs text-zinc-500 mt-0.5 italic">&ldquo;{entry.notes}&rdquo;</p>
                              )}
                            </div>
                            <PhotoStatusBadge status={entry.status} labels={t} />
                          </div>
                          <HorizontalScrollFade>
                            <div className="flex gap-2 overflow-x-auto pb-1 mb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0">
                            {(entry.photoUrls || []).map((url, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setLightbox({ src: cloudinaryFull(url), fallback: url })}
                                className="h-24 w-24 shrink-0 rounded-lg overflow-hidden border border-zinc-200 dark:border-slate-700"
                              >
                                <img src={cloudinaryThumb(url)} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                              </button>
                            ))}
                            </div>
                          </HorizontalScrollFade>
                          <img
                            src={cloudinaryThumb(entry.photoUrls[0])}
                            alt=""
                            className="w-full h-48 object-cover rounded-lg mb-3"
                          />
                          <p className="text-xs text-gray-500 mb-2">
                            {entry.submittedByName} · {formatDateTimeIntl(entry.createdAt, dateLoc, userTz)}
                          </p>
                          {(currentUserRole === "admin" || currentUserRole === "supervisor") && (
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => onApproveDiaryEntry?.(entry.id)}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2.5 text-xs font-medium min-h-[44px] transition-colors"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t.accept ?? PM_EN.accept}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModalId(entry.id);
                                  setRejectReason("");
                                }}
                                className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 px-3 py-2.5 text-xs font-medium min-h-[44px] transition-colors"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                {t.reject ?? PM_EN.reject}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
                    {filteredPendingObra.map((entry) => {
                      const cat = entry.photoCategory ?? "progress";
                      const catBadgeClass =
                        cat === "progress"
                          ? "bg-emerald-600/90 text-white"
                          : cat === "incident"
                            ? "bg-red-600/90 text-white"
                            : "bg-blue-600/90 text-white";
                      const catLabel = getCategoryLabel(cat, t as Record<string, string>);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setPendingDetailEntry(entry)}
                          className="group relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-100 dark:bg-slate-800 text-left focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                        >
                          <img
                            src={cloudinaryThumb(entry.photoUrls[0])}
                            alt=""
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <span
                            className={`absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ${catBadgeClass}`}
                          >
                            {catLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Fotos aprobadas */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  {t.approvedProgressTitle ?? PM_EN.approvedProgressTitle}
                  <span className="text-xs text-zinc-400 font-normal">
                    ({filteredApprovedObra.length}{" "}
                    {filteredApprovedObra.length === 1
                      ? t.photoSingular ?? PM_EN.photoSingular
                      : t.photosPlural ?? PM_EN.photosPlural}
                    )
                  </span>
                </h3>
                {canManageProjectGallery &&
                  filteredApprovedObra.some(
                    (e) => isGalleryDownloadableStatus(e.status) && !!e.photoUrls[0]
                  ) && (
                    <button
                      type="button"
                      disabled={galleryBulkProgress !== null}
                      onClick={() => void runBulkApprovedGalleryDownload()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50 motion-safe:transition-colors dark:border-zinc-600 dark:bg-slate-900 dark:text-zinc-100 dark:hover:bg-slate-800"
                    >
                      <Download className="h-5 w-5 shrink-0" aria-hidden />
                      {(t as Record<string, string>).gallery_download_all ?? PM_EN.gallery_download_all}
                    </button>
                  )}
              </div>
              {filteredApprovedObra.length === 0 ? (
                <EmptyState
                  icon={<ImageIcon className="h-8 w-8" />}
                  text={t.noApprovedPhotos ?? PM_EN.noApprovedPhotos}
                />
              ) : (
                <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
                  {filteredApprovedObra.map((entry) => {
                    const showDl =
                      selectedProject &&
                      isGalleryDownloadableStatus(entry.status) &&
                      canUserDownloadThisGalleryPhoto(entry.submittedByEmployeeId);
                    return (
                      <div
                        key={entry.id}
                        className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600"
                      >
                        <div className="relative">
                          <img
                            src={cloudinaryThumb(entry.photoUrls[0])}
                            alt=""
                            className="w-full h-40 object-cover"
                          />
                          {showDl ? (
                            <button
                              type="button"
                              onClick={() => void downloadDiaryPhoto(entry)}
                              className="absolute right-1 top-1 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-black/55 text-white hover:bg-black/70 dark:bg-black/60"
                              aria-label={
                                (t as Record<string, string>).gallery_download ?? PM_EN.gallery_download
                              }
                            >
                              <Download className="h-5 w-5 shrink-0" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-900">
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {getCategoryLabel(entry.photoCategory ?? "progress", t as Record<string, string>)}
                          </span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{entry.submittedByName}</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">
                            {formatDateIntl(new Date(entry.createdAt), dateLoc, userTz)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </>
            )}
            {gallerySubTab === "inspection" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 items-stretch">
                  <button
                    type="button"
                    onClick={() => {
                      pendingUploadCategoryRef.current = null;
                      if (selectedProjectId) setShowCategoryModal(true);
                    }}
                    disabled={!selectedProjectId}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/80 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 min-h-[44px] transition-colors hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60 sm:w-auto sm:justify-start"
                  >
                    <Camera className="h-5 w-5 shrink-0" aria-hidden />
                    {(t as Record<string, string>).uploadPhoto ?? PM_EN.uploadPhoto}
                  </button>
                  {canManageProjectGallery && inspectionPhotosPool.length > 0 && (
                    <button
                      type="button"
                      onClick={openInspectionReportModal}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-100 min-h-[44px] transition-colors hover:bg-zinc-50 dark:hover:bg-slate-800 sm:w-auto sm:justify-start"
                    >
                      <FileDown className="h-5 w-5 shrink-0" aria-hidden />
                      {(t as Record<string, string>).inspection_report_generate ?? PM_EN.inspection_report_generate}
                    </button>
                  )}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {(t as Record<string, string>).inspection_report_tab_hint ?? PM_EN.inspection_report_tab_hint}
                </p>
                {inspectionPhotosPool.length === 0 ? (
                  <EmptyState
                    icon={<HardHat className="h-8 w-8" />}
                    text={
                      (t as Record<string, string>).inspection_report_empty ?? PM_EN.inspection_report_empty
                    }
                  />
                ) : (
                  <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
                    {[...inspectionPhotosPool]
                      .sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      )
                      .map((ph) => {
                        const showDl =
                          !!selectedProject &&
                          isGalleryDownloadableStatus(ph.status) &&
                          canUserDownloadThisGalleryPhoto(ph.submitted_by_employee_id ?? null);
                        return (
                          <div
                            key={ph.id}
                            className="group relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-100 dark:bg-slate-800"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setLightbox({ src: cloudinaryFull(ph.photo_url), fallback: ph.photo_url })
                              }
                              className="absolute inset-0 z-0 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                              aria-label={
                                (t as Record<string, string>).gallery_view_photo ?? PM_EN.gallery_view_photo
                              }
                            />
                            <img
                              src={cloudinaryThumb(ph.photo_url)}
                              alt=""
                              className="pointer-events-none h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            <span
                              className={`pointer-events-none absolute left-2 top-2 z-[1] max-w-[calc(100%-1rem)] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ${
                                ph.photo_category === "incident"
                                  ? "bg-red-600/90 text-white"
                                  : "bg-blue-600/90 text-white"
                              }`}
                            >
                              {getCategoryLabel(ph.photo_category, t as Record<string, string>)}
                            </span>
                            {ph.notes?.trim() ? (
                              <span className="pointer-events-none absolute bottom-0 inset-x-0 z-[1] bg-black/55 px-2 py-1 text-[10px] leading-snug text-white line-clamp-2">
                                {ph.notes.trim()}
                              </span>
                            ) : null}
                            {showDl ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void downloadProjectPhotoRow(ph);
                                }}
                                className="absolute right-1 top-1 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-black/55 text-white hover:bg-black/70 dark:bg-black/60"
                                aria-label={
                                  (t as Record<string, string>).gallery_download ?? PM_EN.gallery_download
                                }
                              >
                                <Download className="h-5 w-5 shrink-0" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB PLANOS ══ */}
        {activeTab === "blueprints" && selectedProject && (
          <BlueprintViewer
            t={t as Record<string, string>}
            companyId={companyId || null}
            projectId={selectedProject.id}
            projectName={selectedProject.name}
            userProfileId={currentUserProfileId ?? null}
            userName={
              currentUserDisplayName ||
              currentUserName ||
              (t as Record<string, string>).admin ||
              "User"
            }
            userRole={currentUserRole ?? "worker"}
            onNavigateToHazard={onOpenHazardFromBlueprint}
            onNavigateToCorrective={onOpenCorrectiveFromBlueprint}
            dateLocale={dateLoc}
            timeZone={userTz}
            annotationNotifyUserIds={blueprintAnnotationNotifyUserIds}
          />
        )}

        {/* ══ TAB FORMULARIOS ══ */}
        {activeTab === "formularios" && selectedProject && (
          <div className="p-4 space-y-4">
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-slate-800/50 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {(t as Record<string, string>).dailyReport ??
                  (t as Record<string, string>).dailyFieldReportsTitle ??
                  (t as Record<string, string>).dailyFieldReport ?? PM_EN.dailyFieldReport}
              </h2>
              {canManageDailyReports && dailyReportsListForUi.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setDailyReportViewVariant("full");
                    setOpenDailyReportKey("new");
                  }}
                  className="flex w-full sm:w-auto items-center gap-2 rounded-xl border-2 border-amber-500 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-200 min-h-[44px]"
                >
                  <Plus className="h-4 w-4" />
                  {(t as Record<string, string>).newDailyReport ?? PM_EN.newDailyReport}
                </button>
              ) : null}
              {dailyReportsListForUi.length === 0 ? (
                <ModuleEmptyState
                  illustration={<EmptyIllustrationFolder />}
                  title={(t as Record<string, string>).dailyReport ?? PM_EN.dailyFieldReport}
                  message={(t as Record<string, string>).noDailyReportsYet ?? PM_EN.noDailyReportsYet}
                  actionLabel={
                    canManageDailyReports
                      ? ((t as Record<string, string>).newDailyReport ?? PM_EN.newDailyReport)
                      : undefined
                  }
                  onAction={
                    canManageDailyReports
                      ? () => {
                          setDailyReportViewVariant("full");
                          setOpenDailyReportKey("new");
                        }
                      : undefined
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {dailyReportsListForUi.map((dr) => {
                    const tl = t as Record<string, string>;
                    const st =
                      dr.status === "draft"
                        ? {
                            label: tl.daily_report_status_draft ?? tl.reportStatusDraft ?? tl.formStatusDraft ?? PM_EN.draft,
                            cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
                          }
                        : dr.status === "approved"
                          ? {
                              label: tl.daily_report_status_approved ?? PM_EN.approved ?? "Approved",
                              cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200",
                            }
                          : {
                              label: tl.daily_report_status_sent ?? tl.reportStatusPublished ?? PM_EN.published,
                              cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
                            };
                    const sigN = dr.signatures.length;
                    const tot = Math.max(assignedEmployees.length, projectProfileAssignees.length, 1);
                    return (
                      <li key={dr.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setDailyReportViewVariant(currentUserRole === "worker" ? "employee" : "full");
                            setOpenDailyReportKey(dr.id);
                          }}
                          className="flex w-full min-h-[44px] flex-col gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm hover:border-amber-300 dark:border-zinc-600 dark:bg-slate-900 dark:hover:border-amber-600 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="font-medium text-zinc-900 dark:text-white">
                            {formatReportDate(dr.date, language ?? "es", countryCode)}{" "}
                            <span className="text-zinc-500 font-normal">
                              · {sigN}/{tot} {tl.dailyReportSignaturesShort ?? PM_EN.dailyReportSignaturesShort}
                            </span>
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {currentUserRole !== "worker" && (
            <>
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-slate-800/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex flex-wrap items-center gap-2">
                  {(t as Record<string, string>).todoList ?? PM_EN.todoList}
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                    {pendingTaskCount}
                  </span>
                </h2>
                {(currentUserRole === "admin" || currentUserRole === "supervisor") && (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskDraft({
                        title: "",
                        description: "",
                        priority: "medium",
                        assignedToEmployeeId: "",
                        dueDate: "",
                      });
                      setTaskModal("new");
                    }}
                    className="flex w-full sm:w-auto items-center gap-2 rounded-xl border-2 border-emerald-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 min-h-[44px]"
                  >
                    <Plus className="h-4 w-4" />
                    {(t as Record<string, string>).newTask ?? PM_EN.newTask}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label={(t as Record<string, string>).todoList ?? PM_EN.todoList}>
                {(
                  [
                    ["all", "taskFilterAll"] as const,
                    ["pending", "taskFilterPending"] as const,
                    ["in_progress", "taskFilterInProgress"] as const,
                    ["completed", "taskFilterCompleted"] as const,
                  ] as const
                ).map(([fid, lk]) => (
                  <button
                    key={fid}
                    type="button"
                    role="tab"
                    aria-selected={taskFilter === fid}
                    onClick={() => setTaskFilter(fid)}
                    className={`rounded-xl px-4 py-2.5 text-xs font-medium min-h-[44px] min-w-[44px] transition-colors ${
                      taskFilter === fid
                        ? "bg-emerald-600 text-white dark:bg-emerald-600"
                        : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-slate-900 dark:text-zinc-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    {(t as Record<string, string>)[lk] ?? fid}
                  </button>
                ))}
              </div>
              {filteredProjectTasks.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {(t as Record<string, string>).noTasks ?? PM_EN.noTasks}
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredProjectTasks.map((tk) => {
                    const tl = t as Record<string, string>;
                    const today = todayYmdLocal();
                    const isDone = tk.status === "completed";
                    const due = tk.dueDate;
                    let dueClass = "text-zinc-600 dark:text-zinc-400";
                    let dueExtra: string | null = null;
                    if (due && !isDone) {
                      if (due < today) {
                        dueClass = "text-red-600 dark:text-red-400 font-medium";
                        dueExtra = tl.taskOverdue ?? PM_EN.taskOverdue;
                      } else if (due === today) {
                        dueClass = "text-amber-600 dark:text-amber-500 font-medium";
                        dueExtra = tl.taskDueToday ?? PM_EN.taskDueToday;
                      }
                    }
                    const pr =
                      tk.priority === "urgent"
                        ? {
                            emoji: "🔴",
                            label: tl.taskPriorityUrgent ?? PM_EN.taskPriorityUrgent,
                            cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
                          }
                        : tk.priority === "high"
                          ? {
                              emoji: "🟠",
                              label: tl.taskPriorityHigh ?? PM_EN.taskPriorityHigh,
                              cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
                            }
                          : tk.priority === "medium"
                            ? {
                                emoji: "🟡",
                                label: tl.taskPriorityMedium ?? PM_EN.taskPriorityMedium,
                                cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
                              }
                            : {
                                emoji: "🟢",
                                label: tl.taskPriorityLow ?? PM_EN.taskPriorityLow,
                                cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
                              };
                    const displayName =
                      tk.assignedToName ||
                      (tk.assignedToEmployeeId
                        ? assignedEmployees.find((e) => e.id === tk.assignedToEmployeeId)?.name
                        : undefined) ||
                      tl.taskUnassigned ||
                      "—";
                    return (
                      <li
                        key={tk.id}
                        className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-slate-900 p-3"
                      >
                        <div className="flex gap-2 sm:gap-3">
                          <button
                            type="button"
                            aria-label={
                              isDone
                                ? `${tl.taskStatusCompleted ?? PM_EN.taskStatusCompleted} — ${tk.title}`
                                : `${tl.taskStatusCompleted ?? PM_EN.taskStatusCompleted} — ${tk.title}`
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isDone) {
                                onUpdateTask?.(tk.id, {
                                  status: "pending",
                                  completedAt: undefined,
                                  completedBy: undefined,
                                });
                              } else {
                                onUpdateTask?.(tk.id, {
                                  status: "completed",
                                  completedAt: new Date().toISOString(),
                                  completedBy:
                                    currentUserDisplayName || currentUserName || tl.preparedBy || "",
                                });
                              }
                            }}
                            className="shrink-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300"
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Circle className="h-6 w-6" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTaskDraft({
                                title: tk.title,
                                description: tk.description ?? "",
                                priority: tk.priority,
                                assignedToEmployeeId: tk.assignedToEmployeeId ?? "",
                                dueDate: tk.dueDate ?? "",
                              });
                              setTaskModal(tk.id);
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p
                              className={`font-medium text-sm text-zinc-900 dark:text-white ${
                                isDone ? "line-through opacity-70" : ""
                              }`}
                            >
                              {tk.title}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${pr.cls}`}>
                                <span aria-hidden>{pr.emoji}</span>
                                {pr.label}
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                                <span
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                                  aria-hidden
                                >
                                  {initialsFromName(displayName)}
                                </span>
                                <span>{displayName}</span>
                              </span>
                              {due && (
                                <span className={dueClass}>
                                  {fmtYmd(due)}
                                  {dueExtra ? ` · ${dueExtra}` : ""}
                                </span>
                              )}
                            </div>
                          </button>
                          {currentUserRole === "admin" && (
                            <button
                              type="button"
                              aria-label={tl["delete"] ?? PM_EN.delete}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTask?.(tk.id);
                              }}
                              className="shrink-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {canCreateMachinFormFromProjectResolved && (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 w-full sm:w-auto rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-4 py-3 text-sm font-medium min-h-[44px] transition-colors"
              >
                <Plus className="h-4 w-4" />
                {(t as Record<string, string>).createForm ?? PM_EN.createForm}
              </button>
            )}

            {projectForms_filtered.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  {(t as Record<string, string>).noForms ?? PM_EN.noForms}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {projectForms_filtered.map((form) => {
                  const tl = t as Record<string, string>;
                  const linkedCl =
                    form.type === "safety" && form.safetyChecklistId
                      ? safetyChecklists.find((c) => c.id === form.safetyChecklistId)
                      : undefined;
                  const openSafety = () => {
                    if (form.type === "safety" && form.safetyChecklistId)
                      setOpenSafetyChecklistId(form.safetyChecklistId);
                  };
                  const statusLabel =
                    form.type === "safety" && linkedCl
                      ? linkedCl.status === "draft"
                        ? tl.checklistStatusDraft ?? tl.formStatusDraft ?? PM_EN.draft
                        : linkedCl.status === "completed"
                          ? tl.checklistStatusCompleted ?? tl.formStatusCompleted ?? PM_EN.formStatusCompleted
                          : tl.checklistStatusSubmitted ?? PM_EN.checklistStatusSubmitted
                      : form.status === "active"
                        ? tl.formStatusActive ?? PM_EN.formStatusActive
                        : form.status === "completed"
                          ? tl.formStatusCompleted ?? PM_EN.formStatusCompleted
                          : tl.formStatusDraft ?? PM_EN.draft;
                  const statusClass =
                    form.type === "safety" && linkedCl
                      ? linkedCl.status === "draft"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : linkedCl.status === "completed"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      : form.status === "active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : form.status === "completed"
                          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
                  return (
                    <div
                      key={form.id}
                      className={`rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 p-4 ${
                        form.type === "safety" && form.safetyChecklistId
                          ? "cursor-pointer hover:border-amber-400 dark:hover:border-amber-600"
                          : ""
                      }`}
                      role={form.type === "safety" && form.safetyChecklistId ? "button" : undefined}
                      tabIndex={form.type === "safety" && form.safetyChecklistId ? 0 : undefined}
                      onClick={form.type === "safety" ? openSafety : undefined}
                      onKeyDown={(e) => {
                        if (form.type !== "safety" || !form.safetyChecklistId) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openSafety();
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white text-sm">{form.title}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {form.type === "inspection"
                              ? tl.formTypeInspection ?? PM_EN.formTypeInspection
                              : form.type === "tailgate"
                                ? tl.formTypeTailgate ?? PM_EN.formTypeTailgate
                                : form.type === "safety"
                                  ? tl.formTypeSafety ?? PM_EN.formTypeSafety
                                  : tl.formTypeCustom ?? PM_EN.formTypeCustom}
                            {form.type === "safety" && linkedCl
                              ? ` · ${linkedCl.items.length} ${tl.checklistItemsLabel ?? PM_EN.checklistItemsLabel}`
                              : ` · ${form.responses.length} ${tl.responses ?? PM_EN.responses}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                            {statusLabel}
                          </span>
                          {canDeleteProjectFormEntryResolved && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteForm?.(form.id);
                              }}
                              className="rounded-lg p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {showCreateForm && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                  <h3 className="font-semibold text-zinc-900 dark:text-white">
                    {(t as Record<string, string>).createForm ?? PM_EN.createForm}
                  </h3>
                  {selectedProject && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {(t as Record<string, string>).form_lbl_project ?? PM_EN.form_lbl_project}:{" "}
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {selectedProject.name}
                      </span>
                    </p>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      {(t as Record<string, string>).forms_modal_category ?? PM_EN.forms_modal_category}
                    </label>
                    <select
                      value={newFormType}
                      onChange={(e) => setNewFormType(e.target.value as ProjectForm["type"])}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    >
                      <option value="inspection">
                        {(t as Record<string, string>).formTypeInspection ?? PM_EN.formTypeInspection}
                      </option>
                      <option value="tailgate">
                        {(t as Record<string, string>).formTypeTailgate ?? PM_EN.formTypeTailgate}
                      </option>
                      <option value="safety">
                        {(t as Record<string, string>).formTypeSafety ?? PM_EN.formTypeSafety}
                      </option>
                      <option value="custom">
                        {(t as Record<string, string>).formTypeCustom ?? PM_EN.formTypeCustom}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      {(t as Record<string, string>).selectTemplate ?? PM_EN.selectTemplate}
                    </label>
                    <select
                      value={newFormTemplateId}
                      onChange={(e) => setNewFormTemplateId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    >
                      {filteredMachinTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {resolveFormLabel(tpl.name, tl)}
                        </option>
                      ))}
                      {filteredMachinTemplates.length === 0 &&
                        formTemplates.some((x) => x.id === PROJECT_FORM_BLANK_TEMPLATE_ID) && (
                          <option value={PROJECT_FORM_BLANK_TEMPLATE_ID}>
                            {resolveFormLabel("form_blank_custom_name", tl)}
                          </option>
                        )}
                    </select>
                    {filteredMachinTemplates.length === 0 && (
                      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {(t as Record<string, string>).forms_modal_no_templates_hint ??
                          PM_EN.forms_modal_no_templates_hint}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewFormTemplateId("");
                      }}
                      className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 py-3 text-sm min-h-[44px]"
                    >
                      {t.cancel ?? PM_EN.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={
                        !selectedProjectId ||
                        !newFormTemplateId ||
                        !formTemplates.some((x) => x.id === newFormTemplateId) ||
                        !onStartFormFromMachinTemplate
                      }
                      onClick={() => {
                        if (
                          !selectedProjectId ||
                          !newFormTemplateId ||
                          !formTemplates.some((x) => x.id === newFormTemplateId) ||
                          !onStartFormFromMachinTemplate
                        )
                          return;
                        onStartFormFromMachinTemplate({
                          templateId: newFormTemplateId,
                          projectId: selectedProjectId,
                        });
                        setShowCreateForm(false);
                        setNewFormTemplateId("");
                      }}
                      className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-3 text-sm font-medium min-h-[44px]"
                    >
                      {(t as Record<string, string>).forms_continue ?? PM_EN.forms_continue}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {taskModal && selectedProject && (
              <div className="fixed inset-0 z-[52] flex items-center justify-center bg-black/50 p-4">
                <div
                  className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 max-h-[90vh] overflow-y-auto space-y-4"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="task-modal-title"
                >
                  <h3 id="task-modal-title" className="font-semibold text-zinc-900 dark:text-white">
                    {taskModal === "new"
                      ? (t as Record<string, string>).newTask ?? PM_EN.newTask
                      : (t as Record<string, string>).editTask ?? PM_EN.editTask}
                  </h3>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {(t as Record<string, string>).taskTitle ?? PM_EN.taskTitle}
                    </label>
                    <input
                      type="text"
                      value={taskDraft.title}
                      onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {(t as Record<string, string>).taskDescription ?? PM_EN.taskDescription}
                    </label>
                    <textarea
                      value={taskDraft.description}
                      onChange={(e) => setTaskDraft((d) => ({ ...d, description: e.target.value }))}
                      rows={3}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[88px]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {(t as Record<string, string>).taskPriority ?? PM_EN.taskPriority}
                    </label>
                    <select
                      value={taskDraft.priority}
                      onChange={(e) =>
                        setTaskDraft((d) => ({ ...d, priority: e.target.value as TaskPriority }))
                      }
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                    >
                      <option value="urgent">
                        {(t as Record<string, string>).taskPriorityUrgent ?? PM_EN.taskPriorityUrgent}
                      </option>
                      <option value="high">
                        {(t as Record<string, string>).taskPriorityHigh ?? PM_EN.taskPriorityHigh}
                      </option>
                      <option value="medium">
                        {(t as Record<string, string>).taskPriorityMedium ?? PM_EN.taskPriorityMedium}
                      </option>
                      <option value="low">
                        {(t as Record<string, string>).taskPriorityLow ?? PM_EN.taskPriorityLow}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {(t as Record<string, string>).taskAssignedTo ?? PM_EN.taskAssignedTo}
                    </label>
                    <select
                      value={taskDraft.assignedToEmployeeId}
                      onChange={(e) =>
                        setTaskDraft((d) => ({ ...d, assignedToEmployeeId: e.target.value }))
                      }
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                    >
                      <option value="">
                        {(t as Record<string, string>).taskUnassigned ?? PM_EN.taskUnassigned}
                      </option>
                      {assignedEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                          {emp.role ? ` · ${emp.role}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {(t as Record<string, string>).taskDueDate ?? PM_EN.taskDueDate}
                    </label>
                    <input
                      type="date"
                      value={taskDraft.dueDate}
                      onChange={(e) => setTaskDraft((d) => ({ ...d, dueDate: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setTaskModal(null)}
                      className="flex-1 rounded-xl border border-zinc-300 py-3 text-sm dark:border-zinc-600 min-h-[44px]"
                    >
                      {t.cancel ?? PM_EN.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={!taskDraft.title.trim()}
                      onClick={() => {
                        if (!taskDraft.title.trim()) return;
                        const assigneeName = taskDraft.assignedToEmployeeId
                          ? assignedEmployees.find((e) => e.id === taskDraft.assignedToEmployeeId)
                              ?.name
                          : undefined;
                        if (taskModal === "new") {
                          onCreateTask?.({
                            projectId: selectedProject.id,
                            title: taskDraft.title.trim(),
                            description: taskDraft.description.trim() || undefined,
                            priority: taskDraft.priority,
                            status: "pending",
                            assignedToEmployeeId: taskDraft.assignedToEmployeeId || undefined,
                            assignedToName: assigneeName,
                            dueDate: taskDraft.dueDate || undefined,
                            createdBy: currentUserEmployeeId ?? "local",
                            createdByName:
                              currentUserDisplayName || currentUserName || (t as Record<string, string>).preparedBy || "—",
                          });
                        } else {
                          onUpdateTask?.(taskModal, {
                            title: taskDraft.title.trim(),
                            description: taskDraft.description.trim() || undefined,
                            priority: taskDraft.priority,
                            assignedToEmployeeId: taskDraft.assignedToEmployeeId || undefined,
                            assignedToName: assigneeName,
                            dueDate: taskDraft.dueDate || undefined,
                          });
                        }
                        setTaskModal(null);
                      }}
                      className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 min-h-[44px]"
                    >
                      {t.save ?? PM_EN.save}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {openSafetyChecklistId && safetyDraft && (
              <div
                className="fixed inset-0 z-[55] flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="safety-checklist-title"
              >
                <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-900 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setOpenSafetyChecklistId(null)}
                      className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 mb-1 min-h-[44px] px-2 -ml-2"
                    >
                      <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                      {t.back ?? PM_EN.back}
                    </button>
                    <h2 id="safety-checklist-title" className="text-lg font-semibold text-zinc-900 dark:text-white truncate">
                      {safetyDraft.title}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {(t as Record<string, string>).safetyChecklist ?? PM_EN.safetyChecklist}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      safetyDraft.status === "draft"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                        : safetyDraft.status === "completed"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                    }`}
                  >
                    {safetyDraft.status === "draft"
                      ? (t as Record<string, string>).checklistStatusDraft ??
                        (t as Record<string, string>).formStatusDraft ?? PM_EN.draft
                      : safetyDraft.status === "completed"
                        ? (t as Record<string, string>).checklistStatusCompleted ??
                          (t as Record<string, string>).formStatusCompleted ?? PM_EN.formStatusCompleted
                        : (t as Record<string, string>).checklistStatusSubmitted ?? PM_EN.checklistStatusSubmitted}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400 text-xs">
                        {(t as Record<string, string>).checklistDate ?? (t as Record<string, string>).date ?? PM_EN.date}
                      </span>
                      <input
                        type="date"
                        value={safetyDraft.date}
                        onChange={(e) =>
                          setSafetyDraft((d) => (d ? { ...d, date: e.target.value } : d))
                        }
                        className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 min-h-[44px] text-sm"
                      />
                    </label>
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {(t as Record<string, string>).conductedBy ?? PM_EN.conductedBy}
                      </p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {safetyDraft.conductedByName || safetyDraft.conductedBy || "—"}
                      </p>
                    </div>
                  </div>

                  {safetyDraft.items.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-8">
                      {(t as Record<string, string>).checklistEmptyItems ?? (t as Record<string, string>).noForms ?? PM_EN.noForms}
                    </p>
                  ) : (
                    groupedSafetyCategories.map(([category, items]) => (
                      <section key={category} className="space-y-3">
                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                          {category}
                        </h3>
                        <ul className="space-y-4">
                          {items.map((item) => {
                            const tl = t as Record<string, string>;
                            const showFollowUp =
                              item.response === "no" || item.response === "needs_improvement";
                            const setResp = (response: SafetyChecklistResponse) => {
                              setSafetyDraft((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  items: prev.items.map((it) =>
                                    it.id === item.id ? { ...it, response } : it
                                  ),
                                };
                              });
                            };
                            return (
                              <li
                                key={item.id}
                                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900 p-4 space-y-3"
                              >
                                <p className="text-sm text-zinc-900 dark:text-zinc-100">{item.question}</p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                                  <button
                                    type="button"
                                    onClick={() => setResp("yes")}
                                    className={`min-h-[44px] rounded-lg px-2 text-sm font-medium border-2 transition-colors ${
                                      item.response === "yes"
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                                        : "border-zinc-200 dark:border-zinc-600 hover:border-emerald-300"
                                    }`}
                                  >
                                    <span className="mr-1" aria-hidden>
                                      ✅
                                    </span>
                                    {tl.checklistYes ?? PM_EN.checklistYes}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setResp("no")}
                                    className={`min-h-[44px] rounded-lg px-2 text-sm font-medium border-2 transition-colors ${
                                      item.response === "no"
                                        ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100"
                                        : "border-zinc-200 dark:border-zinc-600 hover:border-red-300"
                                    }`}
                                  >
                                    <span className="mr-1" aria-hidden>
                                      ❌
                                    </span>
                                    {tl.checklistNo ?? PM_EN.checklistNo}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setResp("na")}
                                    className={`min-h-[44px] rounded-lg px-2 text-sm font-medium border-2 transition-colors ${
                                      item.response === "na"
                                        ? "border-zinc-500 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                                        : "border-zinc-200 dark:border-zinc-600 hover:border-zinc-400"
                                    }`}
                                  >
                                    <span className="mr-1" aria-hidden>
                                      ➡️
                                    </span>
                                    {tl.checklistNA ?? PM_EN.checklistNA}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setResp("needs_improvement")}
                                    className={`min-h-[44px] rounded-lg px-2 text-sm font-medium border-2 transition-colors ${
                                      item.response === "needs_improvement"
                                        ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                                        : "border-zinc-200 dark:border-zinc-600 hover:border-amber-300"
                                    }`}
                                  >
                                    <span className="mr-1" aria-hidden>
                                      ⚠️
                                    </span>
                                    {tl.checklistNeedsImprovement ?? PM_EN.checklistNeedsImprovement}
                                  </button>
                                </div>
                                {showFollowUp && (
                                  <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                    <input
                                      type="text"
                                      value={item.actionBy ?? ""}
                                      onChange={(e) =>
                                        setSafetyDraft((prev) => {
                                          if (!prev) return prev;
                                          return {
                                            ...prev,
                                            items: prev.items.map((it) =>
                                              it.id === item.id ? { ...it, actionBy: e.target.value } : it
                                            ),
                                          };
                                        })
                                      }
                                      placeholder={tl.checklistActionBy ?? PM_EN.checklistActionBy}
                                      aria-label={tl.checklistActionBy ?? PM_EN.checklistActionBy}
                                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px]"
                                    />
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                                      {tl.checklistDueDate ?? PM_EN.checklistDueDate}
                                      <input
                                        type="date"
                                        value={item.dueDate ?? ""}
                                        onChange={(e) =>
                                          setSafetyDraft((prev) => {
                                            if (!prev) return prev;
                                            return {
                                              ...prev,
                                              items: prev.items.map((it) =>
                                                it.id === item.id ? { ...it, dueDate: e.target.value } : it
                                              ),
                                            };
                                          })
                                        }
                                        className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px]"
                                      />
                                    </label>
                                    <textarea
                                      value={item.comments ?? ""}
                                      onChange={(e) =>
                                        setSafetyDraft((prev) => {
                                          if (!prev) return prev;
                                          return {
                                            ...prev,
                                            items: prev.items.map((it) =>
                                              it.id === item.id ? { ...it, comments: e.target.value } : it
                                            ),
                                          };
                                        })
                                      }
                                      placeholder={tl.checklistComments ?? PM_EN.checklistComments}
                                      rows={2}
                                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                                    />
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))
                  )}
                </div>
                <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!safetyDraft) return;
                      const next = { ...safetyDraft, status: "draft" as const };
                      setSafetyDraft(next);
                      onSaveChecklist?.(next);
                    }}
                    className="flex-1 min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 py-3 text-sm font-medium"
                  >
                    {(t as Record<string, string>).saveDraft ?? PM_EN.saveDraft}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!safetyDraft) return;
                      const next = { ...safetyDraft, status: "completed" as const };
                      setSafetyDraft(next);
                      onSaveChecklist?.(next);
                    }}
                    className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-sm font-medium"
                  >
                    {(t as Record<string, string>).completeChecklist ?? PM_EN.completeChecklist}
                  </button>
                  <button
                    type="button"
                    disabled={safetyChecklistPdfBusy}
                    onClick={() => {
                      if (!safetyDraft || !selectedProject) return;
                      void (async () => {
                        setSafetyChecklistPdfBusy(true);
                        await new Promise<void>((r) => requestAnimationFrame(() => r()));
                        try {
                          generateSafetyChecklistPdf({
                            checklist: safetyDraft,
                            projectName: selectedProject.name,
                            companyName,
                            language,
                            labels: t as Record<string, string>,
                            dateLocaleBcp47: dateLoc,
                            timeZone: userTz,
                          });
                        } finally {
                          setSafetyChecklistPdfBusy(false);
                        }
                      })();
                    }}
                    className="flex-1 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {safetyChecklistPdfBusy ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    {(t as Record<string, string>).printReport ?? PM_EN.printReport}
                  </button>
                </div>
              </div>
            )}
            </>
            )}

            {openDailyReportKey !== null &&
              selectedProject &&
              (openDailyReportKey === "new" || dailyReports.some((r) => r.id === openDailyReportKey)) && (
              <div className="fixed inset-0 z-[70] flex min-h-0 flex-col bg-zinc-50 pb-[env(safe-area-inset-bottom)] dark:bg-zinc-950">
                <DailyFieldReportView
                  key={openDailyReportKey === "new" ? `dfr-new-${selectedProject.id}` : openDailyReportKey}
                  variant={dailyReportViewVariant}
                  report={
                    openDailyReportKey === "new"
                      ? null
                      : dailyReports.find((r) => r.id === openDailyReportKey) ?? null
                  }
                  projectId={selectedProject.id}
                  projectName={selectedProject.name}
                  companyName={companyName}
                  companyId={companyId}
                  projectAssignees={projectProfileAssignees}
                  currentUserProfileId={currentUserProfileId ?? ""}
                  currentUserName={currentUserDisplayName || currentUserName || ""}
                  language={language ?? "es"}
                  labels={t as Record<string, string>}
                  countryCode={countryCode}
                  timeZone={userTz}
                  companyLogoUrl={companyLogoUrl}
                  companyAddress={companyAddress}
                  companyPhone={companyPhone}
                  companyEmail={companyEmail}
                  companyWebsite={companyWebsite}
                  cloudinaryCloudName={
                    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || "dwdlmxmkt"
                  }
                  cloudinaryUploadPreset={
                    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || "i5dmd07o"
                  }
                  onBack={() => setOpenDailyReportKey(null)}
                  onRefreshList={() => void onRefreshDailyReports?.()}
                  onReportCreated={(id) => setOpenDailyReportKey(id)}
                  onReportPublished={onDailyReportPublished}
                  canApproveReport={canManageDailyReports}
                  showProductionSection={showProductionInDailyReport}
                  workOrderLines={dailyReportWorkOrderLines}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "visitantes" && selectedProject && showProjectVisitorsTab && (
          <div className="space-y-4">
            <VisitorModule
              t={t as Record<string, string>}
              companyId={companyId || null}
              companyName={companyName}
              projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name }))}
              openQrSignal={visitorOpenQrSignal}
              lockedProjectId={selectedProject.id}
              lockedProjectName={selectedProject.name}
              dateLocale={dateLoc}
              timeZone={userTz}
            />
          </div>
        )}

        {activeTab === "rfi" && selectedProject && showProjectRfiTab && companyId && (
          <div className="space-y-4">
            <RFIModule
              t={t as Record<string, string>}
              companyId={companyId || null}
              companyName={companyName}
              userRole={currentUserRole}
              userName={currentUserDisplayName}
              userProfileId={currentUserProfileId}
              projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name }))}
              projectIdFilter={selectedProject.id}
              openCreateSignal={rfiQuickCreateSig}
            />
          </div>
        )}

        {activeTab === "seguridad" && selectedProject && showProjectSecurityTab && onProjectSecuritySetCorrectivePrefill && onProjectSecurityRequestFocusHazard ? (
          <ProjectSecurityTab
            t={t as Record<string, string>}
            projectId={selectedProject.id}
            projectName={selectedProject.name}
            companyId={projectSecurityCompanyId}
            companyName={projectSecurityCompanyName}
            userRole={projectSecurityUserRole}
            userName={projectSecurityUserName}
            userProfileId={projectSecurityUserProfileId}
            projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name }))}
            employees={(allEmployees ?? []).map((e) => ({ id: e.id, name: e.name, role: e.role }))}
            focusHazardId={projectSecurityFocusHazardId ?? null}
            onFocusHazardConsumed={onProjectSecurityFocusHazardConsumed ?? (() => undefined)}
            correctivePrefill={projectSecurityCorrectivePrefill ?? null}
            onConsumeCorrectivePrefill={onProjectSecurityConsumeCorrectivePrefill ?? (() => undefined)}
            openHazardSignal={projectSecurityOpenHazardSignal}
            openActionSignal={projectSecurityOpenActionSignal}
            onSetCorrectivePrefill={onProjectSecuritySetCorrectivePrefill}
            onRequestFocusHazard={onProjectSecurityRequestFocusHazard}
            onSecurityInteraction={onProjectSecurityInteraction}
            canShowHazards={projectSecurityCanShowHazards}
            canShowActions={projectSecurityCanShowActions}
            canManageHazards={projectSecurityCanManageHazards}
            canManageCorrectiveActions={projectSecurityCanManageCorrectiveActions}
            dateLocale={projectSecurityDateLocale}
            timeZone={projectSecurityTimeZone}
          />
        ) : null}

        {activeTab === "costes" && selectedProject && showProjectCostsTab ? (
          <div className="space-y-6">
            {(() => {
              const laborSum = projectLaborSummaries[selectedProject.id] ?? {
                totalHours: 0,
                totalCost: 0,
                byEmployee: [],
              };
              const laborCost = canViewProjectLaborCosts ? laborSum.totalCost : 0;
              const sumCat = (cats: ProjectExpenseCategory[]) =>
                projectExpensesForProject
                  .filter((e) => cats.includes(e.category))
                  .reduce((a, e) => a + (Number.isFinite(e.amount) ? e.amount : 0), 0);
              const personnelExp = sumCat(["personnel"]);
              const materialsExp = sumCat(["material", "tool"]);
              const rentalExp = sumCat(["rental"]);
              const otherExp = sumCat(["other"]);
              const expensesTotal = projectExpensesForProject.reduce(
                (a, e) => a + (Number.isFinite(e.amount) ? e.amount : 0),
                0
              );
              const executedTotal = laborCost + expensesTotal;
              const budget = selectedProject.budgetCAD ?? 0;
              const overBudget = budget > 0 && executedTotal > budget;
              const catLabel = (c: ProjectExpenseCategory) => {
                const tx = t as Record<string, string>;
                if (c === "personnel") return tx.project_costs_personnel ?? PM_EN.project_costs_personnel;
                if (c === "material" || c === "tool")
                  return tx.project_costs_materials ?? PM_EN.project_costs_materials;
                if (c === "rental") return tx.project_costs_rentals ?? PM_EN.project_costs_rentals;
                return tx.project_costs_other ?? PM_EN.project_costs_other;
              };
              const exportCsv = () => {
                const tx = t as Record<string, string>;
                const hdr = [
                  tx.date ?? "date",
                  tx.project ?? "project",
                  "category",
                  tx.projectFormNameLabel ?? "name",
                  "amount",
                  "currency",
                  "notes",
                ];
                const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
                const lines = [hdr.join(",")];
                if (canViewProjectLaborCosts && laborCost > 0) {
                  lines.push(
                    [
                      esc("—"),
                      esc(selectedProject.name),
                      esc(tx.labor_cost_total ?? "labor"),
                      esc(tx.labor_costing ?? "Labor"),
                      String(laborCost),
                      companyCurrency,
                      "",
                    ].join(",")
                  );
                }
                for (const e of projectExpensesForProject) {
                  lines.push(
                    [
                      esc(e.expenseDate),
                      esc(selectedProject.name),
                      esc(e.category),
                      esc(e.name),
                      String(e.amount),
                      esc(e.currency || companyCurrency),
                      esc(e.notes ?? ""),
                    ].join(",")
                  );
                }
                const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
                triggerBlobDownload(
                  blob,
                  `project-costs-${selectedProject.id.slice(0, 8)}.csv`
                );
                showToast("success", tx.export_success ?? PM_EN.export_success);
              };
              return (
                <>
                  <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {canViewProjectLaborCosts ? (
                      <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/60 dark:bg-slate-800/40 p-4">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {tl.labor_costing ?? PM_EN.labor_costing}
                        </p>
                        <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">
                          {formatCurrency(laborCost, companyCurrency, dateLoc)}
                        </p>
                      </div>
                    ) : null}
                    <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/60 dark:bg-slate-800/40 p-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {tl.project_costs_personnel ?? PM_EN.project_costs_personnel}
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {formatCurrency(personnelExp, companyCurrency, dateLoc)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/60 dark:bg-slate-800/40 p-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {tl.project_costs_materials ?? PM_EN.project_costs_materials}
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {formatCurrency(materialsExp, companyCurrency, dateLoc)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/60 dark:bg-slate-800/40 p-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {tl.project_costs_rentals ?? PM_EN.project_costs_rentals}
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {formatCurrency(rentalExp, companyCurrency, dateLoc)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/60 dark:bg-slate-800/40 p-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {tl.project_costs_other ?? PM_EN.project_costs_other}
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {formatCurrency(otherExp, companyCurrency, dateLoc)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 sm:col-span-2 lg:col-span-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {tl.project_costs_total ?? PM_EN.project_costs_total}
                          </p>
                          <p className="text-xl font-bold tabular-nums text-amber-800 dark:text-amber-200">
                            {formatCurrency(executedTotal, companyCurrency, dateLoc)}
                          </p>
                        </div>
                        {budget > 0 ? (
                          <div className="text-right">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {tl.project_costs_budget ?? PM_EN.project_costs_budget}
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                              {formatCurrency(budget, companyCurrency, dateLoc)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      {overBudget ? (
                        <p className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {tl.project_costs_over_budget ?? PM_EN.project_costs_over_budget}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    {canExportProjectCosts ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void exportCsv()}
                          className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-slate-700 sm:w-auto"
                        >
                          <FileDown className="h-4 w-4" />
                          {tl.project_costs_export ?? PM_EN.project_costs_export}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const today = formatTodayYmdInTimeZone(userTz);
                            const d = new Date(`${today}T12:00:00`);
                            const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
                            setCostInvoiceStart(start);
                            setCostInvoiceEnd(today);
                            setCostInvoiceTax(String(defaultInvoiceTaxPercent(countryCode)));
                            setCostInvoiceProjectRef(selectedProject?.name ?? "");
                            setCostInvoiceClientFiscal("");
                            setCostInvoiceOpen(true);
                          }}
                          className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm font-medium text-amber-950 dark:text-amber-100 sm:w-auto"
                        >
                          <FileText className="h-4 w-4" />
                          {tl.invoice_generate ?? "Generate invoice"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const today = formatTodayYmdInTimeZone(userTz);
                            const d = new Date(`${today}T12:00:00`);
                            const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
                            setBenefitStart(start);
                            setBenefitEnd(today);
                            setBenefitOpen(true);
                          }}
                          className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/25 px-4 py-2 text-sm font-medium text-emerald-950 dark:text-emerald-100 sm:w-auto"
                        >
                          <FileText className="h-4 w-4" />
                          {tl.benefit_report_generate ?? "Generate report"}
                        </button>
                      </>
                    ) : null}
                  </div>

                  {canManageProjectCosts && onAddProjectExpense ? (
                    <form
                      className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 space-y-3"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        if (!selectedProject?.id || costFormBusy) return;
                        const amt = Number.parseFloat(costFormAmount.replace(",", "."));
                        if (!costFormName.trim() || !Number.isFinite(amt) || amt < 0) {
                          showToast("error", tl.toast_error ?? PM_EN.toast_error);
                          return;
                        }
                        setCostFormBusy(true);
                        void (async () => {
                          const res = await onAddProjectExpense({
                            projectId: selectedProject.id,
                            name: costFormName.trim(),
                            amount: amt,
                            currency: companyCurrency,
                            category: costFormCategory,
                            expenseDate: costFormDate || todayYmdLocal(),
                            notes: costFormNotes.trim() ? costFormNotes.trim() : null,
                          });
                          setCostFormBusy(false);
                          if (!res.ok) {
                            showToast("error", res.error ?? (tl.toast_error ?? PM_EN.toast_error));
                            return;
                          }
                          setCostFormName("");
                          setCostFormAmount("");
                          setCostFormCategory("other");
                          setCostFormDate(todayYmdLocal());
                          setCostFormNotes("");
                          showToast("success", tl.toast_saved ?? PM_EN.toast_saved);
                        })();
                      }}
                    >
                      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                        {tl.project_costs_add_expense ?? PM_EN.project_costs_add_expense}
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {tl.projectFormNameLabel ?? PM_EN.projectFormNameLabel}
                          <input
                            value={costFormName}
                            onChange={(e) => setCostFormName(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                            required
                          />
                        </label>
                        <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {tl.project_costs_amount ?? PM_EN.project_costs_amount}
                          <input
                            value={costFormAmount}
                            onChange={(e) => setCostFormAmount(e.target.value)}
                            inputMode="decimal"
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm tabular-nums"
                            required
                          />
                        </label>
                        <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {tl.date ?? PM_EN.date}
                          <input
                            type="date"
                            value={costFormDate}
                            onChange={(e) => setCostFormDate(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {tl.project_costs_category ?? PM_EN.project_costs_category}
                          <select
                            value={costFormCategory}
                            onChange={(e) =>
                              setCostFormCategory(e.target.value as ProjectExpenseCategory)
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                          >
                            {(
                              ["personnel", "material", "tool", "rental", "other"] as ProjectExpenseCategory[]
                            ).map((c) => (
                              <option key={c} value={c}>
                                {catLabel(c)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                        {tl.photoNotesPlaceholder ?? PM_EN.photoNotesPlaceholder}
                        <textarea
                          value={costFormNotes}
                          onChange={(e) => setCostFormNotes(e.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={costFormBusy}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
                      >
                        <Plus className="h-4 w-4" />
                        {tl.project_costs_add_expense ?? PM_EN.project_costs_add_expense}
                      </button>
                    </form>
                  ) : null}

                  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-700">
                    <table className="w-full min-w-[320px] text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-slate-600 text-left text-xs text-zinc-500 dark:text-zinc-400">
                          <th className="py-2 px-3 font-medium">{tl.date ?? PM_EN.date}</th>
                          <th className="py-2 px-3 font-medium">{tl.project_costs_category ?? PM_EN.project_costs_category}</th>
                          <th className="py-2 px-3 font-medium">{tl.projectFormNameLabel ?? PM_EN.projectFormNameLabel}</th>
                          <th className="py-2 px-3 font-medium text-right">{tl.project_costs_amount ?? PM_EN.project_costs_amount}</th>
                          {canManageProjectCosts && onDeleteProjectExpense ? (
                            <th className="py-2 px-3 w-10" />
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {projectExpensesForProject.length === 0 ? (
                          <tr>
                            <td
                              colSpan={canManageProjectCosts && onDeleteProjectExpense ? 5 : 4}
                              className="py-8 text-center text-zinc-500 dark:text-zinc-400"
                            >
                              {tl.project_costs_empty ?? PM_EN.project_costs_empty}
                            </td>
                          </tr>
                        ) : (
                          projectExpensesForProject.map((e) => (
                            <tr
                              key={e.id}
                              className="border-b border-zinc-100 dark:border-slate-800 text-zinc-800 dark:text-zinc-200"
                            >
                              <td className="py-2 px-3 tabular-nums whitespace-nowrap">{e.expenseDate}</td>
                              <td className="py-2 px-3">{catLabel(e.category)}</td>
                              <td className="py-2 px-3 min-w-0">
                                <span className="block truncate" title={e.name}>
                                  {e.name}
                                </span>
                                {e.notes ? (
                                  <span className="block text-xs text-zinc-500 truncate" title={e.notes}>
                                    {e.notes}
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums font-medium">
                                {formatCurrency(e.amount, e.currency || companyCurrency, dateLoc)}
                              </td>
                              {canManageProjectCosts && onDeleteProjectExpense ? (
                                <td className="py-2 px-3">
                                  <button
                                    type="button"
                                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    aria-label={tl.delete ?? PM_EN.delete}
                                    onClick={() => {
                                      void (async () => {
                                        const res = await onDeleteProjectExpense(e.id);
                                        if (!res.ok) {
                                          showToast("error", res.error ?? (tl.toast_error ?? PM_EN.toast_error));
                                        }
                                      })();
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {costInvoiceOpen && selectedProject ? (
                    <div className="fixed inset-0 z-[10060] flex items-end justify-center bg-black/50 p-0 sm:p-4 sm:items-center">
                      <div className="max-h-[92vh] w-full max-w-full overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900 space-y-3 sm:max-w-lg sm:rounded-2xl">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {tl.invoice_generate ?? "Generate invoice"}
                          </h3>
                          <button
                            type="button"
                            className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-zinc-500"
                            onClick={() => setCostInvoiceOpen(false)}
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
                          {tl.invoice_preview_number ?? "Invoice number"}:{" "}
                          {peekMachinProInvoiceNumber(companyId || "co")}
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="block text-xs text-zinc-500">
                            {tl.timesheet_date_from ?? "From"}
                            <input
                              type="date"
                              value={costInvoiceStart}
                              onChange={(e) => setCostInvoiceStart(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                            />
                          </label>
                          <label className="block text-xs text-zinc-500">
                            {tl.timesheet_date_to ?? "To"}
                            <input
                              type="date"
                              value={costInvoiceEnd}
                              onChange={(e) => setCostInvoiceEnd(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                            />
                          </label>
                        </div>
                        <label className="block text-xs text-zinc-500">
                          {tl.invoice_client_name ?? "Client name"}
                          <input
                            value={costInvoiceClientName}
                            onChange={(e) => setCostInvoiceClientName(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                          />
                        </label>
                        <label className="block text-xs text-zinc-500">
                          {tl.invoice_client_address ?? "Client address"}
                          <textarea
                            value={costInvoiceClientAddr}
                            onChange={(e) => setCostInvoiceClientAddr(e.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block text-xs text-zinc-500">
                          {tl.invoice_client_email ?? "Client email"}
                          <input
                            value={costInvoiceClientEmail}
                            onChange={(e) => setCostInvoiceClientEmail(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                          />
                        </label>
                        <label className="block text-xs text-zinc-500">
                          {tl.invoice_client_project_ref ?? "Client project ref"}
                          <input
                            value={costInvoiceProjectRef}
                            onChange={(e) => setCostInvoiceProjectRef(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                          />
                        </label>
                        <label className="block text-xs text-zinc-500">
                          {tl.invoice_client_fiscal ?? "Client tax number"}
                          <input
                            value={costInvoiceClientFiscal}
                            onChange={(e) => setCostInvoiceClientFiscal(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                          />
                        </label>
                        <label className="block text-xs text-zinc-500">
                          {tl.invoice_tax_percent ?? tl.invoice_tax_rate ?? "Tax (%)"}
                          <input
                            value={costInvoiceTax}
                            onChange={(e) => setCostInvoiceTax(e.target.value)}
                            inputMode="decimal"
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px] tabular-nums"
                          />
                        </label>
                        <label className="block text-xs text-zinc-500">
                          {tl.invoice_notes ?? "Notes"}
                          <textarea
                            value={costInvoiceNotes}
                            onChange={(e) => setCostInvoiceNotes(e.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                          />
                        </label>
                        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap">
                          <button
                            type="button"
                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 sm:flex-1"
                            onClick={() => {
                              void (async () => {
                                if (!selectedProject) return;
                                const map = new Map<
                                  string,
                                  {
                                    description: string;
                                    unit: string;
                                    quantity: number;
                                    unitPrice: number;
                                    lineTotal: number;
                                  }
                                >();
                                for (const r of productionReports) {
                                  if (r.projectId !== selectedProject.id) continue;
                                  if (r.date < costInvoiceStart || r.date > costInvoiceEnd) continue;
                                  for (const e of r.entries) {
                                    const key = `${e.catalogItemId}|${e.taskName}`;
                                    const cur = map.get(key) ?? {
                                      description: e.taskName,
                                      unit: String(e.unit),
                                      quantity: 0,
                                      unitPrice: e.sellPrice,
                                      lineTotal: 0,
                                    };
                                    cur.quantity += e.unitsCompleted;
                                    cur.lineTotal += e.totalSell;
                                    if (e.sellPrice > 0) cur.unitPrice = e.sellPrice;
                                    map.set(key, cur);
                                  }
                                }
                                const lines = [...map.values()].filter((l) => l.lineTotal > 0 || l.quantity > 0);
                                if (lines.length === 0) {
                                  showToast("error", tl.invoice_no_lines ?? "No billable lines in this period.");
                                  return;
                                }
                                const tax = Number.parseFloat(costInvoiceTax.replace(",", "."));
                                if (!Number.isFinite(tax) || tax < 0) {
                                  showToast("error", tl.toast_error ?? PM_EN.toast_error);
                                  return;
                                }
                                try {
                                  const num = nextMachinProInvoiceNumber(companyId || "co");
                                  const { blob, filename } = await generateInvoicePdf({
                                    labels: tl,
                                    companyName: companyName || "MachinPro",
                                    companyId: companyId || "",
                                    companyLogoUrl: companyLogoUrl?.trim() || undefined,
                                    issuerName: companyName || "MachinPro",
                                    issuerAddress: companyAddress?.trim() || undefined,
                                    issuerEmail: companyEmail?.trim() || undefined,
                                    issuerPhone: companyPhone?.trim() || undefined,
                                    invoiceNumber: num,
                                    issueDate: formatTodayYmdInTimeZone(userTz),
                                    currency: companyCurrency,
                                    clientName:
                                      costInvoiceClientName.trim() || (tl.invoice_client ?? "Client"),
                                    clientAddress: costInvoiceClientAddr.trim() || undefined,
                                    clientEmail: costInvoiceClientEmail.trim() || undefined,
                                    clientProjectRef: costInvoiceProjectRef.trim() || undefined,
                                    clientTaxNumber: costInvoiceClientFiscal.trim() || undefined,
                                    lines: lines.map((l) => ({
                                      description: l.description,
                                      unit: l.unit,
                                      quantity: l.quantity,
                                      unitPrice: l.unitPrice,
                                      lineTotal: l.lineTotal,
                                    })),
                                    taxPercent: tax,
                                    notes: costInvoiceNotes.trim() || undefined,
                                  });
                                  const href = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = href;
                                  a.download = filename;
                                  a.click();
                                  URL.revokeObjectURL(href);
                                  showToast("success", tl.export_success ?? PM_EN.export_success);
                                  setCostInvoiceOpen(false);
                                } catch (e) {
                                  showToast("error", userFacingErrorMessage(tl, e));
                                }
                              })();
                            }}
                          >
                            {tl.invoice_generate ?? "Generate invoice"}
                          </button>
                          <button
                            type="button"
                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600 sm:w-auto"
                            onClick={() => setCostInvoiceOpen(false)}
                          >
                            {tl.common_cancel ?? PM_EN.common_cancel}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {benefitOpen && selectedProject ? (
                    <div className="fixed inset-0 z-[10060] flex items-end justify-center bg-black/50 p-0 sm:p-4 sm:items-center">
                      <div className="max-h-[92vh] w-full max-w-full overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900 space-y-3 sm:max-w-md sm:rounded-2xl">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {tl.benefit_report_title ?? "Benefit report"}
                          </h3>
                          <button
                            type="button"
                            className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-zinc-500"
                            onClick={() => setBenefitOpen(false)}
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="block text-xs text-zinc-500">
                            {tl.timesheet_date_from ?? "From"}
                            <input
                              type="date"
                              value={benefitStart}
                              onChange={(e) => setBenefitStart(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                            />
                          </label>
                          <label className="block text-xs text-zinc-500">
                            {tl.timesheet_date_to ?? "To"}
                            <input
                              type="date"
                              value={benefitEnd}
                              onChange={(e) => setBenefitEnd(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                            />
                          </label>
                        </div>
                        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap">
                          <button
                            type="button"
                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 sm:flex-1"
                            onClick={() => {
                              void (async () => {
                                if (!selectedProject) return;
                                const prod = productionReports.filter(
                                  (r) =>
                                    r.projectId === selectedProject.id &&
                                    r.date >= benefitStart &&
                                    r.date <= benefitEnd
                                );
                                const income = prod.reduce((a, r) => a + r.totalSell, 0);
                                const laborCost = prod.reduce((a, r) => a + r.totalCost, 0);
                                const materialsCost = projectExpensesForProject
                                  .filter(
                                    (e) =>
                                      (e.category === "material" || e.category === "tool") &&
                                      e.expenseDate >= benefitStart &&
                                      e.expenseDate <= benefitEnd
                                  )
                                  .reduce((a, e) => a + (Number.isFinite(e.amount) ? e.amount : 0), 0);
                                const otherCost = projectExpensesForProject
                                  .filter(
                                    (e) =>
                                      e.category === "other" &&
                                      e.expenseDate >= benefitStart &&
                                      e.expenseDate <= benefitEnd
                                  )
                                  .reduce((a, e) => a + (Number.isFinite(e.amount) ? e.amount : 0), 0);
                                const rentalsCost = rentals
                                  .filter((r) => {
                                    if (r.projectId !== selectedProject.id) return false;
                                    const rd = (r.returnDate ?? "").trim();
                                    if (!rd) return true;
                                    return rd >= benefitStart && rd <= benefitEnd;
                                  })
                                  .reduce(
                                    (a, r) =>
                                      a +
                                      (Number.isFinite(r.cost) && r.cost > 0
                                        ? r.cost
                                        : Number(r.costCAD) || 0),
                                    0
                                  );
                                try {
                                  const { blob, filename } = await generateBenefitReportPdf({
                                    labels: tl,
                                    companyName: companyName || "MachinPro",
                                    companyId: companyId || "",
                                    companyLogoUrl: companyLogoUrl?.trim() || undefined,
                                    projectName: selectedProject.name,
                                    periodStart: benefitStart,
                                    periodEnd: benefitEnd,
                                    currency: companyCurrency,
                                    income,
                                    laborCost,
                                    materialsCost,
                                    rentalsCost,
                                    otherCost,
                                  });
                                  const href = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = href;
                                  a.download = filename;
                                  a.click();
                                  URL.revokeObjectURL(href);
                                  showToast("success", tl.export_success ?? PM_EN.export_success);
                                  setBenefitOpen(false);
                                } catch (e) {
                                  showToast("error", userFacingErrorMessage(tl, e));
                                }
                              })();
                            }}
                          >
                            {tl.benefit_report_generate ?? "Generate report"}
                          </button>
                          <button
                            type="button"
                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600 sm:w-auto"
                            onClick={() => setBenefitOpen(false)}
                          >
                            {tl.common_cancel ?? PM_EN.common_cancel}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : null}

        {activeTab === "work_order" && selectedProject && canViewWorkOrders ? (
          !companyId ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {(t as Record<string, string>).employees_no_company ?? ""}
            </p>
          ) : !authAccessToken?.trim() ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {(t as Record<string, string>).work_orders_need_session ?? "Sign in to load work orders."}
            </p>
          ) : (
            <ProjectWorkOrdersPanel
              labels={t as Record<string, string>}
              companyId={companyId}
              projectId={selectedProject.id}
              projectName={selectedProject.name}
              companyName={companyName || "MachinPro"}
              accessToken={authAccessToken}
              timeZone={userTz}
              companyCurrency={companyCurrency}
              employees={(allEmployees ?? []).map((e) => ({ id: e.id, name: e.name }))}
              canManage={!!canManageWorkOrders}
            />
          )
        ) : null}

        {activeTab === "project_epi" && selectedProject && showProjectEpiTab ? (
          <ProjectEpiSafetyTab
            project={selectedProject}
            allEmployees={allEmployees ?? []}
            countryCode={countryCode}
            companyId={companyId}
            timeZone={userTz}
            language={language}
            labels={t as Record<string, string>}
            canEdit={!!canEdit && !!onUpdateProjectSafetyRequirements}
            onSaveRequirements={onUpdateProjectSafetyRequirements ?? (() => undefined)}
          />
        ) : null}

        {activeTab === "mapa" && selectedProject && companyId && showProjectMapTab ? (
          <div className="min-w-0 max-w-full overflow-x-hidden space-y-3">
            {projectMapActiveCount > 0 ? (
              <TeamGpsMapWidget
                companyId={companyId}
                timeZone={userTz}
                language={language}
                countryCode={countryCode}
                projectNameById={projectNameByIdForGps}
                labels={t as Record<string, string>}
                filterProjectId={selectedProject.id}
              />
            ) : (
              <div className="min-h-[200px] rounded-xl border border-zinc-200 dark:border-slate-700 p-6 text-zinc-600 dark:text-zinc-300 flex flex-col sm:flex-row sm:items-center gap-3">
                <MapPin className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
                <p className="text-sm leading-relaxed min-w-0">
                  {(t as Record<string, string>).gps_no_active_project ??
                    "No hay empleados fichados en este proyecto ahora mismo"}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Modal: elegir categoría antes de subir foto (galería) */}
      {showCategoryModal && selectedProjectId && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50 touch-none"
            aria-hidden
            onClick={() => {
              pendingUploadCategoryRef.current = null;
              setShowCategoryModal(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-category-modal-title"
            className="fixed z-[61] max-h-[min(90dvh,90vh)] w-full overflow-y-auto border border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:left-0 max-md:top-auto max-md:max-h-[88dvh] max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl max-md:p-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="gallery-category-modal-title"
              className="text-base font-semibold text-zinc-900 dark:text-white mb-4 text-center"
            >
              {(t as Record<string, string>).selectPhotoCategory ?? PM_EN.selectPhotoCategory}
            </h3>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => openGalleryFilePickerAfterCategory("progress")}
                className="flex w-full min-h-[80px] items-center gap-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-left transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60"
              >
                <span className="text-2xl shrink-0" aria-hidden>
                  📸
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                    {(t as Record<string, string>).photoProgress ?? PM_EN.photoProgress}
                  </span>
                  <span className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
                    {(t as Record<string, string>).progressDesc ?? PM_EN.progressDesc}
                  </span>
                </span>
                <Camera className="h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => openGalleryFilePickerAfterCategory("incident")}
                className="flex w-full min-h-[80px] items-center gap-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-left transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:hover:bg-red-950/60"
              >
                <span className="text-2xl shrink-0" aria-hidden>
                  ⚠️
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold text-red-900 dark:text-red-100">
                    {(t as Record<string, string>).photoIncident ?? PM_EN.photoIncident}
                  </span>
                  <span className="text-xs text-red-800/80 dark:text-red-200/80">
                    {(t as Record<string, string>).incidentDesc ?? PM_EN.incidentDesc}
                  </span>
                </span>
                <AlertTriangle className="h-6 w-6 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => openGalleryFilePickerAfterCategory("health_safety")}
                className="flex w-full min-h-[80px] items-center gap-4 rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-3 text-left transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-950/60"
              >
                <span className="text-2xl shrink-0" aria-hidden>
                  🦺
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold text-blue-900 dark:text-blue-100">
                    {(t as Record<string, string>).photoHealthSafety ?? PM_EN.photoHealthSafety}
                  </span>
                  <span className="text-xs text-blue-800/80 dark:text-blue-200/80">
                    {(t as Record<string, string>).photoGalleryHealthDesc ?? PM_EN.photoGalleryHealthDesc}
                  </span>
                </span>
                <HardHat className="h-6 w-6 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden />
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  pendingUploadCategoryRef.current = null;
                  setShowCategoryModal(false);
                }}
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300 min-h-[44px]"
              >
                {t.cancel ?? PM_EN.cancel}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal categoría foto obra */}
      {photoCategoryModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={() => setPhotoCategoryModal(null)} />
          <div className="fixed z-50 max-h-[min(90dvh,90vh)] w-full overflow-y-auto border border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:left-0 max-md:top-auto max-md:max-h-[88dvh] max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-2xl max-md:p-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-3">
              {(t as Record<string, string>).photoCategoryLabel ?? PM_EN.photoCategoryLabel}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["progress", "incident", "health_safety"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPhotoCategoryToSubmit(cat)}
                  className={`rounded-xl py-2 text-xs font-medium border transition-colors min-h-[44px] ${
                    photoCategoryToSubmit === cat
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                      : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {cat === "progress"
                    ? ((t as Record<string, string>).photoProgress ?? PM_EN.photoProgress)
                    : cat === "incident"
                    ? ((t as Record<string, string>).photoIncident ?? PM_EN.photoIncident)
                    : (t as Record<string, string>).photoHealthSafety ?? PM_EN.photoHealthSafety}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPhotoCategoryModal(null)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
              >
                {t.cancel ?? PM_EN.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onPhotoObra(photoCategoryModal.projectId, photoCategoryToSubmit);
                  setPhotoCategoryModal(null);
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
              >
                {t.save ?? PM_EN.save}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal configuración PDF */}
      {pdfConfigOpen && selectedProject && (
        <>
          <div
            className="fixed inset-0 z-[64] bg-black/50 touch-none"
            aria-hidden
            onClick={() => setPdfConfigOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-config-title"
            className="fixed z-[65] left-4 right-4 top-1/2 max-h-[min(92vh,720px)] -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 border-b border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
              <h2 id="pdf-config-title" className="text-base font-semibold text-zinc-900 dark:text-white">
                {(t as Record<string, string>).pdfConfig ?? PM_EN.pdfConfig}
              </h2>
            </div>
            <div className="space-y-5 p-4 text-sm text-zinc-800 dark:text-zinc-200">
              <fieldset className="space-y-2">
                <legend className="font-medium text-zinc-900 dark:text-white mb-1">
                  {(t as Record<string, string>).sortBy ?? PM_EN.sortBy}
                </legend>
                {(
                  [
                    ["date_desc", (t as Record<string, string>).sortDateDesc ?? PM_EN.sortDateDesc],
                    ["date_asc", (t as Record<string, string>).sortDateAsc ?? PM_EN.sortDateAsc],
                    ["category", (t as Record<string, string>).sortCategory ?? PM_EN.sortCategory],
                    ["author", (t as Record<string, string>).sortAuthor ?? PM_EN.sortAuthor],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-center gap-3 min-h-[44px] rounded-lg px-2 py-1 hover:bg-zinc-50 dark:hover:bg-slate-800/80">
                    <input
                      type="radio"
                      name="pdf-sort"
                      checked={pdfSortBy === value}
                      onChange={() => setPdfSortBy(value)}
                      className="h-4 w-4 shrink-0 border-zinc-300 text-amber-600"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>

              <div>
                <p className="font-medium text-zinc-900 dark:text-white mb-2">
                  {(t as Record<string, string>).photosPerPage ?? PM_EN.photosPerPage}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      [1, (t as Record<string, string>).pdfPerPage1 ?? PM_EN.pdfPerPage1],
                      [2, (t as Record<string, string>).pdfPerPage2 ?? PM_EN.pdfPerPage2],
                      [4, (t as Record<string, string>).pdfPerPage4 ?? PM_EN.pdfPerPage4],
                    ] as const
                  ).map(([n, label]) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPdfPhotosPerPage(n)}
                      className={`rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] border transition-colors ${
                        pdfPhotosPerPage === n
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
                          : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-medium text-zinc-900 dark:text-white mb-2">
                  {(t as Record<string, string>).photoSize ?? PM_EN.photoSize}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["large", (t as Record<string, string>).photoSizeLarge ?? PM_EN.photoSizeLarge],
                      ["medium", (t as Record<string, string>).photoSizeMedium ?? PM_EN.photoSizeMedium],
                      ["small", (t as Record<string, string>).photoSizeSmall ?? PM_EN.photoSizeSmall],
                    ] as const
                  ).map(([size, label]) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPdfPhotoSize(size)}
                      className={`rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] border transition-colors ${
                        pdfPhotoSize === size
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
                          : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="font-medium text-zinc-900 dark:text-white mb-1">
                  {(t as Record<string, string>).pdfIncludeInReport ?? PM_EN.pdfIncludeInReport}
                </legend>
                {(
                  [
                    [pdfIncludeGps, setPdfIncludeGps, (t as Record<string, string>).includeGps ?? PM_EN.includeGps],
                    [pdfIncludeAuthor, setPdfIncludeAuthor, (t as Record<string, string>).includeAuthor ?? PM_EN.includeAuthor],
                    [pdfIncludeDate, setPdfIncludeDate, (t as Record<string, string>).includeDate ?? PM_EN.includeDate],
                    [pdfIncludeNotes, setPdfIncludeNotes, (t as Record<string, string>).includeNotes ?? PM_EN.includeNotes],
                  ] as const
                ).map(([checked, setChecked, label], i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-3 min-h-[44px] rounded-lg px-2 py-1 hover:bg-zinc-50 dark:hover:bg-slate-800/80">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setChecked(e.target.checked)}
                      className="h-4 w-4 shrink-0 rounded border-zinc-300 text-amber-600"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>

              <div>
                <p className="font-medium text-zinc-900 dark:text-white mb-2">
                  {(t as Record<string, string>).pdfPhotoScope ?? PM_EN.pdfPhotoScope}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPdfApprovedOnly(true)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] border transition-colors ${
                      pdfApprovedOnly
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
                        : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {(t as Record<string, string>).pdfPhotosApprovedOnly ?? PM_EN.pdfPhotosApprovedOnly}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfApprovedOnly(false)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] border transition-colors ${
                      !pdfApprovedOnly
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
                        : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {(t as Record<string, string>).pdfPhotosAll ?? PM_EN.pdfPhotosAll}
                  </button>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="font-medium text-zinc-900 dark:text-white mb-1">
                  {(t as Record<string, string>).pdfOrientation ?? PM_EN.pdfOrientation}
                </legend>
                <label className="flex cursor-pointer items-center gap-3 min-h-[44px] rounded-lg px-2 py-1 hover:bg-zinc-50 dark:hover:bg-slate-800/80">
                  <input
                    type="radio"
                    name="pdf-orientation"
                    checked={pdfOrientation === "portrait"}
                    onChange={() => setPdfOrientation("portrait")}
                    className="h-4 w-4 shrink-0 border-zinc-300 text-amber-600"
                  />
                  <span>{(t as Record<string, string>).orientationPortrait ?? PM_EN.orientationPortrait}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 min-h-[44px] rounded-lg px-2 py-1 hover:bg-zinc-50 dark:hover:bg-slate-800/80">
                  <input
                    type="radio"
                    name="pdf-orientation"
                    checked={pdfOrientation === "landscape"}
                    onChange={() => setPdfOrientation("landscape")}
                    className="h-4 w-4 shrink-0 border-zinc-300 text-amber-600"
                  />
                  <span>{(t as Record<string, string>).orientationLandscape ?? PM_EN.orientationLandscape}</span>
                </label>
              </fieldset>
            </div>
            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <button
                type="button"
                onClick={() => setPdfConfigOpen(false)}
                className="flex-1 min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:flex-none"
              >
                {t.cancel ?? PM_EN.cancel}
              </button>
              <button
                type="button"
                disabled={!canGeneratePdf}
                onClick={() => {
                  const list = pdfApprovedOnly
                    ? pdfSourcePhotos.filter((p) => p.status === "approved")
                    : pdfSourcePhotos;
                  if (list.length === 0) return;
                  void generatePhotoReport({
                    photos: list,
                    projectName: selectedProject.name,
                    companyName: companyName || "MachinPro",
                    companyLogoUrl,
                    generatedBy:
                      currentUserDisplayName ||
                      (t as Record<string, string>).admin ||
                      "Admin",
                    language,
                    labels: t as Record<string, string>,
                    sortBy: pdfSortBy,
                    photosPerPage: pdfPhotosPerPage,
                    photoSize: pdfPhotoSize,
                    includeGps: pdfIncludeGps,
                    includeAuthor: pdfIncludeAuthor,
                    includeDate: pdfIncludeDate,
                    includeNotes: pdfIncludeNotes,
                    orientation: pdfOrientation,
                    dateLocaleBcp47: dateLoc,
                    timeZone: userTz,
                  });
                  setPdfConfigOpen(false);
                }}
                className="flex-1 min-h-[44px] rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 sm:flex-none"
              >
                {(t as Record<string, string>).generatePDF ?? PM_EN.generatePDF}
              </button>
            </div>
          </div>
        </>
      )}

      {inspectionReportOpen && selectedProject && (
        <>
          <div
            className="fixed inset-0 z-[66] bg-black/50 touch-none"
            aria-hidden
            onClick={() => {
              if (!inspectionPdfBusy) setInspectionReportOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspection-report-modal-title"
            className="fixed z-[67] left-4 right-4 top-4 bottom-4 max-h-[min(92vh,820px)] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl sm:left-1/2 sm:top-1/2 sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:bottom-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
              <h2
                id="inspection-report-modal-title"
                className="text-base font-semibold text-zinc-900 dark:text-white pr-2"
              >
                {(t as Record<string, string>).inspection_report_generate ?? PM_EN.inspection_report_generate}
              </h2>
              <button
                type="button"
                disabled={inspectionPdfBusy}
                onClick={() => setInspectionReportOpen(false)}
                className="rounded-lg p-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 disabled:opacity-50"
                aria-label={t.cancel ?? PM_EN.cancel}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-4 text-sm text-zinc-800 dark:text-zinc-200">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {(t as Record<string, string>).inspection_report_title ?? PM_EN.inspection_report_title}
                </label>
                <input
                  type="text"
                  value={inspectionReportTitle}
                  onChange={(e) => setInspectionReportTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 min-h-[44px] text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {(t as Record<string, string>).inspection_report_inspector ?? PM_EN.inspection_report_inspector}
                </label>
                <input
                  type="text"
                  value={inspectionInspectorName}
                  onChange={(e) => setInspectionInspectorName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 min-h-[44px] text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={sortInspectionOrderByDate}
                  className="inline-flex min-h-[44px] items-center rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-slate-800"
                >
                  {(t as Record<string, string>).inspection_report_order ?? PM_EN.inspection_report_order}
                </button>
              </div>
              <div>
                <p className="mb-2 font-medium text-zinc-900 dark:text-white">
                  {(t as Record<string, string>).inspection_report_select_photos ?? PM_EN.inspection_report_select_photos}
                </p>
                <ul className="space-y-2">
                  {inspectionOrderIds.map((id) => {
                    const ph = inspectionPhotosPool.find((p) => p.id === id);
                    if (!ph) return null;
                    const idx = inspectionOrderIds.indexOf(id);
                    return (
                      <li
                        key={id}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/80 dark:bg-slate-800/50 p-2"
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 sm:min-w-[200px]">
                          <input
                            type="checkbox"
                            checked={inspectionIncluded[id] !== false}
                            onChange={(e) =>
                              setInspectionIncluded((prev) => ({
                                ...prev,
                                [id]: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 shrink-0 rounded border-zinc-300 text-amber-600"
                          />
                          <img
                            src={cloudinaryThumb(ph.photo_url)}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-lg object-cover border border-zinc-200 dark:border-slate-600"
                          />
                          <span className="min-w-0 flex-1 text-xs text-zinc-700 dark:text-zinc-300">
                            <span className="font-medium text-zinc-900 dark:text-white">#{idx + 1}</span>
                            {" · "}
                            {formatDateTimeIntl(ph.created_at, dateLoc, userTz)}
                            {ph.notes?.trim() ? ` · ${ph.notes.trim().slice(0, 80)}${ph.notes.length > 80 ? "…" : ""}` : ""}
                          </span>
                        </label>
                        <div className="ml-auto flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveInspectionOrder(id, -1)}
                            disabled={idx === 0}
                            className="rounded-lg p-2.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-40"
                            aria-label={
                              (t as Record<string, string>).inspection_report_move_up ?? PM_EN.inspection_report_move_up
                            }
                          >
                            <ChevronUp className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveInspectionOrder(id, 1)}
                            disabled={idx >= inspectionOrderIds.length - 1}
                            className="rounded-lg p-2.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-40"
                            aria-label={
                              (t as Record<string, string>).inspection_report_move_down ?? PM_EN.inspection_report_move_down
                            }
                          >
                            <ChevronDown className="h-5 w-5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="mb-2 font-medium text-zinc-900 dark:text-white">
                  {(t as Record<string, string>).inspection_report_preview ?? PM_EN.inspection_report_preview}
                </p>
                <HorizontalScrollFade>
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0">
                    {inspectionOrderIds
                      .filter((i) => inspectionIncluded[i] !== false)
                      .map((id, n) => {
                        const ph = inspectionPhotosPool.find((p) => p.id === id);
                        if (!ph) return null;
                        return (
                          <div
                            key={id}
                            className="w-24 shrink-0 text-center"
                          >
                            <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-slate-600">
                              <img
                                src={cloudinaryThumb(ph.photo_url)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {n + 1}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </HorizontalScrollFade>
              </div>
            </div>
            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <button
                type="button"
                disabled={inspectionPdfBusy}
                onClick={() => setInspectionReportOpen(false)}
                className="flex-1 min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:flex-none"
              >
                {t.cancel ?? PM_EN.cancel}
              </button>
              <button
                type="button"
                disabled={
                  inspectionPdfBusy ||
                  !inspectionOrderIds.some((id) => inspectionIncluded[id] !== false)
                }
                onClick={() => void runInspectionPdfDownload()}
                className="flex-1 min-h-[44px] rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 sm:flex-none"
              >
                {inspectionPdfBusy
                  ? ((t as Record<string, string>).inspection_report_working ?? PM_EN.inspection_report_working)
                  : (t as Record<string, string>).inspection_report_generate_pdf ?? PM_EN.inspection_report_generate_pdf}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal detalle foto pendiente (vista grid) */}
      {pendingDetailEntry && (
        <>
          <div
            className="fixed inset-0 z-[62] bg-black/50 touch-none"
            aria-hidden
            onClick={() => setPendingDetailEntry(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed z-[63] left-4 right-4 top-1/2 max-h-[min(90vh,640px)] -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white pr-2">
                {t.pendingPhotosReview ?? PM_EN.pendingPhotosReview}
              </h3>
              <button
                type="button"
                onClick={() => setPendingDetailEntry(null)}
                className="rounded-lg p-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t.cancel ?? PM_EN.cancel}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {(() => {
                const entry = pendingDetailEntry;
                const cat = entry.photoCategory ?? "progress";
                const catBadgeClass =
                  cat === "progress"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : cat === "incident"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
                const catLabel = getCategoryLabel(cat, t as Record<string, string>);
                return (
                  <>
                    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-slate-700">
                      <img
                        src={cloudinaryFull(entry.photoUrls[0])}
                        alt=""
                        className="max-h-[50vh] w-full object-contain bg-zinc-100 dark:bg-slate-800"
                      />
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${catBadgeClass}`}>
                      {catLabel}
                    </span>
                    <p className="text-sm text-zinc-700 dark:text-zinc-200">
                      <span className="font-medium">{entry.submittedByName}</span>
                      <span className="text-zinc-500">
                        {" "}
                        · {formatDateTimeIntl(entry.createdAt, dateLoc, userTz)}
                      </span>
                    </p>
                    {entry.notes ? (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 italic">&ldquo;{entry.notes}&rdquo;</p>
                    ) : null}
                    {(currentUserRole === "admin" || currentUserRole === "supervisor") && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            onApproveDiaryEntry?.(entry.id);
                            setPendingDetailEntry(null);
                          }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white min-h-[44px] transition-colors hover:bg-emerald-500 sm:flex-none"
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          {t.accept ?? PM_EN.accept}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingDetailEntry(null);
                            setRejectModalId(entry.id);
                            setRejectReason("");
                          }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 min-h-[44px] dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400 sm:flex-none"
                        >
                          <XCircle className="h-4 w-4 shrink-0" />
                          {t.reject ?? PM_EN.reject}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Modal rechazo */}
      {rejectModalId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={() => setRejectModalId(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-3">
              {t.rejectReasonTitle ?? PM_EN.rejectReasonTitle}
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t.rejectReasonPlaceholder ?? PM_EN.rejectReasonPlaceholder}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400 min-h-[100px] resize-none"
              rows={3}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalId(null)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
              >
                {t.cancel ?? PM_EN.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onRejectDiaryEntry?.(rejectModalId, rejectReason.trim() || undefined);
                  setRejectModalId(null);
                }}
                className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px] transition-colors"
              >
                {t.reject ?? PM_EN.reject}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2.5 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            <span className="text-3xl font-light leading-none">×</span>
          </button>
          <img
            src={lightbox.src}
            alt="Foto ampliada"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = lightbox.fallback;
            }}
          />
        </div>
      )}
    </section>
  );
}
