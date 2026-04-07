/** AW-8 Training Hub — DB-aligned types (Supabase). */

export type TrainingCourseCategory =
  | "safety"
  | "health"
  | "environment"
  | "equipment"
  | "procedures"
  | "other";

export const TRAINING_COURSE_CATEGORIES: TrainingCourseCategory[] = [
  "safety",
  "health",
  "environment",
  "equipment",
  "procedures",
  "other",
];

export interface TrainingCourseRow {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number | null;
  expires_after_days: number | null;
  document_url: string | null;
  is_archived: boolean | null;
  created_at: string;
  created_by: string | null;
}

export type TrainingAssignmentDbStatus = "pending" | "completed";

export interface TrainingAssignmentRow {
  id: string;
  company_id: string;
  course_id: string;
  user_id: string;
  assigned_by: string | null;
  status: TrainingAssignmentDbStatus | string;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export type TrainingDisplayStatus = "pending" | "completed" | "expired";

export function trainingDisplayStatus(
  row: TrainingAssignmentRow,
  expiresAfterDays: number | null | undefined
): TrainingDisplayStatus {
  if (row.status === "completed") return "completed";
  const exp =
    row.expires_at ??
    (expiresAfterDays != null && expiresAfterDays > 0
      ? (() => {
          const d = new Date(row.created_at);
          d.setUTCDate(d.getUTCDate() + expiresAfterDays);
          return d.toISOString();
        })()
      : null);
  if (exp && new Date(exp).getTime() < Date.now()) return "expired";
  return "pending";
}
