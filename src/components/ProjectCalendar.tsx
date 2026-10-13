"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  PROJECT_CALENDAR_KINDS,
  ackCoversEvents,
  addProjectCalendarComment,
  createProjectCalendarEvent,
  deleteProjectCalendarEvent,
  fetchProjectCalendarCommentCounts,
  fetchProjectCalendarComments,
  fetchProjectCalendarEvents,
  fetchProjectDayAcks,
  monthGrid,
  updateProjectCalendarEvent,
  type ProjectCalendarComment,
  type ProjectCalendarEvent,
  type ProjectCalendarKind,
  type ProjectDayAck,
} from "@/lib/projectCalendar";

const L = (d: Record<string, string>, k: string, fb: string) => d[k] ?? fb;

export const KIND_STYLE: Record<ProjectCalendarKind, string> = {
  task: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  visit: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  delivery: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  inspection: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
  note: "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
  other: "bg-zinc-100 text-zinc-800 dark:bg-slate-800 dark:text-zinc-200",
};

export function kindLabel(lx: Record<string, string>, k: ProjectCalendarKind): string {
  const fb: Record<ProjectCalendarKind, string> = {
    task: "Tarea",
    visit: "Visita",
    delivery: "Entrega",
    inspection: "Inspección",
    note: "Aviso",
    other: "Otro",
  };
  return L(lx, `pcal_kind_${k}`, fb[k]);
}

export type ProjectCalendarShift = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  employeeIds: string[];
};

type Props = {
  projectId: string;
  labels: Record<string, string>;
  dateLocale: string;
  todayYmd: string;
  initialDate?: string | null;
  canManage: boolean;
  canNote: boolean;
  currentUserId: string | null;
  /** Turnos de esta obra (para ver quién trabaja cada día). */
  shifts: ProjectCalendarShift[];
  nameById: Record<string, string>;
  /** Personas de la obra (para ver quién ha dado el enterado). */
  members: { id: string; name: string }[];
};

type Draft = {
  id: string | null;
  date: string;
  kind: ProjectCalendarKind;
  startTime: string;
  endTime: string;
  title: string;
  notes: string;
};

const input =
  "min-h-[44px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-100";

