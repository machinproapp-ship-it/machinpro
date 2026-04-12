import { jsPDF } from "jspdf";
import { drawMachinProPdfFooter, drawPdfBrandedHeader } from "@/lib/pdfBranding";
import { fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";

function L(labels: Record<string, string>, key: string, fallback: string): string {
  const v = labels[key];
  return typeof v === "string" && v.trim() ? v : fallback;
}

export async function generateBenefitReportPdf(opts: {
  labels: Record<string, string>;
  companyName: string;
  companyId: string;
  companyLogoUrl?: string | null;
  projectName: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  income: number;
  laborCost: number;
  materialsCost: number;
  rentalsCost: number;
  otherCost: number;
}): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const R = (k: string, fb: string) => L(opts.labels, k, fb);

  let y = await drawPdfBrandedHeader(doc, { companyLogoUrl: opts.companyLogoUrl });

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(R("benefit_report_title", "Benefit report"), 105, y, { align: "center" });
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(opts.companyName, 14, y);
  y += 4;
  doc.text(`${opts.projectName}`, 14, y);
  y += 4;
  doc.text(`${R("timesheet_date_from", "From")}: ${opts.periodStart}  →  ${R("timesheet_date_to", "To")}: ${opts.periodEnd}`, 14, y);
  y += 10;

  const totalCosts = opts.laborCost + opts.materialsCost + opts.rentalsCost + opts.otherCost;
  const grossProfit = opts.income - totalCosts;
  const marginPct = opts.income > 0 ? (grossProfit / opts.income) * 100 : 0;

  const section = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  };

  section(R("benefit_report_income", "Income"));
  doc.text(`${R("benefit_report_billed_production", "Billed production (sell)")}: ${opts.currency} ${opts.income.toFixed(2)}`, 18, y);
  y += 8;

  section(R("benefit_report_costs", "Costs"));
  doc.text(`${R("benefit_report_labor", "Labor (production cost)")}: ${opts.currency} ${opts.laborCost.toFixed(2)}`, 18, y);
  y += 4;
  doc.text(`${R("benefit_report_materials", "Materials & tools")}: ${opts.currency} ${opts.materialsCost.toFixed(2)}`, 18, y);
  y += 4;
  doc.text(`${R("benefit_report_rentals", "Rentals")}: ${opts.currency} ${opts.rentalsCost.toFixed(2)}`, 18, y);
  y += 4;
  doc.text(`${R("benefit_report_other", "Other expenses")}: ${opts.currency} ${opts.otherCost.toFixed(2)}`, 18, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text(`${R("benefit_report_total_costs", "Total costs")}: ${opts.currency} ${totalCosts.toFixed(2)}`, 18, y);
  y += 10;

  section(R("benefit_report_margin", "Margin"));
  doc.text(`${R("benefit_report_gross_profit", "Gross profit")}: ${opts.currency} ${grossProfit.toFixed(2)}`, 18, y);
  y += 4;
  let marginLabel = R("benefit_report_margin_low", "Low");
  if (marginPct >= 20) marginLabel = R("benefit_report_margin_high", "Strong");
  else if (marginPct >= 10) marginLabel = R("benefit_report_margin_mid", "Moderate");
  if (marginPct >= 20) doc.setTextColor(16, 120, 40);
  else if (marginPct >= 10) doc.setTextColor(180, 120, 0);
  else doc.setTextColor(180, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`${marginPct.toFixed(1)}% — ${marginLabel}`, 18, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  for (const ln of doc.splitTextToSize(R("benefit_report_footer_note", "Figures based on production reports and recorded expenses."), 182)) {
    doc.text(ln, 14, y);
    y += 3.5;
  }
  doc.setTextColor(0);

  drawMachinProPdfFooter(doc, `MachinPro · machin.pro`);

  const slug = fileSlugCompany(opts.companyName, opts.companyId || "co");
  return {
    blob: doc.output("blob"),
    filename: `benefit_${slug}_${filenameDateYmd()}.pdf`,
  };
}
