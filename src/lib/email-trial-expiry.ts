import { Resend } from "resend";
import { buildPricingUpgradeUrl } from "@/lib/pricingUrls";

function appOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "").trim();
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function trialExpiryPricingHref(planKey: string | null | undefined, billingPeriod: string | null | undefined): string {
  return buildPricingUpgradeUrl({ origin: appOrigin(), planKey, billingPeriod });
}

export async function sendTrialExpiryEmail(opts: {
  to: string;
  daysLeft: number;
  urgent?: boolean;
  companyName?: string | null;
  planKey?: string | null;
  billingPeriod?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email-trial-expiry] RESEND_API_KEY missing");
    return { ok: false, error: "no_resend" };
  }
  const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
  const upgradeUrl = trialExpiryPricingHref(opts.planKey, opts.billingPeriod);
  const subject =
    opts.daysLeft <= 0
      ? "Your MachinPro trial has ended — upgrade to keep access"
      : opts.urgent
        ? `Your MachinPro trial expires tomorrow`
        : `Your MachinPro trial expires in ${opts.daysLeft} days`;
  const safeCo = opts.companyName?.trim() || "your company";
  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b;">
  <p>Hi,</p>
  <p>${opts.daysLeft <= 0 ? `The trial period for <strong>${escapeHtml(safeCo)}</strong> on MachinPro has ended.` : opts.urgent ? `Your MachinPro trial for <strong>${escapeHtml(safeCo)}</strong> ends tomorrow.` : `Your MachinPro trial for <strong>${escapeHtml(safeCo)}</strong> ends in <strong>${opts.daysLeft}</strong> days.`}</p>
  <p>Keep your projects, compliance, team, and operations running without interruption.</p>
  <p style="margin:24px 0;">
    <a href="${upgradeUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;">Upgrade now</a>
  </p>
  <p style="font-size:13px;color:#71717a;">If the button does not work, copy this link:<br/><a href="${upgradeUrl}">${upgradeUrl}</a></p>
</body></html>`;
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from,
      to: opts.to,
      replyTo: "support@machin.pro",
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
