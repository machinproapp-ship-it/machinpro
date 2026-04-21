/** Coerce any value to a React-safe text string (avoids React #300). */
export function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toLocaleDateString();
  if (Array.isArray(v)) return v.map((i) => s(i)).join(", ");
  return JSON.stringify(v);
}
