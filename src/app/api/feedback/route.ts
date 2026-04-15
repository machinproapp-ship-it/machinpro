import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Body = {
  type?: string;
  message?: string;
  userId?: string;
  companyId?: string;
  page?: string;
  module?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim().slice(0, 32) : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const page = typeof body.page === "string" ? body.page.trim().slice(0, 2000) : "";
  const moduleRaw = typeof body.module === "string" ? body.module.trim().slice(0, 64) : "";
  const allowedModules = new Set([
    "central",
    "operations",
    "schedule",
    "logistics",
    "security",
    "settings",
    "general",
    "",
  ]);
  const module = allowedModules.has(moduleRaw) ? (moduleRaw || null) : null;

  if (!userId || user.id !== userId) {
    return NextResponse.json({ ok: false, error: "Invalid user" }, { status: 403 });
  }
  if (!message || message.length > 20_000) {
    return NextResponse.json({ ok: false, error: "Invalid message" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  const { data: prof, error: profErr } = await admin
    .from("user_profiles")
    .select("company_id, full_name, display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr || !prof) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 403 });
  }

  const row = prof as {
    company_id?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    email?: string | null;
  };

  if (companyId && row.company_id !== companyId) {
    return NextResponse.json({ ok: false, error: "Company mismatch" }, { status: 403 });
  }

  const effectiveCompanyId = (row.company_id as string) || companyId || null;
  const userName =
    (typeof row.full_name === "string" && row.full_name.trim()) ||
    (typeof row.display_name === "string" && row.display_name.trim()) ||
    (typeof row.email === "string" && row.email.trim()) ||
    user.email ||
    "";

  const feedbackType = (type || "suggestion").slice(0, 32);

  const { data: fbRow, error: fbErr } = await admin
    .from("feedback")
    .insert({
      company_id: effectiveCompanyId,
      user_id: user.id,
      type: feedbackType,
      description: message,
      module,
      url: page || null,
    })
    .select("id")
    .maybeSingle();

  if (fbErr) {
    console.error("[api/feedback] feedback insert", fbErr);
    if (fbErr.code === "42P01" || fbErr.message?.includes("does not exist")) {
      return NextResponse.json({ ok: false, error: "feedback_table_missing" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Could not save feedback" }, { status: 500 });
  }

  const feedbackId = (fbRow as { id?: string } | null)?.id ?? null;

  const newValue = {
    feedback_id: feedbackId,
    feedback_type: feedbackType,
    message,
    page: page || null,
    module,
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
      const resend = new Resend(resendKey);
      const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
      const subject = `[MachinPro Feedback] ${feedbackType} — ${userName || user.id}`;
      const html = `<p><strong>MachinPro — feedback (beta)</strong></p>
<ul>
<li><strong>Tipo:</strong> ${escapeHtml(feedbackType || "—")}</li>
<li><strong>Módulo:</strong> ${escapeHtml(module ?? "—")}</li>
<li><strong>Usuario:</strong> ${escapeHtml(userName)} (${escapeHtml(user.id)})</li>
<li><strong>Empresa:</strong> ${escapeHtml(effectiveCompanyId ?? "—")}</li>
<li><strong>Página:</strong> ${page ? escapeHtml(page) : "—"}</li>
<li><strong>Id feedback:</strong> ${escapeHtml(feedbackId ?? "—")}</li>
</ul>
<p><strong>Mensaje:</strong></p>
<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;

      const { error: sendErr } = await resend.emails.send({
        from,
        to: "support@machin.pro",
        replyTo: typeof row.email === "string" && row.email.includes("@") ? row.email : undefined,
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

  return NextResponse.json({ ok: true });
}
