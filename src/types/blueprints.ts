export type AnnotationType = "pin" | "note" | "photo";
export type AnnotationColor = "red" | "yellow" | "green" | "blue";
export type BlueprintCategory = "architectural" | "electrical" | "structural" | "detail";

export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  content: string;
  color: AnnotationColor;
  resolved: boolean;
  createdBy: string;
  createdAt: string;
}

export interface BlueprintRevision {
  revisionNumber: number;
  fileData: string;
  fileType: "pdf" | "image";
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  isCurrent: boolean;
}

export interface Blueprint {
  id: string;
  projectId: string;
  category: BlueprintCategory;
  name: string;
  version?: string;
  isCurrentVersion?: boolean;
  revisions: BlueprintRevision[];
  annotations: Annotation[];
}
