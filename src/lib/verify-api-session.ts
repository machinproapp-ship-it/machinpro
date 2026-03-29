import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { RolePermissions } from "@/types/roles";

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

/** Mismo company + permiso de gestionar empleados (admin, supervisor con rol base, o custom_permissions). */
export async function verifyCanManageEmployees(
  req: NextRequest,
  companyId: string
): Promise<{ userId: string } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !companyId) return null;
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
  const { data } = await admin
    .from("user_profiles")
    .select("company_id, role, use_role_permissions, custom_permissions")
    .eq("id", user.id)
    .maybeSingle();
  const row = data as {
    company_id?: string | null;
    role?: string | null;
    use_role_permissions?: boolean | null;
    custom_permissions?: Partial<RolePermissions> | null;
  } | null;
  if (!row || row.company_id !== companyId) return null;
  if (row.role === "admin") return { userId: user.id };
  const inherit = row.use_role_permissions !== false;
  if (inherit && row.role === "supervisor") return { userId: user.id };
  if (!inherit && row.custom_permissions?.canManageEmployees === true) return { userId: user.id };
  return null;
}

/** Empresa coincidente y perfil con rol `admin` (configuración inicial / onboarding). */
export async function verifyCompanyAdmin(
  req: NextRequest,
  companyId: string
): Promise<{ userId: string } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !companyId) return null;
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
  const { data } = await admin
    .from("user_profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const row = data as { company_id?: string | null; role?: string | null } | null;
  if (!row || row.company_id !== companyId) return null;
  if (row.role !== "admin") return null;
  return { userId: user.id };
}

/** Misma empresa + permiso de gestionar roles (personalización del dashboard Central). */
export async function verifyCanManageRoles(
  req: NextRequest,
  companyId: string
): Promise<{ userId: string } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !companyId) return null;
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
  const { data } = await admin
    .from("user_profiles")
    .select("company_id, role, use_role_permissions, custom_permissions")
    .eq("id", user.id)
    .maybeSingle();
  const row = data as {
    company_id?: string | null;
    role?: string | null;
    use_role_permissions?: boolean | null;
    custom_permissions?: Partial<RolePermissions> | null;
  } | null;
  if (!row || row.company_id !== companyId) return null;
  if (row.role === "admin") return { userId: user.id };
  const inherit = row.use_role_permissions !== false;
  if (!inherit && row.custom_permissions?.canManageRoles === true) return { userId: user.id };
  return null;
}

/** JWT válido y perfil con `is_superadmin = true` (service role). */
export async function verifySuperadminAccess(
  req: NextRequest
): Promise<{ userId: string } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
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
  const { data } = await admin
    .from("user_profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  const row = data as { is_superadmin?: boolean } | null;
  if (row?.is_superadmin === true) return { userId: user.id };
  return null;
}
