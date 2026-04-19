import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  clientIpFromNextRequest,
  rateLimitHeaders,
  rateLimitRecord,
} from "@/lib/ipRateLimiter";
import { buildPasswordResetEmailHtml } from "@/lib/transactionalEmailHtml";
import { getAppBaseUrl } from "@/lib/app-url";

export const runtime = "nodejs";

const RL_STORE = new Map<string, number[]>();

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Public endpoint — branded recovery email via Resend (does not reveal whether the email exists). */
export async function POST(req: NextRequest) {
  const ip = clientIpFromNextRequest(req);
  const rl = rateLimitRecord(RL_STORE, `pwd-reset:${ip}`, { windowMs: 60 * 60 * 1000, max: 10 });
  const rh = rateLimitHeaders(rl);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429, headers: rh });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: rh });
  }
  const raw =
    body && typeof body === "object" && typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";
  if (!raw || !isEmail(raw)) {
    return NextResponse.json({ ok: true }, { status: 200, headers: rh });
  }

  const admin = createSupabaseAdmin();
  const resendKey = process.env.RESEND_API_KEY;
  if (!admin || !resendKey) {
    return NextResponse.json({ ok: true }, { status: 200, headers: rh });
  }

  const base = getAppBaseUrl().replace(/\/$/, "");
  const redirectTo = `${base}/reset-password`;

  try {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: raw,
      options: { redirectTo },
    });
    const actionLink = linkData?.properties?.action_link;
    if (linkErr || !actionLink) {
      return NextResponse.json({ ok: true }, { status: 200, headers: rh });
    }

    const html = buildPasswordResetEmailHtml({ resetUrl: actionLink });
    const resend = new Resend(resendKey);
    const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
    await resend.emails.send({
      from,
      to: raw,
      replyTo: "support@machin.pro",
      subject: "Reset your MachinPro password",
      html,
    });
  } catch (e) {
    console.error("[password-reset-email]", e);
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: rh });
}
