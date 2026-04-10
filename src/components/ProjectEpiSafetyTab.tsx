"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Circle, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  defaultProjectSafetyRequirements,
  parseSafetyRequirementsJson,
  labelProjectSafetyRow,
  employeeProjectCertTrafficLight,
  findCertForRequirement,
  type ProjectSafetyRequirementRow,
  type ProjectSafetyCategory,
} from "@/lib/projectSafetyUtils";
import { labelVisitorRequirements, defaultVisitorRequirements } from "@/lib/visitorDocumentUtils";
import type { Project, ProjectEmployee } from "@/components/ProjectsModule";
import {
  formatTodayYmdInTimeZone,
  zonedYmdHmToUtcIso,
  formatDateTime,
  dateLocaleForUser,
} from "@/lib/dateUtils";
import { ALL_TRANSLATIONS } from "@/lib/i18n";

const PM_EN = ALL_TRANSLATIONS.en as Record<string, string>;

function newRequirementRow(): ProjectSafetyRequirementRow {
  return {
    id: `sr-custom-${Date.now().toString(36)}`,
    nameKey: "safety_req_prl_training",
    category: "ppe",
  };
}

function trafficDot(light: "green" | "yellow" | "red") {
  if (light === "green")
    return <Circle className="h-3 w-3 fill-emerald-500 text-emerald-600 shrink-0" aria-hidden />;
  if (light === "yellow")
    return <Circle className="h-3 w-3 fill-amber-400 text-amber-500 shrink-0" aria-hidden />;
  return <Circle className="h-3 w-3 fill-red-500 text-red-600 shrink-0" aria-hidden />;
}

