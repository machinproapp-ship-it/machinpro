import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormInstance, FormTemplate } from "@/types/forms";

/** Embedded in `field_values` when `template_id` is null (plantillas base por slug). */
export const MACHIN_FORM_TEMPLATE_SLUG_KEY = "__machin_tpl";

const TPL_UUID_MAP_LS = "machinpro_form_tpl_uuid_map_v1";

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function readTplUuidMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TPL_UUID_MAP_LS);
    const o = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {}
  }
}

function writeTplUuidMap(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TPL_UUID_MAP_LS, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Resolves a non-UUID template id to a stable UUID for Supabase FK + upsert. */
export function getOrCreateTemplateUuid(localTemplateId: string): string {
  if (isUuid(localTemplateId)) return localTemplateId;
  const map = readTplUuidMap();
  if (map[localTemplateId] && isUuid(map[localTemplateId])) return map[localTemplateId];
  const id = crypto.randomUUID();
  map[localTemplateId] = id;
  writeTplUuidMap(map);
  return id;
}

export function mapDbRowToFormInstance(row: Record<string, unknown>): FormInstance {
  const fvRaw = row.field_values;
  const fv =
    fvRaw && typeof fvRaw === "object" && !Array.isArray(fvRaw)
      ? { ...(fvRaw as Record<string, unknown>) }
      : {};
  let templateId = "";
  if (row.template_id != null && String(row.template_id).length > 0) {
    templateId = String(row.template_id);
  } else if (typeof fv[MACHIN_FORM_TEMPLATE_SLUG_KEY] === "string") {
    templateId = fv[MACHIN_FORM_TEMPLATE_SLUG_KEY] as string;
  }
  delete fv[MACHIN_FORM_TEMPLATE_SLUG_KEY];

  const attendeesRaw = row.attendees;
  const attendees = Array.isArray(attendeesRaw) ? attendeesRaw : [];

  return {
    id: String(row.id ?? ""),
    templateId,
    projectId: row.project_id != null ? String(row.project_id) : "",
    contextType:
      (row.context_type as FormInstance["contextType"]) ?? (row.project_id ? "project" : "general"),
    contextId: row.context_id != null ? String(row.context_id) : null,
    contextName: row.context_name != null ? String(row.context_name) : null,
    createdBy: row.created_by != null ? String(row.created_by) : "",
    createdAt:
      row.created_at != null
        ? new Date(String(row.created_at)).toISOString()
        : new Date().toISOString(),
    date: row.date != null ? String(row.date).slice(0, 10) : "",
    status: (row.status as FormInstance["status"]) ?? "draft",
    fieldValues: fv as Record<string, unknown>,
    attendees: attendees as FormInstance["attendees"],
    signToken: row.sign_token != null ? String(row.sign_token) : "",
    tokenExpiresAt:
      row.token_expires_at != null
        ? new Date(String(row.token_expires_at)).toISOString()
        : new Date().toISOString(),
    pdfUrl: row.pdf_url != null ? String(row.pdf_url) : undefined,
    docNumber: row.doc_number != null ? String(row.doc_number) : undefined,
  };
}

export function mapFormInstanceToDbRow(
  instance: FormInstance,
  companyId: string
): Record<string, unknown> {
  const baseFv = { ...instance.fieldValues };
  let templateIdDb: string | null = null;
  if (isUuid(instance.templateId)) {
    templateIdDb = instance.templateId;
  } else {
    templateIdDb = null;
    baseFv[MACHIN_FORM_TEMPLATE_SLUG_KEY] = instance.templateId;
  }

  let id = instance.id;
  if (!isUuid(id)) {
    id = crypto.randomUUID();
  }

  const createdByUuid = isUuid(instance.createdBy) ? instance.createdBy : null;

  return {
    id,
    company_id: companyId,
    template_id: templateIdDb,
    project_id: instance.projectId || null,
    context_type: instance.contextType ?? "project",
    context_id: instance.contextId ?? null,
    context_name: instance.contextName ?? null,
    created_by: createdByUuid,
    created_at: instance.createdAt
      ? new Date(instance.createdAt).toISOString()
      : new Date().toISOString(),
    date: instance.date || new Date().toISOString().slice(0, 10),
    status: instance.status,
    field_values: baseFv,
    attendees: instance.attendees,
    sign_token: instance.signToken?.trim() ? instance.signToken : null,
    token_expires_at: instance.tokenExpiresAt
      ? new Date(instance.tokenExpiresAt).toISOString()
      : null,
    pdf_url: instance.pdfUrl ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbRowToFormTemplate(row: Record<string, unknown>): FormTemplate {
  const regionRaw = row.region;
  const region = Array.isArray(regionRaw)
    ? regionRaw.map((x) => String(x))
    : typeof regionRaw === "string"
      ? [regionRaw]
      : [];

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: row.description != null ? String(row.description) : undefined,
    region,
    category: String(row.category ?? "general"),
    isBase: Boolean(row.is_base),
    sections: (Array.isArray(row.sections) ? row.sections : []) as FormTemplate["sections"],
    requiresAllSignatures: Boolean(row.requires_all_signatures),
    expiresInHours: Number(row.expires_in_hours ?? 168),
    createdAt:
      row.created_at != null
        ? new Date(String(row.created_at)).toISOString()
        : new Date().toISOString(),
    createdBy: row.created_by != null ? String(row.created_by) : "",
    language: String(row.language ?? "es"),
  };
}

export function mapFormTemplateToDbRow(
  template: FormTemplate,
  companyId: string
): Record<string, unknown> {
  const id = isUuid(template.id) ? template.id : getOrCreateTemplateUuid(template.id);

  const createdByUuid = isUuid(template.createdBy) ? template.createdBy : null;

  return {
    id,
    company_id: companyId,
    name: template.name,
    description: template.description ?? null,
    region: template.region ?? [],
    category: template.category ?? "general",
    is_base: template.isBase,
    sections: template.sections ?? [],
    requires_all_signatures: template.requiresAllSignatures ?? false,
    expires_in_hours: template.expiresInHours ?? 168,
    language: template.language ?? "es",
    created_by: createdByUuid,
    updated_at: new Date().toISOString(),
  };
}

export async function loadFormInstancesFromSupabase(
  client: SupabaseClient,
  companyId: string
): Promise<FormInstance[] | null> {
  try {
    const { data, error } = await client
      .from("form_instances")
      .select("*")
      .eq("company_id", companyId);
    if (error) return null;
    return (data ?? []).map((row) => mapDbRowToFormInstance(row as Record<string, unknown>));
  } catch {
    return null;
  }
}

export async function saveFormInstanceToSupabase(
  client: SupabaseClient,
  instance: FormInstance,
  companyId: string
): Promise<boolean> {
  try {
    const row = mapFormInstanceToDbRow(instance, companyId);
    const { error } = await client.from("form_instances").upsert(row, { onConflict: "id" });
    return !error;
  } catch {
    return false;
  }
}

export async function loadFormTemplatesFromSupabase(
  client: SupabaseClient,
  companyId: string
): Promise<FormTemplate[] | null> {
  try {
    const { data, error } = await client.from("form_templates").select("*").eq("company_id", companyId);
    if (error) return null;
    return (data ?? []).map((row) => mapDbRowToFormTemplate(row as Record<string, unknown>));
  } catch {
    return null;
  }
}

export async function saveFormTemplateToSupabase(
  client: SupabaseClient,
  template: FormTemplate,
  companyId: string
): Promise<boolean> {
  try {
    if (template.isBase) return true;
    const row = mapFormTemplateToDbRow(template, companyId);
    const { error } = await client.from("form_templates").upsert(row, { onConflict: "id" });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteFormInstanceFromSupabase(
  client: SupabaseClient,
  id: string
): Promise<boolean> {
  try {
    const { error } = await client.from("form_instances").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
