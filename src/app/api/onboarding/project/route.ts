import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { verifyCompanyAdmin } from "@/lib/verify-api-session";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    companyId?: string;
    name?: string;
    location?: string;
    estimated_start?: string | null;
    type?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!companyId || !name) {
    return NextResponse.json({ error: "companyId and name required" }, { status: 400 });
  }

  const auth = await verifyCompanyAdmin(req, companyId);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const location = typeof body.location === "string" ? body.location.trim() : "";
  const est =
    typeof body.estimated_start === "string" && body.estimated_start.trim()
      ? body.estimated_start.trim()
      : null;

  const id = randomUUID();
  const typeRaw = typeof body.type === "string" ? body.type.trim().toLowerCase() : "";
  const type =
    typeRaw === "commercial" ||
    typeRaw === "industrial" ||
    typeRaw === "infrastructure" ||
    typeRaw === "other"
      ? typeRaw
      : "residential";
  const row = {
    id,
    company_id: companyId,
    name,
    type,
    location,
    budget_cad: 0,
    spent_cad: 0,
    estimated_start: est,
    estimated_end: null,
    archived: false,
    assigned_employee_ids: [] as string[],
  };

  const { error } = await admin.from("projects").insert(row);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