export function ProjectEpiSafetyTab({
  project,
  allEmployees,
  countryCode,
  companyId,
  timeZone,
  language,
  labels,
  canEdit,
  onSaveRequirements,
}: {
  project: Project;
  allEmployees: ProjectEmployee[];
  countryCode: string;
  companyId: string;
  timeZone: string;
  language: string;
  labels: Record<string, string>;
  canEdit: boolean;
  onSaveRequirements: (projectId: string, rows: ProjectSafetyRequirementRow[]) => void | Promise<void>;
}) {
  const tl = labels as Record<string, string>;
  const L = (k: string) => tl[k] ?? PM_EN[k] ?? k;
  const dateLoc = useMemo(() => dateLocaleForUser(language, countryCode), [language, countryCode]);

  const baselineRows = useMemo((): ProjectSafetyRequirementRow[] => {
    const parsed = parseSafetyRequirementsJson(project.safetyRequirements);
    if (parsed.length > 0) return parsed;
    return defaultProjectSafetyRequirements(countryCode, project.type);
  }, [project.safetyRequirements, project.type, countryCode]);

  const [draftRows, setDraftRows] = useState<ProjectSafetyRequirementRow[]>(baselineRows);
  useEffect(() => {
    setDraftRows(baselineRows);
  }, [baselineRows]);

  const labeledReqs = useMemo(
    () => draftRows.map((r) => labelProjectSafetyRow(r, tl)),
    [draftRows, tl]
  );

  const persist = useCallback(() => {
    void onSaveRequirements(project.id, draftRows);
  }, [onSaveRequirements, project.id, draftRows]);

  const assigned = useMemo(() => {
    const ids = project.assignedEmployeeIds ?? [];
    return allEmployees.filter((e) => ids.includes(e.id));
  }, [allEmployees, project.assignedEmployeeIds]);

  const [visitorRows, setVisitorRows] = useState<
    {
      id: string;
      visitor_name: string;
      check_in: string;
      requirements_met: Record<string, boolean> | null;
    }[]
  >([]);

  useEffect(() => {
    if (!supabase || !companyId) {
      setVisitorRows([]);
      return;
    }
    let cancelled = false;
    const ymd = formatTodayYmdInTimeZone(timeZone);
    const start = zonedYmdHmToUtcIso(ymd, "00:00", timeZone);
    const end = zonedYmdHmToUtcIso(ymd, "23:59", timeZone);
    void (async () => {
      const { data, error } = await supabase
        .from("visitor_logs")
        .select("id, visitor_name, check_in, requirements_met")
        .eq("company_id", companyId)
        .eq("project_id", project.id)
        .gte("check_in", start)
        .lte("check_in", end)
        .order("check_in", { ascending: false });
      if (cancelled) return;
      if (error) {
        setVisitorRows([]);
        return;
      }
      setVisitorRows(
        (data ?? []).map((r: Record<string, unknown>) => ({
          id: String(r.id),
          visitor_name: String(r.visitor_name ?? ""),
          check_in: String(r.check_in ?? ""),
          requirements_met:
            r.requirements_met && typeof r.requirements_met === "object" && !Array.isArray(r.requirements_met)
              ? (r.requirements_met as Record<string, boolean>)
              : null,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, project.id, timeZone]);

  const visitorReqTemplate = useMemo(
    () => labelVisitorRequirements(defaultVisitorRequirements(countryCode), tl),
    [countryCode, tl]
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
          {L("project_safety_requirements")}
        </h3>
        <ul className="space-y-2">
          {labeledReqs.map((row, idx) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-100 dark:border-slate-700 bg-zinc-50/80 dark:bg-slate-800/40 p-3"
            >
              <span className="text-xs font-mono text-zinc-400 shrink-0">{idx + 1}</span>
              {canEdit ? (
                <>
                  <select
                    value={row.category}
                    onChange={(e) => {
                      const cat = e.target.value as ProjectSafetyCategory;
                      setDraftRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, category: cat } : r))
                      );
                    }}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 text-sm min-h-[44px] px-2"
                  >
                    <option value="ppe">ppe</option>
                    <option value="certification">certification</option>
                    <option value="procedure">procedure</option>
                  </select>
                  <select
                    value={row.nameKey}
                    onChange={(e) => {
                      const nk = e.target.value;
                      setDraftRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, nameKey: nk } : r))
                      );
                    }}
                    className="flex-1 min-w-[160px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 text-sm min-h-[44px] px-2"
                  >
                    {[
                      "safety_req_hard_hat",
                      "safety_req_safety_vest",
                      "safety_req_steel_toe_boots",
                      "safety_req_safety_glasses",
                      "safety_req_fall_protection",
                      "safety_req_prl_training",
                      "safety_req_harness",
                      "safety_req_hi_vis",
                      "safety_req_rams",
                      "safety_req_ppe_assessment",
                      "safety_req_work_permit",
                    ].map((k) => (
                      <option key={k} value={k}>
                        {L(k)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder={L("project_safety_add_requirement")}
                    value={row.customLabel ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setDraftRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, ...(v ? { customLabel: v } : { customLabel: undefined }) } : r
                        )
                      );
                    }}
                    className="flex-1 min-w-[120px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 text-sm min-h-[44px] px-3"
                  />
                  <button
                    type="button"
                    onClick={() => setDraftRows((prev) => prev.filter((r) => r.id !== row.id))}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    aria-label={L("common_close")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <span className="text-sm text-zinc-800 dark:text-zinc-100">
                  [{row.category}] {row.name}
                </span>
              )}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraftRows((prev) => [...prev, newRequirementRow()])}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium min-h-[44px] text-zinc-700 dark:text-zinc-200"
            >
              <Plus className="h-4 w-4" />
              {L("project_safety_add_requirement")}
            </button>
            <button
              type="button"
              onClick={() => setDraftRows(defaultProjectSafetyRequirements(countryCode, project.type))}
              className="rounded-xl border border-amber-300 dark:border-amber-700 px-4 py-2 text-sm font-medium min-h-[44px] text-amber-800 dark:text-amber-200"
            >
              {L("project_safety_apply_defaults")}
            </button>
            <button
              type="button"
              onClick={() => void persist()}
              className="rounded-xl bg-amber-600 text-white px-4 py-2 text-sm font-medium min-h-[44px] hover:bg-amber-500"
            >
              {L("dashboard_customize_save") ?? "Save"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {L("project_safety_employee_status")}
        </h3>
        {assigned.length === 0 ? (
          <p className="text-sm text-zinc-500">{L("noAssignedPersonnel") ?? PM_EN.noAssignedPersonnel}</p>
        ) : (
          <ul className="space-y-2">
            {assigned.map((emp) => {
              const light = employeeProjectCertTrafficLight(
                (emp.certificates ?? []).map((c) => ({ name: c.name, expiryDate: c.expiryDate })),
                draftRows
              );
              const certOnly = draftRows.filter((r) => r.category === "certification");
              const missing = certOnly.filter(
                (req) =>
                  !findCertForRequirement(
                    (emp.certificates ?? []).map((c) => ({ name: c.name, expiryDate: c.expiryDate })),
                    req
                  )
              );
              const expiringSoon = certOnly.some((req) => {
                const c = findCertForRequirement(
                  (emp.certificates ?? []).map((x) => ({ name: x.name, expiryDate: x.expiryDate })),
                  req
                );
                if (!c?.expiryDate) return false;
                const exp = new Date(c.expiryDate.includes("T") ? c.expiryDate : `${c.expiryDate}T12:00:00`);
                if (Number.isNaN(exp.getTime())) return false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                exp.setHours(0, 0, 0, 0);
                const daysLeft = Math.floor((exp.getTime() - today.getTime()) / 86400000);
                return daysLeft >= 0 && daysLeft <= 30;
              });
              return (
                <li
                  key={emp.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 dark:border-slate-700 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {trafficDot(light)}
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {emp.name}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5 text-right max-w-[min(100%,280px)]">
                    {missing.length > 0 ? (
                      <p className="flex items-center justify-end gap-1 text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {L("project_safety_missing_cert")}
                      </p>
                    ) : null}
                    {expiringSoon && missing.length === 0 ? <p>{L("project_safety_expiring_cert")}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {L("visitor_requirements_title")}
        </h3>
        {visitorRows.length === 0 ? (
          <p className="text-sm text-zinc-500">{L("siteTabVisitors") ?? ""} — 0</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-slate-700">
            {visitorRows.map((v) => {
              const total = visitorReqTemplate.length;
              const ok = visitorReqTemplate.filter((r) => v.requirements_met?.[r.id]).length;
              return (
                <li key={v.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{v.visitor_name}</p>
                    <p className="text-xs text-zinc-500">
                      {formatDateTime(v.check_in, dateLoc, timeZone)}
                    </p>
                  </div>
                  <span className="text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-1">
                    {ok}/{total}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
