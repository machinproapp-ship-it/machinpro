import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

async function getUserFromBearer(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromBearer(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server_config" }, { status: 500 });
  }

  let body: { companyId?: string; subscription?: Record<string, unknown> & { endpoint?: string } };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { companyId, subscription } = body;
  const endpoint = typeof subscription?.endpoint === "string" ? subscription.endpoint : "";
  if (!companyId || !endpoint) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data: profile } = await admin
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  const row = profile as { company_id?: string } | null;
  if (!row || row.company_id !== companyId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", user.id);

  for (const s of (existing ?? []) as { id: string; subscription: { endpoint?: string } }[]) {
    if (s.subscription?.endpoint === endpoint) {
      await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }

  const { error } = await admin.from("push_subscriptions").insert({
    user_id: user.id,
    company_id: companyId,
    subscription,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromBearer(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server_config" }, { status: 500 });
  }
  let body: { endpoint?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data: rows } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", user.id);

  const list = (rows ?? []) as { id: string; subscription: { endpoint?: string } }[];
  const hit = list.find((r) => r.subscription?.endpoint === body.endpoint);
  if (hit) {
    await admin.from("push_subscriptions").delete().eq("id", hit.id);
  }
  return NextResponse.json({ ok: true });
}
