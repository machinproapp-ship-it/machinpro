export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildInvitationEmailHtml(opts: {
  companyName: string;
  planLabel: string;
  message: string | null;
  ctaUrl: string;
  logoUrl: string;
  introLine: string;
  planLinePrefix: string;
  ctaLabel: string;
  expiryLine: string;
}): string {
  const msgBlock =
    opts.message && opts.message.trim()
      ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.5;color:#334155;">${escapeHtml(opts.message.trim())}</p>`
      : "";
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
              <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(opts.introLine)}</p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#475569;">
                <strong>${escapeHtml(opts.companyName)}</strong>
              </p>
              <p style="margin:8px 0 0;font-size:14px;color:#64748b;">${escapeHtml(opts.planLinePrefix)} <strong>${escapeHtml(opts.planLabel)}</strong></p>
              ${msgBlock}
              <div style="margin:28px 0 0;text-align:center;">
                <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;padding:14px 28px;background:#d97706;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:12px;">${escapeHtml(opts.ctaLabel)}</a>
              </div>
              <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;">${escapeHtml(opts.expiryLine)}</p>
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
