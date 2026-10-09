import type { InventoryItem, Vehicle } from "@/components/LogisticsModule";

/**
 * Mapeo entre el estado de Logística (inventario y flota) y las tablas de Supabase
 * `inventory_items` y `fleet_vehicles`. Lo que no tiene columna propia va en `extra` (jsonb).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
function dateOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !DATE_RE.test(v)) return null;
  return v.slice(0, 10);
}
function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}
function numOr(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export type InspectionFrequency = "before_each_use" | "daily" | "weekly" | "monthly" | "yearly";
const FREQS: InspectionFrequency[] = ["before_each_use", "daily", "weekly", "monthly", "yearly"];
export function asInspectionFrequency(v: unknown): InspectionFrequency | undefined {
  return FREQS.includes(v as InspectionFrequency) ? (v as InspectionFrequency) : undefined;
}

// ───────────────────────── Inventario ─────────────────────────

export function inventoryItemToRow(item: InventoryItem, companyId: string): Record<string, unknown> {
  const responsibleIsUuid = isUuid(item.responsibleUserId);
  const extra: Record<string, unknown> = {
    supplierId: item.supplierId,
    internalId: item.internalId,
    qrCodeText: item.qrCodeText,
    qrCode: item.qrCode,
    incidentPhotoUrl: item.incidentPhotoUrl,
    incidentEntryId: item.incidentEntryId,
    incidentReviewed: item.incidentReviewed,
    lastMovementAt: item.lastMovementAt,
    category: item.category,
    model: item.model,
    responsibleRef: responsibleIsUuid ? undefined : item.responsibleUserId,
  };
  for (const k of Object.keys(extra)) if (extra[k] === undefined) delete extra[k];
  return {
    id: item.id,
    company_id: companyId,
    name: item.name ?? "",
    type: item.type,
    item_type: item.type,
    quantity: numOr(item.quantity, 0),
    unit: item.unit ?? "",
    purchase_price_cad: numOr(item.purchasePriceCAD, 0),
    low_stock_threshold: item.lowStockThreshold ?? null,
    tool_status: item.toolStatus ?? null,
    assigned_to_project_id: item.assignedToProjectId ?? null,
    assigned_to_employee_id: item.assignedToEmployeeId ?? null,
    photo_url: strOrNull(item.imageUrl),
    serial_number: strOrNull(item.serialNumber),
    qr_code: strOrNull(item.qrCodeText),
    location: item.location ?? null,
    maintenance_date: dateOrNull(item.maintenanceDate),
    insurance_date: dateOrNull(item.insuranceDate),
    responsible_user_id: responsibleIsUuid ? item.responsibleUserId : null,
    deleted_at: item.deletedAt ?? null,
    requires_inspection: !!item.requiresInspection,
    inspection_frequency: item.requiresInspection ? item.inspectionFrequency ?? "before_each_use" : null,
    inspection_template_id: isUuid(item.inspectionTemplateId) ? item.inspectionTemplateId : null,
    extra,
  };
}

export function inventoryItemFromRow(row: Record<string, unknown>): InventoryItem {
  const extra = obj(row.extra);
  const type = (str(row.item_type) ?? str(row.type) ?? "material") as InventoryItem["type"];
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    type,
    quantity: numOr(row.quantity, 0),
    unit: String(row.unit ?? ""),
    purchasePriceCAD: numOr(row.purchase_price_cad, 0),
    lowStockThreshold: row.low_stock_threshold == null ? undefined : numOr(row.low_stock_threshold, 0),
    toolStatus: (str(row.tool_status) as InventoryItem["toolStatus"]) ?? undefined,
    assignedToProjectId: str(row.assigned_to_project_id) ?? str(row.current_project_id),
    assignedToEmployeeId: str(row.assigned_to_employee_id),
    imageUrl: str(row.photo_url),
    serialNumber: str(row.serial_number),
    qrCodeText: str(extra.qrCodeText) ?? str(row.qr_code),
    qrCode: str(extra.qrCode),
    location: str(row.location),
    maintenanceDate: str(row.maintenance_date),
    insuranceDate: str(row.insurance_date),
    responsibleUserId: str(row.responsible_user_id) ?? str(extra.responsibleRef),
    deletedAt: str(row.deleted_at),
    supplierId: str(extra.supplierId),
    internalId: str(extra.internalId),
    incidentPhotoUrl: str(extra.incidentPhotoUrl),
    incidentEntryId: str(extra.incidentEntryId),
    incidentReviewed: typeof extra.incidentReviewed === "boolean" ? extra.incidentReviewed : undefined,
    lastMovementAt: str(extra.lastMovementAt),
    category: str(extra.category),
    model: str(extra.model),
    requiresInspection: row.requires_inspection === true,
    inspectionFrequency: asInspectionFrequency(row.inspection_frequency),
    inspectionTemplateId: str(row.inspection_template_id),
  };
}

// ───────────────────────── Flota ─────────────────────────

export function vehicleToRow(v: Vehicle, companyId: string): Record<string, unknown> {
  const extra: Record<string, unknown> = {
    documents: v.documents,
    imageUrl: v.imageUrl,
    internalId: v.internalId,
    qrCode: v.qrCode,
    insuranceDocUrl: v.insuranceDocUrl,
    inspectionDocUrl: v.inspectionDocUrl,
    registrationDocUrl: v.registrationDocUrl,
  };
  for (const k of Object.keys(extra)) if (extra[k] === undefined) delete extra[k];
  return {
    id: v.id,
    company_id: companyId,
    label: strOrNull(v.label) ?? strOrNull(v.plate),
    plate: v.plate ?? "",
    vehicle_status: v.vehicleStatus ?? "available",
    usual_driver_employee_id: strOrNull(v.usualDriverId),
    current_project_id: v.currentProjectId ?? null,
    insurance_expires_on: dateOrNull(v.insuranceExpiry),
    inspection_expires_on: dateOrNull(v.inspectionExpiry),
    last_maintenance_on: dateOrNull(v.lastMaintenanceDate),
    next_maintenance_on: dateOrNull(v.nextMaintenanceDate),
    odometer_or_hours: v.mileage == null ? null : numOr(v.mileage, 0),
    notes: v.notes ?? null,
    serial_number: strOrNull(v.serialNumber),
    deleted_at: null,
    requires_inspection: !!v.requiresInspection,
    inspection_frequency: v.requiresInspection ? v.inspectionFrequency ?? "before_each_use" : null,
    inspection_template_id: isUuid(v.inspectionTemplateId) ? v.inspectionTemplateId : null,
    extra,
  };
}

export function vehicleFromRow(row: Record<string, unknown>): Vehicle {
  const extra = obj(row.extra);
  return {
    id: String(row.id),
    label: str(row.label),
    plate: String(row.plate ?? row.label ?? ""),
    usualDriverId: String(row.usual_driver_employee_id ?? ""),
    currentProjectId: str(row.current_project_id) ?? null,
    insuranceExpiry: str(row.insurance_expires_on),
    inspectionExpiry: str(row.inspection_expires_on),
    documents: Array.isArray(extra.documents) ? (extra.documents as Vehicle["documents"]) : undefined,
    imageUrl: str(extra.imageUrl),
    vehicleStatus: (str(row.vehicle_status) as Vehicle["vehicleStatus"]) ?? "available",
    lastMaintenanceDate: str(row.last_maintenance_on),
    nextMaintenanceDate: str(row.next_maintenance_on),
    mileage: row.odometer_or_hours == null ? undefined : numOr(row.odometer_or_hours, 0),
    notes: str(row.notes),
    serialNumber: str(row.serial_number),
    internalId: str(extra.internalId),
    qrCode: str(extra.qrCode),
    insuranceDocUrl: str(extra.insuranceDocUrl),
    inspectionDocUrl: str(extra.inspectionDocUrl),
    registrationDocUrl: str(extra.registrationDocUrl),
    requiresInspection: row.requires_inspection === true,
    inspectionFrequency: asInspectionFrequency(row.inspection_frequency),
    inspectionTemplateId: str(row.inspection_template_id),
  };
}

/** Huella estable de una fila para saber si cambió desde la última sincronización. */
export function rowFingerprint(row: Record<string, unknown>): string {
  const keys = Object.keys(row).sort();
  return JSON.stringify(keys.map((k) => [k, row[k]]));
}
