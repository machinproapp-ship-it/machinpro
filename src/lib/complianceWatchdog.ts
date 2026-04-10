import type { CentralEmployee } from "@/types/shared";
import type { VehicleDocument } from "@/lib/vehicleDocumentUtils";
import {
  findCertForRequirement,
  parseSafetyRequirementsJson,
  type ProjectSafetyRequirementRow,
} from "@/lib/projectSafetyUtils";

export type ComplianceAlertSource = "employee" | "vehicle" | "subcontractor";

export type ComplianceAlert = {
  source: ComplianceAlertSource;
  employeeId?: string;
  employeeName?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  subcontractorId?: string;
  subcontractorName?: string;
  certName: string;
  /** When set with vehicle docs, UI can resolve `t[certNameKey] ?? certName`. */
  certNameKey?: string;
  expiryDate: string;
  daysLeft: number;
  severity: "expired" | "critical" | "warning";
  /** Project context (missing cert vs project requirement). */
  projectId?: string;
  projectName?: string;
};

export function watchdogSubjectLabel(a: ComplianceAlert): string {
  let base: string;
  if (a.source === "vehicle") base = a.vehiclePlate?.trim() || a.vehicleId || "—";
  else if (a.source === "subcontractor") base = (a.subcontractorName ?? "").trim() || a.subcontractorId || "—";
  else base = (a.employeeName ?? "").trim() || a.employeeId || "—";
  const pn = (a.projectName ?? "").trim();
  return pn ? `${base} · ${pn}` : base;
}

export type ProjectForEmployeeCompliance = {
  id: string;
  name: string;
  archived?: boolean;
  assignedEmployeeIds: string[];
  /** Raw JSON from `projects.safety_requirements`. */
  safetyRequirements?: unknown;
};

/**
 * For each active project and assigned employee, flags missing **certification** requirements (warning only).
 */
export function runProjectEmployeeComplianceCheck(
  projects: ProjectForEmployeeCompliance[],
  employees: CentralEmployee[]
): ComplianceAlert[] {
  const empById = new Map(employees.map((e) => [e.id, e]));
  const alerts: ComplianceAlert[] = [];

  for (const proj of projects) {
    if (proj.archived) continue;
    const rows: ProjectSafetyRequirementRow[] = parseSafetyRequirementsJson(proj.safetyRequirements);
    const certReqs = rows.filter((r) => r.category === "certification");
    if (certReqs.length === 0) continue;

    for (const uid of proj.assignedEmployeeIds ?? []) {
      const emp = empById.get(uid);
      if (!emp) continue;
      const certs = emp.certificates ?? [];
      for (const req of certReqs) {
        const hit = findCertForRequirement(
          certs.map((c) => ({ name: c.name, expiryDate: c.expiryDate })),
          req
        );
        if (hit) continue;
        alerts.push({
          source: "employee",
          employeeId: emp.id,
          employeeName: emp.name ?? "",
          certName: req.nameKey,
          certNameKey: req.nameKey,
          expiryDate: "",
          daysLeft: 365,
          severity: "warning",
          projectId: proj.id,
          projectName: proj.name,
        });
      }
    }
  }

  return alerts;
}

