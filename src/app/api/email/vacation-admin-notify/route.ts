import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  buildVacationAdminEmailHtml,
  MACHINPRO_EMAIL_ORIGIN,
} from "@/lib/transactionalEmailHtml";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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

  let body: { vacationRequestId?: string };
  try {
    body = (await req.json()) as { vacationRequestId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const vacationRequestId =
    typeof body.vacationRequestId === "string" ? body.vacationRequestId.trim() : "";
  if (!vacationRequestId) {
    return NextResponse.json({ ok: false, error: "Missing vacationRequestId" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  const { data: row, error: rowErr } = await admin
    .from("vacation_requests")
    .select("id, company_id, user_id, start_date, end_date, notes, status")
    .eq("id", vacationRequestId)
    .maybeSingle();

  if (rowErr || !row) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const r = row as {
    company_id: string;
    user_id: string;
    start_date: string;
    end_date: string;
    notes: string | null;
    status: string;
  };

  if (r.user_id !== user.id || r.status !== "pending") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: comp } = await admin
    .from("companies")
    .select("name")
    .eq("id", r.company_id)
    .maybeSingle();
  const companyName = (comp as { name?: string | null } | null)?.name?.trim() ?? "MachinPro";

  const { data: requester } = await admin
    .from("user_profiles")
    .select("full_name, display_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const rp = requester as {
    full_name?: string | null;
    display_name?: string | null;
    email?: string | null;
  } | null;
  const employeeName =
    (typeof rp?.full_name === "string" && rp.full_name.trim()) ||
    (typeof rp?.display_name === "string" && rp.display_name.trim()) ||
    (typeof rp?.email === "string" && rp.email.trim()) ||
    user.email ||
    "Employee";

  const { data: admins } = await admin
    .from("user_profiles")
    .select("id, email, role")
    .eq("company_id", r.company_id);

  const targets: string[] = [];
  const list = (admins ?? []) as { id: string; email?: string | null; role?: string | null }[];
  for (const a of list) {
    const role = (a.role ?? "").toLowerCase();
    if (role !== "admin" && role !== "supervisor") continue;
    if (a.id === user.id) continue;
    const em = typeof a.email === "string" ? a.email.trim() : "";
    if (em.includes("@")) targets.push(em);
  }

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no_admin_emails" });
  }

  const reviewUrl = MACHINPRO_EMAIL_ORIGIN.replace(/\/$/, "");
  const html = buildVacationAdminEmailHtml({
    companyName,
    employeeName,
    startDate: r.start_date,
    endDate: r.end_date,
    absenceNotes: r.notes,
    reviewUrl,
  });

  try {
    const resend = new Resend(resendKey);
    const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
    const subject = `New vacation request from ${employeeName}`;
    await resend.emails.send({
      from,
      to: targets,
      replyTo: "support@machin.pro",
      subject,
      html,
    });
  } catch (e) {
    console.error("[vacation-admin-notify]", e);
    return NextResponse.json({ ok: false, error: "Send failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
