"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  FileText,
  Plus,
  ChevronLeft,
  X,
  Copy,
  Trash2,
  Pencil,
  PenLine,
  MapPinned,
} from "lucide-react";
import type {
  FormTemplate,
  FormInstance,
  FormField,
  AttendeeRecord,
  FormContextType,
} from "@/types/forms";
import { generateFormPDF } from "@/lib/generateFormPDF";
import { BrandWordmark } from "@/components/BrandWordmark";
import { FormFieldInput } from "@/components/FormFieldInput";
import {
  resolveFormLabel,
  resolveTemplateName,
  formatFormFieldValue,
} from "@/lib/formTemplateDisplay";
import { buildFormInstanceFromTemplate } from "@/lib/formInstanceFactory";
import { FormTemplateBuilder } from "@/components/FormTemplateBuilder";
import QRCode from "qrcode";
import { ALL_TRANSLATIONS } from "@/lib/i18n";
import { formatTime, resolveUserTimezone } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";

const PM_EN = ALL_TRANSLATIONS.en as Record<string, string>;

type FormsView = "list" | "template" | "fill" | "detail" | "builder";

const TEMPLATE_LIB_CATEGORY_FILTERS: { value: string; labelKey: string }[] = [
  { value: "", labelKey: "forms_templates_filter_all" },
  { value: "form_cat_meeting", labelKey: "form_cat_meeting" },
  { value: "form_cat_report", labelKey: "form_cat_report" },
  { value: "form_cat_inspection", labelKey: "form_cat_inspection" },
  { value: "form_cat_permit", labelKey: "form_cat_permit" },
  { value: "form_cat_training", labelKey: "form_cat_training" },
  { value: "form_cat_loto", labelKey: "form_cat_loto" },
  { value: "form_cat_prl", labelKey: "form_cat_prl" },
  { value: "form_cat_rams", labelKey: "form_cat_rams" },
  { value: "form_cat_ats", labelKey: "form_cat_ats" },
  { value: "form_cat_tools", labelKey: "form_cat_tools" },
  { value: "form_cat_scaffold", labelKey: "form_cat_scaffold" },
  { value: "form_cat_rental", labelKey: "form_cat_rental" },
  { value: "form_cat_forklift", labelKey: "form_cat_forklift" },
  { value: "form_cat_ppe", labelKey: "form_cat_ppe" },
  { value: "form_cat_custom", labelKey: "form_cat_custom" },
  { value: "__my__", labelKey: "form_cat_my_templates" },
];
type ListTab = "pending" | "in_progress" | "completed" | "all";

interface ProjectBasic {
  id: string;
  name: string;
  assignedEmployeeIds?: string[];
}

interface EmployeeBasic {
  id: string;
  name: string;
  email?: string;
}

