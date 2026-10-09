"use client";

import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/lib/supabase";
import type { InspectionFrequency } from "@/lib/logisticsDb";

/**
 * Inspecciones previas al uso.
 * El registro en `equipment_inspections` es INSERT-ONLY: la base de datos fija la hora del servidor,
 * el inspector, el nombre y número de serie del equipo y encadena cada registro con el anterior (SHA-256).
 * Este módulo nunca intenta editar ni borrar inspecciones.
 */

export const CLOUDINARY_CLOUD = "dwdlmxmkt";
export const CLOUDINARY_PRESET = "i5dmd07o";

export type InspectionItemKind = "inventory" | "fleet" | "rental";
export type InspectionResult = "pass" | "pass_with_notes" | "fail";
export type ChecklistAnswerStatus = "ok" | "defect" | "na";
export type InspectionCategory =
  | "aerial_lift"
  | "harness"
  | "ladder"
  | "vehicle"
  | "power_tool"
  | "scaffold"
  | "forklift"
  | "other";

export const INSPECTION_CATEGORIES: InspectionCategory[] = [
  "aerial_lift",
  "harness",
  "ladder",
  "vehicle",
  "power_tool",
  "scaffold",
  "forklift",
  "other",
];
export const INSPECTION_FREQUENCIES: InspectionFrequency[] = ["before_each_use", "daily", "weekly", "monthly", "yearly"];

export type ChecklistItem = { id: string; key?: string; fallback: string };

export type InspectionTemplate = {
  id: string;
  companyId: string | null;
  name: string;
  nameKey?: string;
  itemCategory: InspectionCategory;
  countryCodes: string[] | null;
  regulationRefs: Record<string, string>;
  checklist: ChecklistItem[];
  requiresPhoto: boolean;
  minPhotos: number;
  isBase: boolean;
};

export type ChecklistAnswer = { status: ChecklistAnswerStatus; note?: string };

export type EquipmentInspection = {
  id: string;
  companyId: string;
  itemKind: InspectionItemKind;
  itemId: string;
  itemLabel: string | null;
  itemSerial: string | null;
  projectId: string | null;
  templateId: string | null;
  templateSnapshot: {
    name?: string;
    name_key?: string;
    item_category?: string;
    regulation_refs?: Record<string, string>;
    checklist?: ChecklistItem[];
  } | null;
  answers: Record<string, ChecklistAnswer>;
  result: InspectionResult;
  defects: string | null;
  notes: string | null;
  photoUrls: string[];
  photoHashes: string[] | null;
  signatureUrl: string | null;
  declarationText: string | null;
  inspectorUserId: string;
  inspectorName: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracy: number | null;
  clientRecordedAt: string | null;
  serverRecordedAt: string;
  supersedesId: string | null;
  prevHash: string | null;
  contentHash: string;
};

export type EquipmentInspectionStatus = {
  companyId: string;
  itemKind: InspectionItemKind;
  itemId: string;
  itemLabel: string;
  itemSerial: string | null;
  inspectionFrequency: InspectionFrequency | null;
  inspectionTemplateId: string | null;
  projectId: string | null;
  lastInspectionAt: string | null;
  lastResult: InspectionResult | null;
  lastInspectorName: string | null;
  needsInspection: boolean;
};

/** Lo que el móvil envía. Inspector, hora del servidor, nombre/serie del equipo y huellas los pone la BD. */
export type NewInspectionInput = {
  companyId: string;
  itemKind: InspectionItemKind;
  itemId: string;
  projectId?: string | null;
  templateId?: string | null;
  answers: Record<string, ChecklistAnswer>;
  result: InspectionResult;
  defects?: string | null;
  notes?: string | null;
  photoUrls: string[];
  photoHashes: string[];
  signatureUrl?: string | null;
  declarationText: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
  deviceInfo?: string | null;
  locale?: string | null;
  countryCode?: string | null;
  clientRecordedAt: string;
  supersedesId?: string | null;
};

// ───────────────────────── mapeos ─────────────────────────

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}
function numOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function checklistFrom(v: unknown): ChecklistItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => obj(x))
    .filter((x) => typeof x.id === "string")
    .map((x) => ({ id: String(x.id), key: strOrNull(x.key) ?? undefined, fallback: String(x.fallback ?? x.id) }));
}

