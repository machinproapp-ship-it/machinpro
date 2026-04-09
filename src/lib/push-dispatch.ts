import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { configureWebPush } from "@/lib/web-push-config";

type SubRow = {
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  subscription?: webpush.PushSubscription | null;
};

function rowToSubscription(row: SubRow): webpush.PushSubscription | null {
  const ep = row.endpoint?.trim() || row.subscription?.endpoint;
  if (!ep) return null;
  const p256 =
    row.p256dh?.trim() ||
    (row.subscription?.keys && typeof row.subscription.keys.p256dh === "string"
      ? row.subscription.keys.p256dh
      : "");
  const au =
    row.auth?.trim() ||
    (row.subscription?.keys && typeof row.subscription.keys.auth === "string" ? row.subscription.keys.auth : "");
  if (p256 && au) {
    return { endpoint: ep, keys: { p256dh: p256, auth: au } };
  }
  if (row.subscription && row.subscription.endpoint && row.subscription.keys?.p256dh && row.subscription.keys?.auth) {
    return row.subscription as webpush.PushSubscription;
  }
  return null;
}

/**
 * Sends a Web Push payload to all subscriptions for the given user in the company.
 */
export async function dispatchWebPushToUser(
  admin: SupabaseClient,
  companyId: string,
  userId: string,
  payload: { title: string; body: string; url?: string; type?: string }
): Promise<{ sent: number; failed: number }> {
  if (!configureWebPush()) return { sent: 0, failed: 0 };

  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, subscription")
    .eq("company_id", companyId)
    .eq("user_id", userId);

  if (error || !rows?.length) return { sent: 0, failed: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    type: payload.type ?? "info",
  });

  let sent = 0;
  let failed = 0;
  for (const raw of rows as SubRow[]) {
    const sub = rowToSubscription(raw);
    if (!sub?.endpoint) continue;
    try {
      await webpush.sendNotification(sub, body, { TTL: 120 });
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}
