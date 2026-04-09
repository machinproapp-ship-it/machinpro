/** Employee documents (mirrors `employee_documents` where applicable). */
export type EmployeeDocument = {
  id: string;
  name: string;
  /** When set, UI prefers `t[nameKey] ?? name` so labels follow app language. */
  nameKey?: string;
  expiryDate?: string;
  documentUrl?: string;
  alertDays?: number;
  required?: boolean;
};

export type EmployeeDocComputedStatus = "ok" | "soon" | "expired" | "nodate";

/** English fallbacks when no locale dictionary is available (e.g. SSR / first paint). */
export const EMPLOYEE_DOC_FALLBACK_EN: Record<string, string> = {
  employee_doc_id: "ID document",
  employee_doc_social_security: "Social security",
  employee_doc_work_permit: "Work permit",
  employee_doc_health_safety_cert: "Health & safety certificate",
  employee_doc_first_aid: "First aid certificate",
  employee_doc_driving_license: "Driving licence",
  employee_doc_medical_exam: "Medical examination",
  employee_doc_construction_card: "Construction card",
  employee_doc_cscs_card: "CSCS Card",
  employee_doc_swis_card: "SWIS Card",
  employee_doc_confined_space: "Confined space cert",
  employee_doc_working_at_height: "Working at height cert",
  employee_doc_forklift: "Forklift licence",
  employee_doc_scaffold: "Scaffolding cert",
};

export function employeeDocDisplayName(
  doc: Pick<EmployeeDocument, "name" | "nameKey">,
  t?: Record<string, string>
): string {
  const dict = t ?? EMPLOYEE_DOC_FALLBACK_EN;
  if (doc.nameKey) {
    const tr = dict[doc.nameKey];
    if (tr) return tr;
    return EMPLOYEE_DOC_FALLBACK_EN[doc.nameKey] ?? doc.name;
  }
  return doc.name;
}

export function computeEmployeeDocStatus(
  expiryDate: string | undefined,
  alertDays = 30
): EmployeeDocComputedStatus {
  if (!expiryDate?.trim()) return "nodate";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate.includes("T") ? expiryDate : `${expiryDate}T12:00:00`);
  if (Number.isNaN(expiry.getTime())) return "nodate";
  expiry.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= alertDays) return "soon";
  return "ok";
}

function isEuSpainLike(cc: string): boolean {
  const EU = new Set([
    "AT",
    "BE",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "HU",
    "IE",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SK",
    "SI",
    "SE",
  ]);
  return EU.has(cc);
}

function isLatinAmerica(cc: string): boolean {
  const LATAM = new Set([
    "MX",
    "AR",
    "BO",
    "BR",
    "CL",
    "CO",
    "CR",
    "CU",
    "DO",
    "EC",
    "SV",
    "GT",
    "HN",
    "NI",
    "PA",
    "PY",
    "PE",
    "PR",
    "UY",
    "VE",
  ]);
  return LATAM.has(cc);
}

/** i18n keys for default rows, in display order, by company country. */
export function defaultEmployeeDocumentTemplateKeys(countryCode: string | undefined): string[] {
  const cc = (countryCode ?? "").trim().toUpperCase();
  if (cc === "ES" || cc === "AD" || isEuSpainLike(cc)) {
    return [
      "employee_doc_id",
      "employee_doc_social_security",
      "employee_doc_work_permit",
      "employee_doc_health_safety_cert",
      "employee_doc_medical_exam",
      "employee_doc_construction_card",
    ];
  }
  if (cc === "CA" || cc === "US") {
    return [
      "employee_doc_id",
      "employee_doc_social_security",
      "employee_doc_work_permit",
      "employee_doc_health_safety_cert",
      "employee_doc_first_aid",
    ];
  }
  if (cc === "GB" || cc === "UK") {
    return [
      "employee_doc_id",
      "employee_doc_work_permit",
      "employee_doc_health_safety_cert",
      "employee_doc_cscs_card",
      "employee_doc_first_aid",
    ];
  }
  if (cc === "MX" || isLatinAmerica(cc)) {
    return [
      "employee_doc_id",
      "employee_doc_social_security",
      "employee_doc_work_permit",
      "employee_doc_health_safety_cert",
      "employee_doc_medical_exam",
    ];
  }
  return ["employee_doc_id", "employee_doc_work_permit", "employee_doc_health_safety_cert"];
}

export function newEmployeeDocumentId(): string {
  return `ed-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function seedEmployeeDocumentsFromCountry(
  countryCode: string | undefined,
  t?: Record<string, string>
): EmployeeDocument[] {
  return defaultEmployeeDocumentTemplateKeys(countryCode).map((key) => ({
    id: newEmployeeDocumentId(),
    nameKey: key,
    name: employeeDocDisplayName({ name: "", nameKey: key }, t),
    alertDays: 30,
    required: true,
  }));
}

export function worstEmployeeDocStatus(docs: EmployeeDocument[] | undefined): EmployeeDocComputedStatus {
  if (!docs?.length) return "nodate";
  let worst: EmployeeDocComputedStatus = "nodate";
  const rank: Record<EmployeeDocComputedStatus, number> = {
    ok: 0,
    nodate: 1,
    soon: 2,
    expired: 3,
  };
  for (const d of docs) {
    const st = computeEmployeeDocStatus(d.expiryDate, d.alertDays ?? 30);
    if (rank[st] > rank[worst]) worst = st;
  }
  return worst;
}

/** Red row highlight: expired or within critical window (same rule as vehicle/subcontractor watchdog). */
export function employeeDocumentRowNeedsRedHighlight(docs: EmployeeDocument[] | undefined): boolean {
  if (!docs?.length) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const d of docs) {
    const raw = d.expiryDate?.trim();
    if (!raw) continue;
    const expiry = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(expiry.getTime())) continue;
    expiry.setHours(0, 0, 0, 0);
    const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000);
    const alertWindow = d.alertDays ?? 30;
    const criticalWindow = Math.min(7, alertWindow);
    if (daysLeft < 0) return true;
    if (daysLeft <= criticalWindow) return true;
  }
  return false;
}
