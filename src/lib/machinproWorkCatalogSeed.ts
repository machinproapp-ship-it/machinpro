/**
 * Catálogo MachinPro (AH-43C) — claves i18n + unidad técnica.
 * Los textos visibles resuelven `t[nameKey]`.
 */
export type MachinProCatalogSeedRow = {
  categoryKey: string;
  nameKey: string;
  unit: string;
};

export const MACHINPRO_WORK_CATALOG_ALUMINUM: MachinProCatalogSeedRow[] = [
  { categoryKey: "catalog_category_aluminum", nameKey: "catalog_aluminum_flashing_windows", unit: "ln_ft" },
  { categoryKey: "catalog_category_aluminum", nameKey: "catalog_aluminum_flashing_trim", unit: "ln_ft" },
  { categoryKey: "catalog_category_aluminum", nameKey: "catalog_aluminum_flashing_roof", unit: "ln_ft" },
  { categoryKey: "catalog_category_aluminum", nameKey: "catalog_aluminum_capping", unit: "ln_ft" },
  { categoryKey: "catalog_category_aluminum", nameKey: "catalog_aluminum_horizontal_trim", unit: "ln_ft" },
];

export const MACHINPRO_WORK_CATALOG_CLADDING: MachinProCatalogSeedRow[] = [
  { categoryKey: "catalog_category_cladding", nameKey: "catalog_cladding_hardie_lap", unit: "sq_ft" },
  { categoryKey: "catalog_category_cladding", nameKey: "catalog_cladding_hardie_panels", unit: "sq_ft" },
  { categoryKey: "catalog_category_cladding", nameKey: "catalog_cladding_batten", unit: "sq_ft" },
  { categoryKey: "catalog_category_cladding", nameKey: "catalog_cladding_cedar", unit: "sq_ft" },
  { categoryKey: "catalog_category_cladding", nameKey: "catalog_cladding_horizontal", unit: "sq_ft" },
];

export const MACHINPRO_WORK_CATALOG_PREP: MachinProCatalogSeedRow[] = [
  { categoryKey: "catalog_category_prep", nameKey: "catalog_prep_tyvek", unit: "sq_ft" },
  { categoryKey: "catalog_category_prep", nameKey: "catalog_prep_insulation", unit: "sq_ft" },
  { categoryKey: "catalog_category_prep", nameKey: "catalog_prep_caulking", unit: "ln_ft" },
  { categoryKey: "catalog_category_prep", nameKey: "catalog_prep_plywood", unit: "sq_ft" },
  { categoryKey: "catalog_category_prep", nameKey: "catalog_prep_demolition", unit: "sq_ft" },
];

export const MACHINPRO_WORK_CATALOG_FINISHING: MachinProCatalogSeedRow[] = [
  { categoryKey: "catalog_category_finishing", nameKey: "catalog_finishing_touchups", unit: "sq_ft" },
  { categoryKey: "catalog_category_finishing", nameKey: "catalog_finishing_paint", unit: "sq_ft" },
  { categoryKey: "catalog_category_finishing", nameKey: "catalog_finishing_extra_labour", unit: "hours" },
];

export const MACHINPRO_WORK_CATALOG_STRUCTURE: MachinProCatalogSeedRow[] = [
  { categoryKey: "catalog_category_structure", nameKey: "catalog_structure_strapping_gutters", unit: "sq_ft" },
  { categoryKey: "catalog_category_structure", nameKey: "catalog_structure_strapping_brick", unit: "ln_ft" },
  { categoryKey: "catalog_category_structure", nameKey: "catalog_structure_strapping_regular", unit: "sq_ft" },
  { categoryKey: "catalog_category_structure", nameKey: "catalog_structure_beam_porch", unit: "ln_ft" },
  { categoryKey: "catalog_category_structure", nameKey: "catalog_structure_mdf", unit: "sq_ft" },
];

export const MACHINPRO_WORK_CATALOG_ALL: MachinProCatalogSeedRow[] = [
  ...MACHINPRO_WORK_CATALOG_ALUMINUM,
  ...MACHINPRO_WORK_CATALOG_CLADDING,
  ...MACHINPRO_WORK_CATALOG_PREP,
  ...MACHINPRO_WORK_CATALOG_FINISHING,
  ...MACHINPRO_WORK_CATALOG_STRUCTURE,
];

export const WORK_CATALOG_UNIT_OPTIONS = ["sq_ft", "ln_ft", "m2", "ml", "hours", "units"] as const;
export type WorkCatalogUnitOption = (typeof WORK_CATALOG_UNIT_OPTIONS)[number];
