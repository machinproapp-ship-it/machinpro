import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { buildRequestLines, isOpenForLogistics, requestFromRow } from "@/lib/resourceRequests";

describe("pedidos de material", () => {
  it("solo manda las líneas con cantidad y el texto libre línea a línea", () => {
    const lines = buildRequestLines({ ply: 3, dw: 0, s24: 12 }, ["ply", "dw", "s24"], "tornillos 3\"\n\n  cinta  ");
    expect(lines).toEqual([
      { inventoryItemId: "ply", quantity: 3 },
      { inventoryItemId: "s24", quantity: 12 },
      { name: 'tornillos 3"', quantity: 1 },
      { name: "cinta", quantity: 1 },
    ]);
  });

  it("ignora cantidades negativas o no numéricas", () => {
    expect(buildRequestLines({ a: -2, b: Number.NaN }, ["a", "b"], "")).toEqual([]);
  });

  it("lee la fila del servidor con sus líneas", () => {
    const r = requestFromRow({
      id: "r1",
      project_id: "p1",
      requested_by: "u1",
      requested_by_name: "Oscar",
      needed_by: "2026-10-28",
      status: "dispatched",
      items: [
        { id: "l1", inventoryItemId: "ply", type: "material", name: "Plywood 3/4", quantity: 3, unit: "sheets", status: "ready" },
        { id: "l2", type: "rare", name: "Algo", quantity: "2", status: "weird" },
      ],
      created_at: "2026-10-27T10:00:00Z",
    });
    expect(r.status).toBe("dispatched");
    expect(r.items[0]).toMatchObject({ inventoryItemId: "ply", quantity: 3, unit: "sheets", status: "ready" });
    expect(r.items[1]).toMatchObject({ type: "material", quantity: 2, status: "pending" });
    expect(isOpenForLogistics(r)).toBe(false);
    expect(isOpenForLogistics({ ...r, status: "ready" })).toBe(true);
  });
});
