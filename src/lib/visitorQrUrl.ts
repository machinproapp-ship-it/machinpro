/** URL base para el QR de check-in (Vercel / env / fallback sprint). */
export function getVisitorQrBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://machinpro-iota.vercel.app";
}

/** Dominio público para QR por proyecto (producción machin.pro si no hay env). */
export function getVisitorProjectQrBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://machin.pro";
}

export function buildVisitorCheckInUrl(companyId: string, projectId?: string | null): string {
  let path: string;
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      path = `${origin}/visit/${companyId}`;
    } else {
      path = `${getVisitorQrBaseUrl()}/visit/${companyId}`;
    }
  } else {
    path = `${getVisitorQrBaseUrl()}/visit/${companyId}`;
  }
  if (projectId) {
    const sep = path.includes("?") ? "&" : "?";
    path = `${path}${sep}project=${encodeURIComponent(projectId)}`;
  }
  return path;
}

/** QR único por proyecto: /visit/[projectId] (misma ruta resuelve empresa u obra). */
export function buildVisitorProjectCheckInUrl(projectId: string): string {
  const enc = encodeURIComponent(projectId);
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${origin}/visit/${enc}`;
    }
  }
  return `${getVisitorProjectQrBaseUrl()}/visit/${enc}`;
}
