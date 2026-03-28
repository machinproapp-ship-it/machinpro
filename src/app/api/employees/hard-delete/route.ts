import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRole } from "@/lib/supabase-admin";
import { verifyCanManageEmployees } from "@/lib/verify-api-session";

/**
 * Eliminación GDPR: requiere `SUPABASE_SERVICE_ROLE_KEY` en el servidor (Vercel env).
 * Nunca colocar esa clave en `NEXT_PUBLIC_*`.
 *
 * Requiere migración: `src/lib/user_profiles_gdpr_hard_delete.sql` (quitar ON DELETE CASCADE
 * desde auth.users) para que la fila anonimizada sobreviva a `auth.admin.deleteUser`.
 */
export const runtime = "nodejs";

const TOMBSTONE_FULL_NAME = "Empleado eliminado";

export async function POST(req: NextRequest) {
  const admin = createSupabaseServiceRole();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: { companyId?: string; userId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const targetUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!companyId || !targetUserId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const actor = await verifyCanManageEmployees(req, companyId);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (actor.userId === targetUserId) {
    return NextResponse.json({ error: "Cannot delete own account" }, { status: 400 });
  }

  const { data: target, error: fetchErr } = await admin
    .from("user_profiles")
    .select("id, company_id, full_name, email, role, profile_status")
    .eq("id", targetUserId)
    .maybeSingle();

  if (fetchErr || !target) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const row = target as {
    id: string;
    company_id?: string | null;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
    profile_status?: string | null;
  };

  if (row.company_id !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if ((row.profile_status ?? "") === "deleted") {
    return NextResponse.json({ error: "Already deleted" }, { status: 400 });
  }

  const { data: actorProfile } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("id", actor.userId)
    .maybeSingle();
  const actorName = (actorProfile as { full_name?: string } | null)?.full_name ?? "";

  const ts = Date.now();
  const tombstoneEmail = `deleted_${ts}@deleted.local`;

  const { error: upErr } = await admin
    .from("user_profiles")
    .update({
      full_name: TOMBSTONE_FULL_NAME,
      display_name: null,
      email: tombstoneEmail,
      phone: null,
      avatar_url: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      emergency_contact_relation: null,
      pay_amount: null,
      profile_status: "deleted",
    })
    .eq("id", targetUserId)
    .eq("company_id", companyId);

  if (upErr) {
    console.error("[employees/hard-delete] profile update", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(targetUserId);
  if (authErr) {
    console.error("[employees/hard-delete] auth.admin.deleteUser", authErr);
    return NextResponse.json(
      {
        error: authErr.message,
        hint: "Profile anonymized but Auth deletion failed. If the row vanished, apply user_profiles_gdpr_hard_delete.sql and retry.",
      },
      { status: 500 }
    );
  }

  const { error: auditErr } = await admin.from("audit_logs").insert({
    company_id: companyId,
    user_id: actor.userId,
    user_name: actorName,
    action: "employee_hard_deleted",
    entity_type: "employee",
    entity_id: targetUserId,
    entity_name: TOMBSTONE_FULL_NAME,
    old_value: { had_email: Boolean((row.email ?? "").trim()) },
    new_value: { profile_status: "deleted", auth_removed: true },
  });

  if (auditErr) {
    console.error("[employees/hard-delete] audit_logs", auditErr);
  }

  return NextResponse.json({ ok: true });
}
