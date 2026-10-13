"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Camera, History, ShieldCheck, X } from "lucide-react";
import type { InventoryItem } from "@/components/LogisticsModule";
import type { InventoryLedgerRow } from "@/types/inventoryLedger";
import {
  daysSince,
  fetchItemMovements,
  toolReportDamage,
  toolReturn,
  toolTake,
  type ToolActionError,
  type ToolRole,
} from "@/lib/toolTracking";
import { uploadInspectionImage } from "@/lib/inspections";

const L = (d: Record<string, string>, k: string, fb: string) => d[k] ?? fb;

/**
 * Lo que ve cualquiera al escanear el QR de una herramienta: quién la tiene, desde cuándo,
 * y los botones "Me la llevo", "La devuelvo", "Inspeccionar" y "Reportar avería".
 */
export function ToolQuickSheet({
  item,
  labels: lx,
  companyId,
  currentUserId,
  dateLocale,
  personName,
  projectName,
  defaultProjectId,
  myProjects,
  canInspect,
  role,
  people,
  onInspect,
  onClose,
  onChanged,
  onOpenFull,
}: {
  item: InventoryItem;
  labels: Record<string, string>;
  companyId: string;
  currentUserId: string | null;
  dateLocale: string;
  personName: (id: string | undefined | null) => string;
  projectName: (id: string | undefined | null) => string;
  /** Obra de hoy del trabajador (si tiene turno). */
  defaultProjectId: string | null;
  myProjects: { id: string; name: string }[];
  canInspect: boolean;
  /** logistics: control total · site: supervisor en sus obras · helper: trabajador con permiso · null: solo ver. */
  role: ToolRole;
  /** A quién se puede entregar (según la obra elegida). */
  people: (projectId: string | null) => { id: string; name: string }[];
  onInspect: () => void;
  onClose: () => void;
  /** Tras una acción: recargar inventario y movimientos. */
  onChanged: () => void;
  /** Logística: abrir la ficha completa en el inventario. */
  onOpenFull?: () => void;
}) {
  const [history, setHistory] = useState<InventoryLedgerRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? item.assignedToProjectId ?? "");
  const [toUser, setToUser] = useState<string>(currentUserId ?? "");
  const [damageOpen, setDamageOpen] = useState(false);
  const [damageNote, setDamageNote] = useState("");
  const [damagePhoto, setDamagePhoto] = useState<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const holder = item.assignedToEmployeeId || null;
  const iHaveIt = !!currentUserId && holder === currentUserId;
  const status = item.toolStatus ?? "available";
  const unusable = status === "out_of_service" || status === "lost" || status === "maintenance";

  const loadHistory = () => {
    fetchItemMovements(item.id, 15)
      .then(setHistory)
      .catch(() => setHistory([]));
  };
  useEffect(loadHistory, [item.id]);

  const errText = (e: ToolActionError) =>
    e === "not_allowed"
      ? L(lx, "tool_err_not_allowed", "Este equipo está limitado a otras personas o roles.")
      : e === "not_holder"
        ? L(lx, "tool_err_not_holder", "Solo puede devolverla quien la tiene o logística.")
        : e === "note_required"
          ? L(lx, "tool_err_note", "Escribe qué le pasa.")
          : e === "not_ready"
            ? L(lx, "tool_err_not_ready", "El control de herramientas aún no está activado.")
            : L(lx, "tool_err_network", "No se pudo guardar. Revisa la conexión e inténtalo de nuevo.");

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: ToolActionError }>, okText: string) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) {
      setMsg({ kind: "ok", text: okText });
      setDamageOpen(false);
      onChanged();
      loadHistory();
    } else {
      setMsg({ kind: "err", text: errText(r.error) });
    }
  };

  const canHandOut = role === "logistics" || role === "site";
  const canReceive = canHandOut || (role === "helper" && iHaveIt);
  const giveTo = canHandOut ? toUser || currentUserId : currentUserId;
  const take = () =>
    run(
      () => toolTake(item.id, projectId || null, undefined, giveTo),
      giveTo && giveTo !== currentUserId
        ? L(lx, "tool_handed", "Listo: entregada a {name}.").replace("{name}", personName(giveTo))
        : L(lx, "tool_taken", "Listo: queda a tu nombre.")
    );
  const giveBack = () => run(() => toolReturn(item.id), L(lx, "tool_returned", "Listo: devuelta al almacén."));
  const reportDamage = () =>
    run(async () => {
      let url: string | null = null;
      if (damagePhoto) {
        try {
          url = await uploadInspectionImage(damagePhoto, companyId, "averia.jpg");
        } catch {
          return { ok: false as const, error: "network" as const };
        }
      }
      return toolReportDamage(item.id, damageNote, url);
    }, L(lx, "tool_damage_sent", "Avería registrada. Logística ya está avisada."));

  const fmt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch {
      return iso.slice(0, 16).replace("T", " ");
    }
  };
  const lastOut = history?.find((m) => m.movementType === "checkout" || m.movementType === "out");
  const movLabel = (m: InventoryLedgerRow) => {
    const map: Record<string, string> = {
      checkout: L(lx, "tool_mov_checkout", "Se la llevó"),
      return: L(lx, "tool_mov_return", "La devolvió"),
      damage: L(lx, "tool_mov_damage", "Avería"),
      in: L(lx, "tool_mov_in", "Entrada"),
      out: L(lx, "tool_mov_out", "Salida"),
      transfer: L(lx, "tool_mov_transfer", "Traspaso"),
      maintenance: L(lx, "tool_mov_maintenance", "Mantenimiento"),
      status_change: L(lx, "tool_mov_status", "Cambio de estado"),
      import: L(lx, "tool_mov_import", "Alta"),
    };
    return map[m.movementType] ?? m.movementType;
  };

  const btn = "inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-zinc-50 dark:bg-slate-950" role="dialog" aria-modal="true">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <p className="min-w-0 truncate text-lg font-bold text-zinc-900 dark:text-white">{item.name}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={L(lx, "close", "Cerrar")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <section className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="h-24 w-24 shrink-0 rounded-xl bg-zinc-100 dark:bg-slate-800" aria-hidden />
          )}
          <div className="min-w-0 space-y-1 text-sm">
            {item.serialNumber ? (
              <p className="text-zinc-500 dark:text-zinc-400">
                {L(lx, "tool_serial", "N.º serie")}: {item.serialNumber}
              </p>
            ) : null}
            <p className={`font-semibold ${unusable ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
              {L(lx, `tool_status_${status}`, status)}
            </p>
            <p className="text-zinc-800 dark:text-zinc-200">
              {holder
                ? `${L(lx, "tool_held_by", "La tiene")}: ${iHaveIt ? L(lx, "tool_you", "tú") : personName(holder)}`
                : L(lx, "tool_in_warehouse", "En el almacén")}
            </p>
            {holder && (item.assignedToProjectId || item.location) ? (
              <p className="text-zinc-600 dark:text-zinc-400">
                {projectName(item.assignedToProjectId) || item.location}
              </p>
            ) : null}
            {holder && lastOut ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {L(lx, "tool_since", "Desde {date} ({days} días)")
                  .replace("{date}", fmt(lastOut.createdAt))
                  .replace("{days}", String(daysSince(lastOut.createdAt)))}
              </p>
            ) : null}
          </div>
        </section>

        {msg ? (
          <p
            className={`rounded-xl px-3 py-2 text-sm ${
              msg.kind === "ok"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
            }`}
          >
            {msg.text}
          </p>
        ) : null}

        <section className="space-y-2">
          {canInspect && item.requiresInspection ? (
            <button type="button" onClick={onInspect} className={`${btn} bg-amber-600 text-white hover:bg-amber-500`}>
              <ShieldCheck className="h-5 w-5" aria-hidden />
              {L(lx, "tool_inspect", "Inspeccionar antes de usar")}
            </button>
          ) : null}

          {role && (canHandOut || !iHaveIt) ? (
            <>
              {myProjects.length > 0 ? (
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {L(lx, "tool_take_to", "¿A qué obra?")}
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-100"
                  >
                    <option value="">{L(lx, "tool_no_project", "Sin obra")}</option>
                    {myProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {canHandOut ? (
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {L(lx, "tool_give_to", "¿A quién se la das?")}
                  <select
                    value={toUser}
                    onChange={(e) => setToUser(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-100"
                  >
                    {currentUserId ? <option value={currentUserId}>{L(lx, "tool_me", "A mí")}</option> : null}
                    {people(projectId || null)
                      .filter((p) => p.id !== currentUserId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => void take()}
                disabled={busy || unusable || (!!holder && holder === giveTo)}
                className={`${btn} bg-emerald-600 text-white hover:bg-emerald-500`}
              >
                <ArrowUpFromLine className="h-5 w-5" aria-hidden />
                {busy
                  ? "…"
                  : canHandOut && giveTo !== currentUserId
                    ? L(lx, "tool_hand_out", "Entregar")
                    : L(lx, "tool_take", "Me la llevo")}
              </button>
              {unusable ? (
                <p className="text-xs text-red-700 dark:text-red-400">
                  {L(lx, "tool_unusable_hint", "No está disponible: está averiada, en mantenimiento o perdida.")}
                </p>
              ) : null}
            </>
          ) : null}

          {holder && canReceive ? (
            <button
              type="button"
              onClick={() => void giveBack()}
              disabled={busy}
              className={`${btn} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-slate-600 dark:bg-slate-900 dark:text-zinc-100`}
            >
              <ArrowDownToLine className="h-5 w-5" aria-hidden />
              {busy
                ? "…"
                : iHaveIt
                  ? L(lx, "tool_return", "La devuelvo al almacén")
                  : L(lx, "tool_receive", "Recibida: vuelve al almacén")}
            </button>
          ) : null}

          {!role ? (
            <p className="rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-600 dark:bg-slate-800 dark:text-zinc-300">
              {L(lx, "tool_view_only", "Solo consulta. Si se avería, avisa a tu supervisor.")}
            </p>
          ) : null}

          {!role ? null : !damageOpen ? (
            <button
              type="button"
              onClick={() => setDamageOpen(true)}
              className={`${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300`}
            >
              <AlertTriangle className="h-5 w-5" aria-hidden />
              {L(lx, "tool_report_damage", "Reportar avería")}
            </button>
          ) : (
            <div className="space-y-2 rounded-2xl border border-red-200 bg-white p-3 dark:border-red-900 dark:bg-slate-900">
              <textarea
                value={damageNote}
                onChange={(e) => setDamageNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={L(lx, "tool_damage_ph", "¿Qué le pasa?")}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-100"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setDamagePhoto(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`${btn} border border-zinc-300 text-zinc-800 dark:border-slate-600 dark:text-zinc-100`}
              >
                <Camera className="h-5 w-5" aria-hidden />
                {damagePhoto ? L(lx, "tool_photo_ready", "Foto lista ✓") : L(lx, "tool_add_photo", "Añadir foto")}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void reportDamage()}
                  disabled={busy || !damageNote.trim()}
                  className={`${btn} bg-red-600 text-white hover:bg-red-500`}
                >
                  {busy ? "…" : L(lx, "tool_send", "Enviar")}
                </button>
                <button
                  type="button"
                  onClick={() => setDamageOpen(false)}
                  className={`${btn} border border-zinc-300 dark:border-slate-600 dark:text-zinc-100`}
                >
                  {L(lx, "cancel", "Cancelar")}
                </button>
              </div>
            </div>
          )}
          {onOpenFull ? (
            <button
              type="button"
              onClick={onOpenFull}
              className={`${btn} border border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-slate-600 dark:text-zinc-100 dark:hover:bg-slate-800`}
            >
              {L(lx, "tool_open_full", "Ver ficha completa")}
            </button>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <History className="h-4 w-4" aria-hidden />
            {L(lx, "tool_history", "Historial")}
          </h3>
          {history === null ? (
            <p className="text-sm text-zinc-500">{L(lx, "loading", "Cargando…")}</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-zinc-500">{L(lx, "tool_history_empty", "Sin movimientos todavía.")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((m) => (
                <li key={m.id} className="border-b border-zinc-100 pb-2 last:border-0 dark:border-slate-800">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {movLabel(m)} · {m.performedByName ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {fmt(m.createdAt)}
                    {m.toProjectId ? ` · ${projectName(m.toProjectId)}` : ""}
                    {m.notes ? ` · ${m.notes}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
