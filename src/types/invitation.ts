export type InvitationStatus = "pending" | "accepted" | "expired";

export type InvitationPlan =
  | "trial"
  | "foundation"
  | "obras"
  | "horarios"
  | "logistica"
  | "todo_incluido"
  | "starter"
  | "pro"
  | "enterprise";

export interface Invitation {
  id: string;
  token: string;
  email: string;
  company_name: string;
  invited_by: string | null;
  invited_by_name: string | null;
  plan: InvitationPlan;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_company_id: string | null;
  message: string | null;
  created_at: string;
}

export interface InvitationFormData {
  email: string;
  companyName: string;
  plan: InvitationPlan;
  message: string;
}
