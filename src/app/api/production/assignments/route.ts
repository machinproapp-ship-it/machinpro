import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyMembership } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/** Líneas de orden de trabajo asignadas al usuario (para registro de producción). */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }
  const auth = await verifyCompanyMembership(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("work_order_items")
    .select("id, project_id, name, unit, price_per_unit, category, assigned_employee_ids")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .contains("assigned_employee_ids", [auth.userId]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}
