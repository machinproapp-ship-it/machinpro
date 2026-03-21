import type { CentralEmployee } from "@/types/shared";

export type ComplianceAlert = {
  employeeId: string;
  employeeName: string;
  certName: string;
  expiryDate: string;
  daysLeft: number;
  severity: "expired" | "critical" | "warning";
};

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
          employeeId: emp.id,
          employeeName: emp.name ?? "",
          certName: cert.name,
          expiryDate: cert.expiryDate,
          daysLeft,
          severity: "expired",
        });
      } else if (daysLeft <= 7) {
        alerts.push({
          employeeId: emp.id,
          employeeName: emp.name ?? "",
          certName: cert.name,
          expiryDate: cert.expiryDate,
          daysLeft,
          severity: "critical",
        });
      } else if (daysLeft <= 30) {
        alerts.push({
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
