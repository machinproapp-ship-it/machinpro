import { supabase } from "@/lib/supabase";

/** Solicita al servidor enviar push a la empresa (requiere sesión admin/supervisor). */
export async function requestCompanyPushNotification(body: {
  companyId: string;
  title: string;
  body: string;
  url?: string;
  type?: string;
}): Promise<void> {
  if (typeof window === "undefined" || !supabase) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  try {
    await fetch("/api/notifications/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    /* ignore */
  }
}
