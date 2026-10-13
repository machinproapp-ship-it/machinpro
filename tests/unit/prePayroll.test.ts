import { describe, expect, it } from "vitest";
import {
  computePrePayrollRow,
  defaultOvertimeRule,
  prePayrollEarningLines,
  splitRegularOvertime,
  weekStartYmd,
} from "@/lib/prePayroll";
import { normalizePrePayrollSettings } from "@/lib/companySettingsTypes";

describe("pre-nómina", () => {
  it("la semana empieza en lunes", () => {
    expect(weekStartYmd("2026-10-12")).toBe("2026-10-12"); // lunes
    expect(weekStartYmd("2026-10-18")).toBe("2026-10-12"); // domingo
    expect(weekStartYmd("2026-10-19")).toBe("2026-10-19");
  });

  it("Ontario: extra a partir de 44 h por semana, no por quincena", () => {
    const rule = defaultOvertimeRule("CA");
    // semana 1: 5 × 10 h = 50 h → 6 extra; semana 2: 5 × 8 h = 40 h → 0 extra
    const h: Record<string, number> = {};
    for (const d of ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]) h[d] = 10;
    for (const d of ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]) h[d] = 8;
    expect(splitRegularOvertime(h, rule)).toEqual({ regular: 84, overtime: 6 });
  });

  it("extra diaria y semanal no se cuentan dos veces", () => {
    const rule = { weeklyThreshold: 40, dailyThreshold: 8, multiplier: 1.5 };
    const h = { "2026-10-12": 10, "2026-10-13": 10, "2026-10-14": 10, "2026-10-15": 10, "2026-10-16": 10 };
    // diaria: 5 × 2 = 10 extra; quedan 40 normales → semanal no añade
    expect(splitRegularOvertime(h, rule)).toEqual({ regular: 40, overtime: 10 });
  });

  it("bruto = normales + extra × 1,5 + 4 % de vacaciones, sin impuestos", () => {
    const h: Record<string, number> = {};
    for (const d of ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]) h[d] = 10;
    const r = computePrePayrollRow(h, 30, defaultOvertimeRule("CA"), 4);
    expect(r.regularPay).toBe(1320); // 44 × 30
    expect(r.overtimePay).toBe(270); // 6 × 45
    expect(r.wages).toBe(1590);
    expect(r.vacationPay).toBe(63.6);
    expect(r.grossTotal).toBe(1653.6);
    expect(r).not.toHaveProperty("net");
  });

  it("sin tarifa no inventa importes", () => {
    const r = computePrePayrollRow({ "2026-10-12": 8 }, null, defaultOvertimeRule("CA"), 4);
    expect(r.regularHours).toBe(8);
    expect(r.rate).toBeNull();
    expect(r.grossTotal).toBe(0);
  });

  it("exporta líneas REG / OT / VAC para importar en el proveedor", () => {
    const h = { "2026-10-12": 12 };
    const rule = { weeklyThreshold: 0, dailyThreshold: 8, multiplier: 1.5 };
    const row = computePrePayrollRow(h, 20, rule, 4);
    const lines = prePayrollEarningLines({
      employeeNumber: "82",
      employeeName: "Prueba",
      periodStart: "2026-10-12",
      periodEnd: "2026-10-25",
      row,
      multiplier: 1.5,
    });
    expect(lines.map((l) => l.earningCode)).toEqual(["REG", "OT", "VAC"]);
    expect(lines[1]!.rate).toBe(30);
    expect(lines[2]!.amount).toBe(row.vacationPay);
  });

  it("reglas guardadas: valores fuera de rango se rechazan", () => {
    expect(normalizePrePayrollSettings({ weeklyOtThreshold: 44, dailyOtThreshold: 0, otMultiplier: 1.5, vacationPayPct: 4 })).toEqual({
      weeklyOtThreshold: 44,
      dailyOtThreshold: 0,
      otMultiplier: 1.5,
      vacationPayPct: 4,
    });
    expect(normalizePrePayrollSettings({ weeklyOtThreshold: 500, dailyOtThreshold: 0, otMultiplier: 1.5, vacationPayPct: 4 })).toBeUndefined();
  });
});
