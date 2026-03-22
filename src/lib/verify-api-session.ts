import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Verifica Bearer JWT y que el perfil tenga el mismo companyId que el cuerpo.
 */
export async function verifyCompanyAccess(
  req: NextRequest,
  companyId: string
): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return false;
  const admin = createSupabaseAdmin();
  if (!admin) return false;
  const { data } = await admin.from("user_profiles").select("company_id").eq("id", user.id).maybeSingle();
  return data?.company_id === companyId;
}
