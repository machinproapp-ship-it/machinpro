"use client";

import { useMemo, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  type CatalogItem,
  type ProductionUnit,
  PRODUCTION_UNITS,
  mapCatalogRow,
} from "@/lib/productionCatalog";
import { useToast } from "@/components/Toast";
import { userFacingErrorMessage } from "@/lib/userFacingError";

function unitLabel(u: ProductionUnit, tl: Record<string, string>): string {
  const k = `production_unit_${u}` as const;
  return tl[k] ?? u;
}

export function ProductionCatalogSettingsSection({
  labels: raw,
  companyId,
  currencyDefault,
  items,
  onRefresh,
}: {
  labels: Record<string, string>;
  companyId: string;
  currencyDefault: string;
  items: CatalogItem[];
  onRefresh: () => void;
}) {
  const tl = raw;
  const { showToast } = useToast();
  const L = (k: string, fb: string) => (tl[k] as string | undefined) || fb;

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<null | { mode: "add" } | { mode: "edit"; item: CatalogItem }>(null);
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      const c = (it.category ?? "").trim();
      if (c) s.add(c);
    }
    return [...s].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (!showInactive && !it.isActive) return false;
      if (catFilter && (it.category ?? "") !== catFilter) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, catFilter, showInactive]);

  const softDelete = useCallback(
    async (id: string) => {
      if (!supabase || !companyId) return;
      setBusy(true);
      const { error } = await supabase
        .from("production_catalog")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id)
        .eq("company_id", companyId);
      setBusy(false);
      if (error) {
        showToast("error", userFacingErrorMessage(tl, error));
        return;
      }
      showToast("success", L("saved_successfully", L("toast_saved", "Saved")));
      onRefresh();
    },
    [companyId, L, onRefresh, showToast, tl]
  );

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
          {L("production_catalog_title", "Production catalog")}
        </h3>
        <button
          type="button"
          disabled={busy}
          onClick={() => setModal({ mode: "add" })}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {L("production_catalog_add", "Add task")}
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L("production_catalog_search", "Search")}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm min-h-[44px]"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px] sm:w-auto sm:min-w-[160px]"
        >
          <option value="">{L("production_catalog_category", "Category")} —</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 min-h-[44px]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          {L("production_catalog_show_inactive", "Show inactive")}
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-slate-700">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-zinc-50 dark:bg-slate-800/80 text-left text-zinc-600 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">{L("production_catalog_name", "Name")}</th>
              <th className="px-3 py-2 font-medium">{L("production_catalog_unit", "Unit")}</th>
              <th className="px-3 py-2 font-medium text-right">{L("production_catalog_cost_price", "Cost")}</th>
              <th className="px-3 py-2 font-medium text-right">{L("production_catalog_sell_price", "Sell")}</th>
              <th className="px-3 py-2 font-medium">{L("production_catalog_category", "Category")}</th>
              <th className="px-3 py-2 w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  {L("employees_empty", "—")}
                </td>
              </tr>
            ) : (
              filtered.map((it) => (
                <tr key={it.id} className={!it.isActive ? "opacity-60" : ""}>
                  <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{it.name}</td>
                  <td className="px-3 py-2">{unitLabel(it.unit, tl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {it.currency} {it.costPrice.toFixed(4)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {it.currency} {it.sellPrice.toFixed(4)}
                  </td>
                  <td className="px-3 py-2">{it.category ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600"
                        onClick={() => setModal({ mode: "edit", item: it })}
                        aria-label={L("production_catalog_edit", "Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-red-300 text-red-600 dark:border-red-800"
                        onClick={() => void softDelete(it.id)}
                        aria-label={L("production_catalog_delete", "Remove")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal ? (
        <CatalogItemModal
          mode={modal.mode}
          item={modal.mode === "edit" ? modal.item : undefined}
          companyId={companyId}
          currencyDefault={currencyDefault}
          labels={tl}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CatalogItemModal({
  mode,
  item,
  companyId,
  currencyDefault,
  labels: tl,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  item?: CatalogItem;
  companyId: string;
  currencyDefault: string;
  labels: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const L = (k: string, fb: string) => (tl[k] as string | undefined) || fb;
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [unit, setUnit] = useState<ProductionUnit>(item?.unit ?? "unit");
  const [cost, setCost] = useState(String(item?.costPrice ?? 0));
  const [sell, setSell] = useState(String(item?.sellPrice ?? 0));
  const [currency, setCurrency] = useState(item?.currency ?? currencyDefault);
  const [category, setCategory] = useState(item?.category ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!supabase || !companyId) return;
    const cp = Number.parseFloat(cost.replace(",", "."));
    const sp = Number.parseFloat(sell.replace(",", "."));
    if (!name.trim() || !Number.isFinite(cp) || !Number.isFinite(sp)) {
      showToast("error", L("error_validation", L("toast_error", "Error")));
      return;
    }
    setBusy(true);
    const row = {
      company_id: companyId,
      name: name.trim(),
      description: description.trim() || null,
      unit,
      cost_price: cp,
      sell_price: sp,
      currency,
      category: category.trim() || null,
      is_active: true,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    };
    const q =
      mode === "add"
        ? supabase.from("production_catalog").insert(row).select("*").maybeSingle()
        : supabase.from("production_catalog").update(row).eq("id", item!.id).eq("company_id", companyId).select("*").maybeSingle();
    const { data, error } = await q;
    setBusy(false);
    if (error) {
      showToast("error", userFacingErrorMessage(tl, error));
      return;
    }
    if (data && mapCatalogRow(data as Record<string, unknown>)) {
      showToast("success", L("saved_successfully", L("toast_saved", "Saved")));
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <h4 className="text-lg font-semibold text-zinc-900 dark:text-white">
          {mode === "add" ? L("production_catalog_add", "Add") : L("production_catalog_edit", "Edit")}
        </h4>
        <label className="block text-xs text-zinc-500">
          {L("production_catalog_name", "Name")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px]"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          {L("production_catalog_description", "Description")}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          {L("production_catalog_unit", "Unit")}
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as ProductionUnit)}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[44px]"
          >
            {PRODUCTION_UNITS.map((u) => (
              <option key={u} value={u}>
                {unitLabel(u, tl)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block text-xs text-zinc-500">
            {L("production_catalog_cost_price", "Cost")}
            <input
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm min-h-[44px] tabular-nums"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            {L("production_catalog_sell_price", "Sell")}
            <input
              value={sell}
              onChange={(e) => setSell(e.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm min-h-[44px] tabular-nums"
            />
          </label>
        </div>
        <label className="block text-xs text-zinc-500">
          {L("production_catalog_currency", "Currency")}
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm min-h-[44px] uppercase"
            maxLength={3}
          />
        </label>
        <label className="block text-xs text-zinc-500">
          {L("production_catalog_category", "Category")}
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2.5 text-sm min-h-[44px]"
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="min-h-[44px] rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {L("production_catalog_save", "Save")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
          >
            {L("production_catalog_cancel", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
