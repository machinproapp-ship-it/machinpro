/** Normalize DB token to translation key suffix (e.g. `in_progress`). */
function hazardTokenKey(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_");
}

export function translateHazardSeverity(severity: string, t: Record<string, string>): string {
  const k = hazardTokenKey(severity);
  const key = `hazard_severity_${k}`;
  return t[key] ?? severity;
}

export function translateHazardStatus(status: string, t: Record<string, string>): string {
  const k = hazardTokenKey(status);
  const key = `hazard_status_${k}`;
  return t[key] ?? status;
}
