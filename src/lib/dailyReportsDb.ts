import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DailyFieldReport,
  DailyReportAttendance,
  DailyReportHazard,
  DailyReportPhoto,
  DailyReportSignature,
  DailyReportSignatureMethod,
  DailyReportTask,
  DailyReportWeather,
} from "@/types/dailyFieldReport";

type RawReport = Record<string, unknown>;

function asStr(v: unknown): string {
  return v == null ? "" : String(v);
}

function mapTask(row: RawReport): DailyReportTask {
  return {
    id: asStr(row.id),
    reportId: row.report_id != null ? asStr(row.report_id) : undefined,
    employeeId: row.employee_id != null ? asStr(row.employee_id) : null,
    description: asStr(row.description),
    completed: row.completed === true,
  };
}

function mapHazard(row: RawReport): DailyReportHazard {
  const ppe = row.ppe_required;
  return {
    id: asStr(row.id),
    reportId: row.report_id != null ? asStr(row.report_id) : undefined,
    description: asStr(row.description),
    ppeRequired: Array.isArray(ppe) ? (ppe as string[]) : [],
  };
}

function mapPhoto(row: RawReport): DailyReportPhoto {
  return {
    id: asStr(row.id),
    url: asStr(row.url),
    cloudinaryId: row.cloudinary_id != null ? asStr(row.cloudinary_id) : null,
    createdAt: row.created_at != null ? asStr(row.created_at) : undefined,
  };
}

function mapSignature(row: RawReport): DailyReportSignature {
  return {
    id: asStr(row.id),
    employeeId: asStr(row.employee_id),
    signedAt: asStr(row.signed_at),
    method:
      row.method === "drawing" || row.method === "tap_named" || row.method === "tap"
        ? row.method
        : "tap",
    signatureData: row.signature_data != null ? asStr(row.signature_data) : null,
  };
}

function mapAttendance(row: RawReport): DailyReportAttendance {
  const st = asStr(row.status);
  const status = st === "absent" || st === "late" ? st : "present";
  return {
    id: asStr(row.id),
    employeeId: asStr(row.employee_id),
    status,
    fromTimeclock: row.from_timeclock === true,
  };
}

export function reportFromRow(
  row: RawReport,
  nameByProfileId: Record<string, string>,
  projectName: string
): DailyFieldReport {
  const weatherRaw = asStr(row.weather);
  const weather: DailyReportWeather =
    weatherRaw === "cloudy" ||
    weatherRaw === "rain" ||
    weatherRaw === "wind" ||
    weatherRaw === "snow" ||
    weatherRaw === "sunny"
      ? weatherRaw
      : "sunny";
  const statusRaw = asStr(row.status);
  const status: DailyFieldReport["status"] =
    statusRaw === "published" || statusRaw === "approved"
      ? statusRaw
      : "draft";
  const ppe = row.ppe_selected;
  return {
    id: asStr(row.id),
    companyId: asStr(row.company_id),
    projectId: asStr(row.project_id),
    projectName,
    createdBy: asStr(row.created_by),
    createdByName: nameByProfileId[asStr(row.created_by)] ?? "",
    date: String(row.date).slice(0, 10),
    weather,
    siteConditions: asStr(row.site_conditions),
    notes: asStr(row.notes),
    status,
    ppeSelected: Array.isArray(ppe) ? (ppe as string[]) : [],
    ppeOther: asStr(row.ppe_other),
    hazards: [],
    tasks: [],
    photos: [],
    signatures: [],
    attendance: [],
    createdAt: asStr(row.created_at),
    updatedAt: row.updated_at != null ? asStr(row.updated_at) : undefined,
  };
}

function attachNames<T extends { employeeId?: string | null; employeeName?: string }>(
  rows: T[],
  nameByProfileId: Record<string, string>
): T[] {
  return rows.map((r) => {
    const id = r.employeeId;
    if (id && nameByProfileId[id]) {
      return { ...r, employeeName: nameByProfileId[id] };
    }
    return r;
  });
}