export function ProjectCalendar({
  projectId,
  labels: lx,
  dateLocale,
  todayYmd,
  initialDate,
  canManage,
  canNote,
  currentUserId,
  shifts,
  nameById,
  members,
}: Props) {
  const start = initialDate || todayYmd;
  const [cursor, setCursor] = useState(() => ({
    y: parseInt(start.slice(0, 4), 10),
    m: parseInt(start.slice(5, 7), 10) - 1,
  }));
  const [selected, setSelected] = useState(start);
  const [events, setEvents] = useState<ProjectCalendarEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [acks, setAcks] = useState<ProjectDayAck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [thread, setThread] = useState<ProjectCalendarComment[]>([]);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const days = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const rangeFrom = days[0]!;
  const rangeTo = days[days.length - 1]!;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const evs = await fetchProjectCalendarEvents(projectId, rangeFrom, rangeTo);
      setEvents(evs);
      try {
        setCounts(await fetchProjectCalendarCommentCounts(evs.map((e) => e.id)));
      } catch {
        setCounts({});
      }
    } catch (e) {
      const m = String((e as { message?: string })?.message ?? e);
      setLoadError(
        /does not exist|relation|schema cache/i.test(m)
          ? L(lx, "pcal_not_ready", "El calendario de la obra aún no está activado.")
          : L(lx, "pcal_load_error", "No se pudo cargar el calendario. Revisa la conexión.")
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, rangeFrom, rangeTo, lx]);

  useEffect(() => {
    void load();
  }, [load]);

  const showAcks = canManage || canNote;
  useEffect(() => {
    if (!showAcks) return;
    let alive = true;
    fetchProjectDayAcks(projectId, selected)
      .then((a) => {
        if (alive) setAcks(a);
      })
      .catch(() => {
        if (alive) setAcks([]);
      });
    return () => {
      alive = false;
    };
  }, [projectId, selected, showAcks, events]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, ProjectCalendarEvent[]>();
    for (const e of events) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [events]);

  const shiftsByDay = useMemo(() => {
    const m = new Map<string, ProjectCalendarShift[]>();
    for (const s of shifts) {
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    }
    return m;
  }, [shifts]);

  const monthTitle = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(dateLocale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(Date.UTC(cursor.y, cursor.m, 1))
      );
    } catch {
      return `${cursor.m + 1}/${cursor.y}`;
    }
  }, [cursor, dateLocale]);

  const weekdayNames = useMemo(() => {
    try {
      const f = new Intl.DateTimeFormat(dateLocale, { weekday: "narrow", timeZone: "UTC" });
      return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2026, 0, 5 + i))));
    } catch {
      return ["L", "M", "X", "J", "V", "S", "D"];
    }
  }, [dateLocale]);

  const selectedLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(dateLocale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }).format(new Date(`${selected}T00:00:00Z`));
    } catch {
      return selected;
    }
  }, [selected, dateLocale]);

  const fmtTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(dateLocale, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 16).replace("T", " ");
    }
  };

  const dayEvents = eventsByDay.get(selected) ?? [];
  const dayShifts = shiftsByDay.get(selected) ?? [];
  const peopleWorking = useMemo(() => {
    const ids = new Set<string>();
    for (const s of dayShifts) for (const id of s.employeeIds) ids.add(id);
    return ids;
  }, [dayShifts]);

  const ackRows = useMemo(() => {
    const pool = members.filter((m) => peopleWorking.size === 0 || peopleWorking.has(m.id));
    return pool.map((m) => ({ ...m, ack: ackCoversEvents(acks, m.id, dayEvents) }));
  }, [members, peopleWorking, acks, dayEvents]);

  const newDraft = () => {
    setActionError(null);
    setDraft({
      id: null,
      date: selected,
      kind: canManage ? "task" : "note",
      startTime: "",
      endTime: "",
      title: "",
      notes: "",
    });
  };

  const editDraft = (e: ProjectCalendarEvent) => {
    setActionError(null);
    setDraft({
      id: e.id,
      date: e.date,
      kind: e.kind,
      startTime: e.startTime ?? "",
      endTime: e.endTime ?? "",
      title: e.title,
      notes: e.notes ?? "",
    });
  };

  const saveDraft = async () => {
    if (!draft || !draft.title.trim() || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      if (draft.id) {
        await updateProjectCalendarEvent(draft.id, {
          date: draft.date,
          kind: draft.kind,
          startTime: draft.startTime,
          endTime: draft.endTime,
          title: draft.title,
          notes: draft.notes,
        });
      } else {
        await createProjectCalendarEvent({
          projectId,
          date: draft.date,
          kind: draft.kind,
          startTime: draft.startTime,
          endTime: draft.endTime,
          title: draft.title,
          notes: draft.notes,
        });
      }
      setDraft(null);
      setSelected(draft.date);
      await load();
    } catch {
      setActionError(L(lx, "pcal_save_error", "No se pudo guardar. Revisa la conexión o tus permisos."));
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (e: ProjectCalendarEvent) => {
    if (typeof window !== "undefined" && !window.confirm(L(lx, "pcal_delete_confirm", "¿Borrar esta entrada del calendario?"))) {
      return;
    }
    setActionError(null);
    try {
      await deleteProjectCalendarEvent(e.id);
      await load();
    } catch {
      setActionError(L(lx, "pcal_delete_error", "No se pudo borrar."));
    }
  };

  const toggleThread = async (id: string) => {
    if (openThread === id) {
      setOpenThread(null);
      return;
    }
    setOpenThread(id);
    setThread([]);
    setMsg("");
    try {
      setThread(await fetchProjectCalendarComments(id));
    } catch {
      setThread([]);
    }
  };

  const sendMsg = async () => {
    if (!openThread || !msg.trim() || sending) return;
    setSending(true);
    try {
      const c = await addProjectCalendarComment(openThread, msg);
      setThread((prev) => [...prev, c]);
      setCounts((prev) => ({ ...prev, [openThread]: (prev[openThread] ?? 0) + 1 }));
      setMsg("");
    } catch {
      setActionError(L(lx, "pcal_send_error", "No se pudo enviar el mensaje."));
    } finally {
      setSending(false);
    }
  };

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.y, c.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  };

  const goToday = () => {
    setCursor({ y: parseInt(todayYmd.slice(0, 4), 10), m: parseInt(todayYmd.slice(5, 7), 10) - 1 });
    setSelected(todayYmd);
  };

  const canEditEvent = (e: ProjectCalendarEvent) =>
    canManage || (canNote && e.kind === "note" && !!currentUserId && e.createdBy === currentUserId);

  return (
    <div className="space-y-4">
      {/* Mes */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold capitalize text-zinc-900 dark:text-white">
            <CalendarDays className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <span className="truncate">{monthTitle}</span>
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label={L(lx, "pcal_prev_month", "Mes anterior")}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:text-zinc-200 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="h-11 rounded-lg border border-amber-500 px-3 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
            >
              {L(lx, "today", "Hoy")}
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label={L(lx, "pcal_next_month", "Mes siguiente")}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:text-zinc-200 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {weekdayNames.map((w, i) => (
            <span key={i} className="py-1 uppercase">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((ymd) => {
            const inMonth = parseInt(ymd.slice(5, 7), 10) - 1 === cursor.m;
            const isSel = ymd === selected;
            const isToday = ymd === todayYmd;
            const nEv = eventsByDay.get(ymd)?.length ?? 0;
            const hasShift = (shiftsByDay.get(ymd)?.length ?? 0) > 0;
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => setSelected(ymd)}
                aria-pressed={isSel}
                className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border text-sm transition-colors ${
                  isSel
                    ? "border-amber-500 bg-amber-50 font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                    : isToday
                      ? "border-amber-300 text-zinc-900 dark:border-amber-700 dark:text-zinc-100"
                      : "border-transparent text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-slate-800"
                } ${inMonth ? "" : "opacity-40"}`}
              >
                <span className="tabular-nums">{parseInt(ymd.slice(8, 10), 10)}</span>
                <span className="mt-0.5 flex h-1.5 items-center gap-0.5" aria-hidden>
                  {nEv > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
                  {hasShift ? <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
            {L(lx, "pcal_legend_entries", "Tareas y avisos")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden />
            {L(lx, "pcal_legend_shifts", "Hay gente trabajando")}
          </span>
        </p>
      </section>

      {/* Día */}
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold capitalize text-zinc-900 dark:text-white">{selectedLabel}</h3>
          {canManage || canNote ? (
            <button
              type="button"
              onClick={newDraft}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-500"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {canManage ? L(lx, "pcal_add", "Añadir") : L(lx, "pcal_add_note", "Añadir aviso")}
            </button>
          ) : null}
        </div>

        {loadError ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {loadError}
          </p>
        ) : null}
        {actionError ? (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {actionError}
          </p>
        ) : null}

        {dayShifts.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              {L(lx, "pcal_working", "Trabajan")}
            </p>
            <ul className="space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
              {dayShifts.map((s) => (
                <li key={s.id} className="rounded-lg bg-teal-50 px-3 py-2 dark:bg-teal-950/30">
                  <span className="tabular-nums font-medium">
                    {s.startTime}–{s.endTime}
                  </span>{" "}
                  · {s.employeeIds.map((id) => nameById[id] ?? "—").join(", ")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{L(lx, "loading", "Cargando…")}</p>
        ) : dayEvents.length === 0 && !loadError ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {L(lx, "pcal_day_empty", "Nada apuntado para este día.")}
          </p>
        ) : (
          <ul className="space-y-2">
            {dayEvents.map((e) => (
              <li key={e.id} className="rounded-xl border border-zinc-200 p-3 dark:border-slate-700">
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
                <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{e.title}</p>
                {e.notes ? (
                  <p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{e.notes}</p>
                ) : null}
                {e.createdByName ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {L(lx, "pcal_by", "Por {name}").replace("{name}", e.createdByName)}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleThread(e.id)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:text-zinc-200 dark:hover:bg-slate-800"
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden />
                    {L(lx, "pcal_thread", "Conversación")}
                    {counts[e.id] ? ` (${counts[e.id]})` : ""}
                  </button>
                  {canEditEvent(e) ? (
                    <button
                      type="button"
                      onClick={() => editDraft(e)}
                      aria-label={L(lx, "edit", "Editar")}
                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-slate-600 dark:text-zinc-200 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => void removeEvent(e)}
                      aria-label={L(lx, "delete", "Borrar")}
                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>

                {openThread === e.id ? (
                  <div className="mt-3 space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-slate-800/60">
                    {thread.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {L(lx, "pcal_thread_empty", "Aún no hay mensajes.")}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {thread.map((c) => (
                          <li
                            key={c.id}
                            className={`rounded-lg px-3 py-2 text-sm ${
                              c.authorId === currentUserId
                                ? "ml-6 bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
                                : "mr-6 bg-white text-zinc-900 dark:bg-slate-900 dark:text-zinc-100"
                            }`}
                          >
                            <p className="text-xs font-semibold opacity-80">
                              {c.authorName ?? "—"} · {fmtTime(c.createdAt)}
                            </p>
                            <p className="whitespace-pre-line">{c.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {canNote ? (
                      <div className="flex gap-2">
                        <textarea
                          value={msg}
                          onChange={(ev) => setMsg(ev.target.value)}
                          rows={2}
                          maxLength={2000}
                          placeholder={L(lx, "pcal_message_ph", "Escribe un mensaje…")}
                          className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-slate-600 dark:bg-slate-900 dark:text-zinc-100"
                        />
                        <button
                          type="button"
                          onClick={() => void sendMsg()}
                          disabled={sending || !msg.trim()}
                          className="min-h-[44px] self-end rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                        >
                          {sending ? "…" : L(lx, "pcal_send", "Enviar")}
                        </button>
                      </div>
                    ) : null}
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {L(lx, "pcal_thread_hint", "Los mensajes quedan guardados y no se pueden borrar.")}
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {showAcks && ackRows.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              {L(lx, "pcal_acks_title", "Enterados del día")}
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {ackRows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-slate-700"
                >
                  <span className="truncate text-zinc-800 dark:text-zinc-200">{r.name}</span>
                  {r.ack ? (
                    <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      ✓ {fmtTime(r.ack.ackedAt)}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400">
                      {L(lx, "pcal_ack_pending", "Pendiente")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Formulario */}
      {draft ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-slate-900 sm:max-w-lg sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {draft.id ? L(lx, "pcal_edit_title", "Cambiar entrada") : L(lx, "pcal_new_title", "Nueva entrada")}
              </h3>
              <button
                type="button"
                onClick={() => setDraft(null)}
                aria-label={L(lx, "close", "Cerrar")}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="space-y-3">
              {canManage ? (
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {L(lx, "pcal_kind", "Tipo")}
                  <select
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value as ProjectCalendarKind })}
                    className={`${input} mt-1`}
                  >
                    {PROJECT_CALENDAR_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {kindLabel(lx, k)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {L(lx, "pcal_date", "Día")}
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value || draft.date })}
                  className={`${input} mt-1`}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {L(lx, "pcal_from", "Desde")}
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                    className={`${input} mt-1`}
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {L(lx, "pcal_to", "Hasta")}
                  <input
                    type="time"
                    value={draft.endTime}
                    onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                    className={`${input} mt-1`}
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {L(lx, "pcal_title", "Qué")}
                <input
                  value={draft.title}
                  maxLength={200}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder={L(lx, "pcal_title_ph", "Ej.: Visita del inspector municipal")}
                  className={`${input} mt-1`}
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {L(lx, "pcal_notes", "Detalles")}
                <textarea
                  value={draft.notes}
                  maxLength={4000}
                  rows={3}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder={L(lx, "pcal_notes_ph", "Zona, quién viene, qué hay que preparar…")}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-slate-600 dark:bg-slate-800 dark:text-zinc-100"
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="min-h-[44px] rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 dark:border-slate-600 dark:text-zinc-200"
                >
                  {L(lx, "cancel", "Cancelar")}
                </button>
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  disabled={saving || !draft.title.trim()}
                  className="min-h-[44px] rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {saving ? "…" : L(lx, "save", "Guardar")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
