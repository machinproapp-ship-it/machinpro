/** Historial de inventario (cliente + alineado con inventory_movements en Supabase). */

export type InventoryMovementKind =
  | "in"
  | "out"
  | "transfer"
  | "maintenance"
  | "status_change"
  | "import";

export interface InventoryLedgerRow {
  id: string;
  itemId: string;
  itemName?: string;
  movementType: InventoryMovementKind;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  fromProjectId?: string;
  toProjectId?: string;
  performedByProfileId?: string;
  performedByName?: string;
  notes?: string;
  createdAt: string;
}
