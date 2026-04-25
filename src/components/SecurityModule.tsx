"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Camera,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  ScrollText,
  Shield,
  Users,
} from "lucide-react";
import type { UserRole } from "@/types/shared";
import type { CustomRole } from "@/types/roles";
import type { AuditLogEntry } from "@/lib/useAuditLog";
import { getAuditActionLabel, getAuditEntityTypeLabel } from "@/lib/auditDisplay";
import type { Binder, BinderDocument } from "@/types/binders";
import {
  CorrectiveActionsModule,
  type CorrectiveActionsPrefill,
} from "@/components/CorrectiveActionsModule";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import type { TrainingEmployeeOption } from "@/components/TrainingHubModule";
import type { EmployeeDocument, ComplianceRecord } from "@/types/homePage";
import { useToast } from "@/components/Toast";
import { csvCell, downloadCsvUtf8, fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";
import { ALL_TRANSLATIONS } from "@/lib/i18n";
import { formatDateTime } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";
import { SecurityOverviewPanel } from "@/components/SecurityOverviewPanel";
import { buildSafetyReportPdf, slugSafetyPdfName } from "@/lib/safetyExportPdf";
import { supabase } from "@/lib/supabase";
import type { Hazard } from "@/types/hazard";
import type { CorrectiveAction } from "@/types/correctiveAction";
import { userFacingErrorMessage } from "@/lib/userFacingError";

const securityTabFallback = () => (
  <div className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
);

const HazardModule = dynamic(
  () => import("@/components/HazardModule").then((m) => ({ default: m.HazardModule })),
  { ssr: false, loading: securityTabFallback }
);

const BindersModule = dynamic(
  () => import("@/components/BindersModule").then((m) => ({ default: m.BindersModule })),
  { ssr: false, loading: securityTabFallback }
);

const TrainingHubModule = dynamic(
  () => import("@/components/TrainingHubModule").then((m) => ({ default: m.TrainingHubModule })),
  { ssr: false, loading: securityTabFallback }
);

const SafetyPassportModule = dynamic(
  () => import("@/components/SafetyPassportModule").then((m) => ({ default: m.SafetyPassportModule })),
  { ssr: false, loading: securityTabFallback }
);

const SwpModule = dynamic(
  () => import("@/components/SwpModule").then((m) => ({ default: m.SwpModule })),
  { ssr: false, loading: securityTabFallback }
);

export type SecurityTabId =
  | "overview"
  | "hazards"
  | "actions"
  | "documents"
  | "swp"
  | "audit"
  | "training"
  | "passport";

export interface SecurityModuleProps {
  t: Record<string, string>;
  companyId: string | null;
  companyName: string;
  userRole: UserRole;
  userName: string;
  userProfileId: string | null;
  projects: { id: string; name: string }[];
  employees: TrainingEmployeeOption[];
  focusHazardId: string | null;
  onFocusHazardConsumed: () => void;
  correctivePrefill: CorrectiveActionsPrefill | null;
  onConsumeCorrectivePrefill: () => void;
  openHazardSignal: number;
  openActionSignal: number;
  binders: Binder[];
  binderDocuments: BinderDocument[];
  canManageBinders: boolean;
  roleOptions: { id: string; name: string }[];
  onAddBinder: (b: Binder) => void;
  onDeleteBinder: (id: string) => void;
  onAddDocument: (d: BinderDocument) => void;
  onDeleteDocument: (id: string) => void;
  auditLogs: AuditLogEntry[];
  canManageRoles: boolean;
  canViewHazards: boolean;
  canManageHazards: boolean;
  canViewCorrectiveActions: boolean;
  canManageCorrectiveActions: boolean;
  canViewSecurityDocs: boolean;
  canManageSecurityDocs: boolean;
  canViewSecurityAudit: boolean;
  canManageDailyReports: boolean;
  canViewTrainingHub: boolean;
  canManageTrainingHub: boolean;
  canViewSafetyPassport: boolean;
  canManageSafetyPassport: boolean;
  /** Safe Work Procedures — visible to all roles that can open Security; manage = admins / hazard managers */
  canViewSwp?: boolean;
  canManageSwp?: boolean;
  employeeDocs: EmployeeDocument[];
  complianceRecords: ComplianceRecord[];
  cloudinaryCloudName: string;
  cloudinaryUploadPreset: string;
  customRoles: CustomRole[];
  /** When set, switch to this tab once (e.g. deep link). */
  initialTab?: SecurityTabId | null;
  onInitialTabConsumed?: () => void;
  /** Parent sets corrective prefill; we switch to Actions tab. */
  onOpenCorrectiveFromHazard: (p: {
    hazardId: string;
    projectId: string | null;
    projectName: string | null;
  }) => void;
  /** Parent sets focus hazard id; we switch to Hazards tab. */
  onRequestFocusHazard: (hazardId: string) => void;
  /** User changed tab — clear dashboard “open form” signals so remounting Hazards/Actions does not reopen modals. */
  onSecurityTabInteraction?: () => void;
  dateLocale: string;
  timeZone: string;
}

const TAB_CONFIG: { id: SecurityTabId; icon: typeof AlertTriangle; labelKey: string }[] = [
  { id: "overview", icon: LayoutDashboard, labelKey: "security_tab_overview" },
  { id: "hazards", icon: AlertTriangle, labelKey: "security_tab_hazards" },
  { id: "actions", icon: ClipboardCheck, labelKey: "security_tab_actions" },
  { id: "documents", icon: FolderOpen, labelKey: "security_tab_documents" },
  { id: "swp", icon: ClipboardList, labelKey: "swp_title" },
  { id: "audit", icon: ScrollText, labelKey: "security_tab_audit" },
  { id: "training", icon: GraduationCap, labelKey: "training_hub_title" },
  { id: "passport", icon: Shield, labelKey: "safety_passport_title" },
];

export function SecurityModule({
  t,
  companyId,
  companyName,
  userRole,
  userName,
  userProfileId,
  projects,
  employees,
  focusHazardId,
  onFocusHazardConsumed,
  correctivePrefill,
  onConsumeCorrectivePrefill,
  openHazardSignal,
  openActionSignal,
  binders,
  binderDocuments,
  canManageBinders,
  roleOptions,
  onAddBinder,
  onDeleteBinder,
  onAddDocument,
  onDeleteDocument,
  auditLogs,
  canManageRoles,
  canViewHazards,
  canManageHazards,
  canViewCorrectiveActions,
  canManageCorrectiveActions,
  canViewSecurityDocs,
  canManageSecurityDocs,
  canViewSecurityAudit,
  canManageDailyReports,
  canViewTrainingHub,
  canManageTrainingHub,
  canViewSafetyPassport,
  canManageSafetyPassport,
  canViewSwp = true,
  canManageSwp = false,
  employeeDocs,
  complianceRecords,
  cloudinaryCloudName,
  cloudinaryUploadPreset,
  customRoles,
  initialTab = null,
  onInitialTabConsumed,
  onOpenCorrectiveFromHazard,
  onRequestFocusHazard,
  onSecurityTabInteraction,
  dateLocale,
  timeZone,
}: SecurityModuleProps) {
  const { showToast } = useToast();
  void useMachinProDisplayPrefs();
  void canManageSafetyPassport;
  const showHazardsTab = canViewHazards || canManageHazards;
  const showActionsTab = canViewCorrectiveActions || canManageCorrectiveActions;
  const showDocumentsTab = canViewSecurityDocs || canManageSecurityDocs;
  const showAuditTab = canViewSecurityAudit;
  const showSwpTab = canViewSwp;

  const [safetyPdfBusy, setSafetyPdfBusy] = useState(false);

  const [tab, setTab] = useState<SecurityTabId>("overview");

  const allowed = useCallback(
    (id: SecurityTabId) =>
      (id === "overview") ||
      (id === "hazards" && showHazardsTab) ||
      (id === "actions" && showActionsTab) ||
      (id === "documents" && showDocumentsTab) ||
      (id === "swp" && showSwpTab) ||
      (id === "audit" && showAuditTab) ||
      (id === "training" && canViewTrainingHub) ||
      (id === "passport" && canViewSafetyPassport),
    [
      showHazardsTab,
      showActionsTab,
      showDocumentsTab,
      showSwpTab,
      showAuditTab,
      canViewTrainingHub,
      canViewSafetyPassport,
    ]
  );

  const firstAllowed = useMemo((): SecurityTabId => {
    const order: SecurityTabId[] = [
      "overview",
      "hazards",
      "actions",
      "documents",
      "swp",
      "audit",
      "training",
      "passport",
    ];
    for (const id of order) {
      if (allowed(id)) return id;
    }
    return "overview";
  }, [allowed]);

  const selectSecurityTab = useCallback(
    (id: SecurityTabId) => {
      onSecurityTabInteraction?.();
      setTab(id);
    },
    [onSecurityTabInteraction]
  );

  useEffect(() => {
    if (!allowed(tab)) setTab(firstAllowed as SecurityTabId);
  }, [allowed, tab, firstAllowed]);

  useEffect(() => {
    if (initialTab && allowed(initialTab)) {
      setTab(initialTab);
      onInitialTabConsumed?.();
    }
  }, [initialTab, allowed, onInitialTabConsumed]);

  const L = (k: string, fb: string) =>
    (t[k] as string | undefined) ||
    (ALL_TRANSLATIONS.en as Record<string, string>)[k] ||
    fb;
  const exportAuditCsv = useCallback(() => {
    const whenH = L("auditWhen", L("date", "Date"));
    const userH = L("auditUserColumn", L("sessionRole", "User"));
    const actionH = L("auditActionColumn", L("actions", "Action"));
    const entityH = L("auditEntityColumn", L("entity", "Entity"));
    const detailsH = L("auditDetailsColumn", "Details");
    try {
      const lines = [
        [whenH, userH, actionH, entityH, detailsH].map((h) => csvCell(h)).join(","),
      ];
      for (const row of auditLogs) {
        const when = formatDateTime(row.created_at, dateLocale, timeZone);
        const user = row.user_name ?? row.user_id ?? "—";
        const action = getAuditActionLabel(row.action, row.entity_type, t);
        const entity = [row.entity_name ?? row.entity_id, getAuditEntityTypeLabel(row.entity_type, t)]
          .filter(Boolean)
          .join(" · ");
        let details = "";
        try {
          const payload: Record<string, unknown> = {};
          if (row.old_value != null) payload.old = row.old_value;
          if (row.new_value != null) payload.new = row.new_value;
          if (Object.keys(payload).length) details = JSON.stringify(payload);
        } catch {
          details = "";
        }
        lines.push(
          [csvCell(when), csvCell(user), csvCell(action), csvCell(entity), csvCell(details)].join(",")
        );
      }
      const slug = fileSlugCompany(companyName, companyId ?? "co");
      downloadCsvUtf8(`audit_log_${slug}_${filenameDateYmd()}.csv`, lines);
      showToast("success", L("export_success", "Export completed"));
    } catch {
      showToast("error", L("export_error", "Export error"));
    }
  }, [auditLogs, companyId, companyName, dateLocale, timeZone, t, showToast]);

  const exportSafetyPdf = useCallback(async () => {
    const labels = t as Record<string, string>;
    const TL = (k: string, fb: string) =>
      (t[k] as string | undefined) ||
      (ALL_TRANSLATIONS.en as Record<string, string>)[k] ||
      fb;
    if (!supabase || !companyId) {
      showToast("error", TL("export_error", "Export error"));
      return;
    }
    setSafetyPdfBusy(true);
    try {
      const genIso = new Date().toISOString();
      const todayStr = genIso.slice(0, 10);
      const soonStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      const [hzRes, caRes, swpRes, sigRes, docRes] = await Promise.all([
        supabase.from("hazards").select("*").eq("company_id", companyId),
        supabase.from("corrective_actions").select("*").eq("company_id", companyId),
        supabase.from("safe_work_procedures").select("id, title").eq("company_id", companyId).is("deleted_at", null),
        supabase.from("swp_signatures").select("swp_id, user_id").eq("company_id", companyId),
        supabase
          .from("employee_documents")
          .select("id, name, expiry_date, user_id, deleted_at")
          .eq("company_id", companyId)
          .not("expiry_date", "is", null),
      ]);

      if (hzRes.error) throw hzRes.error;
      if (caRes.error) throw caRes.error;
      if (swpRes.error) throw swpRes.error;
      if (sigRes.error) throw sigRes.error;
      if (docRes.error) throw docRes.error;

      const hzList = (hzRes.data ?? []) as Hazard[];
      const caList = (caRes.data ?? []) as CorrectiveAction[];
      const swps = (swpRes.data ?? []) as { id: string; title: string }[];
      const sigs = (sigRes.data ?? []) as { swp_id: string; user_id: string }[];

      const activeCount = hzList.filter((h) => h.status === "open" || h.status === "in_progress").length;
      const resolvedCount = hzList.filter((h) => h.status === "resolved" || h.status === "closed").length;

      const hazardsPdf = hzList.map((h) => ({
        description: [h.title, h.description ?? ""].filter(Boolean).join(" — ").slice(0, 200),
        severity: h.severity,
        status: h.status,
        date: h.created_at?.slice(0, 10) ?? "—",
        owner: h.assigned_to_name ?? h.reported_by_name ?? "—",
      }));

      const correctivePdf = caList.map((c) => ({
        description: c.title,
        status: c.status,
        due: c.due_date?.slice(0, 10) ?? "—",
      }));

      const empById = new Map(employees.map((e) => [e.id, e.name] as const));
      const swpLines: string[] = [];
      for (const w of swps) {
        const signedUids = new Set(sigs.filter((s) => s.swp_id === w.id).map((s) => s.user_id));
        const signedNames = [...signedUids].map((id) => empById.get(id) ?? `${id.slice(0, 8)}…`);
        const pendingNames = employees.filter((e) => !signedUids.has(e.id)).map((e) => e.name);
        swpLines.push(
          `${w.title}: ${TL("pdf_swp_signed_by", "Signed")}: ${signedNames.join(", ") || "—"} · ${TL(
            "pdf_swp_pending_list",
            "Pending"
          )}: ${pendingNames.join(", ") || "—"}`
        );
      }

      const rawDocs = (docRes.data ?? []) as {
        expiry_date: string;
        name: string;
        user_id: string;
        deleted_at?: string | null;
      }[];
      const certLines = rawDocs
        .filter((d) => !d.deleted_at && d.expiry_date >= todayStr && d.expiry_date <= soonStr)
        .map((d) => {
          const nm = empById.get(d.user_id) ?? `${d.user_id.slice(0, 8)}…`;
          return `${nm} — ${d.name} (${d.expiry_date})`;
        });

      const doc = buildSafetyReportPdf({
        labels,
        companyName,
        totals: {
          hazards: hzList.length,
          active: activeCount,
          resolved: resolvedCount,
        },
        hazards: hazardsPdf,
        corrective: correctivePdf,
        swpLines,
        certLines,
        generationIso: genIso,
      });

      doc.save(slugSafetyPdfName(companyName, genIso));
      showToast("success", TL("export_success", "Export completed"));
    } catch (err) {
      showToast("error", userFacingErrorMessage(labels, err));
    } finally {
      setSafetyPdfBusy(false);
    }
  }, [companyId, companyName, employees, showToast, t]);

  const visibleTabs = TAB_CONFIG.filter((x) => allowed(x.id));

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden md:space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{L("nav_security", "Security")}</h2>

      <HorizontalScrollFade className="border-b border-zinc-200 dark:border-slate-700 pb-2" variant="inherit">
        <div
          className="flex w-full min-w-0 max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0"
          role="tablist"
          aria-label={L("nav_security", "Security")}
        >
          {visibleTabs.map(({ id, icon: Icon, labelKey }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectSecurityTab(id)}
                className={`inline-flex shrink-0 snap-start items-center gap-2 min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-950 ring-2 ring-amber-400/70 dark:text-amber-100 dark:ring-amber-500/50"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {L(labelKey, id)}
              </button>
            );
          })}
        </div>
      </HorizontalScrollFade>

      <div role="tabpanel" className="min-w-0 overflow-x-hidden">
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {L("security_overview_intro", "Company-wide safety metrics and recent activity.")}
              </p>
              <button
                type="button"
                onClick={() => void exportSafetyPdf()}
                disabled={safetyPdfBusy || !companyId}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 self-start rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 sm:self-auto"
              >
                {safetyPdfBusy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {L("safety_report_pdf_btn", "Safety report")}
              </button>
            </div>
            <SecurityOverviewPanel
              companyId={companyId}
              labels={t as Record<string, string>}
              dateLocale={dateLocale}
              timeZone={timeZone}
            />
          </div>
        )}

        {tab === "hazards" && showHazardsTab && (
          <HazardModule
            t={t}
            companyId={companyId}
            companyName={companyName}
            userRole={userRole}
            userName={userName}
            userProfileId={userProfileId}
            projects={projects}
            employees={employees}
            focusHazardId={focusHazardId}
            onFocusHazardConsumed={onFocusHazardConsumed}
            onOpenCorrectiveFromHazard={(p) => {
              onOpenCorrectiveFromHazard(p);
              if (showActionsTab) setTab("actions");
            }}
            openCreateSignal={openHazardSignal}
            dateLocale={dateLocale}
            timeZone={timeZone}
            manageHazards={canManageHazards}
          />
        )}

        {tab === "actions" && showActionsTab && (
          <CorrectiveActionsModule
            t={t}
            companyId={companyId}
            companyName={companyName}
            userRole={userRole}
            userName={userName}
            userProfileId={userProfileId}
            projects={projects}
            employees={employees}
            prefill={correctivePrefill}
            onConsumePrefill={onConsumeCorrectivePrefill}
            onNavigateToHazard={(id) => {
              onRequestFocusHazard(id);
              if (showHazardsTab) setTab("hazards");
            }}
            openCreateSignal={openActionSignal}
            dateLocale={dateLocale}
            timeZone={timeZone}
            manageCorrectiveActions={canManageCorrectiveActions}
          />
        )}

        {tab === "swp" && showSwpTab && companyId && (
          <SwpModule
            t={t}
            companyId={companyId}
            userProfileId={userProfileId}
            canManage={canManageSwp}
            employees={employees}
          />
        )}

        {tab === "documents" && showDocumentsTab && (
          <BindersModule
            binders={binders}
            documents={binderDocuments}
            canManage={canManageSecurityDocs}
            currentUserRole={userRole}
            employees={employees}
            roleOptions={roleOptions}
            labels={t}
            onAddBinder={onAddBinder}
            onDeleteBinder={onDeleteBinder}
            onAddDocument={onAddDocument}
            onDeleteDocument={onDeleteDocument}
          />
        )}

        {tab === "audit" && showAuditTab && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-white/10 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">{t.auditLog ?? ""}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t.auditLogDesc ?? ""}</p>
              </div>
              {auditLogs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => exportAuditCsv()}
                  className="inline-flex shrink-0 items-center gap-2 min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                  {L("export_audit", L("export_csv", "CSV"))}
                </button>
              ) : null}
            </div>
            <div>
              {auditLogs.length === 0 ? (
                <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400 italic">{t.auditNoLogs ?? ""}</p>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50">
                          <th className="w-12 py-3 px-2" aria-hidden />
                          <th className="text-left py-3 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            {t.auditWhen ?? t.date ?? ""}
                          </th>
                          <th className="text-left py-3 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            {t.auditActionColumn ?? t.actions ?? ""}
                          </th>
                          <th className="text-left py-3 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            {t.auditUserColumn ?? t.sessionRole ?? ""}
                          </th>
                          <th className="text-left py-3 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            {t.auditEntityColumn ?? t.entity ?? ""}
                          </th>
                          <th className="text-left py-3 px-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            {t.auditTypeColumn ?? t.category ?? ""}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((row) => {
                          const when = formatDateTime(row.created_at, dateLocale, timeZone);
                          const actionIcon = row.action.startsWith("photo_") ? (
                            <Camera className="h-4 w-4 text-amber-600" aria-hidden />
                          ) : row.action.startsWith("employee_") ? (
                            <Users className="h-4 w-4 text-blue-600" aria-hidden />
                          ) : row.action.startsWith("document_") ? (
                            <FileText className="h-4 w-4 text-zinc-600" aria-hidden />
                          ) : (
                            <Shield className="h-4 w-4 text-zinc-500" aria-hidden />
                          );
                          return (
                            <tr
                              key={row.id}
                              className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30"
                            >
                              <td className="py-3 px-2">{actionIcon}</td>
                              <td className="py-3 px-3 text-sm text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{when}</td>
                              <td className="py-3 px-3 text-sm text-zinc-800 dark:text-zinc-100">
                                {getAuditActionLabel(row.action, row.entity_type, t)}
                              </td>
                              <td className="py-3 px-3 text-sm text-zinc-600 dark:text-zinc-300">
                                {row.user_name ?? row.user_id ?? "—"}
                              </td>
                              <td
                                className="py-3 px-3 text-sm text-zinc-700 dark:text-zinc-200 max-w-[200px] truncate"
                                title={row.entity_name ?? row.entity_id}
                              >
                                {row.entity_name ?? row.entity_id}
                              </td>
                              <td className="py-3 px-3">
                                <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                  {getAuditEntityTypeLabel(row.entity_type, t)}
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
                      const when = formatDateTime(row.created_at, dateLocale, timeZone);
                      const actionIcon = row.action.startsWith("photo_") ? (
                        <Camera className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                      ) : row.action.startsWith("employee_") ? (
                        <Users className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                      ) : row.action.startsWith("document_") ? (
                        <FileText className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                      ) : (
                        <Shield className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                      );
                      return (
                        <li key={row.id} className="p-4 flex gap-3">
                          <div className="pt-0.5">{actionIcon}</div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                              {getAuditActionLabel(row.action, row.entity_type, t)}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {(row.user_name ?? row.user_id ?? "—") + " · " + when}
                            </p>
                            {(row.entity_name ?? row.entity_id) ? (
                              <p
                                className="text-xs text-zinc-600 dark:text-zinc-300 truncate"
                                title={row.entity_name ?? row.entity_id}
                              >
                                {row.entity_name ?? row.entity_id}
                              </p>
                            ) : null}
                            <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              {getAuditEntityTypeLabel(row.entity_type, t)}
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

        {tab === "training" && canViewTrainingHub && (
          <TrainingHubModule
            t={t}
            companyId={companyId}
            userProfileId={userProfileId}
            userName={userName}
            canManageTraining={canManageTrainingHub}
            employees={employees}
            customRoles={customRoles}
            dateLocale={dateLocale}
            cloudinaryCloudName={cloudinaryCloudName}
            cloudinaryUploadPreset={cloudinaryUploadPreset}
          />
        )}

        {tab === "passport" && canViewSafetyPassport && (
          <SafetyPassportModule
            t={t}
            companyId={companyId}
            companyName={companyName}
            employees={employees}
            employeeDocs={employeeDocs}
            complianceRecords={complianceRecords}
            dateLocale={dateLocale}
          />
        )}
      </div>
    </div>
  );
}
