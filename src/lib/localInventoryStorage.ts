/** Shape stored in `localStorage` key `machinpro_inventory` (SPA inventory). */
export type LocalInventoryRow = {
  id: string;
  name?: string;
  deletedAt?: string;
};

export function readLocalInventoryItems(): LocalInventoryRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("machinpro_inventory");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LocalInventoryRow[]) : [];
  } catch {
    return [];
  }
}
