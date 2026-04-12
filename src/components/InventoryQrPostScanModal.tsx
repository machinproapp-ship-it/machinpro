"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import type { InventoryItem, ToolStatus } from "@/components/LogisticsModule";
import type { InventoryQrPostScanAction } from "@/types/inventoryQrAction";

const STATUS_OPTS: ToolStatus[] = ["available", "in_use", "maintenance", "out_of_service", "lost"];

type Props = {
  item: InventoryItem;
  projects: { id: string; name: string }[];
  labels: Record<string, string>;
  onClose: () => void;
  onOpenDetail?: () => void;
  onSubmit: (action: InventoryQrPostScanAction) => void;
};

export function InventoryQrPostScanModal({
  item,
  projects,
  labels,
  onClose,
  onOpenDetail,
  onSubmit,
}: Props) {
  const tx = labels as Record<string, string>;
  const L = (k: string, fb: string) => tx[k] ?? fb;
  const isTracked = item.type === "tool" || item.type === "equipment";

  const [panel, setPanel] = useState<"menu" | "in" | "out" | "transfer" | "status">("menu");
  const [qtyStr, setQtyStr] = useState(
    isTracked ? "1" : String(Math.max(1, Math.floor(item.quantity)) || 1)
  );
  const [notes, setNotes] = useState("");
  const [outProjectId, setOutProjectId] = useState(item.assignedToProjectId ?? "");
  const [tDestProject, setTDestProject] = useState("");
  const [tToWarehouse, setTToWarehouse] = useState(false);
  const [tFromLoc, setTFromLoc] = useState(item.location ?? "warehouse");
  const [tToLoc, setTToLoc] = useState(item.location ?? "warehouse");
  const [newStatus, setNewStatus] = useState<ToolStatus>(item.toolStatus ?? "available");

  const locLabel = (loc: string) =>
    loc === "warehouse"
      ? L("warehouse", "Warehouse")
      : loc === "onsite"
        ? L("onsite", "On site")
        : loc;

  const statusLabel = (s: ToolStatus) =>
    L(
      s === "available"
        ? "available"
        : s === "in_use"
          ? "inUse"
          : s === "maintenance"
            ? "maintenance"
            : s === "out_of_service"
              ? "outOfService"
              : "lost",
      s
    );

  const fromProjectId = item.assignedToProjectId ?? null;

  const transferPayload = useMemo((): InventoryQrPostScanAction | null => {
    const qty = isTracked ? 1 : Math.max(0, parseFloat(qtyStr.replace(",", ".")) || 0);
    if (!isTracked && qty <= 0) return null;
    const toProjectId = tToWarehouse ? null : tDestProject || null;
    const toLocation = tToWarehouse ? "warehouse" : tToLoc || "onsite";
    return {
      kind: "transfer",
      quantity: qty,
      fromProjectId,
      toProjectId,
      fromLocation: tFromLoc || "warehouse",
      toLocation,
      notes: notes.trim() || undefined,
    };
  }, [fromProjectId, isTracked, notes, qtyStr, tDestProject, tFromLoc, tToLoc, tToWarehouse]);

  const confirmIn = () => {
    const qty = isTracked ? 1 : Math.max(0, parseFloat(qtyStr.replace(",", ".")) || 0);
    if (!isTracked && qty <= 0) return;
    onSubmit({ kind: "in", quantity: isTracked ? 1 : qty, notes: notes.trim() || undefined });
  };

  const confirmOut = () => {
    if (!outProjectId.trim()) return;
    const qty = isTracked ? 1 : Math.max(0, parseFloat(qtyStr.replace(",", ".")) || 0);
    if (!isTracked && qty <= 0) return;
    onSubmit({
      kind: "out",
      quantity: isTracked ? 1 : qty,
      projectId: outProjectId.trim(),
      notes: notes.trim() || undefined,
    });
  };

  const confirmTransfer = () => {
    if (!transferPayload) return;
    onSubmit(transferPayload);
  };

  const confirmStatus = () => {
    onSubmit({ kind: "status_change", newStatus, notes: notes.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-[10075] flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2 border-b border-zinc-200 p-4 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{item.name}</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {locLabel(item.location ?? "warehouse")}
              {isTracked ? (
                <>
                  {" · "}
                  {statusLabel(item.toolStatus ?? "available")}
                </>
              ) : (
                <>
                  {" · "}
                  {item.quantity} {item.unit}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
            onClick={onClose}
            aria-label={L("common_close", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {item.imageUrl ? (
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-slate-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt=""
              className="mx-auto max-h-40 w-auto rounded-lg object-contain"
            />
          </div>
        ) : null}

        <div className="space-y-4 p-4">
          {onOpenDetail ? (
            <button
              type="button"
              className="w-full min-h-[44px] rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              onClick={() => {
                onOpenDetail();
                onClose();
              }}
            >
              {L("inventory_open_detail", L("wh_inventory_item", "Open item"))}
            </button>
          ) : null}

          {panel === "menu" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-[44px] rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
                onClick={() => setPanel("in")}
              >
                {L("inventory_register_in", "Registrar entrada")}
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-500"
                onClick={() => setPanel("out")}
              >
                {L("inventory_register_out", "Registrar salida")}
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
                onClick={() => setPanel("transfer")}
              >
                {L("inventory_register_transfer", "Transferir")}
              </button>
              <button
                type="button"
                disabled={!isTracked}
                className="min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-800 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-100"
                onClick={() => setPanel("status")}
              >
                {L("inventory_change_status", "Cambiar estado")}
              </button>
            </div>
          ) : null}

          {panel !== "menu" ? (
            <button
              type="button"
              className="text-sm text-amber-700 underline dark:text-amber-400"
              onClick={() => {
                setPanel("menu");
                setNotes("");
              }}
            >
              ← {L("common_back", "Back")}
            </button>
          ) : null}

          {panel === "in" || panel === "out" ? (
            <div className="space-y-2">
              {!isTracked ? (
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {L("quantity", "Quantity")}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={qtyStr}
                    onChange={(e) => setQtyStr(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  />
                </label>
              ) : null}
              {panel === "out" ? (
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {L("filterByProject", "Project")}
                  <select
                    value={outProjectId}
                    onChange={(e) => setOutProjectId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  >
                    <option value="">{L("forms_select_placeholder", "—")}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {panel === "transfer" ? (
            <div className="space-y-3">
              {!isTracked ? (
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {L("quantity", "Quantity")}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={qtyStr}
                    onChange={(e) => setQtyStr(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  />
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 min-h-[44px]">
                <input
                  type="checkbox"
                  checked={tToWarehouse}
                  onChange={(e) => setTToWarehouse(e.target.checked)}
                  className="h-5 w-5"
                />
                {L("inventory_transfer_to_warehouse", "To warehouse")}
              </label>
              {!tToWarehouse ? (
                <>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {L("inventory_transfer_dest_project", "Destination project")}
                    <select
                      value={tDestProject}
                      onChange={(e) => setTDestProject(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                    >
                      <option value="">{L("forms_select_placeholder", "—")}</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {L("location", "Location")}
                    <input
                      value={tToLoc}
                      onChange={(e) => setTToLoc(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                    />
                  </label>
                </>
              ) : null}
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {L("inventory_transfer_from_loc", "Origin location")}
                <input
                  value={tFromLoc}
                  onChange={(e) => setTFromLoc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                />
              </label>
            </div>
          ) : null}

          {panel === "status" && isTracked ? (
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {L("status", "Status")}
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ToolStatus)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {panel !== "menu" ? (
            <>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {L("notes", "Notes")} ({L("optional", "optional")})
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-slate-800"
                />
              </label>
              <button
                type="button"
                className="w-full min-h-[44px] rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500"
                onClick={() => {
                  if (panel === "in") confirmIn();
                  else if (panel === "out") confirmOut();
                  else if (panel === "transfer") confirmTransfer();
                  else if (panel === "status") confirmStatus();
                }}
              >
                {L("common_confirm", "Confirm")}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
