/**
 * Tipos y tarifas de la pre-nómina. Impuestos y cotizaciones los calcula el proveedor de nómina.
 */

import type { CatalogItem } from "@/lib/productionCatalog";

export type PayrollPeriod = "weekly" | "biweekly" | "monthly";

/** Inputs for resolving hourly / production-equivalent rate (AH-17). */
export type PayrollEmployeeRateInput = {
  id: string;
  laborHourlyRate?: number | null;
  hourlyRate?: number;
  role?: string | null;
  name?: string | null;
};

function catalogHourlyRate(c: Pick<CatalogItem, "sellPrice" | "unit">): number | null {
  const p = Number(c.sellPrice);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (String(c.unit ?? "").toLowerCase() === "hour") return p;
  return p;
}

/**
 * Resolves effective hourly rate: profile hourly → catalog match by role / name.
 * Returns null when nothing is configured (UI shows "—", not $0).
 */
export function resolveEmployeeRate(
  employee: PayrollEmployeeRateInput,
  catalog: Pick<CatalogItem, "name" | "category" | "sellPrice" | "unit" | "isActive">[]
): number | null {
  const explicit = employee.laborHourlyRate;
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) return explicit;
  const hr = employee.hourlyRate;
  if (hr != null && Number.isFinite(hr) && hr > 0) return hr;

  const role = (employee.role ?? "").toLowerCase().trim();
  const nm = (employee.name ?? "").toLowerCase().trim();
  const firstTok = nm.split(/\s+/)[0] ?? "";

  for (const c of catalog) {
    if (c.isActive === false) continue;
    const rate = catalogHourlyRate(c);
    if (rate == null) continue;
    const cat = (c.category ?? "").toLowerCase().trim();
    const cn = (c.name ?? "").toLowerCase().trim();
    if (role && cat && cat === role) return rate;
    if (role && cn && (cn === role || cn.includes(role))) return rate;
    if (firstTok && cn && (cn.includes(firstTok) || firstTok.includes(cn))) return rate;
  }
  return null;
}

/*
 * MachinPro ya no calcula impuestos ni cotizaciones (antes usaba porcentajes fijos por país,
 * que no coinciden con las tablas oficiales). La parte de nómina es pre-nómina: ver src/lib/prePayroll.ts.
 */
