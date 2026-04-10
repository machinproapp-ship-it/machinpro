/**
 * Regional default access requirements for visitor check-in (checklist only; non-blocking).
 */

export type VisitorRequirement = {
  id: string;
  nameKey: string;
  /** Resolved label (use {@link labelVisitorRequirement}). */
  name: string;
  required: boolean;
  description?: string;
};

const EU_CODES = new Set([
  "ES",
  "FR",
  "DE",
  "IT",
  "PT",
  "NL",
  "BE",
  "AT",
  "IE",
  "PL",
  "SE",
  "DK",
  "FI",
  "CZ",
  "RO",
  "GR",
]);

export function defaultVisitorRequirements(countryCode: string): VisitorRequirement[] {
  const cc = (countryCode ?? "").trim().toUpperCase() || "DEFAULT";

  const base = (defs: Omit<VisitorRequirement, "name">[]): VisitorRequirement[] =>
    defs.map((d) => ({ ...d, name: "" }));

  if (cc === "CA" || cc === "US") {
    return base([
      { id: "vr-photo-id", nameKey: "visitor_req_photo_id", required: true },
      { id: "vr-safety", nameKey: "visitor_req_safety_induction", required: true },
      { id: "vr-ppe", nameKey: "visitor_req_ppe", required: true },
    ]);
  }

  if (EU_CODES.has(cc)) {
    return base([
      { id: "vr-id-doc", nameKey: "visitor_req_id_document", required: true },
      { id: "vr-prl", nameKey: "visitor_req_prl_training", required: true },
      { id: "vr-ppe", nameKey: "visitor_req_ppe", required: true },
    ]);
  }

  if (cc === "GB" || cc === "UK") {
    return base([
      { id: "vr-photo-id", nameKey: "visitor_req_photo_id", required: true },
      { id: "vr-safety", nameKey: "visitor_req_safety_induction", required: true },
      { id: "vr-ppe", nameKey: "visitor_req_ppe", required: true },
    ]);
  }

  if (
    cc === "MX" ||
    cc === "BR" ||
    cc === "AR" ||
    cc === "CO" ||
    cc === "CL" ||
    cc === "PE" ||
    cc === "LATAM"
  ) {
    return base([
      { id: "vr-id-doc", nameKey: "visitor_req_id_document", required: true },
      { id: "vr-safety", nameKey: "visitor_req_safety_induction", required: true },
      { id: "vr-ppe", nameKey: "visitor_req_ppe", required: true },
    ]);
  }

  return base([
    { id: "vr-id-doc", nameKey: "visitor_req_id_document", required: true },
    { id: "vr-safety", nameKey: "visitor_req_safety_induction", required: true },
  ]);
}

export function labelVisitorRequirement(req: VisitorRequirement, t: Record<string, string>): VisitorRequirement {
  return {
    ...req,
    name: (t[req.nameKey] ?? req.name ?? "").trim() || req.nameKey,
  };
}

export function labelVisitorRequirements(
  reqs: VisitorRequirement[],
  t: Record<string, string>
): VisitorRequirement[] {
  return reqs.map((r) => labelVisitorRequirement(r, t));
}
