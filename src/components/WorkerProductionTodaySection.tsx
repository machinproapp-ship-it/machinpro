"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatTodayYmdInTimeZone } from "@/lib/dateUtils";
import { useToast } from "@/components/Toast";

type Assignment = {
  id: string;
  project_id: string;
  name: string;
  unit: string;
  price_per_unit: number;
};

type TodayEntry = {
  work_order_item_id: string;
  units: number;
};

type HistRow = {
  date: string;
  units: number;
  amount: number | null;
  concept_name?: string;
  concept_unit?: string;
};

const L = (lx: Record<string, string>, k: string, fb: string) => lx[k] ?? fb;

type Props = {
  labels: Record<string, string>;
  companyId: string;
  accessToken: string;
  timeZone: string;
  companyCurrency: string;
};

export function WorkerProductionTodaySection({
  labels: lx,
  companyId,
  accessToken,
  timeZone,
  companyCurrency,
}: Props) {
  const tl = lx as Record<string, string>;
  const { showToast } = useToast();
  const todayYmd = useMemo(() => formatTodayYmdInTimeZone(timeZone), [timeZone]);
  const [lines, setLines] = useState<Assignment[]>([]);
  const [unitsDraft, setUnitsDraft] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId || !accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const h = { Authorization: `Bearer ${accessToken}` };
      const [rA, rT, rH] = await Promise.all([
        fetch(`/api/production/assignments?companyId=${encodeURIComponent(companyId)}`, { headers: h }),
        fetch(
          `/api/production/today?companyId=${encodeURIComponent(companyId)}&date=${encodeURIComponent(todayYmd)}`,
          { headers: h }
        ),
        fetch(`/api/production/history?companyId=${encodeURIComponent(companyId)}`, { headers: h }),
      ]);
      const jA = (await rA.json()) as { items?: Assignment[] };
      const jT = (await rT.json()) as { entries?: (TodayEntry & { units: string | number })[] };
      const jH = (await rH.json()) as { entries?: HistRow[] };
      const items = rA.ok ? jA.items ?? [] : [];
      setLines(items);
      const nextDraft: Record<string, string> = {};
      const ent = rT.ok ? jT.entries ?? [] : [];
      for (const it of items) {
        const hit = ent.find((e) => e.work_order_item_id === it.id);
        const u = hit ? Number(hit.units) : 0;
        nextDraft[it.id] = u > 0 ? String(u) : "";
      }
      setUnitsDraft(nextDraft);
      if (rH.ok) setHistory(jH.entries ?? []);
    } catch {
      showToast("error", tl.toast_error ?? "Error");
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, showToast, tl.toast_error, todayYmd]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalToday = useMemo(() => {
    let s = 0;
    for (const l of lines) {
      const raw = (unitsDraft[l.id] ?? "").trim().replace(",", ".");
      const u = raw === "" ? 0 : Number(raw);
      if (!Number.isFinite(u) || u <= 0) continue;
      s += u * Number(l.price_per_unit ?? 0);
    }
    return s;
  }, [lines, unitsDraft]);

  const weekTotal = useMemo(() => {
    const start = new Date();
    const dow = start.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    start.setDate(start.getDate() + diff);
    const ys = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const ws = ys(start);
    let s = 0;
    for (const h of history) {
      if (h.date >= ws) s += Number(h.amount) || 0;
    }
    return s;
  }, [history]);

  const save = async () => {
    if (!accessToken) return;
    setSaving(true);
    try {
      for (const l of lines) {
        const raw = (unitsDraft[l.id] ?? "").trim().replace(",", ".");
        const u = raw === "" ? 0 : Number(raw);
        if (!Number.isFinite(u) || u <= 0) continue;
        const res = await fetch("/api/production", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            companyId,
            work_order_item_id: l.id,
            project_id: l.project_id,
            date: todayYmd,
            units: u,
          }),
        });
        if (!res.ok) {
          showToast("error", tl.toast_error ?? "Error");
          return;
        }
      }
      showToast("success", tl.production_saved_toast ?? tl.toast_saved ?? "OK");
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{tl.billing_loading ?? ""}</p>;
  }

  if (lines.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {tl.production_today_placeholder ?? ""}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-900/80">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 dark:text-white">{l.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {(tl[
                    (l.unit === "hours" ? "production_unit_hours" : `production_unit_${l.unit}`) as keyof typeof tl
                  ] as string) || l.unit}{" "}
                  ·{" "}
                  {companyCurrency} {Number(l.price_per_unit).toFixed(2)}
                </p>
              </div>
              <label className="block w-full sm:w-36">
                <span className="sr-only">{tl.production_report_units ?? ""}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={unitsDraft[l.id] ?? ""}
                  onChange={(e) => setUnitsDraft((p) => ({ ...p, [l.id]: e.target.value }))}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-300 px-2 text-sm tabular-nums dark:border-zinc-600 dark:bg-slate-800"
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          {tl.production_report_total ?? "Total"}: {companyCurrency} {totalToday.toFixed(2)}
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="min-h-[44px] rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {tl.production_save ?? tl.production_save_button ?? tl.save ?? "Save"}
        </button>
      </div>
      {history.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-slate-600">
          <h5 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {tl.production_history ?? tl.production_history_title ?? ""}
          </h5>
          <ul className="mt-2 max-h-[220px] space-y-2 overflow-y-auto text-sm">
            {history.map((h, idx) => (
              <li key={`${h.date}-${idx}-${h.concept_name ?? ""}`} className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                  {h.date} · {h.concept_name ?? "—"}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-900 dark:text-white">
                  {h.units} · {companyCurrency} {Number(h.amount ?? 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {tl.production_weekly_total ?? tl.production_week_total ?? ""}: {companyCurrency}{" "}
            {weekTotal.toFixed(2)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
