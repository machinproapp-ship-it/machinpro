/**
 * Maps unknown errors (Supabase, fetch, etc.) to user-safe translated strings.
 * Never surface raw PostgREST / stack text in the UI.
 */
export function userFacingErrorMessage(
  labels: Record<string, string>,
  err: unknown,
  online: boolean = typeof navigator === "undefined" ? true : navigator.onLine
): string {
  const L = (k: string, fb: string) => (labels[k] ?? "").trim() || fb;
  if (!online) return L("error_network", "No connection. Please try again.");
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : String(err ?? "");
  const m = raw.trim();
  if (!m) return L("error_generic", "Something went wrong. Please try again.");
  const lower = m.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("econnrefused") ||
    lower.includes("load failed")
  ) {
    return L("error_network", "No connection. Please try again.");
  }
  if (/^5\d\d\b/.test(m) || lower.includes("internal server") || lower.includes("pgrst") || lower.includes("jwt")) {
    return L("error_server", "Server error. Please try again later.");
  }
  if (lower.includes("validation") || lower.includes("invalid input") || lower.includes("violates")) {
    return L("error_validation", "Please check the highlighted fields.");
  }
  return L("error_generic", "Something went wrong. Please try again.");
}
