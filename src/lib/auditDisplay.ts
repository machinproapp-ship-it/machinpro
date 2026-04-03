/**
 * Audit log display: action + entity_type labels for Superadmin, Seguridad, Central.
 */
import { auditActionDescription } from "@/lib/auditActionLabel";

const ACTION_LOCALE_KEYS: Record<string, string> = {
  superadmin_trial_extended: "audit_trial_extended",
  superadmin_plan_changed: "audit_plan_changed",
};

const ENTITY_TYPE_KEYS: Record<string, string> = {
  hazard: "audit_entity_hazard",
  blueprint: "audit_blueprint",
  photo: "audit_photo",
};

/** Translate audit action; falls back to audit_action_* then raw action. */
export function getAuditActionLabel(action: string, _entityType: string | null | undefined, t: Record<string, string>): string {
  const a = (action ?? "").trim();
  const key = ACTION_LOCALE_KEYS[a];
  if (key) {
    const v = t[key];
    if (v) return v;
  }
  return auditActionDescription(a, t);
}

/** Translate entity_type for audit table chips. */
export function getAuditEntityTypeLabel(entityType: string | null | undefined, t: Record<string, string>): string {
  const ty = (entityType ?? "").trim().toLowerCase();
  if (!ty) return "—";
  const key = ENTITY_TYPE_KEYS[ty];
  if (key) {
    const v = t[key];
    if (v) return v;
  }
  return entityType ?? ty;
}
