"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { AveryLabelFormat } from "@/lib/inventoryQrLabelFormats";
import { downloadInventoryQrLabelsPdf } from "@/lib/downloadInventoryQrLabelsPdf";

export type InventoryQrLabelRow = {
  id: string;
  name: string;
  model?: string;
};

const FORMAT_OPTIONS: { value: AveryLabelFormat; labelKey: string; fallback: string }[] = [
  { value: "avery-L7160", labelKey: "inventory_qrLabelsFormatA4_21", fallback: "A4 - 21 labels (Avery L7160)" },
  { value: "avery-L7159", labelKey: "inventory_qrLabelsFormatA4_24", fallback: "A4 - 24 labels (Avery L7159)" },
  { value: "avery-5160", labelKey: "inventory_qrLabelsFormatLetter_30", fallback: "US Letter - 30 labels (Avery 5160)" },
  { value: "avery-5161", labelKey: "inventory_qrLabelsFormatLetter_20", fallback: "US Letter - 20 labels (Avery 5161)" },
];

export function InventoryQrLabelsModal({
  open,
  items,
  labels,
  companyId,
  companyName,
  onClose,
  onGenerated,
}: {
  open: boolean;
  items: InventoryQrLabelRow[];
  labels: Record<string, string>;
  companyId: string;
  companyName: string;
  onClose: () => void;
  onGenerated?: (payload: { count: number; format: AveryLabelFormat }) => void;
}) {
  const L = (k: string, fb: string) => labels[k] ?? fb;

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [format, setFormat] = useState<AveryLabelFormat>("avery-L7160");
  const [unprintedOnly, setUnprintedOnly] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    // TODO AH-72: filter by qr_label_printed_at when field exists in DB
    if (!unprintedOnly) return items;
    return items;
  }, [items, unprintedOnly]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(items.map((i) => i.id)));
    setFormat("avery-L7160");
    setUnprintedOnly(false);
    setError(null);
    setGenerating(false);
  }, [open, items]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    const picked = visibleItems.filter((i) => selected.has(i.id));
    if (picked.length === 0) {
      setError(L("inventory_qrLabelsNoItemsSelected", "Select at least one item"));
      return;
    }
    if (!companyId) {
      setError(L("common_error", "Error"));
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const { count } = await downloadInventoryQrLabelsPdf({
        items: picked,
        format,
        companyId,
        companyName: companyName || "MachinPro",
      });
      onGenerated?.({ count, format });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <ModalBackdrop onClose={onClose} generating={generating} />
      <div className="fixed z-[10061] flex w-full flex-col border border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[92vh] max-md:rounded-t-2xl max-md:pb-[max(1rem,env(safe-area-inset-bottom))] md:left-1/2 md:top-1/2 md:bottom-auto md:inset-x-auto md:h-auto md:max-h-[90vh] md:w-full md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl lg:max-w-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 p-4 dark:border-slate-700">
          <h3 className="pr-2 text-lg font-semibold text-zinc-900 dark:text-white">
            {L("inventory_qrLabelsModalTitle", "Generate QR labels for printing")}
          </h3>
          <button
            type="button"
            disabled={generating}
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
            aria-label={L("common_close", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {L("inventory_qrLabelsDescription", "Select items and Avery sheet format.")}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            {L("inventory_qrLabelsHelp", "Print on pre-formatted Avery sheets. Available at any office supply store.")}
          </p>

          <ModalToolbar
            L={L}
            onSelectAll={() => setSelected(new Set(visibleItems.map((i) => i.id)))}
            onDeselectAll={() => setSelected(new Set())}
            unprintedOnly={unprintedOnly}
            onUnprintedOnlyChange={setUnprintedOnly}
          />

          <label className="block shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {L("inventory_qrLabelsFormat", "Sheet format")}
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as AveryLabelFormat)}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-100"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {L(opt.labelKey, opt.fallback)}
                </option>
              ))}
            </select>
          </label>

          <ul className="min-h-[120px] flex-1 overflow-y-auto rounded-xl border border-zinc-200 divide-y divide-zinc-100 dark:border-slate-700 dark:divide-slate-700">
            {visibleItems.length === 0 ? (
              <li className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                {L("wh_inventory_empty", "No inventory items.")}
              </li>
            ) : (
              visibleItems.map((item) => (
                <li key={item.id}>
                  <label className="flex min-h-[44px] cursor-pointer items-start gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-slate-800/50">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </span>
                      {item.model ? (
                        <span className="block break-words text-xs text-zinc-500 dark:text-zinc-400">
                          {item.model}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>

          {error ? <p className="shrink-0 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-zinc-200 p-4 dark:border-slate-700 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {L("inventory_qrLabelsCancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {generating
              ? L("inventory_qrLabelsGenerating", "Generating PDF...")
              : L("inventory_qrLabelsGenerateButton", "Generate PDF")}
          </button>
        </div>
      </div>
    </>
  );
}

function ModalBackdrop({
  onClose,
  generating,
}: {
  onClose: () => void;
  generating: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[10060] bg-black/50"
      aria-hidden
      onClick={() => {
        if (!generating) onClose();
      }}
    />
  );
}

function ModalToolbar({
  L,
  onSelectAll,
  onDeselectAll,
  unprintedOnly,
  onUnprintedOnlyChange,
}: {
  L: (k: string, fb: string) => string;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  unprintedOnly: boolean;
  onUnprintedOnlyChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSelectAll}
        className="min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {L("inventory_qrLabelsSelectAll", "Select all")}
      </button>
      <button
        type="button"
        onClick={onDeselectAll}
        className="min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {L("inventory_qrLabelsDeselectAll", "Deselect all")}
      </button>
      <label className="ml-auto flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={unprintedOnly}
          onChange={(e) => onUnprintedOnlyChange(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
        />
        {L("inventory_qrLabelsUnprintedOnly", "Unprinted labels only")}
      </label>
    </div>
  );
}
