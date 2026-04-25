import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyMembership } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/** Resumen de producción por empresa y rango de fechas (hojas de horas / export). */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  const from = req.nextUrl.searchParams.get("from")?.trim().slice(0, 10) ?? "";
  const to = req.nextUrl.searchParams.get("to")?.trim().slice(0, 10) ?? "";
  if (!companyId || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "companyId, from, to (YMD) required" }, { status: 400 });
  }
  const auth = await verifyCompanyMembership(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  const { data: raw, error } = await admin
    .from("production_entries")
    .select("employee_id, date, work_order_item_id, units, amount")
    .eq("company_id", companyId)
    .gte("date", lo)
    .lte("date", hi);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (raw ?? []) as {
    employee_id: string;
    date: string;
    work_order_item_id: string;
    units: number;
    amount: number | null;
  }[];
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
  const entries = rows.map((r) => ({
    ...r,
    concept_name: im.get(r.work_order_item_id)?.name ?? "",
    concept_unit: im.get(r.work_order_item_id)?.unit ?? "",
  }));
  return NextResponse.json({ entries });
}
