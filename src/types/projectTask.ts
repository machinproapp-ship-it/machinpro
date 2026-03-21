export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type ProjectTask = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedToEmployeeId?: string;
  assignedToName?: string;
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  tags?: string[];
};
