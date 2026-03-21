import type { DailyFieldReport, WeatherCondition } from "@/types/dailyFieldReport";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function localeForLanguage(lang?: string): string {
  const m: Record<string, string> = {
    es: "es-ES",
    en: "en-GB",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
  };
  return m[lang ?? "es"] ?? "en-GB";
}

function weatherLabel(w: WeatherCondition, t: Record<string, string>): string {
  const m: Record<WeatherCondition, string> = {
    sunny: t.weatherSunny ?? "Sunny",
    cloudy: t.weatherCloudy ?? "Cloudy",
    rainy: t.weatherRainy ?? "Rainy",
    windy: t.weatherWindy ?? "Windy",
    snowy: t.weatherSnowy ?? "Snowy",
    foggy: t.weatherFoggy ?? "Foggy",
  };
  return m[w] ?? w;
}

export function generateDailyFieldReportPdf(params: {
  report: DailyFieldReport;
  companyName: string;
  companyLogoUrl?: string;
  language?: string;
  labels: Record<string, string>;
  tempUnit: "C" | "F";
}): void {
  const { report, companyName, companyLogoUrl, language, labels: tl, tempUnit } = params;
  const locale = localeForLanguage(language);
  const title = tl.dailyFieldReport ?? "Daily Field Report";
  const footerLine = `${escapeHtml(companyName)} · MachinPro`;

  const section = (h: string, inner: string) =>
    `<section class="sec"><h2 class="h2">${escapeHtml(h)}</h2>${inner}</section>`;

  const p = (label: string, val: string) =>
    `<p class="line"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(val)}</p>`;

  const weatherInner = `
    ${p(tl.weatherSection ?? "Weather", weatherLabel(report.weatherCondition, tl))}
    ${
      report.weatherTemp != null
        ? p(tl.temperature ?? "Temperature", `${report.weatherTemp}°${tempUnit}`)
        : ""
    }
    ${report.weatherNotes ? `<p class="notes">${escapeHtml(report.weatherNotes)}</p>` : ""}
  `;

  let laborRows = "";
  for (const row of report.laborEntries) {
    laborRows += `<tr>
      <td>${escapeHtml(row.employeeName)}</td>
      <td>${escapeHtml(row.role)}</td>
      <td>${row.hoursWorked}</td>
      <td>${row.overtime}</td>
      <td>${escapeHtml(row.notes ?? "")}</td>
    </tr>`;
  }

  const laborInner = report.laborEntries.length
    ? `<table class="tbl"><thead><tr>
        <th>${escapeHtml(tl.workerName ?? "Worker")}</th>
        <th>${escapeHtml(tl.laborRole ?? tl.roleLabel ?? "Role")}</th>
        <th>${escapeHtml(tl.hoursWorked ?? "Hours")}</th>
        <th>${escapeHtml(tl.overtime ?? "OT")}</th>
        <th>${escapeHtml(tl.checklistComments ?? "Notes")}</th>
      </tr></thead><tbody>${laborRows}</tbody></table>`
    : `<p class="muted">—</p>`;

  let matRows = "";
  for (const row of report.materialEntries) {
    matRows += `<tr>
      <td>${escapeHtml(row.description)}</td>
      <td>${row.quantity}</td>
      <td>${escapeHtml(row.unit)}</td>
      <td>${escapeHtml(row.supplier ?? "")}</td>
      <td>${escapeHtml(row.notes ?? "")}</td>
    </tr>`;
  }

  const matInner = report.materialEntries.length
    ? `<table class="tbl"><thead><tr>
        <th>${escapeHtml(tl.description ?? "Description")}</th>
        <th>${escapeHtml(tl.quantity ?? "Qty")}</th>
        <th>${escapeHtml(tl.unit ?? "Unit")}</th>
        <th>${escapeHtml(tl.supplier ?? "Supplier")}</th>
        <th>${escapeHtml(tl.checklistComments ?? "Notes")}</th>
      </tr></thead><tbody>${matRows}</tbody></table>`
    : `<p class="muted">—</p>`;

  let eqRows = "";
  for (const row of report.equipmentEntries) {
    eqRows += `<tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${row.hoursUsed}</td>
      <td>${escapeHtml(row.operator ?? "")}</td>
      <td>${escapeHtml(row.notes ?? "")}</td>
    </tr>`;
  }

  const eqInner = report.equipmentEntries.length
    ? `<table class="tbl"><thead><tr>
        <th>${escapeHtml(tl.equipmentName ?? "Equipment")}</th>
        <th>${escapeHtml(tl.hoursUsed ?? "Hours")}</th>
        <th>${escapeHtml(tl.operator ?? "Operator")}</th>
        <th>${escapeHtml(tl.checklistComments ?? "Notes")}</th>
      </tr></thead><tbody>${eqRows}</tbody></table>`
    : `<p class="muted">—</p>`;

  const statusStr =
    report.status === "draft"
      ? tl.reportStatusDraft ?? "Draft"
      : report.status === "submitted"
        ? tl.reportStatusSubmitted ?? "Submitted"
        : tl.reportStatusApproved ?? "Approved";

  const dateStr = new Date(report.date).toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const logoBlock = companyLogoUrl
    ? `<div class="logo-wrap"><img class="logo" src="${escapeHtml(companyLogoUrl)}" alt="" crossorigin="anonymous" /></div>`
    : "";

  const bodyParts = [
    section(tl.weatherSection ?? "Weather", weatherInner),
    section(tl.workPerformed ?? "Work performed", `<p class="notes">${escapeHtml(report.workPerformed || "—")}</p>`),
    section(tl.plannedWork ?? "Planned work", `<p class="notes">${escapeHtml(report.plannedWork || "—")}</p>`),
    section(tl.laborSection ?? "Labor", laborInner),
    section(tl.materialsSection ?? "Materials", matInner),
    section(tl.equipmentSection ?? "Equipment", eqInner),
    section(
      tl.incidentsAndNotes ?? "Incidents & notes",
      `
      ${p(tl.visitorsOnSite ?? "Visitors", report.visitors || "—")}
      ${p(tl.delaysReasons ?? "Delays", report.delays || "—")}
      ${p(tl.safetyIncidents ?? "Safety", report.safetyIncidents || "—")}
      ${p(tl.inspectionsReceived ?? "Inspections", report.inspections || "—")}
      ${p(tl.generalNotes ?? "Notes", report.notes || "—")}
    `
    ),
  ].join("");

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(language ?? "en")}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: system-ui, sans-serif; color: #18181b; font-size: 11pt; line-height: 1.45; padding-bottom: 28px; }
    .hdr { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #b45309; padding-bottom: 12px; }
    .logo { max-height: 56px; max-width: 160px; object-fit: contain; }
    .h1 { font-size: 1.35rem; margin: 8px 0 4px; }
    .co { font-weight: 700; margin: 0; }
    .mp { color: #b45309; font-weight: 600; margin: 0 0 8px; font-size: 0.85rem; }
    .sub { margin: 2px 0; font-size: 0.9rem; color: #52525b; }
    .sec { margin-bottom: 18px; page-break-inside: avoid; }
    .h2 { font-size: 1rem; border-bottom: 1px solid #e4e4e7; padding-bottom: 4px; margin: 0 0 8px; }
    .line { margin: 4px 0; }
    .notes { white-space: pre-wrap; margin: 6px 0; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 9pt; }
    .tbl th, .tbl td { border: 1px solid #d4d4d8; padding: 6px; text-align: left; vertical-align: top; }
    .tbl th { background: #fafafa; }
    .muted { color: #71717a; }
    .foot { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e4e4e7; text-align: center; font-size: 9pt; color: #71717a; }
    @media print {
      .foot { position: fixed; bottom: 8mm; left: 0; right: 0; }
    }
  </style>
</head>
<body>
  <header class="hdr">
    ${logoBlock}
    <div>
      <p class="co">${escapeHtml(companyName)}</p>
      <p class="mp">MachinPro</p>
      <h1 class="h1">${escapeHtml(title)}</h1>
      <p class="sub">${escapeHtml(report.projectName)} · ${escapeHtml(dateStr)}</p>
      <p class="sub">${escapeHtml(tl.preparedBy ?? "Prepared by")}: ${escapeHtml(report.createdByName)} · ${escapeHtml(statusStr)}</p>
    </div>
  </header>
  ${bodyParts}
  <footer class="foot">${footerLine}</footer>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
