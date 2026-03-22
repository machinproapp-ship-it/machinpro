import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function configureWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_MAILTO ?? "mailto:support@machin.pro";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
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
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { companyId, title, body: textBody, url, type } = body;
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

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("subscription")
    .eq("company_id", companyId);

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
    const sub = (row as { subscription: webpush.PushSubscription }).subscription;
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
