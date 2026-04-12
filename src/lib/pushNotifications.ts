/**
 * Envío de notificaciones web push (VAPID + tabla `push_subscriptions`).
 * Triggers de negocio (compliance, inventario, hazards, etc.) pueden llamar a estas funciones
 * desde rutas API con `PUSH_SEND_SECRET` o con sesión admin/supervisor.
 */

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function registerPushSubscription(params: {
  accessToken: string;
  companyId: string;
}): Promise<{ ok: boolean; reason?: "denied" | "config" | "network" }> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return { ok: false, reason: "config" };
  }
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapid) return { ok: false, reason: "config" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
    const res = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({ companyId: params.companyId, subscription: sub.toJSON() }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function unsubscribeFromPush(params: {
  accessToken: string;
  endpoint: string;
}): Promise<void> {
  await fetch("/api/notifications/subscribe", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({ endpoint: params.endpoint }),
  });
}

export type SendPushClientParams = {
  accessToken: string;
  companyId: string;
  title: string;
  body: string;
  url?: string;
  type?: string;
  targetUserId?: string;
};

export async function sendPushNotification(
  accessToken: string,
  companyId: string,
  title: string,
  body: string,
  url?: string,
  targetUserId?: string
): Promise<{ ok: boolean; sent?: number; failed?: number }> {
  return sendPushWithAuth({
    accessToken,
    companyId,
    title,
    body,
    url,
    targetUserId,
  });
}

export async function sendPushWithAuth(params: SendPushClientParams): Promise<{
  ok: boolean;
  sent?: number;
  failed?: number;
}> {
  const res = await fetch("/api/notifications/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      companyId: params.companyId,
      title: params.title,
      body: params.body,
      url: params.url ?? "/",
      type: params.type ?? "info",
      targetUserId: params.targetUserId,
    }),
  });
  if (!res.ok) return { ok: false };
  return (await res.json()) as { ok: boolean; sent?: number; failed?: number };
}

/** Llamada server-side (cron, Edge) con `x-push-secret`. */
export async function sendPushWithSecret(
  baseUrl: string,
  secret: string,
  payload: {
    companyId: string;
    title: string;
    body: string;
    url?: string;
    type?: string;
    targetUserId?: string;
  }
): Promise<{ ok: boolean; sent?: number; failed?: number }> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/notifications/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-push-secret": secret,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false };
  return (await res.json()) as { ok: boolean; sent?: number; failed?: number };
}
