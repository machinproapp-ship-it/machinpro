import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function sessionUserId(req: NextRequest): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { integration?: string; email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const integration = typeof body.integration === "string" ? body.integration.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!integration || !email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "server_config" }, { status: 500 });

  const { data: prof, error: pErr } = await admin
    .from("user_profiles")
    .select("company_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (pErr || !prof) return NextResponse.json({ error: "profile" }, { status: 403 });
  const companyId = (prof as { company_id?: string }).company_id;
  if (!companyId) return NextResponse.json({ error: "no_company" }, { status: 403 });
  const role = String((prof as { role?: string }).role ?? "");
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error: insErr } = await admin.from("integration_waitlist").insert({
    company_id: companyId,
    integration,
    email,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
