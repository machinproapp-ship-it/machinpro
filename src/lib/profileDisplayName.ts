/** Display name priority: full_name → display_name → email local-part (before @). */

export function emailLocalPart(email: string): string {
  const t = email.trim();
  const at = t.indexOf("@");
  return at > 0 ? t.slice(0, at) : t;
}

export function displayNameFromProfile(
  fullName: string | null | undefined,
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const fn = typeof fullName === "string" ? fullName.trim() : "";
  if (fn) return fn;
  const dn = typeof displayName === "string" ? displayName.trim() : "";
  if (dn) return dn;
  const em = typeof email === "string" ? email.trim() : "";
  if (em) return emailLocalPart(em);
  return "";
}
