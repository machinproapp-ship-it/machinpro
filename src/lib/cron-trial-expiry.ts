import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTrialExpiryEmail } from "@/lib/email-trial-expiry";
import { insertNotificationRow } from "@/lib/notifications-server";
import { dispatchWebPushToUser } from "@/lib/push-dispatch";

const DEDUP_HOURS = 23;

function calendarDaysUntilTrialEnd(iso: string): number {
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return 999;
  const today = new Date();
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const startDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((endDay - startDay) / 86400000);
}

async function recentTrialNotificationExists(
  admin: SupabaseClient,
  companyId: string,
  userId: string,
  dedupeKey: string
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_HOURS * 3600000).toISOString();
  const { data, error } = await admin
    .from("notifications")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("type", "cron_trial_expiry")
    .gte("created_at", since)
    .filter("data->>dedupe", "eq", dedupeKey)
    .limit(1);
  if (error) return true;
  return (data?.length ?? 0) > 0;
}

async function notifyTrialUser(
  admin: SupabaseClient,
  companyId: string,
  userId: string,
  title: string,
  body: string,
  dedupeKey: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  if (await recentTrialNotificationExists(admin, companyId, userId, dedupeKey)) return false;
  const ins = await insertNotificationRow(admin, {
    company_id: companyId,
    user_id: userId,
    type: "cron_trial_expiry",
    title,
    body,
    data: { dedupe: dedupeKey, ...(data ?? {}) },
  });
  if (!ins.ok) return false;
  await dispatchWebPushToUser(admin, companyId, userId, { title, body, type: "cron_trial_expiry", url: "/pricing" });
  return true;
}

async function adminRecipients(
  admin: SupabaseClient,
  companyId: string
): Promise<{ id: string; email: string | null }[]> {
  const { data, error } = await admin
    .from("user_profiles")
    .select("id, email, role")
    .eq("company_id", companyId)
    .eq("role", "admin");
  if (error || !data?.length) return [];
  return (data as { id: string; email?: string | null }[]).map((r) => ({
    id: r.id,
    email: typeof r.email === "string" && r.email.includes("@") ? r.email.trim() : null,
  }));
}

async function companyName(admin: SupabaseClient, companyId: string): Promise<string | null> {
  const { data } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
  const row = data as { name?: string | null } | null;
  return row?.name?.trim() ?? null;
}

/**
 * Trial reminders: 7, 3, 1 days before end + day of expiry (in-app + email + web push).
 * Only for Stripe/`subscriptions` rows with status `trialing` and `trial_ends_at` set.
 */
export async function runTrialExpiryNotificationsForCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<{ created: number; emails: number; skipped: string[] }> {
  const skipped: string[] = [];
  let created = 0;
  let emails = 0;

  try {
    const { data: sub, error } = await admin
      .from("subscriptions")
      .select("status, trial_ends_at, plan, billing_period")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) {
      skipped.push(`subscription_query:${error.message}`);
      return { created, emails, skipped };
    }
    const row = sub as {
      status?: string;
      trial_ends_at?: string | null;
      plan?: string | null;
      billing_period?: string | null;
    } | null;
    if (!row || row.status !== "trialing" || !row.trial_ends_at) {
      return { created, emails, skipped };
    }

    const days = calendarDaysUntilTrialEnd(row.trial_ends_at);
    if (days !== 7 && days !== 3 && days !== 1 && days !== 0) {
      return { created, emails, skipped };
    }

    const coName = await companyName(admin, companyId);
    const recipients = await adminRecipients(admin, companyId);
    if (!recipients.length) {
      skipped.push("no_admins");
      return { created, emails, skipped };
    }

    const urgent = days === 1 || days === 0;
    const title =
      days === 0
        ? "Trial ended"
        : days === 1
          ? "Trial ends tomorrow"
          : `Trial ends in ${days} days`;
    const body =
      days === 0
        ? "Your MachinPro trial period has ended. Upgrade to keep full access."
        : `Your MachinPro trial ends in ${days === 1 ? "1 day" : `${days} days`}. Upgrade to keep access.`;

    const dedupe = `trial_${days}:${row.trial_ends_at.slice(0, 10)}`;

    for (const r of recipients) {
      const ok = await notifyTrialUser(admin, companyId, r.id, title, body, dedupe, {
        trial_days: days,
        trial_ends_at: row.trial_ends_at,
      });
      if (ok) created += 1;
    }

    for (const r of recipients) {
      if (!r.email) continue;
      const send = await sendTrialExpiryEmail({
        to: r.email,
        daysLeft: days,
        urgent,
        companyName: coName,
        planKey: row.plan,
        billingPeriod: row.billing_period,
      });
      if (send.ok) emails += 1;
    }
  } catch (e) {
    skipped.push(e instanceof Error ? e.message : String(e));
  }

  return { created, emails, skipped };
}
