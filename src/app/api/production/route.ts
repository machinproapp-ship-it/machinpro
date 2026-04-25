import { NextRequest, NextResponse } from "next/server";
import { verifyCanManageEmployees, verifyCompanyMembership } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as {
    companyId?: string;
    work_order_item_id?: string;
    project_id?: string;
    date?: string;
    units?: number;
    amount?: number | null;
    employee_id?: string;
  };
  const companyId = typeof b.companyId === "string" ? b.companyId.trim() : "";
  const workOrderItemId = typeof b.work_order_item_id === "string" ? b.work_order_item_id.trim() : "";
  const projectId = typeof b.project_id === "string" ? b.project_id.trim() : "";
  const date = typeof b.date === "string" ? b.date.trim().slice(0, 10) : "";
  const units = Number(b.units);
  if (!companyId || !workOrderItemId || !projectId || !date || !Number.isFinite(units)) {
    return NextResponse.json({ error: "companyId, work_order_item_id, project_id, date, units required" }, { status: 400 });
  }

  const auth = await verifyCompanyMembership(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const targetEmployeeId =
    typeof b.employee_id === "string" && /^[0-9a-f-]{36}$/i.test(b.employee_id) ? b.employee_id : auth.userId;
  const canManage = !!(await verifyCanManageEmployees(req, companyId));
  if (targetEmployeeId !== auth.userId && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: woi, error: wErr } = await admin
    .from("work_order_items")
    .select("id, company_id, project_id, price_per_unit, assigned_employee_ids")
    .eq("id", workOrderItemId)
    .maybeSingle();
  if (wErr || !woi) {
    return NextResponse.json({ error: "Work order item not found" }, { status: 404 });
  }
  const row = woi as {
    company_id: string;
    project_id: string;
    price_per_unit: number;
    assigned_employee_ids: string[] | null;
  };
  if (row.company_id !== companyId || row.project_id !== projectId) {
    return NextResponse.json({ error: "Invalid item or project" }, { status: 400 });
  }
  const assigned = row.assigned_employee_ids ?? [];
  if (
    assigned.length > 0 &&
    !assigned.includes(targetEmployeeId) &&
    !canManage
  ) {
    return NextResponse.json({ error: "Not assigned to this line" }, { status: 403 });
  }

  const price = Number(row.price_per_unit);
  const amount =
    b.amount != null && Number.isFinite(Number(b.amount)) ? Number(b.amount) : units * price;

  const { data: existing, error: exErr } = await admin
    .from("production_entries")
    .select("id")
    .eq("company_id", companyId)
    .eq("work_order_item_id", workOrderItemId)
    .eq("employee_id", targetEmployeeId)
    .eq("date", date)
    .maybeSingle();
  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 500 });
  }

  const audit = async (entryId: string) => {
    const { data: prof } = await admin
      .from("user_profiles")
      .select("full_name, display_name, email")
      .eq("id", auth.userId)
      .maybeSingle();
    const p = prof as { full_name?: string | null; display_name?: string | null; email?: string | null } | null;
    const userName = (p?.full_name || p?.display_name || p?.email || auth.userId).trim();
    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: auth.userId,
      user_name: userName,
      action: "production_entry_saved",
      entity_type: "production_entry",
      entity_id: entryId,
      new_value: {
        work_order_item_id: workOrderItemId,
        employee_id: targetEmployeeId,
        date,
        units,
        amount,
      },
    });
  };

  if (existing?.id) {
    const eid = (existing as { id: string }).id;
    const { data: upd, error: uErr } = await admin
      .from("production_entries")
      .update({
        units,
        amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eid)
      .select("id, company_id, project_id, work_order_item_id, employee_id, date, units, amount")
      .maybeSingle();
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }
    await audit(eid);
    return NextResponse.json({ entry: upd, updated: true });
  }

  const { data: ins, error: iErr } = await admin
    .from("production_entries")
    .insert({
      company_id: companyId,
      project_id: projectId,
      work_order_item_id: workOrderItemId,
      employee_id: targetEmployeeId,
      date,
      units,
      amount,
    })
    .select("id, company_id, project_id, work_order_item_id, employee_id, date, units, amount")
    .maybeSingle();
  if (iErr) {
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }
  const insRow = ins as { id: string } | null;
  if (insRow?.id) await audit(insRow.id);
  return NextResponse.json({ entry: ins, updated: false });
}
