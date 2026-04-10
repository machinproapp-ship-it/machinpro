import jsPDF from "jspdf";
import type { FormInstance, FormTemplate } from "@/types/forms";
import { formatFormFieldValue } from "@/lib/formTemplateDisplay";

export async function generateFormPDF(
  instance: FormInstance,
  template: FormTemplate,
  projectName: string,
  companyName: string,
  companyLogoUrl?: string,
  supervisorDeviceNote?: string,
  resolveLabel?: (key: string) => string
): Promise<Blob> {
  const R = resolveLabel ?? ((k: string) => k);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  if (companyLogoUrl) {
    doc.addImage(companyLogoUrl, "PNG", 15, 10, 30, 15);
  }
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(R(template.name), 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${R("forms_pdf_project")}: ${projectName}`, 15, 30);
  doc.text(`${R("forms_pdf_date")}: ${instance.date}`, 15, 36);
  doc.text(`${R("forms_pdf_status")}: ${instance.status}`, 15, 42);

  let y = 52;

  template.sections.forEach((section) => {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(R(section.title), 15, y);
    y += 6;

    section.fields.forEach((field) => {
      if (field.type === "signature" || field.type === "attendance") return;
      const value = instance.fieldValues[field.id];
      if (value == null || value === "") return;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${R(field.label)}:`, 15, y);
      doc.setFont("helvetica", "normal");
      const text = formatFormFieldValue(field, value, R);
      const lines = doc.splitTextToSize(text, 160);
      doc.text(lines, 15, y + 4);
      y += 4 + lines.length * 4 + 3;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    y += 4;
  });

  if (instance.attendees.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(R("forms_pdf_attendance"), 15, y);
    y += 7;

    instance.attendees.forEach((att) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const status = att.signedAt
        ? `${R("signedAt")} ${att.signedAt}`
        : R("pendingSignature");
      doc.text(
        `${att.name}${att.company ? ` (${att.company})` : ""} — ${status}`,
        15,
        y
      );
      if (att.signature) {
        doc.addImage(att.signature, "PNG", 140, y - 4, 50, 12);
      }
      if (att.signedOnSupervisorDevice && supervisorDeviceNote) {
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(supervisorDeviceNote, 140, y + 10);
        doc.setTextColor(0);
      }
      y += 14;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(R("forms_pdf_footer"), 105, 290, { align: "center" });

  return doc.output("blob");
}
