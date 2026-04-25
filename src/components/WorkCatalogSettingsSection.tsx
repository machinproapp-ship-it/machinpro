"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Factory } from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  MACHINPRO_WORK_CATALOG_ALUMINUM,
  MACHINPRO_WORK_CATALOG_CLADDING,
  MACHINPRO_WORK_CATALOG_FINISHING,
  MACHINPRO_WORK_CATALOG_PREP,
  MACHINPRO_WORK_CATALOG_STRUCTURE,
  MACHINPRO_WORK_CATALOG_ALL,
  WORK_CATALOG_UNIT_OPTIONS,
  type WorkCatalogUnitOption,
  type MachinProCatalogSeedRow,
} from "@/lib/machinproWorkCatalogSeed";

export type WorkCatalogRow = {
  id: string;
  name: string;
  unit: string;
  price_per_unit: number | null;
  category: string | null;
};

type Props = {
  labels: Record<string, string>;
  companyId: string;
  accessToken: string;
};

const L = (d: Record<string, string>, k: string, fb: string) => d[k] ?? fb;

export function WorkCatalogSettingsSection({ labels: t, companyId, accessToken }: Props) {
  const tl = t as Record<string, string>;
  const { showToast } = useToast();
  const [items, setItems] = useState<WorkCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | { mode: "new" | "edit"; row?: WorkCatalogRow }>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftUnit, setDraftUnit] = useState<WorkCatalogUnitOption>("sq_ft");
  const [draftPrice, setDraftPrice] = useState("");
  const [importPick, setImportPick] = useState<Record<string, boolean>>({});
  const [importPrices, setImportPrices] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    if (!companyId || !accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/work-catalog?companyId=${encodeURIComponent(companyId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const j = (await res.json()) as { items?: WorkCatalogRow[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? "err");
      setItems(j.items ?? []);
    } catch {
      showToast("error", tl.toast_error ?? "Error");
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, showToast, tl.toast_error]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!modal && !importOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setImportOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, importOpen]);

  const importCatalogGroups: readonly (readonly [string, MachinProCatalogSeedRow[]])[] = useMemo(
    () =>
      [
        ["al", MACHINPRO_WORK_CATALOG_ALUMINUM],
        ["cl", MACHINPRO_WORK_CATALOG_CLADDING],
        ["pr", MACHINPRO_WORK_CATALOG_PREP],
        ["fi", MACHINPRO_WORK_CATALOG_FINISHING],
        ["st", MACHINPRO_WORK_CATALOG_STRUCTURE],
      ] as const,
    []
  );

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      if (it.category?.trim()) s.add(it.category.trim());
    }
    return [...s].sort();
  }, [items]);

  const existingNameLower = useMemo(
    () => new Set(items.map((x) => x.name.trim().toLowerCase())),
    [items]
  );

  const grouped = useMemo(() => {
    const m = new Map<string, WorkCatalogRow[]>();
    for (const it of items) {
      const k = it.category?.trim() || L(tl, "work_catalog_uncategorized", "Other");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items, tl]);

  const openNew = () => {
    setDraftName("");
    setDraftCategory("");
    setDraftUnit("sq_ft");
    setDraftPrice("");
    setModal({ mode: "new" });
  };

  const openEdit = (row: WorkCatalogRow) => {
    setDraftName(row.name);
    setDraftCategory(row.category ?? "");
    setDraftUnit((WORK_CATALOG_UNIT_OPTIONS.includes(row.unit as WorkCatalogUnitOption) ? row.unit : "sq_ft") as WorkCatalogUnitOption);
    setDraftPrice(row.price_per_unit != null ? String(row.price_per_unit) : "");
    setModal({ mode: "edit", row });
  };

  const saveModal = async () => {
    const name = draftName.trim();
    if (!name) {
      showToast("error", L(tl, "work_catalog_name", "Name"));
      return;
    }
    const priceRaw = draftPrice.trim();
    const price =
      priceRaw === "" ? null : Number.isFinite(Number(priceRaw.replace(",", ".")))
        ? Number(priceRaw.replace(",", "."))
        : null;
    try {
      if (modal?.mode === "new") {
        const res = await fetch("/api/work-catalog", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            companyId,
            name,
            unit: draftUnit,
            category: draftCategory.trim() || null,
            price_per_unit: price,
          }),
        });
        const j = (await res.json()) as { error?: string };
        if (res.status === 409) {
          showToast("error", tl.work_catalog_duplicate ?? "");
          return;
        }
        if (!res.ok) throw new Error(j.error ?? "err");
      } else if (modal?.mode === "edit" && modal.row) {
        const res = await fetch(`/api/work-catalog/${encodeURIComponent(modal.row.id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            companyId,
            name,
            unit: draftUnit,
            category: draftCategory.trim() || null,
            price_per_unit: price,
          }),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "err");
      }
      showToast("success", tl.toast_saved ?? "Saved");
      setModal(null);
      await reload();
    } catch {
      showToast("error", tl.toast_error ?? "Error");
    }
  };

  const softDelete = async (id: string) => {
    if (!window.confirm(tl.work_catalog_confirm_delete ?? "")) return;
    try {
      const res = await fetch(
        `/api/work-catalog/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error();
      showToast("success", tl.toast_saved ?? "Saved");
      await reload();
    } catch {
      showToast("error", tl.toast_error ?? "Error");
    }
  };

  const runImport = async () => {
    const selected = MACHINPRO_WORK_CATALOG_ALL.filter((r) => importPick[r.nameKey]);
    if (selected.length === 0) {
      showToast("error", tl.toast_error ?? "Error");
      return;
    }
    const usedNames = new Set(existingNameLower);
    for (const row of selected) {
      const name = L(tl, row.nameKey, row.nameKey).trim();
      if (usedNames.has(name.toLowerCase())) continue;
      const category = L(tl, row.categoryKey, row.categoryKey);
      const pr = importPrices[row.nameKey]?.trim();
      const price =
        pr && Number.isFinite(Number(pr.replace(",", "."))) ? Number(pr.replace(",", ".")) : null;
      const res = await fetch("/api/work-catalog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          companyId,
          name,
          unit: row.unit,
          category,
          price_per_unit: price,
        }),
      });
      if (res.status === 409) {
        usedNames.add(name.toLowerCase());
        continue;
      }
      if (!res.ok) {
        showToast("error", tl.toast_error ?? "Error");
        return;
      }
      usedNames.add(name.toLowerCase());
    }
    showToast("success", tl.toast_saved ?? "Saved");
    setImportOpen(false);
    setImportPick({});
    setImportPrices({});
    await reload();
  };

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/50 dark:bg-slate-800/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Factory className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          {tl.work_catalog ?? tl.settings_work_catalog_title ?? "Work catalog"}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-600 dark:bg-slate-900 dark:text-zinc-100"
          >
            {tl.work_catalog_import ?? tl.work_catalog_import_machinpro ?? "Import"}
          </button>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            {tl.work_catalog_new_item ?? tl.work_catalog_new ?? "New"}
          </button>
        </div>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{tl.settings_work_catalog_hint ?? ""}</p>

      {loading ? (
        <p className="text-sm text-zinc-500">{tl.billing_loading ?? "…"}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{tl.work_catalog_empty ?? ""}</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([cat, rows]) => (
            <div key={cat} className="rounded-lg border border-zinc-200 bg-white dark:border-slate-600 dark:bg-slate-900">
              <div className="border-b border-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100 dark:border-slate-700">
                {cat}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-slate-800 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">{tl.work_item_name ?? tl.work_catalog_name ?? ""}</th>
                      <th className="px-3 py-2">{tl.work_item_unit ?? tl.work_catalog_unit ?? ""}</th>
                      <th className="px-3 py-2 text-right">
                        {tl.work_item_price ?? tl.work_catalog_price ?? ""}
                      </th>
                      <th className="px-3 py-2">{tl.work_item_category ?? tl.work_catalog_category ?? ""}</th>
                      <th className="px-3 py-2 w-28" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{r.name}</td>
                        <td className="px-3 py-2">
                          {(tl[
                            (r.unit === "hours"
                              ? "production_unit_hours"
                              : `production_unit_${r.unit}`) as keyof typeof tl
                          ] as string) || r.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.price_per_unit != null ? r.price_per_unit.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                          {r.category?.trim() || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-600"
                              aria-label={tl.work_catalog_edit ?? ""}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void softDelete(r.id)}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-red-200 text-red-600 dark:border-red-800"
                              aria-label={tl.work_catalog_delete ?? ""}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => setModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">
              {modal.mode === "new"
                ? tl.work_catalog_modal_new_title ?? ""
                : tl.work_catalog_modal_edit_title ?? ""}
            </h4>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{tl.work_catalog_name ?? ""}</span>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{tl.work_catalog_category ?? ""}</span>
                <input
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                  list="work-cat-suggestions"
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2"
                />
                <datalist id="work-cat-suggestions">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{tl.work_catalog_unit ?? ""}</span>
                <select
                  value={draftUnit}
                  onChange={(e) => setDraftUnit(e.target.value as WorkCatalogUnitOption)}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2"
                >
                  {WORK_CATALOG_UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {(tl[
                        (u === "hours" ? "production_unit_hours" : `production_unit_${u}`) as keyof typeof tl
                      ] as string) || u}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{tl.work_catalog_price ?? ""}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draftPrice}
                  onChange={(e) => setDraftPrice(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveModal()}
                className="min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white"
              >
                {tl.work_catalog_save ?? tl.save ?? ""}
              </button>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="min-h-[44px] rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                {tl.common_cancel ?? tl.cancel ?? ""}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => setImportOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">
              {tl.work_catalog_import_title ?? ""}
            </h4>
            <ul className="max-h-[55vh] space-y-4 overflow-y-auto">
              {importCatalogGroups.map(([gk, groupRows]) => (
                <li key={gk} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {L(tl, groupRows[0]?.categoryKey ?? "", "")}
                  </p>
                  <ul className="space-y-2">
                    {groupRows.map((row) => {
                      const label = L(tl, row.nameKey, row.nameKey);
                      return (
                        <li
                          key={row.nameKey}
                          className="rounded-lg border border-zinc-200 p-3 dark:border-slate-600 space-y-2"
                        >
                          <label className="flex items-center gap-2 min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={!!importPick[row.nameKey]}
                              onChange={(e) =>
                                setImportPick((p) => ({ ...p, [row.nameKey]: e.target.checked }))
                              }
                              className="h-5 w-5"
                            />
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
                          </label>
                          {importPick[row.nameKey] ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder={tl.work_catalog_price ?? ""}
                              value={importPrices[row.nameKey] ?? ""}
                              onChange={(e) =>
                                setImportPrices((p) => ({ ...p, [row.nameKey]: e.target.value }))
                              }
                              className="w-full min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-100"
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runImport()}
                className="min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white"
              >
                {tl.work_catalog_import_confirm ?? ""}
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="min-h-[44px] rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                {tl.common_cancel ?? tl.cancel ?? ""}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
