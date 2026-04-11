import type { FormField, InspectionTableValue } from "@/types/forms";
import { ALL_TRANSLATIONS } from "@/lib/i18n";

const EN_LABELS = ALL_TRANSLATIONS.en as Record<string, string>;

/**
 * Resolves template/field labels: `labels[key]` first, then English bundle for `form_*` keys,
 * then the raw string (human-readable name stored as-is).
 */
export function resolveFormLabel(
  keyOrText: string,
  labels: Record<string, string>
): string {
  const v = labels[keyOrText];
  if (v !== undefined && v !== "") return v;
  if (keyOrText.startsWith("form_")) {
    const en = EN_LABELS[keyOrText];
    if (en !== undefined && en !== "") return en;
  }
  return keyOrText;
}

/** Resolves stored template name keys (e.g. `form_tpl_*`) via current locale, then English bundle. */
export function resolveTemplateName(
  template: { name: string },
  t: Record<string, string>
): string {
  const key = template.name;
  const loc = t[key];
  if (loc !== undefined && loc !== "") return loc;
  const en = EN_LABELS[key];
  if (en !== undefined && en !== "") return en;
  return key;
}

function isInspectionTableValue(v: unknown): v is InspectionTableValue {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function formatInspectionTableForDisplay(
  field: FormField,
  value: unknown,
  resolve: (k: string) => string
): string {
  if (!isInspectionTableValue(value)) return "";
  const rows = field.rows ?? [];
  const cols = field.columns ?? [];
  const lines: string[] = [];
  for (const row of rows) {
    const rowLabel = resolve(row.label);
    const cells = value[row.id] ?? {};
    for (const col of cols) {
      const raw = cells[col.id] ?? "";
      const colLabel = resolve(col.label);
      const cellDisplay =
        raw === "pass"
          ? resolve("form_opt_pass")
          : raw === "fail"
            ? resolve("form_opt_fail")
            : raw === "na"
              ? resolve("form_opt_na")
              : raw;
      lines.push(`${rowLabel} — ${colLabel}: ${cellDisplay}`);
    }
  }
  return lines.join("\n");
}

/** Plain-text representation of a field value for PDF / read-only views. */
export function formatFormFieldValue(
  field: FormField,
  value: unknown,
  resolve: (k: string) => string
): string {
  if (value == null) return "";
  if (field.type === "inspection_table") {
    return formatInspectionTableForDisplay(field, value, resolve);
  }
  if (Array.isArray(value)) {
    return value
      .map((x) => (typeof x === "string" ? resolve(x) : String(x)))
      .join(", ");
  }
  if (typeof value === "string" && value.startsWith("http")) {
    return value;
  }
  if (typeof value === "string") {
    return resolve(value);
  }
  return String(value);
}
