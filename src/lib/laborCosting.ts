/** AH-17 labor costing: effective hourly rate and lookups for clock entries (profile vs legacy id). */

export type LaborEmployeeInput = {
  id: string;
  laborHourlyRate?: number | null;
  payType?: "hourly" | "salary";
  hourlyRate?: number;
};

export function effectiveLaborHourlyRate(e: LaborEmployeeInput): number | null {
  const explicit = e.laborHourlyRate;
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) return explicit;
  if (e.payType === "hourly" && e.hourlyRate != null && Number.isFinite(e.hourlyRate) && e.hourlyRate > 0) {
    return e.hourlyRate;
  }
  return null;
}

export function companyHasConfiguredLaborRates(employees: LaborEmployeeInput[]): boolean {
  return employees.some((x) => effectiveLaborHourlyRate(x) != null);
}

/** user_profiles.id → rate (for time_entries.user_id). */
export function buildLaborRateByUserId(employees: LaborEmployeeInput[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of employees) {
    const r = effectiveLaborHourlyRate(e);
    if (r != null) out[e.id] = r;
  }
  return out;
}

/**
 * Keys: profile id and legacy employee_id (when present) for matching clock rows.
 */
export function buildLaborRateLookupForClock(
  employees: LaborEmployeeInput[],
  profileToLegacyEmployeeId: Record<string, string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of employees) {
    const r = effectiveLaborHourlyRate(e);
    if (r == null) continue;
    out[e.id] = r;
    const leg = profileToLegacyEmployeeId[e.id];
    if (leg) out[leg] = r;
  }
  return out;
}

function timeToHours(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) + ((m ?? 0) / 60);
}

function hoursBetweenWall(clockIn: string, clockOut: string): number {
  return Math.max(0, timeToHours(clockOut) - timeToHours(clockIn));
}

export function hoursWorkedFromClockFields(e: {
  clockIn: string;
  clockOut?: string;
  clockInAtIso?: string;
  clockOutAtIso?: string | null;
}): number {
  if (e.clockOut == null || e.clockOut === "") return 0;
  if (e.clockInAtIso && e.clockOutAtIso) {
    const a = Date.parse(e.clockInAtIso);
    const b = Date.parse(e.clockOutAtIso);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) return (b - a) / 3_600_000;
  }
  return hoursBetweenWall(e.clockIn, e.clockOut);
}

export function laborCostForHours(hours: number, hourlyRate: number | null | undefined): number {
  if (hourlyRate == null || !Number.isFinite(hourlyRate) || hourlyRate <= 0) return 0;
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours * hourlyRate * 100) / 100;
}

export function invertProfileToLegacy(profileToLegacy: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [pid, leg] of Object.entries(profileToLegacy)) {
    if (leg) out[leg] = pid;
  }
  return out;
}

export type ProjectLaborBreakdownRow = { employeeId: string; name: string; hours: number; cost: number };

export type ProjectLaborSummary = {
  totalHours: number;
  totalCost: number;
  byEmployee: ProjectLaborBreakdownRow[];
};

export function aggregateProjectLabor(
  projectId: string,
  assignedProfileIds: string[],
  clockEntries: Array<{
    employeeId: string;
    projectId?: string;
    clockIn: string;
    clockOut?: string;
    clockInAtIso?: string;
    clockOutAtIso?: string | null;
  }>,
  employees: LaborEmployeeInput[],
  employeeNameById: Record<string, string>,
  profileToLegacy: Record<string, string>
): ProjectLaborSummary {
  const assigned = new Set(assignedProfileIds);
  const legacyToProfile = invertProfileToLegacy(profileToLegacy);
  const rateLookup = buildLaborRateLookupForClock(employees, profileToLegacy);

  const byEmp = new Map<string, { hours: number; cost: number }>();

  for (const row of clockEntries) {
    if (row.projectId !== projectId) continue;
    const hid = row.employeeId;
    const profileId = assigned.has(hid) ? hid : legacyToProfile[hid];
    if (!profileId || !assigned.has(profileId)) continue;
    const h = hoursWorkedFromClockFields(row);
    if (h <= 0) continue;
    const rate = rateLookup[hid] ?? rateLookup[profileId] ?? null;
    const cost = laborCostForHours(h, rate);
    const cur = byEmp.get(profileId) ?? { hours: 0, cost: 0 };
    cur.hours += h;
    cur.cost += cost;
    byEmp.set(profileId, cur);
  }

  let totalHours = 0;
  let totalCost = 0;
  const byEmployee: ProjectLaborBreakdownRow[] = [];
  for (const pid of assignedProfileIds) {
    const agg = byEmp.get(pid) ?? { hours: 0, cost: 0 };
    totalHours += agg.hours;
    totalCost += agg.cost;
    byEmployee.push({
      employeeId: pid,
      name: employeeNameById[pid] ?? pid,
      hours: Math.round(agg.hours * 100) / 100,
      cost: Math.round(agg.cost * 100) / 100,
    });
  }
  byEmployee.sort((a, b) => b.cost - a.cost || b.hours - a.hours);

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    byEmployee,
  };
}
