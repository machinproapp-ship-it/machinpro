import type { CustomRole, RolePermissions } from "@/types/roles";
import { ROLE_PERMISSION_KEYS } from "@/types/roles";

export const MACHINPRO_CUSTOM_ROLES_LS_KEY = "machinpro_custom_roles";

/**
 * Todos los permisos en true — rol Administrador / seed de empresa.
 * Incluye canViewTeamAvailability y canManageTeamAvailability (ROLE_PERMISSION_KEYS).
 */
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

/** Migra JSON antiguo (pre-AW-5) a flags nuevos. */
function applyLegacyPermissionFields(
  acc: Record<keyof RolePermissions, boolean>,
  o: Record<string, unknown>
): void {
  const L = (k: string): boolean => o[k] === true;
  if (L("canEditCentral")) {
    acc.canViewCentral = true;
    acc.canViewEmployees = true;
    acc.canManageEmployees = true;
    acc.canViewDashboardWidgets = true;
    acc.canViewAuditLog = true;
    acc.canManageCompliance = true;
  }
  if (L("canEditLogistics")) {
    acc.canViewLogistics = true;
    acc.canViewInventory = true;
    acc.canManageInventory = true;
    acc.canViewFleet = true;
    acc.canManageFleet = true;
    acc.canViewSuppliers = true;
    acc.canManageSuppliers = true;
    acc.canManageRentals = true;
    acc.canCreatePurchaseOrders = true;
  }
  if (L("canWriteSchedule")) acc.canCreateShifts = true;
  if (L("canApproveVacations")) acc.canManageVacations = true;
  if (L("canViewBlueprints")) acc.canViewProjectBlueprints = true;
  if (L("canAnnotateBlueprints")) {
    acc.canViewProjectBlueprints = true;
    acc.canManageProjectBlueprints = true;
  }
  if (L("canViewForms")) {
    acc.canViewProjectForms = true;
    acc.canViewForms = true;
  }
  if (L("canManageForms")) {
    acc.canViewProjectForms = true;
    acc.canManageProjectForms = true;
    acc.canViewForms = true;
    acc.canCreateForms = true;
    acc.canFillForms = true;
    acc.canManageFormTemplates = true;
    acc.canApproveForms = true;
    acc.canExportForms = true;
    acc.canManageDailyReports = true;
  }
  if (L("canEditSettings")) {
    acc.canViewSettings = true;
    acc.canEditCompanyProfile = true;
    acc.canManageNotifications = true;
    acc.canManageRegionalConfig = true;
  }
  if (L("canManageSubcontractors")) {
    acc.canViewSubcontractors = true;
    acc.canManageSubcontractors = true;
  }
  if (L("canManageRoles")) {
    acc.canViewRoles = true;
    acc.canManageRoles = true;
  }
  if (L("canManageEmployees")) acc.canViewEmployees = true;
  if (L("canViewProjects")) {
    acc.canViewProjectGeneral = true;
    acc.canViewProjectTeam = true;
    acc.canViewProjectInventory = true;
    acc.canViewProjectGallery = true;
    acc.canViewProjectForms = true;
  }
  if (L("canEditProjects")) {
    acc.canViewProjects = true;
    acc.canCreateProjects = true;
    acc.canEditProjects = true;
    acc.canViewProjectGeneral = true;
    acc.canManageProjectTeam = true;
  }
  if (L("canViewAttendance")) {
    acc.canViewDashboardWidgets = true;
    acc.canViewAttendance = true;
  }
}

export function mergeRolePermissions(raw: unknown): RolePermissions {
  const base = emptyRolePermissions();
  const acc = { ...base } as Record<keyof RolePermissions, boolean>;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const k of ROLE_PERMISSION_KEYS) {
    if (typeof o[k as string] === "boolean") acc[k] = o[k as string] as boolean;
  }
  applyLegacyPermissionFields(acc, o);
  if (
    !Object.prototype.hasOwnProperty.call(o, "canUploadPhotos") &&
    acc.canViewProjectGallery
  ) {
    acc.canUploadPhotos = true;
  }
  if (!Object.prototype.hasOwnProperty.call(o, "canViewLaborCosting")) {
    acc.canViewLaborCosting = acc.canViewTimesheets === true;
  }

  const hasOwn = (k: string) => Object.prototype.hasOwnProperty.call(o, k);
  if (acc.canViewProjectForms && !hasOwn("canViewForms")) acc.canViewForms = true;
  if (acc.canViewProjectForms && !hasOwn("canFillForms")) acc.canFillForms = true;
  if (acc.canManageProjectForms) {
    if (!hasOwn("canViewForms")) acc.canViewForms = true;
    if (!hasOwn("canCreateForms")) acc.canCreateForms = true;
    if (!hasOwn("canFillForms")) acc.canFillForms = true;
    if (!hasOwn("canManageFormTemplates")) acc.canManageFormTemplates = true;
    if (!hasOwn("canApproveForms")) acc.canApproveForms = true;
    if (!hasOwn("canExportForms")) acc.canExportForms = true;
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
