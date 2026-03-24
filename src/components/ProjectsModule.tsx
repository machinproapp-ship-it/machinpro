"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Building2,
  Package,
  PackagePlus,
  MapPin,
  Users,
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
  Plus,
  Trash2,
  FileDown,
  List,
  LayoutGrid,
  HardHat,
  Circle,
} from "lucide-react";
import type { ProjectPhoto } from "@/lib/useProjectPhotos";
import {
  generatePhotoReport,
  type PhotoReportOrientation,
  type PhotoReportPhotosPerPage,
  type PhotoReportPhotoSize,
  type PhotoReportSortBy,
} from "@/lib/generatePhotoReport";
import BlueprintViewer from "@/components/BlueprintViewer";
import type { ToolStatus, ResourceRequest } from "@/components/LogisticsModule";
import type { Blueprint, Annotation, BlueprintRevision } from "@/types/blueprints";
import type { UserRole } from "@/types/shared";
import type { SafetyChecklist, SafetyChecklistItem, SafetyChecklistResponse } from "@/types/safetyChecklist";
import type { DailyFieldReport } from "@/types/dailyFieldReport";
import type { ProjectTask, TaskPriority } from "@/types/projectTask";
import { getTemplatesForCountry } from "@/lib/safetyChecklistTemplates";
import { generateSafetyChecklistPdf } from "@/lib/generateSafetyChecklistReport";
import { DailyFieldReportView } from "@/components/DailyFieldReportView";

export type { SafetyChecklist, SafetyChecklistItem, SafetyChecklistResponse } from "@/types/safetyChecklist";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type PhotoType = "obra" | "inventario";

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
  status?: "pending" | "approved" | "accepted" | "rejected";
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
  canAnnotateBlueprints?: boolean;
  cloudName?: string;
  onOpenResourceRequest?: (projectId: string) => void;
  resourceRequests?: ResourceRequest[];
  onConfirmReception?: (requestId: string) => void;
  companyPlan?: "starter" | "professional" | "enterprise";
  projectForms?: ProjectForm[];
  onCreateForm?: (
    projectId: string,
    form: Omit<ProjectForm, "id" | "createdAt" | "responses">
  ) => void;
  onDeleteForm?: (formId: string) => void;
  companyName?: string;
  companyLogoUrl?: string;
  projectPhotos?: ProjectPhoto[];
  language?: string;
  /** Display name for PDF "Generated by" and reports. */
  currentUserDisplayName?: string;
  safetyChecklists?: SafetyChecklist[];
  onSaveChecklist?: (checklist: SafetyChecklist) => void;
  countryCode?: string;
  dailyReports?: DailyFieldReport[];
  onSaveDailyReport?: (report: DailyFieldReport) => void;
  companyId?: string;
  /** Perfil Supabase (user_profiles.id) para planos / pines. */
  currentUserProfileId?: string | null;
  onOpenHazardFromBlueprint?: (hazardId: string) => void;
  onOpenCorrectiveFromBlueprint?: (correctiveActionId: string) => void;
  projectTasks?: ProjectTask[];
  onCreateTask?: (task: Omit<ProjectTask, "id" | "createdAt">) => void;
  onUpdateTask?: (taskId: string, updates: Partial<ProjectTask>) => void;
  onDeleteTask?: (taskId: string) => void;
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

function formatDate(iso: string): string {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
        <ShieldCheck className="h-3 w-3" />{t.securityOk ?? "Al día"}
      </span>
    );
  if (state === "pendiente")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <ShieldAlert className="h-3 w-3" />{t.securityPending ?? "Pendiente"}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
      <ShieldOff className="h-3 w-3" />{t.securityNoCerts ?? "Sin certificados"}
    </span>
  );
}

function getCategoryLabel(cat: string, tl: Record<string, string>): string {
  if (cat === "progress") return tl.photoProgress ?? "Avance";
  if (cat === "incident") return tl.photoIncident ?? "Incidencia";
  if (cat === "health_safety") return tl.photoHealthSafety ?? "H&S";
  return cat;
}

