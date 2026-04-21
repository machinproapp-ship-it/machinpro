"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DollarSign, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  formatTodayYmdInTimeZone,
  weekYmdsMondayFirstInTimeZone,
  zonedYmdHmToUtcIso,
  formatCurrency,
} from "@/lib/dateUtils";
import { laborCostForHours } from "@/lib/laborCosting";
import { fileSlugCompany } from "@/lib/csvExport";
import {
  downloadLaborReportDetailCsv,
  downloadLaborReportExecutivePdf,
  type LaborReportDetailRow,
} from "@/lib/laborReportExport";
import { useToast } from "@/components/Toast";

type TimeEntryRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
};

function monthStartEndYmdInTz(timeZone: string): [string, string] {
  const ymd = formatTodayYmdInTimeZone(timeZone);
  const [ys, ms] = ymd.split("-");
  const y = parseInt(ys ?? "0", 10);
  const mo = parseInt(ms ?? "1", 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return [ymd, ymd];
  const lastDay = new Date(y, mo, 0).getDate();
  const start = `${y}-${String(mo).padStart(2, "0")}-01`;
  const end = `${y}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return [start, end];
}

function entryHours(row: TimeEntryRow): number {
  if (!row.clock_out_at) return 0;
  const a = Date.parse(row.clock_in_at);
  const b = Date.parse(row.clock_out_at);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / 3_600_000;
}

function ymdFromIsoInTz(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function LaborCostingDashboardWidget({
  companyId,
  labels,
  timeZone,
  dateLocaleBcp47,
  currency,
  rateByUserId,
  employeeLabelsByUserId,
  projectNameById,
  dashboardRefreshTk,
  companyNameForFiles = "",
}: {
  companyId: string;
  labels: Record<string, string>;
  timeZone: string;
  dateLocaleBcp47: string;
  currency: string;
  rateByUserId: Record<string, number>;
  employeeLabelsByUserId: Record<string, string>;
  projectNameById: Record<string, string>;
  dashboardRefreshTk: number;
  companyNameForFiles?: string;
}) {
  const L = (k: string) => labels[k] ?? "";
  const { showToast } = useToast();
  const [preset, setPreset] = useState<"week" | "month" | "custom">("month");
  const [customFrom, setCustomFrom] = useState(() => formatTodayYmdInTimeZone(timeZone));
  const [customTo, setCustomTo] = useState(() => formatTodayYmdInTimeZone(timeZone));
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TimeEntryRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [filterUserId, setFilterUserId] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");

  const rangeIso = useMemo(() => {
    if (preset === "custom") {
      const a = customFrom <= customTo ? customFrom : customTo;
      const b = customFrom <= customTo ? customTo : customFrom;
      return {
        start: zonedYmdHmToUtcIso(a, "00:00", timeZone),
        end: zonedYmdHmToUtcIso(b, "23:59", timeZone),
      };
    }
    if (preset === "week") {
      const week = weekYmdsMondayFirstInTimeZone(timeZone, 0);
      const startYmd = week[0]!;
      const endYmd = week[week.length - 1]!;
      return {
        start: zonedYmdHmToUtcIso(startYmd, "00:00", timeZone),
        end: zonedYmdHmToUtcIso(endYmd, "23:59", timeZone),
      };
    }
    const [startYmd, endYmd] = monthStartEndYmdInTz(timeZone);
    return {
      start: zonedYmdHmToUtcIso(startYmd, "00:00", timeZone),
      end: zonedYmdHmToUtcIso(endYmd, "23:59", timeZone),
    };
  }, [preset, customFrom, customTo, timeZone]);

  const reportPeriodLabel = useMemo(() => {
    if (preset === "custom") {
      const a = customFrom <= customTo ? customFrom : customTo;
      const b = customFrom <= customTo ? customTo : customFrom;
      return `${a} – ${b}`;
    }
    if (preset === "week") {
      const week = weekYmdsMondayFirstInTimeZone(timeZone, 0);
      const s = week[0];
      const e = week[week.length - 1];
      return s && e ? `${s} – ${e}` : "";
    }
    const [s, e] = monthStartEndYmdInTz(timeZone);
    return `${s} – ${e}`;
  }, [preset, customFrom, customTo, timeZone]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const uid = (r.user_id ?? "").trim();
      if (filterUserId && uid !== filterUserId) return false;
      const pid = r.project_id != null ? String(r.project_id) : "";
      if (filterProjectId === "__none__") return !pid;
      if (filterProjectId && pid !== filterProjectId) return false;
      return true;
    });
  }, [rows, filterUserId, filterProjectId]);

  const userOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const uid = (r.user_id ?? "").trim();
      if (uid) s.add(uid);
    }
    return [...s].sort();
  }, [rows]);

  const projectOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const pid = r.project_id != null ? String(r.project_id) : "";
      if (pid) s.add(pid);
    }
    return [...s].sort();
  }, [rows]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const { data, error } = await supabase
        .from("time_entries")
        .select("id, user_id, project_id, clock_in_at, clock_out_at")
        .eq("company_id", companyId)
        .gte("clock_in_at", rangeIso.start)
        .lte("clock_in_at", rangeIso.end)
        .order("clock_in_at", { ascending: false })
        .limit(8000);
      if (error) throw error;
      setRows((data ?? []) as TimeEntryRow[]);
    } catch (e) {
      setRows([]);
      setLoadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [companyId, rangeIso.start, rangeIso.end]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows, dashboardRefreshTk]);

  const noProjectLabel = labels.schedule_no_project || "—";
  const fileSlug = fileSlugCompany(companyNameForFiles, companyId || "co");

  const aggregates = useMemo(() => {
    let totalHours = 0;
    let totalCost = 0;
    const byProject = new Map<string, { hours: number; cost: number }>();
    const byUser = new Map<string, { hours: number; cost: number }>();

    for (const r of filteredRows) {
      const uid = (r.user_id ?? "").trim();
      const rate = rateByUserId[uid];
      if (rate == null || rate <= 0) continue;
      const h = entryHours(r);
      if (h <= 0) continue;
      const cost = laborCostForHours(h, rate);
      totalHours += h;
      totalCost += cost;

      const pid = r.project_id != null ? String(r.project_id) : "";
      const pkey = pid || "__none__";
      const pa = byProject.get(pkey) ?? { hours: 0, cost: 0 };
      pa.hours += h;
      pa.cost += cost;
      byProject.set(pkey, pa);

      const ua = byUser.get(uid) ?? { hours: 0, cost: 0 };
      ua.hours += h;
      ua.cost += cost;
      byUser.set(uid, ua);
    }

    const topProjects = [...byProject.entries()]
      .map(([id, v]) => ({
        id,
        name: id === "__none__" ? noProjectLabel : projectNameById[id] ?? id,
        hours: v.hours,
        cost: v.cost,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    const topUsers = [...byUser.entries()]
      .map(([id, v]) => ({
        id,
        name: employeeLabelsByUserId[id] ?? employeeLabelsByUserId[id.toLowerCase()] ?? `${id.slice(0, 8)}…`,
        hours: v.hours,
        cost: v.cost,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      topProjects,
      topUsers,
    };
  }, [filteredRows, rateByUserId, projectNameById, employeeLabelsByUserId, noProjectLabel]);

  const laborExportDetailRows = useMemo((): LaborReportDetailRow[] => {
    const out: LaborReportDetailRow[] = [];
    for (const r of filteredRows) {
      const h = entryHours(r);
      if (h <= 0) continue;
      const uid = (r.user_id ?? "").trim();
      const rate = rateByUserId[uid];
      const cost = rate != null && rate > 0 ? laborCostForHours(h, rate) : 0;
      const pid = r.project_id != null ? String(r.project_id) : "";
      const pname = pid ? (projectNameById[pid] ?? pid) : noProjectLabel;
      const ename =
        employeeLabelsByUserId[uid] ?? employeeLabelsByUserId[uid.toLowerCase()] ?? `${uid.slice(0, 8)}…`;
      out.push({
        employee: ename,
        project: pname,
        hours: Math.round(h * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        dateYmd: ymdFromIsoInTz(r.clock_in_at, timeZone),
      });
    }
    return out;
  }, [filteredRows, rateByUserId, projectNameById, employeeLabelsByUserId, noProjectLabel, timeZone]);

  const exportLaborCsv = useCallback(() => {
    try {
      downloadLaborReportDetailCsv({
        rows: laborExportDetailRows,
        periodLabel: reportPeriodLabel,
        filenameSlug: fileSlug,
        labels: {
          employee: labels.personnel || "Employee",
          project: labels.project || "Project",
          hours: labels.labor_hours_worked || "Hours",
          cost: labels.labor_cost_column || "Cost",
          date: labels.date || "Date",
          period: labels.labor_cost_filter_custom || "Period",
        },
      });
      showToast("success", labels.export_success || "OK");
    } catch {
      showToast("error", labels.export_error || "Error");
    }
  }, [laborExportDetailRows, reportPeriodLabel, fileSlug, labels, showToast]);

  const exportLaborPdf = useCallback(() => {
    try {
      const byEmp = new Map<string, { hours: number; cost: number }>();
      const byProj = new Map<string, { hours: number; cost: number }>();
      let totalH = 0;
      let totalC = 0;
      for (const r of laborExportDetailRows) {
        totalH += r.hours;
        totalC += r.cost;
        const ea = byEmp.get(r.employee) ?? { hours: 0, cost: 0 };
        ea.hours += r.hours;
        ea.cost += r.cost;
        byEmp.set(r.employee, ea);
        const pa = byProj.get(r.project) ?? { hours: 0, cost: 0 };
        pa.hours += r.hours;
        pa.cost += r.cost;
        byProj.set(r.project, pa);
      }
      const byEmployee = [...byEmp.entries()]
        .map(([name, v]) => ({ name, hours: v.hours, cost: Math.round(v.cost * 100) / 100 }))
        .sort((a, b) => b.cost - a.cost);
      const byProject = [...byProj.entries()]
        .map(([name, v]) => ({ name, hours: v.hours, cost: Math.round(v.cost * 100) / 100 }))
        .sort((a, b) => b.cost - a.cost);
      downloadLaborReportExecutivePdf({
        title: labels.labor_report_summary || "Cost summary",
        periodLabel: reportPeriodLabel,
        summaryHeading: labels.labor_report_summary || "Cost summary",
        totalHoursLabel: labels.labor_hours_worked || "Hours",
        totalCostLabel: labels.labor_cost_total || "Total cost",
        byEmployeeHeading: labels.labor_cost_by_employee || "By employee",
        byProjectHeading: labels.labor_cost_by_project || "By project",
        currency,
        dateLocale: dateLocaleBcp47,
        totalHours: Math.round(totalH * 100) / 100,
        totalCost: Math.round(totalC * 100) / 100,
        byEmployee,
        byProject,
        filenameSlug: fileSlug,
      });
      showToast("success", labels.export_success || "OK");
    } catch {
      showToast("error", labels.export_error || "Error");
    }
  }, [laborExportDetailRows, reportPeriodLabel, labels, currency, dateLocaleBcp47, fileSlug, showToast]);

  return (
    <>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pe-14 flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        {L("labor_costing")}
      </h3>

      <div className="flex flex-wrap gap-2 mb-3">
        {(
          [
            ["week", L("labor_cost_filter_week")],
            ["month", L("labor_cost_filter_month")],
            ["custom", L("labor_cost_filter_custom")],
          ] as const
        ).map(([k, lab]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPreset(k)}
            className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-semibold ${
              preset === k
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
            }`}
          >
            {lab || k}
          </button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <label className="text-xs text-gray-600 dark:text-gray-400">
            <span className="block mb-1">{L("timesheet_date_from")}</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-400">
            <span className="block mb-1">{L("timesheet_date_to")}</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <label className="text-xs text-gray-600 dark:text-gray-400">
          <span className="block mb-1">{L("personnel") || L("training_filter_employee") || "Employee"}</span>
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-2 text-sm"
          >
            <option value="">{L("training_all") || "All"}</option>
            {userOptions.map((id) => (
              <option key={id} value={id}>
                {employeeLabelsByUserId[id] ?? employeeLabelsByUserId[id.toLowerCase()] ?? id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-400">
          <span className="block mb-1">{L("project") || "Project"}</span>
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-2 text-sm"
          >
            <option value="">{L("training_all") || "All"}</option>
            <option value="__none__">{noProjectLabel}</option>
            {projectOptions.map((id) => (
              <option key={id} value={id}>
                {projectNameById[id] ?? id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap mb-3">
        <button
          type="button"
          onClick={() => exportLaborCsv()}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-emerald-600/50 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 sm:w-auto"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {L("labor_export_report")} · {L("export_csv") || "CSV"}
        </button>
        <button
          type="button"
          onClick={() => exportLaborPdf()}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 sm:w-auto"
        >
          {L("labor_export_report")} · {L("export_pdf") || "PDF"}
        </button>
      </div>

      {loadErr ? (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">{String(loadErr)}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{L("loading") || "…"}</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{L("labor_cost_total")}</p>
            <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
              {formatCurrency(aggregates.totalCost, currency, dateLocaleBcp47)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              {L("labor_hours_worked")}:{" "}
              <span className="font-semibold tabular-nums">{aggregates.totalHours.toFixed(1)}h</span>
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">{L("labor_cost_by_project")}</p>
            {aggregates.topProjects.length === 0 ? (
              <p className="text-xs text-gray-500">{L("dashboard_trend_neutral")}</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {aggregates.topProjects.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 text-gray-800 dark:text-gray-200">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="shrink-0 tabular-nums text-right">
                      {formatCurrency(p.cost, currency, dateLocaleBcp47)}
                      <span className="text-gray-500 dark:text-gray-400 ms-1">· {p.hours.toFixed(1)}h</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">{L("labor_cost_by_employee")}</p>
            {aggregates.topUsers.length === 0 ? (
              <p className="text-xs text-gray-500">{L("dashboard_trend_neutral")}</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {aggregates.topUsers.map((u) => (
                  <li key={u.id} className="flex justify-between gap-2 text-gray-800 dark:text-gray-200">
                    <span className="min-w-0 truncate">{u.name}</span>
                    <span className="shrink-0 tabular-nums text-right">
                      {formatCurrency(u.cost, currency, dateLocaleBcp47)}
                      <span className="text-gray-500 dark:text-gray-400 ms-1">· {u.hours.toFixed(1)}h</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
