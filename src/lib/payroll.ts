/**
 * Orientative payroll deductions by country (Admin may override per entry).
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

export type DeductionType =
  | "income_tax"
  | "social_security"
  | "health_insurance"
  | "pension"
  | "unemployment"
  | "other";

export type PayrollDeduction = {
  type: DeductionType;
  nameKey: string;
  name: string;
  rate: number;
  amount: number;
  isEmployer: boolean;
};

export type PayrollEntry = {
  employeeId: string;
  employeeName: string;
  period: { start: string; end: string };
  hoursWorked: number;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
  deductions: PayrollDeduction[];
  totalDeductions: number;
  netPay: number;
  employerCost: number;
  currency: string;
  countryCode: string;
  status: "draft" | "approved" | "paid";
};

export type PayrollSummary = {
  period: { start: string; end: string };
  entries: PayrollEntry[];
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerCost: number;
};

type RateLine = { type: DeductionType; nameKey: string; rate: number; isEmployer?: boolean };

const COUNTRY_RULES: Record<string, RateLine[]> = {
  CA: [
    { type: "pension", nameKey: "payroll_deduction_cpp", rate: 0.0595 },
    { type: "unemployment", nameKey: "payroll_deduction_ei", rate: 0.0166 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.2 },
  ],
  US: [
    { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.062 },
    { type: "health_insurance", nameKey: "payroll_deduction_health", rate: 0.0145 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.18 },
  ],
  MX: [
    { type: "social_security", nameKey: "payroll_deduction_imss", rate: 0.03175 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.1 },
  ],
  ES: [
    { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.0635 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.2 },
  ],
  GB: [
    { type: "social_security", nameKey: "payroll_deduction_ni", rate: 0.08 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.2 },
  ],
  UK: [
    { type: "social_security", nameKey: "payroll_deduction_ni", rate: 0.08 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.2 },
  ],
  DE: [
    { type: "pension", nameKey: "payroll_deduction_pension", rate: 0.093 },
    { type: "health_insurance", nameKey: "payroll_deduction_health", rate: 0.073 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.19 },
  ],
  FR: [
    { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.22 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.14 },
  ],
  IT: [
    { type: "social_security", nameKey: "payroll_deduction_inps", rate: 0.0919 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.23 },
  ],
  PT: [
    { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.11 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.145 },
  ],
  NL: [
    { type: "pension", nameKey: "payroll_deduction_aow", rate: 0.179 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.37 },
  ],
  BE: [
    { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.1307 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.25 },
  ],
  AT: [
    { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.1812 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.2 },
  ],
  SE: [
    { type: "pension", nameKey: "payroll_deduction_pension", rate: 0.07 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.3 },
  ],
  NO: [
    { type: "social_security", nameKey: "payroll_deduction_trygde", rate: 0.079 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.22 },
  ],
  DK: [
    { type: "pension", nameKey: "payroll_deduction_atp", rate: 0.009 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.37 },
  ],
  FI: [
    { type: "pension", nameKey: "payroll_deduction_pension", rate: 0.0715 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.25 },
  ],
  CH: [
    { type: "social_security", nameKey: "payroll_deduction_ahv", rate: 0.053 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.15 },
  ],
  IE: [
    { type: "social_security", nameKey: "payroll_deduction_prsi", rate: 0.04 },
    { type: "health_insurance", nameKey: "payroll_deduction_usc", rate: 0.04 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.2 },
  ],
  LU: [
    { type: "pension", nameKey: "payroll_deduction_pension", rate: 0.08 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.15 },
  ],
  GR: [
    { type: "social_security", nameKey: "payroll_deduction_ika", rate: 0.1387 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.22 },
  ],
  PL: [
    { type: "social_security", nameKey: "payroll_deduction_zus", rate: 0.1371 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.17 },
  ],
  CZ: [
    { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.065 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.15 },
  ],
  RO: [
    { type: "social_security", nameKey: "payroll_deduction_cas", rate: 0.25 },
    { type: "health_insurance", nameKey: "payroll_deduction_cass", rate: 0.1 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.1 },
  ],
  HU: [
    { type: "pension", nameKey: "payroll_deduction_pension", rate: 0.1 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.15 },
  ],
  HR: [
    { type: "pension", nameKey: "payroll_deduction_pension", rate: 0.15 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.2 },
  ],
  SK: [
    { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.094 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.19 },
  ],
  BG: [
    { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.129 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.1 },
  ],
  AR: [
    { type: "pension", nameKey: "payroll_deduction_pension", rate: 0.11 },
    { type: "health_insurance", nameKey: "payroll_deduction_health", rate: 0.03 },
    { type: "unemployment", nameKey: "payroll_deduction_unemployment", rate: 0.03 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.15 },
  ],
  BR: [
    { type: "social_security", nameKey: "payroll_deduction_inss", rate: 0.09 },
    { type: "pension", nameKey: "payroll_deduction_fgts", rate: 0.08, isEmployer: true },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.15 },
  ],
  CL: [
    { type: "pension", nameKey: "payroll_deduction_afp", rate: 0.1 },
    { type: "health_insurance", nameKey: "payroll_deduction_health", rate: 0.07 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.04 },
  ],
  CO: [
    { type: "pension", nameKey: "payroll_deduction_pension", rate: 0.04 },
    { type: "health_insurance", nameKey: "payroll_deduction_health", rate: 0.04 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.05 },
  ],
  PE: [
    { type: "pension", nameKey: "payroll_deduction_onp", rate: 0.13 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.08 },
  ],
  UY: [
    { type: "pension", nameKey: "payroll_deduction_afap", rate: 0.15 },
    { type: "health_insurance", nameKey: "payroll_deduction_health", rate: 0.03 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.1 },
  ],
  AU: [
    { type: "pension", nameKey: "payroll_deduction_super", rate: 0.11, isEmployer: true },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.19 },
  ],
  NZ: [
    { type: "pension", nameKey: "payroll_deduction_kiwisaver", rate: 0.03 },
    { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.175 },
  ],
};

const LATAM_DEFAULT: RateLine[] = [
  { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.0483 },
  { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.1 },
];

const EU_DEFAULT: RateLine[] = [
  { type: "social_security", nameKey: "payroll_deduction_social_security", rate: 0.1 },
  { type: "income_tax", nameKey: "payroll_deduction_income_tax", rate: 0.2 },
];

function rulesForCountry(countryCode: string): RateLine[] {
  const c = (countryCode || "CA").trim().toUpperCase();
  if (COUNTRY_RULES[c]) return COUNTRY_RULES[c];
  if (["GT", "HN", "SV", "NI", "CR", "PA"].includes(c)) return LATAM_DEFAULT;
  if (c === "EU") return EU_DEFAULT;
  return COUNTRY_RULES.CA;
}

export function calculateDeductions(
  grossPay: number,
  countryCode: string,
  _currency: string
): PayrollDeduction[] {
  const g = Number.isFinite(grossPay) && grossPay > 0 ? grossPay : 0;
  const lines = rulesForCountry(countryCode);
  return lines.map((row) => {
    const amount = Math.round(g * row.rate * 100) / 100;
    return {
      type: row.type,
      nameKey: row.nameKey,
      name: row.nameKey,
      rate: row.rate,
      amount,
      isEmployer: row.isEmployer === true,
    };
  });
}

export function totalEmployeeDeductions(deductions: PayrollDeduction[]): number {
  const s = deductions.filter((d) => !d.isEmployer).reduce((a, d) => a + d.amount, 0);
  return Math.round(s * 100) / 100;
}

export function totalEmployerContributions(deductions: PayrollDeduction[]): number {
  const s = deductions.filter((d) => d.isEmployer).reduce((a, d) => a + d.amount, 0);
  return Math.round(s * 100) / 100;
}
