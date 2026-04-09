/** Client-side vehicle documents (mirrors `vehicle_documents` where applicable). */
export type VehicleDocument = {
  id: string;
  name: string;
  /** When set, UI prefers `t[nameKey] ?? name` so labels follow app language. */
  nameKey?: string;
  expiryDate?: string;
  documentUrl?: string;
  alertDays?: number;
};

export type VehicleDocComputedStatus = "ok" | "soon" | "expired" | "nodate";

/** English fallbacks when no locale dictionary is available (e.g. SSR / first paint). */
export const VEHICLE_DOC_FALLBACK_EN: Record<string, string> = {
  vehicle_doc_insurance: "Insurance",
  vehicle_doc_safety_inspection: "Safety inspection",
  vehicle_doc_registration: "Registration",
  vehicle_doc_emissions_test: "Emissions test",
  vehicle_doc_itv: "Vehicle inspection",
  vehicle_doc_mot: "MOT",
  vehicle_doc_road_tax: "Road tax",
  vehicle_doc_transport_card: "Transport card",
  vehicle_doc_verification: "Vehicle verification",
  vehicle_doc_tenencia: "Vehicle tax",
  vehicle_doc_circulation_card: "Circulation card",
  vehicle_doc_inspection: "Inspection",
};

export function vehicleDocDisplayName(
  doc: Pick<VehicleDocument, "name" | "nameKey">,
  t?: Record<string, string>
): string {
  const dict = t ?? VEHICLE_DOC_FALLBACK_EN;
  if (doc.nameKey) {
    const tr = dict[doc.nameKey];
    if (tr) return tr;
    return VEHICLE_DOC_FALLBACK_EN[doc.nameKey] ?? doc.name;
  }
  return doc.name;
}

export function computeVehicleDocStatus(
  expiryDate: string | undefined,
  alertDays = 30
): VehicleDocComputedStatus {
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

/** i18n keys for default rows, in display order, by company country. */
export function defaultVehicleDocumentTemplateKeys(countryCode: string | undefined): string[] {
  const cc = (countryCode ?? "").trim().toUpperCase();
  if (cc === "ES" || cc === "AD" || isEuSpainLike(cc)) {
    return [
      "vehicle_doc_insurance",
      "vehicle_doc_itv",
      "vehicle_doc_registration",
      "vehicle_doc_transport_card",
    ];
  }
  if (cc === "CA" || cc === "US") {
    return [
      "vehicle_doc_insurance",
      "vehicle_doc_safety_inspection",
      "vehicle_doc_registration",
      "vehicle_doc_emissions_test",
    ];
  }
  if (cc === "MX") {
    return [
      "vehicle_doc_insurance",
      "vehicle_doc_verification",
      "vehicle_doc_tenencia",
      "vehicle_doc_circulation_card",
    ];
  }
  if (cc === "GB" || cc === "UK") {
    return [
      "vehicle_doc_insurance",
      "vehicle_doc_mot",
      "vehicle_doc_road_tax",
      "vehicle_doc_registration",
    ];
  }
  return ["vehicle_doc_insurance", "vehicle_doc_inspection"];
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

export function newVehicleDocumentId(): string {
  return `vd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function seedVehicleDocumentsFromCountry(
  countryCode: string | undefined,
  t?: Record<string, string>
): VehicleDocument[] {
  return defaultVehicleDocumentTemplateKeys(countryCode).map((key) => ({
    id: newVehicleDocumentId(),
    nameKey: key,
    name: vehicleDocDisplayName({ name: "", nameKey: key }, t),
    alertDays: 30,
  }));
}

/** Merge legacy fixed fields into `documents` when missing. */
export function ensureVehicleDocuments(
  v: {
    id: string;
    plate?: string;
    insuranceExpiry?: string;
    inspectionExpiry?: string;
    insuranceDocUrl?: string;
    inspectionDocUrl?: string;
    registrationDocUrl?: string;
    documents?: VehicleDocument[];
  },
  countryCode: string | undefined,
  t?: Record<string, string>
): VehicleDocument[] {
  if (v.documents && v.documents.length > 0) return v.documents;
  const out: VehicleDocument[] = [];
  if (v.insuranceExpiry || v.insuranceDocUrl) {
    out.push({
      id: newVehicleDocumentId(),
      nameKey: "vehicle_doc_insurance",
      name: vehicleDocDisplayName({ name: "", nameKey: "vehicle_doc_insurance" }, t),
      expiryDate: v.insuranceExpiry || undefined,
      documentUrl: v.insuranceDocUrl || undefined,
      alertDays: 30,
    });
  }
  if (v.inspectionExpiry || v.inspectionDocUrl) {
    out.push({
      id: newVehicleDocumentId(),
      nameKey: "vehicle_doc_inspection",
      name: vehicleDocDisplayName({ name: "", nameKey: "vehicle_doc_inspection" }, t),
      expiryDate: v.inspectionExpiry || undefined,
      documentUrl: v.inspectionDocUrl || undefined,
      alertDays: 30,
    });
  }
  if (v.registrationDocUrl) {
    out.push({
      id: newVehicleDocumentId(),
      nameKey: "vehicle_doc_registration",
      name: vehicleDocDisplayName({ name: "", nameKey: "vehicle_doc_registration" }, t),
      documentUrl: v.registrationDocUrl || undefined,
      alertDays: 30,
    });
  }
  if (out.length > 0) return out;
  return seedVehicleDocumentsFromCountry(countryCode, t);
}

export function worstVehicleDocStatus(docs: VehicleDocument[] | undefined): VehicleDocComputedStatus {
  if (!docs?.length) return "nodate";
  let worst: VehicleDocComputedStatus = "nodate";
  const rank: Record<VehicleDocComputedStatus, number> = {
    ok: 0,
    nodate: 1,
    soon: 2,
    expired: 3,
  };
  for (const d of docs) {
    const st = computeVehicleDocStatus(d.expiryDate, d.alertDays ?? 30);
    if (rank[st] > rank[worst]) worst = st;
  }
  return worst;
}
