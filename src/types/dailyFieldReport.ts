/** Valores persistidos en BD (inglés). La UI traduce con t.clave. */
export type DailyReportWeather = "sunny" | "cloudy" | "rain" | "wind" | "snow";

/** `published` = sent to team (signatures/tasks); `approved` = supervisor closed. */
export type DailyReportStatus = "draft" | "published" | "approved";

export type DailyReportSignatureMethod = "tap" | "drawing" | "tap_named";

export type DailyReportTask = {
  id: string;
  reportId?: string;
  employeeId: string | null;
  employeeName?: string;
  description: string;
  completed: boolean;
};

export type DailyReportHazard = {
  id: string;
  reportId?: string;
  description: string;
  ppeRequired: string[];
};

export type DailyReportPhoto = {
  id: string;
  url: string;
  cloudinaryId?: string | null;
  createdAt?: string;
};

export type DailyReportSignature = {
  id: string;
  employeeId: string;
  signedAt: string;
  method: DailyReportSignatureMethod;
  signatureData?: string | null;
  employeeName?: string;
};

export type DailyReportAttendance = {
  id: string;
  employeeId: string;
  status: "present" | "absent" | "late";
  fromTimeclock?: boolean;
  employeeName?: string;
};

/** Parte diario completo (Supabase + UI enriquecida). */
export type DailyFieldReport = {
  id: string;
  companyId: string;
  projectId: string;
  projectName: string;
  createdBy: string;
  createdByName: string;
  date: string;
  weather: DailyReportWeather;
  siteConditions: string;
  notes: string;
  status: DailyReportStatus;
  ppeSelected: string[];
  ppeOther: string;
  hazards: DailyReportHazard[];
  tasks: DailyReportTask[];
  photos: DailyReportPhoto[];
  signatures: DailyReportSignature[];
  attendance: DailyReportAttendance[];
  createdAt: string;
  updatedAt?: string;
};

/** Claves EPI estándar guardadas en inglés. */
export const DAILY_REPORT_PPE_KEYS = [
  "helmet",
  "vest",
  "boots",
  "gloves",
  "goggles",
  "harness",
] as const;

export type DailyReportPpeKey = (typeof DAILY_REPORT_PPE_KEYS)[number];
