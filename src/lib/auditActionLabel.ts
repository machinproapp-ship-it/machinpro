/** Shared audit log action labels (Central + Seguridad). */
export function auditActionDescription(action: string, l: Record<string, string>): string {
  const fromLocale = l[`audit_action_${action}`];
  if (fromLocale) return fromLocale;

  const m: Record<string, string> = {
    photo_approved: l.auditPhotoApproved ?? "",
    photo_rejected: l.auditPhotoRejected ?? "",
    photo_uploaded: l.auditPhotoUploaded ?? "",
    employee_created: l.auditEmployeeCreated ?? "",
    employee_deleted: l.auditEmployeeDeleted ?? "",
    document_uploaded: l.auditDocumentUploaded ?? "",
  };
  return m[action] ?? action;
}
