import type { SafetyChecklist } from "@/types/safetyChecklist";

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

function responseLabel(
  r: SafetyChecklist["items"][0]["response"],
  t: Record<string, string>
): string {
  if (r === "yes") return t.checklistYes ?? "Yes";
  if (r === "no") return t.checklistNo ?? "No";
  if (r === "na") return t.checklistNA ?? "N/A";
  if (r === "needs_improvement") return t.checklistNeedsImprovement ?? "Needs improvement";
  return "—";
}

export function generateSafetyChecklistPdf(params: {
  checklist: SafetyChecklist;
  projectName: string;
  companyName: string;
  language?: string;
  labels: Record<string, string>;
}): void {
  const { checklist, projectName, companyName, language, labels: t } = params;
  const locale = localeForLanguage(language);
  const title = t.safetyChecklist ?? "Safety Checklist";
  const conducted = t.conductedBy ?? "Conducted by";
  const actionBy = t.checklistActionBy ?? "Action by";
  const due = t.checklistDueDate ?? "Due date";
  const comments = t.checklistComments ?? "Comments";

  const byCategory = new Map<string, typeof checklist.items>();
  for (const it of checklist.items) {
    const cat = it.category || "—";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(it);
  }

  let body = "";
  for (const [cat, items] of byCategory) {
    body += `<h2 class="cat">${escapeHtml(cat)}</h2>`;
    for (const it of items) {
      const resp = responseLabel(it.response, t);
      const extra =
        (it.response === "no" || it.response === "needs_improvement")
          ? `<div class="extra">
               ${it.actionBy ? `<p><strong>${escapeHtml(actionBy)}:</strong> ${escapeHtml(it.actionBy)}</p>` : ""}
               ${it.dueDate ? `<p><strong>${escapeHtml(due)}:</strong> ${escapeHtml(it.dueDate)}</p>` : ""}
               ${it.comments ? `<p><strong>${escapeHtml(comments)}:</strong> ${escapeHtml(it.comments)}</p>` : ""}
             </div>`
          : "";
      body += `
        <div class="item">
          <p class="q">${escapeHtml(it.question)}</p>
          <p class="resp"><strong>${escapeHtml(resp)}</strong></p>
          ${extra}
        </div>`;
    }
  }

  const dateStr = new Date(checklist.date).toLocaleDateString(locale);
  const statusStr =
    checklist.status === "draft"
      ? t.checklistStatusDraft ?? t.formStatusDraft ?? "Draft"
      : checklist.status === "completed"
        ? t.checklistStatusCompleted ?? t.formStatusCompleted ?? "Completed"
        : t.checklistStatusSubmitted ?? "Submitted";

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(language ?? "en")}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #18181b; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.25rem; margin-bottom: 8px; }
    .meta { font-size: 0.875rem; color: #52525b; margin-bottom: 16px; }
    h2.cat { font-size: 1rem; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e4e4e7; padding-bottom: 4px; }
    .item { margin-bottom: 12px; padding: 10px; background: #fafafa; border-radius: 8px; page-break-inside: avoid; }
    .q { margin: 0 0 6px; font-weight: 500; }
    .resp { margin: 0; font-size: 0.9rem; }
    .extra { margin-top: 8px; font-size: 0.8rem; color: #3f3f46; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(companyName)} · ${escapeHtml(projectName)}</p>
  <p class="meta">${escapeHtml(checklist.title)} · ${escapeHtml(dateStr)} · ${escapeHtml(statusStr)}</p>
  <p class="meta">${escapeHtml(conducted)}: ${escapeHtml(checklist.conductedByName || checklist.conductedBy)}</p>
  ${body}
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
