import type { RolePermissions } from "@/types/roles";
import { PERMISSION_BODY_EN } from "@/locales/permAw5";

/** Tooltip / title text for a permission toggle; optional `perm_tip_${key}` in locale overrides. */
export function resolvePermissionTip(key: keyof RolePermissions, labels: Record<string, string>): string {
  const custom = labels[`perm_tip_${String(key)}`];
  if (typeof custom === "string" && custom.trim() !== "") return custom.trim();
  return `${PERMISSION_BODY_EN[key]}. Turn off to remove this capability from anyone using this role.`;
}
