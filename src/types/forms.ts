export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "select"
  | "multiselect"
  | "checkbox"
  | "radio"
  | "photo"
  | "signature"
  | "attendance";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
}

export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  region: string[];
  category: string;
  isBase: boolean;
  sections: FormSection[];
  requiresAllSignatures: boolean;
  expiresInHours: number;
  createdAt: string;
  createdBy: string;
  language: string;
}

export interface AttendeeRecord {
  id: string;
  name: string;
  company?: string;
  employeeId?: string;
  isExternal: boolean;
  signedAt?: string;
  signature?: string;
  orientationGiven?: boolean;
  signedOnSupervisorDevice?: boolean;
}

export interface FormInstance {
  id: string;
  templateId: string;
  projectId: string;
  createdBy: string;
  createdAt: string;
  date: string;
  status: "draft" | "in_progress" | "completed" | "approved";
  fieldValues: Record<string, unknown>;
  attendees: AttendeeRecord[];
  signToken: string;
  tokenExpiresAt: string;
  pdfUrl?: string;
}
