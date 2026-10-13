import { supabase } from "@/lib/supabase";
import type { InventoryLedgerRow, InventoryMovementKind } from "@/types/inventoryLedger";

/**
 * Control de herramientas: historial de movimientos en el servidor y acciones del trabajador
 * al escanear el QR ("me la llevo", "la devuelvo", "avería").
 */

const KINDS: InventoryMovementKind[] = [
  "in",
  "out",
  "transfer",
  "maintenance",
  "status_change",
  "import",
  "checkout",
  "return",
  "damage",
];

const s = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

export function movementFromRow(r: Record<string, unknown>): InventoryLedgerRow {
  const kind = String(r.movement_type ?? "status_change") as InventoryMovementKind;
  return {
    id: String(r.id),
    itemId: String(r.item_id),
    itemName: s(r.item_name),
    movementType: KINDS.includes(kind) ? kind : "status_change",
    quantity: Number(r.quantity ?? 0) || 0,
    fromLocation: s(r.from_location),
    toLocation: s(r.to_location),
    fromProjectId: s(r.from_project_id),
    toProjectId: s(r.to_project_id),
    performedByProfileId: s(r.performed_by),
    performedByName: s(r.performed_by_name),
    notes: s(r.notes),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    fromUserId: s(r.from_user_id),
    toUserId: s(r.to_user_id),
    photoUrl: s(r.photo_url),
  };
}

/** Últimos movimientos de la empresa (lo que ve logística desde cualquier sitio). */
export async function fetchCompanyMovements(companyId: string, limit = 1000): Promise<InventoryLedgerRow[]> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(movementFromRow).reverse();
}

export async function fetchItemMovements(itemId: string, limit = 30): Promise<InventoryLedgerRow[]> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(movementFromRow);
}

/** Guarda en el servidor un movimiento hecho desde Logística (entrada, salida, traspaso…). */
export async function insertMovement(row: InventoryLedgerRow): Promise<void> {
  const { error } = await supabase.from("inventory_movements").insert({
    item_id: row.itemId,
    movement_type: row.movementType,
    quantity: row.quantity ?? 0,
    from_location: row.fromLocation ?? null,
    to_location: row.toLocation ?? null,
    from_project_id: row.fromProjectId ?? null,
    to_project_id: row.toProjectId ?? null,
    notes: row.notes ?? null,
    from_user_id: row.fromUserId ?? null,
    to_user_id: row.toUserId ?? null,
    photo_url: row.photoUrl ?? null,
  });
  if (error) throw error;
}

export type ToolActionError = "not_allowed" | "not_holder" | "not_found" | "note_required" | "not_ready" | "network";

function mapError(e: unknown): ToolActionError {
  const m = String((e as { message?: string })?.message ?? e);
  if (/not_allowed/.test(m)) return "not_allowed";
  if (/not_holder/.test(m)) return "not_holder";
  if (/not_found/.test(m)) return "not_found";
  if (/note_required/.test(m)) return "note_required";
  if (/does not exist|schema cache|Could not find the function/i.test(m)) return "not_ready";
  return "network";
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: ToolActionError }> {
  try {
    const { error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, error: mapError(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapError(e) };
  }
}

export const toolTake = (itemId: string, projectId: string | null, note?: string) =>
  rpc("tool_take", { p_item_id: itemId, p_project_id: projectId, p_note: note ?? null });

export const toolReturn = (itemId: string, note?: string) =>
  rpc("tool_return", { p_item_id: itemId, p_note: note ?? null });

export const toolReportDamage = (itemId: string, note: string, photoUrl: string | null) =>
  rpc("tool_report_damage", { p_item_id: itemId, p_note: note, p_photo_url: photoUrl });

/** Desde cuándo la tiene quien la tiene (último "me la llevo" o salida). */
export function heldSince(movements: InventoryLedgerRow[], itemId: string): string | null {
  let last: string | null = null;
  for (const m of movements) {
    if (m.itemId !== itemId) continue;
    if (m.movementType === "checkout" || m.movementType === "out" || m.movementType === "transfer") {
      if (!last || m.createdAt > last) last = m.createdAt;
    }
    if (m.movementType === "return" && last && m.createdAt > last) last = null;
  }
  return last;
}

/** Días completos entre una fecha ISO y ahora. */
export function daysSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}
