import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchWebPushToUser } from "@/lib/push-dispatch";

/**
 * AH-17 — Web Push a un usuario (solo servidor: API routes, cron, libs sin import en cliente).
 * No importar desde `pushNotifications.ts` ni componentes para evitar bundlear `web-push` en el cliente.
 */
export async function sendPushToUser(
  admin: SupabaseClient,
  companyId: string,
  userId: string,
  payload: { title: string; body: string; url?: string; type?: string }
): Promise<{ sent: number; failed: number }> {
  return dispatchWebPushToUser(admin, companyId, userId, payload);
}
