"use client";

import { useMemo, useState } from "react";
import type { PayrollPeriod } from "@/lib/payroll";
import type { ProductionReport } from "@/lib/productionCatalog";
import { formatTodayYmdInTimeZone } from "@/lib/dateUtils";
import { Download } from "lucide-react";
import { csvCell, downloadCsvUtf8, fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";
import { useToast } from "@/components/Toast";

type SchedEmp = { id: string; name: string };

function startOfMonth(y: number, m0: number): Date {
  return new Date(y, m0, 1);
}

function endOfMonth(y: number, m0: number): Date {
  return new Date(y, m0 + 1, 0);
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
}

function buildNameById(employees: SchedEmp[], profileToLegacy: Record<string, string>): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of employees) {
    m.set(e.id, e.name);
    const leg = profileToLegacy[e.id];
    if (leg) m.set(leg, e.name);
  }
  return m;
}

function aggregateStatus(statuses: ProductionReport["status"][]): ProductionReport["status"] {
  if (statuses.length === 0) return "draft";
  if (statuses.every((s) => s === "paid")) return "paid";
  if (statuses.every((s) => s === "approved" || s === "paid")) return "approved";
  return "draft";
}

export function ProductionPayrollSchedulePanel({
  labels: lx,
  companyName,
  companyId,
  timeZone,
  dateLocale,
  currency,
  employees,
  productionReports,
  profileToLegacyEmployeeId,
  currentUserProfileId,
  viewAll,
  canExportPayroll,
}: {
  labels: Record<string, string>;
  companyName: string;
  companyId: string;
  timeZone: string;
  dateLocale: string;
  currency: string;
  employees: SchedEmp[];
  productionReports: ProductionReport[];
  profileToLegacyEmployeeId: Record<string, string>;
  currentUserProfileId?: string;
  viewAll: boolean;
  canExportPayroll: boolean;
}) {
  const L = (k: string, fb: string) => (lx[k] as string | undefined) || fb;
  const { showToast } = useToast();

  const [periodType, setPeriodType] = useState<PayrollPeriod>("monthly");
  const [anchorMonth, setAnchorMonth] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [weekOffset, setWeekOffset] = useState(0);

  const periodBounds = useMemo(() => {
    if (periodType === "monthly") {
      const start = startOfMonth(anchorMonth.y, anchorMonth.m);
      const end = endOfMonth(anchorMonth.y, anchorMonth.m);
      return { start: ymd(start), end: ymd(end) };
    }
    if (periodType === "biweekly") {
      const today = formatTodayYmdInTimeZone(timeZone);
      const base = addDays(today, weekOffset * 14);
      return { start: addDays(base, -13), end: base };
    }
    const today = formatTodayYmdInTimeZone(timeZone);
    const base = addDays(today, weekOffset * 7);
    return { start: addDays(base, -6), end: base };
  }, [periodType, anchorMonth, weekOffset, timeZone]);

  const rows = useMemo(() => {
    const { start, end } = periodBounds;
    const byEmp = new Map<
      string,
      { units: number; amount: number; statuses: ProductionReport["status"][] }
    >();
    for (const r of productionReports) {
      if (r.date < start || r.date > end) continue;
      if (!viewAll && r.employeeId !== currentUserProfileId) continue;
      const cur = byEmp.get(r.employeeId) ?? { units: 0, amount: 0, statuses: [] };
      cur.units += r.totalUnits;
      cur.amount += r.totalSell;
      cur.statuses.push(r.status);
      byEmp.set(r.employeeId, cur);
    }
    const nameBy = buildNameById(employees, profileToLegacyEmployeeId);
    const ids = viewAll
      ? [...new Set([...byEmp.keys(), ...employees.map((e) => e.id)])]
      : currentUserProfileId
        ? [currentUserProfileId]
        : [];
    return ids.map((id) => {
      const g = byEmp.get(id);
      return {
        employeeId: id,
        name: nameBy.get(id) ?? id,
        units: g?.units ?? 0,
        amount: g?.amount ?? 0,
        status: g ? aggregateStatus(g.statuses) : "draft",
      };
    });
  }, [
    productionReports,
    periodBounds,
    viewAll,
    currentUserProfileId,
    employees,
    profileToLegacyEmployeeId,
  ]);

  const exportCsv = () => {
    if (!canExportPayroll) return;
    const hName = L("employees", "Empleados");
    const hUnits = L("production_report_units", "Units completed");
    const hTotal = L("production_report_total", "Total production");
    const hSt = L("common_status", "Estado");
    const lines = [[hName, hUnits, hTotal, hSt].map((c) => csvCell(c)).join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.name),
          csvCell(String(r.units)),
          csvCell(`${currency} ${r.amount.toFixed(2)}`),
          csvCell(r.status),
        ].join(",")
      );
    }
    const slug = fileSlugCompany(companyName, companyId || "co");
    downloadCsvUtf8(`payroll_production_${slug}_${filenameDateYmd()}.csv`, lines);
    showToast("success", L("export_success", "Export completed"));
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {L("payroll_title", "Nóminas")} — {L("payroll_pay_toggle_production", "Production")}
          </label>
          <select
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as PayrollPeriod)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px] min-w-[160px]"
          >
            <option value="weekly">{L("payroll_period_weekly", "Semanal")}</option>
            <option value="biweekly">{L("payroll_period_biweekly", "Quincenal")}</option>
            <option value="monthly">{L("payroll_period_monthly", "Mensual")}</option>
          </select>
        </div>
        {periodType === "monthly" ? (
          <div className="flex gap-2 items-center">
            <button
              type="button"
              className="min-h-[44px] min-w-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-2"
              onClick={() =>
                setAnchorMonth((p) => (p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 }))
              }
            >
              ‹
            </button>
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">
              {new Intl.DateTimeFormat(dateLocale, { month: "long", year: "numeric" }).format(
                new Date(anchorMonth.y, anchorMonth.m, 1)
              )}
            </span>
            <button
              type="button"
              className="min-h-[44px] min-w-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-2"
              onClick={() =>
                setAnchorMonth((p) => (p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 }))
              }
            >
              ›
            </button>
          </div>
        ) : (
          <div className="flex gap-2 items-center">
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 text-sm"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              −
            </button>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {periodBounds.start} → {periodBounds.end}
            </span>
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 text-sm"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              +
            </button>
          </div>
        )}
        {canExportPayroll ? (
          <button
            type="button"
            onClick={() => exportCsv()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            {L("payroll_export_csv", "Exportar CSV")}
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-700">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-zinc-50 dark:bg-slate-800/80 text-left text-zinc-600 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-3 font-medium">{L("employees", "Empleados")}</th>
              <th className="px-3 py-3 font-medium text-right">
                {L("production_report_units", "Unidades")}
              </th>
              <th className="px-3 py-3 font-medium text-right">
                {L("production_report_total", "Total producción")}
              </th>
              <th className="px-3 py-3 font-medium">{L("common_status", "Estado")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.employeeId} className="hover:bg-zinc-50/80 dark:hover:bg-slate-800/40">
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{r.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.units.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {currency} {r.amount.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs capitalize">
                    {r.status === "draft"
                      ? L("payroll_status_draft", "Borrador")
                      : r.status === "approved"
                        ? L("payroll_status_approved", "Aprobado")
                        : L("payroll_status_paid", "Pagado")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
