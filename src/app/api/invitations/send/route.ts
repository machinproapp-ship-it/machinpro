import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySuperadminAccess } from "@/lib/verify-api-session";
import { getAppBaseUrl } from "@/lib/app-url";
import { buildInvitationEmailHtml } from "@/lib/invitationEmailHtml";
import type { InvitationPlan } from "@/types/invitation";

export const runtime = "nodejs";

const PLANS: InvitationPlan[] = ["trial", "starter", "pro", "enterprise"];

function planEmailLabel(plan: InvitationPlan): string {
  switch (plan) {
    case "trial":
      return "Trial";
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

  let body: { email?: string; companyName?: string; plan?: string; message?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const plan = (typeof body.plan === "string" ? body.plan : "trial") as InvitationPlan;
  const message = typeof body.message === "string" ? body.message.trim() || null : null;

  if (!email || !companyName) {
    return NextResponse.json({ error: "Missing email or companyName" }, { status: 400 });
  }
  if (!PLANS.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const { data: inviter } = await admin
    .from("user_profiles")
    .select("full_name, display_name")
    .eq("id", auth.userId)
    .maybeSingle();
  const row = inviter as { full_name?: string | null; display_name?: string | null } | null;
  const invitedByName =
    (typeof row?.full_name === "string" && row.full_name.trim()) ||
    (typeof row?.display_name === "string" && row.display_name.trim()) ||
    "MachinPro";

  const token = randomUUID();
  const { data: inserted, error: insErr } = await admin
    .from("invitations")
    .insert({
      token,
      email,
      company_name: companyName,
      invited_by: auth.userId,
      invited_by_name: invitedByName,
      plan,
      message,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error(insErr);
    return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const base = getAppBaseUrl();
  const logoUrl = `${base.replace(/\/$/, "")}/logo-source.png`;
  const ctaUrl = `${base.replace(/\/$/, "")}/register/${encodeURIComponent(token)}`;

  const html = buildInvitationEmailHtml({
    companyName,
    planLabel: planEmailLabel(plan),
    message,
    ctaUrl,
    logoUrl,
    introLine: "You have been invited to join MachinPro.",
    planLinePrefix: "Assigned plan:",
    ctaLabel: "Activate account",
    expiryLine: "This invitation expires in 7 days.",
  });

  const resend = new Resend(resendKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
  const replyTo = "machinpro.app@gmail.com";
  const { error: mailErr } = await resend.emails.send({
    from,
    to: email,
    replyTo,
    subject: `Invitación a MachinPro — ${companyName}`,
    html,
  });

  if (mailErr) {
    console.error(mailErr);
    await admin.from("invitations").delete().eq("id", (inserted as { id: string }).id);
    return NextResponse.json({ error: String(mailErr.message ?? mailErr) }, { status: 502 });
  }

  return NextResponse.json({ success: true, invitationId: (inserted as { id: string }).id });
}