export async function fetchDailyReportsForCompany(
  client: SupabaseClient,
  companyId: string
): Promise<DailyFieldReport[]> {
  const { data: reports, error } = await client
    .from("daily_reports")
    .select(
      `
      *,
      daily_report_tasks (*),
      daily_report_hazards (*),
      daily_report_photos (*),
      daily_report_signatures (*),
      daily_report_attendance (*)
    `
    )
    .eq("company_id", companyId)
    .order("date", { ascending: false })
    .limit(500);

  if (error) {
    console.error("fetchDailyReportsForCompany", error);
    return [];
  }

  const { data: profiles } = await client
    .from("user_profiles")
    .select("id, full_name, display_name")
    .eq("company_id", companyId);

  const nameByProfileId: Record<string, string> = {};
  for (const p of profiles ?? []) {
    const row = p as Record<string, unknown>;
    const id = asStr(row.id);
    const nm =
      (typeof row.full_name === "string" && row.full_name.trim()
        ? row.full_name
        : typeof row.display_name === "string" && row.display_name.trim()
          ? row.display_name
          : "") || "";
    if (id) nameByProfileId[id] = nm;
  }

  const { data: projects } = await client.from("projects").select("id, name").eq("company_id", companyId);
  const projectNameById: Record<string, string> = {};
  for (const p of projects ?? []) {
    const row = p as Record<string, unknown>;
    projectNameById[asStr(row.id)] = asStr(row.name);
  }

  const out: DailyFieldReport[] = [];
  for (const raw of reports ?? []) {
    const r = raw as RawReport & {
      daily_report_tasks?: RawReport[];
      daily_report_hazards?: RawReport[];
      daily_report_photos?: RawReport[];
      daily_report_signatures?: RawReport[];
      daily_report_attendance?: RawReport[];
    };
    const projectId = asStr(r.project_id);
    const base = reportFromRow(r, nameByProfileId, projectNameById[projectId] ?? "");
    base.tasks = attachNames((r.daily_report_tasks ?? []).map(mapTask), nameByProfileId);
    base.hazards = (r.daily_report_hazards ?? []).map(mapHazard);
    base.photos = (r.daily_report_photos ?? []).map(mapPhoto);
    base.signatures = attachNames((r.daily_report_signatures ?? []).map(mapSignature), nameByProfileId);
    base.attendance = attachNames((r.daily_report_attendance ?? []).map(mapAttendance), nameByProfileId);
    out.push(base);
  }
  return out;
}

async function insertChildRows(
  client: SupabaseClient,
  reportId: string,
  report: DailyFieldReport
): Promise<{ error: Error | null }> {
  if (report.tasks.length) {
    const { error } = await client.from("daily_report_tasks").insert(
      report.tasks.map((t) => ({
        id: t.id,
        report_id: reportId,
        employee_id: t.employeeId,
        description: t.description,
        completed: t.completed,
      }))
    );
    if (error) return { error: new Error(error.message) };
  }
  if (report.hazards.length) {
    const { error } = await client.from("daily_report_hazards").insert(
      report.hazards.map((h) => ({
        id: h.id,
        report_id: reportId,
        description: h.description,
        ppe_required: h.ppeRequired,
      }))
    );
    if (error) return { error: new Error(error.message) };
  }
  if (report.photos.length) {
    const { error } = await client.from("daily_report_photos").insert(
      report.photos.map((p) => ({
        id: p.id,
        report_id: reportId,
        url: p.url,
        cloudinary_id: p.cloudinaryId ?? null,
      }))
    );
    if (error) return { error: new Error(error.message) };
  }
  if (report.attendance.length) {
    const { error } = await client.from("daily_report_attendance").insert(
      report.attendance.map((a) => ({
        id: a.id,
        report_id: reportId,
        employee_id: a.employeeId,
        status: a.status,
        from_timeclock: a.fromTimeclock ?? false,
      }))
    );
    if (error) return { error: new Error(error.message) };
  }
  if (report.signatures.length) {
    const { error } = await client.from("daily_report_signatures").insert(
      report.signatures.map((s) => ({
        id: s.id,
        report_id: reportId,
        employee_id: s.employeeId,
        signed_at: s.signedAt,
        method: s.method,
        signature_data: s.signatureData ?? null,
      }))
    );
    if (error) return { error: new Error(error.message) };
  }
  return { error: null };
}

/** Guardado completo desde la UI de supervisor/admin (borrador o al publicar). No usar en partes ya publicados salvo la transición inicial. */
export async function saveDailyReportFull(
  client: SupabaseClient,
  report: DailyFieldReport
): Promise<{ error: Error | null }> {
  const header = {
    id: report.id,
    company_id: report.companyId,
    project_id: report.projectId,
    created_by: report.createdBy,
    date: report.date,
    weather: report.weather,
    site_conditions: report.siteConditions,
    notes: report.notes,
    status: report.status,
    ppe_selected: report.ppeSelected,
    ppe_other: report.ppeOther,
  };

  const { error: upErr } = await client.from("daily_reports").upsert(header);
  if (upErr) return { error: new Error(upErr.message) };

  const reportId = report.id;

  await client.from("daily_report_tasks").delete().eq("report_id", reportId);
  await client.from("daily_report_hazards").delete().eq("report_id", reportId);
  await client.from("daily_report_photos").delete().eq("report_id", reportId);
  await client.from("daily_report_attendance").delete().eq("report_id", reportId);
  await client.from("daily_report_signatures").delete().eq("report_id", reportId);

  return insertChildRows(client, reportId, report);
}

export async function patchTaskCompleted(
  client: SupabaseClient,
  taskId: string,
  completed: boolean
): Promise<{ error: Error | null }> {
  const { error } = await client.from("daily_report_tasks").update({ completed }).eq("id", taskId);
  return { error: error ? new Error(error.message) : null };
}

export async function insertSignature(
  client: SupabaseClient,
  row: {
    id: string;
    reportId: string;
    employeeId: string;
    method: DailyReportSignatureMethod;
    signatureData?: string | null;
  }
): Promise<{ error: Error | null }> {
  const { error } = await client.from("daily_report_signatures").insert({
    id: row.id,
    report_id: row.reportId,
    employee_id: row.employeeId,
    signed_at: new Date().toISOString(),
    method: row.method,
    signature_data: row.signatureData ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}
