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
<html lang="und">
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

/** Inner card: max-width 600px, white, 8px radius (table for Outlook). */
function emailCard(inner: string): string {
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
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

function stepRow(href: string, label: string, hint: string): string {
  return `
<tr>
  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
    <a href="${escapeHtml(href)}" style="font-size:15px;font-weight:600;color:#f97316;text-decoration:none;">
      ${escapeHtml(label)}
    </a>
    <span style="font-size:14px;color:#64748b;"> — ${escapeHtml(hint)}</span>
  </td>
</tr>
`.trim();
}

export function buildWelcomeEmailHtml(opts: {
  userName: string;
  companyName: string;
  lang: TransactionalEmailLang;
}): string {
  const c = getTransactionalCopy(opts.lang);
  const name = opts.userName.trim() || "—";
  const company = opts.companyName.trim() || "—";
  const title = fillHtml(c.welcomeTitle, { name });
  const subtitle = escapeHtml(c.welcomeSubtitle);
  const warm = fillHtml(c.welcomeWarm, { company });
  const intro = escapeHtml(c.welcomeStepsIntro);
  const origin = MACHINPRO_EMAIL_ORIGIN;
  const step1 = `${origin}/?utm_source=email&utm_medium=welcome&utm_campaign=step_company`;
  const step2 = `${origin}/?utm_source=email&utm_medium=welcome&utm_campaign=step_team`;
  const step3 = `${origin}/?utm_source=email&utm_medium=welcome&utm_campaign=step_project`;

  const inner = `
<div style="text-align:center;margin-bottom:8px;">
  <img src="${escapeHtml(MACHINPRO_LOGO_URL)}" width="120" height="" alt="MachinPro" style="display:inline-block;height:auto;max-width:120px;border:0;outline:none;" />
</div>
<h1 style="margin:20px 0 8px;font-size:22px;line-height:1.35;font-weight:700;color:#0f172a;text-align:center;">
  ${title}
</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#64748b;text-align:center;">
  ${subtitle}
</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;text-align:left;">
  ${warm}
</p>
<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f172a;text-align:left;">
  ${intro}
</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;">
  ${stepRow(step1, c.welcomeStep1, c.welcomeStep1Hint)}
  ${stepRow(step2, c.welcomeStep2, c.welcomeStep2Hint)}
  ${stepRow(step3, c.welcomeStep3, c.welcomeStep3Hint)}
</table>
${ctaButton(MACHINPRO_LOGIN_URL, c.welcomeCta)}
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">
  ${escapeHtml(c.welcomeTrialReminder)}
</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
  <tr>
    <td style="border-top:1px solid #e2e8f0;padding-top:20px;">
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">
        ${escapeHtml(c.welcomeHelp)}
      </p>
      <p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
        ${escapeHtml(c.welcomeAddressLine)}
      </p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
        <a href="${escapeHtml(MACHINPRO_PRIVACY_URL)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(c.welcomePrivacy)}</a>
        <span style="color:#cbd5e1;"> · </span>
        <a href="${escapeHtml(MACHINPRO_TERMS_URL)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(c.welcomeTerms)}</a>
      </p>
    </td>
  </tr>
</table>
`.trim();

  return emailOuterTable(emailCard(inner));
}

export function buildWelcomeEmailSubject(name: string, lang: TransactionalEmailLang): string {
  const c = getTransactionalCopy(lang);
  const n = name.trim() || "—";
  return fillPlain(c.welcomeEmailSubject, { name: n });
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
<div style="text-align:center;margin-bottom:8px;">
  <img src="${escapeHtml(MACHINPRO_LOGO_URL)}" width="120" height="" alt="MachinPro" style="display:inline-block;height:auto;max-width:120px;border:0;outline:none;" />
</div>
<h1 style="margin:20px 0 16px;font-size:20px;line-height:1.35;font-weight:700;color:#0f172a;text-align:center;">
  ${title}
</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;text-align:left;">
  ${lead}
</p>
${ctaButton(opts.ctaUrl, c.employeeInviteCta)}
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">
  ${escapeHtml(c.employeeInviteExpiry)}
</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
  <tr>
    <td style="border-top:1px solid #e2e8f0;padding-top:20px;">
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748b;text-align:center;">
        ${escapeHtml(c.employeeHelp)}
      </p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
        ${escapeHtml(c.employeeFooterLine)}
      </p>
    </td>
  </tr>
</table>
`.trim();

  return emailOuterTable(emailCard(inner));
}

export function employeeInviteSubject(companyName: string, lang: TransactionalEmailLang): string {
  const c = getTransactionalCopy(lang);
  return fillPlain(c.employeeInviteSubject, { company: companyName });
}
