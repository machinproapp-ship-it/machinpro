/** URL base para el QR de check-in (Vercel / env / fallback sprint). */
export function getVisitorQrBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://machinpro-iota.vercel.app";
}

export function buildVisitorCheckInUrl(companyId: string): string {
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${origin}/visit/${companyId}`;
    }
  }
  return `${getVisitorQrBaseUrl()}/visit/${companyId}`;
}
