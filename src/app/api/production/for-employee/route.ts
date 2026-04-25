import { NextRequest, NextResponse } from "next/server";
import { verifyCanManageEmployees, verifyCompanyMembership } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/** Producción de un empleado (perfil) — admin o el propio usuario. */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim() ?? "";
  if (!companyId || !employeeId) {
    return NextResponse.json({ error: "companyId and employeeId required" }, { status: 400 });
  }
  const member = await verifyCompanyMembership(req, companyId);
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canManage = await verifyCanManageEmployees(req, companyId);
  if (member.userId !== employeeId && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const { data: raw, error } = await admin
    .from("production_entries")
    .select("id, date, work_order_item_id, units, amount, project_id")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .order("date", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  type RawEntry = {
    id: string;
    date: string;
    work_order_item_id: string;
    units: number;
    amount: number | null;
    project_id?: string;
  };
  const rows = (raw ?? []) as RawEntry[];
  const itemIds = [...new Set(rows.map((r) => r.work_order_item_id))];
  const { data: items } =
    itemIds.length > 0
      ? await admin
          .from("work_order_items")
          .select("id, name, unit")
          .in("id", itemIds)
          .eq("company_id", companyId)
      : { data: [] as { id: string; name: string; unit: string }[] };
  const im = new Map((items ?? []).map((i) => [i.id, i]));
  const entries = rows.map((r) => {
    const w = im.get(r.work_order_item_id);
    return { ...r, concept_name: w?.name ?? "", concept_unit: w?.unit ?? "" };
  });
  let monthTotal = 0;
  for (const r of entries) {
    if (r.date >= monthStart) {
      monthTotal += Number(r.amount) || 0;
    }
  }
  return NextResponse.json({ entries, monthTotal });
}
