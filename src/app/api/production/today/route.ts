import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyMembership } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }
  const auth = await verifyCompanyMembership(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const { data, error } = await admin
    .from("production_entries")
    .select("id, company_id, project_id, work_order_item_id, employee_id, date, units, amount, notes, created_at")
    .eq("company_id", companyId)
    .eq("employee_id", auth.userId)
    .eq("date", today);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ entries: data ?? [] });
}
