import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { configureWebPush } from "@/lib/web-push-config";

export const runtime = "nodejs";

type SubRow = {
  user_id?: string;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  subscription?: webpush.PushSubscription | null;
};

function rowToSubscription(row: SubRow): webpush.PushSubscription | null {
  const ep = row.endpoint?.trim() || row.subscription?.endpoint;
  if (!ep) return null;
  const p256 =
    row.p256dh?.trim() ||
    (row.subscription?.keys && typeof row.subscription.keys.p256dh === "string"
      ? row.subscription.keys.p256dh
      : "");
  const au =
    row.auth?.trim() ||
    (row.subscription?.keys && typeof row.subscription.keys.auth === "string" ? row.subscription.keys.auth : "");
  if (p256 && au) {
    return { endpoint: ep, keys: { p256dh: p256, auth: au } };
  }
  if (row.subscription?.endpoint && row.subscription.keys?.p256dh && row.subscription.keys?.auth) {
    return row.subscription as webpush.PushSubscription;
  }
  return null;
}

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
  const secret = req.headers.get("x-push-secret");
  const allowSecret = secret && secret === process.env.PUSH_SEND_SECRET;

  let body: {
    companyId?: string;
    title?: string;
    body?: string;
    url?: string;
    type?: string;
    targetUserId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { companyId, title, body: textBody, url, type, targetUserId } = body;
  if (!companyId || !title || !textBody) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server_config" }, { status: 500 });
  }

  if (!allowSecret) {
    const user = await getUserFromBearer(req);
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { data: profile } = await admin
      .from("user_profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .maybeSingle();
    const p = profile as { company_id?: string; role?: string } | null;
    if (!p || p.company_id !== companyId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (p.role !== "admin" && p.role !== "supervisor") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  if (!configureWebPush()) {
    return NextResponse.json({ error: "vapid_not_configured" }, { status: 503 });
  }

  let q = admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth, subscription")
    .eq("company_id", companyId);

  const tid = typeof targetUserId === "string" ? targetUserId.trim() : "";
  if (tid) {
    q = q.eq("user_id", tid);
  }

  const { data: subs, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = JSON.stringify({
    title,
    body: textBody,
    url: url ?? "/",
    type: type ?? "info",
  });

  let sent = 0;
  let failed = 0;
  for (const row of subs ?? []) {
    const sub = rowToSubscription(row as SubRow);
    if (!sub?.endpoint) continue;
    try {
      await webpush.sendNotification(sub, payload, { TTL: 60 });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
