export type HazardCategory =
  | "electrical"
  | "chemical"
  | "physical"
  | "ergonomic"
  | "biological"
  | "fire"
  | "other";

export type HazardSeverity = "low" | "medium" | "high" | "critical";

export type HazardProbability = "low" | "medium" | "high";

export type HazardStatus = "open" | "in_progress" | "resolved" | "closed";

export interface Hazard {
  id: string;
  company_id: string;
  project_id: string | null;
  project_name: string | null;
  title: string;
  description: string | null;
  category: HazardCategory;
  severity: HazardSeverity;
  probability: HazardProbability;
  risk_score: number;
  status: HazardStatus;
  location: string | null;
  reported_by: string | null;
  reported_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolution_notes: string | null;
  photos: string[];
  corrective_actions: string[];
  tags: string[];
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface HazardFormData {
  title: string;
  description: string;
  category: HazardCategory;
  severity: HazardSeverity;
  probability: HazardProbability;
  project_id: string;
  project_name: string;
  location: string;
  assigned_to: string;
  assigned_to_name: string;
  due_date: string;
  tags: string;
}

const PROB_N: Record<HazardProbability, number> = { low: 1, medium: 2, high: 3 };
const SEV_N: Record<HazardSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Producto severidad × probabilidad acotado a 1–9. */
export function getRiskScore(
  severity: HazardSeverity,
  probability: HazardProbability
): number {
  const raw = SEV_N[severity] * PROB_N[probability];
  return Math.max(1, Math.min(9, raw));
}

export function getRiskLevel(
  score: number
): "low" | "medium" | "high" | "critical" {
  if (score <= 2) return "low";
  if (score <= 4) return "medium";
  if (score <= 6) return "high";
  return "critical";
}
