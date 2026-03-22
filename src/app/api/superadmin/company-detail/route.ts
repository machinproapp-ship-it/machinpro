import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperadminAccess } from "@/lib/verify-api-session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await verifySuperadminAccess(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: company } = await admin.from("companies").select("*").eq("id", companyId).maybeSingle();
  const { data: sub } = await admin.from("subscriptions").select("*").eq("company_id", companyId).maybeSingle();
  const { data: users } = await admin
    .from("user_profiles")
    .select("id, role, employee_id, full_name, display_name")
    .eq("company_id", companyId);
  const { data: audits } = await admin
    .from("audit_logs")
    .select("id, action, user_name, created_at, entity_type, entity_id, new_value, old_value")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(80);

  return NextResponse.json({
    company,
    subscription: sub,
    users: users ?? [],
    audits: audits ?? [],
  });
}
