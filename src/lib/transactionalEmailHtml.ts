import { escapeHtml } from "@/lib/invitationEmailHtml";
import {
  getTransactionalCopy,
  type TransactionalEmailLang,
} from "@/lib/emailTransactionalI18n";

function fill(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), escapeHtml(v));
  }
  return out;
}

export function buildWelcomeEmailHtml(opts: {
  userName: string;
  companyName: string;
  lang: TransactionalEmailLang;
  logoUrl: string;
  ctaUrl: string;
}): string {
  const c = getTransactionalCopy(opts.lang);
  const greeting = fill(c.welcomeGreeting, { name: opts.userName });
  const accountLine = fill(c.welcomeAccountLine, { company: opts.companyName });
  const bullets = [c.welcomeBulletEmployees, c.welcomeBulletProjects, c.welcomeBulletSchedules];
  const listItems = bullets
    .map(
      (text) =>
        `<li style="margin:6px 0;font-size:15px;line-height:1.5;color:#475569;">${escapeHtml(text)}</li>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.25);">
          <tr>
            <td style="padding:28px 28px 8px;text-align:center;background:linear-gradient(180deg,#134e5e 0%,#1a4f5e 100%);">
              <img src="${escapeHtml(opts.logoUrl)}" alt="" width="96" height="96" style="display:inline-block;object-fit:contain;" />
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 32px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">${greeting}</p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#475569;">${accountLine}</p>
              <p style="margin:16px 0 0;font-size:14px;font-weight:600;color:#334155;">${escapeHtml(c.welcomeSummaryIntro)}</p>
              <ul style="margin:8px 0 0;padding-left:20px;">
                ${listItems}
              </ul>
              <div style="margin:28px 0 0;text-align:center;">
                <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;padding:14px 28px;background:#d97706;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:12px;">${escapeHtml(c.welcomeCta)}</a>
              </div>
              <p style="margin:24px 0 0;font-size:13px;color:#64748b;text-align:center;">${escapeHtml(c.welcomeTrialReminder)}</p>
              <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;text-align:center;">${escapeHtml(c.welcomeFooter)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

export function buildEmployeeInviteEmailHtml(opts: {
  adminName: string;
  companyName: string;
  lang: TransactionalEmailLang;
  logoUrl: string;
  ctaUrl: string;
}): string {
  const c = getTransactionalCopy(opts.lang);
  const added = fill(c.employeeInviteAdded, {
    admin: opts.adminName,
    company: opts.companyName,
  });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.25);">
          <tr>
            <td style="padding:28px 28px 8px;text-align:center;background:linear-gradient(180deg,#134e5e 0%,#1a4f5e 100%);">
              <img src="${escapeHtml(opts.logoUrl)}" alt="" width="96" height="96" style="display:inline-block;object-fit:contain;" />
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 32px;">
              <p style="margin:0;font-size:16px;line-height:1.55;color:#475569;">${added}</p>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#475569;">${escapeHtml(c.employeeInviteBlurb)}</p>
              <div style="margin:28px 0 0;text-align:center;">
                <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;padding:14px 28px;background:#d97706;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:12px;">${escapeHtml(c.employeeInviteCta)}</a>
              </div>
              <p style="margin:24px 0 0;font-size:11px;color:#94a3b8;text-align:center;">${escapeHtml(c.employeeFooter)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

export function employeeInviteSubject(companyName: string, lang: TransactionalEmailLang): string {
  const c = getTransactionalCopy(lang);
  return fill(c.employeeInviteSubject, { company: companyName });
}
