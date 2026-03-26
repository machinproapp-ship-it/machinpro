import type { DailyFieldReport, DailyReportPpeKey, DailyReportWeather } from "@/types/dailyFieldReport";
import { dateLocaleForUser } from "@/lib/dailyReportFormat";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function weatherLabel(w: DailyReportWeather, t: Record<string, string>): string {
  const m: Record<DailyReportWeather, string> = {
    sunny: t.weatherSunny ?? "Sunny",
    cloudy: t.weatherCloudy ?? "Cloudy",
    rain: t.weatherRain ?? t.weatherRainy ?? "Rain",
    wind: t.weatherWind ?? t.weatherWindy ?? "Wind",
    snow: t.weatherSnow ?? t.weatherSnowy ?? "Snow",
  };
  return m[w] ?? w;
}

function ppeLabel(key: DailyReportPpeKey, t: Record<string, string>): string {
  const m: Record<DailyReportPpeKey, string> = {
    helmet: t.ppeHelmet ?? "Helmet",
    vest: t.ppeVest ?? "Vest",
    boots: t.ppeBoots ?? "Boots",
    gloves: t.ppeGloves ?? "Gloves",
    goggles: t.ppeGoggles ?? "Goggles",
    harness: t.ppeHarness ?? "Harness",
  };
  return m[key] ?? key;
}

