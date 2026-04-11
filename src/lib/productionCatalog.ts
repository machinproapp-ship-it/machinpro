/**
 * Piecework / production catalog, project overrides, and daily production reports.
 */

export type ProductionUnit = "ln_ft" | "sq_ft" | "unit" | "m2" | "m" | "kg" | "hour" | "other";

export const PRODUCTION_UNITS: ProductionUnit[] = [
  "ln_ft",
  "sq_ft",
  "unit",
  "m2",
  "m",
  "kg",
  "hour",
  "other",
];

export function isProductionUnit(u: string): u is ProductionUnit {
  return (PRODUCTION_UNITS as string[]).includes(u);
}

export interface CatalogItem {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  unit: ProductionUnit;
  costPrice: number;
  sellPrice: number;
  currency: string;
  category?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ProjectTaskOverride {
  id: string;
  companyId: string;
  projectId: string;
  catalogItemId: string;
  customCostPrice?: number | null;
  customSellPrice?: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface ProductionReportEntry {
  id: string;
  catalogItemId: string;
  taskName: string;
  unit: ProductionUnit | string;
  unitsCompleted: number;
  costPrice: number;
  sellPrice: number;
  totalCost: number;
  totalSell: number;
}

export interface ProductionReport {
  id: string;
  companyId: string;
  employeeId: string;
  projectId: string;
  date: string;
  entries: ProductionReportEntry[];
  totalUnits: number;
  totalCost: number;
  totalSell: number;
  status: "draft" | "approved" | "paid";
}

export function mapCatalogRow(row: Record<string, unknown>): CatalogItem | null {
  const id = row.id != null ? String(row.id) : "";
  const companyId = row.company_id != null ? String(row.company_id) : "";
  if (!id || !companyId) return null;
  const u = String(row.unit ?? "unit");
  return {
    id,
    companyId,
    name: String(row.name ?? ""),
    description: row.description != null ? String(row.description) : null,
    unit: isProductionUnit(u) ? u : "other",
    costPrice: Number(row.cost_price ?? 0),
    sellPrice: Number(row.sell_price ?? 0),
    currency: String(row.currency ?? "CAD"),
    category: row.category != null ? String(row.category) : null,
    isActive: row.is_active !== false,
    createdAt: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
  };
}

export function mapOverrideRow(row: Record<string, unknown>): ProjectTaskOverride | null {
  const id = row.id != null ? String(row.id) : "";
  const companyId = row.company_id != null ? String(row.company_id) : "";
  const projectId = row.project_id != null ? String(row.project_id) : "";
  const catalogItemId = row.catalog_item_id != null ? String(row.catalog_item_id) : "";
  if (!id || !companyId || !projectId || !catalogItemId) return null;
  return {
    id,
    companyId,
    projectId,
    catalogItemId,
    customCostPrice:
      row.custom_cost_price != null && row.custom_cost_price !== ""
        ? Number(row.custom_cost_price)
        : null,
    customSellPrice:
      row.custom_sell_price != null && row.custom_sell_price !== ""
        ? Number(row.custom_sell_price)
        : null,
    isActive: row.is_active !== false,
    createdAt: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
  };
}

export function mapProductionReportRow(row: Record<string, unknown>): ProductionReport | null {
  const id = row.id != null ? String(row.id) : "";
  const companyId = row.company_id != null ? String(row.company_id) : "";
  const employeeId = row.employee_id != null ? String(row.employee_id) : "";
  const projectId = row.project_id != null ? String(row.project_id) : "";
  if (!id || !companyId || !employeeId || !projectId) return null;
  const rawEntries = row.entries;
  const entries: ProductionReportEntry[] = Array.isArray(rawEntries)
    ? (rawEntries as Record<string, unknown>[]).map((e, i) => {
        const uid = String(e.id ?? `entry-${i}`);
        const catId = String(e.catalogItemId ?? e.catalog_item_id ?? "");
        const un = String(e.unit ?? "unit");
        return {
          id: uid,
          catalogItemId: catId,
          taskName: String(e.taskName ?? e.task_name ?? ""),
          unit: isProductionUnit(un) ? un : un,
          unitsCompleted: Number(e.unitsCompleted ?? e.units_completed ?? 0),
          costPrice: Number(e.costPrice ?? e.cost_price ?? 0),
          sellPrice: Number(e.sellPrice ?? e.sell_price ?? 0),
          totalCost: Number(e.totalCost ?? e.total_cost ?? 0),
          totalSell: Number(e.totalSell ?? e.total_sell ?? 0),
        };
      })
    : [];
  const st = String(row.status ?? "draft").toLowerCase();
  const status: ProductionReport["status"] =
    st === "approved" || st === "paid" ? st : "draft";
  return {
    id,
    companyId,
    employeeId,
    projectId,
    date:
      row.report_date != null
        ? String(row.report_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    entries,
    totalUnits: Number(row.total_units ?? 0),
    totalCost: Number(row.total_cost ?? 0),
    totalSell: Number(row.total_sell ?? 0),
    status,
  };
}

/** Effective sell/cost for a catalog item on a project (override wins). */
export function effectivePrices(
  item: CatalogItem,
  override: ProjectTaskOverride | undefined
): { cost: number; sell: number } {
  const cost =
    override?.customCostPrice != null && Number.isFinite(override.customCostPrice)
      ? override.customCostPrice
      : item.costPrice;
  const sell =
    override?.customSellPrice != null && Number.isFinite(override.customSellPrice)
      ? override.customSellPrice
      : item.sellPrice;
  return { cost, sell };
}
