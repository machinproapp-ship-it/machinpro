import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { formatMinutes, recordFromJson, workdayRecordCsv } from "@/lib/workdayRecord";

describe("registro de jornada", () => {
  const rec = recordFromJson({
    company: { name: "Obras Pérez" },
    from: "2026-11-01",
    to: "2026-11-30",
    timezone: "Europe/Madrid",
    rows: [
      {
        entry_id: "e1",
        worker: "Ana; López",
        worker_id: "u1",
        day: "2026-11-02",
        clock_in: "2026-11-02T07:00:00Z",
        clock_out: "2026-11-02T15:30:00Z",
        minutes: 510,
        project: "Calle Mayor",
        corrections: 1,
        last_correction: { at: "2026-11-03T09:12:00Z", by: "Luis", before: {}, after: {} },
      },
    ],
  });

  it("lee las filas del servidor", () => {
    expect(rec.rows[0]).toMatchObject({ worker: "Ana; López", minutes: 510, corrections: 1 });
    expect(rec.rows[0].lastCorrection?.by).toBe("Luis");
  });

  it("formatea horas", () => {
    expect(formatMinutes(510)).toBe("8:30");
    expect(formatMinutes(null)).toBe("");
  });

  it("genera CSV con hora local y comillas cuando hace falta", () => {
    const csv = workdayRecordCsv(rec, {
      worker: "Trabajador",
      day: "Día",
      clockIn: "Entrada",
      clockOut: "Salida",
      hours: "Horas",
      project: "Obra",
      corrections: "Correcciones",
      lastCorrection: "Última corrección",
    });
    const lines = csv.replace("﻿", "").split("\r\n");
    expect(lines[0]).toBe("Trabajador;Día;Entrada;Salida;Horas;Obra;Correcciones;Última corrección");
    expect(lines[1]).toBe('"Ana; López";2026-11-02;08:00;16:30;8:30;Calle Mayor;1;2026-11-03 09:12 Luis');
  });
});
