import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "auth_login",
  "auth_logout",
  "auth_password_reset_requested",
  "auth_password_reset_completed",
  "auth_session_timeout",
]);

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    let body: { action?: string; companyId?: string | null; email?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const action = typeof body.action === "string" ? body.action.trim() : "";
    if (!ALLOWED.has(action)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ip = clientIp(req);
    const ua = req.headers.get("user-agent")?.slice(0, 500) ?? "";
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

    const admin = createSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ ok: true });
    }

    let userId = "00000000-0000-0000-0000-000000000000";
    let userName = "";
    let companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";

    if (token) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && anon) {
        const supabase = createClient(url, anon, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const {
          data: { user },
        } = await supabase.auth.getUser(token);
        if (user?.id) {
          userId = user.id;
          const { data: row } = await admin
            .from("user_profiles")
            .select("company_id, full_name, display_name, email")
            .eq("id", user.id)
            .maybeSingle();
          const r = row as {
            company_id?: string | null;
            full_name?: string | null;
            display_name?: string | null;
            email?: string | null;
          } | null;
          if (r?.company_id && !companyId) companyId = String(r.company_id);
          userName =
            (typeof r?.full_name === "string" && r.full_name.trim()) ||
            (typeof r?.display_name === "string" && r.display_name.trim()) ||
            (typeof r?.email === "string" && r.email.trim()) ||
            user.email ||
            "";
        }
      }
    }

    const eventPayload = {
      ip,
      userAgent: ua,
      event: action,
      ...(typeof body.email === "string" && body.email.trim() ? { email: body.email.trim() } : {}),
    };

    const { error } = await admin.from("audit_logs").insert({
      company_id: companyId || null,
      user_id: userId,
      user_name: userName || null,
      action,
      entity_type: "auth",
      entity_id: userId,
      new_value: eventPayload,
    });
    if (error) {
      console.error("[api/auth/audit]", error);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/auth/audit]", e);
    return NextResponse.json({ ok: true });
  }
}
