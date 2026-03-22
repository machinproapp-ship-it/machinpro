export type ActionType = "immediate" | "corrective" | "preventive";

export type ActionPriority = "low" | "medium" | "high" | "critical";

export type ActionStatus =
  | "open"
  | "in_progress"
  | "pending_review"
  | "verified"
  | "closed";

export interface CorrectiveAction {
  id: string;
  company_id: string;
  hazard_id: string | null;
  project_id: string | null;
  project_name: string | null;
  title: string;
  description: string | null;
  root_cause: string | null;
  action_type: ActionType;
  priority: ActionPriority;
  status: ActionStatus;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  verification_notes: string | null;
  photos: string[];
  evidence_notes: string | null;
  effectiveness_rating: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CorrectiveActionFormData {
  title: string;
  description: string;
  root_cause: string;
  action_type: ActionType;
  priority: ActionPriority;
  hazard_id: string;
  project_id: string;
  project_name: string;
  assigned_to: string;
  assigned_to_name: string;
  due_date: string;
  evidence_notes: string;
  tags: string;
}
