"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCopy, Download, Link2, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  createInspectionLink,
  fetchWorkdayRecord,
  inspectionLinkUrl,
  isoDay,
  listInspectionLinks,
  revokeInspectionLink,
  workdayRecordCsv,
  type InspectionLink,
  type WorkdayError,
} from "@/lib/workdayRecord";

/**
 * Registro de jornada: descarga del periodo y enlaces de solo lectura para la Inspección de Trabajo.
 * Solo para quien gestiona horas o nómina (lo vuelve a comprobar el servidor).
 */
export function WorkdayRecordPanel({
  labels,
  companyId,
  companyName,
  timeZone,
  dateLocale,
}: {
  labels: Record<string, string>;
  companyId: string;
  companyName: string;
  timeZone: string;
  dateLocale: string;
}) {
  const L = labels;
  const { showToast } = useToast();
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const [from, setFrom] = useState(isoDay(monthAgo));
  const [to, setTo] = useState(isoDay(today));
  const [busy, setBusy] = useState<null | "csv" | "link">(null);
  const [links, setLinks] = useState<InspectionLink[]>([]);
  const [open, setOpen] = useState(false);

  const errText = (e: WorkdayError) =>
    e === "not_allowed"
      ? (L.wr_err_not_allowed ?? "No tienes permiso para el registro de jornada.")
      : e === "not_ready"
        ? (L.wr_err_not_ready ?? "El servidor aún no está actualizado. Inténtalo más tarde.")
        : e === "range_too_long"
          ? (L.wr_err_range ?? "Elige un periodo de como mucho 13 meses.")
          : (L.wr_err_network ?? "No se pudo cargar. Revisa la conexión.");

  const loadLinks = useCallback(() => {
    if (!companyId) return;
    listInspectionLinks(companyId)
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [companyId]);

  useEffect(() => {
    if (open) loadLinks();
  }, [open, loadLinks]);

  const download = async () => {
    setBusy("csv");
    try {
      const res = await fetchWorkdayRecord({ from, to, timeZone });
      if (!res.ok) {
        showToast("error", errText(res.error));
        return;
      }
      const csv = workdayRecordCsv(
        res.data,
        {
          worker: L.wr_col_worker ?? "Trabajador",
          day: L.wr_col_day ?? "Día",
          clockIn: L.wr_col_in ?? "Entrada",
          clockOut: L.wr_col_out ?? "Salida",
          hours: L.wr_col_hours ?? "Horas",
          project: L.wr_col_project ?? "Obra",
          corrections: L.wr_col_corrections ?? "Correcciones",
          lastCorrection: L.wr_col_last_correction ?? "Última corrección",
        },
        dateLocale
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const safe = (companyName || "MachinPro").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
      a.download = `registro-jornada_${safe}_${from}_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      showToast("success", L.wr_csv_ok ?? "Registro descargado.");
    } finally {
      setBusy(null);
    }
  };

  const makeLink = async () => {
    setBusy("link");
    try {
      const res = await createInspectionLink(30, L.wr_link_default_label ?? "Inspección de Trabajo", timeZone);
      if (!res.ok) {
        showToast("error", errText(res.error));
        return;
      }
      const url = inspectionLinkUrl(window.location.origin, res.token);
      try {
        await navigator.clipboard.writeText(url);
        showToast("success", L.wr_link_copied ?? "Enlace creado y copiado. Caduca en 30 días.");
      } catch {
        showToast("success", L.wr_link_created ?? "Enlace creado. Caduca en 30 días.");
      }
      loadLinks();
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (id: string) => {
    const ok = await revokeInspectionLink(id);
    showToast(ok ? "success" : "error", ok ? (L.wr_link_revoked ?? "Enlace anulado.") : errText("network"));
    loadLinks();
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inspectionLinkUrl(window.location.origin, token));
      showToast("success", L.wr_copied ?? "Copiado.");
    } catch {
      /* sin portapapeles */
    }
  };

  const fmtDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium" }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  };

  const active = links.filter((l) => !l.revokedAt && new Date(l.expiresAt).getTime() > Date.now());

  return (
    <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <span>
            <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
              {L.wr_title ?? "Registro de jornada"}
            </span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              {L.wr_subtitle ?? "Entradas, salidas y correcciones por trabajador, listo para una inspección."}
            </span>
          </span>
        </span>
        <span className="text-xs text-zinc-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              {L.wr_from ?? "Desde"}
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              {L.wr_to ?? "Hasta"}
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => void download()}
              disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
            >
              {busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
              {L.wr_download ?? "Descargar (CSV)"}
            </button>
          </div>

          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-slate-800/60">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {L.wr_link_title ?? "Acceso para la Inspección de Trabajo"}
            </p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              {L.wr_link_hint ??
                "Crea un enlace de solo lectura al registro de jornada. Caduca a los 30 días y puedes anularlo cuando quieras."}
            </p>
            <button
              type="button"
              onClick={() => void makeLink()}
              disabled={busy !== null}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-white disabled:opacity-60 dark:border-slate-600 dark:text-zinc-100 dark:hover:bg-slate-700"
            >
              {busy === "link" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
              {L.wr_link_create ?? "Crear enlace"}
            </button>
            {active.length > 0 && (
              <ul className="mt-3 space-y-2">
                {active.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {(l.label ?? L.wr_link_default_label ?? "Inspección de Trabajo") +
                        " · " +
                        (L.wr_link_expires ?? "caduca") +
                        " " +
                        fmtDate(l.expiresAt)}
                    </span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void copy(l.token)}
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-slate-800"
                      >
                        <ClipboardCopy className="h-4 w-4" aria-hidden />
                        {L.wr_copy ?? "Copiar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void revoke(l.id)}
                        className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        {L.wr_revoke ?? "Anular"}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
