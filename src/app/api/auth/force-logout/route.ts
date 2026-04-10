import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyAdmin } from "@/lib/verify-api-session";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  let body: { targetUserId?: string; companyId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
  if (!companyId || !targetUserId) {
    return NextResponse.json({ error: "Missing companyId or targetUserId" }, { status: 400 });
  }

  const adminActor = await verifyCompanyAdmin(req, companyId);
  if (!adminActor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (targetUserId === adminActor.userId) {
    return NextResponse.json({ error: "Cannot force logout yourself" }, { status: 400 });
  }

  const admin = createSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: target, error: guErr } = await admin.auth.admin.getUserById(targetUserId);
  if (guErr || !target?.user) {
    return NextResponse.json({ error: guErr?.message ?? "User not found" }, { status: 404 });
  }

  const { data: row } = await admin
    .from("user_profiles")
    .select("company_id")
    .eq("id", targetUserId)
    .maybeSingle();
  const prof = row as { company_id?: string | null } | null;
  if (!prof || prof.company_id !== companyId) {
    return NextResponse.json({ error: "User not in company" }, { status: 403 });
  }

  const meta = { ...(target.user.app_metadata ?? {}) };
  const prev = Number(meta.machinpro_session_rev ?? 0);
  meta.machinpro_session_rev = prev + 1;

  const { error: upErr } = await admin.auth.admin.updateUserById(targetUserId, {
    app_metadata: meta,
  });
  if (upErr) {
    console.error("[api/auth/force-logout] updateUserById", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const ip = clientIp(req);
  const ua = req.headers.get("user-agent")?.slice(0, 500) ?? "";
  const { data: actorRow } = await admin
    .from("user_profiles")
    .select("full_name, display_name, email")
    .eq("id", adminActor.userId)
    .maybeSingle();
  const ar = actorRow as { full_name?: string | null; display_name?: string | null; email?: string | null } | null;
  const actorName =
    (typeof ar?.full_name === "string" && ar.full_name.trim()) ||
    (typeof ar?.display_name === "string" && ar.display_name.trim()) ||
    (typeof ar?.email === "string" && ar.email.trim()) ||
    "";

  const { error: audErr } = await admin.from("audit_logs").insert({
    company_id: companyId,
    user_id: adminActor.userId,
    user_name: actorName || null,
    action: "auth_force_logout",
    entity_type: "auth",
    entity_id: targetUserId,
    new_value: { ip, userAgent: ua, event: "auth_force_logout", targetUserId },
  });
  if (audErr) console.error("[api/auth/force-logout] audit", audErr);

  return NextResponse.json({ ok: true });
}
