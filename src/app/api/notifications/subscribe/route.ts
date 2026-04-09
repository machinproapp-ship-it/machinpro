import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

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

function keysFromSubscription(sub: Record<string, unknown> | undefined): {
  endpoint: string;
  p256dh: string;
  auth: string;
} | null {
  if (!sub || typeof sub !== "object") return null;
  const endpoint = typeof sub.endpoint === "string" ? sub.endpoint.trim() : "";
  const keys = sub.keys as Record<string, unknown> | undefined;
  const p256dh = keys && typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = keys && typeof keys.auth === "string" ? keys.auth.trim() : "";
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
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

  let body: { companyId?: string; subscription?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const parsed = keysFromSubscription(body.subscription);
  if (!companyId || !parsed) {
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
    .select("id, endpoint, subscription")
    .eq("user_id", user.id);

  for (const s of (existing ?? []) as {
    id: string;
    endpoint?: string | null;
    subscription?: { endpoint?: string };
  }[]) {
    const ep = s.endpoint || s.subscription?.endpoint;
    if (ep === parsed.endpoint) {
      await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    company_id: companyId,
    endpoint: parsed.endpoint,
    p256dh: parsed.p256dh,
    auth: parsed.auth,
  };

  let { error } = await admin.from("push_subscriptions").insert(insertRow);

  const missingCol =
    error &&
    (error.code === "42703" || /column .* does not exist/i.test(error.message ?? ""));

  if (missingCol) {
    const { error: legacyErr } = await admin.from("push_subscriptions").insert({
      user_id: user.id,
      company_id: companyId,
      subscription: body.subscription,
    });
    if (legacyErr) {
      return NextResponse.json({ error: legacyErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, legacy: true });
  }

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
    .select("id, endpoint, subscription")
    .eq("user_id", user.id);

  const list = (rows ?? []) as {
    id: string;
    endpoint?: string | null;
    subscription?: { endpoint?: string };
  }[];
  const hit = list.find((r) => r.endpoint === body.endpoint || r.subscription?.endpoint === body.endpoint);
  if (hit) {
    await admin.from("push_subscriptions").delete().eq("id", hit.id);
  }
  return NextResponse.json({ ok: true });
}
