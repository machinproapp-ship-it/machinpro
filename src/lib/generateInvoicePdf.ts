import { jsPDF } from "jspdf";
import { drawMachinProPdfFooter, drawPdfBrandedHeader } from "@/lib/pdfBranding";
import { fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";

/** Default VAT/sales tax % by company country (ISO2). */
export function defaultInvoiceTaxPercent(countryCode: string): number {
  const c = String(countryCode || "")
    .trim()
    .toUpperCase();
  if (["ES", "FR", "DE", "IT", "PT", "NL", "BE", "AT", "IE", "PL", "CZ", "RO", "SK", "HR", "SI"].includes(c))
    return 21;
  if (c === "UK" || c === "GB") return 20;
  if (c === "MX") return 16;
  if (c === "CA") return 13;
  if (c === "AU") return 10;
  if (c === "NZ") return 15;
  return 0;
}

export function nextMachinProInvoiceNumber(companyId: string): string {
  const y = new Date().getFullYear();
  const key = `machinpro_invoice_seq_${companyId}_${y}`;
  let n = 0;
  try {
    n = parseInt(localStorage.getItem(key) ?? "0", 10) || 0;
  } catch {
    /* ignore */
  }
  n += 1;
  try {
    localStorage.setItem(key, String(n));
  } catch {
    /* ignore */
  }
  return `INV-${y}-${String(n).padStart(4, "0")}`;
}

export type InvoicePdfLine = {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

function L(labels: Record<string, string>, key: string, fallback: string): string {
  const v = labels[key];
  return typeof v === "string" && v.trim() ? v : fallback;
}

export async function generateInvoicePdf(opts: {
  labels: Record<string, string>;
  companyName: string;
  companyId: string;
  companyLogoUrl?: string | null;
  /** Emisor */
  issuerName: string;
  issuerAddress?: string;
  issuerEmail?: string;
  issuerPhone?: string;
  invoiceNumber: string;
  issueDate: string;
  currency: string;
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;
  clientProjectRef?: string;
  lines: InvoicePdfLine[];
  taxPercent: number;
  notes?: string;
}): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const R = (k: string, fb: string) => L(opts.labels, k, fb);

  let y = await drawPdfBrandedHeader(doc, { companyLogoUrl: opts.companyLogoUrl });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(R("invoice_heading_bilingual", "FACTURA / INVOICE"), 196, y, { align: "right" });
  y += 5;
  doc.setFontSize(16);
  doc.text(R("invoice_title", "Invoice"), 196, y, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${R("invoice_number", "Invoice number")}: ${opts.invoiceNumber}`, 196, y + 6, { align: "right" });
  doc.text(`${R("invoice_date", "Date")}: ${opts.issueDate}`, 196, y + 10, { align: "right" });
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(opts.issuerName, 14, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (opts.issuerAddress?.trim()) {
    const a = doc.splitTextToSize(opts.issuerAddress.trim(), 85);
    for (const ln of a) {
      doc.text(ln, 14, y);
      y += 3.5;
    }
  }
  if (opts.issuerEmail?.trim()) {
    doc.text(opts.issuerEmail.trim(), 14, y);
    y += 3.5;
  }
  if (opts.issuerPhone?.trim()) {
    doc.text(opts.issuerPhone.trim(), 14, y);
    y += 3.5;
  }
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.text(R("invoice_client", "Client"), 14, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text(opts.clientName, 14, y);
  y += 3.5;
  if (opts.clientAddress?.trim()) {
    for (const ln of doc.splitTextToSize(opts.clientAddress.trim(), 120)) {
      doc.text(ln, 14, y);
      y += 3.5;
    }
  }
  if (opts.clientEmail?.trim()) {
    doc.text(opts.clientEmail.trim(), 14, y);
    y += 3.5;
  }
  if (opts.clientProjectRef?.trim()) {
    doc.text(`${R("invoice_client_project_ref", "Client project ref")}: ${opts.clientProjectRef.trim()}`, 14, y);
    y += 3.5;
  }
  y += 6;

  const colDesc = 14;
  const colUnit = 100;
  const colQty = 128;
  const colPrice = 150;
  const colTot = 175;
  doc.setFillColor(245, 245, 245);
  doc.rect(12, y - 4, 186, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(R("invoice_description", "Description"), colDesc, y);
  doc.text(R("invoice_unit", "Unit"), colUnit, y);
  doc.text(R("invoice_quantity", "Qty"), colQty, y);
  doc.text(R("invoice_unit_price", "Unit price"), colPrice, y);
  doc.text(R("invoice_total", "Total"), colTot, y);
  y += 6;
  doc.setFont("helvetica", "normal");

  let subtotal = 0;
  const ensure = (need: number) => {
    if (y + need > 275) {
      doc.addPage();
      y = 20;
    }
  };

  for (const line of opts.lines) {
    ensure(8);
    subtotal += line.lineTotal;
    const desc = doc.splitTextToSize(line.description, 82);
    doc.text(desc[0] ?? "", colDesc, y);
    doc.text(String(line.unit), colUnit, y);
    doc.text(line.quantity.toFixed(2), colQty, y);
    doc.text(`${opts.currency} ${line.unitPrice.toFixed(2)}`, colPrice, y);
    doc.text(`${opts.currency} ${line.lineTotal.toFixed(2)}`, colTot, y);
    let dy = 3.5;
    for (let i = 1; i < desc.length; i++) {
      doc.text(desc[i] ?? "", colDesc, y + dy);
      dy += 3.5;
    }
    y += Math.max(5, dy);
  }

  y += 4;
  const taxBase = Math.max(0, subtotal);
  const taxAmt = Math.round(taxBase * (opts.taxPercent / 100) * 100) / 100;
  const grand = taxBase + taxAmt;

  doc.setFont("helvetica", "bold");
  doc.text(`${R("invoice_subtotal", "Subtotal")}: ${opts.currency} ${taxBase.toFixed(2)}`, 150, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(
    `${R("invoice_tax", "Tax")} (${opts.taxPercent.toFixed(2)}%): ${opts.currency} ${taxAmt.toFixed(2)}`,
    150,
    y,
    { align: "right" }
  );
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    `${R("invoice_grand_total", "Amount due")}: ${opts.currency} ${grand.toFixed(2)}`,
    150,
    y,
    { align: "right" }
  );
  y += 8;

  if (opts.notes?.trim()) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(R("invoice_notes", "Notes"), 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    for (const ln of doc.splitTextToSize(opts.notes.trim(), 182)) {
      ensure(5);
      doc.text(ln, 14, y);
      y += 3.5;
    }
  }

  drawMachinProPdfFooter(doc, `MachinPro · machin.pro`);

  const slug = fileSlugCompany(opts.companyName, opts.companyId || "co");
  return {
    blob: doc.output("blob"),
    filename: `invoice_${opts.invoiceNumber.replace(/[^\w-]+/g, "_")}_${slug}_${filenameDateYmd()}.pdf`,
  };
}
