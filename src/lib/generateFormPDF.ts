import jsPDF from "jspdf";
import type { FormInstance, FormTemplate } from "@/types/forms";
import { formatFormFieldValue } from "@/lib/formTemplateDisplay";

export async function generateFormPDF(
  instance: FormInstance,
  template: FormTemplate,
  projectName: string,
  companyName: string,
  companyLogoUrl?: string,
  companyAddress?: string,
  companyPhone?: string,
  companyEmail?: string,
  docNumber?: string,
  supervisorDeviceNote?: string,
  resolveLabel?: (key: string) => string
): Promise<Blob> {
  const R = resolveLabel ?? ((k: string) => k);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  const brandSuffix = ` · MachinPro`;
  const headerCompany = `${companyName}${brandSuffix}`;

  if (companyLogoUrl) {
    try {
      doc.addImage(companyLogoUrl, "PNG", margin, y, 32, 14);
    } catch {
      /* ignore bad image */
    }
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  let rightY = y + 4;
  doc.text(headerCompany, pageW - margin, rightY, { align: "right" });
  rightY += 4;
  if (companyAddress?.trim()) {
    const lines = doc.splitTextToSize(companyAddress.trim(), 75);
    doc.text(lines, pageW - margin, rightY, { align: "right" });
    rightY += lines.length * 4;
  }
  if (companyPhone?.trim()) {
    doc.text(companyPhone.trim(), pageW - margin, rightY, { align: "right" });
    rightY += 4;
  }
  if (companyEmail?.trim()) {
    doc.text(companyEmail.trim(), pageW - margin, rightY, { align: "right" });
    rightY += 4;
  }
  doc.setTextColor(0);

  y = Math.max(y + 18, rightY + 4);

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, pageW - 2 * margin, 22, 2, 2, "S");

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(R(template.name), margin + 3, y + 8);

  if (docNumber?.trim()) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${R("forms_pdf_doc_number")}${docNumber.trim()}`, pageW - margin - 3, y + 7, {
      align: "right",
    });
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70);
  doc.text(`${R("forms_pdf_project")}: ${projectName}`, margin + 3, y + 14);
  doc.text(`${R("forms_pdf_sent_by")}: ${instance.createdBy || "—"}`, margin + 3, y + 19);
  doc.text(`${R("forms_pdf_sent_at")}: ${instance.createdAt ?? ""}`, margin + 55, y + 19);
  doc.setTextColor(0);

  y += 28;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${R("forms_pdf_date")}: ${instance.date}`, margin, y);
  doc.text(`${R("forms_pdf_status")}: ${instance.status}`, margin + 75, y);
  y += 8;

  template.sections.forEach((section) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(R(section.title), margin, y);
    y += 6;

    section.fields.forEach((field) => {
      if (field.type === "signature" || field.type === "attendance") return;
      const value = instance.fieldValues[field.id];
      if (value == null || value === "") return;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${R(field.label)}:`, margin, y);
      doc.setFont("helvetica", "normal");
      const text = formatFormFieldValue(field, value, R);
      const lines = doc.splitTextToSize(text, pageW - 2 * margin - 5);
      doc.text(lines, margin + 5, y + 4);
      y += 4 + lines.length * 4 + 3;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    y += 4;
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
  });

  if (instance.attendees.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(R("forms_pdf_attendance"), margin, y);
    y += 7;

    instance.attendees.forEach((att) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const status = att.signedAt
        ? `${R("signedAt")} ${att.signedAt}`
        : R("pendingSignature");
      doc.text(
        `${att.name}${att.company ? ` (${att.company})` : ""} — ${status}`,
        margin,
        y
      );
      if (att.signature) {
        try {
          doc.addImage(att.signature, "PNG", pageW - margin - 52, y - 4, 50, 14);
        } catch {
          /* ignore */
        }
      }
      if (att.signedOnSupervisorDevice && supervisorDeviceNote) {
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(supervisorDeviceNote, pageW - margin - 3, y + 12, { align: "right" });
        doc.setTextColor(0);
      }
      y += 16;
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
    });
  }

  const totalPages = doc.getNumberOfPages();
  const footerCenter = R("forms_pdf_powered_by");
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(footerCenter, pageW / 2, 287, { align: "center" });
    doc.text(`${i} / ${totalPages}`, pageW - margin, 287, { align: "right" });
    doc.setTextColor(0);
  }

  return doc.output("blob");
}
