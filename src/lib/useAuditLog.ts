import { supabase } from "./supabase";

export type AuditAction =
  | "photo_approved"
  | "photo_rejected"
  | "photo_uploaded"
  | "employee_created"
  | "employee_updated"
  | "employee_deleted"
  | "document_uploaded"
  | "document_deleted"
  | "form_created"
  | "form_deleted"
  | "role_created"
  | "role_updated"
  | "role_deleted"
  | "project_created"
  | "project_updated"
  | "project_archived"
  | "compliance_updated"
  | "certificate_updated"
  | "tool_status_changed"
  | "request_dispatched"
  | "request_received"
  | "hazard_created"
  | "hazard_status_changed"
  | "hazard_resolved"
  | "action_created"
  | "action_status_changed"
  | "action_verified"
  | "action_closed";

export type AuditEntityType =
  | "photo"
  | "employee"
  | "document"
  | "form"
  | "role"
  | "project"
  | "compliance"
  | "certificate"
  | "tool"
  | "request"
  | "hazard"
  | "corrective_action";

export interface AuditEntry {
  company_id: string;
  user_id: string;
  user_name?: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  gps_lat?: number;
  gps_lng?: number;
  device_info?: string;
}

/** Row from `audit_logs` (immutable insert-only table). */
export interface AuditLogEntry {
  id: string;
  company_id: string;
  user_id: string;
  user_name?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  gps_lat?: number | null;
  gps_lng?: number | null;
  device_info?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export async function logAuditEvent(entry: AuditEntry): Promise<void> {
  if (!supabase) return;
  try {
    let gps_lat = entry.gps_lat;
    let gps_lng = entry.gps_lng;
    if (gps_lat == null && typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
        );
        gps_lat = pos.coords.latitude;
        gps_lng = pos.coords.longitude;
      } catch {
        /* GPS no disponible */
      }
    }

    const device_info =
      entry.device_info ??
      (typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : undefined);

    await supabase.from("audit_logs").insert({
      ...entry,
      gps_lat,
      gps_lng,
      device_info,
    });
  } catch {
    /* Silencioso — no interrumpir el flujo */
  }
}
