export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Superadmin invitation email — fixed English copy (no i18n keys).
 * Preserves layout: logo header, white card, orange CTA.
 */
export function buildInvitationEmailHtml(opts: {
  companyName: string;
  inviterName: string;
  planLabel: string;
  message: string | null;
  ctaUrl: string;
  logoUrl: string;
}): string {
  const company = escapeHtml(opts.companyName.trim() || "—");
  const inviter = escapeHtml(opts.inviterName.trim() || "MachinPro");
  const plan = escapeHtml(opts.planLabel.trim());
  const msgBlock =
    opts.message && opts.message.trim()
      ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.5;color:#334155;">${escapeHtml(opts.message.trim())}</p>`
      : "";
  const planBlock = plan
    ? `<p style="margin:12px 0 0;font-size:14px;color:#64748b;">Assigned plan: <strong>${plan}</strong></p>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
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
              <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">You've been invited to join ${company} on MachinPro</p>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:#475569;">${inviter} has invited you to manage ${company} on MachinPro.</p>
              ${planBlock}
              ${msgBlock}
              <div style="margin:28px 0 0;text-align:center;">
                <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;padding:14px 28px;background:#d97706;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:12px;">Accept Invitation</a>
              </div>
              <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;">This link expires in 7 days.</p>
              <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Need help? Contact us at <a href="mailto:support@machin.pro" style="color:#64748b;">support@machin.pro</a></p>
              <p style="margin:20px 0 0;font-size:11px;color:#cbd5e1;text-align:center;">MachinPro · ${company}</p>
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