function PhotoStatusBadge({ status, labels }: { status?: string; labels: Record<string, string> }) {
  const t = labels;
  if (status === "approved" || status === "accepted")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />{t.photoStatusApproved ?? "Aprobada"}
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
        <XCircle className="h-3 w-3" />{t.photoStatusRejected ?? "Rechazada"}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
      <Clock className="h-3 w-3" />{t.photoStatusPending ?? "Pendiente"}
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

function checklistItemsFromTemplate(
  template: { items: { category: string; question: string }[] } | undefined
): SafetyChecklistItem[] {
  if (!template?.items.length) return [];
  const ts = Date.now();
  return template.items.map((row, i) => ({
    id: `item-${ts}-${i}`,
    category: row.category,
    question: row.question,
  }));
}

// ─── Definición de tabs ────────────────────────────────────────────────────────

type TabId =
  | "general"
  | "personal"
  | "inventario"
  | "galeria"
  | "blueprints"
  | "formularios";

const TABS: { id: TabId; icon: React.ReactNode }[] = [
  { id: "general", icon: <Info className="h-4 w-4" /> },
  { id: "personal", icon: <Users className="h-4 w-4" /> },
  { id: "inventario", icon: <Boxes className="h-4 w-4" /> },
  { id: "galeria", icon: <ImageIcon className="h-4 w-4" /> },
  { id: "blueprints", icon: <FileText className="h-4 w-4" /> },
  { id: "formularios", icon: <ClipboardList className="h-4 w-4" /> },
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
  canAnnotateBlueprints,
  cloudName = "",
  onOpenResourceRequest,
  resourceRequests = [],
  onConfirmReception,
  companyPlan = "starter",
  projectForms,
  onCreateForm,
  onDeleteForm,
  companyName = "",
  companyLogoUrl,
  projectPhotos,
  language = "es",
  currentUserDisplayName = "",
  safetyChecklists = [],
  onSaveChecklist,
  countryCode = "CA",
  dailyReports = [],
  onSaveDailyReport,
  companyId = "",
  currentUserProfileId = null,
  onOpenHazardFromBlueprint,
  onOpenCorrectiveFromBlueprint,
  projectTasks = [],
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: ProjectsModuleProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general");
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
  const [newFormTitle, setNewFormTitle] = useState("");
  const [newFormType, setNewFormType] = useState<ProjectForm["type"]>("inspection");
  const [newFormTemplateId, setNewFormTemplateId] = useState<string>("");
  const [openSafetyChecklistId, setOpenSafetyChecklistId] = useState<string | null>(null);
  const [safetyDraft, setSafetyDraft] = useState<SafetyChecklist | null>(null);
  const [openDailyReportKey, setOpenDailyReportKey] = useState<string | null>(null);
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

  const availableTemplates = useMemo(() => getTemplatesForCountry(countryCode), [countryCode]);

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

  const projectForms_filtered = (projectForms ?? []).filter(
    (f) => f.projectId === selectedProjectId
  );
  const canManageForms =
    currentUserRole === "admin" || currentUserRole === "supervisor";

  useEffect(() => {
    if (currentUserRole === "worker" && activeTab === "formularios") {
      setActiveTab("general");
    }
  }, [currentUserRole, activeTab]);

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
  const canAnnotate = canAnnotateBlueprints ?? canEdit;

  const selectedProject = selectedProjectId
    ? (projects ?? []).find((p) => p.id === selectedProjectId)
    : null;

  const assignedEmployees = (allEmployees ?? []).filter((e) =>
    (selectedProject?.assignedEmployeeIds ?? []).includes(e.id)
  );

  const projectInventory = (inventoryItems ?? []).filter(
    (i) => i.assignedToProjectId === selectedProjectId
  );
  const projectMaterials = projectInventory.filter((i) => i.type === "material");
  const projectTools = projectInventory.filter((i) => i.type === "tool");

  const projectDiary = (diaryEntries ?? []).filter((e) => e.projectId === selectedProjectId);
  const obraPhotos = projectDiary.filter((e) => e.photoType === "obra" || !e.photoType);
  const invPhotos = projectDiary.filter((e) => e.photoType === "inventario");
  const approvedObraPhotos = obraPhotos.filter(
    (e) => e.status === "approved" || e.status === "accepted"
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
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData }
      );
      const data = (await res.json()) as { secure_url?: string };
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
      }
    },
    [selectedProjectId, galleryCategoryFilter, onPhotoObra]
  );

  const openGalleryFilePickerAfterCategory = useCallback((cat: PhotoCategory) => {
    pendingUploadCategoryRef.current = cat;
    setShowCategoryModal(false);
    requestAnimationFrame(() => {
      galleryPhotoInputRef.current?.click();
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

  // ── Vista: lista de proyectos ───────────────────────────────────────────────
  if (!selectedProject) {
    return (
      <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
        <div className="border-b border-zinc-200 dark:border-slate-700 px-6 py-5">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-500" />
            {t.siteAdminView ?? "Proyectos activos"}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Selecciona un proyecto para ver su detalle completo
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projects ?? []).map((proj) => {
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
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                      {proj.name}
                    </h3>
                    {proj.location && (
                      <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />{proj.location}
                      </p>
                    )}
                  </div>
                  {pendingCount > 0 && canApprove && (
                    <span className="shrink-0 rounded-full bg-amber-500 text-white text-xs font-bold px-2 py-0.5">
                      {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                    <span>Presupuesto consumido</span>
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
                    {assigned.length} persona{assigned.length !== 1 ? "s" : ""}
                  </span>
                  <span>{formatDate(proj.estimatedEnd)}</span>
                </div>
              </button>
            );
          })}

          {(projects ?? []).length === 0 && (
            <div className="col-span-2 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
              {t.noProjectsAssigned ?? "No hay proyectos activos."}
            </div>
          )}
        </div>
      </section>
    );
  }

  // ── Vista: detalle del proyecto ─────────────────────────────────────────────
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-slate-700 px-6 py-5 bg-zinc-50 dark:bg-slate-800/60">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => onSelectProject(null)}
            className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors min-h-[44px] min-w-[44px] items-center justify-center sm:justify-start"
          >
            <ChevronLeft className="h-3.5 w-3.5" />{t.siteBackToProjects ?? "Todos los proyectos"}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 p-2.5 shrink-0">
              <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{selectedProject.name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {selectedProject.location && (
                  <span className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />{selectedProject.location}
                  </span>
                )}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedProject.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Maps
                </a>
              </div>
            </div>
          </div>

          {/* KPIs rápidos — grid 2×2 en móvil, 3 columnas si hay presupuesto + cierre + equipo */}
          <div className="grid grid-cols-2 gap-3 sm:max-w-none w-full sm:w-auto auto-rows-fr md:grid-cols-3">
            {selectedProject.budgetCAD != null && (
              <div className="rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 min-w-0">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Presupuesto
                </p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatBudget(selectedProject.budgetCAD)}</p>
                {selectedProject.spentCAD != null && (
                  <p className={`text-xs font-medium ${progress > 80 ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                    {progress}% usado
                  </p>
                )}
              </div>
            )}
            {daysRemaining !== null && (
              <div className="rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 min-w-0">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Cierre
                </p>
                <p className={`text-sm font-semibold ${daysRemaining < 0 ? "text-red-500" : daysRemaining < 30 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                  {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d vencido` : `${daysRemaining}d`}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{formatDate(selectedProject.estimatedEnd)}</p>
              </div>
            )}
            <div className="rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 min-w-0">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5 flex items-center gap-1">
                <Users className="h-3 w-3" /> {(t as Record<string, string>).project_kpi_team ?? "Team"}
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{assignedEmployees.length}</p>
              {pendingObraPhotos.length > 0 && canApprove && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {pendingObraPhotos.length} foto{pendingObraPhotos.length !== 1 ? "s" : ""} pendiente{pendingObraPhotos.length !== 1 ? "s" : ""}
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
          <div className="border-b border-zinc-200 dark:border-slate-700 px-6 flex flex-nowrap gap-0 overflow-x-auto">
            {TABS.filter(
              (tab) => currentUserRole !== "worker" || tab.id !== "formularios"
            ).map((tab) => {
              const label =
                tab.id === "general"
                  ? t.siteTabGeneral ?? t.tabGeneral ?? "General"
                  : tab.id === "personal"
                  ? t.siteTabPersonnel ?? t.personnel ?? "Personal"
                  : tab.id === "inventario"
                  ? t.siteTabInventory ?? t.whTabInventory ?? "Inventario"
                  : tab.id === "galeria"
                  ? t.siteTabGallery ?? "Galería"
                  : tab.id === "formularios"
                  ? (t as Record<string, string>).siteTabForms ?? "Formularios"
                  : tab.id === "blueprints"
                  ? (t as Record<string, string>).blueprints_title ??
                    t.blueprints ??
                    "Planos"
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
                  className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
                    activeTab === tab.id
                      ? "border-amber-500 text-amber-600 dark:text-amber-400"
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
        );
      })()}

      {/* Contenido */}
      <div className="p-6">

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
                      {t.resourcesInTransit ?? "Recursos en camino"}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      {request.items.length} items ·{" "}
                      {t.neededBy ?? "Para"}: {request.neededBy}
                    </p>
                  </div>
                </div>
                {onConfirmReception && (
                  <button
                    type="button"
                    onClick={() => onConfirmReception(request.id)}
                    className="shrink-0 text-sm rounded-xl bg-amber-600 text-white px-3 py-2 min-h-[44px] hover:bg-amber-500 transition-colors font-medium"
                  >
                    {t.confirmReception ?? "Confirmar recepción"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ══ TAB GENERAL ══ */}
        {activeTab === "general" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Tipo de proyecto" value={
                selectedProject.type === "residential" ? "Residencial" :
                selectedProject.type === "commercial" ? "Comercial" :
                selectedProject.type === "industrial" ? "Industrial" : selectedProject.type
              } />
              <InfoRow label="Ubicación" value={selectedProject.location || "—"} />
              <InfoRow label="Fecha de inicio" value={formatDate(selectedProject.estimatedStart)} />
              <InfoRow label="Fecha de cierre" value={formatDate(selectedProject.estimatedEnd)} />
              {selectedProject.budgetCAD != null && (
                <InfoRow label="Presupuesto total" value={`$${selectedProject.budgetCAD.toLocaleString("en-US")} CAD`} />
              )}
              {selectedProject.spentCAD != null && (
                <InfoRow label="Presupuesto consumido" value={`$${selectedProject.spentCAD.toLocaleString("en-US")} CAD (${progress}%)`} />
              )}
            </div>

            {selectedProject.budgetCAD != null && (
              <div>
                <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
                  <span>Ejecución presupuestaria</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progress > 80 ? "bg-red-500" : progress > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {progress > 80 && (
                  <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Alerta: presupuesto al {progress}% de capacidad
                  </p>
                )}
              </div>
            )}

            {(currentUserRole === "admin" || currentUserRole === "supervisor" || currentUserRole === "projectManager") && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                  {t.progressPhotos ?? "Capturar fotos"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setPhotoCategoryModal({ projectId: selectedProject.id }); setPhotoCategoryToSubmit("progress"); }}
                    className="flex items-center gap-3 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-5 py-4 transition-colors"
                  >
                    <Camera className="h-5 w-5 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">
                        {t.progressPhotos ?? "Foto de Obra"}
                      </p>
                      <p className="text-xs opacity-70">
                        {t.progressPhotosSub ?? "Avance · requiere aprobación"}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onPhotoInventario(selectedProject.id)}
                    className="flex items-center gap-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 text-orange-700 dark:text-orange-300 px-5 py-4 transition-colors"
                  >
                    <Package className="h-5 w-5 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">
                        {t.whPhotoForInventory ?? "Foto de Inventario"}
                      </p>
                      <p className="text-xs opacity-70">
                        {t.whInventoryAtSite ?? "Activos · directo a Logística"}
                      </p>
                    </div>
                  </button>
                </div>
                <textarea
                  value={photoNotes}
                  onChange={(e) => setPhotoNotes(e.target.value)}
                  placeholder={t.photoNotesPlaceholder ?? "Notas opcionales para la próxima foto…"}
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
                text={t.noAssignedPersonnel ?? "No hay personal asignado a este proyecto."}
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
                      {canEdit && (
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
                                          : `✓ ${formatDate(cert.expiryDate)}`
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
            {canEdit && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-slate-700">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Añadir empleado al proyecto</p>
                <div className="flex gap-2">
                  <select
                    value={addEmployeeToProjectId}
                    onChange={(e) => setAddEmployeeToProjectId(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                  >
                    <option value="">Seleccionar empleado…</option>
                    {(allEmployees ?? []).filter((e) => !(selectedProject?.assignedEmployeeIds ?? []).includes(e.id)).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!addEmployeeToProjectId}
                    onClick={() => {
                      if (!selectedProject || !addEmployeeToProjectId) return;
                      const current = selectedProject.assignedEmployeeIds ?? [];
                      onUpdateProjectEmployees?.(selectedProject.id, [...current, addEmployeeToProjectId]);
                      setAddEmployeeToProjectId("");
                    }}
                    className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-500 disabled:opacity-50 min-h-[44px]"
                  >
                    Añadir
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
                    <option value="">Añadir ítem al proyecto…</option>
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
                    Asignar
                  </button>
                </div>
                {onOpenResourceRequest && selectedProject && (
                  <button
                    type="button"
                    onClick={() => onOpenResourceRequest(selectedProject.id)}
                    className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 text-sm font-medium min-h-[44px] transition-colors"
                  >
                    <PackagePlus className="h-4 w-4" />
                    {t.requestResources ?? "Solicitar recursos"}
                  </button>
                )}
              </div>
            )}
            {/* Materiales */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Boxes className="h-4 w-4 text-amber-500" /> Materiales asignados
              </h3>
              {projectMaterials.length === 0 ? (
                <p className="text-sm text-zinc-400 italic">
                  {t.noProjectMaterials ?? "Sin materiales asignados a este proyecto."}
                </p>
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[320px]">
                    <thead className="bg-zinc-50 dark:bg-slate-800">
                      <tr className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        <th className="px-4 py-2.5 text-left">Material</th>
                        <th className="px-4 py-2.5 text-right">Cantidad</th>
                        {canEdit && <th className="px-4 py-2.5 w-12" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
                      {projectMaterials.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{item.name}</td>
                          <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">{item.quantity} {item.unit}</td>
                          {canEdit && (
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => onUpdateItemProject?.(item.id, null)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center inline-flex"
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
              )}
            </div>

            {/* Herramientas */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-500" />{t.whToolsOnSite ?? "Herramientas en obra"}
              </h3>
              {projectTools.length === 0 ? (
                <p className="text-sm text-zinc-400 italic">
                  {t.noProjectTools ?? "Sin herramientas asignadas a este proyecto."}
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
                    const statusLabel =
                      tool.toolStatus === "available" ? "Disponible" :
                      tool.toolStatus === "in_use" ? "En uso" :
                      tool.toolStatus === "maintenance" ? "En mantenimiento" :
                      tool.toolStatus === "out_of_service" ? "Fuera de servicio" :
                      tool.toolStatus === "lost" ? "Extraviado" : "Disponible";
                    return (
                      <div key={tool.id} className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-slate-700 px-4 py-3">
                        <div className="flex items-center gap-3">
                          {tool.imageUrl ? (
                            <img src={tool.imageUrl} alt={tool.name} className="h-9 w-9 rounded-lg object-cover border border-zinc-200 dark:border-slate-700" />
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
                              className="text-xs rounded-lg border border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400 px-2 py-1 hover:bg-amber-50 dark:hover:bg-amber-950/30 min-h-[36px] transition-colors"
                            >
                              {(t as Record<string, string>).returnToWarehouse ?? "Devolver"}
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
                  <Camera className="h-4 w-4 text-orange-500" />{t.invPhotosTitle ?? "Fotos de activos / registro logístico"}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {invPhotos.flatMap((entry) =>
                    (entry.photoUrls || []).map((url, i) => (
                      <button
                        key={`${entry.id}-${i}`}
                        type="button"
                        onClick={() => setLightbox({ src: url, fallback: url })}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-slate-700 bg-zinc-100 dark:bg-slate-800"
                      >
                        <img src={url} alt="Foto inventario" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
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
                text={t.noProjectInventory ?? "Sin inventario asignado a este proyecto aún."}
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
                {(t as Record<string, string>).uploadPhoto ?? "Subir foto"}
              </button>
              {pdfSourcePhotos.length > 0 && selectedProject && (
                <button
                  type="button"
                  onClick={() => setPdfConfigOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-100 min-h-[44px] transition-colors hover:bg-zinc-50 dark:hover:bg-slate-800 sm:w-auto sm:justify-start"
                >
                  <FileDown className="h-5 w-5 shrink-0" aria-hidden />
                  {(t as Record<string, string>).generatePDF ?? "Generate PDF"}
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
                    ? ((t as Record<string, string>).whFilterAll ?? "Todas")
                    : cat === "progress"
                    ? ((t as Record<string, string>).photoProgress ?? "Avance")
                    : cat === "incident"
                    ? ((t as Record<string, string>).photoIncident ?? "Incidencia")
                    : (t as Record<string, string>).photoHealthSafety ?? "H&S"}
                </button>
              ))}
            </div>
            {/* Pendientes de aprobación */}
            {canApprove && filteredPendingObra.length > 0 && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 flex-wrap">
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    {t.pendingPhotosReview ?? "Pendientes de revisión"}
                    <span className="rounded-full bg-amber-500 text-white text-xs font-bold px-2 py-0.5">
                      {filteredPendingObra.length}
                    </span>
                  </h3>
                  <div
                    className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 gap-0.5"
                    role="group"
                    aria-label={(t as Record<string, string>).listView ?? "List view"}
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
                      title={(t as Record<string, string>).listView ?? "List view"}
                    >
                      <List className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="hidden sm:inline">{(t as Record<string, string>).listView ?? "List"}</span>
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
                      title={(t as Record<string, string>).gridView ?? "Grid view"}
                    >
                      <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="hidden sm:inline">{(t as Record<string, string>).gridView ?? "Grid"}</span>
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
                                  t.workerLabel ??
                                  "Trabajador"}{" "}
                                · {entry.date}
                              </p>
                              {entry.notes && (
                                <p className="text-xs text-zinc-500 mt-0.5 italic">&ldquo;{entry.notes}&rdquo;</p>
                              )}
                            </div>
                            <PhotoStatusBadge status={entry.status} labels={t} />
                          </div>
                          <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                            {(entry.photoUrls || []).map((url, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setLightbox({ src: url, fallback: url })}
                                className="h-24 w-24 shrink-0 rounded-lg overflow-hidden border border-zinc-200 dark:border-slate-700"
                              >
                                <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                              </button>
                            ))}
                          </div>
                          <img
                            src={entry.photoUrls[0]}
                            alt=""
                            className="w-full h-48 object-cover rounded-lg mb-3"
                          />
                          <p className="text-xs text-gray-500 mb-2">
                            {entry.submittedByName} · {new Date(entry.createdAt).toLocaleDateString()} ·{" "}
                            {new Date(entry.createdAt).toLocaleTimeString()}
                          </p>
                          {(currentUserRole === "admin" || currentUserRole === "supervisor") && (
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => onApproveDiaryEntry?.(entry.id)}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2.5 text-xs font-medium min-h-[44px] transition-colors"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t.accept ?? "Aprobar"}
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
                                {t.reject ?? "Rechazar"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                            src={entry.photoUrls[0]}
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
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {t.approvedProgressTitle ?? "Avance de obra aprobado"}
                  <span className="text-xs text-zinc-400 font-normal">
                    ({filteredApprovedObra.length}{" "}
                    {filteredApprovedObra.length === 1
                      ? t.photoSingular ?? "foto"
                      : t.photosPlural ?? "fotos"}
                    )
                  </span>
                </h3>
              {filteredApprovedObra.length === 0 ? (
                <EmptyState
                  icon={<ImageIcon className="h-8 w-8" />}
                  text={t.noApprovedPhotos ?? "Aún no hay fotos de avance aprobadas."}
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredApprovedObra.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg overflow-hidden border border-gray-200"
                    >
                      <img
                        src={entry.photoUrls[0]}
                        alt="foto aprobada"
                        className="w-full h-40 object-cover"
                      />
                      <div className="p-2 bg-white">
                        <span className="text-xs font-medium">
                          {getCategoryLabel(entry.photoCategory ?? "progress", t as Record<string, string>)}
                        </span>
                        <p className="text-xs text-gray-500">{entry.submittedByName}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(entry.createdAt).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
          />
        )}

        {/* ══ TAB FORMULARIOS ══ */}
        {activeTab === "formularios" && selectedProject && currentUserRole !== "worker" && (
          <div className="p-4 space-y-4">
            <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-slate-800/50 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {(t as Record<string, string>).dailyFieldReportsTitle ?? (t as Record<string, string>).dailyFieldReport ?? "Daily Field Reports"}
              </h2>
              {(currentUserRole === "admin" || currentUserRole === "supervisor") && (
                <button
                  type="button"
                  onClick={() => setOpenDailyReportKey("new")}
                  className="flex w-full sm:w-auto items-center gap-2 rounded-xl border-2 border-amber-500 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-200 min-h-[44px]"
                >
                  <Plus className="h-4 w-4" />
                  {(t as Record<string, string>).newDailyReport ?? "New Daily Report"}
                </button>
              )}
              {dailyReportsForProject.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {(t as Record<string, string>).noDailyReportsYet ?? (t as Record<string, string>).noForms ?? ""}
                </p>
              ) : (
                <ul className="space-y-2">
                  {dailyReportsForProject.map((dr) => {
                    const tl = t as Record<string, string>;
                    const st =
                      dr.status === "draft"
                        ? { label: tl.reportStatusDraft ?? tl.formStatusDraft ?? "Draft", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" }
                        : dr.status === "submitted"
                          ? { label: tl.reportStatusSubmitted ?? "Submitted", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" }
                          : { label: tl.reportStatusApproved ?? "Approved", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" };
                    return (
                      <li key={dr.id}>
                        <button
                          type="button"
                          onClick={() => setOpenDailyReportKey(dr.id)}
                          className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm hover:border-amber-300 dark:border-zinc-600 dark:bg-slate-900 dark:hover:border-amber-600"
                        >
                          <span className="font-medium text-zinc-900 dark:text-white">
                            {formatDate(dr.date)} · {dr.createdByName}
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-slate-800/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex flex-wrap items-center gap-2">
                  {(t as Record<string, string>).todoList ?? "To-Do List"}
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
                    {(t as Record<string, string>).newTask ?? "New task"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label={(t as Record<string, string>).todoList ?? "To-Do List"}>
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
                  {(t as Record<string, string>).noTasks ?? "No tasks"}
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
                        dueExtra = tl.taskOverdue ?? "Overdue";
                      } else if (due === today) {
                        dueClass = "text-amber-600 dark:text-amber-500 font-medium";
                        dueExtra = tl.taskDueToday ?? "Due today";
                      }
                    }
                    const pr =
                      tk.priority === "urgent"
                        ? {
                            emoji: "🔴",
                            label: tl.taskPriorityUrgent ?? "Urgent",
                            cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
                          }
                        : tk.priority === "high"
                          ? {
                              emoji: "🟠",
                              label: tl.taskPriorityHigh ?? "High",
                              cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
                            }
                          : tk.priority === "medium"
                            ? {
                                emoji: "🟡",
                                label: tl.taskPriorityMedium ?? "Medium",
                                cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
                              }
                            : {
                                emoji: "🟢",
                                label: tl.taskPriorityLow ?? "Low",
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
                                ? `${tl.taskStatusCompleted ?? "Completed"} — ${tk.title}`
                                : `${tl.taskStatusCompleted ?? "Mark complete"} — ${tk.title}`
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
                            className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300"
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
                                  {formatDate(due)}
                                  {dueExtra ? ` · ${dueExtra}` : ""}
                                </span>
                              )}
                            </div>
                          </button>
                          {currentUserRole === "admin" && (
                            <button
                              type="button"
                              aria-label={tl["delete"] ?? "Delete"}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTask?.(tk.id);
                              }}
                              className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
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

            {canManageForms && (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 w-full sm:w-auto rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-4 py-3 text-sm font-medium min-h-[44px] transition-colors"
              >
                <Plus className="h-4 w-4" />
                {(t as Record<string, string>).createForm ?? "Crear formulario"}
              </button>
            )}

            {projectForms_filtered.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  {(t as Record<string, string>).noForms ?? "No hay formularios en este proyecto"}
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
                        ? tl.checklistStatusDraft ?? tl.formStatusDraft ?? "Draft"
                        : linkedCl.status === "completed"
                          ? tl.checklistStatusCompleted ?? tl.formStatusCompleted ?? "Completed"
                          : tl.checklistStatusSubmitted ?? "Submitted"
                      : form.status === "active"
                        ? tl.formStatusActive ?? "Activo"
                        : form.status === "completed"
                          ? tl.formStatusCompleted ?? "Completado"
                          : tl.formStatusDraft ?? "Borrador";
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
                              ? tl.formTypeInspection ?? "Inspección"
                              : form.type === "tailgate"
                                ? tl.formTypeTailgate ?? "Tailgate Meeting"
                                : form.type === "safety"
                                  ? tl.formTypeSafety ?? "Seguridad"
                                  : tl.formTypeCustom ?? "Personalizado"}
                            {form.type === "safety" && linkedCl
                              ? ` · ${linkedCl.items.length} ${tl.checklistItemsLabel ?? "items"}`
                              : ` · ${form.responses.length} ${tl.responses ?? "respuestas"}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                            {statusLabel}
                          </span>
                          {canManageForms && (
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
                    {(t as Record<string, string>).createForm ?? "Crear formulario"}
                  </h3>
                  <input
                    type="text"
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                    placeholder={(t as Record<string, string>).formTitle ?? "Título del formulario"}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                  />
                  <select
                    value={newFormType}
                    onChange={(e) => setNewFormType(e.target.value as ProjectForm["type"])}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                  >
                    <option value="inspection">
                      {(t as Record<string, string>).formTypeInspection ?? "Inspección"}
                    </option>
                    <option value="tailgate">
                      {(t as Record<string, string>).formTypeTailgate ?? "Tailgate Meeting"}
                    </option>
                    <option value="safety">
                      {(t as Record<string, string>).formTypeSafety ?? "Seguridad"}
                    </option>
                    <option value="custom">
                      {(t as Record<string, string>).formTypeCustom ?? "Personalizado"}
                    </option>
                  </select>
                  {newFormType === "safety" && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        {(t as Record<string, string>).selectTemplate ?? "Select template"}
                      </label>
                      <select
                        value={newFormTemplateId}
                        onChange={(e) => setNewFormTemplateId(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                      >
                        <option value="">
                          {(t as Record<string, string>).noTemplate ?? "No template (manual)"}
                        </option>
                        {availableTemplates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewFormTitle("");
                        setNewFormTemplateId("");
                      }}
                      className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 py-3 text-sm min-h-[44px]"
                    >
                      {t.cancel ?? "Cancelar"}
                    </button>
                    <button
                      type="button"
                      disabled={!newFormTitle.trim()}
                      onClick={() => {
                        if (!newFormTitle.trim() || !selectedProjectId) return;
                        if (newFormType === "safety") {
                          const checklistId = `scl-${Date.now()}`;
                          const tpl = newFormTemplateId
                            ? availableTemplates.find((x) => x.id === newFormTemplateId)
                            : undefined;
                          const items = checklistItemsFromTemplate(tpl);
                          const checklist: SafetyChecklist = {
                            id: checklistId,
                            projectId: selectedProjectId,
                            title: newFormTitle.trim(),
                            date: new Date().toISOString().slice(0, 10),
                            conductedBy: currentUserEmployeeId ?? "",
                            conductedByName: currentUserDisplayName || currentUserName || "",
                            items,
                            status: "draft",
                            createdAt: new Date().toISOString(),
                          };
                          onSaveChecklist?.(checklist);
                          onCreateForm?.(selectedProjectId, {
                            projectId: selectedProjectId,
                            title: newFormTitle.trim(),
                            type: "safety",
                            status: "draft",
                            createdBy: currentUserName ?? "",
                            fields: [],
                            qrCode: undefined,
                            safetyChecklistId: checklistId,
                          });
                          setOpenSafetyChecklistId(checklistId);
                        } else {
                          onCreateForm?.(selectedProjectId, {
                            projectId: selectedProjectId,
                            title: newFormTitle.trim(),
                            type: newFormType,
                            status: "active",
                            createdBy: currentUserName ?? "",
                            fields: [],
                            qrCode: undefined,
                          });
                        }
                        setShowCreateForm(false);
                        setNewFormTitle("");
                        setNewFormTemplateId("");
                      }}
                      className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-3 text-sm font-medium min-h-[44px]"
                    >
                      {(t as Record<string, string>).create ?? "Crear"}
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
                      ? (t as Record<string, string>).newTask ?? "New task"
                      : (t as Record<string, string>).editTask ?? "Edit task"}
                  </h3>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {(t as Record<string, string>).taskTitle ?? "Task title"}
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
                      {(t as Record<string, string>).taskDescription ?? "Description"}
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
                      {(t as Record<string, string>).taskPriority ?? "Priority"}
                    </label>
                    <select
                      value={taskDraft.priority}
                      onChange={(e) =>
                        setTaskDraft((d) => ({ ...d, priority: e.target.value as TaskPriority }))
                      }
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                    >
                      <option value="urgent">
                        {(t as Record<string, string>).taskPriorityUrgent ?? "Urgent"}
                      </option>
                      <option value="high">
                        {(t as Record<string, string>).taskPriorityHigh ?? "High"}
                      </option>
                      <option value="medium">
                        {(t as Record<string, string>).taskPriorityMedium ?? "Medium"}
                      </option>
                      <option value="low">
                        {(t as Record<string, string>).taskPriorityLow ?? "Low"}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {(t as Record<string, string>).taskAssignedTo ?? "Assigned to"}
                    </label>
                    <select
                      value={taskDraft.assignedToEmployeeId}
                      onChange={(e) =>
                        setTaskDraft((d) => ({ ...d, assignedToEmployeeId: e.target.value }))
                      }
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                    >
                      <option value="">
                        {(t as Record<string, string>).taskUnassigned ?? "Unassigned"}
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
                      {(t as Record<string, string>).taskDueDate ?? "Due date"}
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
                      {t.cancel ?? "Cancel"}
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
                      {t.save ?? "Save"}
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
                      {t.back ?? "Back"}
                    </button>
                    <h2 id="safety-checklist-title" className="text-lg font-semibold text-zinc-900 dark:text-white truncate">
                      {safetyDraft.title}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {(t as Record<string, string>).safetyChecklist ?? "Safety Checklist"}
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
                        (t as Record<string, string>).formStatusDraft ??
                        "Draft"
                      : safetyDraft.status === "completed"
                        ? (t as Record<string, string>).checklistStatusCompleted ??
                          (t as Record<string, string>).formStatusCompleted ??
                          "Completed"
                        : (t as Record<string, string>).checklistStatusSubmitted ?? "Submitted"}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400 text-xs">
                        {(t as Record<string, string>).checklistDate ?? (t as Record<string, string>).date ?? "Date"}
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
                        {(t as Record<string, string>).conductedBy ?? "Conducted by"}
                      </p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {safetyDraft.conductedByName || safetyDraft.conductedBy || "—"}
                      </p>
                    </div>
                  </div>

                  {safetyDraft.items.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-8">
                      {(t as Record<string, string>).checklistEmptyItems ?? (t as Record<string, string>).noForms ?? ""}
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
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                                    {tl.checklistYes ?? "Yes"}
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
                                    {tl.checklistNo ?? "No"}
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
                                    {tl.checklistNA ?? "N/A"}
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
                                    {tl.checklistNeedsImprovement ?? "Needs improvement"}
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
                                      placeholder={tl.checklistActionBy ?? ""}
                                      aria-label={tl.checklistActionBy ?? ""}
                                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px]"
                                    />
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                                      {tl.checklistDueDate ?? ""}
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
                                      placeholder={tl.checklistComments ?? ""}
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
                    {(t as Record<string, string>).saveDraft ?? "Save draft"}
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
                    {(t as Record<string, string>).completeChecklist ?? "Complete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!safetyDraft || !selectedProject) return;
                      generateSafetyChecklistPdf({
                        checklist: safetyDraft,
                        projectName: selectedProject.name,
                        companyName,
                        language,
                        labels: t as Record<string, string>,
                      });
                    }}
                    className="flex-1 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white py-3 text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    {(t as Record<string, string>).printReport ?? "PDF"}
                  </button>
                </div>
              </div>
            )}

            {openDailyReportKey !== null &&
              selectedProject &&
              (openDailyReportKey === "new" || dailyReports.some((r) => r.id === openDailyReportKey)) && (
              <div className="fixed inset-0 z-[70] flex min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
                <DailyFieldReportView
                  key={openDailyReportKey === "new" ? `dfr-new-${selectedProject.id}` : openDailyReportKey}
                  report={
                    openDailyReportKey === "new"
                      ? null
                      : dailyReports.find((r) => r.id === openDailyReportKey) ?? null
                  }
                  projectId={selectedProject.id}
                  projectName={selectedProject.name}
                  companyName={companyName}
                  companyId={companyId}
                  employees={(allEmployees ?? []).map((e) => ({
                    id: e.id,
                    name: e.name,
                    role: e.role,
                  }))}
                  currentUserName={currentUserDisplayName || currentUserName || ""}
                  currentUserEmployeeId={currentUserEmployeeId ?? ""}
                  language={language}
                  labels={t as Record<string, string>}
                  countryCode={countryCode}
                  companyLogoUrl={companyLogoUrl}
                  onSave={(r) => {
                    onSaveDailyReport?.(r);
                  }}
                  onBack={() => setOpenDailyReportKey(null)}
                />
              </div>
            )}
          </div>
        )}
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
            className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="gallery-category-modal-title"
              className="text-base font-semibold text-zinc-900 dark:text-white mb-4 text-center"
            >
              {(t as Record<string, string>).selectPhotoCategory ?? "What type of photo?"}
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
                    {(t as Record<string, string>).photoProgress ?? "Avance"}
                  </span>
                  <span className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
                    {(t as Record<string, string>).progressDesc ?? "Construction progress"}
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
                    {(t as Record<string, string>).photoIncident ?? "Incidencia"}
                  </span>
                  <span className="text-xs text-red-800/80 dark:text-red-200/80">
                    {(t as Record<string, string>).incidentDesc ?? "Incidents"}
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
                    {(t as Record<string, string>).photoHealthSafety ?? "H&S"}
                  </span>
                  <span className="text-xs text-blue-800/80 dark:text-blue-200/80">
                    {(t as Record<string, string>).photoGalleryHealthDesc ?? "Health & safety"}
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
                {t.cancel ?? "Cancelar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal categoría foto obra */}
      {photoCategoryModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={() => setPhotoCategoryModal(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-3">
              {(t as Record<string, string>).photoCategoryLabel ?? "Categoría de la foto"}
            </h3>
            <div className="grid grid-cols-3 gap-2">
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
                    ? ((t as Record<string, string>).photoProgress ?? "Avance")
                    : cat === "incident"
                    ? ((t as Record<string, string>).photoIncident ?? "Incidencia")
                    : (t as Record<string, string>).photoHealthSafety ?? "H&S"}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPhotoCategoryModal(null)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
              >
                {t.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onPhotoObra(photoCategoryModal.projectId, photoCategoryToSubmit);
                  setPhotoCategoryModal(null);
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
              >
                {t.save ?? "Guardar"}
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
                {(t as Record<string, string>).pdfConfig ?? "Configure PDF"}
              </h2>
            </div>
            <div className="space-y-5 p-4 text-sm text-zinc-800 dark:text-zinc-200">
              <fieldset className="space-y-2">
                <legend className="font-medium text-zinc-900 dark:text-white mb-1">
                  {(t as Record<string, string>).sortBy ?? "Sort"}
                </legend>
                {(
                  [
                    ["date_desc", (t as Record<string, string>).sortDateDesc ?? ""],
                    ["date_asc", (t as Record<string, string>).sortDateAsc ?? ""],
                    ["category", (t as Record<string, string>).sortCategory ?? ""],
                    ["author", (t as Record<string, string>).sortAuthor ?? ""],
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
                  {(t as Record<string, string>).photosPerPage ?? ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      [1, (t as Record<string, string>).pdfPerPage1 ?? "1"],
                      [2, (t as Record<string, string>).pdfPerPage2 ?? "2"],
                      [4, (t as Record<string, string>).pdfPerPage4 ?? "4"],
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
                  {(t as Record<string, string>).photoSize ?? ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["large", (t as Record<string, string>).photoSizeLarge ?? ""],
                      ["medium", (t as Record<string, string>).photoSizeMedium ?? ""],
                      ["small", (t as Record<string, string>).photoSizeSmall ?? ""],
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
                  {(t as Record<string, string>).pdfIncludeInReport ?? "Include"}
                </legend>
                {(
                  [
                    [pdfIncludeGps, setPdfIncludeGps, (t as Record<string, string>).includeGps ?? ""],
                    [pdfIncludeAuthor, setPdfIncludeAuthor, (t as Record<string, string>).includeAuthor ?? ""],
                    [pdfIncludeDate, setPdfIncludeDate, (t as Record<string, string>).includeDate ?? ""],
                    [pdfIncludeNotes, setPdfIncludeNotes, (t as Record<string, string>).includeNotes ?? ""],
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
                  {(t as Record<string, string>).pdfPhotoScope ?? ""}
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
                    {(t as Record<string, string>).pdfPhotosApprovedOnly ?? ""}
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
                    {(t as Record<string, string>).pdfPhotosAll ?? ""}
                  </button>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="font-medium text-zinc-900 dark:text-white mb-1">
                  {(t as Record<string, string>).pdfOrientation ?? ""}
                </legend>
                <label className="flex cursor-pointer items-center gap-3 min-h-[44px] rounded-lg px-2 py-1 hover:bg-zinc-50 dark:hover:bg-slate-800/80">
                  <input
                    type="radio"
                    name="pdf-orientation"
                    checked={pdfOrientation === "portrait"}
                    onChange={() => setPdfOrientation("portrait")}
                    className="h-4 w-4 shrink-0 border-zinc-300 text-amber-600"
                  />
                  <span>{(t as Record<string, string>).orientationPortrait ?? ""}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 min-h-[44px] rounded-lg px-2 py-1 hover:bg-zinc-50 dark:hover:bg-slate-800/80">
                  <input
                    type="radio"
                    name="pdf-orientation"
                    checked={pdfOrientation === "landscape"}
                    onChange={() => setPdfOrientation("landscape")}
                    className="h-4 w-4 shrink-0 border-zinc-300 text-amber-600"
                  />
                  <span>{(t as Record<string, string>).orientationLandscape ?? ""}</span>
                </label>
              </fieldset>
            </div>
            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <button
                type="button"
                onClick={() => setPdfConfigOpen(false)}
                className="flex-1 min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:flex-none"
              >
                {t.cancel ?? "Cancelar"}
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
                  });
                  setPdfConfigOpen(false);
                }}
                className="flex-1 min-h-[44px] rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 sm:flex-none"
              >
                {(t as Record<string, string>).generatePDF ?? "Generate PDF"}
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
                {t.pendingPhotosReview ?? "Review"}
              </h3>
              <button
                type="button"
                onClick={() => setPendingDetailEntry(null)}
                className="rounded-lg p-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t.cancel ?? "Close"}
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
                        src={entry.photoUrls[0]}
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
                        · {new Date(entry.createdAt).toLocaleDateString()} ·{" "}
                        {new Date(entry.createdAt).toLocaleTimeString()}
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
                          {t.accept ?? "Aprobar"}
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
                          {t.reject ?? "Rechazar"}
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
              {t.rejectReasonTitle ?? "Motivo del rechazo"}
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t.rejectReasonPlaceholder ?? "Explica brevemente por qué se rechaza esta foto (opcional)…"}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400 min-h-[100px] resize-none"
              rows={3}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalId(null)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
              >
                {t.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onRejectDiaryEntry?.(rejectModalId, rejectReason.trim() || undefined);
                  setRejectModalId(null);
                }}
                className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px] transition-colors"
              >
                {t.reject ?? "Rechazar"}
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
