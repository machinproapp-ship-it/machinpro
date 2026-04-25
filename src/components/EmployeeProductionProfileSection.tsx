"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  date: string;
  units: number;
  amount: number | null;
  concept_name?: string;
  concept_unit?: string;
};

type Props = {
  labels: Record<string, string>;
  companyId: string;
  employeeId: string;
  accessToken: string;
  currency: string;
  dateLocale: string;
  timeZone: string; // reserved for future date formatting
};

export function EmployeeProductionProfileSection({
  labels: tl,
  companyId,
  employeeId,
  accessToken,
  currency,
  dateLocale,
  timeZone: _timeZone,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/production/for-employee?companyId=${encodeURIComponent(companyId)}&employeeId=${encodeURIComponent(employeeId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const j = (await res.json()) as { entries?: Row[]; monthTotal?: number };
      if (res.ok) {
        setRows(j.entries ?? []);
        setMonthTotal(Number(j.monthTotal) || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const weekStart = (d: string) => {
    const x = new Date(d + "T12:00:00");
    const dow = x.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    x.setDate(x.getDate() + diff);
    return x.toISOString().slice(0, 10);
  };

  if (loading) {
    return <p className="text-sm text-zinc-500">{(tl as Record<string, string>).billing_loading ?? ""}</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {(tl as Record<string, string>).employee_production_empty ?? ""}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
        {(tl as Record<string, string>).employee_production_month_total ?? ""}: {currency}{" "}
        {monthTotal.toFixed(2)}
      </p>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-slate-700">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-slate-800 dark:text-zinc-400">
            <tr>
              <th className="px-2 py-2">{(tl as Record<string, string>).work_order_week_pdf ?? "Week"}</th>
              <th className="px-2 py-2">{(tl as Record<string, string>).work_catalog_name ?? ""}</th>
              <th className="px-2 py-2 text-right">{(tl as Record<string, string>).production_report_units ?? ""}</th>
              <th className="px-2 py-2 text-right">{(tl as Record<string, string>).timesheet_production_total_usd ?? ""}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-2 tabular-nums">{weekStart(r.date)}</td>
                <td className="px-2 py-2">{r.concept_name ?? "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.units}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {currency} {Number(r.amount ?? 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