export function templateFromRow(r: Record<string, unknown>): InspectionTemplate {
  const refs = obj(r.regulation_refs);
  return {
    id: String(r.id),
    companyId: strOrNull(r.company_id),
    name: String(r.name ?? ""),
    nameKey: strOrNull(r.name_key) ?? undefined,
    itemCategory: (INSPECTION_CATEGORIES.includes(r.item_category as InspectionCategory)
      ? r.item_category
      : "other") as InspectionCategory,
    countryCodes: Array.isArray(r.country_codes) ? (r.country_codes as string[]) : null,
    regulationRefs: Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, String(v)])),
    checklist: checklistFrom(r.checklist),
    requiresPhoto: r.requires_photo !== false,
    minPhotos: numOrNull(r.min_photos) ?? 1,
    isBase: r.is_base === true || r.company_id == null,
  };
}

export function inspectionFromRow(r: Record<string, unknown>): EquipmentInspection {
  const snap = r.template_snapshot ? obj(r.template_snapshot) : null;
  const answersRaw = obj(r.answers);
  const answers: Record<string, ChecklistAnswer> = {};
  for (const [k, v] of Object.entries(answersRaw)) {
    const o = obj(v);
    const st = o.status === "defect" || o.status === "na" ? o.status : "ok";
    answers[k] = { status: st as ChecklistAnswerStatus, note: strOrNull(o.note) ?? undefined };
  }
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    itemKind: r.item_kind as InspectionItemKind,
    itemId: String(r.item_id),
    itemLabel: strOrNull(r.item_label),
    itemSerial: strOrNull(r.item_serial),
    projectId: strOrNull(r.project_id),
    templateId: strOrNull(r.template_id),
    templateSnapshot: snap
      ? {
          name: strOrNull(snap.name) ?? undefined,
          name_key: strOrNull(snap.name_key) ?? undefined,
          item_category: strOrNull(snap.item_category) ?? undefined,
          regulation_refs: Object.fromEntries(Object.entries(obj(snap.regulation_refs)).map(([k, v]) => [k, String(v)])),
          checklist: checklistFrom(snap.checklist),
        }
      : null,
    answers,
    result: (["pass", "pass_with_notes", "fail"].includes(String(r.result)) ? r.result : "pass") as InspectionResult,
    defects: strOrNull(r.defects),
    notes: strOrNull(r.notes),
    photoUrls: Array.isArray(r.photo_urls) ? (r.photo_urls as string[]) : [],
    photoHashes: Array.isArray(r.photo_hashes) ? (r.photo_hashes as string[]) : null,
    signatureUrl: strOrNull(r.signature_url),
    declarationText: strOrNull(r.declaration_text),
    inspectorUserId: String(r.inspector_user_id ?? ""),
    inspectorName: strOrNull(r.inspector_name),
    gpsLat: numOrNull(r.gps_lat),
    gpsLng: numOrNull(r.gps_lng),
    gpsAccuracy: numOrNull(r.gps_accuracy),
    clientRecordedAt: strOrNull(r.client_recorded_at),
    serverRecordedAt: String(r.server_recorded_at ?? ""),
    supersedesId: strOrNull(r.supersedes_id),
    prevHash: strOrNull(r.prev_hash),
    contentHash: String(r.content_hash ?? ""),
  };
}

export function statusFromRow(r: Record<string, unknown>): EquipmentInspectionStatus {
  return {
    companyId: String(r.company_id),
    itemKind: r.item_kind as InspectionItemKind,
    itemId: String(r.item_id),
    itemLabel: String(r.item_label ?? ""),
    itemSerial: strOrNull(r.item_serial),
    inspectionFrequency: (strOrNull(r.inspection_frequency) as InspectionFrequency | null) ?? null,
    inspectionTemplateId: strOrNull(r.inspection_template_id),
    projectId: strOrNull(r.project_id),
    lastInspectionAt: strOrNull(r.last_inspection_at),
    lastResult: (strOrNull(r.last_result) as InspectionResult | null) ?? null,
    lastInspectorName: strOrNull(r.last_inspector_name),
    needsInspection: r.needs_inspection === true,
  };
}

// ───────────────────────── lectura ─────────────────────────

