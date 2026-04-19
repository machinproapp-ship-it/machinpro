import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  clientIpFromNextRequest,
  rateLimitHeaders,
  rateLimitRecord,
} from "@/lib/ipRateLimiter";
import { buildFeedbackSupportEmailHtml } from "@/lib/transactionalEmailHtml";

export const runtime = "nodejs";

const RL_STORE = new Map<string, number[]>();

const ALLOWED_KEYS = new Set(["type", "message", "userId", "companyId", "page", "module"]);

export async function POST(req: NextRequest) {
  const ip = clientIpFromNextRequest(req);
  const rl = rateLimitRecord(RL_STORE, `feedback:${ip}`, { windowMs: 60 * 60 * 1000, max: 20 });
  const rh = rateLimitHeaders(rl);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429, headers: rh });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: rh });
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400, headers: rh });
  }
  const obj = raw as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (!ALLOWED_KEYS.has(k)) {
      return NextResponse.json({ ok: false, error: "Unexpected field" }, { status: 400, headers: rh });
    }
  }

  const userId = typeof obj.userId === "string" ? obj.userId.trim() : "";
  const companyId = typeof obj.companyId === "string" ? obj.companyId.trim() : "";
  const type = typeof obj.type === "string" ? obj.type.trim().slice(0, 32) : "";
  const message = typeof obj.message === "string" ? obj.message.trim() : "";
  const page = typeof obj.page === "string" ? obj.page.trim().slice(0, 2000) : "";
  const moduleRaw = typeof obj.module === "string" ? obj.module.trim().slice(0, 64) : "";
  const allowedModules = new Set([
    "central",
    "operations",
    "schedule",
    "logistics",
    "security",
    "settings",
    "general",
  ]);
  if (moduleRaw !== "" && !allowedModules.has(moduleRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid module" }, { status: 400, headers: rh });
  }
  const moduleVal = moduleRaw === "" ? null : moduleRaw;

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: rh });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500, headers: rh });
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: rh });
  }

  if (!userId || user.id !== userId) {
    return NextResponse.json({ ok: false, error: "Invalid user" }, { status: 403, headers: rh });
  }
  if (!message || message.length > 20_000) {
    return NextResponse.json({ ok: false, error: "Invalid message" }, { status: 400, headers: rh });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500, headers: rh });
  }

  const { data: prof, error: profErr } = await admin
    .from("user_profiles")
    .select("company_id, full_name, display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr || !prof) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 403, headers: rh });
  }

  const row = prof as {
    company_id?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    email?: string | null;
  };

  if (companyId && row.company_id !== companyId) {
    return NextResponse.json({ ok: false, error: "Company mismatch" }, { status: 403, headers: rh });
  }

  const effectiveCompanyId = (row.company_id as string) || companyId || null;
  const userName =
    (typeof row.full_name === "string" && row.full_name.trim()) ||
    (typeof row.display_name === "string" && row.display_name.trim()) ||
    (typeof row.email === "string" && row.email.trim()) ||
    user.email ||
    "";

  let companyDisplayName = "—";
  if (effectiveCompanyId) {
    const { data: coRow } = await admin.from("companies").select("name").eq("id", effectiveCompanyId).maybeSingle();
    const nm = (coRow as { name?: string | null } | null)?.name?.trim();
    if (nm) companyDisplayName = nm;
    else companyDisplayName = effectiveCompanyId;
  }

  const feedbackType = (type || "suggestion").slice(0, 32);

  const { data: fbRow, error: fbErr } = await admin
    .from("feedback")
    .insert({
      company_id: effectiveCompanyId,
      user_id: user.id,
      type: feedbackType,
      description: message,
      module: moduleVal,
      url: page || null,
    })
    .select("id")
    .maybeSingle();

  if (fbErr) {
    console.error("[api/feedback] feedback insert", fbErr);
    if (fbErr.code === "42P01" || fbErr.message?.includes("does not exist")) {
      return NextResponse.json({ ok: false, error: "feedback_table_missing" }, { status: 503, headers: rh });
    }
    return NextResponse.json({ ok: false, error: "Could not save feedback" }, { status: 500, headers: rh });
  }

  const feedbackId = (fbRow as { id?: string } | null)?.id ?? null;

  const newValue = {
    feedback_id: feedbackId,
    feedback_type: feedbackType,
    message,
    page: page || null,
    module: moduleVal,
    user_id: user.id,
    company_id: effectiveCompanyId,
  };

  const { error: auditErr } = await admin.from("audit_logs").insert({
    company_id: effectiveCompanyId,
    user_id: user.id,
    user_name: userName || null,
    action: "feedback_submitted",
    entity_type: "feedback",
    entity_id: feedbackId ?? user.id,
    new_value: newValue,
  });

  if (auditErr) {
    console.error("[api/feedback] audit_logs", auditErr);
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const moduleLabel = moduleVal || "general";
      const html = buildFeedbackSupportEmailHtml({
        feedbackType,
        moduleLabel,
        companyLabel: companyDisplayName,
        userLabel: userName || user.email || user.id,
        userId: user.id,
        pageUrl: page || null,
        feedbackId,
        message,
      });
      const subject = `[MachinPro Beta] ${feedbackType} — ${moduleLabel} — ${companyDisplayName}`;
      const resend = new Resend(resendKey);
      const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
      const { error: sendErr } = await resend.emails.send({
        from,
        to: "support@machin.pro",
        replyTo: "support@machin.pro",
        subject,
        html,
      });
      if (sendErr) {
        console.error("[api/feedback] resend", sendErr);
      }
    } catch (e) {
      console.error("[api/feedback] resend", e);
    }
  }

  return NextResponse.json({ ok: true }, { headers: rh });
}
