import type { AttendeeRecord, FormInstance, FormTemplate } from "@/types/forms";

export function buildFormInstanceFromTemplate(
  template: FormTemplate,
  projectId: string,
  opts: {
    currentUserEmployeeId: string;
    employees: { id: string; name: string }[];
    projects: { id: string; assignedEmployeeIds?: string[] }[];
  }
): FormInstance {
  const now = new Date();
  const token = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + template.expiresInHours * 60 * 60 * 1000);
  const project = opts.projects.find((p) => p.id === projectId);
  const assignedIds = project?.assignedEmployeeIds ?? [];
  const initialAttendees: AttendeeRecord[] = assignedIds.map((empId, idx) => {
    const emp = opts.employees.find((e) => e.id === empId);
    return {
      id: `att-${idx}-${Date.now()}`,
      name: emp?.name ?? empId,
      employeeId: empId,
      isExternal: false,
    };
  });
  return {
    id: `fi-${Date.now()}`,
    templateId: template.id,
    projectId,
    createdBy: opts.currentUserEmployeeId,
    createdAt: now.toISOString(),
    date: now.toISOString().split("T")[0],
    status: "draft",
    fieldValues: {},
    attendees: initialAttendees,
    signToken: token,
    tokenExpiresAt: expiresAt.toISOString(),
  };
}