function formatDateYmd(dateYmd: string, language: string, countryCode: string): string {
  const loc = dateLocaleForUser(language, countryCode);
  const d = new Date(`${dateYmd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateYmd;
  return new Intl.DateTimeFormat(loc, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

function formatDt(iso: string, language: string, countryCode: string): string {
  const loc = dateLocaleForUser(language, countryCode);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(loc, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function generateDailyFieldReportPdf(params: {
  report: DailyFieldReport;
  companyName: string;
  companyLogoUrl?: string;
  language?: string;
  labels: Record<string, string>;
  countryCode?: string;
}): void {
  const { report, companyName, companyLogoUrl, language = "en", labels: tl, countryCode = "CA" } = params;
  const title = tl.dailyReport ?? tl.dailyFieldReport ?? "Daily report";
  const footerLine = `${escapeHtml(companyName)} · MachinPro`;

  const section = (h: string, inner: string) =>
    `<section class="sec"><h2 class="h2">${escapeHtml(h)}</h2>${inner}</section>`;
  const p = (label: string, val: string) =>
    `<p class="line"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(val)}</p>`;

  const ppeGlobal =
    report.ppeSelected.length > 0
      ? report.ppeSelected.map((k) => ppeLabel(k as DailyReportPpeKey, tl)).join(", ")
      : "—";
  const ppeOther = report.ppeOther?.trim() || "";

  let hazardsHtml = "";
  for (const h of report.hazards) {
    const hppe =
      h.ppeRequired.length > 0
        ? h.ppeRequired.map((k) => ppeLabel(k as DailyReportPpeKey, tl)).join(", ")
        : "—";
    hazardsHtml += `<li><div>${escapeHtml(h.description || "—")}</div><div class="muted">PPE: ${escapeHtml(hppe)}</div></li>`;
  }

  let tasksHtml = "";
  for (const t of report.tasks) {
    tasksHtml += `<tr>
      <td>${escapeHtml(t.description)}</td>
      <td>${escapeHtml(t.employeeName ?? "—")}</td>
      <td>${t.completed ? "✓" : "—"}</td>
    </tr>`;
  }
  const tasksTable =
    report.tasks.length > 0
      ? `<table class="tbl"><thead><tr>
          <th>${escapeHtml(tl.description ?? "Task")}</th>
          <th>${escapeHtml(tl.schedule_pick_employees ?? "Employee")}</th>
          <th>${escapeHtml(tl.dailyReportDone ?? "Done")}</th>
        </tr></thead><tbody>${tasksHtml}</tbody></table>`
      : `<p class="muted">—</p>`;

  let attHtml = "";
  for (const a of report.attendance) {
    const st =
      a.status === "absent"
        ? tl.attendanceAbsent ?? "Absent"
        : a.status === "late"
          ? tl.attendanceLate ?? "Late"
          : tl.attendancePresent ?? "Present";
    attHtml += `<tr>
      <td>${escapeHtml(a.employeeName ?? "—")}</td>
      <td>${escapeHtml(st)}</td>
      <td>${a.fromTimeclock ? "✓" : "—"}</td>
    </tr>`;
  }
  const attTable =
    report.attendance.length > 0
      ? `<table class="tbl"><thead><tr>
          <th>${escapeHtml(tl.personnel ?? "Employee")}</th>
          <th>${escapeHtml(tl.attendance ?? "Attendance")}</th>
          <th>${escapeHtml(tl.dailyReportFromTimeclock ?? "Timeclock")}</th>
        </tr></thead><tbody>${attHtml}</tbody></table>`
      : `<p class="muted">—</p>`;

  let sigHtml = "";
  for (const s of report.signatures) {
    let extra = "";
    if (s.method === "tap_named" && s.signatureData) {
      try {
        const j = JSON.parse(s.signatureData) as { name?: string };
        extra = j.name ? ` (${escapeHtml(j.name)})` : "";
      } catch {
        /* ignore */
      }
    }
    sigHtml += `<tr>
      <td>${escapeHtml(s.employeeName ?? "—")}${extra}</td>
      <td>${escapeHtml(s.method)}</td>
      <td>${escapeHtml(formatDt(s.signedAt, language, countryCode))}</td>
    </tr>`;
  }
  const sigTable =
    report.signatures.length > 0
      ? `<table class="tbl"><thead><tr>
          <th>${escapeHtml(tl.personnel ?? "Signer")}</th>
          <th>${escapeHtml(tl.signatureMethod ?? "Method")}</th>
          <th>${escapeHtml(tl.checklistDate ?? "Time")}</th>
        </tr></thead><tbody>${sigHtml}</tbody></table>`
      : `<p class="muted">—</p>`;

  let photosHtml = "";
  for (const ph of report.photos) {
    photosHtml += `<div class="ph"><img src="${escapeHtml(ph.url)}" alt="" crossorigin="anonymous" /></div>`;
  }

  const dateStr = formatDateYmd(report.date, language, countryCode);
  const statusStr =
    report.status === "draft"
      ? tl.reportStatusDraft ?? "Draft"
      : tl.reportStatusPublished ?? "Published";

  const logoBlock = companyLogoUrl
    ? `<div class="logo-wrap"><img class="logo" src="${escapeHtml(companyLogoUrl)}" alt="" crossorigin="anonymous" /></div>`
    : "";

  const bodyParts = [
    section(tl.weatherSection ?? "Weather", p(tl.weatherSection ?? "Weather", weatherLabel(report.weather, tl))),
    section(tl.siteConditions ?? "Site", `<p class="notes">${escapeHtml(report.siteConditions || "—")}</p>`),
    section(
      tl.securityBriefing ?? "Safety",
      `
      ${p(tl.dailyReportPpeGlobal ?? "PPE", ppeGlobal + (ppeOther ? `; ${ppeOther}` : ""))}
      <ul class="hz">${hazardsHtml || `<li class="muted">—</li>`}</ul>
    `
    ),
    section(tl.dailyTasks ?? "Tasks", tasksTable),
    section(tl.attendance ?? "Attendance", attTable),
    section(tl.generalNotes ?? "Notes", `<p class="notes">${escapeHtml(report.notes || "—")}</p>`),
    section(
      tl.dailyReportPhotos ?? "Photos",
      photosHtml ? `<div class="grid">${photosHtml}</div>` : `<p class="muted">—</p>`
    ),
    section(tl.dailyReportSignaturesList ?? "Signatures", sigTable),
  ].join("");

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(language)}">
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
    .hz { margin: 8px 0; padding-left: 18px; }
    .hz li { margin: 6px 0; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .ph img { width: 100%; max-height: 160px; object-fit: cover; border-radius: 6px; }
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
