"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchWorkdayRecord,
  formatMinutes,
  isoDay,
  localTime,
  workdayRecordCsv,
  type WorkdayError,
  type WorkdayRecord,
} from "@/lib/workdayRecord";

const TEXT = {
  es: {
    title: "Registro de jornada",
    readonly: "Acceso de solo lectura para la Inspección de Trabajo",
    from: "Desde",
    to: "Hasta",
    show: "Ver",
    download: "Descargar CSV",
    worker: "Trabajador",
    day: "Día",
    in: "Entrada",
    out: "Salida",
    hours: "Horas",
    project: "Obra",
    corrections: "Correcciones",
    lastCorrection: "Última corrección",
    by: "por",
    none: "No hay fichajes en este periodo.",
    loading: "Cargando…",
    invalid: "Este enlace ha caducado o ha sido anulado. Pide uno nuevo a la empresa.",
    error: "No se pudo cargar el registro. Inténtalo de nuevo.",
    range: "Elige un periodo de como mucho 13 meses.",
    note: "Los cambios en los fichajes quedan guardados con fecha, hora y autor, y no se pueden borrar.",
    times: "Horas en la zona",
    open: "abierto",
  },
  en: {
    title: "Working time record",
    readonly: "Read-only access for labour inspection",
    from: "From",
    to: "To",
    show: "Show",
    download: "Download CSV",
    worker: "Worker",
    day: "Day",
    in: "In",
    out: "Out",
    hours: "Hours",
    project: "Site",
    corrections: "Corrections",
    lastCorrection: "Last correction",
    by: "by",
    none: "No time entries in this period.",
    loading: "Loading…",
    invalid: "This link has expired or was revoked. Ask the company for a new one.",
    error: "The record could not be loaded. Please try again.",
    range: "Choose a period of 13 months at most.",
    note: "Changes to time entries are stored with date, time and author, and cannot be deleted.",
    times: "Times in time zone",
    open: "open",
  },
};

export function InspectionView({ token }: { token: string }) {
  const [lang, setLang] = useState<"es" | "en">("es");
  useEffect(() => {
    try {
      if (!navigator.language.toLowerCase().startsWith("es")) setLang("en");
    } catch {
      /* por defecto español */
    }
  }, []);
  const T = TEXT[lang];
  const locale = lang === "es" ? "es-ES" : "en-GB";
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 30 * 86400000)));
  const [to, setTo] = useState(isoDay(today));
  const [rec, setRec] = useState<WorkdayRecord | null>(null);
  const [err, setErr] = useState<WorkdayError | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    const res = await fetchWorkdayRecord({ from, to, timeZone: "UTC", token });
    setLoading(false);
    if (res.ok) setRec(res.data);
    else {
      setErr(res.error);
      setRec(null);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const csvHref = useMemo(() => {
    if (!rec) return null;
    const csv = workdayRecordCsv(
      rec,
      {
        worker: T.worker,
        day: T.day,
        clockIn: T.in,
        clockOut: T.out,
        hours: T.hours,
        project: T.project,
        corrections: T.corrections,
        lastCorrection: T.lastCorrection,
      },
      locale
    );
    return "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  }, [rec, T, locale]);

  const invalid = err === "link_invalid";

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-slate-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 px-4 py-4 dark:border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-600">{T.readonly}</p>
            <h1 className="text-xl font-bold">
              {T.title}
              {rec?.companyName ? ` · ${rec.companyName}` : ""}
            </h1>
          </div>
          <p className="text-xs text-zinc-500">MachinPro</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {invalid ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {T.invalid}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              <label className="text-xs text-zinc-600 dark:text-zinc-300">
                {T.from}
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 block min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
              </label>
              <label className="text-xs text-zinc-600 dark:text-zinc-300">
                {T.to}
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 block min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
              </label>
              <button
                type="button"
                onClick={() => void load()}
                className="min-h-[44px] rounded-xl bg-amber-600 px-5 text-sm font-semibold text-white hover:bg-amber-500"
              >
                {T.show}
              </button>
              {csvHref && rec && rec.rows.length > 0 ? (
                <a
                  href={csvHref}
                  download={`registro-jornada_${rec.from}_${rec.to}.csv`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-300 px-5 text-sm font-medium hover:bg-zinc-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  {T.download}
                </a>
              ) : null}
            </div>

            <p className="mt-4 text-xs text-zinc-500">{T.note}</p>
            {rec ? (
              <p className="mt-1 text-xs text-zinc-500">
                {T.times}: {rec.timezone}
              </p>
            ) : null}

            {loading ? (
              <p className="mt-6 text-sm text-zinc-500">{T.loading}</p>
            ) : err ? (
              <p className="mt-6 text-sm text-red-600">{err === "range_too_long" ? T.range : T.error}</p>
            ) : rec && rec.rows.length === 0 ? (
              <p className="mt-6 text-sm text-zinc-500">{T.none}</p>
            ) : rec ? (
              <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-slate-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2">{T.worker}</th>
                      <th className="px-3 py-2">{T.day}</th>
                      <th className="px-3 py-2">{T.in}</th>
                      <th className="px-3 py-2">{T.out}</th>
                      <th className="px-3 py-2">{T.hours}</th>
                      <th className="px-3 py-2">{T.project}</th>
                      <th className="px-3 py-2">{T.lastCorrection}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.rows.map((r) => (
                      <tr key={r.entryId} className="border-t border-zinc-100 dark:border-slate-800">
                        <td className="px-3 py-2">{r.worker}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.day}</td>
                        <td className="px-3 py-2">{localTime(r.clockIn, rec.timezone, locale)}</td>
                        <td className="px-3 py-2">{r.clockOut ? localTime(r.clockOut, rec.timezone, locale) : T.open}</td>
                        <td className="px-3 py-2">{formatMinutes(r.minutes)}</td>
                        <td className="px-3 py-2">{r.project ?? ""}</td>
                        <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {r.lastCorrection
                            ? `${new Date(r.lastCorrection.at).toLocaleString(locale)} ${
                                r.lastCorrection.by ? `${T.by} ${r.lastCorrection.by}` : ""
                              } (${r.corrections})`
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
