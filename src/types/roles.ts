/** Permisos granulares AW-5 — cada flag controla una funcionalidad concreta. */
export interface RolePermissions {
  // ─── Central ─────────────────────────────────────────────
  canViewCentral: boolean;
  canManageEmployees: boolean;
  canViewEmployees: boolean;
  canManageRoles: boolean;
  canViewRoles: boolean;
  canManageSubcontractors: boolean;
  canViewSubcontractors: boolean;
  canViewAuditLog: boolean;
  /** Asignar/desasignar empleados en proyectos (desde Operaciones / proyecto). */
  canManageProjectTeam: boolean;
  canViewTimeclock: boolean;
  canManageTimeclock: boolean;
  canManageCompliance: boolean;
  canViewDashboardWidgets: boolean;

  // ─── Operaciones / proyecto ───────────────────────────────
  canViewProjects: boolean;
  canViewOnlyAssignedProjects: boolean;
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  canViewProjectGeneral: boolean;
  /** Pestaña Personal del proyecto (solo lectura). */
  canViewProjectTeam: boolean;
  canViewProjectInventory: boolean;
  canViewProjectGallery: boolean;
  canViewProjectBlueprints: boolean;
  canViewProjectForms: boolean;
  canViewProjectVisitors: boolean;
  canViewProjectRFI: boolean;
  canManageProjectForms: boolean;
  canManageProjectGallery: boolean;
  canManageProjectBlueprints: boolean;
  canManageProjectRFI: boolean;
  canManageProjectVisitors: boolean;

  // ─── Horario ─────────────────────────────────────────────
  canViewSchedule: boolean;
  canCreateShifts: boolean;
  canManageVacations: boolean;
  canViewTimesheets: boolean;
  canManageTimesheets: boolean;

  // ─── Logística ──────────────────────────────────────────
  canViewLogistics: boolean;
  canManageInventory: boolean;
  canViewInventory: boolean;
  canManageFleet: boolean;
  canViewFleet: boolean;
  canManageSuppliers: boolean;
  canViewSuppliers: boolean;
  canManageRentals: boolean;
  canCreatePurchaseOrders: boolean;

  // ─── Seguridad ──────────────────────────────────────────
  canViewSecurity: boolean;
  canManageHazards: boolean;
  canViewHazards: boolean;
  canManageCorrectiveActions: boolean;
  canViewCorrectiveActions: boolean;
  canManageSecurityDocs: boolean;
  canViewSecurityDocs: boolean;
  canViewSecurityAudit: boolean;
  canManageDailyReports: boolean;

  // ─── Ajustes ────────────────────────────────────────────
  canViewSettings: boolean;
  canEditCompanyProfile: boolean;
  canViewBilling: boolean;
  canManageNotifications: boolean;
  canManageRegionalConfig: boolean;

  // ─── Documentos (módulo Carpetas / binders) ────────────
  canViewBinders: boolean;
  canManageBinders: boolean;

  /** Panel asistencia / GPS en ficha de proyecto. */
  canViewAttendance: boolean;
}

export interface CustomRole {
  id: string;
  name: string;
  color: string;
  permissions: RolePermissions;
  createdAt: string;
  isSystem?: boolean;
}

export const ROLE_PERMISSION_KEYS: (keyof RolePermissions)[] = [
  "canViewCentral",
  "canManageEmployees",
  "canViewEmployees",
  "canManageRoles",
  "canViewRoles",
  "canManageSubcontractors",
  "canViewSubcontractors",
  "canViewAuditLog",
  "canManageProjectTeam",
  "canViewTimeclock",
  "canManageTimeclock",
  "canManageCompliance",
  "canViewDashboardWidgets",
  "canViewProjects",
  "canViewOnlyAssignedProjects",
  "canCreateProjects",
  "canEditProjects",
  "canDeleteProjects",
  "canViewProjectGeneral",
  "canViewProjectTeam",
  "canViewProjectInventory",
  "canViewProjectGallery",
  "canViewProjectBlueprints",
  "canViewProjectForms",
  "canViewProjectVisitors",
  "canViewProjectRFI",
  "canManageProjectForms",
  "canManageProjectGallery",
  "canManageProjectBlueprints",
  "canManageProjectRFI",
  "canManageProjectVisitors",
  "canViewSchedule",
  "canCreateShifts",
  "canManageVacations",
  "canViewTimesheets",
  "canManageTimesheets",
  "canViewLogistics",
  "canManageInventory",
  "canViewInventory",
  "canManageFleet",
  "canViewFleet",
  "canManageSuppliers",
  "canViewSuppliers",
  "canManageRentals",
  "canCreatePurchaseOrders",
  "canViewSecurity",
  "canManageHazards",
  "canViewHazards",
  "canManageCorrectiveActions",
  "canViewCorrectiveActions",
  "canManageSecurityDocs",
  "canViewSecurityDocs",
  "canViewSecurityAudit",
  "canManageDailyReports",
  "canViewSettings",
  "canEditCompanyProfile",
  "canViewBilling",
  "canManageNotifications",
  "canManageRegionalConfig",
  "canViewBinders",
  "canManageBinders",
  "canViewAttendance",
];

