"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, Plus, Users } from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  MACHINPRO_WORK_CATALOG_ALL,
  type MachinProCatalogSeedRow,
} from "@/lib/machinproWorkCatalogSeed";
import { weekYmdsMondayFirstInTimeZone } from "@/lib/dateUtils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type WorkOrderItemApi = {
  id: string;
  name: string;
  unit: string;
  price_per_unit: number;
  category: string | null;
  assigned_employee_ids: string[] | null;
};

type CatalogRow = { id: string; name: string; unit: string; price_per_unit: number | null };

type Props = {
  labels: Record<string, string>;
  companyId: string;
  projectId: string;
  projectName: string;
  companyName: string;
  accessToken: string;
  timeZone: string;
  companyCurrency: string;
  employees: { id: string; name: string }[];
  canManage: boolean;
};

const L = (d: Record<string, string>, k: string, fb: string) => d[k] ?? fb;

export function ProjectWorkOrdersPanel({
  labels: t,
  companyId,
  projectId,
  projectName,
  companyName,
  accessToken,
  timeZone,
  companyCurrency,
  employees,
  canManage,
}: Props) {
  const tl = t as Record<string, string>;
  const { showToast } = useToast();
  const [items, setItems] = useState<WorkOrderItemApi[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [prodRows, setProdRows] = useState<
    { date: string; work_order_item_id: string; name: string; unit: string; units: number; amount: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<"mine" | "machinpro">("mine");
  const [pickCatalog, setPickCatalog] = useState<Record<string, boolean>>({});
  const [pickMachin, setPickMachin] = useState<Record<string, boolean>>({});
  const [pricesCatalog, setPricesCatalog] = useState<Record<string, string>>({});
  const [pricesMachin, setPricesMachin] = useState<Record<string, string>>({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"list" | "week">("list");
  const [assignItem, setAssignItem] = useState<WorkOrderItemApi | null>(null);
  const [assignPick, setAssignPick] = useState<Record<string, boolean>>({});
  const [prodBreakdown, setProdBreakdown] = useState<
    {
      date: string;
      work_order_item_id: string;
      employee_id: string;
      employee_name: string;
      units: number;
      amount: number;
    }[]
  >([]);
  const [cellPopover, setCellPopover] = useState<{
    itemId: string;
    date: string;
    conceptName: string;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async () => {
    if (!projectId || !accessToken) return;
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}/work-orders`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`/api/work-catalog?companyId=${encodeURIComponent(companyId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/production?breakdown=true`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      const j1 = (await r1.json()) as { items?: WorkOrderItemApi[] };
      const j2 = (await r2.json()) as { items?: CatalogRow[] };
      const j3 = (await r3.json()) as {
        rows?: {
          date: string;
          work_order_item_id: string;
          name: string;
          unit: string;
          units: number;
          amount: number;
        }[];
        breakdown?: {
          date: string;
          work_order_item_id: string;
          employee_id: string;
          employee_name: string;
          units: number;
          amount: number;
        }[];
      };
      if (r1.ok) setItems(j1.items ?? []);
      if (r2.ok) setCatalog(j2.items ?? []);
      if (r3.ok) {
        setProdRows(j3.rows ?? []);
        setProdBreakdown(j3.breakdown ?? []);
      }
    } catch {
      showToast("error", tl.toast_error ?? "Error");
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, projectId, showToast, tl.toast_error]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!cellPopover) return;
    const close = (ev: MouseEvent) => {
      const el = popoverRef.current;
      if (el && !el.contains(ev.target as Node)) setCellPopover(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [cellPopover]);

  useEffect(() => {
    if (!cellPopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCellPopover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cellPopover]);

  const weekDays = useMemo(() => weekYmdsMondayFirstInTimeZone(timeZone, weekOffset), [timeZone, weekOffset]);

  const breakByCell = useMemo(() => {
    const m = new Map<
      string,
      { employee_id: string; employee_name: string; units: number; amount: number }[]
    >();
    for (const b of prodBreakdown) {
      const k = `${b.work_order_item_id}|${b.date}`;
      if (!m.has(k)) m.set(k, []);
      const arr = m.get(k)!;
      const amt = typeof b.amount === "number" && Number.isFinite(b.amount) ? b.amount : 0;
      const idx = arr.findIndex((x) => x.employee_id === b.employee_id);
      if (idx >= 0) {
        arr[idx] = {
          ...arr[idx],
          units: arr[idx].units + b.units,
          amount: arr[idx].amount + amt,
        };
      } else {
        arr.push({
          employee_id: b.employee_id,
          employee_name: b.employee_name,
          units: b.units,
          amount: amt,
        });
      }
    }
    return m;
  }, [prodBreakdown]);

  const prodByItemDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of prodRows) {
      m.set(`${r.work_order_item_id}|${r.date}`, r.units);
    }
    return m;
  }, [prodRows]);

  const amountByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of prodRows) {
      m.set(r.work_order_item_id, (m.get(r.work_order_item_id) ?? 0) + r.amount);
    }
    return m;
  }, [prodRows]);

  const weekTotalsByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of prodRows) {
      if (!weekDays.includes(r.date)) continue;
      m.set(r.work_order_item_id, (m.get(r.work_order_item_id) ?? 0) + r.amount);
    }
    return m;
  }, [prodRows, weekDays]);

  const grouped = useMemo(() => {
    const m = new Map<string, WorkOrderItemApi[]>();
    for (const it of items) {
      const k = it.category?.trim() || L(tl, "work_catalog_uncategorized", "Other");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items, tl]);

  const machinCatalogByCategory = useMemo(() => {
    const m = new Map<string, MachinProCatalogSeedRow[]>();
    for (const row of MACHINPRO_WORK_CATALOG_ALL) {
      if (!m.has(row.categoryKey)) m.set(row.categoryKey, []);
      m.get(row.categoryKey)!.push(row);
    }
    return [...m.entries()];
  }, []);

  const weekTotalAll = useMemo(() => {
    let s = 0;
    for (const id of items.map((i) => i.id)) {
      s += weekTotalsByItem.get(id) ?? 0;
    }
    return s;
  }, [items, weekTotalsByItem]);

  const accTotalAll = useMemo(() => {
    let s = 0;
    for (const it of items) {
      s += amountByItem.get(it.id) ?? 0;
    }
    return s;
  }, [items, amountByItem]);

  const importConfirm = async () => {
    const toPost: { name: string; unit: string; price: number; catalog_item_id?: string }[] = [];
    if (importTab === "mine") {
      for (const c of catalog) {
        if (!pickCatalog[c.id]) continue;
        const raw = pricesCatalog[c.id]?.trim();
        const price =
          raw && Number.isFinite(Number(raw.replace(",", ".")))
            ? Number(raw.replace(",", "."))
            : Number(c.price_per_unit ?? 0);
        toPost.push({
          name: c.name,
          unit: c.unit,
          price: Number.isFinite(price) ? price : 0,
          catalog_item_id: c.id,
        });
      }
    } else {
      for (const row of MACHINPRO_WORK_CATALOG_ALL) {
        if (!pickMachin[row.nameKey]) continue;
        const name = L(tl, row.nameKey, row.nameKey);
        const raw = pricesMachin[row.nameKey]?.trim();
        const price =
          raw && Number.isFinite(Number(raw.replace(",", ".")))
            ? Number(raw.replace(",", "."))
            : 0;
        toPost.push({ name, unit: row.unit, price });
      }
    }
    if (toPost.length === 0) {
      showToast("error", tl.toast_error ?? "Error");
      return;
    }
    for (const row of toPost) {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/work-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: row.name,
          unit: row.unit,
          price_per_unit: row.price,
          category: null,
          catalog_item_id: row.catalog_item_id ?? null,
        }),
      });
      if (res.status === 409) continue;
      if (!res.ok) {
        showToast("error", tl.toast_error ?? "Error");
        return;
      }
    }
    showToast("success", tl.toast_saved ?? "Saved");
    setImportOpen(false);
    setPickCatalog({});
    setPickMachin({});
    setPricesCatalog({});
    setPricesMachin({});
    await reload();
  };

  const saveAssign = async () => {
    if (!assignItem) return;
    const ids = employees.filter((e) => assignPick[e.id]).map((e) => e.id);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/work-orders/${encodeURIComponent(assignItem.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ assigned_employee_ids: ids }),
        }
      );
      if (!res.ok) throw new Error();
      showToast("success", tl.toast_saved ?? "Saved");
      setAssignItem(null);
      setAssignPick({});
      await reload();
    } catch {
      showToast("error", tl.toast_error ?? "Error");
    }
  };

  const exportWeekPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    let y = 12;
    doc.setFontSize(14);
    doc.text(`${companyName} · ${projectName}`, 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`${L(tl, "work_order_week_pdf", "Week")}: ${weekDays[0]} → ${weekDays[6]}`, 14, y);
    y += 10;
    const wk = L(tl, "work_order_week_total_col", "Week $");
    const acc = L(tl, "work_order_acc_total", "Acc. $");
    const head = [L(tl, "work_catalog_name", "Concept"), ...weekDays.map((d) => d.slice(5)), wk, acc];
    const body: string[][] = [];
    for (const it of items) {
      const row: string[] = [it.name];
      for (const d of weekDays) {
        const u = prodByItemDate.get(`${it.id}|${d}`) ?? 0;
        row.push(String(u));
      }
      row.push((weekTotalsByItem.get(it.id) ?? 0).toFixed(2));
      row.push((amountByItem.get(it.id) ?? 0).toFixed(2));
      body.push(row);
    }
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      styles: { fontSize: 8 },
    });
    doc.save(`work_orders_week_${projectId}_${weekDays[0]}.pdf`);
  };

  const exportWeekXlsx = () => {
    const wk = L(tl, "work_order_week_total_col", "Week $");
    const acc = L(tl, "work_order_acc_total", "Acc. $");
    const header = [L(tl, "work_catalog_name", "Concept"), ...weekDays, wk, acc];
    const rows: (string | number)[][] = [header];
    for (const it of items) {
      const row: (string | number)[] = [it.name];
      for (const d of weekDays) {
        row.push(prodByItemDate.get(`${it.id}|${d}`) ?? 0);
      }
      row.push(weekTotalsByItem.get(it.id) ?? 0);
      row.push(amountByItem.get(it.id) ?? 0);
      rows.push(row);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Week");
    XLSX.writeFile(wb, `work_orders_week_${projectId}_${weekDays[0]}.xlsx`);
  };

  const monShort = (d: string) => d.slice(5);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
          {tl.work_order_title ?? "Work order"}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView((v) => (v === "list" ? "week" : "list"))}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-600"
          >
            {view === "list"
              ? L(tl, "work_order_view_weekly", L(tl, "work_order_view_week", "Weekly view"))
              : L(tl, "work_order_view_list", "List view")}
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={() => {
                setImportTab("mine");
                setPickCatalog({});
                setPickMachin({});
                setImportOpen(true);
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-500/80 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <Plus className="h-4 w-4" />
              {tl.work_order_import ?? "Import"}
            </button>
          ) : null}
          {view === "week" ? (
            <>
              <button
                type="button"
                onClick={exportWeekPdf}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-600"
              >
                <FileDown className="h-4 w-4" />
                {tl.work_order_export_pdf ?? "PDF"}
              </button>
              <button
                type="button"
                onClick={exportWeekXlsx}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-600"
              >
                <FileDown className="h-4 w-4" />
                {tl.work_order_export_excel ?? "Excel"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {view === "week" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] rounded-lg border border-zinc-200 dark:border-slate-600"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label="prev"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] rounded-lg border border-zinc-200 dark:border-slate-600"
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label="next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">{tl.billing_loading ?? ""}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">{tl.work_order_no_items ?? tl.work_order_empty ?? ""}</p>
      ) : view === "list" ? (
        <div className="space-y-4">
          {grouped.map(([cat, rows]) => (
            <div key={cat} className="rounded-xl border border-zinc-200 dark:border-slate-700">
              <div className="border-b border-zinc-100 px-3 py-2 text-sm font-semibold dark:border-slate-700">
                {cat}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-slate-800 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">{tl.work_catalog_name ?? ""}</th>
                      <th className="px-3 py-2">{tl.work_catalog_unit ?? ""}</th>
                      <th className="px-3 py-2 text-right">{tl.production_catalog_sell_price ?? ""}</th>
                      <th className="px-3 py-2">{tl.work_order_assigned ?? "Assigned"}</th>
                      <th className="px-3 py-2 text-right">{tl.work_order_total_acc ?? "Total $"}</th>
                      {canManage ? <th className="px-3 py-2 w-24" /> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
                    {rows.map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 font-medium">{it.name}</td>
                        <td className="px-3 py-2">
                          {(tl[`production_unit_${it.unit}` as keyof typeof tl] as string) || it.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {companyCurrency} {Number(it.price_per_unit).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {(it.assigned_employee_ids ?? [])
                            .map((id) => employees.find((e) => e.id === id)?.name ?? id.slice(0, 6))
                            .join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {companyCurrency} {(amountByItem.get(it.id) ?? 0).toFixed(2)}
                        </td>
                        {canManage ? (
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                const next: Record<string, boolean> = {};
                                for (const e of employees) {
                                  next[e.id] = (it.assigned_employee_ids ?? []).includes(e.id);
                                }
                                setAssignPick(next);
                                setAssignItem(it);
                              }}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-600"
                              aria-label={
                                L(tl, "work_order_assign_employees", tl.work_order_assign ?? "")
                              }
                            >
                              <Users className="h-4 w-4" />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {tl.work_order_week_total ?? "This week"}: {companyCurrency} {weekTotalAll.toFixed(2)} ·{" "}
            {tl.work_order_accumulated ?? tl.work_order_acc_total ?? "Accumulated"}: {companyCurrency}{" "}
            {accTotalAll.toFixed(2)}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-700">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-slate-800 dark:text-zinc-400">
              <tr>
                <th className="px-2 py-2">{tl.work_catalog_name ?? ""}</th>
                {weekDays.map((d) => (
                  <th key={d} className="px-2 py-2 text-center">
                    {monShort(d)}
                  </th>
                ))}
                <th className="px-2 py-2 text-right">{tl.work_order_week_total_col ?? ""}</th>
                <th className="px-2 py-2 text-right">{tl.work_order_acc_total ?? ""}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-2 py-2 font-medium">{it.name}</td>
                  {weekDays.map((d) => {
                    const u = prodByItemDate.get(`${it.id}|${d}`) ?? 0;
                    const br = breakByCell.get(`${it.id}|${d}`) ?? [];
                    const titleAttr =
                      u > 0
                        ? br.length === 1
                          ? `${br[0].employee_name}: ${br[0].units} · ${companyCurrency} ${br[0].amount.toFixed(2)}`
                          : br.length > 1
                            ? `${u} · ${br.length} ${L(tl, "work_order_assign_employees", tl.work_order_assigned ?? "")}`
                            : String(u)
                        : undefined;
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        <button
                          type="button"
                          title={titleAttr}
                          className="min-h-[44px] min-w-[44px] w-full rounded-lg border border-transparent px-1 tabular-nums text-zinc-900 hover:border-amber-400/60 hover:bg-amber-50/80 dark:text-zinc-100 dark:hover:bg-amber-950/30"
                          onClick={() => {
                            if (u <= 0) return;
                            if (br.length <= 1) return;
                            setCellPopover({ itemId: it.id, date: d, conceptName: it.name });
                          }}
                        >
                          {u}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right tabular-nums">
                    {companyCurrency} {(weekTotalsByItem.get(it.id) ?? 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {companyCurrency} {(amountByItem.get(it.id) ?? 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cellPopover ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setCellPopover(null)}
        >
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{cellPopover.conceptName}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{cellPopover.date}</p>
            <ul className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto">
              {(breakByCell.get(`${cellPopover.itemId}|${cellPopover.date}`) ?? []).map((row, idx) => (
                <li
                  key={`${row.employee_id}-${idx}`}
                  className="flex justify-between gap-2 text-sm text-zinc-800 dark:text-zinc-200"
                >
                  <span className="min-w-0 truncate">{row.employee_name}</span>
                  <span className="shrink-0 text-right tabular-nums font-medium">
                    {row.units} · {companyCurrency}
                    {row.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between gap-2 border-t border-zinc-200 pt-2 text-sm font-semibold text-zinc-900 dark:border-slate-700 dark:text-white">
              <span>{tl.production_accumulated ?? tl.work_order_accumulated ?? "Total"}</span>
              <span className="tabular-nums">
                {companyCurrency}
                {(breakByCell.get(`${cellPopover.itemId}|${cellPopover.date}`) ?? [])
                  .reduce((s, r) => s + r.amount, 0)
                  .toFixed(2)}
              </span>
            </p>
            <button
              type="button"
              className="mt-4 min-h-[44px] w-full rounded-lg border border-zinc-300 text-sm text-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              onClick={() => setCellPopover(null)}
            >
              {tl.cancel ?? "Close"}
            </button>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex gap-2 border-b border-zinc-200 pb-2 dark:border-slate-700">
              <button
                type="button"
                className={`min-h-[44px] rounded-lg px-3 text-sm font-medium ${importTab === "mine" ? "bg-amber-100 dark:bg-amber-900/40" : ""}`}
                onClick={() => setImportTab("mine")}
              >
                {L(tl, "work_order_import_tab_own", L(tl, "work_order_import_tab_mine", "My catalog"))}
              </button>
              <button
                type="button"
                className={`min-h-[44px] rounded-lg px-3 text-sm font-medium ${importTab === "machinpro" ? "bg-amber-100 dark:bg-amber-900/40" : ""}`}
                onClick={() => setImportTab("machinpro")}
              >
                {tl.work_order_import_tab_machinpro ?? "MachinPro"}
              </button>
            </div>
            {importTab === "mine" ? (
              catalog.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{tl.work_order_import_empty ?? ""}</p>
              ) : (
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                {catalog.map((c) => (
                  <li key={c.id} className="rounded-lg border border-zinc-100 p-2 dark:border-slate-700 space-y-2">
                    <label className="flex min-h-[44px] items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!pickCatalog[c.id]}
                        onChange={(e) => setPickCatalog((p) => ({ ...p, [c.id]: e.target.checked }))}
                        className="h-5 w-5"
                      />
                      <span className="text-sm">{c.name}</span>
                    </label>
                    {pickCatalog[c.id] ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={String(c.price_per_unit ?? "")}
                        value={pricesCatalog[c.id] ?? ""}
                        onChange={(e) => setPricesCatalog((p) => ({ ...p, [c.id]: e.target.value }))}
                        className="w-full min-h-[44px] rounded border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
              )
            ) : (
              <ul className="max-h-[50vh] space-y-4 overflow-y-auto">
                {machinCatalogByCategory.map(([catKey, rows]) => (
                  <li key={catKey} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {L(tl, catKey, catKey)}
                    </p>
                    <ul className="space-y-2">
                      {rows.map((row) => {
                        const label = L(tl, row.nameKey, row.nameKey);
                        return (
                          <li
                            key={row.nameKey}
                            className="space-y-2 rounded-lg border border-zinc-100 p-2 dark:border-slate-700"
                          >
                            <label className="flex min-h-[44px] items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!pickMachin[row.nameKey]}
                                onChange={(e) =>
                                  setPickMachin((p) => ({ ...p, [row.nameKey]: e.target.checked }))
                                }
                                className="h-5 w-5"
                              />
                              <span className="text-sm">{label}</span>
                            </label>
                            {pickMachin[row.nameKey] ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={pricesMachin[row.nameKey] ?? ""}
                                onChange={(e) =>
                                  setPricesMachin((p) => ({ ...p, [row.nameKey]: e.target.value }))
                                }
                                className="w-full min-h-[44px] rounded border border-zinc-300 px-2 dark:border-zinc-600 dark:bg-slate-800"
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void importConfirm()}
                className="min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white"
              >
                {tl.save ?? "Save"}
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="min-h-[44px] rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                {tl.cancel ?? "Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assignItem ? (
        <div className="fixed inset-0 z-[76] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h4 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-white">
              {tl.work_order_assign ?? "Assign"}
            </h4>
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
              {employees.map((e) => (
                <li key={e.id}>
                  <label className="flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-100 px-2 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={!!assignPick[e.id]}
                      onChange={(ev) =>
                        setAssignPick((p) => ({ ...p, [e.id]: ev.target.checked }))
                      }
                      className="h-5 w-5"
                    />
                    <span className="text-sm">{e.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void saveAssign()}
                className="min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm text-white"
              >
                {tl.save ?? ""}
              </button>
              <button
                type="button"
                onClick={() => setAssignItem(null)}
                className="min-h-[44px] rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                {tl.cancel ?? ""}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
