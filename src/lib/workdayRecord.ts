import { supabase } from "@/lib/supabase";

/**
 * Registro de jornada (España, art. 34.9 ET y el futuro registro digital):
 * por trabajador y día, entrada, salida, minutos y las correcciones que se hicieron.
 * Las correcciones las guarda la base de datos en un historial que no se puede borrar.
 */

export interface WorkdayCorrection {
  at: string;
  by: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface WorkdayRow {
  entryId: string;
  worker: string;
  workerId: string;
  day: string;
  clockIn: string;
  clockOut: string | null;
  minutes: number | null;
  project: string | null;
  status: string | null;
  corrections: number;
  lastCorrection: WorkdayCorrection | null;
}

export interface WorkdayRecord {
  companyName: string;
  from: string;
  to: string;
  timezone: string;
  generatedAt: string;
  rows: WorkdayRow[];
}

export type WorkdayError = "not_allowed" | "link_invalid" | "not_ready" | "range_too_long" | "network";

function mapError(e: unknown): WorkdayError {
  const m = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/link_invalid/.test(m)) return "link_invalid";
  if (/not_allowed/.test(m)) return "not_allowed";
  if (/range_too_long/.test(m)) return "range_too_long";
  if (/does not exist|schema cache|Could not find the function/i.test(m)) return "not_ready";
  return "network";
}

export function recordFromJson(raw: unknown): WorkdayRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  const company = (r.company ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : [];
  return {
    companyName: String(company.name ?? ""),
    from: String(r.from ?? ""),
    to: String(r.to ?? ""),
    timezone: String(r.timezone ?? "UTC"),
    generatedAt: String(r.generated_at ?? new Date().toISOString()),
    rows: rows.map((x) => {
      const lc = x.last_correction as Record<string, unknown> | null | undefined;
      return {
        entryId: String(x.entry_id ?? ""),
        worker: String(x.worker ?? ""),
        workerId: String(x.worker_id ?? ""),
        day: String(x.day ?? ""),
        clockIn: String(x.clock_in ?? ""),
        clockOut: x.clock_out ? String(x.clock_out) : null,
        minutes: x.minutes == null ? null : Number(x.minutes),
        project: x.project ? String(x.project) : null,
        status: x.status ? String(x.status) : null,
        corrections: Number(x.corrections ?? 0) || 0,
        lastCorrection: lc
          ? {
              at: String(lc.at ?? ""),
              by: lc.by ? String(lc.by) : null,
              before: (lc.before as Record<string, unknown>) ?? null,
              after: (lc.after as Record<string, unknown>) ?? null,
            }
          : null,
      };
    }),
  };
}

export async function fetchWorkdayRecord(opts: {
  from: string;
  to: string;
  timeZone: string;
  token?: string;
}): Promise<{ ok: true; data: WorkdayRecord } | { ok: false; error: WorkdayError }> {
  try {
    const { data, error } = await supabase.rpc("workday_record", {
      p_from: opts.from,
      p_to: opts.to,
      p_token: opts.token ?? null,
      p_tz: opts.timeZone || "UTC",
    });
    if (error) return { ok: false, error: mapError(error) };
    return { ok: true, data: recordFromJson(data) };
  } catch (e) {
    return { ok: false, error: mapError(e) };
  }
}

/** Hora local HH:MM de un instante en una zona. */
export function localTime(iso: string | null, timeZone: string, locale = "es-ES"): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

export function formatMinutes(m: number | null): string {
  if (m == null || !Number.isFinite(m)) return "";
  const h = Math.floor(m / 60);
  const mm = Math.abs(Math.round(m - h * 60));
  return `${h}:${String(mm).padStart(2, "0")}`;
}

const csvCell = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV con separador «;» (Excel en español lo abre bien). */
export function workdayRecordCsv(
  rec: WorkdayRecord,
  headers: {
    worker: string;
    day: string;
    clockIn: string;
    clockOut: string;
    hours: string;
    project: string;
    corrections: string;
    lastCorrection: string;
  },
  locale = "es-ES"
): string {
  const head = [
    headers.worker,
    headers.day,
    headers.clockIn,
    headers.clockOut,
    headers.hours,
    headers.project,
    headers.corrections,
    headers.lastCorrection,
  ];
  const lines = [head.map(csvCell).join(";")];
  for (const r of rec.rows) {
    const lc = r.lastCorrection
      ? `${r.lastCorrection.at.slice(0, 16).replace("T", " ")} ${r.lastCorrection.by ?? ""}`.trim()
      : "";
    lines.push(
      [
        r.worker,
        r.day,
        localTime(r.clockIn, rec.timezone, locale),
        localTime(r.clockOut, rec.timezone, locale),
        formatMinutes(r.minutes),
        r.project ?? "",
        String(r.corrections),
        lc,
      ]
        .map((v) => csvCell(String(v)))
        .join(";")
    );
  }
  return "﻿" + lines.join("\r\n");
}

export interface InspectionLink {
  id: string;
  token: string;
  label: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export async function listInspectionLinks(companyId: string): Promise<InspectionLink[]> {
  const { data, error } = await supabase
    .from("inspection_links")
    .select("id, token, label, expires_at, revoked_at, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    token: String(r.token),
    label: r.label ? String(r.label) : null,
    expiresAt: String(r.expires_at),
    revokedAt: r.revoked_at ? String(r.revoked_at) : null,
    createdAt: String(r.created_at),
  }));
}

export async function createInspectionLink(
  days: number,
  label: string,
  timeZone: string
): Promise<{ ok: true; token: string } | { ok: false; error: WorkdayError }> {
  try {
    const { data, error } = await supabase.rpc("inspection_link_create", {
      p_days: days,
      p_label: label || null,
      p_tz: timeZone || "UTC",
    });
    if (error) return { ok: false, error: mapError(error) };
    return { ok: true, token: String((data as Record<string, unknown>)?.token ?? "") };
  } catch (e) {
    return { ok: false, error: mapError(e) };
  }
}

export async function revokeInspectionLink(id: string): Promise<boolean> {
  const { error } = await supabase.rpc("inspection_link_revoke", { p_id: id });
  return !error;
}

export const inspectionLinkUrl = (origin: string, token: string) => `${origin.replace(/\/$/, "")}/inspeccion/${token}`;

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
