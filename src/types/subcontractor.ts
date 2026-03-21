/** Subcontractor and country-based labels for CentralModule. */

export interface Subcontractor {
  id: string;
  name: string;
  specialty: string;
  taxId: string;
  taxIdLabel: string;
  address: string;
  status: "active" | "inactive" | "review";
  liabilityInsuranceExpiry?: string;
  liabilityInsuranceDoc?: string;
  complianceCertExpiry?: string;
  complianceCertDoc?: string;
  complianceCertLabel: string;
  assignedProjectIds: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  rating?: number;
  notes?: string;
  createdAt: string;
}

export function getTaxIdLabel(country: string): string {
  if (country === "CA") return "BN / GST Number";
  if (country === "US") return "EIN";
  if (country === "MX") return "RFC";
  if (["GB", "EU", "ES", "FR", "DE", "IT", "PT"].includes(country)) return "VAT Number";
  return "Tax ID";
}

export function getComplianceCertLabel(country: string): string {
  if (country === "CA") return "WSIB Clearance";
  if (country === "US") return "COI / OSHA Compliance";
  if (country === "MX") return "Constancia SAT";
  if (["GB", "EU", "ES", "FR", "DE", "IT", "PT"].includes(country)) return "Certificado Seguridad Social";
  return "Compliance Certificate";
}

export const SUBCONTRACTOR_SPECIALTIES = [
  "electrical",
  "structural",
  "hvac",
  "painting",
  "plumbing",
  "carpentry",
  "masonry",
  "roofing",
  "landscaping",
  "other",
] as const;

export type SubcontractorSpecialty = (typeof SUBCONTRACTOR_SPECIALTIES)[number];
