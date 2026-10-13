/**
 * Pre-nómina: lo que MachinPro prepara para que la nómina oficial la haga el proveedor
 * (Nethris, ADP, Wagepoint, QuickBooks Payroll, la gestoría…).
 *
 * MachinPro NO calcula impuestos ni cotizaciones: dependen de tablas oficiales por país y
 * provincia (CRA, IRS, Hacienda…), de la situación de cada persona y de acumulados del año.
 * Aquí solo se calcula el BRUTO a partir de horas aprobadas: normales, extra y vacaciones.
 */

export type OvertimeRule = {
  /** Horas a la semana a partir de las cuales son extra (0 = sin extra semanal). */
  weeklyThreshold: number;
  /** Horas al día a partir de las cuales son extra (0 = sin extra diaria). */
  dailyThreshold: number;
  /** Multiplicador de la hora extra (1.5 = 150 %). */
  multiplier: number;
};

/**
 * Regla por defecto según país. El admin la puede cambiar: varía por provincia o convenio
 * (Ontario 44 h/sem, Quebec 40 h/sem, Alberta y BC también 8 h/día…).
 */
export function defaultOvertimeRule(countryCode: string): OvertimeRule {
  const c = (countryCode || "").trim().toUpperCase();
  if (c === "CA") return { weeklyThreshold: 44, dailyThreshold: 0, multiplier: 1.5 };
  if (c === "US") return { weeklyThreshold: 40, dailyThreshold: 0, multiplier: 1.5 };
  return { weeklyThreshold: 40, dailyThreshold: 0, multiplier: 1.5 };
}

/** Porcentaje de vacaciones que se paga con cada nómina (CA: 4 % mínimo en la mayoría de provincias). */
export function defaultVacationPayPct(countryCode: string): number {
  const c = (countryCode || "").trim().toUpperCase();
  if (c === "CA") return 4;
  return 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round2h = (n: number) => Math.round(n * 100) / 100;

/** Lunes de la semana (YYYY-MM-DD) de una fecha YYYY-MM-DD. */
export function weekStartYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  const dow = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return dt.toISOString().slice(0, 10);
}

/**
 * Reparte horas en normales y extra. Primero la extra diaria; después, de las que quedan
 * normales, la semanal (semana de lunes a domingo). Así no se cuenta dos veces.
 */
export function splitRegularOvertime(
  hoursByDate: Record<string, number>,
  rule: OvertimeRule
): { regular: number; overtime: number } {
  const byWeek = new Map<string, { regular: number; overtime: number }>();
  for (const [date, raw] of Object.entries(hoursByDate)) {
    const h = Number.isFinite(raw) && raw > 0 ? raw : 0;
    if (h === 0) continue;
    let reg = h;
    let ot = 0;
    if (rule.dailyThreshold > 0 && h > rule.dailyThreshold) {
      reg = rule.dailyThreshold;
      ot = h - rule.dailyThreshold;
    }
    const wk = weekStartYmd(date);
    const acc = byWeek.get(wk) ?? { regular: 0, overtime: 0 };
    acc.regular += reg;
    acc.overtime += ot;
    byWeek.set(wk, acc);
  }
  let regular = 0;
  let overtime = 0;
  for (const w of byWeek.values()) {
    if (rule.weeklyThreshold > 0 && w.regular > rule.weeklyThreshold) {
      overtime += w.overtime + (w.regular - rule.weeklyThreshold);
      regular += rule.weeklyThreshold;
    } else {
      overtime += w.overtime;
      regular += w.regular;
    }
  }
  return { regular: round2h(regular), overtime: round2h(overtime) };
}

export type PrePayrollRow = {
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  rate: number | null;
  regularPay: number;
  overtimePay: number;
  /** Salarios (normales + extra), sin vacaciones. */
  wages: number;
  vacationPct: number;
  vacationPay: number;
  /** Bruto total que se pasa al proveedor de nómina. */
  grossTotal: number;
};

export function computePrePayrollRow(
  hoursByDate: Record<string, number>,
  rate: number | null,
  rule: OvertimeRule,
  vacationPct: number
): PrePayrollRow {
  const { regular, overtime } = splitRegularOvertime(hoursByDate, rule);
  const r = rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
  const regularPay = r != null ? round2(regular * r) : 0;
  const overtimePay = r != null ? round2(overtime * r * rule.multiplier) : 0;
  const wages = round2(regularPay + overtimePay);
  const vp = Number.isFinite(vacationPct) && vacationPct > 0 ? vacationPct : 0;
  const vacationPay = round2((wages * vp) / 100);
  return {
    regularHours: regular,
    overtimeHours: overtime,
    totalHours: round2h(regular + overtime),
    rate: r,
    regularPay,
    overtimePay,
    wages,
    vacationPct: vp,
    vacationPay,
    grossTotal: round2(wages + vacationPay),
  };
}

/**
 * Exportación "por líneas de ganancia": una fila por persona y concepto (REG, OT, VAC).
 * Es el formato que piden casi todos los proveedores de nómina para importar horas
 * (cada uno con sus propios códigos: se cambian en la hoja antes de importar).
 */
export function prePayrollEarningLines(input: {
  employeeNumber: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  row: PrePayrollRow;
  multiplier: number;
}): Array<{
  employeeNumber: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  earningCode: "REG" | "OT" | "VAC";
  hours: number | null;
  rate: number | null;
  amount: number;
}> {
  const { row } = input;
  const base = {
    employeeNumber: input.employeeNumber,
    employeeName: input.employeeName,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  };
  const out: ReturnType<typeof prePayrollEarningLines> = [];
  if (row.regularHours > 0) {
    out.push({ ...base, earningCode: "REG", hours: row.regularHours, rate: row.rate, amount: row.regularPay });
  }
  if (row.overtimeHours > 0) {
    out.push({
      ...base,
      earningCode: "OT",
      hours: row.overtimeHours,
      rate: row.rate != null ? round2(row.rate * input.multiplier) : null,
      amount: row.overtimePay,
    });
  }
  if (row.vacationPay > 0) {
    out.push({ ...base, earningCode: "VAC", hours: null, rate: null, amount: row.vacationPay });
  }
  return out;
}
