"use client";

import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Download, Settings2 } from "lucide-react";
import type { ClockEntryForSchedule } from "@/types/homePage";
import type { PayrollPeriod } from "@/lib/payroll";
import {
  computePrePayrollRow,
  defaultOvertimeRule,
  defaultVacationPayPct,
  prePayrollEarningLines,
  type OvertimeRule,
} from "@/lib/prePayroll";
import { normalizePrePayrollSettings, type PrePayrollSettings } from "@/lib/companySettingsTypes";
import { supabase } from "@/lib/supabase";
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

  /** Reglas de pre-nómina de la empresa (horas extra y % de vacaciones). */
  const [ppSettings, setPpSettings] = useState<PrePayrollSettings | null>(null);
  const [ppEditing, setPpEditing] = useState(false);
  const [ppDraft, setPpDraft] = useState<PrePayrollSettings | null>(null);
  const [ppSaving, setPpSaving] = useState(false);

  const fallbackSettings = useMemo((): PrePayrollSettings => {
    const r = defaultOvertimeRule(countryCode);
    return {
      weeklyOtThreshold: r.weeklyThreshold,
      dailyOtThreshold: r.dailyThreshold,
      otMultiplier: r.multiplier,
      vacationPayPct: defaultVacationPayPct(countryCode),
    };
  }, [countryCode]);
  const settings = ppSettings ?? fallbackSettings;
  const rule: OvertimeRule = useMemo(
    () => ({
      weeklyThreshold: settings.weeklyOtThreshold,
      dailyThreshold: settings.dailyOtThreshold,
      multiplier: settings.otMultiplier,
    }),
    [settings]
  );

  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch(`/api/company/settings?companyId=${encodeURIComponent(companyId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const j = (await res.json()) as { settings?: { prePayroll?: unknown } };
        const pp = normalizePrePayrollSettings(j.settings?.prePayroll);
        if (alive && pp) setPpSettings(pp);
      } catch {
        /* se usan los valores por defecto del país */
      }
    })();
    return () => {
      alive = false;
    };
  }, [companyId]);

  const savePpSettings = async () => {
    if (!ppDraft || !canManagePayroll || ppSaving) return;
    setPpSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/company/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ companyId, merge: { prePayroll: ppDraft } }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { settings?: { prePayroll?: unknown } };
      setPpSettings(normalizePrePayrollSettings(j.settings?.prePayroll) ?? ppDraft);
      setPpEditing(false);
      showToast("success", L("toast_saved", "Saved"));
    } catch {
      showToast("error", L("prepay_settings_save_error", "No se pudieron guardar las reglas."));
    } finally {
      setPpSaving(false);
    }
  };

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
    const hoursByEmpDate = new Map<string, Record<string, number>>();
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
      const byDate = hoursByEmpDate.get(rosterId) ?? {};
      byDate[e.date] = (byDate[e.date] ?? 0) + h;
      hoursByEmpDate.set(rosterId, byDate);
    }

    const nameById = buildEmployeeNameByClockId(uniqueEmployees, profileToLegacyEmployeeId);
    const ids = viewAllPayroll
      ? [...new Set([...hoursByEmpDate.keys(), ...uniqueEmployees.map((e) => e.id)])]
      : currentUserProfileId
        ? [currentUserProfileId]
        : [];

    return ids.map((empId) => {
      const rate = resolveRateKey(empId);
      const calc = computePrePayrollRow(hoursByEmpDate.get(empId) ?? {}, rate, rule, settings.vacationPayPct);
      return {
        employeeId: empId,
        employeeNumber: profileToLegacyEmployeeId[empId] ?? empId,
        name: nameById.get(empId) ?? empId,
        calc,
        hasRate: calc.rate != null,
        status: statusByEmp[empId] ?? ("draft" as RowStatus),
      };
    });
  }, [
    clockEntries,
    periodBounds,
    uniqueEmployees,
    profileToLegacyEmployeeId,
    viewAllPayroll,
    currentUserProfileId,
    resolveRateKey,
    statusByEmp,
    rosterEmployeeIdForClock,
    rule,
    settings.vacationPayPct,
  ]);

  const exportCsv = () => {
    if (!canExportPayroll) return;
    const head = [
      L("prepay_col_employee_no", "Nº empleado"),
      L("employees", "Empleado"),
      L("timesheet_date_from", "Desde"),
      L("timesheet_date_to", "Hasta"),
      L("prepay_col_regular_hours", "Horas normales"),
      L("prepay_col_ot_hours", "Horas extra"),
      L("prepay_col_rate", "Tarifa"),
      L("prepay_col_regular_pay", "Importe normales"),
      L("prepay_col_ot_pay", "Importe extra"),
      L("prepay_col_vacation", "Vacaciones"),
      L("prepay_col_gross_total", "Bruto total"),
      L("common_status", "Estado"),
    ];
    const lines = [head.map((c) => csvCell(c)).join(",")];
    for (const r of rows) {
      const c = r.calc;
      lines.push(
        [
          r.employeeNumber,
          r.name,
          periodBounds.start,
          periodBounds.end,
          c.regularHours.toFixed(2),
          c.overtimeHours.toFixed(2),
          c.rate != null ? c.rate.toFixed(2) : "",
          c.regularPay.toFixed(2),
          c.overtimePay.toFixed(2),
          c.vacationPay.toFixed(2),
          c.grossTotal.toFixed(2),
          r.status,
        ]
          .map((x) => csvCell(String(x)))
          .join(",")
      );
    }
    const slug = fileSlugCompany(companyName, companyId || "co");
    downloadCsvUtf8(`prenomina_${slug}_${periodBounds.start}_${periodBounds.end}.csv`, lines);
    showToast("success", L("export_success", "Export completed"));
  };

  /** Una fila por persona y concepto (REG / OT / VAC): para importar en Nethris, ADP, Wagepoint, QuickBooks… */
  const exportEarningLines = () => {
    if (!canExportPayroll) return;
    const head = ["employee_number", "employee_name", "period_start", "period_end", "earning_code", "hours", "rate", "amount", "currency"];
    const lines = [head.join(",")];
    for (const r of rows) {
      for (const ln of prePayrollEarningLines({
        employeeNumber: r.employeeNumber,
        employeeName: r.name,
        periodStart: periodBounds.start,
        periodEnd: periodBounds.end,
        row: r.calc,
        multiplier: rule.multiplier,
      })) {
        lines.push(
          [
            ln.employeeNumber,
            ln.employeeName,
            ln.periodStart,
            ln.periodEnd,
            ln.earningCode,
            ln.hours != null ? ln.hours.toFixed(2) : "",
            ln.rate != null ? ln.rate.toFixed(2) : "",
            ln.amount.toFixed(2),
            currency,
          ]
            .map((x) => csvCell(String(x)))
            .join(",")
        );
      }
    }
    const slug = fileSlugCompany(companyName, companyId || "co");
    downloadCsvUtf8(`prenomina_import_${slug}_${periodBounds.start}_${periodBounds.end}.csv`, lines);
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
            regularHours: r.calc.regularHours,
            overtimeHours: r.calc.overtimeHours,
            rate: r.calc.rate,
            regularPay: r.calc.regularPay,
            overtimePay: r.calc.overtimePay,
            vacationPct: r.calc.vacationPct,
            vacationPay: r.calc.vacationPay,
            grossTotal: r.calc.grossTotal,
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
    if (st === "approved" || st === "paid") {
      showToast("success", L("toast_saved", "Saved"));
    }
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
              onClick={() => exportEarningLines()}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 sm:w-auto"
            >
              <Download className="h-4 w-4" />
              {L("prepay_export_import", "Exportar para tu nómina")}
            </button>
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

      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
        <p>
          {L(
            "prepay_note",
            "Pre-nómina: horas aprobadas, horas extra y vacaciones para pasar a tu proveedor de nómina (Nethris, ADP, Wagepoint, QuickBooks o tu gestoría). Impuestos y cotizaciones los calcula tu proveedor con las tablas oficiales."
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            {L("prepay_rule_weekly", "Extra a partir de")} <strong>{settings.weeklyOtThreshold} h/{L("prepay_week", "semana")}</strong>
          </span>
          {settings.dailyOtThreshold > 0 ? (
            <span>
              {L("prepay_rule_daily", "o de")} <strong>{settings.dailyOtThreshold} h/{L("prepay_day", "día")}</strong>
            </span>
          ) : null}
          <span>
            {L("prepay_rule_multiplier", "Pago extra")} <strong>×{settings.otMultiplier}</strong>
          </span>
          <span>
            {L("prepay_rule_vacation", "Vacaciones")} <strong>{settings.vacationPayPct}%</strong>
          </span>
          {canManagePayroll ? (
            <button
              type="button"
              onClick={() => {
                setPpDraft(settings);
                setPpEditing((v) => !v);
              }}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-amber-400 px-2 font-medium hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/30"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              {L("prepay_rules_edit", "Cambiar reglas")}
            </button>
          ) : null}
        </div>
        {ppEditing && ppDraft ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["weeklyOtThreshold", L("prepay_field_weekly", "Extra desde (h/semana, 0 = no)"), 0, 168, 1],
                ["dailyOtThreshold", L("prepay_field_daily", "Extra desde (h/día, 0 = no)"), 0, 24, 0.5],
                ["otMultiplier", L("prepay_field_multiplier", "Multiplicador extra"), 1, 3, 0.25],
                ["vacationPayPct", L("prepay_field_vacation", "% vacaciones por nómina"), 0, 20, 0.5],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key} className="block text-[11px] font-medium">
                {label}
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={ppDraft[key]}
                  onChange={(e) => setPpDraft({ ...ppDraft, [key]: Number(e.target.value) })}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-100"
                />
              </label>
            ))}
            <div className="col-span-2 flex gap-2 sm:col-span-4">
              <button
                type="button"
                onClick={() => void savePpSettings()}
                disabled={ppSaving}
                className="min-h-[40px] rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {ppSaving ? "…" : L("save", "Guardar")}
              </button>
              <button
                type="button"
                onClick={() => setPpEditing(false)}
                className="min-h-[40px] rounded-lg border border-zinc-300 px-4 text-sm dark:border-slate-600"
              >
                {L("cancel", "Cancelar")}
              </button>
            </div>
            <p className="col-span-2 sm:col-span-4">
              {L(
                "prepay_rules_hint",
                "Depende de tu provincia o convenio: Ontario 44 h/semana; Quebec y la mayoría de EE. UU. 40 h/semana; Alberta y BC también 8 h/día. Vacaciones en Canadá: 4 % (6 % con 5 años o más en muchas provincias)."
              )}
            </p>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-700">
        <table className="w-full min-w-[340px] text-sm md:min-w-[720px]">
          <thead className="bg-zinc-50 dark:bg-slate-800/80 text-left text-zinc-600 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-3 font-medium w-10" />
              <th className="px-3 py-3 font-medium">{L("employees", "Empleados")}</th>
              <th className="px-3 py-3 font-medium text-right">{L("prepay_col_regular_hours", "Horas normales")}</th>
              <th className="px-3 py-3 font-medium text-right">{L("prepay_col_ot_hours", "Horas extra")}</th>
              <th className="hidden px-3 py-3 font-medium text-right sm:table-cell">{L("prepay_col_vacation", "Vacaciones")}</th>
              <th className="px-3 py-3 font-medium text-right">{L("prepay_col_gross_total", "Bruto total")}</th>
              <th className="px-3 py-3 font-medium">{L("common_status", "Estado")}</th>
              {canManagePayroll ? (
                <th className="px-3 py-3 font-medium">{L("common_actions", "Acciones")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
            {rows.map((r) => {
              const open = expanded[r.employeeId];
              const c = r.calc;
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
                    <td className="px-3 py-2 text-right tabular-nums">{c.regularHours.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.overtimeHours > 0 ? c.overtimeHours.toFixed(1) : "—"}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                      {r.hasRate && c.vacationPay > 0 ? c.vacationPay.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {r.hasRate ? `${currency} ${c.grossTotal.toFixed(2)}` : "—"}
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
                        {c.rate != null ? (
                          <ul className="space-y-1">
                            <li className="flex justify-between gap-4">
                              <span>
                                {L("prepay_col_regular_hours", "Horas normales")}: {c.regularHours.toFixed(2)} × {currency} {c.rate.toFixed(2)}
                              </span>
                              <span className="tabular-nums">{c.regularPay.toFixed(2)}</span>
                            </li>
                            {c.overtimeHours > 0 ? (
                              <li className="flex justify-between gap-4">
                                <span>
                                  {L("prepay_col_ot_hours", "Horas extra")}: {c.overtimeHours.toFixed(2)} × {currency}{" "}
                                  {(c.rate * rule.multiplier).toFixed(2)}
                                </span>
                                <span className="tabular-nums">{c.overtimePay.toFixed(2)}</span>
                              </li>
                            ) : null}
                            {c.vacationPay > 0 ? (
                              <li className="flex justify-between gap-4">
                                <span>
                                  {L("prepay_col_vacation", "Vacaciones")} ({c.vacationPct}%)
                                </span>
                                <span className="tabular-nums">{c.vacationPay.toFixed(2)}</span>
                              </li>
                            ) : null}
                            <li className="flex justify-between gap-4 font-semibold text-zinc-800 dark:text-zinc-200">
                              <span>{L("prepay_col_gross_total", "Bruto total")}</span>
                              <span className="tabular-nums">
                                {currency} {c.grossTotal.toFixed(2)}
                              </span>
                            </li>
                          </ul>
                        ) : (
                          <p>{L("prepay_no_rate", "Sin tarifa configurada para esta persona: ponla en su ficha de empleado.")}</p>
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
    </div>
  );
}
