/** companies.settings JSON (AH-43C) — solo datos de negocio acordados con la API. */
export type CompanySettingsJson = {
  defaultVacationDays?: number;
  weeklyHoursGoal?: number;
  /** Orden / preferencia de widgets (opcional; el layout principal sigue en dashboard_config). */
  dashboardWidgets?: string[];
};

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
  return out;
}
