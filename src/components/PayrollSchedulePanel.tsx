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
import { hoursWorkedFromClockFields, invertProfileToLegacy } from "@/lib/laborCosting";
import { csvCell, downloadCsvUtf8, fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";
import { generatePayrollPdf } from "@/lib/generatePayrollPdf";
import { formatTodayYmdInTimeZone, normalizeIntlCalendarLocale } from "@/lib/dateUtils";
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
  companyLogoUrl?: string;
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
  companyLogoUrl,
}: PayrollSchedulePanelProps) {
  const { showToast } = useToast();
  const L = (k: string, fb: string) => (lx[k] as string | undefined) || fb;

  const uniqueEmployees = useMemo(
    () => Array.from(new Map(employees.map((e) => [e.id, e])).values()),
    [employees]
  );

  /** Clock rows may use legacy employees.id; roster uses user_profiles.id — merge to profile id. */
  const legacyToProfileId = useMemo(
    () => invertProfileToLegacy(profileToLegacyEmployeeId),
    [profileToLegacyEmployeeId]
  );

  const rosterEmployeeIdForClock = useCallback(
    (clockEmployeeId: string) => legacyToProfileId[clockEmployeeId] ?? clockEmployeeId,
    [legacyToProfileId]
  );

  const [periodType, setPeriodType] = useState<PayrollPeriod>("monthly");
  const [anchorMonth, setAnchorMonth] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });

  const intlCalLocale = useMemo(() => normalizeIntlCalendarLocale(dateLocale), [dateLocale]);
  const monthYearLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(intlCalLocale, { month: "long", year: "numeric" }).format(
        new Date(anchorMonth.y, anchorMonth.m, 1)
      ),
    [intlCalLocale, anchorMonth.y, anchorMonth.m]
  );
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

  const regularHoursCap = periodType === "weekly" ? 40 : periodType === "biweekly" ? 80 : 160;

  const resolveRateKey = useCallback(
    (employeeId: string) => {
      const pick = (id: string) => {
        const v = employeeLaborRatesByEmployeeId[id];
        if (v != null && Number.isFinite(v) && v > 0) return v;
        return null;
      };
      const direct = pick(employeeId);
      if (direct != null) return direct;
      const leg = profileToLegacyEmployeeId[employeeId];
      if (leg) {
        const v = pick(leg);
        if (v != null) return v;
      }
      for (const [profileId, legacyId] of Object.entries(profileToLegacyEmployeeId)) {
        if (legacyId === employeeId) {
          const v = pick(profileId);
          if (v != null) return v;
        }
      }
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
      const rosterId = rosterEmployeeIdForClock(e.employeeId);
      hoursByEmp.set(rosterId, (hoursByEmp.get(rosterId) ?? 0) + h);
    }

    const nameById = buildEmployeeNameByClockId(uniqueEmployees, profileToLegacyEmployeeId);
    const ids = viewAllPayroll
      ? [...new Set([...hoursByEmp.keys(), ...uniqueEmployees.map((e) => e.id)])]
      : currentUserProfileId
        ? [currentUserProfileId]
        : [];

    return ids.map((empId) => {
      const hours = hoursByEmp.get(empId) ?? 0;
      const rate = resolveRateKey(empId);
      const regularHours = Math.min(hours, regularHoursCap);
      const otHours = Math.max(0, hours - regularHoursCap);
      const gross =
        rate != null
          ? Math.round((regularHours * rate + otHours * rate * 1.5) * 100) / 100
          : 0;
      const isCA = countryCode.trim().toUpperCase() === "CA";
      const ded = rate != null && isCA ? calculateDeductions(gross, countryCode, currency) : [];
      const td = rate != null && isCA ? totalEmployeeDeductions(ded) : 0;
      const ec = rate != null && isCA ? totalEmployerContributions(ded) : 0;
      const net =
        rate != null ? Math.max(0, Math.round((gross - td) * 100) / 100) : null;
      const st = statusByEmp[empId] ?? "draft";
      const hasRate = rate != null;
      return {
        employeeId: empId,
        name: nameById.get(empId) ?? empId,
        hours,
        regularHours,
        otHours,
        rate,
        gross,
        deductions: ded,
        totalDeductions: td,
        net: net ?? 0,
        employerCost: ec,
        status: st,
        hasRate,
        payrollCountryIsCa: isCA,
      };
    });
  }, [
    clockEntries,
    periodBounds,
    uniqueEmployees,
    profileToLegacyEmployeeId,
    viewAllPayroll,
    currentUserProfileId,
    countryCode,
    currency,
    resolveRateKey,
    statusByEmp,
    rosterEmployeeIdForClock,
    regularHoursCap,
  ]);

  const exportCsv = () => {
    if (!canExportPayroll) return;
    const hName = L("employees", "Empleados");
    const hHours = L("timesheet_hours", "Horas trabajadas");
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

  const exportPdf = () => {
    if (!canExportPayroll) return;
    void (async () => {
      try {
        const { blob, filename } = await generatePayrollPdf({
          labels: lx,
          companyName,
          companyId,
          companyLogoUrl: companyLogoUrl?.trim() || undefined,
          periodStart: periodBounds.start,
          periodEnd: periodBounds.end,
          currency,
          rows: rows.map((r) => ({
            employeeName: r.name,
            hours: r.hours,
            gross: r.hasRate ? r.gross : 0,
            totalDeductions: r.hasRate ? r.totalDeductions : 0,
            net: r.hasRate ? r.net : 0,
            employerCost: r.hasRate ? r.employerCost : 0,
            deductions: r.hasRate ? r.deductions : [],
          })),
        });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(href);
        showToast("success", L("export_success", "Export completed"));
      } catch (e) {
        showToast("error", (e as Error)?.message ?? L("export_error", "Export error"));
      }
    })();
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
            className="w-full min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px] sm:w-auto sm:min-w-[160px]"
          >
            <option value="weekly">{L("payroll_period_weekly", "Weekly")}</option>
            <option value="biweekly">{L("payroll_period_biweekly", "Biweekly")}</option>
            <option value="monthly">{L("payroll_period_monthly", "Monthly")}</option>
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
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">{monthYearLabel}</span>
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
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => exportCsv()}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium sm:w-auto"
            >
              <Download className="h-4 w-4" />
              {L("payroll_export_csv", "Exportar CSV")}
            </button>
            <button
              type="button"
              onClick={() => exportPdf()}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium sm:w-auto"
            >
              <Download className="h-4 w-4" />
              {L("payroll_export_pdf", "Exportar PDF")}
            </button>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {L(
          "payroll_orientative_note",
          "Las deducciones son orientativas. Consulte a su asesor fiscal."
        )}
      </p>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-700">
        <table className="w-full min-w-[340px] text-sm md:min-w-[720px]">
          <thead className="bg-zinc-50 dark:bg-slate-800/80 text-left text-zinc-600 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-3 font-medium w-10" />
              <th className="px-3 py-3 font-medium">{L("employees", "Empleados")}</th>
              <th className="px-3 py-3 font-medium text-right">{L("timesheet_hours", "Horas trabajadas")}</th>
              <th className="px-3 py-3 font-medium text-right">{L("payroll_gross", "Bruto")}</th>
              <th className="hidden px-3 py-3 font-medium text-right sm:table-cell">{L("payroll_deductions", "Deducciones")}</th>
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
                    <td className="max-w-[9rem] px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100 break-words sm:max-w-none">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.hours.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.hasRate ? `${currency} ${r.gross.toFixed(2)}` : "—"}
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                      {r.hasRate && r.payrollCountryIsCa ? r.totalDeductions.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {r.hasRate ? r.net.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs">
                        {r.status === "draft"
                          ? L("payroll_status_draft", "Borrador")
                          : r.status === "approved"
                            ? L("payroll_status_approved", "Aprobado")
                            : L("payroll_status_paid", "Pagado")}
                      </span>
                    </td>
                    {canManagePayroll ? (
                      <td className="min-w-[8rem] px-3 py-2">
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <button
                            type="button"
                            className="w-full min-h-[44px] rounded-lg border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-600 sm:w-auto"
                            onClick={() => setStatus(r.employeeId, "approved")}
                          >
                            {L("payroll_approve", "Aprobar")}
                          </button>
                          <button
                            type="button"
                            className="w-full min-h-[44px] rounded-lg border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-600 sm:w-auto"
                            onClick={() => setStatus(r.employeeId, "paid")}
                          >
                            {L("payroll_mark_paid", "Marcar pagado")}
                          </button>
                          <button
                            type="button"
                            className="w-full min-h-[44px] rounded-lg border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-600 sm:w-auto"
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
                        {r.rate != null ? (
                          <p className="mb-2 font-medium text-zinc-700 dark:text-zinc-200">
                            {L("payroll_gross", "Bruto")}: {currency} {r.gross.toFixed(2)} —{" "}
                            {L("payroll_regular_hours", "Regular")}: {r.regularHours.toFixed(1)} × {currency}{" "}
                            {r.rate.toFixed(2)}
                            {r.otHours > 0
                              ? ` + ${L("payroll_ot_hours", "OT")}: ${r.otHours.toFixed(1)} × ${currency} ${(r.rate * 1.5).toFixed(2)}`
                              : ""}
                          </p>
                        ) : null}
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
