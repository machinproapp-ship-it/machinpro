"use client";

import { Fragment, useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import type { ClockEntryForSchedule } from "@/types/homePage";
import {
  calculateDeductions,
  totalEmployeeDeductions,
  totalEmployerContributions,
  type PayrollPeriod,
  type PayrollDeduction,
} from "@/lib/payroll";
import { hoursWorkedFromClockFields } from "@/lib/laborCosting";
import { csvCell, downloadCsvUtf8, fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";
import { formatTodayYmdInTimeZone } from "@/lib/dateUtils";
import { useToast } from "@/components/Toast";

type RowStatus = "draft" | "approved" | "paid";

function buildEmployeeNameByClockId(
  employees: { id: string; name: string }[],
  profileToLegacyEmployeeId: Record<string, string>
): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of employees) {
    m.set(e.id, e.name);
    const leg = profileToLegacyEmployeeId[e.id];
    if (leg) m.set(leg, e.name);
  }
  return m;
}

export type PayrollSchedulePanelProps = {
  labels: Record<string, string>;
  companyName: string;
  companyId: string;
  timeZone: string;
  dateLocale: string;
  countryCode: string;
  currency: string;
  employees: { id: string; name: string }[];
  clockEntries: ClockEntryForSchedule[];
  employeeLaborRatesByEmployeeId: Record<string, number>;
  profileToLegacyEmployeeId: Record<string, string>;
  currentUserProfileId?: string;
  /** Si es false, solo filas del perfil actual (canViewPayroll sin gestionar). */
  viewAllPayroll: boolean;
  canManagePayroll: boolean;
  canExportPayroll: boolean;
};

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

