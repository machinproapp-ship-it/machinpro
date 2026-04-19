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
    .limit(10);

  const { count: projectCount } = await admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  let docCount = 0;
  const dc = await admin.from("employee_documents").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  if (!dc.error && typeof dc.count === "number") docCount = dc.count;

  return NextResponse.json({
    company,
    subscription: sub,
    users: users ?? [],
    audits: audits ?? [],
    metrics: {
      projects: typeof projectCount === "number" ? projectCount : 0,
      employeeDocuments: docCount,
      employees: Array.isArray(users) ? users.length : 0,
      storage_gb:
        company && typeof company === "object" && company !== null && "storage_used_gb" in company
          ? (company as { storage_used_gb?: number | null }).storage_used_gb ?? null
          : null,
    },
  });
}
