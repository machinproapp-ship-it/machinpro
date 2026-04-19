import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { PaidPlanKey } from "@/lib/stripe";
function appOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "").trim();
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

async function adminEmailsForCompany(companyId: string): Promise<string[]> {
  const admin = createSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("user_profiles")
    .select("email, role")
    .eq("company_id", companyId)
    .eq("role", "admin");
  if (error || !data?.length) return [];
  const out: string[] = [];
  for (const row of data as { email?: string | null }[]) {
    const e = typeof row.email === "string" ? row.email.trim() : "";
    if (e && e.includes("@")) out.push(e);
  }
  return [...new Set(out)];
}

export async function sendInvoicePaymentFailedEmail(opts: {
  companyId: string;
  amountDue?: string | null;
  hostedInvoiceUrl?: string | null;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[stripe-webhook-emails] RESEND_API_KEY missing");
    return;
  }
  const recipients = await adminEmailsForCompany(opts.companyId);
  if (!recipients.length) return;
  const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
  const billingUrl = `${appOrigin()}/pricing`;
  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b;">
  <p><strong>Payment failed</strong> for your MachinPro subscription.</p>
  ${opts.amountDue ? `<p>Amount due: ${escapeHtml(opts.amountDue)}</p>` : ""}
  <p>Please update your payment method in the billing portal so your team keeps uninterrupted access.</p>
  ${opts.hostedInvoiceUrl ? `<p><a href="${opts.hostedInvoiceUrl}">View invoice</a></p>` : ""}
  <p><a href="${billingUrl}" style="color:#f97316;font-weight:600;">Open billing &amp; plans</a></p>
</body></html>`;
  try {
    const resend = new Resend(key);
    for (const to of recipients) {
      await resend.emails.send({
        from,
        to,
        replyTo: "support@machin.pro",
        subject: "MachinPro — payment failed",
        html,
      });
    }
  } catch (e) {
    console.error("[stripe-webhook-emails] payment_failed", e);
  }
}

export async function sendSubscriptionConfirmationEmail(opts: {
  companyId: string;
  planKey: PaidPlanKey;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const recipients = await adminEmailsForCompany(opts.companyId);
  if (!recipients.length) return;
  const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
  const dash = `${appOrigin()}/`;
  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b;">
  <p><strong>Thank you — your MachinPro subscription is active.</strong></p>
  <p>Plan: <strong>${escapeHtml(opts.planKey)}</strong></p>
  <p><a href="${dash}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;">Go to dashboard</a></p>
</body></html>`;
  try {
    const resend = new Resend(key);
    for (const to of recipients) {
      await resend.emails.send({
        from,
        to,
        replyTo: "support@machin.pro",
        subject: "MachinPro — subscription confirmed",
        html,
      });
    }
  } catch (e) {
    console.error("[stripe-webhook-emails] confirmation", e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
