import { describe, expect, it } from "vitest";
import { permissionsToModule } from "@/lib/modulePermissions";
import { applyPlanToModulePermissions, planAllowsModule } from "@/lib/planPermissions";
import { emptyRolePermissionsInline } from "@/types/roles";
import type { RolePermissions } from "@/types/roles";

function role(on: Partial<RolePermissions>): RolePermissions {
  return { ...emptyRolePermissionsInline(), ...on };
}

describe("menú por rol", () => {
  const worker = role({
    canViewSchedule: true,
    canViewForms: true,
    canFillForms: true,
    canCreateForms: true,
    canPerformInspections: true,
    canViewOnlyAssignedProjects: true,
    canViewProjectForms: true,
    canViewSettings: true,
  });

  it("el trabajador no ve Operaciones ni Logística aunque inspeccione y rellene formularios", () => {
    const m = permissionsToModule(worker);
    expect(m.site).toBe(false);
    expect(m.warehouse).toBe(false);
    expect(m.office).toBe(false);
    expect(m.canAccessSchedule).toBe(true);
    expect(m.formsNav).toBe(true);
  });

  it("el supervisor de sus obras sí entra en Operaciones", () => {
    const m = permissionsToModule(
      role({ canViewOnlyAssignedProjects: true, canViewProjectGeneral: true, canViewInspections: true })
    );
    expect(m.site).toBe(true);
    expect(m.warehouse).toBe(true);
  });

  it("logística entra en Logística", () => {
    expect(permissionsToModule(role({ canViewLogistics: true })).warehouse).toBe(true);
  });
});

describe("plan contratado", () => {
  const full = permissionsToModule(
    role({ canViewCentral: true, canViewProjects: true, canViewLogistics: true, canViewSecurity: true, canViewSchedule: true })
  );

  it("Esencial: ni Operaciones ni Logística, también en la prueba", () => {
    for (const status of ["active", "trialing"]) {
      const m = applyPlanToModulePermissions(full, "esencial", { subscriptionStatus: status });
      expect(m.site).toBe(false);
      expect(m.warehouse).toBe(false);
      expect(m.office).toBe(true);
    }
  });

  it("Todo incluido: todo", () => {
    const m = applyPlanToModulePermissions(full, "todo_incluido", { subscriptionStatus: "active" });
    expect(m.site && m.warehouse && m.canAccessSecurity).toBe(true);
  });

  it("prueba sin plan elegido: todo", () => {
    expect(planAllowsModule("trial", "site")).toBe(true);
    expect(planAllowsModule(null, "warehouse")).toBe(true);
  });

  it("Logística no incluye Operaciones", () => {
    expect(planAllowsModule("logistica", "site")).toBe(false);
    expect(planAllowsModule("logistica", "warehouse")).toBe(true);
  });
});
