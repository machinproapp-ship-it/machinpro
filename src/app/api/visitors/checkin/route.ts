import { NextRequest, NextResponse } from "next/server";
import { insertNotificationRow } from "@/lib/notifications-server";
import { dispatchWebPushToUser } from "@/lib/push-dispatch";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Body = {
  projectId?: string;
  name?: string;
  company?: string;
  reason?: string;
  phone?: string;
  signature?: string;
};

const MAX_NAME = 500;
const MAX_REASON = 500;
const MAX_COMPANY = 300;
const MAX_PHONE = 80;
/** ~4.5MB base64 PNG guard */
const MAX_SIGNATURE_CHARS = 6_500_000;

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const company =
    typeof body.company === "string" && body.company.trim() ? body.company.trim().slice(0, MAX_COMPANY) : null;
  const phone =
    typeof body.phone === "string" && body.phone.trim() ? body.phone.trim().slice(0, MAX_PHONE) : null;

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!reason || reason.length > MAX_REASON) {
    return NextResponse.json({ error: "reason required" }, { status: 400 });
  }
  if (
    !signature ||
    signature.length > MAX_SIGNATURE_CHARS ||
    !signature.startsWith("data:image/")
  ) {
    return NextResponse.json({ error: "signature required" }, { status: 400 });
  }

  const admin = createSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: project, error: pErr } = await admin
    .from("projects")
    .select("id, name, company_id")
    .eq("id", projectId)
    .eq("archived", false)
    .maybeSingle();

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ip_address = forwarded?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;
  const consent_timestamp = new Date().toISOString();

  const { data: row, error: insErr } = await admin
    .from("visitor_logs")
    .insert({
      company_id: project.company_id,
      project_id: project.id,
      project_name: project.name,
      visitor_name: name,
      visitor_company: company,
      visitor_email: null,
      visitor_phone: phone,
      visitor_id_number: null,
      purpose: reason,
      host_name: null,
      vehicle_plate: null,
      safety_briefing_accepted: true,
      signature_data: signature,
      photo_url: null,
      status: "checked_in",
      ip_address,
      user_agent,
      terms_version: "v1.0",
      consent_timestamp,
    })
    .select("*")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const company_id = String(project.company_id);
  const projectName = typeof project.name === "string" ? project.name : "Project";
  const { data: adminRows } = await admin
    .from("user_profiles")
    .select("id")
    .eq("company_id", company_id)
    .in("role", ["admin", "supervisor"]);
  const notifyIds = [...new Set((adminRows ?? []).map((r) => String((r as { id: string }).id)).filter(Boolean))];
  const title = "New site visitor";
  const bodyLine = `${name} checked in · ${projectName}`;
  for (const uid of notifyIds) {
    const ins = await insertNotificationRow(admin, {
      company_id,
      user_id: uid,
      type: "visitor_checked_in",
      title,
      body: bodyLine,
      data: {
        visitor_log_id: (row as { id?: string })?.id,
        project_id: projectId,
        visitor_name: name,
      },
    });
    if (ins.ok) {
      void dispatchWebPushToUser(admin, company_id, uid, {
        title,
        body: bodyLine,
        url: "/",
        type: "visitor_checked_in",
      });
    }
  }

  return NextResponse.json({ visitor: row });
}
