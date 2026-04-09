/** Client-side vehicle documents (mirrors `vehicle_documents` where applicable). */
export type VehicleDocument = {
  id: string;
  name: string;
  expiryDate?: string;
  documentUrl?: string;
  alertDays?: number;
};

export type VehicleDocComputedStatus = "ok" | "soon" | "expired" | "nodate";

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

export function defaultVehicleDocumentTemplates(countryCode: string | undefined): { name: string }[] {
  const cc = (countryCode ?? "").trim().toUpperCase();
  if (cc === "ES" || cc === "AD" || isEuSpainLike(cc)) {
    return [
      { name: "Seguro" },
      { name: "ITV" },
      { name: "Permiso de circulación" },
      { name: "Tarjeta de transporte" },
    ];
  }
  if (cc === "CA" || cc === "US") {
    return [
      { name: "Insurance" },
      { name: "Safety inspection" },
      { name: "Registration" },
      { name: "Emissions test" },
    ];
  }
  if (cc === "MX") {
    return [
      { name: "Seguro" },
      { name: "Verificación vehicular" },
      { name: "Tenencia" },
      { name: "Tarjeta de circulación" },
    ];
  }
  if (cc === "GB" || cc === "UK") {
    return [
      { name: "Insurance" },
      { name: "MOT" },
      { name: "Road tax" },
      { name: "Vehicle registration" },
    ];
  }
  return [{ name: "Seguro / Insurance" }, { name: "Inspección / Inspection" }];
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

export function seedVehicleDocumentsFromCountry(countryCode: string | undefined): VehicleDocument[] {
  return defaultVehicleDocumentTemplates(countryCode).map((t) => ({
    id: newVehicleDocumentId(),
    name: t.name,
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
  countryCode: string | undefined
): VehicleDocument[] {
  if (v.documents && v.documents.length > 0) return v.documents;
  const out: VehicleDocument[] = [];
  if (v.insuranceExpiry || v.insuranceDocUrl) {
    out.push({
      id: newVehicleDocumentId(),
      name: "Seguro / Insurance",
      expiryDate: v.insuranceExpiry || undefined,
      documentUrl: v.insuranceDocUrl || undefined,
      alertDays: 30,
    });
  }
  if (v.inspectionExpiry || v.inspectionDocUrl) {
    out.push({
      id: newVehicleDocumentId(),
      name: "Inspección / Inspection",
      expiryDate: v.inspectionExpiry || undefined,
      documentUrl: v.inspectionDocUrl || undefined,
      alertDays: 30,
    });
  }
  if (v.registrationDocUrl) {
    out.push({
      id: newVehicleDocumentId(),
      name: "Matriculación / Registration",
      documentUrl: v.registrationDocUrl || undefined,
      alertDays: 30,
    });
  }
  if (out.length > 0) return out;
  return seedVehicleDocumentsFromCountry(countryCode);
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
