import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperadminAccess } from "@/lib/verify-api-session";
import { getAppBaseUrl } from "@/lib/app-url";
import { buildInvitationEmailHtml } from "@/lib/invitationEmailHtml";
import type { InvitationPlan } from "@/types/invitation";

export const runtime = "nodejs";

function planEmailLabel(plan: InvitationPlan): string {
  switch (plan) {
    case "trial":
      return "Trial";
    case "foundation":
      return "Foundation";
    case "obras":
      return "Operations";
    case "horarios":
      return "Horarios";
    case "logistica":
      return "Logística";
    case "todo_incluido":
      return "Todo Incluido";
    case "starter":
      return "Starter";
    case "pro":
      return "Pro";
    case "enterprise":
      return "Enterprise";
    default:
      return plan;
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperadminAccess(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: { invitationId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const invitationId = typeof body.invitationId === "string" ? body.invitationId.trim() : "";
  if (!invitationId) {
    return NextResponse.json({ error: "Missing invitationId" }, { status: 400 });
  }

  const { data: inv, error: fetchErr } = await admin
    .from("invitations")
    .select("*")
    .eq("id", invitationId)
    .maybeSingle();

  if (fetchErr || !inv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = inv as {
    status: string;
    expires_at: string;
    email: string;
    company_name: string;
    plan: InvitationPlan;
    message: string | null;
  };

  if (row.status !== "pending") {
    return NextResponse.json({ error: "Only pending invitations can be resent" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const { error: upErr } = await admin
    .from("invitations")
    .update({ token, expires_at: expiresAt, status: "pending" })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const base = getAppBaseUrl();
  const logoUrl = `${base.replace(/\/$/, "")}/logo-source.png`;
  const ctaUrl = `${base.replace(/\/$/, "")}/register/${encodeURIComponent(token)}`;

  const html = buildInvitationEmailHtml({
    companyName: row.company_name,
    planLabel: planEmailLabel(row.plan),
    message: row.message,
    ctaUrl,
    logoUrl,
    introLine: "You have been invited to join MachinPro.",
    planLinePrefix: "Assigned plan:",
    ctaLabel: "Activate account",
    expiryLine: "This invitation expires in 7 days.",
  });

  const resend = new Resend(resendKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <onboarding@resend.dev>";
  const { error: mailErr } = await resend.emails.send({
    from,
    to: row.email,
    subject: `Invitación a MachinPro — ${row.company_name}`,
    html,
  });

  if (mailErr) {
    console.error(mailErr);
    return NextResponse.json({ error: String(mailErr.message ?? mailErr) }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
