import { jsPDF } from "jspdf";
import { csvCell, downloadCsvUtf8, filenameDateYmd } from "@/lib/csvExport";
import { formatCurrency } from "@/lib/dateUtils";

export type LaborReportDetailRow = {
  employee: string;
  project: string;
  hours: number;
  cost: number;
  dateYmd: string;
};

export type LaborReportBreakdown = { name: string; hours: number; cost: number };

export function downloadLaborReportDetailCsv(opts: {
  rows: LaborReportDetailRow[];
  periodLabel: string;
  filenameSlug: string;
  labels: {
    employee: string;
    project: string;
    hours: string;
    cost: string;
    period: string;
    date: string;
  };
}): void {
  const headers = [
    opts.labels.employee,
    opts.labels.project,
    opts.labels.hours,
    opts.labels.cost,
    opts.labels.date,
    opts.labels.period,
  ];
  const lines = [headers.map(csvCell).join(",")];
  for (const r of opts.rows) {
    lines.push(
      [
        csvCell(r.employee),
        csvCell(r.project),
        csvCell(String(r.hours)),
        csvCell(String(r.cost)),
        csvCell(r.dateYmd),
        csvCell(opts.periodLabel),
      ].join(",")
    );
  }
  downloadCsvUtf8(`labor_report_${opts.filenameSlug}_${filenameDateYmd()}.csv`, lines);
}

export function downloadLaborReportExecutivePdf(opts: {
  title: string;
  periodLabel: string;
  summaryHeading: string;
  totalHoursLabel: string;
  totalCostLabel: string;
  byEmployeeHeading: string;
  byProjectHeading: string;
  currency: string;
  dateLocale: string;
  totalHours: number;
  totalCost: number;
  byEmployee: LaborReportBreakdown[];
  byProject: LaborReportBreakdown[];
  filenameSlug: string;
}): void {
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const margin = 14;
  let y = 16;
  const pageMax = 285;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageMax) {
      pdf.addPage();
      y = 16;
    }
  };

  pdf.setFontSize(15);
  ensureSpace(8);
  pdf.text(opts.title, margin, y);
  y += 9;

  pdf.setFontSize(10);
  const periodLines = pdf.splitTextToSize(opts.periodLabel, 182);
  for (const pl of periodLines) {
    ensureSpace(6);
    pdf.text(pl, margin, y);
    y += 5;
  }
  y += 3;

  pdf.setFontSize(12);
  ensureSpace(8);
  pdf.text(opts.summaryHeading, margin, y);
  y += 7;

  pdf.setFontSize(10);
  const sum1 = `${opts.totalHoursLabel}: ${opts.totalHours.toFixed(2)}`;
  ensureSpace(6);
  pdf.text(sum1, margin, y);
  y += 6;
  const sum2 = `${opts.totalCostLabel}: ${formatCurrency(opts.totalCost, opts.currency, opts.dateLocale)}`;
  const sum2Lines = pdf.splitTextToSize(sum2, 182);
  for (const sl of sum2Lines) {
    ensureSpace(6);
    pdf.text(sl, margin, y);
    y += 5;
  }
  y += 4;

  pdf.setFontSize(11);
  ensureSpace(7);
  pdf.text(opts.byEmployeeHeading, margin, y);
  y += 6;
  pdf.setFontSize(9);
  for (const row of opts.byEmployee) {
    const line = `  · ${row.name}: ${row.hours.toFixed(2)}h — ${formatCurrency(row.cost, opts.currency, opts.dateLocale)}`;
    const parts = pdf.splitTextToSize(line, 178);
    for (const p of parts) {
      ensureSpace(5);
      pdf.text(p, margin, y);
      y += 4.5;
    }
  }
  y += 3;

  pdf.setFontSize(11);
  ensureSpace(7);
  pdf.text(opts.byProjectHeading, margin, y);
  y += 6;
  pdf.setFontSize(9);
  for (const row of opts.byProject) {
    const line = `  · ${row.name}: ${row.hours.toFixed(2)}h — ${formatCurrency(row.cost, opts.currency, opts.dateLocale)}`;
    const parts = pdf.splitTextToSize(line, 178);
    for (const p of parts) {
      ensureSpace(5);
      pdf.text(p, margin, y);
      y += 4.5;
    }
  }

  pdf.save(`labor_report_summary_${opts.filenameSlug}_${filenameDateYmd()}.pdf`);
}
