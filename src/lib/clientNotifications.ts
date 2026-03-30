import type { SupabaseClient } from "@supabase/supabase-js";

export async function postAppNotification(
  supabase: SupabaseClient | null,
  payload: {
    companyId: string;
    targetUserId?: string;
    targetEmployeeKey?: string;
    type: string;
    title: string;
    body?: string | null;
    data?: Record<string, unknown>;
    expires_at?: string | null;
  }
): Promise<boolean> {
  if (!supabase) return false;
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return false;
  try {
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
