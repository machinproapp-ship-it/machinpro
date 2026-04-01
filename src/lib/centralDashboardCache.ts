/**
 * Caché ligera del dashboard Central (60s) — evita repetir merge de dashboard_config.
 * Clave en sessionStorage: machinpro_central_data
 */

export const CENTRAL_DASHBOARD_STORAGE_KEY = "machinpro_central_data";
export const CENTRAL_DASHBOARD_TTL_MS = 60_000;

export type CentralDashboardConfigCache = {
  key: string;
  at: number;
  mergedRaw: unknown;
};

function cacheKey(companyId: string, userId: string): string {
  return `${companyId}:${userId}`;
}

export function readCentralDashboardConfigCache(
  companyId: string,
  userId: string
): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CENTRAL_DASHBOARD_STORAGE_KEY);
    if (!raw) return null;
    const row = JSON.parse(raw) as CentralDashboardConfigCache | null;
    if (!row || row.key !== cacheKey(companyId, userId)) return null;
    if (Date.now() - row.at > CENTRAL_DASHBOARD_TTL_MS) return null;
    return row.mergedRaw;
  } catch {
    return null;
  }
}

export function clearCentralDashboardConfigCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CENTRAL_DASHBOARD_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function writeCentralDashboardConfigCache(
  companyId: string,
  userId: string,
  mergedRaw: unknown
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CentralDashboardConfigCache = {
      key: cacheKey(companyId, userId),
      at: Date.now(),
      mergedRaw,
    };
    window.sessionStorage.setItem(CENTRAL_DASHBOARD_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
