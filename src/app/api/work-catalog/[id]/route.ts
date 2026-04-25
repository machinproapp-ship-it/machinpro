import { NextRequest, NextResponse } from "next/server";
import { verifyCanManageEmployees } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id: itemId } = await ctx.params;
  if (!itemId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as {
    companyId?: string;
    name?: string;
    unit?: string;
    category?: string | null;
    price_per_unit?: number | null;
  };
  const companyId = typeof b.companyId === "string" ? b.companyId.trim() : "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }
  const auth = await verifyCanManageEmployees(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === "string") patch.name = b.name.trim();
  if (typeof b.unit === "string") patch.unit = b.unit.trim();
  if (b.category !== undefined) patch.category = typeof b.category === "string" ? b.category.trim() || null : null;
  if (b.price_per_unit !== undefined) {
    patch.price_per_unit =
      b.price_per_unit != null && Number.isFinite(Number(b.price_per_unit))
        ? Number(b.price_per_unit)
        : null;
  }

  const { data, error } = await admin
    .from("work_catalog_items")
    .update(patch)
    .eq("id", itemId)
    .eq("company_id", companyId)
    .select("id, company_id, name, unit, price_per_unit, category, is_active, created_at, updated_at")
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
  const { id: itemId } = await ctx.params;
  if (!itemId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const companyId = req.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }
  const auth = await verifyCanManageEmployees(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const { error } = await admin
    .from("work_catalog_items")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("company_id", companyId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
