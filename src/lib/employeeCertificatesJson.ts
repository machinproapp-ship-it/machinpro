/** Shared parsing for `user_profiles.certificates` JSONB (client + server safe). */

export type ParsedEmployeeCert = {
  id: string;
  name: string;
  expiryDate: string;
  status?: string;
};

export function parseProfileCertificates(raw: unknown): ParsedEmployeeCert[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: ParsedEmployeeCert[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const expRaw =
      (typeof o.expiryDate === "string" && o.expiryDate) ||
      (typeof o.expiry_date === "string" && o.expiry_date) ||
      "";
    if (!name || !expRaw) continue;
    const id =
      typeof o.id === "string" && o.id.trim()
        ? o.id.trim()
        : `${name}:${expRaw}`;
    const status = typeof o.status === "string" ? o.status : undefined;
    out.push({ id, name, expiryDate: expRaw.slice(0, 10), status });
  }
  return out;
}
