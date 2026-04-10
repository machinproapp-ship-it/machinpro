/**
 * Project-level safety / PPE requirements (JSON in `projects.safety_requirements`).
 */

export type ProjectSafetyCategory = "ppe" | "certification" | "procedure";

/** Persisted row (JSONB). */
export type ProjectSafetyRequirementRow = {
  id: string;
  nameKey: string;
  category: ProjectSafetyCategory;
  /** Admin override label (optional). */
  customLabel?: string;
};

export type ProjectSafetyRequirement = ProjectSafetyRequirementRow & {
  name: string;
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

function row(
  id: string,
  nameKey: string,
  category: ProjectSafetyCategory
): ProjectSafetyRequirementRow {
  return { id, nameKey, category };
}

export function defaultProjectSafetyRequirements(
  countryCode: string,
  _projectType?: string
): ProjectSafetyRequirementRow[] {
  const cc = (countryCode ?? "").trim().toUpperCase() || "DEFAULT";

  if (cc === "CA" || cc === "US") {
    return [
      row("sr-hard-hat", "safety_req_hard_hat", "ppe"),
      row("sr-vest", "safety_req_safety_vest", "ppe"),
      row("sr-boots", "safety_req_steel_toe_boots", "ppe"),
      row("sr-glasses", "safety_req_safety_glasses", "ppe"),
      row("sr-fall", "safety_req_fall_protection", "procedure"),
    ];
  }

  if (EU_CODES.has(cc)) {
    return [
      row("sr-hard-hat", "safety_req_hard_hat", "ppe"),
      row("sr-vest", "safety_req_safety_vest", "ppe"),
      row("sr-boots", "safety_req_steel_toe_boots", "ppe"),
      row("sr-glasses", "safety_req_safety_glasses", "ppe"),
      row("sr-harness", "safety_req_harness", "ppe"),
      row("sr-prl", "safety_req_prl_training", "certification"),
    ];
  }

  if (cc === "GB" || cc === "UK") {
    return [
      row("sr-hard-hat", "safety_req_hard_hat", "ppe"),
      row("sr-hivis", "safety_req_hi_vis", "ppe"),
      row("sr-boots", "safety_req_steel_toe_boots", "ppe"),
      row("sr-ppe-assess", "safety_req_ppe_assessment", "procedure"),
      row("sr-rams", "safety_req_rams", "procedure"),
    ];
  }

  if (cc === "MX" || cc === "BR" || cc === "AR" || cc === "CO" || cc === "CL" || cc === "PE") {
    return [
      row("sr-hard-hat", "safety_req_hard_hat", "ppe"),
      row("sr-vest", "safety_req_safety_vest", "ppe"),
      row("sr-boots", "safety_req_steel_toe_boots", "ppe"),
      row("sr-glasses", "safety_req_safety_glasses", "ppe"),
      row("sr-permit", "safety_req_work_permit", "procedure"),
    ];
  }

  return [
    row("sr-hard-hat", "safety_req_hard_hat", "ppe"),
    row("sr-vest", "safety_req_safety_vest", "ppe"),
    row("sr-boots", "safety_req_steel_toe_boots", "ppe"),
  ];
}

export function parseSafetyRequirementsJson(raw: unknown): ProjectSafetyRequirementRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ProjectSafetyRequirementRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const nameKey = typeof o.nameKey === "string" ? o.nameKey.trim() : "";
    const cat = o.category;
    const category: ProjectSafetyCategory =
      cat === "ppe" || cat === "certification" || cat === "procedure" ? cat : "ppe";
    if (!id || !nameKey) continue;
    const customLabel = typeof o.customLabel === "string" ? o.customLabel.trim() : undefined;
    out.push({ id, nameKey, category, ...(customLabel ? { customLabel } : {}) });
  }
  return out;
}

export function labelProjectSafetyRow(row: ProjectSafetyRequirementRow, t: Record<string, string>): ProjectSafetyRequirement {
  const name =
    (row.customLabel?.trim() ? row.customLabel.trim() : "") ||
    (t[row.nameKey] ?? "").trim() ||
    row.nameKey;
  return { ...row, name };
}

/** Substrings to match employee certificate names (any match = has cert). */
const CERT_HINTS: Record<string, string[]> = {
  safety_req_prl_training: [
    "prl",
    "prevención",
    "prevencion",
    "sst",
    "salud",
    "safety training",
    "health",
    "sicurezza",
    "arbeitssicherheit",
    "formation",
    "sicherheit",
  ],
  safety_req_rams: ["rams", "risk", "riesgo", "risque", "method statement"],
  safety_req_ppe_assessment: ["ppe", "epi", "dpi", "assessment", "evaluación", "évaluation"],
  safety_req_work_permit: ["permit", "permiso", "autorisation", "altura", "height", "travail en hauteur"],
  safety_req_fall_protection: ["fall", "caída", "chute", "absturz", "anticaduta", "altura"],
};

function certMatchesRequirement(certName: string, nameKey: string): boolean {
  const n = certName.toLowerCase();
  const hints = CERT_HINTS[nameKey];
  if (hints?.length) {
    return hints.some((h) => n.includes(h.toLowerCase()));
  }
  const keyPart = nameKey.replace(/^safety_req_/, "").replace(/_/g, " ");
  return n.includes(keyPart) || n.includes(nameKey.replace(/^safety_req_/, ""));
}

export function findCertForRequirement(
  certificates: { name: string; expiryDate?: string }[],
  req: ProjectSafetyRequirementRow
): { name: string; expiryDate?: string } | null {
  for (const c of certificates) {
    if (certMatchesRequirement(c.name, req.nameKey)) return c;
  }
  return null;
}

export type EmployeeProjectCertTraffic = "green" | "yellow" | "red";

export function employeeProjectCertTrafficLight(
  certificates: { name: string; expiryDate?: string }[],
  requirements: ProjectSafetyRequirementRow[]
): EmployeeProjectCertTraffic {
  const certs = requirements.filter((r) => r.category === "certification");
  if (certs.length === 0) return "green";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let anyYellow = false;

  for (const req of certs) {
    const c = findCertForRequirement(certificates, req);
    if (!c) return "red";
    if (c.expiryDate?.trim()) {
      const exp = new Date(c.expiryDate.includes("T") ? c.expiryDate : `${c.expiryDate}T12:00:00`);
      if (!Number.isNaN(exp.getTime())) {
        exp.setHours(0, 0, 0, 0);
        const daysLeft = Math.floor((exp.getTime() - today.getTime()) / 86400000);
        if (daysLeft < 0) return "red";
        if (daysLeft <= 30) anyYellow = true;
      }
    }
  }

  return anyYellow ? "yellow" : "green";
}
