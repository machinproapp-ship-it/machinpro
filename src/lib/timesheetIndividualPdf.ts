import { jsPDF } from "jspdf";
import { fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";

export function downloadIndividualTimesheetPdf(opts: {
  employeeName: string;
  periodLabel: string;
  weekStart: string;
  weekEnd: string;
  entries: { dateYmd: string; project: string; hours: number; note?: string }[];
  byProject: { name: string; hours: number }[];
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  statusLabel: string;
  companyName: string;
  filenameSlug: string;
  labels: {
    title: string;
    period: string;
    date: string;
    project: string;
    hours: string;
    notes: string;
    total: string;
    regular: string;
    overtime: string;
    status: string;
    employeeSign: string;
    supervisorSign: string;
    signatureDate: string;
    footer: string;
    byProject: string;
  };
}): void {
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const m = 14;
  let y = 18;
  pdf.setFontSize(16);
  pdf.setTextColor(26, 79, 94);
  pdf.text(opts.labels.title, m, y);
  y += 8;
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);
  pdf.text(opts.companyName, m, y);
  y += 6;
  pdf.text(`${opts.labels.period}: ${opts.periodLabel}`, m, y);
  y += 6;
  pdf.text(`${opts.employeeName}`, m, y);
  y += 8;

  pdf.setFontSize(9);
  pdf.setTextColor(30, 30, 30);
  pdf.text(`${opts.labels.status}: ${opts.statusLabel}`, m, y);
  y += 8;

  const rows: string[][] = [
    [opts.labels.date, opts.labels.project, opts.labels.hours, opts.labels.notes],
    ...opts.entries.map((e) => [
      e.dateYmd,
      e.project,
      String(Math.round(e.hours * 10) / 10),
      (e.note ?? "").slice(0, 80),
    ]),
  ];
  pdf.setFontSize(8);
  const colW = [28, 58, 18, 72];
  let x = m;
  for (let i = 0; i < rows.length; i++) {
    if (y > 270) {
      pdf.addPage();
      y = 16;
    }
    const row = rows[i]!;
    x = m;
    for (let c = 0; c < row.length; c++) {
      pdf.text(String(row[c]).slice(0, 42), x, y, { maxWidth: colW[c]! - 2 });
      x += colW[c]!;
    }
    y += i === 0 ? 6 : 5;
  }

  y += 4;
  pdf.setFontSize(9);
  pdf.text(`${opts.labels.total}: ${Math.round(opts.totalHours * 10) / 10}h`, m, y);
  y += 5;
  pdf.text(`${opts.labels.regular}: ${Math.round(opts.regularHours * 10) / 10}h`, m, y);
  y += 5;
  pdf.text(`${opts.labels.overtime}: ${Math.round(opts.overtimeHours * 10) / 10}h`, m, y);
  y += 8;

  pdf.setFontSize(8);
  pdf.text(opts.labels.byProject, m, y);
  y += 5;
  for (const bp of opts.byProject) {
    if (y > 270) {
      pdf.addPage();
      y = 16;
    }
    pdf.text(`· ${bp.name}: ${Math.round(bp.hours * 10) / 10}h`, m + 2, y);
    y += 4;
  }

  y += 6;
  if (y > 220) {
    pdf.addPage();
    y = 16;
  }
  pdf.setDrawColor(180);
  pdf.line(m, y, m + 75, y);
  pdf.line(m + 100, y, m + 175, y);
  y += 5;
  pdf.text(opts.labels.employeeSign, m, y);
  pdf.text(opts.labels.supervisorSign, m + 100, y);
  y += 5;
  pdf.setFontSize(7);
  pdf.text(opts.labels.signatureDate, m, y);
  pdf.text(opts.labels.signatureDate, m + 100, y);
  y += 11;
  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 120);
  pdf.text(opts.labels.footer, m, 285);

  pdf.save(`timesheet_${fileSlugCompany(opts.filenameSlug, "co")}_${filenameDateYmd()}.pdf`);
}
