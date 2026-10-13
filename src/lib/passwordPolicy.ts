/**
 * Misma regla que Supabase Auth: mínimo 8 caracteres, con minúscula, mayúscula y número.
 * Comprobarla antes de enviar evita el "algo ha salido mal" genérico.
 */
export type PasswordProblem = "too_short" | "needs_mix" | null;

export const PASSWORD_MIN = 8;

export function passwordProblem(pw: string, min = PASSWORD_MIN): PasswordProblem {
  if (pw.length < min) return "too_short";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return "needs_mix";
  return null;
}

export function passwordProblemText(p: PasswordProblem, labels: Record<string, string>, min = PASSWORD_MIN): string {
  if (p === "too_short")
    return (labels.password_rule_short ?? "La contraseña necesita al menos {n} caracteres.").replace("{n}", String(min));
  if (p === "needs_mix")
    return labels.password_rule_mix ?? "Usa al menos una minúscula, una mayúscula y un número.";
  return "";
}
