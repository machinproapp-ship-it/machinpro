import type { AttendeeRecord, FormContextType, FormInstance, FormTemplate } from "@/types/forms";

export function buildFormInstanceFromTemplate(
  template: FormTemplate,
  context: {
    type: FormContextType;
    id: string | null;
    name: string | null;
  },
  opts: {
    currentUserEmployeeId: string;
    employees: { id: string; name: string }[];
    projects: { id: string; assignedEmployeeIds?: string[] }[];
  }
): FormInstance {
  const now = new Date();
  const token = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + template.expiresInHours * 60 * 60 * 1000);
  const projectId = context.type === "project" ? (context.id ?? "") : "";
  const project = projectId ? opts.projects.find((p) => p.id === projectId) : undefined;
  const assignedIds = project?.assignedEmployeeIds ?? [];
  const initialAttendees: AttendeeRecord[] =
    context.type === "project" && projectId
      ? assignedIds.map((empId, idx) => {
          const emp = opts.employees.find((e) => e.id === empId);
          return {
            id: `att-${idx}-${Date.now()}`,
            name: emp?.name ?? empId,
            employeeId: empId,
            isExternal: false,
          };
        })
      : [];
  return {
    id: crypto.randomUUID(),
    templateId: template.id,
    projectId,
    contextType: context.type,
    contextId: context.id,
    contextName: context.name,
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
