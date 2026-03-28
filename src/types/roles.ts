export interface RolePermissions {
  canViewCentral: boolean;
  canEditCentral: boolean;
  canViewLogistics: boolean;
  canEditLogistics: boolean;
  canViewProjects: boolean;
  canViewOnlyAssignedProjects: boolean;
  canEditProjects: boolean;
  canViewSchedule: boolean;
  canWriteSchedule: boolean;
  canViewBlueprints: boolean;
  canAnnotateBlueprints: boolean;
  canViewSettings: boolean;
  canEditSettings: boolean;
  canManageRoles: boolean;
  canManageEmployees: boolean;
  canViewForms: boolean;
  canManageForms: boolean;
  canViewBinders: boolean;
  canManageBinders: boolean;
  canManageSubcontractors: boolean;
  canApproveVacations: boolean;
  canViewAttendance: boolean;
  canViewTimeclock: boolean;
  canManageTimeclock: boolean;
  /** Ver facturación / planes en Ajustes */
  canViewBilling: boolean;
  /** Crear/editar/publicar partes diarios de obra */
  canManageDailyReports: boolean;
}

export interface CustomRole {
  id: string;
  name: string;
  color: string;
  permissions: RolePermissions;
  createdAt: string;
  /** Fila Supabase con is_system=true — no se puede eliminar desde la UI. */
  isSystem?: boolean;
}

export const ROLE_PERMISSION_KEYS: (keyof RolePermissions)[] = [
  "canViewCentral",
  "canEditCentral",
  "canViewLogistics",
  "canEditLogistics",
  "canViewProjects",
  "canViewOnlyAssignedProjects",
  "canEditProjects",
  "canViewSchedule",
  "canWriteSchedule",
  "canViewBlueprints",
  "canAnnotateBlueprints",
  "canViewSettings",
  "canEditSettings",
  "canManageRoles",
  "canManageEmployees",
  "canViewForms",
  "canManageForms",
  "canViewBinders",
  "canManageBinders",
  "canManageSubcontractors",
  "canApproveVacations",
  "canViewAttendance",
  "canViewTimeclock",
  "canManageTimeclock",
  "canViewBilling",
  "canManageDailyReports",
];

export const ROLE_PERMISSION_LABELS: Record<keyof RolePermissions, string> = {
  canViewCentral: "Ver Central",
  canEditCentral: "Editar Central",
  canViewLogistics: "Ver Logística",
  canEditLogistics: "Editar Logística",
  canViewProjects: "Ver Proyectos",
  canViewOnlyAssignedProjects: "Solo proyectos asignados",
  canEditProjects: "Editar Proyectos",
  canViewSchedule: "Ver Horario",
  canWriteSchedule: "Crear turnos",
  canViewBlueprints: "Ver Planos",
  canAnnotateBlueprints: "Anotar en Planos",
  canViewSettings: "Ver Ajustes",
  canEditSettings: "Editar Ajustes",
  canManageRoles: "Gestionar Roles",
  canManageEmployees: "Gestionar Empleados",
  canViewForms: "Ver Formularios",
  canManageForms: "Gestionar Formularios",
  canViewBinders: "Ver Documentos",
  canManageBinders: "Gestionar Documentos",
  canManageSubcontractors: "Gestionar Subcontratistas",
  canApproveVacations: "Aprobar vacaciones",
  canViewAttendance: "Ver panel asistencia",
  canViewTimeclock: "Ver fichajes",
  canManageTimeclock: "Gestionar fichajes",
  canViewBilling: "Ver facturación",
  canManageDailyReports: "Gestionar partes diarios",
};

const BASE_ROLE_IDS = ["role-admin", "role-supervisor", "role-worker", "role-logistic"];

export function isBaseRole(id: string): boolean {
  return BASE_ROLE_IDS.includes(id);
}

/** Rol protegido: sistema en BD o id legacy de plantilla. */
export function isProtectedCustomRole(role: CustomRole): boolean {
  return role.isSystem === true || isBaseRole(role.id);
}

const DEFAULT_WORKER_NAMES = ["empleado", "employee", "worker", "trabajador"];

/** Id del rol tipo “empleado” por nombre, o el primer rol no sistema, o el primero de la lista. */
export function pickDefaultWorkerRoleId(customRoles: CustomRole[]): string {
  if (!customRoles.length) return "";
  const norm = (s: string) => s.trim().toLowerCase();
  for (const r of customRoles) {
    const n = norm(r.name);
    if (DEFAULT_WORKER_NAMES.some((w) => n === w || n.includes(w))) return r.id;
  }
  const nonSys = customRoles.find((r) => !r.isSystem);
  return (nonSys ?? customRoles[0])!.id;
}

const LEGACY_USER_ROLE_NAMES: Record<"admin" | "supervisor" | "worker" | "logistic", string[]> = {
  admin: ["administrador"],
  supervisor: ["supervisor", "supervisora"],
  worker: ["empleado"],
  logistic: ["logística", "logistica", "logistic"],
};

type AppRole = "admin" | "supervisor" | "worker" | "logistic" | "projectManager";

/** Resuelve qué CustomRole usa el usuario para permisos (UUID en BD o plantillas legacy). */
export function resolveActiveCustomRole(
  customRoles: CustomRole[],
  effectiveRole: AppRole,
  profileCustomRoleId?: string | null
): CustomRole {
  const er: keyof typeof LEGACY_USER_ROLE_NAMES =
    effectiveRole === "projectManager" ? "supervisor" : effectiveRole;
  if (profileCustomRoleId) {
    const byProfile = customRoles.find((r) => r.id === profileCustomRoleId);
    if (byProfile) return byProfile;
  }
  const legacyId = effectiveRole === "projectManager" ? "role-supervisor" : `role-${effectiveRole}`;
  const legacy = customRoles.find((r) => r.id === legacyId);
  if (legacy) return legacy;
  const candidates = LEGACY_USER_ROLE_NAMES[er];
  const byName = customRoles.find((r) => {
    const n = r.name.trim().toLowerCase();
    return candidates.some((c) => n === c || n.includes(c));
  });
  return byName ?? customRoles[0] ?? resolveActiveCustomRoleFallback(effectiveRole);
}

function allTruePerms(): RolePermissions {
  const o = {} as Record<keyof RolePermissions, boolean>;
  for (const k of ROLE_PERMISSION_KEYS) o[k] = true;
  return o as RolePermissions;
}

function resolveActiveCustomRoleFallback(effectiveRole: AppRole): CustomRole {
  const idKey = effectiveRole === "projectManager" ? "supervisor" : effectiveRole;
  return {
    id: `role-${idKey}`,
    name: idKey,
    color: "#71717a",
    createdAt: new Date().toISOString(),
    permissions: effectiveRole === "admin" ? allTruePerms() : emptyRolePermissionsFallback(),
  };
}

function emptyRolePermissionsFallback(): RolePermissions {
  const o = {} as Record<keyof RolePermissions, boolean>;
  for (const k of ROLE_PERMISSION_KEYS) o[k] = false;
  return o as RolePermissions;
}
