import { supabase } from "@/lib/supabase";

/** Calendario de la obra: visitas, entregas, inspecciones, tareas y avisos de un día concreto. */
export type ProjectCalendarKind = "task" | "visit" | "delivery" | "inspection" | "note" | "other";

export const PROJECT_CALENDAR_KINDS: ProjectCalendarKind[] = [
  "task",
  "visit",
  "delivery",
  "inspection",
  "note",
  "other",
];

export type ProjectCalendarEvent = {
  id: string;
  projectId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  kind: ProjectCalendarKind;
  title: string;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectCalendarComment = {
  id: string;
  eventId: string;
  body: string;
  authorId: string;
  authorName: string | null;
  createdAt: string;
};

export type ProjectDayAck = {
  id: string;
  projectId: string;
  date: string;
  userId: string;
  userName: string | null;
  eventIds: string[];
  ackedAt: string;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function eventFromRow(r: Record<string, unknown>): ProjectCalendarEvent {
  const kind = String(r.kind ?? "task") as ProjectCalendarKind;
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    date: String(r.event_date).slice(0, 10),
    startTime: str(r.start_time),
    endTime: str(r.end_time),
    kind: PROJECT_CALENDAR_KINDS.includes(kind) ? kind : "other",
    title: String(r.title ?? ""),
    notes: str(r.notes),
    createdBy: str(r.created_by),
    createdByName: str(r.created_by_name),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? r.created_at ?? ""),
  };
}

function commentFromRow(r: Record<string, unknown>): ProjectCalendarComment {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    body: String(r.body ?? ""),
    authorId: String(r.author_id ?? ""),
    authorName: str(r.author_name),
    createdAt: String(r.created_at ?? ""),
  };
}

function ackFromRow(r: Record<string, unknown>): ProjectDayAck {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    date: String(r.ack_date).slice(0, 10),
    userId: String(r.user_id),
    userName: str(r.user_name),
    eventIds: Array.isArray(r.event_ids) ? (r.event_ids as unknown[]).map(String) : [],
    ackedAt: String(r.acked_at ?? ""),
  };
}

/** Entradas de la obra entre dos fechas (incluidas), sin las borradas. */
export async function fetchProjectCalendarEvents(
  projectId: string,
  fromYmd: string,
  toYmd: string
): Promise<ProjectCalendarEvent[]> {
  const { data, error } = await supabase
    .from("project_calendar_events")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .gte("event_date", fromYmd)
    .lte("event_date", toYmd)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(eventFromRow);
}

export type ProjectCalendarEventInput = {
  projectId: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  kind: ProjectCalendarKind;
  title: string;
  notes?: string | null;
};

export async function createProjectCalendarEvent(
  input: ProjectCalendarEventInput
): Promise<ProjectCalendarEvent> {
  const { data, error } = await supabase
    .from("project_calendar_events")
    .insert({
      project_id: input.projectId,
      event_date: input.date,
      start_time: input.startTime || null,
      end_time: input.endTime || null,
      kind: input.kind,
      title: input.title.trim(),
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return eventFromRow(data as Record<string, unknown>);
}

export async function updateProjectCalendarEvent(
  id: string,
  patch: Partial<Omit<ProjectCalendarEventInput, "projectId">>
): Promise<ProjectCalendarEvent> {
  const row: Record<string, unknown> = {};
  if (patch.date !== undefined) row.event_date = patch.date;
  if (patch.startTime !== undefined) row.start_time = patch.startTime || null;
  if (patch.endTime !== undefined) row.end_time = patch.endTime || null;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.notes !== undefined) row.notes = patch.notes?.trim() ? patch.notes.trim() : null;
  const { data, error } = await supabase
    .from("project_calendar_events")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return eventFromRow(data as Record<string, unknown>);
}

/** Borrar = marcar como borrada (queda constancia). */
export async function deleteProjectCalendarEvent(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("project_calendar_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("forbidden");
}

export async function fetchProjectCalendarComments(eventId: string): Promise<ProjectCalendarComment[]> {
  const { data, error } = await supabase
    .from("project_calendar_comments")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(commentFromRow);
}

/** Cuántos mensajes tiene cada entrada (para el contador). */
export async function fetchProjectCalendarCommentCounts(eventIds: string[]): Promise<Record<string, number>> {
  if (eventIds.length === 0) return {};
  const { data, error } = await supabase
    .from("project_calendar_comments")
    .select("event_id")
    .in("event_id", eventIds);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { event_id: string }[]) out[r.event_id] = (out[r.event_id] ?? 0) + 1;
  return out;
}

export async function addProjectCalendarComment(eventId: string, body: string): Promise<ProjectCalendarComment> {
  const { data, error } = await supabase
    .from("project_calendar_comments")
    .insert({ event_id: eventId, body: body.trim() })
    .select("*")
    .single();
  if (error) throw error;
  return commentFromRow(data as Record<string, unknown>);
}

export async function fetchProjectDayAcks(projectId: string, date: string): Promise<ProjectDayAck[]> {
  const { data, error } = await supabase
    .from("project_day_acks")
    .select("*")
    .eq("project_id", projectId)
    .eq("ack_date", date)
    .order("acked_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(ackFromRow);
}

export async function addProjectDayAck(projectId: string, date: string, eventIds: string[]): Promise<ProjectDayAck> {
  const { data, error } = await supabase
    .from("project_day_acks")
    .insert({ project_id: projectId, ack_date: date, event_ids: eventIds })
    .select("*")
    .single();
  if (error) throw error;
  return ackFromRow(data as Record<string, unknown>);
}

/**
 * ¿Ha dado el enterado de todo lo que hay hoy? Si después se añade o cambia algo,
 * vuelve a estar pendiente.
 */
export function ackCoversEvents(acks: ProjectDayAck[], userId: string, events: ProjectCalendarEvent[]): ProjectDayAck | null {
  const mine = acks.filter((a) => a.userId === userId).sort((a, b) => b.ackedAt.localeCompare(a.ackedAt));
  const last = mine[0];
  if (!last) return null;
  const seen = new Set(last.eventIds);
  for (const e of events) {
    if (!seen.has(e.id)) return null;
    if (e.updatedAt && e.updatedAt > last.ackedAt) return null;
  }
  return last;
}

/** Helpers de fechas YYYY-MM-DD sin depender de la zona del navegador. */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function monthGrid(year: number, month0: number): string[] {
  const first = new Date(Date.UTC(year, month0, 1));
  const dow = first.getUTCDay();
  const start = addDaysYmd(first.toISOString().slice(0, 10), dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 42 }, (_, i) => addDaysYmd(start, i));
}
