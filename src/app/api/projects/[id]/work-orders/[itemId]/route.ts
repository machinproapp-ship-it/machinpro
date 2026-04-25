import { NextRequest, NextResponse } from "next/server";
import { verifyCanManageEmployees } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id: projectId, itemId } = await ctx.params;
  if (!projectId || !itemId) {
    return NextResponse.json({ error: "project id and itemId required" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as {
    name?: string;
    unit?: string;
    price_per_unit?: number;
    category?: string | null;
    assigned_employee_ids?: string[] | null;
  };

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
  const auth = await verifyCanManageEmployees(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === "string") patch.name = b.name.trim();
  if (typeof b.unit === "string") patch.unit = b.unit.trim();
  if (b.price_per_unit !== undefined && Number.isFinite(Number(b.price_per_unit))) {
    patch.price_per_unit = Number(b.price_per_unit);
  }
  if (b.category !== undefined) {
    patch.category = typeof b.category === "string" ? b.category.trim() || null : null;
  }
  if (b.assigned_employee_ids !== undefined) {
    patch.assigned_employee_ids = Array.isArray(b.assigned_employee_ids)
      ? b.assigned_employee_ids.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x))
      : [];
  }

  const { data, error } = await admin
    .from("work_order_items")
    .update(patch)
    .eq("id", itemId)
    .eq("project_id", projectId)
    .eq("company_id", companyId)
    .select(
      "id, company_id, project_id, catalog_item_id, name, unit, price_per_unit, category, assigned_employee_ids, is_active, created_at, updated_at"
    )
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id: projectId, itemId } = await ctx.params;
  if (!projectId || !itemId) {
    return NextResponse.json({ error: "project id and itemId required" }, { status: 400 });
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
  const auth = await verifyCanManageEmployees(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("work_order_items")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("project_id", projectId)
    .eq("company_id", companyId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
