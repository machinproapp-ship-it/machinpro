/** Binders (document folders) and documents. Used by page.tsx and BindersModule. */

export type BinderCategory =
  | "health_safety"
  | "safety_data"
  | "memos"
  | "procedures"
  | "certificates"
  | "custom";

export interface Binder {
  id: string;
  name: string;
  category: BinderCategory;
  description?: string;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: string;
  documentCount: number;
}

export interface BinderDocument {
  id: string;
  binderId: string;
  name: string;
  description?: string;
  fileType: "pdf" | "image" | "doc" | "other";
  fileUrl?: string;
  fileSize?: string;
  uploadedBy: string;
  uploadedAt: string;
  version?: string;
  isRequired: boolean;
  visibleToRoles: string[];
}
