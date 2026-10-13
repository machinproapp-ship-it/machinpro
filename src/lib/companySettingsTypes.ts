/** companies.settings JSON (AH-43C) — solo datos de negocio acordados con la API. */
export type CompanySettingsJson = {
  defaultVacationDays?: number;
  weeklyHoursGoal?: number;
  /** Orden / preferencia de widgets (opcional; el layout principal sigue en dashboard_config). */
  dashboardWidgets?: string[];
  /** Pre-nómina: horas extra y vacaciones (el proveedor de nómina hace el resto). */
  prePayroll?: PrePayrollSettings;
};

export type PrePayrollSettings = {
  weeklyOtThreshold: number;
  dailyOtThreshold: number;
  otMultiplier: number;
  vacationPayPct: number;
};

export function normalizePrePayrollSettings(raw: unknown): PrePayrollSettings | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number): number | null => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const w = num(o.weeklyOtThreshold, 0, 168);
  const d = num(o.dailyOtThreshold, 0, 24);
  const m = num(o.otMultiplier, 1, 3);
  const v = num(o.vacationPayPct, 0, 20);
  if (w === null || d === null || m === null || v === null) return undefined;
  return { weeklyOtThreshold: w, dailyOtThreshold: d, otMultiplier: m, vacationPayPct: v };
}

export const DEFAULT_COMPANY_SETTINGS: Required<
  Pick<CompanySettingsJson, "defaultVacationDays" | "weeklyHoursGoal">
> = {
  defaultVacationDays: 20,
  weeklyHoursGoal: 40,
};

export function normalizeCompanySettings(raw: unknown): CompanySettingsJson {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: CompanySettingsJson = {};
  const dv = o.defaultVacationDays;
  if (typeof dv === "number" && Number.isFinite(dv) && dv >= 0 && dv <= 366) {
    out.defaultVacationDays = Math.round(dv);
  }
  const wh = o.weeklyHoursGoal;
  if (typeof wh === "number" && Number.isFinite(wh) && wh >= 1 && wh <= 168) {
    out.weeklyHoursGoal = Math.round(wh);
  }
  const dw = o.dashboardWidgets;
  if (Array.isArray(dw) && dw.every((x) => typeof x === "string")) {
    out.dashboardWidgets = dw as string[];
  }
  const pp = normalizePrePayrollSettings(o.prePayroll);
  if (pp) out.prePayroll = pp;
  return out;
}
