export type SafetyChecklistResponse = "yes" | "no" | "na" | "needs_improvement";

export type SafetyChecklistItem = {
  id: string;
  category: string;
  question: string;
  response?: SafetyChecklistResponse;
  actionBy?: string;
  dueDate?: string;
  comments?: string;
  photoUrl?: string;
};

export type SafetyChecklist = {
  id: string;
  projectId: string;
  title: string;
  date: string;
  conductedBy: string;
  conductedByName: string;
  items: SafetyChecklistItem[];
  status: "draft" | "completed" | "submitted";
  signature?: string;
  signedAt?: string;
  createdAt: string;
};
