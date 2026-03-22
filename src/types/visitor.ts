export type VisitorStatus = "checked_in" | "checked_out";

export interface Visitor {
  id: string;
  company_id: string;
  project_id: string | null;
  project_name: string | null;
  visitor_name: string;
  visitor_company: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  visitor_id_number: string | null;
  purpose: string | null;
  host_name: string | null;
  check_in: string;
  check_out: string | null;
  status: VisitorStatus;
  signature_data: string | null;
  photo_url: string | null;
  vehicle_plate: string | null;
  safety_briefing_accepted: boolean;
  created_at: string;
}

export interface VisitorFormData {
  visitor_name: string;
  visitor_company: string;
  visitor_email: string;
  visitor_phone: string;
  visitor_id_number: string;
  purpose: string;
  host_name: string;
  vehicle_plate: string;
  project_id: string;
  project_name: string;
  safety_briefing_accepted: boolean;
  signature_data: string;
  photo_url: string;
}
