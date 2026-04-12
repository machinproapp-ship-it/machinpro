/** Acciones rápidas tras escanear QR de inventario (LogisticsModule → page). */

export type InventoryQrPostScanAction =
  | { kind: "in"; quantity: number; notes?: string }
  | { kind: "out"; quantity: number; projectId: string; notes?: string }
  | {
      kind: "transfer";
      quantity: number;
      fromProjectId: string | null;
      toProjectId: string | null;
      fromLocation: string;
      toLocation: string;
      notes?: string;
    }
  | { kind: "status_change"; newStatus: string; notes?: string };
