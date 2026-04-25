import type { PaidPlanKey } from "@/lib/stripe";
import type { DashboardWidgetId } from "@/lib/dashboardConfig";
import { CENTRAL_STRIPPED_WIDGET_IDS } from "@/lib/dashboardConfig";

/** Shape aligned with ModulePermissions in page.tsx — plan gating merges with role permissions. */
export interface ModulePermissionsShape {
  office: boolean;
  warehouse: boolean;
  site: boolean;
  worker: boolean;
  forms?: boolean;
  formsNav?: boolean;
  canSeeOnlyAssignedProjects?: boolean;
  canAccessSchedule?: boolean;
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
  canAccessSecurity?: boolean;
  canViewSettings?: boolean;
}

export type AppPlanTier = PaidPlanKey | "trial" | "unknown";

/** Normalize DB / Stripe / invite plan strings to a tier for module access. */
export function normalizePlanForModules(raw: string | null | undefined): AppPlanTier {
  if (raw == null || raw === "") return "unknown";
  const r = raw.toLowerCase().trim();
  if (r === "trial") return "trial";
  const map: Record<string, PaidPlanKey> = {
    esencial: "esencial",
    operaciones: "operaciones",
    logistica: "logistica",
    todo_incluido: "todo_incluido",
    foundation: "esencial",
    horarios: "esencial",
    starter: "esencial",
    obras: "operaciones",
    pro: "operaciones",
    professional: "operaciones",
    enterprise: "todo_incluido",
  };
  return map[r] ?? "unknown";
}

/** AH-43E: catálogo de trabajo / work orders — plan Operaciones o superior (incl. logística y todo incluido). */
export function planIncludesOperationsOrHigher(
  plan: string | null | undefined,
  subscriptionStatus?: string | null
): boolean {
  if (String(subscriptionStatus ?? "").toLowerCase() === "trialing") return true;
  const tier = normalizePlanForModules(plan);
  return tier === "operaciones" || tier === "logistica" || tier === "todo_incluido";
}

type SidebarModule = "office" | "schedule" | "site" | "warehouse" | "security";

function tierAllowsModule(tier: AppPlanTier, mod: SidebarModule): boolean {
  if (tier === "trial" || tier === "unknown") return true;
  switch (mod) {
    case "office":
    case "schedule":
      return true;
    case "site":
      return tier === "operaciones" || tier === "todo_incluido";
    case "warehouse":
      return tier === "logistica" || tier === "todo_incluido";
    case "security":
      return tier === "todo_incluido";
    default:
      return false;
  }
}

/**
 * During Stripe `trialing`, keep full navigation so companies can evaluate every module.
 * Otherwise, intersect role permissions with the active paid plan tier.
 */
export function applyPlanToModulePermissions<T extends ModulePermissionsShape>(
  base: T,
  plan: string | null | undefined,
  options?: { subscriptionStatus?: string | null }
): T {
  if (options?.subscriptionStatus === "trialing") {
    return base;
  }
  const tier = normalizePlanForModules(plan);
  if (tier === "trial" || tier === "unknown") {
    return base;
  }
  const schedOk = tierAllowsModule(tier, "schedule") && (base.canAccessSchedule ?? true);
  return {
    ...base,
    office: base.office && tierAllowsModule(tier, "office"),
    canAccessSchedule: schedOk ? base.canAccessSchedule : false,
    site: base.site && tierAllowsModule(tier, "site"),
    warehouse: base.warehouse && tierAllowsModule(tier, "warehouse"),
    canAccessSecurity: (base.canAccessSecurity ?? false) && tierAllowsModule(tier, "security"),
  };
}

/** AH-43B: Central operational panel widget vs subscription tier (after permission checks). */
export function centralDashboardWidgetAllowedForPlan(id: DashboardWidgetId, tier: AppPlanTier): boolean {
  if (CENTRAL_STRIPPED_WIDGET_IDS.has(id)) return false;
  if (tier === "trial" || tier === "unknown") return true;
  const core: DashboardWidgetId[] = ["team_timeclock", "activity", "compliance_alerts"];
  if (core.includes(id)) return true;
  if (id === "visitors" || id === "daily_report" || id === "forms_pending") {
    return tier === "operaciones" || tier === "todo_incluido";
  }
  if (id === "critical_inventory") {
    return tier === "logistica" || tier === "todo_incluido";
  }
  if (id === "security_summary") {
    return tier === "todo_incluido";
  }
  return false;
}