/** Clave i18n: `perm` + clave con primera letra en mayúscula (permCanViewCentral). */
export function permLocaleKey(k: keyof RolePermissions): string {
  const s = String(k);
  return `perm${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}

export const ROLE_PERMISSION_GROUPS: {
  id: string;
  labelKey: string;
  keys: (keyof RolePermissions)[];
}[] = [
  {
    id: "central",
    labelKey: "permGroup_central",
    keys: [
      "canViewCentral",
      "canViewDashboardWidgets",
      "canViewEmployees",
      "canManageEmployees",
      "canViewRoles",
      "canManageRoles",
      "canViewSubcontractors",
      "canManageSubcontractors",
      "canViewAuditLog",
      "canViewTimeclock",
      "canManageTimeclock",
      "canManageCompliance",
    ],
  },
  {
    id: "operations",
    labelKey: "permGroup_operations",
    keys: [
      "canViewProjects",
      "canViewOnlyAssignedProjects",
      "canCreateProjects",
      "canEditProjects",
      "canDeleteProjects",
      "canManageProjectTeam",
      "canViewProjectGeneral",
      "canViewProjectTeam",
      "canViewProjectInventory",
      "canViewProjectGallery",
      "canViewProjectBlueprints",
      "canViewProjectForms",
      "canViewProjectVisitors",
      "canViewProjectRFI",
      "canManageProjectForms",
      "canManageProjectGallery",
      "canManageProjectBlueprints",
      "canManageProjectRFI",
      "canManageProjectVisitors",
    ],
  },
  {
    id: "schedule",
    labelKey: "permGroup_schedule",
    keys: [
      "canViewSchedule",
      "canCreateShifts",
      "canManageVacations",
      "canViewTimesheets",
      "canManageTimesheets",
    ],
  },
  {
    id: "logistics",
    labelKey: "permGroup_logistics",
    keys: [
      "canViewLogistics",
      "canViewInventory",
      "canManageInventory",
      "canViewFleet",
      "canManageFleet",
      "canViewSuppliers",
      "canManageSuppliers",
      "canManageRentals",
      "canCreatePurchaseOrders",
    ],
  },
  {
    id: "security",
    labelKey: "permGroup_security",
    keys: [
      "canViewSecurity",
      "canViewHazards",
      "canManageHazards",
      "canViewCorrectiveActions",
      "canManageCorrectiveActions",
      "canViewSecurityDocs",
      "canManageSecurityDocs",
      "canViewSecurityAudit",
      "canManageDailyReports",
    ],
  },
  {
    id: "settings",
    labelKey: "permGroup_settings",
    keys: [
      "canViewSettings",
      "canEditCompanyProfile",
      "canViewBilling",
      "canManageNotifications",
      "canManageRegionalConfig",
    ],
  },
  {
    id: "documents",
    labelKey: "permGroup_documents",
    keys: ["canViewBinders", "canManageBinders", "canViewAttendance"],
  },
];

export const ROLE_PERMISSION_LABELS: Record<keyof RolePermissions, string> = {
  canViewCentral: "Ver Central",
  canManageEmployees: "Gestionar empleados",
  canViewEmployees: "Ver empleados",
  canManageRoles: "Gestionar roles",
  canViewRoles: "Ver roles",
  canManageSubcontractors: "Gestionar subcontratistas",
  canViewSubcontractors: "Ver subcontratistas",
  canViewAuditLog: "Ver registro de auditoría",
  canManageProjectTeam: "Gestionar equipo del proyecto",
  canViewTimeclock: "Ver fichajes del equipo",
  canManageTimeclock: "Gestionar fichajes del equipo",
  canManageCompliance: "Gestionar compliance y certificados",
  canViewDashboardWidgets: "Ver panel operativo",
  canViewProjects: "Ver proyectos",
  canViewOnlyAssignedProjects: "Solo proyectos asignados",
  canCreateProjects: "Crear proyectos",
  canEditProjects: "Editar proyectos",
  canDeleteProjects: "Eliminar proyectos",
  canViewProjectGeneral: "Ver pestaña General del proyecto",
  canViewProjectTeam: "Ver pestaña Personal del proyecto",
  canViewProjectInventory: "Ver pestaña Inventario del proyecto",
  canViewProjectGallery: "Ver pestaña Galería del proyecto",
  canViewProjectBlueprints: "Ver pestaña Planos del proyecto",
  canViewProjectForms: "Ver pestaña Formularios del proyecto",
  canViewProjectVisitors: "Ver pestaña Visitantes del proyecto",
  canViewProjectRFI: "Ver pestaña RFI del proyecto",
  canManageProjectForms: "Gestionar formularios y partes diarios",
  canManageProjectGallery: "Gestionar galería (subir/aprobar fotos)",
  canManageProjectBlueprints: "Gestionar planos",
  canManageProjectRFI: "Gestionar RFI",
  canManageProjectVisitors: "Gestionar visitantes y QR",
  canViewSchedule: "Ver horario",
  canCreateShifts: "Crear turnos y eventos",
  canManageVacations: "Gestionar vacaciones",
  canViewTimesheets: "Ver hojas de horas",
  canManageTimesheets: "Editar hojas de horas",
  canViewLogistics: "Ver logística",
  canManageInventory: "Gestionar inventario",
  canViewInventory: "Ver inventario",
  canManageFleet: "Gestionar flota",
  canViewFleet: "Ver flota",
  canManageSuppliers: "Gestionar proveedores",
  canViewSuppliers: "Ver proveedores",
  canManageRentals: "Gestionar alquileres",
  canCreatePurchaseOrders: "Crear pedidos",
  canViewSecurity: "Ver seguridad",
  canManageHazards: "Gestionar riesgos",
  canViewHazards: "Ver riesgos",
  canManageCorrectiveActions: "Gestionar acciones correctivas",
  canViewCorrectiveActions: "Ver acciones correctivas",
  canManageSecurityDocs: "Gestionar documentos de seguridad",
  canViewSecurityDocs: "Ver documentos de seguridad",
  canViewSecurityAudit: "Ver auditoría de seguridad",
  canManageDailyReports: "Gestionar partes diarios",
  canViewSettings: "Ver ajustes",
  canEditCompanyProfile: "Editar perfil de empresa",
  canViewBilling: "Ver facturación",
  canManageNotifications: "Gestionar notificaciones",
  canManageRegionalConfig: "Gestionar configuración regional",
  canViewBinders: "Ver documentos (carpetas)",
  canManageBinders: "Gestionar documentos (carpetas)",
  canViewAttendance: "Ver panel asistencia en proyecto",
};

const BASE_ROLE_IDS = ["role-admin", "role-supervisor", "role-worker", "role-logistic"];

export function isBaseRole(id: string): boolean {
  return BASE_ROLE_IDS.includes(id);
}

export function isProtectedCustomRole(role: CustomRole): boolean {
  return role.isSystem === true || isBaseRole(role.id);
}

const DEFAULT_WORKER_NAMES = ["empleado", "employee", "worker", "trabajador"];

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

export function emptyRolePermissionsInline(): RolePermissions {
  const o = {} as Record<keyof RolePermissions, boolean>;
  for (const k of ROLE_PERMISSION_KEYS) o[k] = false;
  return o as RolePermissions;
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
    permissions: effectiveRole === "admin" ? allTruePerms() : emptyRolePermissionsInline(),
  };
}
