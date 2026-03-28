import type { CustomRole, RolePermissions } from "@/types/roles";
import { ROLE_PERMISSION_KEYS } from "@/types/roles";

export const MACHINPRO_CUSTOM_ROLES_LS_KEY = "machinpro_custom_roles";

/** Todos los permisos en true — rol Administrador / seed de empresa. */
export function fullAdministratorPermissions(): RolePermissions {
  const o = {} as Record<keyof RolePermissions, boolean>;
  for (const k of ROLE_PERMISSION_KEYS) o[k] = true;
  return o as RolePermissions;
}

export function emptyRolePermissions(): RolePermissions {
  const o = {} as Record<keyof RolePermissions, boolean>;
  for (const k of ROLE_PERMISSION_KEYS) o[k] = false;
  return o as RolePermissions;
}

export function mergeRolePermissions(raw: unknown): RolePermissions {
  const base = emptyRolePermissions();
  const acc = { ...base } as Record<keyof RolePermissions, boolean>;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const k of ROLE_PERMISSION_KEYS) {
    if (typeof o[k as string] === "boolean") acc[k] = o[k as string] as boolean;
  }
  return acc as RolePermissions;
}

export type RolesTableRow = {
  id: string;
  company_id: string;
  name: string;
  color: string | null;
  permissions: unknown;
  is_system: boolean | null;
  created_at: string;
  updated_at?: string | null;
};

export function customRoleFromSupabaseRow(row: RolesTableRow): CustomRole {
  return {
    id: row.id,
    name: row.name,
    color: row.color?.trim() ? row.color : "#b45309",
    permissions: mergeRolePermissions(row.permissions),
    createdAt: row.created_at,
    isSystem: row.is_system === true,
  };
}

export function readLegacyCustomRolesFromLocalStorage(): CustomRole[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MACHINPRO_CUSTOM_ROLES_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const out: CustomRole[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : null;
      const name = typeof o.name === "string" ? o.name.trim() : "";
      if (!id || !name) continue;
      out.push({
        id,
        name,
        color: typeof o.color === "string" ? o.color : "#b45309",
        permissions: mergeRolePermissions(o.permissions),
        createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
        isSystem: o.isSystem === true,
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export function clearLegacyCustomRolesLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(MACHINPRO_CUSTOM_ROLES_LS_KEY);
  } catch {
    /* ignore */
  }
}

export type RoleSeedInput = {
  name: string;
  color: string;
  permissions: RolePermissions;
  isSystem: boolean;
};
