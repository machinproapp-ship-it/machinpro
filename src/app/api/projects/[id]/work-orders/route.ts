import { NextRequest, NextResponse } from "next/server";
import { verifyCanManageEmployees, verifyCompanyMembership } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

async function loadProjectCompany(admin: ReturnType<typeof createSupabaseAdmin>, projectId: string) {
  if (!admin) return null;
  const { data, error } = await admin
    .from("projects")
    .select("id, company_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; company_id: string };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "project id required" }, { status: 400 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const proj = await loadProjectCompany(admin, projectId);
  if (!proj) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const ok = await verifyCompanyMembership(req, proj.company_id);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("work_order_items")
    .select(
      "id, company_id, project_id, catalog_item_id, name, unit, price_per_unit, category, assigned_employee_ids, is_active, created_at, updated_at"
    )
    .eq("project_id", projectId)
    .eq("company_id", proj.company_id)
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "project id required" }, { status: 400 });
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
    catalog_item_id?: string | null;
    assigned_employee_ids?: string[] | null;
  };
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const unit = typeof b.unit === "string" ? b.unit.trim() : "";
  const price = Number(b.price_per_unit);
  if (!name || !unit || !Number.isFinite(price)) {
    return NextResponse.json({ error: "name, unit, price_per_unit required" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const proj = await loadProjectCompany(admin, projectId);
  if (!proj) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const auth = await verifyCanManageEmployees(req, proj.company_id);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: dup } = await admin
    .from("work_order_items")
    .select("id")
    .eq("project_id", projectId)
    .eq("company_id", proj.company_id)
    .ilike("name", name)
    .eq("is_active", true)
    .maybeSingle();
  if (dup) {
    return NextResponse.json({ error: "duplicate_name" }, { status: 409 });
  }

  const category = typeof b.category === "string" ? b.category.trim() || null : null;
  const catalogId =
    typeof b.catalog_item_id === "string" && /^[0-9a-f-]{36}$/i.test(b.catalog_item_id)
      ? b.catalog_item_id
      : null;
  const assigned = Array.isArray(b.assigned_employee_ids)
    ? b.assigned_employee_ids.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x))
    : [];

  const { data, error } = await admin
    .from("work_order_items")
    .insert({
      company_id: proj.company_id,
      project_id: projectId,
      catalog_item_id: catalogId,
      name,
      unit,
      price_per_unit: price,
      category,
      assigned_employee_ids: assigned,
      is_active: true,
    })
    .select(
      "id, company_id, project_id, catalog_item_id, name, unit, price_per_unit, category, assigned_employee_ids, is_active, created_at, updated_at"
    )
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}
