import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type NotificationRow = {
  id: string;
  company_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
};

export function getBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return raw || null;
}

export async function getSessionUserAndCompany(
  req: NextRequest
): Promise<{ userId: string; companyId: string } | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const admin = createSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin.from("user_profiles").select("company_id").eq("id", user.id).maybeSingle();
  const row = data as { company_id?: string | null } | null;
  const companyId = row?.company_id != null ? String(row.company_id) : "";
  if (!companyId) return null;
  return { userId: user.id, companyId };
}

export async function verifyInternalSecret(req: NextRequest): Promise<boolean> {
  const secret = process.env.MACHINPRO_NOTIFICATIONS_INTERNAL_SECRET?.trim();
  if (!secret) return false;
  const h = req.headers.get("x-internal-secret")?.trim();
  return h === secret;
}

/** Resuelve perfil auth UUID o user_profiles.employee_id (texto) al id de auth. */
export async function resolveTargetUserId(
  admin: SupabaseClient,
  companyId: string,
  targetKey: string
): Promise<string | null> {
  const key = targetKey.trim();
  if (!key) return null;
  const { data: direct } = await admin
    .from("user_profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", key)
    .maybeSingle();
  if (direct && (direct as { id?: string }).id) return String((direct as { id: string }).id);
  const { data: byEmp } = await admin
    .from("user_profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("employee_id", key)
    .maybeSingle();
  if (byEmp && (byEmp as { id?: string }).id) return String((byEmp as { id: string }).id);
  return null;
}

export async function insertNotificationRow(
  admin: SupabaseClient,
  row: {
    company_id: string;
    user_id: string;
    type: string;
    title: string;
    body?: string | null;
    data?: Record<string, unknown>;
    expires_at?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("notifications")
    .insert({
      company_id: row.company_id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body ?? null,
      data: row.data ?? {},
      expires_at: row.expires_at ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const id = (data as { id?: string })?.id;
  if (!id) return { ok: false, error: "No id" };
  return { ok: true, id };
}
