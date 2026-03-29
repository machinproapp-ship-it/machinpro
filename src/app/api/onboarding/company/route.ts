import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyAdmin } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  let body: {
    companyId?: string;
    name?: string;
    country?: string;
    currency?: string;
    language?: string;
    logo_url?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const auth = await verifyCompanyAdmin(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.country === "string" && body.country.trim()) patch.country = body.country.trim();
  if (typeof body.currency === "string" && body.currency.trim()) patch.currency = body.currency.trim();
  if (typeof body.language === "string" && body.language.trim()) patch.language = body.language.trim();
  if (typeof body.logo_url === "string" && body.logo_url.trim()) patch.logo_url = body.logo_url.trim();
  if (body.logo_url === null) patch.logo_url = null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { error } = await admin.from("companies").update(patch).eq("id", companyId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
