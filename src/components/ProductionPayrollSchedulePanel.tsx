"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import type { PayrollPeriod } from "@/lib/payroll";
import type { ProductionReport } from "@/lib/productionCatalog";
import { formatTodayYmdInTimeZone } from "@/lib/dateUtils";
import { ChevronDown, ChevronRight, Download, FileText, X } from "lucide-react";
import { csvCell, downloadCsvUtf8, fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";
import { generatePayrollPdf } from "@/lib/generatePayrollPdf";
import { generateInvoicePdf, nextMachinProInvoiceNumber, defaultInvoiceTaxPercent } from "@/lib/generateInvoicePdf";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";

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

type TaskLine = {
  key: string;
  taskName: string;
  unit: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  projectId: string;
};

export function ProductionPayrollSchedulePanel({
  labels: lx,
  companyName,
  companyId,
  companyAddress = "",
  companyPhone = "",
  companyEmail = "",
  timeZone,
  dateLocale,
  currency,
  companyCountry = "CA",
  employees,
  productionReports,
  profileToLegacyEmployeeId,
  currentUserProfileId,
  viewAll,
  canExportPayroll,
  canManagePayroll = false,
  companyLogoUrl,
  projects = [],
  onRefreshProductionReports,
}: {
  labels: Record<string, string>;
  companyName: string;
  companyId: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  timeZone: string;
  dateLocale: string;
  currency: string;
  companyCountry?: string;
  employees: SchedEmp[];
  productionReports: ProductionReport[];
  profileToLegacyEmployeeId: Record<string, string>;
  currentUserProfileId?: string;
  viewAll: boolean;
  canExportPayroll: boolean;
  canManagePayroll?: boolean;
  companyLogoUrl?: string;
  projects?: { id: string; name: string }[];
  onRefreshProductionReports?: () => void;
}) {
  const L = (k: string, fb: string) => (lx[k] as string | undefined) || fb;
  const { showToast } = useToast();

  const [periodType, setPeriodType] = useState<PayrollPeriod>("monthly");
  const [anchorMonth, setAnchorMonth] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyEmp, setBusyEmp] = useState<string | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invClientName, setInvClientName] = useState("");
  const [invClientAddr, setInvClientAddr] = useState("");
  const [invClientEmail, setInvClientEmail] = useState("");
  const [invProjectRef, setInvProjectRef] = useState("");
  const [invTaxPct, setInvTaxPct] = useState(String(defaultInvoiceTaxPercent(companyCountry)));
  const [invNotes, setInvNotes] = useState("");

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

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
    const nameBy = buildNameById(employees, profileToLegacyEmployeeId);

    type Agg = {
      reportIds: string[];
      units: number;
      amount: number;
      statuses: ProductionReport["status"][];
      taskMap: Map<string, TaskLine>;
    };
    const byEmp = new Map<string, Agg>();

    for (const r of productionReports) {
      if (r.date < start || r.date > end) continue;
      if (!viewAll && r.employeeId !== currentUserProfileId) continue;
      const agg =
        byEmp.get(r.employeeId) ??
        ({
          reportIds: [],
          units: 0,
          amount: 0,
          statuses: [],
          taskMap: new Map<string, TaskLine>(),
        } as Agg);
      agg.reportIds.push(r.id);
      agg.units += r.totalUnits;
      agg.amount += r.totalSell;
      agg.statuses.push(r.status);
      for (const e of r.entries) {
        const key = `${e.catalogItemId}|${e.taskName}|${r.projectId}`;
        const cur = agg.taskMap.get(key) ?? {
          key,
          taskName: e.taskName,
          unit: String(e.unit),
          qty: 0,
          unitPrice: e.sellPrice,
          lineTotal: 0,
          projectId: r.projectId,
        };
        cur.qty += e.unitsCompleted;
        cur.lineTotal += e.totalSell;
        if (e.sellPrice > 0) cur.unitPrice = e.sellPrice;
        agg.taskMap.set(key, cur);
      }
      byEmp.set(r.employeeId, agg);
    }

    const ids = viewAll
      ? [...new Set([...byEmp.keys(), ...employees.map((e) => e.id)])]
      : currentUserProfileId
        ? [currentUserProfileId]
        : [];

    return ids.map((id) => {
      const g = byEmp.get(id);
      const tasks = g ? [...g.taskMap.values()] : [];
      return {
        employeeId: id,
        name: nameBy.get(id) ?? id,
        reportIds: g?.reportIds ?? [],
        units: g?.units ?? 0,
        amount: g?.amount ?? 0,
        status: g ? aggregateStatus(g.statuses) : "draft",
        tasks,
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

  const companyTotal = useMemo(() => rows.reduce((a, r) => a + r.amount, 0), [rows]);

  const updateReportsStatus = useCallback(
    async (reportIds: string[], status: ProductionReport["status"]) => {
      if (!canManagePayroll || reportIds.length === 0) return;
      const { error } = await supabase.from("production_reports").update({ status }).in("id", reportIds);
      if (error) {
        showToast("error", L("toast_error", error.message));
        return;
      }
      showToast("success", L("toast_saved", "Saved"));
      onRefreshProductionReports?.();
    },
    [canManagePayroll, showToast, L, onRefreshProductionReports]
  );

  const setEmployeeStatus = async (employeeId: string, status: ProductionReport["status"]) => {
    const r = rows.find((x) => x.employeeId === employeeId);
    if (!r?.reportIds.length) return;
    setBusyEmp(employeeId);
    await updateReportsStatus(r.reportIds, status);
    setBusyEmp(null);
  };

  const exportCsvDetail = () => {
    if (!canExportPayroll) return;
    const hEmp = L("employees", "Employee");
    const hTask = L("payroll_production_task", "Task");
    const hUnit = L("invoice_unit", "Unit");
    const hQty = L("invoice_quantity", "Qty");
    const hPrice = L("invoice_unit_price", "Unit price");
    const hLine = L("invoice_total", "Total");
    const lines = [[hEmp, hTask, hUnit, hQty, hPrice, hLine].map((c) => csvCell(c)).join(",")];
    for (const r of rows) {
      for (const t of r.tasks) {
        lines.push(
          [
            csvCell(r.name),
            csvCell(t.taskName),
            csvCell(t.unit),
            csvCell(String(t.qty)),
            csvCell(String(t.unitPrice)),
            csvCell(String(t.lineTotal)),
          ].join(",")
        );
      }
    }
    const slug = fileSlugCompany(companyName, companyId || "co");
    downloadCsvUtf8(`payroll_production_detail_${slug}_${filenameDateYmd()}.csv`, lines);
    showToast("success", L("export_success", "Export completed"));
  };

  const exportPdf = () => {
    if (!canExportPayroll) return;
    void (async () => {
      try {
        const productionRows = rows
          .filter((r) => r.tasks.length > 0)
          .map((r) => ({
            employeeName: r.name,
            totalUnits: r.units,
            totalOwed: r.amount,
            tasks: r.tasks.map((t) => ({
              name: t.taskName + (projects.length ? ` (${projectNameById.get(t.projectId) ?? t.projectId})` : ""),
              unit: t.unit,
              qty: t.qty,
              unitPrice: t.unitPrice,
              lineTotal: t.lineTotal,
            })),
          }));
        const { blob, filename } = await generatePayrollPdf({
          mode: "production",
          labels: lx,
          companyName,
          companyId,
          companyLogoUrl: companyLogoUrl?.trim() || undefined,
          periodStart: periodBounds.start,
          periodEnd: periodBounds.end,
          currency,
          productionRows,
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

  const aggregatedInvoiceLines = useMemo(() => {
    const map = new Map<
      string,
      { description: string; unit: string; quantity: number; unitPrice: number; lineTotal: number }
    >();
    const { start, end } = periodBounds;
    for (const r of productionReports) {
      if (r.date < start || r.date > end) continue;
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
    return [...map.values()].filter((l) => l.lineTotal > 0 || l.quantity > 0);
  }, [productionReports, periodBounds]);

  const runInvoicePdf = () => {
    if (!canExportPayroll || aggregatedInvoiceLines.length === 0) {
      showToast("error", L("invoice_no_lines", "No billable lines in this period."));
      return;
    }
    const tax = Number.parseFloat(invTaxPct.replace(",", "."));
    if (!Number.isFinite(tax) || tax < 0) {
      showToast("error", L("toast_error", "Invalid tax"));
      return;
    }
    void (async () => {
      try {
        const num = nextMachinProInvoiceNumber(companyId || "co");
        const { blob, filename } = await generateInvoicePdf({
          labels: lx,
          companyName,
          companyId,
          companyLogoUrl: companyLogoUrl?.trim() || undefined,
          issuerName: companyName,
          issuerAddress: companyAddress?.trim() || undefined,
          issuerEmail: companyEmail?.trim() || undefined,
          issuerPhone: companyPhone?.trim() || undefined,
          invoiceNumber: num,
          issueDate: formatTodayYmdInTimeZone(timeZone),
          currency,
          clientName: invClientName.trim() || L("invoice_client", "Client"),
          clientAddress: invClientAddr.trim() || undefined,
          clientEmail: invClientEmail.trim() || undefined,
          clientProjectRef: invProjectRef.trim() || undefined,
          lines: aggregatedInvoiceLines.map((l) => ({
            description: l.description,
            unit: l.unit,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
          taxPercent: tax,
          notes: invNotes.trim() || undefined,
        });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(href);
        showToast("success", L("export_success", "Export completed"));
        setInvoiceOpen(false);
      } catch (e) {
        showToast("error", (e as Error)?.message ?? L("export_error", "Export error"));
      }
    })();
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportCsvDetail()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium"
            >
              <Download className="h-4 w-4" />
              {L("payroll_export_csv", "Exportar CSV")}
            </button>
            <button
              type="button"
              onClick={() => exportPdf()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium"
            >
              <Download className="h-4 w-4" />
              {L("payroll_production_export_pdf", L("payroll_export_pdf", "Export PDF"))}
            </button>
            <button
              type="button"
              onClick={() => setInvoiceOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm font-medium text-amber-950 dark:text-amber-100"
            >
              <FileText className="h-4 w-4" />
              {L("invoice_generate_period", L("invoice_generate", "Generate invoice"))}
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {L("payroll_production_company_total", "Company total to pay")}:{" "}
          <span className="tabular-nums">
            {currency} {companyTotal.toFixed(2)}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-700">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-50 dark:bg-slate-800/80 text-left text-zinc-600 dark:text-zinc-400">
            <tr>
              <th className="px-1 py-3 w-10" />
              <th className="px-3 py-3 font-medium">{L("employees", "Empleados")}</th>
              <th className="px-3 py-3 font-medium text-right">{L("production_report_units", "Unidades")}</th>
              <th className="px-3 py-3 font-medium text-right">{L("payroll_production_total_owed", "Importe")}</th>
              <th className="px-3 py-3 font-medium">{L("common_status", "Estado")}</th>
              {canManagePayroll ? <th className="px-3 py-3 font-medium">{L("common_actions", "Acciones")}</th> : null}
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
                    {canManagePayroll ? (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={busyEmp === r.employeeId || r.reportIds.length === 0}
                            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs min-h-[44px] disabled:opacity-50"
                            onClick={() => void setEmployeeStatus(r.employeeId, "approved")}
                          >
                            {L("payroll_approve", "Aprobar")}
                          </button>
                          <button
                            type="button"
                            disabled={busyEmp === r.employeeId || r.reportIds.length === 0}
                            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs min-h-[44px] disabled:opacity-50"
                            onClick={() => void setEmployeeStatus(r.employeeId, "paid")}
                          >
                            {L("payroll_mark_paid", "Marcar pagado")}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                  {open ? (
                    <tr className="bg-zinc-50/50 dark:bg-slate-900/50">
                      <td colSpan={canManagePayroll ? 6 : 5} className="px-6 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {r.tasks.length === 0 ? (
                          <p>{L("payroll_production_no_tasks", "No tasks in period.")}</p>
                        ) : (
                          <ul className="space-y-1">
                            {r.tasks.map((t) => (
                              <li key={t.key} className="flex flex-wrap justify-between gap-2">
                                <span>
                                  {t.taskName}{" "}
                                  <span className="text-zinc-500">
                                    ({projectNameById.get(t.projectId) ?? t.projectId})
                                  </span>
                                </span>
                                <span className="tabular-nums">
                                  {t.qty.toFixed(2)} {t.unit} × {currency} {t.unitPrice.toFixed(2)} = {currency}{" "}
                                  {t.lineTotal.toFixed(2)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {invoiceOpen ? (
        <div className="fixed inset-0 z-[10060] flex items-end justify-center sm:items-center p-4 bg-black/50">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-xl p-4 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {L("invoice_generate", "Generate invoice")}
              </h3>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-zinc-500"
                onClick={() => setInvoiceOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              {periodBounds.start} → {periodBounds.end}
            </p>
            <label className="block text-xs text-zinc-500">
              {L("invoice_client_name", "Client name")}
              <input
                value={invClientName}
                onChange={(e) => setInvClientName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              {L("invoice_client_address", "Client address")}
              <textarea
                value={invClientAddr}
                onChange={(e) => setInvClientAddr(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              {L("invoice_client_email", "Client email")}
              <input
                value={invClientEmail}
                onChange={(e) => setInvClientEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              {L("invoice_client_project_ref", "Client project ref")}
              <input
                value={invProjectRef}
                onChange={(e) => setInvProjectRef(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              {L("invoice_tax_rate", "Tax rate (%)")}
              <input
                value={invTaxPct}
                onChange={(e) => setInvTaxPct(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px] tabular-nums"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              {L("invoice_notes", "Notes")}
              <textarea
                value={invNotes}
                onChange={(e) => setInvNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => void runInvoicePdf()}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                {L("invoice_generate", "Generate invoice")}
              </button>
              <button
                type="button"
                onClick={() => setInvoiceOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium"
              >
                {L("common_cancel", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
