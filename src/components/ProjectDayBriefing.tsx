"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import {
  ackCoversEvents,
  addProjectDayAck,
  fetchProjectCalendarEvents,
  fetchProjectDayAcks,
  type ProjectCalendarEvent,
  type ProjectDayAck,
} from "@/lib/projectCalendar";
import { KIND_STYLE, kindLabel } from "@/components/ProjectCalendar";

const L = (d: Record<string, string>, k: string, fb: string) => d[k] ?? fb;

/**
 * "Hoy en la obra": lo apuntado en el calendario de la obra para ese día y el botón "Enterado".
 * El enterado queda registrado (no se borra); si luego se añade o cambia algo, vuelve a pedirse.
 */
export function ProjectDayBriefing({
  projectId,
  date,
  labels: lx,
  dateLocale,
  currentUserId,
  canAck,
  extraPendingLabel,
  onAcked,
}: {
  projectId: string;
  date: string;
  labels: Record<string, string>;
  dateLocale: string;
  currentUserId: string | null;
  /** Solo el día de hoy o anteriores; no se da el enterado de días futuros. */
  canAck: boolean;
  /** Si hay algo más que se firma con el mismo toque (p. ej. el parte diario). */
  extraPendingLabel?: string | null;
  /** Se llama tras registrar el enterado (p. ej. para firmar el parte a la vez). */
  onAcked?: () => void | Promise<void>;
}) {
  const [events, setEvents] = useState<ProjectCalendarEvent[]>([]);
  const [acks, setAcks] = useState<ProjectDayAck[]>([]);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [evs, ak] = await Promise.all([
        fetchProjectCalendarEvents(projectId, date, date),
        fetchProjectDayAcks(projectId, date),
      ]);
      setEvents(evs);
      setAcks(ak);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      setReady(true);
    }
  }, [projectId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || unavailable) return null;
  if (events.length === 0 && !extraPendingLabel) return null;

  const myAck = currentUserId ? ackCoversEvents(acks, currentUserId, events) : null;

  const ack = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await addProjectDayAck(
        projectId,
        date,
        events.map((e) => e.id)
      );
      await onAcked?.();
      await load();
    } catch {
      setErr(L(lx, "pcal_ack_error", "No se pudo registrar. Revisa la conexión e inténtalo de nuevo."));
    } finally {
      setBusy(false);
    }
  };

  const ackTime = (() => {
    if (!myAck) return "";
    try {
      return new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(myAck.ackedAt));
    } catch {
      return myAck.ackedAt.slice(11, 16);
    }
  })();

  return (
    <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/20">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <ClipboardList className="h-4 w-4 text-amber-600" aria-hidden />
        {L(lx, "pcal_today_title", "Hoy en la obra")}
      </h2>
      {events.length > 0 ? (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-lg bg-white p-3 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${KIND_STYLE[e.kind]}`}>
                  {kindLabel(lx, e.kind)}
                </span>
                {e.startTime ? (
                  <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                    {e.startTime}
                    {e.endTime ? `–${e.endTime}` : ""}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{e.title}</p>
              {e.notes ? (
                <p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{e.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {extraPendingLabel ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{extraPendingLabel}</p>
      ) : null}
      {myAck && !extraPendingLabel ? (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {L(lx, "pcal_acked_at", "Enterado a las {time}").replace("{time}", ackTime)}
        </p>
      ) : canAck && currentUserId ? (
        <>
          <button
            type="button"
            onClick={() => void ack()}
            disabled={busy}
            className="min-h-[48px] w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "…" : L(lx, "pcal_ack_btn", "Enterado")}
          </button>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {L(lx, "pcal_ack_hint", "Confirmas que has leído lo que hay que hacer hoy. Queda registrado.")}
          </p>
        </>
      ) : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </section>
  );
}
