export type RfiCategory =
  | "structural"
  | "electrical"
  | "mechanical"
  | "civil"
  | "architectural"
  | "other";

export type RfiPriority = "low" | "medium" | "high" | "urgent";

export type RfiStatus = "draft" | "submitted" | "under_review" | "answered" | "closed";

export interface Rfi {
  id: string;
  company_id: string;
  project_id: string | null;
  project_name: string | null;
  rfi_number: string;
  title: string;
  description: string;
  category: RfiCategory | null;
  priority: RfiPriority;
  status: RfiStatus;
  submitted_by: string | null;
  submitted_by_name: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  due_date: string | null;
  answered_at: string | null;
  answer: string | null;
  answered_by_name: string | null;
  photos: string[];
  documents: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface RfiFormState {
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  category: RfiCategory;
  priority: RfiPriority;
  status: RfiStatus;
  assigned_to_name: string;
  assigned_to_email: string;
  due_date: string;
  tags: string;
}
