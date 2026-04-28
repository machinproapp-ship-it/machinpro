import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";
import { getSessionUserAndCompany } from "@/lib/notifications-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUserAndCompany(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { instanceId?: string; email?: string; recipientName?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const instanceId = typeof body.instanceId === "string" ? body.instanceId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const recipientName =
      typeof body.recipientName === "string" ? body.recipientName.trim() : "";

    if (!instanceId || !email || !recipientName) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const admin = createSupabaseServiceRole();
    if (!admin) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const { data: inst, error: instErr } = await admin
      .from("form_instances")
      .select("id, company_id, template_id, sign_token, field_values")
      .eq("id", instanceId)
      .maybeSingle();

    if (instErr || !inst) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const row = inst as {
      company_id?: string;
      template_id?: string | null;
      sign_token?: string | null;
      field_values?: Record<string, unknown>;
    };

    if (String(row.company_id ?? "") !== session.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const token = typeof row.sign_token === "string" ? row.sign_token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "sign_token missing" }, { status: 400 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://machin.pro";
    const signUrl = `${baseUrl.replace(/\/$/, "")}/sign/${token}`;

    let templateName = "Form";
    if (row.template_id) {
      const { data: tpl } = await admin
        .from("form_templates")
        .select("name")
        .eq("id", row.template_id)
        .maybeSingle();
      const t = tpl as { name?: string } | null;
      if (t?.name) templateName = t.name;
    }

    const { data: co } = await admin
      .from("companies")
      .select("name, logo_url")
      .eq("id", session.companyId)
      .maybeSingle();

    const company = co as { name?: string | null; logo_url?: string | null } | null;
    const companyName = typeof company?.name === "string" ? company.name : "MachinPro";
    const logoUrl =
      typeof company?.logo_url === "string" && company.logo_url.trim()
        ? company.logo_url.trim()
        : null;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 });
    }

    const resend = new Resend(resendKey);
    const subject = `Firma requerida: ${templateName} - ${companyName}`;

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b;background:#fafafa;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e4e4e7;padding:28px;">
    <tr><td>
      ${logoUrl ? `<div style="margin-bottom:16px;"><img src="${logoUrl}" alt="" width="160" style="max-width:160px;height:auto;" /></div>` : ""}
      <p style="margin:0 0 8px;font-size:18px;font-weight:600;">${companyName}</p>
      <p style="margin:0 0 20px;color:#52525b;font-size:15px;">Hola ${recipientName},</p>
      <p style="margin:0 0 20px;color:#3f3f46;font-size:15px;">Se requiere tu firma en el documento <strong>${templateName}</strong>.</p>
      <p style="margin:0 0 24px;">
        <a href="${signUrl}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px;">Firmar ahora</a>
      </p>
      <p style="margin:0;font-size:12px;color:#a1a1aa;">Powered by <a href="https://machin.pro" style="color:#d97706;">MachinPro</a> · machin.pro</p>
    </td></tr>
  </table>
</body></html>`;

    const { error: mailErr } = await resend.emails.send({
      from: "noreply@machin.pro",
      to: email,
      subject,
      html,
    });

    if (mailErr) {
      console.error("[forms/external/send-email]", mailErr);
      return NextResponse.json({ error: "send_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[forms/external/send-email]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
