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
