/**
 * Tipos compartidos entre la home (`app/page.tsx`) y módulos hijos.
 * Vivir aquí evita importar `@/app/page` desde componentes que la página ya importa (ciclo → webpack prerender).
 */

// Turno o evento en el calendario
export interface ScheduleEntry {
  id: string;
  type: "shift" | "event" | "vacation";
  employeeIds: string[];
  projectId?: string;
  projectCode?: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  createdBy: string;
  eventLabel?: string;
}

export type VacationRequestRow = {
  id: string;
  company_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: "pending" | "approved" | "rejected";
  notes?: string | null;
  admin_comment?: string | null;
};

// Compliance Builder (Sprint P)
export type ComplianceTarget = "employee" | "subcontractor" | "vehicle";
export type ComplianceFieldType = "date" | "document" | "text" | "checkbox";

export interface ComplianceField {
  id: string;
  name: string;
  description?: string;
  fieldType: ComplianceFieldType;
  target: ComplianceTarget[];
  isRequired: boolean;
  alertDaysBefore: number;
  isDefault: boolean;
  createdAt: string;
}

export interface ComplianceRecord {
  id: string;
  fieldId: string;
  targetType: ComplianceTarget;
  targetId: string;
  value?: string;
  expiryDate?: string;
  documentUrl?: string;
  status: "valid" | "expiring" | "expired" | "missing";
  updatedAt: string;
}

export type EmployeeDocument = {
  id: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  title: string;
  type: "contract" | "certificate" | "id" | "training" | "medical" | "other";
  fileUrl: string;
  fileType: "pdf" | "image";
  expiryDate?: string;
  notes?: string;
  uploadedBy: string;
  uploadedAt: string;
};
