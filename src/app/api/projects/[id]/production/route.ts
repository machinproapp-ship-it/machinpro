import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyMembership } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Resumen de production_entries del proyecto (unidades y importe por fecha y concepto).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "project id required" }, { status: 400 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const { data: proj, error: pErr } = await admin
    .from("projects")
    .select("company_id")
    .eq("id", projectId)
    .maybeSingle();
  if (pErr || !proj) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const companyId = (proj as { company_id: string }).company_id;
  const ok = await verifyCompanyMembership(req, companyId);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: entries, error: eErr } = await admin
    .from("production_entries")
    .select("id, date, units, amount, employee_id, work_order_item_id")
    .eq("project_id", projectId)
    .eq("company_id", companyId);
  if (eErr) {
    return NextResponse.json({ error: eErr.message }, { status: 500 });
  }

  const itemIds = [...new Set((entries ?? []).map((e: { work_order_item_id: string }) => e.work_order_item_id))];
  const { data: items } =
    itemIds.length > 0
      ? await admin
          .from("work_order_items")
          .select("id, name, unit, price_per_unit")
          .in("id", itemIds)
          .eq("company_id", companyId)
      : { data: [] as { id: string; name: string; unit: string; price_per_unit: number }[] };

  const itemMap = new Map((items ?? []).map((i) => [i.id, i]));

  type Row = {
    id: string;
    date: string;
    units: number;
    amount: number | null;
    employee_id: string;
    work_order_item_id: string;
  };

  const rows = (entries ?? []) as unknown as Row[];
  const byKey = new Map<
    string,
    { date: string; work_order_item_id: string; name: string; unit: string; units: number; amount: number }
  >();
  for (const r of rows) {
    const w = itemMap.get(r.work_order_item_id);
    const name = w?.name ?? "";
    const unit = w?.unit ?? "";
    const p = Number(w?.price_per_unit ?? 0);
    const key = `${r.date}|${r.work_order_item_id}`;
    const prev = byKey.get(key);
    const u = Number(r.units) || 0;
    const amt =
      r.amount != null && Number.isFinite(Number(r.amount)) ? Number(r.amount) : u * p;
    if (prev) {
      prev.units += u;
      prev.amount += amt;
    } else {
      byKey.set(key, {
        date: r.date,
        work_order_item_id: r.work_order_item_id,
        name,
        unit,
        units: u,
        amount: amt,
      });
    }
  }

  return NextResponse.json({ rows: Array.from(byKey.values()) });
}