export async function fetchInspectionTemplates(): Promise<InspectionTemplate[]> {
  const { data, error } = await supabase
    .from("inspection_templates")
    .select("*")
    .is("deleted_at", null)
    .order("is_base", { ascending: false })
    .order("name");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(templateFromRow);
}

export async function fetchInspectionStatus(companyId: string): Promise<EquipmentInspectionStatus[]> {
  const { data, error } = await supabase
    .from("v_equipment_inspection_status")
    .select("*")
    .eq("company_id", companyId);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(statusFromRow);
}

export async function fetchInspections(
  companyId: string,
  filter?: { itemKind?: InspectionItemKind; itemId?: string; from?: string; to?: string; limit?: number }
): Promise<EquipmentInspection[]> {
  let q = supabase
    .from("equipment_inspections")
    .select("*")
    .eq("company_id", companyId)
    .order("server_recorded_at", { ascending: false })
    .limit(filter?.limit ?? 200);
  if (filter?.itemKind) q = q.eq("item_kind", filter.itemKind);
  if (filter?.itemId) q = q.eq("item_id", filter.itemId);
  if (filter?.from) q = q.gte("server_recorded_at", filter.from);
  if (filter?.to) q = q.lte("server_recorded_at", filter.to);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(inspectionFromRow);
}

// ───────────────────────── escritura (solo INSERT) ─────────────────────────

export async function insertInspection(input: NewInspectionInput): Promise<EquipmentInspection> {
  const { data, error } = await supabase
    .from("equipment_inspections")
    .insert({
      company_id: input.companyId,
      item_kind: input.itemKind,
      item_id: input.itemId,
      project_id: input.projectId ?? null,
      template_id: input.templateId ?? null,
      answers: input.answers,
      result: input.result,
      defects: input.defects ?? null,
      notes: input.notes ?? null,
      photo_urls: input.photoUrls,
      photo_hashes: input.photoHashes,
      signature_url: input.signatureUrl ?? null,
      declaration_accepted: true,
      declaration_text: input.declarationText,
      gps_lat: input.gpsLat ?? null,
      gps_lng: input.gpsLng ?? null,
      gps_accuracy: input.gpsAccuracy ?? null,
      device_info: input.deviceInfo ?? null,
      locale: input.locale ?? null,
      country_code: input.countryCode ?? null,
      client_recorded_at: input.clientRecordedAt,
      supersedes_id: input.supersedesId ?? null,
      // La BD rellena: inspector_user_id, inspector_name, item_label, item_serial, template_snapshot,
      // server_recorded_at, prev_hash y content_hash (el trigger corre antes de comprobar NOT NULL).
    })
    .select("*")
    .single();
  if (error) throw error;
  return inspectionFromRow(data as Record<string, unknown>);
}

export async function saveCompanyTemplate(
  companyId: string,
  tpl: Omit<InspectionTemplate, "id" | "companyId" | "isBase"> & { id?: string },
  userId?: string | null
): Promise<InspectionTemplate> {
  const row = {
    company_id: companyId,
    name: tpl.name,
    name_key: tpl.nameKey ?? null,
    item_category: tpl.itemCategory,
    country_codes: tpl.countryCodes,
    regulation_refs: tpl.regulationRefs,
    checklist: tpl.checklist.map((c) => ({ id: c.id, key: c.key ?? null, fallback: c.fallback })),
    requires_photo: tpl.requiresPhoto,
    min_photos: tpl.minPhotos,
    is_base: false,
    updated_at: new Date().toISOString(),
    ...(tpl.id ? { id: tpl.id } : { created_by: userId ?? null }),
  };
  const { data, error } = tpl.id
    ? await supabase.from("inspection_templates").update(row).eq("id", tpl.id).eq("company_id", companyId).select("*").single()
    : await supabase.from("inspection_templates").insert(row).select("*").single();
  if (error) throw error;
  return templateFromRow(data as Record<string, unknown>);
}

export async function archiveCompanyTemplate(companyId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("inspection_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
}

// ───────────────────────── evidencias ─────────────────────────

export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function uploadInspectionImage(blob: Blob, companyId: string, fileName = "inspection.jpg"): Promise<string> {
  const fd = new FormData();
  fd.append("file", blob, fileName);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  fd.append("folder", `machinpro/inspections/${companyId}`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`upload ${res.status}`);
  const j = (await res.json()) as { secure_url?: string };
  if (!j.secure_url) throw new Error("upload: no url");
  return j.secure_url;
}

export function getPosition(timeoutMs = 8000): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
    );
  });
}

