import { escapeHtml } from "@/lib/invitationEmailHtml";
import {
  getTransactionalCopy,
  type TransactionalEmailLang,
} from "@/lib/emailTransactionalI18n";

/** Canonical public URLs for deliverability and brand consistency. */
export const MACHINPRO_EMAIL_ORIGIN = "https://machin.pro";
export const MACHINPRO_LOGO_URL = `${MACHINPRO_EMAIL_ORIGIN}/logo-source.png`;
export const MACHINPRO_LOGIN_URL = `${MACHINPRO_EMAIL_ORIGIN}/login`;
export const MACHINPRO_PRIVACY_URL = `${MACHINPRO_EMAIL_ORIGIN}/legal/privacy`;
export const MACHINPRO_TERMS_URL = `${MACHINPRO_EMAIL_ORIGIN}/legal/terms`;

function fillPlain(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  return out;
}

function fillHtml(template: string, vars: Record<string, string>): string {
  const esc: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) esc[k] = escapeHtml(v);
  return fillPlain(template, esc);
}

function emailOuterTable(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <title>MachinPro</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        ${content}
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

function emailGradientHeader(): string {
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(135deg,#134e5e 0%,#0f3a45 52%,#071a20 100%);border-radius:8px 8px 0 0;">
  <tr>
    <td align="center" style="padding:28px 24px;">
      <img src="${escapeHtml(MACHINPRO_LOGO_URL)}" width="112" height="112" alt="MachinPro" style="display:inline-block;border:0;height:auto;max-width:112px;" />
    </td>
  </tr>
</table>
`.trim();
}

/** Card with gradient header + white body */
function emailCardFramed(inner: string): string {
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
  <tr>
    <td style="padding:0;">${emailGradientHeader()}</td>
  </tr>
  <tr>
    <td style="padding:32px 28px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
      ${inner}
    </td>
  </tr>
</table>
`.trim();
}

/** Primary CTA — orange #f97316, 6px radius. */
function ctaButton(href: string, label: string): string {
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
  <tr>
    <td align="center" bgcolor="#f97316" style="background-color:#f97316;border-radius:6px;mso-padding-alt:14px 28px;">
      <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;line-height:1.25;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>
`.trim();
}

function standardFooterLine(companyName: string): string {
  const co = companyName.trim() || "—";
  return `
<p style="margin:28px 0 0;font-size:12px;line-height:1.55;color:#94a3b8;text-align:center;">
  MachinPro · ${escapeHtml(co)} · <a href="mailto:support@machin.pro" style="color:#64748b;text-decoration:underline;">support@machin.pro</a>
</p>
<p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#cbd5e1;text-align:center;">
  <a href="${escapeHtml(MACHINPRO_PRIVACY_URL)}" style="color:#94a3b8;text-decoration:underline;">Privacy</a>
  <span style="color:#e2e8f0;"> · </span>
  <a href="${escapeHtml(MACHINPRO_TERMS_URL)}" style="color:#94a3b8;text-decoration:underline;">Terms</a>
</p>
`.trim();
}

export function buildWelcomeEmailHtml(opts: {
  userName: string;
  companyName: string;
  lang: TransactionalEmailLang;
}): string {
  const c = getTransactionalCopy(opts.lang);
  const name = opts.userName.trim() || "there";
  const company = opts.companyName.trim() || "your team";
  const title = fillHtml(c.welcomeTitle, { name, company });
  const subtitle = escapeHtml(c.welcomeSubtitle);
  const warm = fillHtml(c.welcomeWarm, { company });
  const intro = escapeHtml(c.welcomeStepsIntro);

  const inner = `
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;font-weight:700;color:#0f172a;text-align:center;">
  ${title}
</h1>
<p style="margin:0 0 18px;font-size:16px;line-height:1.5;color:#64748b;text-align:center;">
  ${subtitle}
</p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#334155;text-align:left;">
  ${warm}
</p>
<p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#0f172a;text-align:left;">
  ${intro}
</p>
<ol style="margin:0 0 24px;padding-left:22px;color:#334155;font-size:15px;line-height:1.65;text-align:left;">
  <li style="margin-bottom:10px;"><strong>${escapeHtml(c.welcomeStep1)}</strong> — ${escapeHtml(c.welcomeStep1Hint)}</li>
  <li style="margin-bottom:10px;"><strong>${escapeHtml(c.welcomeStep2)}</strong> — ${escapeHtml(c.welcomeStep2Hint)}</li>
  <li style="margin-bottom:4px;"><strong>${escapeHtml(c.welcomeStep3)}</strong> — ${escapeHtml(c.welcomeStep3Hint)}</li>
</ol>
${ctaButton(MACHINPRO_EMAIL_ORIGIN, c.welcomeCta)}
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">
  ${escapeHtml(c.welcomeTrialReminder)}
</p>
${standardFooterLine(company)}
`.trim();

  return emailOuterTable(emailCardFramed(inner));
}

export function buildWelcomeEmailSubject(
  userName: string,
  companyName: string,
  lang: TransactionalEmailLang
): string {
  const c = getTransactionalCopy(lang);
  const name = userName.trim() || "there";
  const company = companyName.trim() || "your team";
  return fillPlain(c.welcomeEmailSubject, { name, company });
}

export function buildEmployeeInviteEmailHtml(opts: {
  adminName: string;
  companyName: string;
  lang: TransactionalEmailLang;
  ctaUrl: string;
}): string {
  const c = getTransactionalCopy(opts.lang);
  const admin = opts.adminName.trim() || "—";
  const company = opts.companyName.trim() || "—";
  const title = fillHtml(c.employeeInviteTitle, { company });
  const lead = fillHtml(c.employeeInviteLead, { admin, company });

  const inner = `
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;font-weight:700;color:#0f172a;text-align:center;">
  ${title}
</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#334155;text-align:left;">
  ${lead}
</p>
${ctaButton(opts.ctaUrl, c.employeeInviteCta)}
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">
  ${escapeHtml(c.employeeInviteExpiry)}
</p>
${standardFooterLine(company)}
`.trim();

  return emailOuterTable(emailCardFramed(inner));
}

export function employeeInviteSubject(companyName: string, lang: TransactionalEmailLang): string {
  const c = getTransactionalCopy(lang);
  return fillPlain(c.employeeInviteSubject, { company: companyName });
}

export function buildPasswordResetEmailHtml(opts: { resetUrl: string }): string {
  const inner = `
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;font-weight:700;color:#0f172a;text-align:center;">
  Reset your MachinPro password
</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;text-align:left;">
  We received a request to reset your password. Use the button below to choose a new password.
</p>
${ctaButton(opts.resetUrl, "Reset password")}
<p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;text-align:left;">
  This link expires in <strong>1 hour</strong>. If you didn&apos;t request this, you can safely ignore this email — your password will stay the same.
</p>
${standardFooterLine("MachinPro")}
`.trim();
  return emailOuterTable(emailCardFramed(inner));
}

export function buildVacationAdminEmailHtml(opts: {
  companyName: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  absenceNotes: string | null;
  reviewUrl: string;
}): string {
  const co = opts.companyName.trim() || "—";
  const who = opts.employeeName.trim() || "—";
  const notes = (opts.absenceNotes ?? "").trim();
  const inner = `
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;font-weight:700;color:#0f172a;text-align:center;">
  New vacation request from ${escapeHtml(who)}
</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;text-align:left;">
  <strong>Dates:</strong> ${escapeHtml(opts.startDate)} → ${escapeHtml(opts.endDate)}<br/>
  ${notes ? `<strong>Details:</strong> ${escapeHtml(notes)}` : ""}
</p>
${ctaButton(opts.reviewUrl, "Review request")}
<p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;text-align:left;">
  Open MachinPro to approve or decline this request.
</p>
${standardFooterLine(co)}
`.trim();
  return emailOuterTable(emailCardFramed(inner));
}

export function buildFeedbackSupportEmailHtml(opts: {
  feedbackType: string;
  moduleLabel: string;
  companyLabel: string;
  userLabel: string;
  userId: string;
  pageUrl: string | null;
  feedbackId: string | null;
  message: string;
}): string {
  const rows: [string, string][] = [
    ["Type", opts.feedbackType],
    ["Module", opts.moduleLabel],
    ["Company", opts.companyLabel],
    ["User", opts.userLabel],
    ["User ID", opts.userId],
    ["Feedback ID", opts.feedbackId ?? "—"],
    ["Page / URL", opts.pageUrl ?? "—"],
    ["Message", opts.message],
  ];
  const tableRows = rows
    .map(
      ([k, v]) => `
<tr>
  <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a;width:28%;vertical-align:top;background:#f8fafc;">${escapeHtml(k)}</td>
  <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#334155;vertical-align:top;word-break:break-word;">${escapeHtml(v).replace(/\r?\n/g, "<br/>")}</td>
</tr>`
    )
    .join("");

  const inner = `
<h1 style="margin:0 0 16px;font-size:18px;line-height:1.35;font-weight:700;color:#0f172a;text-align:center;">
  MachinPro beta feedback
</h1>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 0 16px;">
  ${tableRows}
</table>
${standardFooterLine(opts.companyLabel)}
`.trim();
  return emailOuterTable(emailCardFramed(inner));
}
