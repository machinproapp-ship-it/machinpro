import { describe, expect, it } from "vitest";
import { findOpenClockToday, isSelfClockId } from "@/lib/clockSelf";
import { ackCoversEvents, addDaysYmd, monthGrid, type ProjectCalendarEvent } from "@/lib/projectCalendar";
import { currentPayPeriod } from "@/components/WorkerHoursCard";

describe("mi fichaje", () => {
  const entries = [
    { id: "a", employeeId: "profile-1", date: "2026-10-12", clockIn: "08:32" },
    { id: "b", employeeId: "emp-9", date: "2026-10-11", clockIn: "06:44" },
  ];

  it("encuentra la jornada abierta de hoy por id de perfil aunque no haya id de empleado", () => {
    expect(findOpenClockToday(entries, [null, "profile-1"], "2026-10-12")?.id).toBe("a");
  });

  it("no confunde la jornada de otro día ni la de otra persona", () => {
    expect(findOpenClockToday(entries, ["emp-9"], "2026-10-12")).toBeUndefined();
    expect(findOpenClockToday(entries, ["otra"], "2026-10-12")).toBeUndefined();
    expect(isSelfClockId(undefined, ["x"])).toBe(false);
  });
});

describe("periodo de pago", () => {
  it("quincenal anclado al lunes 5 de enero de 2026", () => {
    expect(currentPayPeriod("biweekly", "2026-10-12")).toEqual({ start: "2026-10-12", end: "2026-10-25" });
    expect(currentPayPeriod("biweekly", "2026-10-25")).toEqual({ start: "2026-10-12", end: "2026-10-25" });
  });
  it("semanal de lunes a domingo y mensual por mes natural", () => {
    expect(currentPayPeriod("weekly", "2026-10-14")).toEqual({ start: "2026-10-12", end: "2026-10-18" });
    expect(currentPayPeriod("monthly", "2026-02-10")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});

describe("calendario de obra", () => {
  const ev = (id: string, updatedAt = "2026-10-13T10:00:00Z"): ProjectCalendarEvent => ({
    id,
    projectId: "p",
    date: "2026-10-13",
    startTime: null,
    endTime: null,
    kind: "task",
    title: id,
    notes: null,
    createdBy: null,
    createdByName: null,
    createdAt: updatedAt,
    updatedAt,
  });
  const ack = { id: "k", projectId: "p", date: "2026-10-13", userId: "u", userName: null, eventIds: ["e1"], ackedAt: "2026-10-13T11:00:00Z" };

  it("el enterado vale mientras no se añada ni cambie nada", () => {
    expect(ackCoversEvents([ack], "u", [ev("e1")])).not.toBeNull();
  });
  it("si se añade una entrada o se cambia después, vuelve a pedirse", () => {
    expect(ackCoversEvents([ack], "u", [ev("e1"), ev("e2")])).toBeNull();
    expect(ackCoversEvents([ack], "u", [ev("e1", "2026-10-13T12:00:00Z")])).toBeNull();
  });
  it("el mes empieza en lunes y tiene 6 semanas", () => {
    const g = monthGrid(2026, 9);
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-09-28");
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
  });
});