// ───────────────────────── cola offline (IndexedDB) ─────────────────────────

/** Inspección hecha sin conexión: fotos guardadas en el dispositivo hasta poder subirlas. */
export type PendingInspection = {
  localId: string;
  input: Omit<NewInspectionInput, "photoUrls" | "photoHashes" | "signatureUrl">;
  photos: Blob[];
  photoHashes: string[];
  signature?: Blob | null;
  createdAt: string;
  lastError?: string;
};

const QUEUE_DB = "machinpro-inspections";
const QUEUE_STORE = "pending";
let queueDb: Promise<IDBPDatabase> | null = null;

function getQueueDb(): Promise<IDBPDatabase> {
  if (!queueDb) {
    queueDb = openDB(QUEUE_DB, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "localId" });
      },
    });
  }
  return queueDb;
}

export async function queueInspection(p: PendingInspection): Promise<void> {
  const db = await getQueueDb();
  await db.put(QUEUE_STORE, p);
  try {
    localStorage.setItem("machinpro_pending_inspections", String((await db.count(QUEUE_STORE)) || 0));
  } catch {
    /* ignore */
  }
}

export async function listPendingInspections(companyId?: string): Promise<PendingInspection[]> {
  try {
    const db = await getQueueDb();
    const all = (await db.getAll(QUEUE_STORE)) as PendingInspection[];
    return companyId ? all.filter((p) => p.input.companyId === companyId) : all;
  } catch {
    return [];
  }
}

/** Sube las fotos guardadas e inserta la inspección. Devuelve cuántas se enviaron. */
export async function flushPendingInspections(companyId: string): Promise<number> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  const db = await getQueueDb();
  const pending = (await listPendingInspections(companyId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let sent = 0;
  for (const p of pending) {
    try {
      const photoUrls: string[] = [];
      for (let i = 0; i < p.photos.length; i++) {
        photoUrls.push(await uploadInspectionImage(p.photos[i], companyId, `inspection-${i + 1}.jpg`));
      }
      const signatureUrl = p.signature ? await uploadInspectionImage(p.signature, companyId, "signature.png") : null;
      await insertInspection({ ...p.input, photoUrls, photoHashes: p.photoHashes, signatureUrl });
      await db.delete(QUEUE_STORE, p.localId);
      sent++;
    } catch (e) {
      await db.put(QUEUE_STORE, { ...p, lastError: e instanceof Error ? e.message : String(e) });
      break; // respetar el orden: si una falla, las siguientes esperan
    }
  }
  try {
    localStorage.setItem("machinpro_pending_inspections", String(await db.count(QUEUE_STORE)));
  } catch {
    /* ignore */
  }
  return sent;
}

// ───────────────────────── utilidades ─────────────────────────

/** Comprueba que cada inspección (ordenadas de antigua a reciente) apunta a la huella de la anterior. */
export function verifyChain(sortedOldestFirst: EquipmentInspection[]): { ok: boolean; brokenAt?: string } {
  for (let i = 1; i < sortedOldestFirst.length; i++) {
    if (sortedOldestFirst[i].prevHash !== sortedOldestFirst[i - 1].contentHash) {
      return { ok: false, brokenAt: sortedOldestFirst[i].id };
    }
  }
  return { ok: true };
}

export function checklistLabel(item: ChecklistItem, t: Record<string, string | undefined>): string {
  return (item.key && t[item.key]) || item.fallback;
}

export function templateLabel(
  tpl: { name?: string; nameKey?: string; name_key?: string },
  t: Record<string, string | undefined>
): string {
  const key = tpl.nameKey ?? tpl.name_key;
  return (key && t[key]) || tpl.name || "";
}

export function regulationRefFor(refs: Record<string, string> | undefined, countryCode: string | null | undefined): string | null {
  if (!refs) return null;
  const cc = (countryCode ?? "").toUpperCase();
  if (cc && refs[cc]) return refs[cc];
  const eu = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
  if (eu.includes(cc) && refs.EU) return refs.EU;
  return null;
}
