import type { FormTemplate } from "@/types/forms";

/** Matches {@link INITIAL_FORM_TEMPLATES} blank row (`form_cat_custom`). */
export const PROJECT_FORM_BLANK_TEMPLATE_ID = "tpl-blank-custom";

const SAFETY_CATEGORIES = new Set([
  "form_cat_report",
  "form_cat_permit",
  "form_cat_training",
  "form_cat_loto",
  "form_cat_prl",
  "form_cat_rams",
  "form_cat_ats",
]);

export type ProjectFormTemplateCategory = "inspection" | "tailgate" | "safety" | "custom";

export function filterFormTemplatesByProjectCategory(
  templates: FormTemplate[],
  kind: ProjectFormTemplateCategory
): FormTemplate[] {
  if (kind === "inspection") return templates.filter((x) => x.category === "form_cat_inspection");
  if (kind === "tailgate") return templates.filter((x) => x.category === "form_cat_meeting");
  if (kind === "safety") return templates.filter((x) => SAFETY_CATEGORIES.has(x.category));
  if (kind === "custom") return templates.filter((x) => x.category === "form_cat_custom");
  return [];
}
