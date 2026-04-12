import { jsPDF } from "jspdf";
import { drawMachinProPdfFooter, drawPdfBrandedHeader } from "@/lib/pdfBranding";

export async function generateInventoryQrLabelPdf(opts: {
  labels: Record<string, string>;
  companyName: string;
  companyLogoUrl?: string | null;
  itemName: string;
  itemCode: string;
  statusLabel: string;
  /** data:image/png;base64,... */
  qrDataUrl: string;
}): Promise<{ blob: Blob; filename: string }> {
  const L = (k: string, fb: string) => (opts.labels[k] as string | undefined)?.trim() || fb;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = await drawPdfBrandedHeader(doc, { companyLogoUrl: opts.companyLogoUrl });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(opts.companyName, 105, y, { align: "center" });
  y += 10;

  const imgW = 70;
  const imgH = 70;
  const xImg = (210 - imgW) / 2;
  try {
    doc.addImage(opts.qrDataUrl, "PNG", xImg, y, imgW, imgH);
  } catch {
    doc.setFontSize(10);
    doc.text("QR", xImg + imgW / 2, y + imgH / 2, { align: "center" });
  }
  y += imgH + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(opts.itemName, 105, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${L("inventory_serial_number", "Code")}: ${opts.itemCode}`, 105, y, { align: "center" });
  y += 5;
  doc.text(`${L("common_status", "Status")}: ${opts.statusLabel}`, 105, y, { align: "center" });
  y += 12;

  drawMachinProPdfFooter(
    doc,
    L("invoice_footer_generated", "MachinPro · machin.pro"),
    210,
    "machin.pro"
  );

  const blob = doc.output("blob");
  const safe = opts.itemName.replace(/[^\w\-]+/g, "_").slice(0, 40);
  return { blob, filename: `qr_${safe}.pdf` };
}