export function runComplianceWatchdog(employees: CentralEmployee[]): ComplianceAlert[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alerts: ComplianceAlert[] = [];

  for (const emp of employees) {
    for (const cert of emp.certificates ?? []) {
      if (!cert.expiryDate) continue;
      const expiry = new Date(cert.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86400000);

      if (daysLeft < 0) {
        alerts.push({
          source: "employee",
          employeeId: emp.id,
          employeeName: emp.name ?? "",
          certName: cert.name,
          expiryDate: cert.expiryDate,
          daysLeft,
          severity: "expired",
        });
      } else if (daysLeft <= 7) {
        alerts.push({
          source: "employee",
          employeeId: emp.id,
          employeeName: emp.name ?? "",
          certName: cert.name,
          expiryDate: cert.expiryDate,
          daysLeft,
          severity: "critical",
        });
      } else if (daysLeft <= 30) {
        alerts.push({
          source: "employee",
          employeeId: emp.id,
          employeeName: emp.name ?? "",
          certName: cert.name,
          expiryDate: cert.expiryDate,
          daysLeft,
          severity: "warning",
        });
      }
    }
  }

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

export type VehicleForWatchdog = {
  id: string;
  plate: string;
  documents?: VehicleDocument[];
};

/** Alerts for vehicle documents using each document's `alertDays` (default 30). */
export function runVehicleDocumentsWatchdog(vehicles: VehicleForWatchdog[]): ComplianceAlert[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alerts: ComplianceAlert[] = [];

  for (const v of vehicles) {
    for (const doc of v.documents ?? []) {
      if (!doc.expiryDate?.trim()) continue;
      const expiry = new Date(doc.expiryDate.includes("T") ? doc.expiryDate : `${doc.expiryDate}T12:00:00`);
      if (Number.isNaN(expiry.getTime())) continue;
      expiry.setHours(0, 0, 0, 0);
      const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
      const alertWindow = doc.alertDays ?? 30;
      const criticalWindow = Math.min(7, alertWindow);

      if (daysLeft < 0) {
        alerts.push({
          source: "vehicle",
          vehicleId: v.id,
          vehiclePlate: v.plate,
          certName: doc.name,
          certNameKey: doc.nameKey,
          expiryDate: doc.expiryDate,
          daysLeft,
          severity: "expired",
        });
      } else if (daysLeft <= criticalWindow) {
        alerts.push({
          source: "vehicle",
          vehicleId: v.id,
          vehiclePlate: v.plate,
          certName: doc.name,
          certNameKey: doc.nameKey,
          expiryDate: doc.expiryDate,
          daysLeft,
          severity: "critical",
        });
      } else if (daysLeft <= alertWindow) {
        alerts.push({
          source: "vehicle",
          vehicleId: v.id,
          vehiclePlate: v.plate,
          certName: doc.name,
          certNameKey: doc.nameKey,
          expiryDate: doc.expiryDate,
          daysLeft,
          severity: "warning",
        });
      }
    }
  }

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

export type SubcontractorDocument = VehicleDocument;

export type SubcontractorForWatchdog = {
  id: string;
  name: string;
  documents?: SubcontractorDocument[];
};

/** Alerts for subcontractor documents using each document's `alertDays` (default 30). */
export function runSubcontractorWatchdog(subcontractors: SubcontractorForWatchdog[]): ComplianceAlert[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alerts: ComplianceAlert[] = [];

  for (const s of subcontractors) {
    for (const doc of s.documents ?? []) {
      if (!doc.expiryDate?.trim()) continue;
      const expiry = new Date(doc.expiryDate.includes("T") ? doc.expiryDate : `${doc.expiryDate}T12:00:00`);
      if (Number.isNaN(expiry.getTime())) continue;
      expiry.setHours(0, 0, 0, 0);
      const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
      const alertWindow = doc.alertDays ?? 30;
      const criticalWindow = Math.min(7, alertWindow);

      if (daysLeft < 0) {
        alerts.push({
          source: "subcontractor",
          subcontractorId: s.id,
          subcontractorName: s.name,
          certName: doc.name,
          certNameKey: doc.nameKey,
          expiryDate: doc.expiryDate,
          daysLeft,
          severity: "expired",
        });
      } else if (daysLeft <= criticalWindow) {
        alerts.push({
          source: "subcontractor",
          subcontractorId: s.id,
          subcontractorName: s.name,
          certName: doc.name,
          certNameKey: doc.nameKey,
          expiryDate: doc.expiryDate,
          daysLeft,
          severity: "critical",
        });
      } else if (daysLeft <= alertWindow) {
        alerts.push({
          source: "subcontractor",
          subcontractorId: s.id,
          subcontractorName: s.name,
          certName: doc.name,
          certNameKey: doc.nameKey,
          expiryDate: doc.expiryDate,
          daysLeft,
          severity: "warning",
        });
      }
    }
  }

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function mergeComplianceAlerts(
  employeeAlerts: ComplianceAlert[],
  vehicleAlerts: ComplianceAlert[],
  subcontractorAlerts: ComplianceAlert[] = [],
  projectEmployeeAlerts: ComplianceAlert[] = []
): ComplianceAlert[] {
  return [...employeeAlerts, ...vehicleAlerts, ...subcontractorAlerts, ...projectEmployeeAlerts].sort(
    (a, b) => a.daysLeft - b.daysLeft
  );
}

export function getLastWatchdogRun(): string | null {
  try {
    return localStorage.getItem("machinpro_watchdog_last_run");
  } catch {
    return null;
  }
}

export function setLastWatchdogRun(): void {
  try {
    localStorage.setItem("machinpro_watchdog_last_run", new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function shouldRunWatchdog(): boolean {
  const last = getLastWatchdogRun();
  if (!last) return true;
  const lastRun = new Date(last);
  const now = new Date();
  return (
    now.getDate() !== lastRun.getDate() ||
    now.getMonth() !== lastRun.getMonth() ||
    now.getFullYear() !== lastRun.getFullYear()
  );
}
