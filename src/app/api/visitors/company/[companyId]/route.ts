import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await ctx.params;
  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("companies")
    .select("id, name, country_code")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const row = data as { id: string; name: string; country_code?: string | null };
  return NextResponse.json({
    id: row.id,
    name: row.name,
    countryCode: typeof row.country_code === "string" && row.country_code.trim() ? row.country_code.trim() : "CA",
  });
}
