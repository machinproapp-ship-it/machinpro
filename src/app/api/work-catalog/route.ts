import { NextRequest, NextResponse } from "next/server";
import { verifyCanManageEmployees, verifyCompanyMembership } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId")?.trim() ?? "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }
  const ok = await verifyCompanyMembership(req, companyId);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const { data, error } = await admin
    .from("work_catalog_items")
    .select("id, company_id, name, unit, price_per_unit, category, is_active, created_at, updated_at")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
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
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const unit = typeof b.unit === "string" ? b.unit.trim() : "";
  if (!companyId || !name || !unit) {
    return NextResponse.json({ error: "companyId, name, unit required" }, { status: 400 });
  }
  const auth = await verifyCanManageEmployees(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: dup } = await admin
    .from("work_catalog_items")
    .select("id")
    .eq("company_id", companyId)
    .ilike("name", name)
    .eq("is_active", true)
    .maybeSingle();
  if (dup) {
    return NextResponse.json({ error: "duplicate_name" }, { status: 409 });
  }

  const price =
    b.price_per_unit != null && Number.isFinite(Number(b.price_per_unit))
      ? Number(b.price_per_unit)
      : null;
  const category = typeof b.category === "string" ? b.category.trim() || null : null;

  const { data, error } = await admin
    .from("work_catalog_items")
    .insert({
      company_id: companyId,
      name,
      unit,
      category,
      price_per_unit: price,
      is_active: true,
    })
    .select("id, company_id, name, unit, price_per_unit, category, is_active, created_at, updated_at")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}
