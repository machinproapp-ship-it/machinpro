import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { daysSince, heldSince, movementFromRow, toolRoleFromPermissions } from "@/lib/toolTracking";
import type { InventoryLedgerRow } from "@/types/inventoryLedger";

const mv = (p: Partial<InventoryLedgerRow>): InventoryLedgerRow => ({
  id: Math.random().toString(36),
  itemId: "t1",
  movementType: "checkout",
  quantity: 1,
  createdAt: "2026-10-01T08:00:00Z",
  ...p,
});

describe("toolTracking", () => {
  it("heldSince devuelve la última salida sin devolución posterior", () => {
    const rows = [
      mv({ movementType: "checkout", createdAt: "2026-10-01T08:00:00Z" }),
      mv({ movementType: "return", createdAt: "2026-10-02T08:00:00Z" }),
      mv({ movementType: "checkout", createdAt: "2026-10-05T08:00:00Z" }),
      mv({ itemId: "otra", movementType: "checkout", createdAt: "2026-10-09T08:00:00Z" }),
    ];
    expect(heldSince(rows, "t1")).toBe("2026-10-05T08:00:00Z");
  });

  it("heldSince es null si se devolvió", () => {
    const rows = [
      mv({ movementType: "checkout", createdAt: "2026-10-01T08:00:00Z" }),
      mv({ movementType: "return", createdAt: "2026-10-02T08:00:00Z" }),
    ];
    expect(heldSince(rows, "t1")).toBeNull();
  });

  it("daysSince cuenta días completos y nunca negativos", () => {
    const now = new Date("2026-10-11T09:00:00Z").getTime();
    expect(daysSince("2026-10-01T08:00:00Z", now)).toBe(10);
    expect(daysSince("2026-10-12T08:00:00Z", now)).toBe(0);
  });

  it("movementFromRow mapea columnas y tipos desconocidos", () => {
    const m = movementFromRow({
      id: 5,
      item_id: "t1",
      movement_type: "damage",
      quantity: "1",
      performed_by_name: "Ana",
      photo_url: "https://x/y.jpg",
      created_at: "2026-10-01T08:00:00Z",
    });
    expect(m).toMatchObject({ id: "5", movementType: "damage", quantity: 1, performedByName: "Ana", photoUrl: "https://x/y.jpg" });
    expect(movementFromRow({ id: 1, item_id: "x", movement_type: "raro" }).movementType).toBe("status_change");
  });

  it("toolRoleFromPermissions: logística manda; el trabajador solo con permiso", () => {
    expect(toolRoleFromPermissions({}, true)).toBe("logistics");
    expect(toolRoleFromPermissions({ canManageInventory: true }, false)).toBe("logistics");
    expect(toolRoleFromPermissions({ canControlSiteTools: true, canHelpWithTools: true }, false)).toBe("site");
    expect(toolRoleFromPermissions({ canHelpWithTools: true }, false)).toBe("helper");
    expect(toolRoleFromPermissions({}, false)).toBeNull();
  });
});
