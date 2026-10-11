/**
 * Enlaces de correo para crear o recuperar contraseña.
 *
 * En vez de enviar el enlace de Supabase (que se gasta en cuanto algo lo abre, por ejemplo
 * la vista previa de Gmail o el antivirus del correo), enviamos un enlace a nuestra página
 * con el `hashed_token`. El token solo se usa cuando la persona pulsa "Guardar contraseña".
 */
type GenerateLinkData = {
  properties?: { action_link?: string | null; hashed_token?: string | null } | null;
} | null;

export function buildPasswordLink(
  baseUrl: string,
  linkData: GenerateLinkData,
  mode: "reset" | "invite"
): string | null {
  const base = baseUrl.replace(/\/$/, "");
  const hashed = linkData?.properties?.hashed_token;
  if (hashed) {
    const q = new URLSearchParams({ token_hash: hashed, type: "recovery" });
    if (mode === "invite") q.set("mode", "invite");
    return `${base}/reset-password?${q.toString()}`;
  }
  return linkData?.properties?.action_link ?? null;
}
