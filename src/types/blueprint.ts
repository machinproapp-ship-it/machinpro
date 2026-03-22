export type BlueprintLayer =
  | "general"
  | "electrical"
  | "structural"
  | "plumbing"
  | "safety"
  | "progress";

export type PinType = "annotation" | "hazard" | "corrective_action" | "photo";

export type PinStatus = "open" | "resolved" | "closed";

export interface Blueprint {
  id: string;
  company_id: string;
  project_id: string;
  project_name: string | null;
  name: string;
  version: number;
  image_url: string;
  file_type: "image" | "pdf";
  width: number | null;
  height: number | null;
  is_active: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlueprintPin {
  id: string;
  blueprint_id: string;
  company_id: string;
  project_id: string | null;
  x_percent: number;
  y_percent: number;
  layer: BlueprintLayer;
  pin_type: PinType;
  title: string;
  description: string | null;
  hazard_id: string | null;
  corrective_action_id: string | null;
  color: string;
  icon: string;
  status: PinStatus;
  latitude: number | null;
  longitude: number | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface BlueprintFormData {
  name: string;
  project_id: string;
  project_name: string;
}