export interface FormsModuleProps {
  templates: FormTemplate[];
  instances: FormInstance[];
  projects: ProjectBasic[];
  employees: EmployeeBasic[];
  currentUserEmployeeId: string;
  currentUserName: string;
  canManage: boolean;
  /** Si no se pasan, se derivan de `canManage` / true para relleno (compat). */
  canCreateForms?: boolean;
  canManageFormTemplates?: boolean;
  canFillForms?: boolean;
  canApproveForms?: boolean;
  canExportForms?: boolean;
  /** Ver biblioteca / listado completo (canViewForms). Sin esto, solo relleno/aprobación según otros flags. */
  canViewForms?: boolean;
  onCreateInstance: (instance: FormInstance) => void;
  onUpdateInstance: (instance: FormInstance) => void;
  onAddTemplate: (tpl: FormTemplate) => void;
  onUpdateTemplate: (tpl: FormTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  labels?: Record<string, string>;
  dateLocale?: string;
  timeZone?: string;
  /** When set with a matching instance, opens the step-by-step fill view (e.g. after creating from a project). */
  openFillInstanceId?: string | null;
  /** Optional project filter to apply when opening fill from navigation. */
  listProjectFilterOnOpen?: string | null;
  /** Filtro por vehículo o alquiler al entrar desde Logística. */
  listContextFilterOnOpen?: { type: "vehicle" | "rental"; id: string } | null;
  onConsumeListContextFilter?: () => void;
  /** Incrementar para abrir la vista de plantillas (crear formulario). */
  openTemplatePickerToken?: number;
  vehicles?: { id: string; plate: string }[];
  rentals?: { id: string; name: string }[];
  onConsumeOpenFillNavigation?: () => void;
  /** Nombres de proyecto cuando `projects` no incluye el id (p. ej. instancias antiguas). */
  projectNameById?: Record<string, string>;
  /** Instancias en cola offline / pendientes de sincronizar con Supabase. */
  offlinePendingInstanceIds?: string[];
}

function formContextBadgeClass(ctx: FormContextType | undefined): string {
  switch (ctx ?? "general") {
    case "project":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200";
    case "vehicle":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200";
    case "rental":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300";
  }
}

function FormTemplatePickCard({
  template,
  projects,
  vehicles,
  rentals,
  labels,
  canCreateForms,
  canManageFormTemplates,
  l,
  onPick,
  onUpdateTemplate,
  onDeleteTemplate,
  onDuplicate,
}: {
  template: FormTemplate;
  projects: ProjectBasic[];
  vehicles: { id: string; plate: string }[];
  rentals: { id: string; name: string }[];
  labels: Record<string, string>;
  canCreateForms: boolean;
  canManageFormTemplates: boolean;
  l: (k: string) => string;
  onPick: (templateId: string, ctx: { type: FormContextType; id: string | null; name: string | null }) => void;
  onUpdateTemplate: (tpl: FormTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onDuplicate: (tpl: FormTemplate) => void;
}) {
  const [ctxType, setCtxType] = useState<FormContextType>("project");
  const [targetId, setTargetId] = useState("");

  const canCreate =
    canCreateForms &&
    (ctxType === "general" ||
      (ctxType === "project" && Boolean(targetId)) ||
      (ctxType === "vehicle" && Boolean(targetId)) ||
      (ctxType === "rental" && Boolean(targetId)));

  const submit = () => {
    if (!canCreate) return;
    if (ctxType === "general") {
      onPick(template.id, { type: "general", id: null, name: null });
      return;
    }
    if (ctxType === "project") {
      const p = projects.find((x) => x.id === targetId);
      onPick(template.id, { type: "project", id: targetId, name: p?.name ?? null });
      return;
    }
    if (ctxType === "vehicle") {
      const v = vehicles.find((x) => x.id === targetId);
      onPick(template.id, { type: "vehicle", id: targetId, name: v?.plate ?? null });
      return;
    }
    const r = rentals.find((x) => x.id === targetId);
    onPick(template.id, { type: "rental", id: targetId, name: r?.name ?? null });
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
            template.isBase
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          }`}
        >
          {template.isBase ? (
            <BrandWordmark tone="onLight" className="inline text-xs font-medium" />
          ) : (
            l("forms_company_badge")
          )}
        </span>
      </div>
      <h3 className="font-semibold text-zinc-900 dark:text-white">
        {resolveTemplateName(template, labels)}
      </h3>
      {template.description && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
          {resolveFormLabel(template.description, labels)}
        </p>
      )}
      <p className="text-xs text-zinc-400">
        {template.region.join(", ")} · {resolveFormLabel(template.category, labels)}
      </p>
      <div className="space-y-2 pt-1">
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {l("forms_context_label")}
        </label>
        <select
          value={ctxType}
          onChange={(e) => {
            setCtxType(e.target.value as FormContextType);
            setTargetId("");
          }}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
        >
          <option value="project">{l("forms_context_project")}</option>
          <option value="vehicle">{l("forms_context_vehicle")}</option>
          <option value="rental">{l("forms_context_rental")}</option>
          <option value="general">{l("forms_context_general")}</option>
        </select>
        {ctxType === "project" ? (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
          >
            <option value="">{l("forms_select_placeholder")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        {ctxType === "vehicle" ? (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
          >
            <option value="">{l("forms_select_placeholder")}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        ) : null}
        {ctxType === "rental" ? (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
          >
            <option value="">{l("forms_select_placeholder")}</option>
            {rentals.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 mt-auto pt-2">
        <button
          type="button"
          disabled={!canCreate}
          onClick={submit}
          className="rounded-lg bg-amber-600 dark:bg-amber-500 text-white px-4 py-2.5 text-sm font-medium min-h-[44px] disabled:opacity-50 disabled:pointer-events-none hover:bg-amber-500"
        >
          {l("useTemplate")}
        </button>
        {canManageFormTemplates && !template.isBase && (
          <>
            <button
              type="button"
              onClick={() => onUpdateTemplate(template)}
              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={labels.edit}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteTemplate(template.id)}
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={l("forms_delete_template")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
        {canManageFormTemplates && (
          <button
            type="button"
            onClick={() => onDuplicate(template)}
            className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center text-sm"
            title={l("forms_duplicate")}
          >
            {l("forms_duplicate")}
          </button>
        )}
      </div>
    </div>
  );
}

function SignatureCanvas({
  value,
  onChange,
  onClear,
  label,
  clearLabel,
  disabled,
}: {
  value: string | undefined;
  onChange: (base64: string) => void;
  onClear: () => void;
  label: string;
  clearLabel: string;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  const getPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const can = canvasRef.current;
      if (!can) return { x: 0, y: 0 };
      const rect = can.getBoundingClientRect();
      const scaleX = can.width / rect.width;
      const scaleY = can.height / rect.height;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const start = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      e.preventDefault();
      setDrawing(true);
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    },
    [disabled, getPos]
  );

  const move = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!drawing || disabled) return;
      e.preventDefault();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [drawing, disabled, getPos]
  );

  const end = useCallback(() => {
    if (!drawing) return;
    setDrawing(false);
    const can = canvasRef.current;
    if (!can) return;
    const data = can.toDataURL("image/png");
    onChange(data);
  }, [drawing, onChange]);

  const clear = useCallback(() => {
    const can = canvasRef.current;
    if (!can) return;
    const ctx = can.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, can.width, can.height);
    onClear();
  }, [onClear]);

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label}
      </label>
      <canvas
        ref={canvasRef}
        width={400}
        height={120}
        className={`border border-zinc-300 dark:border-zinc-600 rounded-lg w-full touch-none bg-white dark:bg-slate-800${disabled ? " opacity-70 pointer-events-none" : ""}`}
        style={{ maxWidth: "100%", height: "auto" }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      {!disabled && (
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-400"
      >
        {clearLabel}
      </button>
      )}
    </div>
  );
}

export function FormsModule({
  templates,
  instances,
  projects,
  employees,
  currentUserEmployeeId,
  currentUserName,
  canManage,
  canCreateForms: canCreateFormsProp,
  canManageFormTemplates: canManageFormTemplatesProp,
  canFillForms: canFillFormsProp,
  canApproveForms: canApproveFormsProp,
  canExportForms: canExportFormsProp,
  canViewForms: canViewFormsProp = true,
  onCreateInstance,
  onUpdateInstance,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  labels: labelsProp,
  dateLocale = typeof navigator !== "undefined" ? navigator.language : "en-US",
  timeZone: timeZoneProp,
  openFillInstanceId: openFillInstanceIdProp = null,
  listProjectFilterOnOpen = null,
  listContextFilterOnOpen = null,
  onConsumeListContextFilter,
  openTemplatePickerToken = 0,
  vehicles: vehiclesProp = [],
  rentals: rentalsProp = [],
  onConsumeOpenFillNavigation,
  projectNameById = {},
  offlinePendingInstanceIds = [],
}: FormsModuleProps) {
  void useMachinProDisplayPrefs();
  const timeZone = timeZoneProp ?? resolveUserTimezone(null);
  const t = { ...PM_EN, ...labelsProp } as Record<string, string>;
  const l = (k: string) => t[k] ?? PM_EN[k] ?? k;
  const canCreateForms = canCreateFormsProp ?? canManage;
  const canManageFormTemplates = canManageFormTemplatesProp ?? canManage;
  const canFillForms = canFillFormsProp ?? true;
  const canApproveForms = canApproveFormsProp ?? canManage;
  const canExportForms = canExportFormsProp ?? canManage;
  const canViewForms = canViewFormsProp !== false;
  const fillReadOnly = !canFillForms;
  const [view, setView] = useState<FormsView>("list");
  const [listTab, setListTab] = useState<ListTab>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [fillInstanceId, setFillInstanceId] = useState<string | null>(null);
  const [detailInstanceId, setDetailInstanceId] = useState<string | null>(null);
  const [createFromTemplateId, setCreateFromTemplateId] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{
    signToken: string;
    link: string;
    templateName: string;
    expiresInHours: number;
    instance: FormInstance;
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailMode, setEmailMode] = useState<"employee" | "external">("employee");
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState("");
  const [fillDraftValues, setFillDraftValues] = useState<Record<string, unknown>>({});
  const [fillDraftAttendees, setFillDraftAttendees] = useState<AttendeeRecord[]>([]);
  const [directSignAttendee, setDirectSignAttendee] = useState<AttendeeRecord | null>(null);
  const [directSignInstance, setDirectSignInstance] = useState<FormInstance | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const directSignCanvasRef = useRef<HTMLCanvasElement>(null);
  const [addVisitorModalOpen, setAddVisitorModalOpen] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorCompany, setVisitorCompany] = useState("");
  const [visitorOrientation, setVisitorOrientation] = useState<"yes" | "na">("na");
  const [isDrawingVisitor, setIsDrawingVisitor] = useState(false);
  const visitorSignCanvasRef = useRef<HTMLCanvasElement>(null);
  const [filterAssigneeId, setFilterAssigneeId] = useState("");
  const [fillSectionIndex, setFillSectionIndex] = useState(0);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("");
  const [listContextFilter, setListContextFilter] = useState<{ type: "vehicle" | "rental"; id: string } | null>(
    null
  );

  const vehicles = vehiclesProp;
  const rentals = rentalsProp;

  const lastTemplatePickerTkRef = useRef(0);
  useEffect(() => {
    if (!openTemplatePickerToken || openTemplatePickerToken <= lastTemplatePickerTkRef.current) return;
    lastTemplatePickerTkRef.current = openTemplatePickerToken;
    if (canViewForms || canCreateForms) setView("template");
  }, [openTemplatePickerToken, canViewForms, canCreateForms]);

  useEffect(() => {
    if (!listContextFilterOnOpen) return;
    setSelectedProjectId("");
    setListContextFilter(listContextFilterOnOpen);
    onConsumeListContextFilter?.();
  }, [listContextFilterOnOpen, onConsumeListContextFilter]);

  const libraryTemplates = useMemo(() => {
    if (!templateCategoryFilter) return templates;
    if (templateCategoryFilter === "__my__") return templates.filter((x) => !x.isBase);
    return templates.filter((x) => x.category === templateCategoryFilter);
  }, [templates, templateCategoryFilter]);

  const openDirectSignModal = useCallback((att: AttendeeRecord, instance: FormInstance) => {
    setDirectSignAttendee(att);
    setDirectSignInstance(instance);
  }, []);

  useEffect(() => {
    if (fillInstanceId) setFillSectionIndex(0);
  }, [fillInstanceId]);

  const consumedOpenFillIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openFillInstanceIdProp) {
      consumedOpenFillIdRef.current = null;
      return;
    }
    if (consumedOpenFillIdRef.current === openFillInstanceIdProp) return;
    const inst = instances.find((i) => i.id === openFillInstanceIdProp);
    if (!inst) return;
    consumedOpenFillIdRef.current = openFillInstanceIdProp;
    setListContextFilter(null);
    if (listProjectFilterOnOpen) setSelectedProjectId(listProjectFilterOnOpen);
    setFillInstanceId(inst.id);
    setFillDraftValues(inst.fieldValues);
    setFillDraftAttendees(inst.attendees);
    setFillSectionIndex(0);
    setView("fill");
    onConsumeOpenFillNavigation?.();
  }, [openFillInstanceIdProp, listProjectFilterOnOpen, instances, onConsumeOpenFillNavigation]);

  const getDirectSignCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = directSignCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDirectSign = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = directSignCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getDirectSignCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    canvas.setPointerCapture(e.pointerId);
  };

  const continueDirectSign = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = directSignCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getDirectSignCoords(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDirectSign = () => setIsDrawing(false);

  const clearDirectSignCanvas = useCallback(() => {
    const canvas = directSignCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const saveDirectSign = useCallback(() => {
    const canvas = directSignCanvasRef.current;
    if (!canvas || !directSignAttendee || !directSignInstance) return;
    const signature = canvas.toDataURL("image/png");
    const updated: FormInstance = {
      ...directSignInstance,
      attendees: directSignInstance.attendees.map((a) =>
        a.id === directSignAttendee.id
          ? {
              ...a,
              signature,
              signedAt: new Date().toISOString(),
              signedOnSupervisorDevice: true,
            }
          : a
      ),
    };
    onUpdateInstance(updated);
    setDirectSignAttendee(null);
    setDirectSignInstance(null);
    clearDirectSignCanvas();
  }, [directSignAttendee, directSignInstance, onUpdateInstance, clearDirectSignCanvas]);

  const getVisitorSignCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = visitorSignCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startVisitorSign = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = visitorSignCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getVisitorSignCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawingVisitor(true);
    canvas.setPointerCapture(e.pointerId);
  };

  const continueVisitorSign = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingVisitor) return;
    const canvas = visitorSignCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getVisitorSignCoords(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clearVisitorSignCanvas = useCallback(() => {
    const canvas = visitorSignCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const saveVisitor = useCallback(() => {
    if (!visitorName.trim() || !visitorCompany.trim()) return;
    const instance = fillInstanceId ? instances.find((i) => i.id === fillInstanceId) : null;
    if (!instance) return;
    const sig = visitorSignCanvasRef.current?.toDataURL("image/png");
    const newAttendee: AttendeeRecord = {
      id: crypto.randomUUID(),
      name: visitorName.trim(),
      company: visitorCompany.trim(),
      isExternal: true,
      orientationGiven: visitorOrientation === "yes",
      signedAt: new Date().toISOString(),
      signature: sig ?? undefined,
    };
    const updated: FormInstance = {
      ...instance,
      attendees: [...instance.attendees, newAttendee],
    };
    onUpdateInstance(updated);
    setVisitorName("");
    setVisitorCompany("");
    setVisitorOrientation("na");
    clearVisitorSignCanvas();
    setAddVisitorModalOpen(false);
    setFillDraftAttendees(updated.attendees);
  }, [visitorName, visitorCompany, visitorOrientation, fillInstanceId, instances, onUpdateInstance, clearVisitorSignCanvas]);

  const filteredInstances = useMemo(() => {
    let list = instances;
    if (selectedProjectId && view === "list") {
      list = list.filter((i) => i.projectId === selectedProjectId);
    }
    if (listContextFilter && view === "list") {
      if (listContextFilter.type === "vehicle") {
        list = list.filter((i) => i.contextType === "vehicle" && i.contextId === listContextFilter.id);
      } else {
        list = list.filter((i) => i.contextType === "rental" && i.contextId === listContextFilter.id);
      }
    }
    return list;
  }, [instances, selectedProjectId, view, listContextFilter]);

  const assigneeFilteredInstances =
    filterAssigneeId && view === "list"
      ? filteredInstances.filter((i) => i.createdBy === filterAssigneeId)
      : filteredInstances;

  const listByTab =
    listTab === "pending"
      ? assigneeFilteredInstances.filter((i) => i.status === "draft")
      : listTab === "in_progress"
      ? assigneeFilteredInstances.filter((i) => i.status === "in_progress")
      : listTab === "completed"
      ? assigneeFilteredInstances.filter((i) =>
          ["completed", "approved"].includes(i.status)
        )
      : assigneeFilteredInstances;

  const assigneeFilterName = useMemo(() => {
    if (!filterAssigneeId) return "";
    return employees.find((e) => e.id === filterAssigneeId)?.name ?? filterAssigneeId;
  }, [filterAssigneeId, employees]);

  const getTemplate = (id: string) => templates.find((x) => x.id === id);
  const getProject = (id: string) => projects.find((p) => p.id === id);
  const resolveProjectLabel = (projectId: string | undefined | null, inst: FormInstance) => {
    const pid = projectId ?? "";
    if (!pid) return inst.contextName ?? "—";
    return (
      projectNameById[pid] ??
      getProject(pid)?.name ??
      inst.contextName ??
      pid
    );
  };

  const handleUseTemplate = (
    templateId: string,
    ctx: { type: FormContextType; id: string | null; name: string | null }
  ) => {
    if (!canCreateForms) return;
    const template = getTemplate(templateId);
    if (!template) return;
    const instance = buildFormInstanceFromTemplate(template, ctx, {
      currentUserEmployeeId,
      employees,
      projects,
    });
    onCreateInstance(instance);
    setFillInstanceId(instance.id);
    setFillDraftValues(instance.fieldValues);
    setFillDraftAttendees(instance.attendees);
    setView("fill");
    setCreateFromTemplateId(null);
  };

  const handleDuplicateTemplate = (template: FormTemplate) => {
    const copy: FormTemplate = {
      ...JSON.parse(JSON.stringify(template)),
      id: `tpl-${Date.now()}`,
      isBase: false,
      createdBy: currentUserEmployeeId,
      createdAt: new Date().toISOString(),
    };
    onAddTemplate(copy);
  };

  const handleGenerateQR = async (instance: FormInstance, template: FormTemplate) => {
    const token = instance.signToken || crypto.randomUUID();
    const expires = new Date(
      Date.now() + template.expiresInHours * 60 * 60 * 1000
    ).toISOString();
    const updated: FormInstance = {
      ...instance,
      signToken: token,
      tokenExpiresAt: expires,
    };
    onUpdateInstance(updated);
    await new Promise((resolve) => setTimeout(resolve, 150));
    openQrModal(updated, template);
  };

  const openQrModal = (instance: FormInstance, template: FormTemplate) => {
    setCopied(false);
    setEmailInput("");
    setSelectedEmployeeEmail("");
    setEmailMode("employee");
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${base}/sign/${instance.signToken}`;
    setQrModal({
      signToken: instance.signToken,
      link,
      templateName: resolveTemplateName(template, t),
      expiresInHours: template.expiresInHours,
      instance,
    });
    QRCode.toDataURL(link, { width: 200, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  };


  return (
    <section className="mx-auto w-full min-w-0 max-w-full space-y-4 overflow-x-hidden lg:max-w-6xl">
      {/* ---------- LIST VIEW ---------- */}
      {view === "list" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              {t.forms}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setListContextFilter(null);
                }}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
              >
                <option value="">{l("allProjects")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={filterAssigneeId}
                onChange={(e) => setFilterAssigneeId(e.target.value)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
              >
                <option value="">{l("forms_filter_assignee_all")}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              {filterAssigneeId ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                  <MapPinned className="h-3.5 w-3.5 shrink-0" />
                  {l("forms_filtering_by").replace("{name}", assigneeFilterName)}
                </span>
              ) : null}
              {listContextFilter ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-xs font-medium text-blue-800 dark:text-blue-200">
                  <MapPinned className="h-3.5 w-3.5 shrink-0" />
                  {listContextFilter.type === "vehicle"
                    ? `${l("forms_badge_vehicle")} · ${
                        vehicles.find((v) => v.id === listContextFilter.id)?.plate ?? listContextFilter.id
                      }`
                    : `${l("forms_badge_rental")} · ${
                        rentals.find((r) => r.id === listContextFilter.id)?.name ?? listContextFilter.id
                      }`}
                  <button
                    type="button"
                    className="ml-1 min-h-[44px] min-w-[44px] rounded-lg text-blue-600 dark:text-blue-300"
                    onClick={() => setListContextFilter(null)}
                    aria-label={l("common_close")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : null}
              {canViewForms && canCreateForms ? (
                <button
                  type="button"
                  onClick={() => setView("template")}
                  className="flex items-center gap-2 rounded-xl bg-amber-600 dark:bg-amber-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-amber-500 min-h-[44px]"
                >
                  <Plus className="h-4 w-4" />
                  {t.newForm}
                </button>
              ) : null}
              {canViewForms && canManageFormTemplates ? (
                <button
                  type="button"
                  onClick={() => setView("builder")}
                  className="flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px]"
                >
                  <Pencil className="h-4 w-4" />
                  {l("form_builder_title")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex gap-1 border-b border-zinc-200 dark:border-slate-700">
            {(
              [
                ["pending", t.formDraft],
                ["in_progress", t.formInProgress],
                ["completed", t.formCompleted],
                ["all", l("forms_tab_all")],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setListTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg min-h-[44px] ${
                  listTab === tab
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-b-0 border-zinc-200 dark:border-slate-700"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3">
            {listByTab.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400 py-8 text-center text-sm">
                {l("forms_list_empty")}
              </p>
            ) : (
              listByTab.map((inst) => {
                const template = getTemplate(inst.templateId);
                const project = getProject(inst.projectId);
                const ctxType: FormContextType = inst.contextType ?? (inst.projectId ? "project" : "general");
                const contextBadgeText =
                  ctxType === "project"
                    ? l("forms_badge_project")
                    : ctxType === "vehicle"
                      ? l("forms_badge_vehicle")
                      : ctxType === "rental"
                        ? l("forms_badge_rental")
                        : l("forms_badge_general");
                const contextLine =
                  ctxType === "project"
                    ? resolveProjectLabel(inst.projectId, inst)
                    : ctxType === "vehicle"
                      ? (inst.contextName ?? inst.contextId ?? "—")
                      : ctxType === "rental"
                        ? (inst.contextName ?? inst.contextId ?? "—")
                        : (l("forms_badge_general") ?? "—");
                const signed = inst.attendees.filter((a) => a.signedAt).length;
                const total = inst.attendees.length;
                const statusColors: Record<string, string> = {
                  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
                  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                };
                return (
                  <div
                    key={inst.id}
                    className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white">
                        {template ? resolveTemplateName(template, t) : inst.templateId}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {contextLine} · {inst.date}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {offlinePendingInstanceIds.includes(inst.id) ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                            {l("offline_forms_pending")}
                          </span>
                        ) : null}
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${formContextBadgeClass(ctxType)}`}
                        >
                          {contextBadgeText}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[inst.status] ?? ""}`}
                        >
                          {t[`form${inst.status === "draft" ? "Draft" : inst.status === "in_progress" ? "InProgress" : inst.status === "completed" ? "Completed" : "Approved"}`] ?? inst.status}
                        </span>
                        {total > 0 && (
                          <span className="text-xs text-zinc-500">
                            {signed}/{total} {t.signedAt}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailInstanceId(inst.id);
                          setView("detail");
                        }}
                        className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
                      >
                        {l("forms_view")}
                      </button>
                      {(inst.status === "draft" || inst.status === "in_progress") && (
                        <button
                          type="button"
                          onClick={() => {
                            setFillInstanceId(inst.id);
                            setFillDraftValues(inst.fieldValues);
                            setFillDraftAttendees(inst.attendees);
                            setView("fill");
                          }}
                          className={`rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] ${
                            canFillForms
                              ? "bg-amber-600 text-white"
                              : "border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {canFillForms ? l("forms_continue") : l("forms_view")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ---------- TEMPLATE VIEW (library) ---------- */}
      {view === "builder" && canViewForms && canManageFormTemplates && (
        <FormTemplateBuilder
          labels={t}
          currentUserEmployeeId={currentUserEmployeeId}
          onBack={() => setView("list")}
          onSaveTemplate={onAddTemplate}
        />
      )}

      {view === "template" && canViewForms && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setView("list")}
              className="p-2 rounded-lg border border-zinc-200 dark:border-slate-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
              {t.templates}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
              {l("forms_templates_category_label")}
            </label>
            <select
              value={templateCategoryFilter}
              onChange={(e) => setTemplateCategoryFilter(e.target.value)}
              className="w-full sm:max-w-md rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
            >
              {TEMPLATE_LIB_CATEGORY_FILTERS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {l(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {libraryTemplates.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
              {l("forms_templates_empty_category")}
            </p>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {libraryTemplates.map((template) => (
              <FormTemplatePickCard
                key={template.id}
                template={template}
                projects={projects}
                vehicles={vehicles}
                rentals={rentals}
                labels={t}
                canCreateForms={canCreateForms}
                canManageFormTemplates={canManageFormTemplates}
                l={l}
                onPick={(tid, ctx) => handleUseTemplate(tid, ctx)}
                onUpdateTemplate={onUpdateTemplate}
                onDeleteTemplate={onDeleteTemplate}
                onDuplicate={handleDuplicateTemplate}
              />
            ))}
          </div>
        </>
      )}

      {/* ---------- FILL VIEW (step-by-step sections + sticky footer) ---------- */}
      {view === "fill" && fillInstanceId && (() => {
        const instance = instances.find((i) => i.id === fillInstanceId);
        const template = instance ? getTemplate(instance.templateId) : null;
        if (!instance || !template) {
          return (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  setFillInstanceId(null);
                }}
                className="p-2 rounded-lg border border-zinc-200 dark:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-zinc-500 dark:text-zinc-400">{l("forms_not_found")}</p>
            </div>
          );
        }
        const values = fillDraftValues;
        const attendees = fillDraftAttendees;
        const updateVal = (fieldId: string, value: unknown) => {
          const next = { ...values, [fieldId]: value };
          setFillDraftValues(next);
          onUpdateInstance({ ...instance, fieldValues: next });
        };
        const sections = template.sections;
        const safeIdx = Math.min(
          Math.max(0, fillSectionIndex),
          Math.max(0, sections.length - 1)
        );
        const section = sections[safeIdx];
        const progressPct = sections.length
          ? ((safeIdx + 1) / sections.length) * 100
          : 0;

        const renderField = (field: FormField) => {
          if (field.type === "attendance") {
            return (
              <div key={field.id}>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {l("attendees")}
                </p>
                <div className="space-y-0">
                  {attendees.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 gap-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-sm font-bold text-amber-700 dark:text-amber-400">
                          {att.name[0] ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {att.name}
                          </p>
                          {att.signedAt ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              {l("signedAt")} ·{" "}
                              {formatTime(att.signedAt, dateLocale, timeZone)}
                            </p>
                          ) : (
                            <p className="text-xs text-zinc-400">
                              {l("pendingSignature")}
                            </p>
                          )}
                        </div>
                      </div>
                      {!att.signedAt && !fillReadOnly && (
                        <button
                          type="button"
                          onClick={() => openDirectSignModal(att, instance)}
                          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 min-h-[44px]"
                        >
                          <PenLine className="h-3.5 w-3.5" />
                          {l("signHere")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {!fillReadOnly && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setAddVisitorModalOpen(true)}
                    className="text-sm text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 min-h-[44px]"
                  >
                    <Plus className="h-4 w-4" />
                    {l("addVisitor")}
                  </button>
                </div>
                )}
                {!fillReadOnly && (
                <button
                  type="button"
                  onClick={() => handleGenerateQR(instance, template)}
                  className="mt-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
                >
                  {l("generateQR")}
                </button>
                )}
              </div>
            );
          }
          if (field.type === "signature") {
            return (
              <SignatureCanvas
                key={field.id}
                label={resolveFormLabel(field.label, t)}
                clearLabel={l("forms_clear")}
                value={values[field.id] as string | undefined}
                onChange={(v) => updateVal(field.id, v)}
                onClear={() => updateVal(field.id, undefined)}
                disabled={fillReadOnly}
              />
            );
          }
          return (
            <FormFieldInput
              key={field.id}
              field={field}
              value={values[field.id]}
              onChange={(v) => updateVal(field.id, v)}
              readOnly={fillReadOnly}
              optionsEmployees={
                field.type === "select" &&
                (!field.options || field.options.length === 0)
                  ? employees
                  : undefined
              }
              labels={t}
            />
          );
        };

        return (
          <div className="relative pb-28 lg:pb-10">
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  setFillInstanceId(null);
                }}
                className="p-2 rounded-lg border border-zinc-200 dark:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                {resolveTemplateName(template, t)}
              </h2>
            </div>

            <div className="lg:grid lg:grid-cols-[minmax(200px,240px)_1fr] gap-6 items-start">
              <aside className="hidden lg:block sticky top-4 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-1">
                {sections.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFillSectionIndex(i)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 min-h-[44px] transition-colors ${
                      i === safeIdx
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {i + 1}/{sections.length}
                    </span>
                    <span className="block text-sm font-medium">
                      {resolveFormLabel(s.title, t)}
                    </span>
                  </button>
                ))}
              </aside>

              <div className="min-w-0 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                <div className="mb-6">
                  <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-[width] duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                    {l("forms_fill_step")
                      .replace("{current}", String(safeIdx + 1))
                      .replace("{total}", String(sections.length))}
                  </p>
                </div>
                <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
                  {resolveFormLabel(section.title, t)}
                </h3>
                <div className="space-y-4">
                  {section.fields.map((field) => renderField(field))}
                </div>
              </div>
            </div>

            <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[padding:max(0px)]:pb-[max(env(safe-area-inset-bottom),8px)]">
              <div className="mx-auto w-full max-w-6xl flex flex-wrap items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  disabled={safeIdx <= 0}
                  onClick={() => setFillSectionIndex((i) => Math.max(0, i - 1))}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px] disabled:opacity-40"
                >
                  {l("forms_previous")}
                </button>
                <button
                  type="button"
                  disabled={safeIdx >= sections.length - 1}
                  onClick={() =>
                    setFillSectionIndex((i) =>
                      Math.min(sections.length - 1, i + 1)
                    )
                  }
                  className="rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px] disabled:opacity-40"
                >
                  {l("next")}
                </button>
                <div className="flex-1 min-w-[8px]" />
                {canFillForms && (
                  <>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateInstance({
                      ...instance,
                      status: "draft",
                      fieldValues: values,
                      attendees,
                    });
                    setView("list");
                    setFillInstanceId(null);
                  }}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
                >
                  {l("saveDraft")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateInstance({
                      ...instance,
                      status: "in_progress",
                      fieldValues: values,
                      attendees,
                    });
                    setView("list");
                    setFillInstanceId(null);
                  }}
                  className="rounded-xl bg-amber-600 text-white px-4 py-2.5 text-sm font-medium min-h-[44px] hover:bg-amber-500"
                >
                  {l("forms_submit")}
                </button>
                  </>
                )}
              </div>
            </footer>
          </div>
        );
      })()}

      {/* ---------- DETAIL VIEW ---------- */}
      {view === "detail" && detailInstanceId && (() => {
        const instance = instances.find((i) => i.id === detailInstanceId);
        const template = instance ? getTemplate(instance.templateId) : null;
        const dCtx: FormContextType =
          instance?.contextType ?? (instance?.projectId ? "project" : "general");
        const detailContextLine = instance
          ? dCtx === "project"
            ? resolveProjectLabel(instance.projectId, instance)
            : dCtx === "vehicle"
              ? (instance.contextName ?? instance.contextId ?? "—")
              : dCtx === "rental"
                ? (instance.contextName ?? instance.contextId ?? "—")
                : (l("forms_badge_general") ?? "—")
          : "—";
        if (!instance || !template) {
          return (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { setView("list"); setDetailInstanceId(null); }} className="p-2 rounded-lg border">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-zinc-500">{l("no_results")}</p>
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setView("list"); setDetailInstanceId(null); }}
                  className="p-2 rounded-lg border border-zinc-200 dark:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                    {resolveTemplateName(template, t)}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {detailContextLine} · {instance.date}
                  </p>
                  <span
                    className={`mt-1 inline-flex px-2 py-0.5 rounded text-xs font-medium ${formContextBadgeClass(dCtx)}`}
                  >
                    {dCtx === "project"
                      ? l("forms_badge_project")
                      : dCtx === "vehicle"
                        ? l("forms_badge_vehicle")
                        : dCtx === "rental"
                          ? l("forms_badge_rental")
                          : l("forms_badge_general")}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canApproveForms &&
                  instance.status !== "approved" &&
                  (instance.status === "completed" || instance.status === "in_progress") && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateInstance({ ...instance, status: "approved" });
                        setView("list");
                        setDetailInstanceId(null);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-sm font-medium min-h-[44px]"
                    >
                      {l("forms_approve")}
                    </button>
                  )}
                {canExportForms && (
                <button
                  type="button"
                  onClick={async () => {
                    const blob = await generateFormPDF(
                      instance,
                      template,
                      detailContextLine,
                      "Machinpro",
                      undefined,
                      t.signedOnSupervisorDevice
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const safeTpl = resolveTemplateName(template, t).replace(/[^a-zA-Z0-9._-]+/g, "_");
                    a.download = `${safeTpl}-${instance.date}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-zinc-800 dark:bg-zinc-700 text-white px-4 py-2.5 text-sm font-medium min-h-[44px]"
                >
                  <FileText className="h-4 w-4" />
                  {t.exportPDF}
                </button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-6">
              {template.sections.map((section) => (
                <div key={section.id}>
                  <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-3">
                    {resolveFormLabel(section.title, t)}
                  </h3>
                  <div className="space-y-2 text-sm">
                    {section.fields.map((field) => {
                      if (field.type === "signature" || field.type === "attendance")
                        return null;
                      const val = instance.fieldValues[field.id];
                      if (val == null || val === "") return null;
                      if (
                        field.type === "photo" &&
                        typeof val === "string" &&
                        val.startsWith("http")
                      ) {
                        return (
                          <div key={field.id}>
                            <span className="font-medium text-zinc-600 dark:text-zinc-400">
                              {resolveFormLabel(field.label, t)}:
                            </span>{" "}
                            <a
                              href={val}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-600 dark:text-amber-400 underline break-all"
                            >
                              {l("forms_view")}
                            </a>
                          </div>
                        );
                      }
                      const text = formatFormFieldValue(field, val, l);
                      return (
                        <p key={field.id} className="whitespace-pre-wrap">
                          <span className="font-medium text-zinc-600 dark:text-zinc-400">
                            {resolveFormLabel(field.label, t)}:
                          </span>{" "}
                          {text}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ))}
              {instance.attendees.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                    {t.attendees}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {instance.attendees.map((a) => (
                      <li key={a.id}>
                        {a.name}
                        {a.company ? ` (${a.company})` : ""} —{" "}
                        {a.signedAt
                          ? `${t.signedAt} ${a.signedAt}${a.signedOnSupervisorDevice ? ` · ${t.signedOnSupervisorDevice}` : ""}`
                          : t.pendingSignature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* QR Modal */}
      {qrModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setQrModal(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {t.scanQR}
              </h3>
              <button type="button" onClick={() => setQrModal(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            {qrDataUrl && (
              <div className="flex justify-center mb-4">
                <img src={qrDataUrl} alt={l("scanQR")} className="w-48 h-48" />
              </div>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{t.linkExpires}</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={qrModal.link}
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={async () => {
                  const signLink = qrModal.link;
                  try {
                    await navigator.clipboard.writeText(signLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    const input = document.createElement("input");
                    input.value = signLink;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand("copy");
                    document.body.removeChild(input);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] flex items-center gap-1 text-white ${copied ? "bg-emerald-600" : "bg-amber-600"}`}
              >
                <Copy className="h-4 w-4" />
                {copied ? l("forms_qr_copied") : t.copyLink}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEmailMode("employee")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${emailMode === "employee" ? "border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 text-zinc-600 dark:text-zinc-400"}`}
                >
                  {l("forms_email_employee_tab")}
                </button>
                <button
                  type="button"
                  onClick={() => setEmailMode("external")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${emailMode === "external" ? "border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 text-zinc-600 dark:text-zinc-400"}`}
                >
                  {l("forms_email_external_tab")}
                </button>
              </div>
              {emailMode === "employee" ? (
                <select
                  value={selectedEmployeeEmail}
                  onChange={(e) => setSelectedEmployeeEmail(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                >
                  <option value="">{l("forms_email_select_employee")}</option>
                  {employees
                    .filter(
                      (emp) =>
                        (qrModal.instance.attendees ?? []).some(
                          (a) => a.employeeId === emp.id && !a.signedAt
                        )
                    )
                    .map((emp) => (
                      <option key={emp.id} value={emp.email ?? ""}>
                        {emp.name}{" "}
                        {!emp.email ? l("forms_email_no_email_suffix") : ""}
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  type="email"
                  placeholder="Email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                />
              )}
            </div>
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium"
            >
              {l("forms_send_email")}
            </button>
          </div>
        </>
      )}

      {/* Direct sign modal (firma en dispositivo del supervisor) */}
      {directSignAttendee && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 touch-none"
            onClick={() => {
              setDirectSignAttendee(null);
              setDirectSignInstance(null);
              clearDirectSignCanvas();
            }}
            aria-hidden
          />
          <div className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-sm">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-1">
              {l("signHere")}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {directSignAttendee.name}
            </p>
            <canvas
              ref={directSignCanvasRef}
              width={320}
              height={150}
              className="w-full rounded-xl border-2 border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800 touch-none cursor-crosshair"
              onPointerDown={startDirectSign}
              onPointerMove={continueDirectSign}
              onPointerUp={endDirectSign}
              onPointerLeave={endDirectSign}
            />
            <p className="text-xs text-zinc-400 mt-2 mb-4 text-center">
              {l("signWithFinger")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearDirectSignCanvas}
                className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 min-h-[44px]"
              >
                {l("clear")}
              </button>
              <button
                type="button"
                onClick={saveDirectSign}
                className="flex-1 rounded-xl bg-amber-600 text-white py-2.5 text-sm font-medium hover:bg-amber-500 min-h-[44px]"
              >
                {l("confirmSignature")}
              </button>
            </div>
            <p className="text-xs text-zinc-400 mt-3 text-center">
              {l("signedOnSupervisorDevice")}
            </p>
          </div>
        </>
      )}

      {/* Add visitor modal */}
      {addVisitorModalOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 touch-none"
            onClick={() => setAddVisitorModalOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-sm">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">
              {l("addVisitor")}
            </h3>
            <div className="mb-3">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("fullName")} *
              </label>
              <input
                type="text"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                placeholder={l("fullName")}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("subcontractors_field_company")} *
              </label>
              <input
                type="text"
                value={visitorCompany}
                onChange={(e) => setVisitorCompany(e.target.value)}
                placeholder={l("companyRequired")}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {l("orientationGiven")} *
              </label>
              <div className="flex gap-3">
                {(["yes", "na"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setVisitorOrientation(opt)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
                      visitorOrientation === opt
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                        : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {opt === "yes" ? l("checklistYes") : l("checklistNA")}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {l("signature")} *
              </label>
              <canvas
                ref={visitorSignCanvasRef}
                width={320}
                height={120}
                className="w-full rounded-xl border-2 border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800 touch-none cursor-crosshair"
                onPointerDown={startVisitorSign}
                onPointerMove={continueVisitorSign}
                onPointerUp={() => setIsDrawingVisitor(false)}
                onPointerLeave={() => setIsDrawingVisitor(false)}
              />
              <button
                type="button"
                onClick={clearVisitorSignCanvas}
                className="text-xs text-zinc-400 mt-1 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {l("clear")}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddVisitorModalOpen(false)}
                className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 min-h-[44px]"
              >
                {l("cancel")}
              </button>
              <button
                type="button"
                onClick={saveVisitor}
                disabled={!visitorName.trim() || !visitorCompany.trim()}
                className="flex-1 rounded-xl bg-amber-600 text-white py-2.5 text-sm font-medium disabled:opacity-50 min-h-[44px] hover:bg-amber-500"
              >
                {l("add")}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
