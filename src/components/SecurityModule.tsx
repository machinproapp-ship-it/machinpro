"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, ClipboardCheck, FolderOpen, ScrollText, Download } from "lucide-react";
import type { UserRole } from "@/types/shared";
import type { AuditLogEntry } from "@/lib/useAuditLog";
import { getAuditActionLabel, getAuditEntityTypeLabel } from "@/lib/auditDisplay";
import { Camera, Users, FileText, Shield } from "lucide-react";
import type { Binder, BinderDocument } from "@/types/binders";
import { HazardModule } from "@/components/HazardModule";
import {
  CorrectiveActionsModule,
  type CorrectiveActionsPrefill,
} from "@/components/CorrectiveActionsModule";
import { BindersModule } from "@/components/BindersModule";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import { useToast } from "@/components/Toast";
import { csvCell, downloadCsvUtf8, fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";
import { ALL_TRANSLATIONS } from "@/lib/i18n";
import { formatDateTime } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";

export type SecurityTabId = "hazards" | "actions" | "documents" | "audit";

export interface SecurityModuleProps {
  t: Record<string, string>;
  companyId: string | null;
  companyName: string;
  userRole: UserRole;
  userName: string;
  userProfileId: string | null;
  projects: { id: string; name: string }[];
  employees: { id: string; name: string }[];
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
  canShowHazards: boolean;
  canShowActions: boolean;
  canShowDocuments: boolean;
  canShowAudit: boolean;
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
  { id: "hazards", icon: AlertTriangle, labelKey: "security_tab_hazards" },
  { id: "actions", icon: ClipboardCheck, labelKey: "security_tab_actions" },
  { id: "documents", icon: FolderOpen, labelKey: "security_tab_documents" },
  { id: "audit", icon: ScrollText, labelKey: "security_tab_audit" },
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
  canShowHazards,
  canShowActions,
  canShowDocuments,
  canShowAudit,
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
  const firstAllowed =
    (canShowHazards ? "hazards" : null) ||
    (canShowActions ? "actions" : null) ||
    (canShowDocuments ? "documents" : null) ||
    (canShowAudit ? "audit" : null) ||
    "hazards";

  const [tab, setTab] = useState<SecurityTabId>(firstAllowed as SecurityTabId);

  const allowed = useCallback(
    (id: SecurityTabId) =>
      (id === "hazards" && canShowHazards) ||
      (id === "actions" && canShowActions) ||
      (id === "documents" && canShowDocuments) ||
      (id === "audit" && canShowAudit),
    [canShowHazards, canShowActions, canShowDocuments, canShowAudit]
  );

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

  const visibleTabs = TAB_CONFIG.filter((x) => allowed(x.id));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{L("nav_security", "Security")}</h2>

      <HorizontalScrollFade className="border-b border-zinc-200 dark:border-slate-700 pb-2" variant="inherit">
        <div
          className="flex flex-nowrap md:flex-wrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0"
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
                className={`inline-flex shrink-0 items-center gap-2 min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100"
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

      <div role="tabpanel">
        {tab === "hazards" && canShowHazards && (
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
              if (canShowActions) setTab("actions");
            }}
            openCreateSignal={openHazardSignal}
            dateLocale={dateLocale}
            timeZone={timeZone}
          />
        )}

        {tab === "actions" && canShowActions && (
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
              if (canShowHazards) setTab("hazards");
            }}
            openCreateSignal={openActionSignal}
            dateLocale={dateLocale}
            timeZone={timeZone}
          />
        )}

        {tab === "documents" && canShowDocuments && (
          <BindersModule
            binders={binders}
            documents={binderDocuments}
            canManage={canManageBinders}
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

        {tab === "audit" && canShowAudit && (
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
                      <thead>
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
      </div>
    </div>
  );
}
