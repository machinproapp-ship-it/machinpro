import type { RolePermissions } from "@/types/roles";

/** Qué módulos del menú abre cada rol (luego se cruza con el plan contratado). */
export interface ModulePermissions {
  office: boolean;
  warehouse: boolean;
  site: boolean;
  worker: boolean;
  /** Acceso al módulo Formularios (rellenar / crear / aprobar / plantillas). */
  forms: boolean;
  /** Solo entrada de menú Formularios (canViewForms). */
  formsNav: boolean;
  canSeeOnlyAssignedProjects?: boolean;
  canAccessSchedule: boolean;
  canCreateShifts?: boolean;
  canEditCompanyProfile?: boolean;
  canViewBinders?: boolean;
  canManageBinders?: boolean;
  canAccessEmployees?: boolean;
  canAccessSubcontractors?: boolean;
  canManageVacations?: boolean;
  canViewAttendance?: boolean;
  canViewTimeclock?: boolean;
  canManageTimeclock?: boolean;
  canAccessSecurity: boolean;
  canViewSettings?: boolean;
}

export function permissionsToModule(p: RolePermissions): ModulePermissions {
  return {
    office: p.canViewCentral,
    // Los módulos del menú se abren con permisos de módulo. Los permisos de dentro de la obra
    // (inspeccionar un equipo, formularios, fotos, producción…) se usan desde el día del horario.
    warehouse: p.canViewLogistics || p.canViewInspections,
    // "Solo proyectos asignados" limita QUÉ obras se ven; para entrar en Operaciones hace falta
    // ver la obra en sí (General o Equipo), como un supervisor.
    site:
      p.canViewProjects ||
      p.canViewSubcontractors ||
      (p.canViewOnlyAssignedProjects && (p.canViewProjectGeneral || p.canViewProjectTeam)),
    worker: false,
    forms:
      p.canViewForms ||
      p.canFillForms ||
      p.canCreateForms ||
      p.canManageFormTemplates ||
      p.canApproveForms ||
      p.canExportForms,
    formsNav: p.canViewForms || p.canFillForms,
    canSeeOnlyAssignedProjects: p.canViewOnlyAssignedProjects,
    canAccessSchedule: p.canViewSchedule || p.canViewTimeclock || p.canViewPayroll,
    canCreateShifts: p.canCreateShifts,
    canEditCompanyProfile: p.canEditCompanyProfile,
    canViewBinders: p.canViewBinders,
    canManageBinders: p.canManageBinders,
    canAccessEmployees: p.canViewEmployees || p.canManageEmployees,
    canAccessSubcontractors: p.canViewSubcontractors || p.canManageSubcontractors,
    canManageVacations: p.canManageVacations,
    canViewAttendance: p.canViewAttendance,
    canViewTimeclock: p.canViewTimeclock,
    canManageTimeclock: p.canManageTimeclock,
    canAccessSecurity: p.canViewSecurity,
    canViewSettings: p.canViewSettings,
  };
}

