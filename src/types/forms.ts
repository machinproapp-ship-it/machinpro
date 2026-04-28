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
  | "attendance"
  | "inspection_table";

/** Row definition for `inspection_table` fields (`label` is an i18n key). */
export interface InspectionTableRow {
  id: string;
  label: string;
}

/** Column definition for `inspection_table` fields (`label` is an i18n key). */
export interface InspectionTableColumn {
  id: string;
  label: string;
  /** Default `select` uses `field.options` or pass/fail/na presets. */
  kind?: "select" | "text";
}

export type InspectionTableValue = Record<string, Record<string, string>>;

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  /** When true (photo fields), value is `string[]` of image URLs. */
  multiple?: boolean;
  rows?: InspectionTableRow[];
  columns?: InspectionTableColumn[];
  /** Supervisor / sign-off wiring for QR and PDF flows */
  formRole?: "supervisor_display" | "supervisor_signature";
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

export type FormContextType = "project" | "vehicle" | "rental" | "general";

export interface FormInstance {
  id: string;
  templateId: string;
  /** Proyecto cuando `contextType` es `project`; cadena vacía si no aplica. */
  projectId: string;
  contextType?: FormContextType;
  contextId?: string | null;
  contextName?: string | null;
  createdBy: string;
  createdAt: string;
  date: string;
  status: "draft" | "in_progress" | "completed" | "approved";
  fieldValues: Record<string, unknown>;
  attendees: AttendeeRecord[];
  signToken: string;
  tokenExpiresAt: string;
  pdfUrl?: string;
  /** DOC# from Supabase (trigger / form_doc_number_seq). */
  docNumber?: string;
}
