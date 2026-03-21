export type WeatherCondition = "sunny" | "cloudy" | "rainy" | "windy" | "snowy" | "foggy";

export type LaborEntry = {
  id: string;
  employeeId?: string;
  employeeName: string;
  role: string;
  hoursWorked: number;
  overtime: number;
  notes?: string;
};

export type MaterialEntry = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  supplier?: string;
  notes?: string;
};

export type EquipmentEntry = {
  id: string;
  name: string;
  hoursUsed: number;
  operator?: string;
  notes?: string;
};

export type DailyFieldReport = {
  id: string;
  projectId: string;
  projectName: string;
  companyId: string;
  date: string;
  weatherCondition: WeatherCondition;
  weatherTemp?: number;
  weatherNotes?: string;
  workPerformed: string;
  plannedWork: string;
  laborEntries: LaborEntry[];
  materialEntries: MaterialEntry[];
  equipmentEntries: EquipmentEntry[];
  visitors: string;
  delays: string;
  safetyIncidents: string;
  inspections: string;
  notes: string;
  status: "draft" | "submitted" | "approved";
  createdBy: string;
  createdByName: string;
  createdAt: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
};