export function PayrollSchedulePanel({
  labels: lx,
  companyName,
  companyId,
  timeZone,
  dateLocale,
  countryCode,
  currency,
  employees,
  clockEntries,
  employeeLaborRatesByEmployeeId,
  profileToLegacyEmployeeId,
  currentUserProfileId,
  viewAllPayroll,
  canManagePayroll,
  canExportPayroll,
}: PayrollSchedulePanelProps) {
  const { showToast } = useToast();
  const L = (k: string, fb: string) => (lx[k] as string | undefined) || fb;

  const [periodType, setPeriodType] = useState<PayrollPeriod>("monthly");
  const [anchorMonth, setAnchorMonth] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [statusByEmp, setStatusByEmp] = useState<Record<string, RowStatus>>({});

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

  const resolveRateKey = useCallback(
    (employeeId: string) => {
      const r = employeeLaborRatesByEmployeeId[employeeId];
      if (r != null) return r;
      const leg = profileToLegacyEmployeeId[employeeId];
      if (leg && employeeLaborRatesByEmployeeId[leg] != null) return employeeLaborRatesByEmployeeId[leg];
      return null;
    },
    [employeeLaborRatesByEmployeeId, profileToLegacyEmployeeId]
  );

  const rows = useMemo(() => {
    const { start, end } = periodBounds;
    const hoursByEmp = new Map<string, number>();
    for (const e of clockEntries) {
      if (e.date < start || e.date > end) continue;
      const h = hoursWorkedFromClockFields({
        clockIn: e.clockIn,
        clockOut: e.clockOut,
        clockInAtIso: e.clockInAtIso,
        clockOutAtIso: e.clockOutAtIso,
      });
      if (h <= 0) continue;
      hoursByEmp.set(e.employeeId, (hoursByEmp.get(e.employeeId) ?? 0) + h);
    }

    const nameById = buildEmployeeNameByClockId(employees, profileToLegacyEmployeeId);
    const ids = viewAllPayroll
      ? [...new Set([...hoursByEmp.keys(), ...employees.map((e) => e.id)])]
      : currentUserProfileId
        ? [currentUserProfileId]
        : [];

    return ids.map((empId) => {
      const hours = hoursByEmp.get(empId) ?? 0;
      const rate = resolveRateKey(empId);
      const gross = rate != null && hours > 0 ? Math.round(hours * rate * 100) / 100 : 0;
      const ded = calculateDeductions(gross, countryCode, currency);
      const td = totalEmployeeDeductions(ded);
      const ec = totalEmployerContributions(ded);
      const net = Math.max(0, Math.round((gross - td) * 100) / 100);
      const st = statusByEmp[empId] ?? "draft";
      return {
        employeeId: empId,
        name: nameById.get(empId) ?? empId,
        hours,
        rate,
        gross,
        deductions: ded,
        totalDeductions: td,
        net,
        employerCost: ec,
        status: st,
      };
    });
  }, [
    clockEntries,
    periodBounds,
    employees,
    profileToLegacyEmployeeId,
    viewAllPayroll,
    currentUserProfileId,
    countryCode,
    currency,
    resolveRateKey,
    statusByEmp,
  ]);

  const exportCsv = () => {
    if (!canExportPayroll) return;
    const hName = L("employees", "Empleados");
    const hHours = L("timesheet_hours", L("labor_hours_worked", "Horas trabajadas"));
    const hGross = L("payroll_gross", "Bruto");
    const hNet = L("payroll_net", "Neto");
    const hSt = L("common_status", "Estado");
    const lines = [
      [hName, hHours, hGross, hNet, hSt].map((c) => csvCell(c)).join(","),
    ];
    for (const r of rows) {
      lines.push(
        [csvCell(r.name), csvCell(String(r.hours)), csvCell(String(r.gross)), csvCell(String(r.net)), csvCell(r.status)].join(
          ","
        )
      );
    }
    const slug = fileSlugCompany(companyName, companyId || "co");
    downloadCsvUtf8(`payroll_${slug}_${filenameDateYmd()}.csv`, lines);
    showToast("success", L("export_success", "Export completed"));
  };

  const setStatus = (empId: string, st: RowStatus) => {
    if (!canManagePayroll) return;
    setStatusByEmp((prev) => ({ ...prev, [empId]: st }));
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {L("payroll_title", "Nóminas")}
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

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {L(
          "payroll_orientative_note",
          "Las deducciones son orientativas. Consulte a su asesor fiscal."
        )}
      </p>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-700">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-50 dark:bg-slate-800/80 text-left text-zinc-600 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-3 font-medium w-10" />
              <th className="px-3 py-3 font-medium">{L("employees", "Empleados")}</th>
              <th className="px-3 py-3 font-medium text-right">
                {L("timesheet_hours", L("labor_hours_worked", "Horas trabajadas"))}
              </th>
              <th className="px-3 py-3 font-medium text-right">{L("payroll_gross", "Bruto")}</th>
              <th className="px-3 py-3 font-medium text-right">{L("payroll_deductions", "Deducciones")}</th>
              <th className="px-3 py-3 font-medium text-right">{L("payroll_net", "Neto")}</th>
              <th className="px-3 py-3 font-medium">{L("common_status", "Estado")}</th>
              {canManagePayroll ? (
                <th className="px-3 py-3 font-medium">{L("common_actions", "Acciones")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
            {rows.map((r) => {
              const open = expanded[r.employeeId];
              return (
                <Fragment key={r.employeeId}>
                  <tr className="hover:bg-zinc-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-1 py-2">
                      <button
                        type="button"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500"
                        onClick={() => setExpanded((e) => ({ ...e, [r.employeeId]: !open }))}
                        aria-expanded={open}
                      >
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.hours.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.rate == null
                        ? L("payroll_no_rate", "—")
                        : `${currency} ${r.gross.toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.totalDeductions.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{r.net.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs capitalize">
                        {r.status === "draft"
                          ? L("payroll_status_draft", "Borrador")
                          : r.status === "approved"
                            ? L("payroll_status_approved", "Aprobado")
                            : L("payroll_status_paid", "Pagado")}
                      </span>
                    </td>
                    {canManagePayroll ? (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs min-h-[44px]"
                            onClick={() => setStatus(r.employeeId, "approved")}
                          >
                            {L("payroll_approve", "Aprobar")}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs min-h-[44px]"
                            onClick={() => setStatus(r.employeeId, "paid")}
                          >
                            {L("payroll_mark_paid", "Marcar pagado")}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs min-h-[44px]"
                            onClick={() => setStatus(r.employeeId, "draft")}
                          >
                            {L("payroll_status_draft", "Borrador")}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                  {open ? (
                    <tr className="bg-zinc-50/50 dark:bg-slate-900/50">
                      <td colSpan={canManagePayroll ? 8 : 7} className="px-6 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        <ul className="space-y-1">
                          {(r.deductions as PayrollDeduction[]).map((d, i) => (
                            <li key={i} className="flex justify-between gap-4">
                              <span>
                                {L(d.nameKey, d.name)}{" "}
                                {d.isEmployer ? L("payroll_deduction_employer_tag", "(empresa)") : ""}
                              </span>
                              <span className="tabular-nums">
                                {(d.rate * 100).toFixed(2)}% → {d.amount.toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {r.employerCost > 0 ? (
                          <p className="mt-2 font-medium">
                            {L("payroll_employer_cost", "Coste empresa")}: {currency}{" "}
                            {r.employerCost.toFixed(2)}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
