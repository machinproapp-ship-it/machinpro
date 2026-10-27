import { supabase } from "@/lib/supabase";

/**
 * Pedidos de material de la obra al taller ("tráeme 3 hojas de plywood").
 * Se guardan en el servidor para que el pedido que hace el encargado en su móvil
 * le llegue a logística en el suyo. Todo cambio pasa por funciones del servidor que
 * comprueban permisos; al enviar, el material sale del stock del taller.
 */

export type ResourceRequestStatus = "pending" | "preparing" | "ready" | "dispatched" | "received" | "cancelled";
export type ResourceRequestItemStatus = "pending" | "ready" | "substituted" | "unavailable";

export interface ResourceRequestItem {
  id: string;
  type: "tool" | "equipment" | "consumable" | "material" | "vehicle";
  inventoryItemId?: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  status: ResourceRequestItemStatus;
  substituteId?: string;
  substituteName?: string;
}

export interface ResourceRequest {
  id: string;
  projectId: string;
  requestedBy: string;
  requestedByName: string;
  neededBy: string;
  status: ResourceRequestStatus;
  items: ResourceRequestItem[];
  notes?: string;
  preparedBy?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  createdAt: string;
}

const STATUSES: ResourceRequestStatus[] = ["pending", "preparing", "ready", "dispatched", "received", "cancelled"];
const ITEM_STATUSES: ResourceRequestItemStatus[] = ["pending", "ready", "substituted", "unavailable"];
const ITEM_TYPES: ResourceRequestItem["type"][] = ["tool", "equipment", "consumable", "material", "vehicle"];

const s = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

export function requestFromRow(r: Record<string, unknown>): ResourceRequest {
  const status = String(r.status ?? "pending") as ResourceRequestStatus;
  const rawItems = Array.isArray(r.items) ? (r.items as Record<string, unknown>[]) : [];
  return {
    id: String(r.id),
    projectId: String(r.project_id ?? ""),
    requestedBy: String(r.requested_by ?? ""),
    requestedByName: s(r.requested_by_name) ?? "",
    neededBy: s(r.needed_by) ?? "",
    status: STATUSES.includes(status) ? status : "pending",
    notes: s(r.notes),
    preparedBy: s(r.prepared_by),
    dispatchedAt: s(r.dispatched_at),
    receivedAt: s(r.received_at),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    items: rawItems.map((it, idx) => {
      const st = String(it.status ?? "pending") as ResourceRequestItemStatus;
      const ty = String(it.type ?? "material") as ResourceRequestItem["type"];
      return {
        id: String(it.id ?? `l${idx + 1}`),
        type: ITEM_TYPES.includes(ty) ? ty : "material",
        inventoryItemId: s(it.inventoryItemId),
        name: String(it.name ?? ""),
        quantity: Number(it.quantity ?? 0) || 0,
        unit: String(it.unit ?? ""),
        notes: s(it.notes),
        status: ITEM_STATUSES.includes(st) ? st : "pending",
      };
    }),
  };
}

/** Lo que se manda al servidor: solo líneas con cantidad; el texto libre va como una línea más. */
export function buildRequestLines(
  quantities: Record<string, number>,
  inventoryIds: string[],
  externalText: string
): { inventoryItemId?: string; name?: string; quantity: number }[] {
  const lines: { inventoryItemId?: string; name?: string; quantity: number }[] = [];
  for (const id of inventoryIds) {
    const q = Number(quantities[id] ?? 0);
    if (Number.isFinite(q) && q > 0) lines.push({ inventoryItemId: id, quantity: q });
  }
  for (const raw of externalText.split("\n")) {
    const name = raw.trim();
    if (name) lines.push({ name, quantity: 1 });
  }
  return lines;
}

export type RequestActionError = "not_allowed" | "not_ready" | "already_closed" | "empty" | "network";

function mapError(e: unknown): RequestActionError {
  const m = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/not_allowed/.test(m)) return "not_allowed";
  if (/already_closed|not_dispatched/.test(m)) return "already_closed";
  if (/empty_request/.test(m)) return "empty";
  if (/does not exist|schema cache|Could not find the function/i.test(m)) return "not_ready";
  return "network";
}

type Result<T = true> = { ok: true; data: T } | { ok: false; error: RequestActionError };

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, error: mapError(error) };
    return { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, error: mapError(e) };
  }
}

export async function fetchResourceRequests(companyId: string, limit = 300): Promise<ResourceRequest[]> {
  const { data, error } = await supabase
    .from("resource_requests")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(requestFromRow);
}

export const createResourceRequest = (
  projectId: string,
  lines: { inventoryItemId?: string; name?: string; quantity: number }[],
  neededBy: string | null,
  notes: string | null
) =>
  rpc<string>("rr_create", {
    p_project_id: projectId,
    p_items: lines,
    p_needed_by: neededBy || null,
    p_notes: notes || null,
  });

export const setResourceRequestStatus = (id: string, status: "pending" | "preparing" | "ready") =>
  rpc("rr_set_status", { p_id: id, p_status: status });

export const setResourceRequestItemStatus = (id: string, lineId: string, status: "pending" | "ready" | "unavailable") =>
  rpc("rr_set_item_status", { p_id: id, p_line_id: lineId, p_status: status });

export const dispatchResourceRequest = (id: string) => rpc<{ ok: boolean; shortLines?: number }>("rr_dispatch", { p_id: id });

export const receiveResourceRequest = (id: string) => rpc("rr_receive", { p_id: id });

export const cancelResourceRequest = (id: string) => rpc("rr_cancel", { p_id: id });

/** Pedidos abiertos que esperan algo de logística. */
export const isOpenForLogistics = (r: ResourceRequest) =>
  r.status === "pending" || r.status === "preparing" || r.status === "ready";
