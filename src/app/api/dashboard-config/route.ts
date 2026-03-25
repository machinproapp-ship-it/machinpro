import { NextRequest, NextResponse } from "next/server";
import { verifyCanManageRoles } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Persist Central dashboard layout (companies.dashboard_config).
 * Requires JWT + canManageRoles for the company.
 */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as { companyId?: string; dashboard_config?: unknown };
  const companyId = typeof b.companyId === "string" ? b.companyId.trim() : "";
  if (!companyId || b.dashboard_config === undefined) {
    return NextResponse.json({ error: "companyId and dashboard_config required" }, { status: 400 });
  }

  const auth = await verifyCanManageRoles(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { error } = await admin.from("companies").update({ dashboard_config: b.dashboard_config }).eq("id", companyId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
