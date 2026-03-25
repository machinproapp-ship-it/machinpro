/** URL base para el QR de check-in (Vercel / env / fallback sprint). */
export function getVisitorQrBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://machinpro-iota.vercel.app";
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
