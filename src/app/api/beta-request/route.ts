import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; company?: string | null; country?: string | null; message?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const company = typeof body.company === "string" ? body.company.trim() || null : null;
  const country = typeof body.country === "string" ? body.country.trim() || null : null;
  const message = typeof body.message === "string" ? body.message.trim() || null : null;

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { error: insErr } = await admin.from("beta_requests").insert({
    name,
    email,
    company,
    country,
    message,
    status: "pending",
  });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <onboarding@resend.dev>";
      await resend.emails.send({
        from,
        to: email,
        subject: "MachinPro · Beta access request received",
        html: `<p>Hi ${name.split(" ")[0] || name},</p>
<p>Thanks for requesting beta access to MachinPro. We have received your application and will contact you soon.</p>
<p>— MachinPro</p>`,
      });
    } catch {
      /* non-fatal */
    }
  }

  return NextResponse.json({ ok: true });
}
