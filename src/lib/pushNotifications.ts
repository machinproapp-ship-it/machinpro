/**
 * Cliente: permisos y suscripción Web Push (requiere VAPID público en env).
 */

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export async function subscribeToPush(params: {
  accessToken: string;
  companyId: string;
  subscription: PushSubscriptionJSON;
}): Promise<boolean> {
  const res = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      companyId: params.companyId,
      subscription: params.subscription,
    }),
  });
  return res.ok;
}

/** Crea suscripción en el SW y la guarda en Supabase vía API. */
export async function registerPushSubscription(params: {
  accessToken: string;
  companyId: string;
}): Promise<{ ok: boolean; reason?: "no_sw" | "no_vapid" | "denied" | "failed" }> {
  const vapid =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim();
  if (!vapid) return { ok: false, reason: "no_vapid" };
  const perm = await requestPushPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  if (!("serviceWorker" in navigator)) return { ok: false, reason: "no_sw" };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid),
  });
  const json = sub.toJSON();
  const ok = await subscribeToPush({
    accessToken: params.accessToken,
    companyId: params.companyId,
    subscription: json,
  });
  return ok ? { ok: true } : { ok: false, reason: "failed" };
}

export async function unsubscribeFromPush(params: {
  accessToken: string;
  endpoint: string;
}): Promise<boolean> {
  const res = await fetch("/api/notifications/subscribe", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({ endpoint: params.endpoint }),
  });
  return res.ok;
}
