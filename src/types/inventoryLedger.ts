/** Historial de inventario (cliente + alineado con inventory_movements en Supabase). */

export type InventoryMovementKind =
  | "in"
  | "out"
  | "transfer"
  | "maintenance"
  | "status_change"
  | "import"
  /** El trabajador se la lleva (escaneando el QR). */
  | "checkout"
  /** Vuelve al almacén. */
  | "return"
  /** Avería reportada. */
  | "damage";

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
  /** De quién a quién (ids de perfil), en "me la llevo" / "la devuelvo". */
  fromUserId?: string;
  toUserId?: string;
  photoUrl?: string;
}
